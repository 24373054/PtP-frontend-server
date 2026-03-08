const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const app = express();
const PORT = 38024;
const COMFYUI_URL = 'http://127.0.0.1:8188';

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, 'users.json');

// 订阅方案配置
const SUBSCRIPTION_PLANS = {
    free: {
        name: { en: 'Free', zh: '免费版' },
        credits: 10,
        creditCost: { edit: 2, generate: 1 },
        price: 0,
        features: {
            en: ['10 credits/month', 'Basic quality', 'Standard support'],
            zh: ['10 积分/月', '基础画质', '标准支持']
        }
    },
    basic: {
        name: { en: 'Basic', zh: '基础版' },
        credits: 100,
        creditCost: { edit: 2, generate: 1 },
        price: 9.99,
        features: {
            en: ['100 credits/month', 'High quality', 'Priority support', 'No watermark'],
            zh: ['100 积分/月', '高清画质', '优先支持', '无水印']
        }
    },
    pro: {
        name: { en: 'Professional', zh: '专业版' },
        credits: 500,
        creditCost: { edit: 1, generate: 1 },
        price: 29.99,
        features: {
            en: ['500 credits/month', 'Ultra quality', '24/7 support', 'API access', 'Commercial license'],
            zh: ['500 积分/月', '超高清画质', '24/7 支持', 'API 访问', '商业授权']
        }
    },
    enterprise: {
        name: { en: 'Enterprise', zh: '企业版' },
        credits: 2000,
        creditCost: { edit: 1, generate: 1 },
        price: 99.99,
        features: {
            en: ['2000 credits/month', 'Maximum quality', 'Dedicated support', 'Custom API', 'White label', 'SLA guarantee'],
            zh: ['2000 积分/月', '最高画质', '专属支持', '定制 API', '白标服务', 'SLA 保障']
        }
    },
    beta: {
        name: { en: 'Beta User', zh: '内测用户' },
        credits: 999999,
        creditCost: { edit: 0, generate: 0 },
        price: 0,
        features: {
            en: ['Unlimited credits', 'All features', 'Beta access'],
            zh: ['无限积分', '全部功能', '内测权限']
        }
    }
};

// 读取用户数据
function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load users:', error);
        return {};
    }
}

// 保存用户数据
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        console.error('Failed to save users:', error);
        return false;
    }
}

// 验证访问码并返回用户信息
function authenticateUser(accessCode) {
    const users = loadUsers();
    const user = users[accessCode];
    
    if (!user) {
        return null;
    }
    
    // 添加订阅方案信息
    const plan = SUBSCRIPTION_PLANS[user.plan] || SUBSCRIPTION_PLANS.free;
    
    return {
        userId: user.userId,
        username: user.username,
        email: user.email,
        plan: user.plan,
        planName: plan.name.en, // 默认返回英文名称，前端会根据语言切换
        credits: user.credits,
        usedCredits: user.usedCredits,
        creditCost: plan.creditCost,
        features: plan.features.en,
        createdAt: user.createdAt,
        expiresAt: user.expiresAt
    };
}

// 扣除积分
function deductCredits(accessCode, operation) {
    const users = loadUsers();
    const user = users[accessCode];
    
    if (!user) {
        return { success: false, error: 'User not found' };
    }
    
    const plan = SUBSCRIPTION_PLANS[user.plan] || SUBSCRIPTION_PLANS.free;
    const cost = plan.creditCost[operation] || 1;
    
    // Beta用户不扣积分
    if (user.plan === 'beta') {
        return { success: true, credits: user.credits, cost: 0 };
    }
    
    if (user.credits < cost) {
        return { success: false, error: 'Insufficient credits', credits: user.credits, required: cost };
    }
    
    user.credits -= cost;
    user.usedCredits += cost;
    
    if (saveUsers(users)) {
        return { success: true, credits: user.credits, cost: cost };
    } else {
        return { success: false, error: 'Failed to update credits' };
    }
}

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

// API: 用户认证
app.post('/api/auth', (req, res) => {
    const { accessCode } = req.body;
    
    if (!accessCode) {
        return res.status(400).json({ error: 'Access code is required' });
    }
    
    const user = authenticateUser(accessCode);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid access code' });
    }
    
    res.json({
        success: true,
        user: user
    });
});

// API: 获取订阅方案
app.get('/api/plans', (req, res) => {
    const lang = req.query.lang || 'en';
    
    const plans = Object.entries(SUBSCRIPTION_PLANS)
        .filter(([key]) => key !== 'beta') // 不显示beta方案
        .map(([key, plan]) => ({
            id: key,
            name: plan.name[lang] || plan.name.en,
            credits: plan.credits,
            price: plan.price,
            features: plan.features[lang] || plan.features.en,
            creditCost: plan.creditCost
        }));
    
    res.json({ plans });
});

// 上传图片到ComfyUI
async function uploadImageToComfyUI(filePath, filename) {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(filePath), filename);
    formData.append('overwrite', 'true');
    
    await axios.post(`${COMFYUI_URL}/upload/image`, formData, {
        headers: formData.getHeaders()
    });
}

// 生成P2P工作流（图片编辑）
function generateP2PWorkflow(imageName, prompt, seed) {
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

// 生成T2I工作流（文字生成图片）
function generateT2IWorkflow(prompt, width, height, seed, steps, cfg) {
    return {
        "76": {
            "inputs": {
                "value": prompt
            },
            "class_type": "PrimitiveStringMultiline"
        },
        "78": {
            "inputs": {
                "filename_prefix": "t2i-gen",
                "images": ["77:65", 0]
            },
            "class_type": "SaveImage"
        },
        "77:61": {
            "inputs": {
                "sampler_name": "euler"
            },
            "class_type": "KSamplerSelect"
        },
        "77:64": {
            "inputs": {
                "noise": ["77:73", 0],
                "guider": ["77:63", 0],
                "sampler": ["77:61", 0],
                "sigmas": ["77:62", 0],
                "latent_image": ["77:66", 0]
            },
            "class_type": "SamplerCustomAdvanced"
        },
        "77:65": {
            "inputs": {
                "samples": ["77:64", 0],
                "vae": ["77:72", 0]
            },
            "class_type": "VAEDecode"
        },
        "77:66": {
            "inputs": {
                "width": ["77:68", 0],
                "height": ["77:69", 0],
                "batch_size": 1
            },
            "class_type": "EmptyFlux2LatentImage"
        },
        "77:68": {
            "inputs": {
                "value": width
            },
            "class_type": "PrimitiveInt"
        },
        "77:69": {
            "inputs": {
                "value": height
            },
            "class_type": "PrimitiveInt"
        },
        "77:73": {
            "inputs": {
                "noise_seed": seed
            },
            "class_type": "RandomNoise"
        },
        "77:70": {
            "inputs": {
                "unet_name": "flux2/FLUX.2-klein-9b-fp8/flux-2-klein-9b-fp8.safetensors",
                "weight_dtype": "default"
            },
            "class_type": "UNETLoader"
        },
        "77:71": {
            "inputs": {
                "clip_name": "qwen_3_8b_fp8mixed.safetensors",
                "type": "flux2",
                "device": "default"
            },
            "class_type": "CLIPLoader"
        },
        "77:72": {
            "inputs": {
                "vae_name": "flux2-vae.safetensors"
            },
            "class_type": "VAELoader"
        },
        "77:63": {
            "inputs": {
                "cfg": cfg,
                "model": ["77:70", 0],
                "positive": ["77:74", 0],
                "negative": ["77:76", 0]
            },
            "class_type": "CFGGuider"
        },
        "77:76": {
            "inputs": {
                "conditioning": ["77:74", 0]
            },
            "class_type": "ConditioningZeroOut"
        },
        "77:74": {
            "inputs": {
                "text": ["76", 0],
                "clip": ["77:71", 0]
            },
            "class_type": "CLIPTextEncode"
        },
        "77:62": {
            "inputs": {
                "steps": steps,
                "width": ["77:68", 0],
                "height": ["77:69", 0]
            },
            "class_type": "Flux2Scheduler"
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

// 生成缩略图
async function generateThumbnail(imagePath, thumbnailPath, maxWidth = 800) {
    try {
        await sharp(imagePath)
            .resize(maxWidth, null, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 85 })
            .toFile(thumbnailPath);
        return true;
    } catch (error) {
        console.error('Thumbnail generation failed:', error);
        return false;
    }
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

// API: 文字生成图片
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, width = 1024, height = 1024, steps = 4, cfg = 1, accessCode } = req.body;
        
        if (!accessCode) {
            return res.status(401).json({ error: 'Access code is required' });
        }
        
        // 验证用户
        const user = authenticateUser(accessCode);
        if (!user) {
            return res.status(401).json({ error: 'Invalid access code' });
        }
        
        // 检查并扣除积分
        const creditResult = deductCredits(accessCode, 'generate');
        if (!creditResult.success) {
            return res.status(402).json({ 
                error: creditResult.error,
                credits: creditResult.credits,
                required: creditResult.required
            });
        }
        
        if (!prompt || prompt.trim() === '') {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        // 验证参数
        if (width < 256 || width > 2048 || height < 256 || height > 2048) {
            return res.status(400).json({ error: 'Width and height must be between 256 and 2048' });
        }
        
        if (steps < 1 || steps > 50) {
            return res.status(400).json({ error: 'Steps must be between 1 and 50' });
        }
        
        const seed = Math.floor(Math.random() * 1000000000000000);
        
        // 生成并提交工作流
        const workflow = generateT2IWorkflow(prompt, width, height, seed, steps, cfg);
        const promptId = await queuePrompt(workflow);
        
        // 等待完成
        const result = await waitForCompletion(promptId);
        
        // 下载结果图片
        const imageUrl = `${COMFYUI_URL}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        
        const outputFilename = `${uuidv4()}.png`;
        const outputPath = path.join(OUTPUT_DIR, outputFilename);
        fs.writeFileSync(outputPath, imageResponse.data);
        
        // 生成缩略图
        const thumbnailFilename = `thumb_${outputFilename.replace('.png', '.jpg')}`;
        const thumbnailPath = path.join(OUTPUT_DIR, thumbnailFilename);
        await generateThumbnail(outputPath, thumbnailPath, 800);
        
        res.json({
            success: true,
            image: `/outputs/${outputFilename}`,
            thumbnail: `/outputs/${thumbnailFilename}`,
            prompt: prompt,
            width: width,
            height: height,
            seed: seed,
            creditsUsed: creditResult.cost,
            creditsRemaining: creditResult.credits
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Failed to generate image',
            details: error.message 
        });
    }
});

// API: 编辑图片
app.post('/api/edit', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }
        
        const { prompt, accessCode } = req.body;
        
        if (!accessCode) {
            return res.status(401).json({ error: 'Access code is required' });
        }
        
        // 验证用户
        const user = authenticateUser(accessCode);
        if (!user) {
            return res.status(401).json({ error: 'Invalid access code' });
        }
        
        // 检查并扣除积分
        const creditResult = deductCredits(accessCode, 'edit');
        if (!creditResult.success) {
            return res.status(402).json({ 
                error: creditResult.error,
                credits: creditResult.credits,
                required: creditResult.required
            });
        }
        
        if (!prompt || prompt.trim() === '') {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        const imageName = req.file.filename;
        const seed = Math.floor(Math.random() * 1000000000000000);
        
        // 上传图片到ComfyUI
        await uploadImageToComfyUI(req.file.path, imageName);
        
        // 生成并提交工作流
        const workflow = generateP2PWorkflow(imageName, prompt, seed);
        const promptId = await queuePrompt(workflow);
        
        // 等待完成
        const result = await waitForCompletion(promptId);
        
        // 下载结果图片
        const imageUrl = `${COMFYUI_URL}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        
        const outputFilename = `${uuidv4()}.png`;
        const outputPath = path.join(OUTPUT_DIR, outputFilename);
        fs.writeFileSync(outputPath, imageResponse.data);
        
        // 生成缩略图
        const thumbnailFilename = `thumb_${outputFilename.replace('.png', '.jpg')}`;
        const thumbnailPath = path.join(OUTPUT_DIR, thumbnailFilename);
        await generateThumbnail(outputPath, thumbnailPath, 800);
        
        res.json({
            success: true,
            image: `/outputs/${outputFilename}`,
            thumbnail: `/outputs/${thumbnailFilename}`,
            prompt: prompt,
            creditsUsed: creditResult.cost,
            creditsRemaining: creditResult.credits
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
