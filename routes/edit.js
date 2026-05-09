'use strict';

const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const archiver = require('archiver');
const config = require('../lib/config');
const { buildEditWorkflow, getEditCreditOperationKey } = require('../lib/workflows');
const { resolveAuth, deductCreditsAuth } = require('../lib/credit');

const storage = multer.diskStorage({
    destination: config.UPLOAD_DIR,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|webp)$/i;
        if (allowed.test(file.originalname)) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

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

async function uploadImageToComfyUI(filePath, filename) {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(filePath), filename);
    formData.append('overwrite', 'true');
    try {
        await axios.post(`${config.COMFYUI_URL}/upload/image`, formData, {
            headers: formData.getHeaders()
        });
    } catch (error) {
        throw new Error(`上传到 ComfyUI 失败: ${comfyuiErrorMessage(error)}`);
    }
}

async function queuePrompt(workflow) {
    try {
        const response = await axios.post(`${config.COMFYUI_URL}/prompt`, {
            prompt: workflow,
            client_id: uuidv4()
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
    const TOTAL_WORKFLOW_NODES = 25;
    while (Date.now() - startTime < timeout) {
        try {
            const historyRes = await axios.get(`${config.COMFYUI_URL}/history/${promptId}`);
            const history = historyRes.data[promptId];
            if (history && history.status) {
                if (history.status.completed) {
                    onProgress({ status: 'completed', progress: 100 });
                    const outputs = history.outputs;
                    for (const nodeId in outputs) {
                        if (outputs[nodeId].images) return outputs[nodeId].images[0];
                    }
                }
                const outputs = history.outputs || {};
                const doneNodes = Object.keys(outputs).length;
                const realProgress = Math.min(10 + Math.round((doneNodes / TOTAL_WORKFLOW_NODES) * 85), 95);
                const msg = history.status.status_str || 'executing';
                onProgress({ status: 'processing', progress: realProgress, message: msg, node: doneNodes, total: TOTAL_WORKFLOW_NODES });
            } else {
                const queueRes = await axios.get(`${config.COMFYUI_URL}/queue`);
                const queue = queueRes.data;
                const pendingItem = queue.queue_pending.find(item => item[1] === promptId);
                if (pendingItem) {
                    const pos = queue.queue_pending.indexOf(pendingItem) + 1;
                    onProgress({ status: 'queued', progress: 5, message: `Queue position: ${pos}` });
                } else {
                    const runningItem = queue.queue_running.find(item => item[1] === promptId);
                    if (runningItem) {
                        onProgress({ status: 'processing', progress: 8, message: 'Starting execution...' });
                    }
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

function escapeXmlForSvg(s) {
    return String(s).slice(0, 120).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clampPostNum(n, a, b) {
    const x = Number(n);
    if (Number.isNaN(x)) return a;
    return Math.max(a, Math.min(b, x));
}

function parsePostProcessBody(raw) {
    if (raw == null || raw === '') return null;
    try {
        const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return o && typeof o === 'object' ? o : null;
    } catch (_) { return null; }
}

async function applyOutputPostProcess(outputPath, opts) {
    if (!opts) return;
    const pad = clampPostNum(opts.paddingRatio, 0, 0.3);
    const exp = opts.export;
    const wm = opts.watermark;
    let buf = await fs.promises.readFile(outputPath);
    if (pad > 0) {
        const meta = await sharp(buf).metadata();
        const w = meta.width || 1;
        const h = meta.height || 1;
        const extra = Math.round(Math.max(w, h) * pad);
        buf = await sharp(buf).extend({
            top: extra, bottom: extra, left: extra, right: extra,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }).png().toBuffer();
    }
    if (exp && Number(exp.width) > 0 && Number(exp.height) > 0) {
        buf = await sharp(buf).resize(Math.round(exp.width), Math.round(exp.height), {
            fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 }
        }).png().toBuffer();
    }
    if (wm && String(wm.text || '').trim()) {
        const opacity = clampPostNum(wm.opacity != null ? wm.opacity : 0.35, 0.05, 1);
        const meta = await sharp(buf).metadata();
        const tw = meta.width || 800;
        const th = meta.height || 800;
        const fontSize = Math.max(12, Math.round(Math.min(tw, th) * 0.028));
        const text = escapeXmlForSvg(wm.text);
        const svg = Buffer.from(
            `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg"><text x="${tw - 16}" y="${th - 16}" font-family="sans-serif" font-size="${fontSize}" fill="rgba(255,255,255,${opacity})" text-anchor="end" stroke="rgba(0,0,0,${opacity * 0.6})" stroke-width="2">${text}</text></svg>`,
            'utf8'
        );
        buf = await sharp(buf).composite([{ input: svg, left: 0, top: 0 }]).png().toBuffer();
    }
    await fs.promises.writeFile(outputPath, buf);
}

const router = express.Router();

// Non-streaming edit
router.post('/api/edit', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
        const { prompt, workflowTemplate } = req.body;
        const auth = resolveAuth(req);
        if (!auth) return res.status(401).json({ error: 'Login or access code required' });
        const creditOp = getEditCreditOperationKey(workflowTemplate);
        const creditResult = deductCreditsAuth(auth, creditOp);
        if (!creditResult.success) {
            return res.status(402).json({ error: creditResult.error, credits: creditResult.credits, required: creditResult.required });
        }
        if (!prompt || prompt.trim() === '') return res.status(400).json({ error: 'Prompt is required' });
        const imageName = req.file.filename;
        const seed = Math.floor(Math.random() * 1000000000000000);
        await uploadImageToComfyUI(req.file.path, imageName);
        const workflow = buildEditWorkflow(workflowTemplate, imageName, prompt, seed);
        const promptId = await queuePrompt(workflow);
        const result = await waitForCompletion(promptId);
        const imageUrl = `${config.COMFYUI_URL}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const outputFilename = `${uuidv4()}.png`;
        const outputPath = path.join(config.OUTPUT_DIR, outputFilename);
        fs.writeFileSync(outputPath, imageResponse.data);
        try {
            await applyOutputPostProcess(outputPath, parsePostProcessBody(req.body.postProcess));
        } catch (pe) { console.error('[postProcess]', pe.message || pe); }
        const thumbnailFilename = `thumb_${outputFilename.replace('.png', '.jpg')}`;
        const thumbnailPath = path.join(config.OUTPUT_DIR, thumbnailFilename);
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
        res.status(500).json({ error: 'Failed to process image', details: error.message });
    }
});

// Streaming edit
router.post('/api/edit-stream', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
        const { prompt, workflowTemplate } = req.body;
        const auth = resolveAuth(req);
        if (!auth) return res.status(401).json({ error: 'Login or access code required' });
        const creditOp = getEditCreditOperationKey(workflowTemplate);
        const creditResult = deductCreditsAuth(auth, creditOp);
        if (!creditResult.success) {
            return res.status(402).json({ error: creditResult.error, credits: creditResult.credits, required: creditResult.required });
        }
        if (!prompt || prompt.trim() === '') return res.status(400).json({ error: 'Prompt is required' });
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        const sendEvent = (data) => { res.write(`data: ${JSON.stringify(data)}\n\n`); };
        try {
            const imageName = req.file.filename;
            const seed = Math.floor(Math.random() * 1000000000000000);
            sendEvent({ status: 'initializing', progress: 5, message: 'Uploading image...' });
            await uploadImageToComfyUI(req.file.path, imageName);
            sendEvent({ status: 'preparing', progress: 15, message: 'Preparing workflow...' });
            const workflow = buildEditWorkflow(workflowTemplate, imageName, prompt, seed);
            const promptId = await queuePrompt(workflow);
            sendEvent({ status: 'queued', progress: 20, message: 'Workflow submitted...' });
            const result = await waitForCompletionStream(promptId, (progressData) => { sendEvent(progressData); });
            sendEvent({ status: 'downloading', progress: 90, message: 'Downloading result...' });
            const imageUrl = `${config.COMFYUI_URL}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const outputFilename = `${uuidv4()}.png`;
            const outputPath = path.join(config.OUTPUT_DIR, outputFilename);
            fs.writeFileSync(outputPath, imageResponse.data);
            try {
                await applyOutputPostProcess(outputPath, parsePostProcessBody(req.body.postProcess));
            } catch (pe) { console.error('[postProcess]', pe.message || pe); }
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
                    prompt: prompt,
                    creditsUsed: creditResult.cost,
                    creditsRemaining: creditResult.credits
                }
            });
            res.end();
        } catch (error) {
            console.error('Stream error:', error);
            sendEvent({ status: 'error', error: error.message || 'Failed to edit image' });
            res.end();
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to process image', details: error.message });
    }
});

// === Batch ZIP download ===
router.post('/api/batch-download', (req, res) => {
    const { files } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'files array required' });
    }
    const valid = files.filter(f => {
        if (typeof f !== 'string' || !f.startsWith('/outputs/') || f.includes('..')) return false;
        const full = path.join(config.OUTPUT_DIR, path.basename(f));
        return fs.existsSync(full);
    });
    if (valid.length === 0) {
        return res.status(400).json({ error: 'No valid output files found' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="batch-${Date.now()}.zip"`);
    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', (err) => { res.status(500).end(); });
    archive.pipe(res);
    for (const rel of valid) {
        const name = path.basename(rel);
        archive.file(path.join(config.OUTPUT_DIR, name), { name });
    }
    archive.finalize();
});

module.exports = { router, upload };
