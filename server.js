const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 38024;
const COMFYUI_URL = 'http://127.0.0.1:8188';

// 创建必要的目录
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'outputs');
[UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 配置文件上传
const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|webp)$/i;
        if (allowed.test(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// 静态文件服务
app.use(express.static('public'));
app.use('/outputs', express.static(OUTPUT_DIR));
app.use(express.json());

// 上传图片到ComfyUI
async function uploadImageToComfyUI(filePath, filename) {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(filePath), filename);
    formData.append('overwrite', 'true');
    
    await axios.post(`${COMFYUI_URL}/upload/image`, formData, {
        headers: formData.getHeaders()
    });
}

// 生成工作流
function generateWorkflow(imageName, prompt, seed) {
    return {
        "9": {
            "inputs": {
                "filename_prefix": "p2p-edit",
                "images": ["75:65", 0]
            },
            "class_type": "SaveImage"
        },
        "76": {
            "inputs": {
                "image": imageName
            },
            "class_type": "LoadImage"
        },
        "75:61": {
            "inputs": {
                "sampler_name": "euler"
            },
            "class_type": "KSamplerSelect"
        },
        "75:64": {
            "inputs": {
                "noise": ["75:73", 0],
                "guider": ["75:63", 0],
                "sampler": ["75:61", 0],
                "sigmas": ["75:62", 0],
                "latent_image": ["75:66", 0]
            },
            "class_type": "SamplerCustomAdvanced"
        },
        "75:65": {
            "inputs": {
                "samples": ["75:64", 0],
                "vae": ["75:72", 0]
            },
            "class_type": "VAEDecode"
        },
        "75:73": {
            "inputs": {
                "noise_seed": seed
            },
            "class_type": "RandomNoise"
        },
        "75:70": {
            "inputs": {
                "unet_name": "flux2/FLUX.2-klein-9b-fp8/flux-2-klein-9b-fp8.safetensors",
                "weight_dtype": "default"
            },
            "class_type": "UNETLoader"
        },
        "75:71": {
            "inputs": {
                "clip_name": "qwen_3_8b_fp8mixed.safetensors",
                "type": "flux2",
                "device": "default"
            },
            "class_type": "CLIPLoader"
        },
        "75:72": {
            "inputs": {
                "vae_name": "flux2-vae.safetensors"
            },
            "class_type": "VAELoader"
        },
        "75:66": {
            "inputs": {
                "width": ["75:81", 0],
                "height": ["75:81", 1],
                "batch_size": 1
            },
            "class_type": "EmptyFlux2LatentImage"
        },
        "75:80": {
            "inputs": {
                "upscale_method": "nearest-exact",
                "megapixels": 1,
                "resolution_steps": 1,
                "image": ["76", 0]
            },
            "class_type": "ImageScaleToTotalPixels"
        },
        "75:63": {
            "inputs": {
                "cfg": 1,
                "model": ["75:70", 0],
                "positive": ["75:79:77", 0],
                "negative": ["75:79:76", 0]
            },
            "class_type": "CFGGuider"
        },
        "75:62": {
            "inputs": {
                "steps": 4,
                "width": ["75:81", 0],
                "height": ["75:81", 1]
            },
            "class_type": "Flux2Scheduler"
        },
        "75:74": {
            "inputs": {
                "text": prompt,
                "clip": ["75:71", 0]
            },
            "class_type": "CLIPTextEncode"
        },
        "75:82": {
            "inputs": {
                "conditioning": ["75:74", 0]
            },
            "class_type": "ConditioningZeroOut"
        },
        "75:81": {
            "inputs": {
                "image": ["75:80", 0]
            },
            "class_type": "GetImageSize"
        },
        "75:79:76": {
            "inputs": {
                "conditioning": ["75:82", 0],
                "latent": ["75:79:78", 0]
            },
            "class_type": "ReferenceLatent"
        },
        "75:79:78": {
            "inputs": {
                "pixels": ["75:80", 0],
                "vae": ["75:72", 0]
            },
            "class_type": "VAEEncode"
        },
        "75:79:77": {
            "inputs": {
                "conditioning": ["75:74", 0],
                "latent": ["75:79:78", 0]
            },
            "class_type": "ReferenceLatent"
        }
    };
}

// 提交工作流到ComfyUI
async function queuePrompt(workflow) {
    const response = await axios.post(`${COMFYUI_URL}/prompt`, {
        prompt: workflow,
        client_id: uuidv4()
    });
    return response.data.prompt_id;
}

// 轮询检查任务状态
async function waitForCompletion(promptId, timeout = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        try {
            const historyRes = await axios.get(`${COMFYUI_URL}/history/${promptId}`);
            const history = historyRes.data[promptId];
            
            if (history && history.status && history.status.completed) {
                // 获取输出图片
                const outputs = history.outputs;
                for (const nodeId in outputs) {
                    if (outputs[nodeId].images) {
                        return outputs[nodeId].images[0];
                    }
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    throw new Error('Timeout waiting for image generation');
}

// API: 编辑图片
app.post('/api/edit', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }
        
        const { prompt } = req.body;
        if (!prompt || prompt.trim() === '') {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        const imageName = req.file.filename;
        const seed = Math.floor(Math.random() * 1000000000000000);
        
        // 上传图片到ComfyUI
        await uploadImageToComfyUI(req.file.path, imageName);
        
        // 生成并提交工作流
        const workflow = generateWorkflow(imageName, prompt, seed);
        const promptId = await queuePrompt(workflow);
        
        // 等待完成
        const result = await waitForCompletion(promptId);
        
        // 下载结果图片
        const imageUrl = `${COMFYUI_URL}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        
        const outputFilename = `${uuidv4()}.png`;
        const outputPath = path.join(OUTPUT_DIR, outputFilename);
        fs.writeFileSync(outputPath, imageResponse.data);
        
        res.json({
            success: true,
            image: `/outputs/${outputFilename}`,
            prompt: prompt
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Failed to process image',
            details: error.message 
        });
    }
});

// 健康检查
app.get('/api/health', async (req, res) => {
    try {
        await axios.get(`${COMFYUI_URL}/system_stats`);
        res.json({ status: 'ok', comfyui: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'error', comfyui: 'disconnected' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=== P2P Image Editor Server ===`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Network: http://10.143.12.80:${PORT}`);
    console.log(`ComfyUI: ${COMFYUI_URL}`);
    console.log(`================================\n`);
});
