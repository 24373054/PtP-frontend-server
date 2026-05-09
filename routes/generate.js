'use strict';

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const config = require('../lib/config');
const { generateT2IWorkflow } = require('../lib/workflows');
const { resolveAuth, deductCreditsAuth } = require('../lib/credit');

function comfyuiErrorMessage(error, fallback = 'ComfyUI 请求失败') {
    const d = error.response && error.response.data;
    if (d !== undefined && d !== null) {
        if (typeof d === 'string' && d.trim()) return d.trim().slice(0, 2000);
        if (typeof d === 'object') {
            const msg = d.error && d.error.message || d.message || (typeof d.error === 'string' ? d.error : null);
            if (msg) return String(msg).slice(0, 2000);
            try { return JSON.stringify(d).slice(0, 2000); } catch (_) {}
        }
    }
    return error.message || fallback;
}

async function queuePrompt(workflow) {
    try {
        const response = await axios.post(`${config.COMFYUI_URL}/prompt`, {
            prompt: workflow, client_id: uuidv4()
        });
        return response.data.prompt_id;
    } catch (error) {
        throw new Error(`ComfyUI /prompt: ${comfyuiErrorMessage(error)}`);
    }
}

async function waitForCompletion(promptId, timeout = 300000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const historyRes = await axios.get(`${config.COMFYUI_URL}/history/${promptId}`);
            const history = historyRes.data[promptId];
            if (history && history.status && history.status.completed) {
                const outputs = history.outputs;
                for (const nodeId in outputs) {
                    if (outputs[nodeId].images) return outputs[nodeId].images[0];
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error('Timeout waiting for image generation');
}

async function waitForCompletionStream(promptId, onProgress, timeout = 300000) {
    const startTime = Date.now();
    let lastProgress = 0;
    while (Date.now() - startTime < timeout) {
        try {
            const queueRes = await axios.get(`${config.COMFYUI_URL}/queue`);
            const queue = queueRes.data;
            const runningItem = queue.queue_running.find(item => item[1] === promptId);
            if (runningItem) {
                const progress = Math.min(50 + lastProgress * 0.5, 85);
                onProgress({ status: 'processing', progress: Math.floor(progress) });
                lastProgress = progress;
            }
            const historyRes = await axios.get(`${config.COMFYUI_URL}/history/${promptId}`);
            const history = historyRes.data[promptId];
            if (history && history.status) {
                if (history.status.completed) {
                    onProgress({ status: 'completed', progress: 100 });
                    const outputs = history.outputs;
                    for (const nodeId in outputs) {
                        if (outputs[nodeId].images) return outputs[nodeId].images[0];
                    }
                } else if (history.status.status_str) {
                    const progress = Math.min(30 + lastProgress * 0.3, 70);
                    onProgress({ status: 'processing', progress: Math.floor(progress), message: history.status.status_str });
                    lastProgress = progress;
                }
            } else {
                const pendingItem = queue.queue_pending.find(item => item[1] === promptId);
                if (pendingItem) {
                    const queuePosition = queue.queue_pending.indexOf(pendingItem) + 1;
                    onProgress({ status: 'queued', progress: 10, message: `Queue position: ${queuePosition}` });
                }
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error('Timeout waiting for image generation');
}

async function generateThumbnail(imagePath, thumbnailPath, maxWidth = 800) {
    try {
        await sharp(imagePath).resize(maxWidth, null, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(thumbnailPath);
        return true;
    } catch (error) {
        console.error('Thumbnail generation failed:', error);
        return false;
    }
}

async function createGridImage(imagePaths, outputPath) {
    try {
        const images = await Promise.all(imagePaths.map(p => sharp(p).metadata().then(meta => ({ path: p, meta }))));
        const width = images[0].meta.width;
        const height = images[0].meta.height;
        const gridWidth = width * 2;
        const gridHeight = height * 2;
        const buffers = await Promise.all(imagePaths.map(p => sharp(p).toBuffer()));
        await sharp({
            create: { width: gridWidth, height: gridHeight, channels: 3, background: { r: 255, g: 255, b: 255 } }
        }).composite([
            { input: buffers[0], left: 0, top: 0 },
            { input: buffers[1], left: width, top: 0 },
            { input: buffers[2], left: 0, top: height },
            { input: buffers[3], left: width, top: height }
        ]).png().toFile(outputPath);
        return true;
    } catch (error) {
        console.error('Grid creation failed:', error);
        return false;
    }
}

async function queuePromptToInstance(instanceUrl, workflow) {
    try {
        const response = await axios.post(`${instanceUrl}/prompt`, {
            prompt: workflow, client_id: uuidv4()
        });
        return response.data.prompt_id;
    } catch (error) {
        throw new Error(`ComfyUI /prompt (${instanceUrl}): ${comfyuiErrorMessage(error)}`);
    }
}

async function waitForCompletionFromInstance(instanceUrl, promptId, timeout = 300000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const historyRes = await axios.get(`${instanceUrl}/history/${promptId}`);
            const history = historyRes.data[promptId];
            if (history && history.status && history.status.completed) {
                const outputs = history.outputs;
                for (const nodeId in outputs) {
                    if (outputs[nodeId].images) return outputs[nodeId].images[0];
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error('Timeout waiting for image generation');
}

async function downloadImageFromInstance(instanceUrl, result) {
    const imageUrl = `${instanceUrl}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const outputFilename = `${uuidv4()}.png`;
    const outputPath = path.join(config.OUTPUT_DIR, outputFilename);
    fs.writeFileSync(outputPath, imageResponse.data);
    return outputPath;
}

async function generateImagesParallel(prompt, width, height, seed, steps, cfg, count = 4) {
    const promises = [];
    const batchId = Date.now().toString(36);
    for (let i = 0; i < count; i++) {
        const instanceUrl = config.COMFYUI_INSTANCES[i % config.COMFYUI_INSTANCES.length];
        const imageSeed = Math.floor(Math.random() * 1000000000000000);
        const filenamePrefix = `grid-${batchId}-gpu${i}`;
        const workflow = generateT2IWorkflow(prompt, width, height, imageSeed, steps, cfg, filenamePrefix);
        promises.push(
            queuePromptToInstance(instanceUrl, workflow)
                .then(promptId => waitForCompletionFromInstance(instanceUrl, promptId))
                .then(result => downloadImageFromInstance(instanceUrl, result))
        );
    }
    return Promise.all(promises);
}

const router = express.Router();

function validateGenParams(width, height, steps, res) {
    if (width < 256 || width > 2048 || height < 256 || height > 2048) {
        res.status(400).json({ error: 'Width and height must be between 256 and 2048' });
        return false;
    }
    if (steps < 1 || steps > 50) {
        res.status(400).json({ error: 'Steps must be between 1 and 50' });
        return false;
    }
    return true;
}

router.post('/api/generate', async (req, res) => {
    try {
        const { prompt, width = 1024, height = 1024, steps = 4, cfg = 1 } = req.body;
        const auth = resolveAuth(req);
        if (!auth) return res.status(401).json({ error: 'Login or access code required' });
        const creditResult = deductCreditsAuth(auth, 'generate');
        if (!creditResult.success) {
            return res.status(402).json({ error: creditResult.error, credits: creditResult.credits, required: creditResult.required });
        }
        if (!prompt || prompt.trim() === '') return res.status(400).json({ error: 'Prompt is required' });
        if (!validateGenParams(width, height, steps, res)) return;
        const seed = Math.floor(Math.random() * 1000000000000000);
        const workflow = generateT2IWorkflow(prompt, width, height, seed, steps, cfg);
        const promptId = await queuePrompt(workflow);
        const result = await waitForCompletion(promptId);
        const imageUrl = `${config.COMFYUI_URL}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const outputFilename = `${uuidv4()}.png`;
        const outputPath = path.join(config.OUTPUT_DIR, outputFilename);
        fs.writeFileSync(outputPath, imageResponse.data);
        const thumbnailFilename = `thumb_${outputFilename.replace('.png', '.jpg')}`;
        const thumbnailPath = path.join(config.OUTPUT_DIR, thumbnailFilename);
        await generateThumbnail(outputPath, thumbnailPath, 800);
        res.json({
            success: true,
            image: `/outputs/${outputFilename}`,
            thumbnail: `/outputs/${thumbnailFilename}`,
            prompt: prompt, width: width, height: height, seed: seed,
            creditsUsed: creditResult.cost,
            creditsRemaining: creditResult.credits
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate image', details: error.message });
    }
});

router.post('/api/generate-stream', async (req, res) => {
    try {
        const { prompt, width = 1024, height = 1024, steps = 4, cfg = 1 } = req.body;
        const auth = resolveAuth(req);
        if (!auth) return res.status(401).json({ error: 'Login or access code required' });
        const creditResult = deductCreditsAuth(auth, 'generate');
        if (!creditResult.success) {
            return res.status(402).json({ error: creditResult.error, credits: creditResult.credits, required: creditResult.required });
        }
        if (!prompt || prompt.trim() === '') return res.status(400).json({ error: 'Prompt is required' });
        if (!validateGenParams(width, height, steps, res)) return;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        const sendEvent = (data) => { res.write(`data: ${JSON.stringify(data)}\n\n`); };
        try {
            const seed = Math.floor(Math.random() * 1000000000000000);
            sendEvent({ status: 'initializing', progress: 5, message: 'Preparing workflow...' });
            const workflow = generateT2IWorkflow(prompt, width, height, seed, steps, cfg);
            const promptId = await queuePrompt(workflow);
            sendEvent({ status: 'queued', progress: 15, message: 'Workflow submitted...' });
            req.on('close', () => { /* client disconnected — ComfyUI will still process but we stop pushing */ });
            const result = await waitForCompletionStream(promptId, (progressData) => { sendEvent(progressData); });
            sendEvent({ status: 'downloading', progress: 90, message: 'Downloading result...' });
            const imageUrl = `${config.COMFYUI_URL}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const outputFilename = `${uuidv4()}.png`;
            const outputPath = path.join(config.OUTPUT_DIR, outputFilename);
            fs.writeFileSync(outputPath, imageResponse.data);
            sendEvent({ status: 'processing', progress: 95, message: 'Generating thumbnail...' });
            const thumbnailFilename = `thumb_${outputFilename.replace('.png', '.jpg')}`;
            const thumbnailPath = path.join(config.OUTPUT_DIR, thumbnailFilename);
            await generateThumbnail(outputPath, thumbnailPath, 800);
            sendEvent({
                status: 'completed', progress: 100,
                result: {
                    success: true,
                    image: `/outputs/${outputFilename}`,
                    thumbnail: `/outputs/${thumbnailFilename}`,
                    prompt: prompt, width: width, height: height, seed: seed,
                    creditsUsed: creditResult.cost,
                    creditsRemaining: creditResult.credits
                }
            });
            res.end();
        } catch (error) {
            console.error('Stream error:', error);
            sendEvent({ status: 'error', error: error.message || 'Failed to generate image' });
            res.end();
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate image', details: error.message });
    }
});

router.post('/api/generate-grid', async (req, res) => {
    try {
        const { prompt, width = 1024, height = 1024, steps = 4, cfg = 1 } = req.body;
        const auth = resolveAuth(req);
        if (!auth) return res.status(401).json({ error: 'Login or access code required' });
        const creditResult = deductCreditsAuth(auth, 'generate');
        if (!creditResult.success) {
            return res.status(402).json({ error: creditResult.error, credits: creditResult.credits, required: creditResult.required });
        }
        for (let i = 0; i < 3; i++) {
            const extraCredit = deductCreditsAuth(auth, 'generate');
            if (!extraCredit.success) {
                return res.status(402).json({ error: 'Insufficient credits for 4 images', credits: extraCredit.credits, required: extraCredit.required });
            }
        }
        if (!prompt || prompt.trim() === '') return res.status(400).json({ error: 'Prompt is required' });
        if (!validateGenParams(width, height, steps, res)) return;
        const seed = Math.floor(Math.random() * 1000000000000000);
        console.log(`[generate-grid] Starting 4 parallel generations...`);
        const imagePaths = await generateImagesParallel(prompt, width, height, seed, steps, cfg, 4);
        console.log(`[generate-grid] All 4 done, composing grid...`);
        const gridFilename = `grid_${uuidv4()}.png`;
        const gridPath = path.join(config.OUTPUT_DIR, gridFilename);
        await createGridImage(imagePaths, gridPath);
        const thumbnailFilename = `thumb_${gridFilename.replace('.png', '.jpg')}`;
        const thumbnailPath = path.join(config.OUTPUT_DIR, thumbnailFilename);
        await generateThumbnail(gridPath, thumbnailPath, 1200);
        res.json({
            success: true,
            image: `/outputs/${gridFilename}`,
            thumbnail: `/outputs/${thumbnailFilename}`,
            individual_images: imagePaths.map(p => `/outputs/${path.basename(p)}`),
            prompt: prompt,
            width: width * 2, height: height * 2, seed: seed,
            creditsUsed: creditResult.cost * 4,
            creditsRemaining: creditResult.credits
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate grid image', details: error.message });
    }
});

module.exports = router;
