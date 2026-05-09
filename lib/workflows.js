'use strict';

const COMFYUI_UNET_NAME =
    process.env.COMFYUI_UNET_NAME || 'flux-2-klein-9b-fp8.safetensors';
const COMFYUI_CLIP_NAME =
    process.env.COMFYUI_CLIP_NAME ||
    'split_files/text_encoders/qwen_3_8b_fp8mixed.safetensors';
const COMFYUI_VAE_NAME =
    process.env.COMFYUI_VAE_NAME || 'full_encoder_small_decoder.safetensors';

const EDIT_TEMPLATE_ALIASES = {
    style: 'img2img_style',
    img2img_style: 'img2img_style',
    upscale: 'image_upscale',
    image_upscale: 'image_upscale',
    background: 'background_repaint',
    bg: 'background_repaint',
    background_repaint: 'background_repaint',
    jewelry_retouch: 'jewelry_retouch',
    jewel_retouch: 'jewelry_retouch',
    jewelry_cutout: 'jewelry_product_cutout',
    jewelry_product_cutout: 'jewelry_product_cutout',
    product_cutout: 'jewelry_product_cutout',
    jewelry_scene: 'jewelry_scene',
    jewel_scene: 'jewelry_scene',
    jewelry_macro: 'jewelry_macro_detail',
    jewelry_macro_detail: 'jewelry_macro_detail',
    jewel_macro: 'jewelry_macro_detail'
};

const EDIT_VARIANT_INPUT_PATCHES = {
    img2img_style: {
        '75:80': { upscale_method: 'nearest-exact', megapixels: 1 },
        '75:62': { steps: 4 },
        '75:63': { cfg: 1 },
        '9': { filename_prefix: 'if-style' }
    },
    image_upscale: {
        '75:80': { upscale_method: 'lanczos', megapixels: 2.25 },
        '75:62': { steps: 12 },
        '75:63': { cfg: 1 },
        '9': { filename_prefix: 'if-upscale' }
    },
    background_repaint: {
        '75:80': { upscale_method: 'lanczos', megapixels: 1 },
        '75:62': { steps: 8 },
        '75:63': { cfg: 1.22 },
        '9': { filename_prefix: 'if-bg' }
    },
    jewelry_retouch: {
        '75:80': { upscale_method: 'lanczos', megapixels: 1.15 },
        '75:62': { steps: 6 },
        '75:63': { cfg: 1.06 },
        '9': { filename_prefix: 'if-jw-retouch' }
    },
    jewelry_product_cutout: {
        '75:80': { upscale_method: 'lanczos', megapixels: 1 },
        '75:62': { steps: 10 },
        '75:63': { cfg: 1.3 },
        '9': { filename_prefix: 'if-jw-cutout' }
    },
    jewelry_scene: {
        '75:80': { upscale_method: 'lanczos', megapixels: 1.25 },
        '75:62': { steps: 9 },
        '75:63': { cfg: 1.2 },
        '9': { filename_prefix: 'if-jw-scene' }
    },
    jewelry_macro_detail: {
        '75:80': { upscale_method: 'lanczos', megapixels: 2.25 },
        '75:62': { steps: 14 },
        '75:63': { cfg: 1 },
        '9': { filename_prefix: 'if-jw-macro' }
    }
};

let editVariantFileCache = null;

function loadEditVariantFilePatches() {
    if (editVariantFileCache !== null) return editVariantFileCache;
    try {
        const path = require('path');
        const fs = require('fs');
        const p = path.join(__dirname, '..', 'workflows', 'edit_variants.json');
        editVariantFileCache = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) {
        editVariantFileCache = {};
    }
    return editVariantFileCache;
}

function normalizeEditTemplate(raw) {
    const k = String(raw || 'img2img_style').trim().toLowerCase();
    return EDIT_TEMPLATE_ALIASES[k] || 'img2img_style';
}

function generateP2PWorkflow(imageName, prompt, seed) {
    return {
        '9': { inputs: { filename_prefix: 'p2p-edit', images: ['75:65', 0] }, class_type: 'SaveImage' },
        '76': { inputs: { image: imageName }, class_type: 'LoadImage' },
        '75:61': { inputs: { sampler_name: 'euler' }, class_type: 'KSamplerSelect' },
        '75:64': { inputs: { noise: ['75:73', 0], guider: ['75:63', 0], sampler: ['75:61', 0], sigmas: ['75:62', 0], latent_image: ['75:66', 0] }, class_type: 'SamplerCustomAdvanced' },
        '75:65': { inputs: { samples: ['75:64', 0], vae: ['75:72', 0] }, class_type: 'VAEDecode' },
        '75:73': { inputs: { noise_seed: seed }, class_type: 'RandomNoise' },
        '75:70': { inputs: { unet_name: COMFYUI_UNET_NAME, weight_dtype: 'default' }, class_type: 'UNETLoader' },
        '75:71': { inputs: { clip_name: COMFYUI_CLIP_NAME, type: 'flux2', device: 'default' }, class_type: 'CLIPLoader' },
        '75:72': { inputs: { vae_name: COMFYUI_VAE_NAME }, class_type: 'VAELoader' },
        '75:66': { inputs: { width: ['75:81', 0], height: ['75:81', 1], batch_size: 1 }, class_type: 'EmptyFlux2LatentImage' },
        '75:80': { inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['76', 0] }, class_type: 'ImageScaleToTotalPixels' },
        '75:63': { inputs: { cfg: 1, model: ['75:70', 0], positive: ['75:79:77', 0], negative: ['75:79:76', 0] }, class_type: 'CFGGuider' },
        '75:62': { inputs: { steps: 4, width: ['75:81', 0], height: ['75:81', 1] }, class_type: 'Flux2Scheduler' },
        '75:74': { inputs: { text: prompt, clip: ['75:71', 0] }, class_type: 'CLIPTextEncode' },
        '75:82': { inputs: { conditioning: ['75:74', 0] }, class_type: 'ConditioningZeroOut' },
        '75:81': { inputs: { image: ['75:80', 0] }, class_type: 'GetImageSize' },
        '75:79:76': { inputs: { conditioning: ['75:82', 0], latent: ['75:79:78', 0] }, class_type: 'ReferenceLatent' },
        '75:79:78': { inputs: { pixels: ['75:80', 0], vae: ['75:72', 0] }, class_type: 'VAEEncode' },
        '75:79:77': { inputs: { conditioning: ['75:74', 0], latent: ['75:79:78', 0] }, class_type: 'ReferenceLatent' }
    };
}

function generateT2IWorkflow(prompt, width, height, seed, steps, cfg, filenamePrefix = 't2i-gen') {
    return {
        '76': { inputs: { value: prompt }, class_type: 'PrimitiveStringMultiline' },
        '78': { inputs: { filename_prefix: filenamePrefix, images: ['77:65', 0] }, class_type: 'SaveImage' },
        '77:61': { inputs: { sampler_name: 'euler' }, class_type: 'KSamplerSelect' },
        '77:64': { inputs: { noise: ['77:73', 0], guider: ['77:63', 0], sampler: ['77:61', 0], sigmas: ['77:62', 0], latent_image: ['77:66', 0] }, class_type: 'SamplerCustomAdvanced' },
        '77:65': { inputs: { samples: ['77:64', 0], vae: ['77:72', 0] }, class_type: 'VAEDecode' },
        '77:66': { inputs: { width: ['77:68', 0], height: ['77:69', 0], batch_size: 1 }, class_type: 'EmptyFlux2LatentImage' },
        '77:68': { inputs: { value: width }, class_type: 'PrimitiveInt' },
        '77:69': { inputs: { value: height }, class_type: 'PrimitiveInt' },
        '77:73': { inputs: { noise_seed: seed }, class_type: 'RandomNoise' },
        '77:70': { inputs: { unet_name: COMFYUI_UNET_NAME, weight_dtype: 'default' }, class_type: 'UNETLoader' },
        '77:71': { inputs: { clip_name: COMFYUI_CLIP_NAME, type: 'flux2', device: 'default' }, class_type: 'CLIPLoader' },
        '77:72': { inputs: { vae_name: COMFYUI_VAE_NAME }, class_type: 'VAELoader' },
        '77:63': { inputs: { cfg: cfg, model: ['77:70', 0], positive: ['77:74', 0], negative: ['77:76', 0] }, class_type: 'CFGGuider' },
        '77:76': { inputs: { conditioning: ['77:74', 0] }, class_type: 'ConditioningZeroOut' },
        '77:74': { inputs: { text: ['76', 0], clip: ['77:71', 0] }, class_type: 'CLIPTextEncode' },
        '77:62': { inputs: { steps: steps, width: ['77:68', 0], height: ['77:69', 0] }, class_type: 'Flux2Scheduler' }
    };
}

function buildEditWorkflow(templateRaw, imageName, prompt, seed) {
    const tid = normalizeEditTemplate(templateRaw);
    const workflow = generateP2PWorkflow(imageName, prompt, seed);
    const base = EDIT_VARIANT_INPUT_PATCHES[tid] || EDIT_VARIANT_INPUT_PATCHES.img2img_style;
    const extra = loadEditVariantFilePatches()[tid] || {};
    const nodeIds = new Set([...Object.keys(base), ...Object.keys(extra)]);
    for (const nodeId of nodeIds) {
        if (!workflow[nodeId] || !workflow[nodeId].inputs) continue;
        const patch = { ...(base[nodeId] || {}), ...(extra[nodeId] || {}) };
        Object.assign(workflow[nodeId].inputs, patch);
    }
    return workflow;
}

function getEditCreditOperationKey(workflowTemplate) {
    const m = {
        jewelry_retouch: 'jewelry_retouch',
        jewelry_product_cutout: 'jewelry_cutout',
        jewelry_scene: 'jewelry_scene',
        jewelry_macro_detail: 'jewelry_macro'
    };
    return m[workflowTemplate] || 'edit';
}

module.exports = {
    EDIT_TEMPLATE_ALIASES,
    EDIT_VARIANT_INPUT_PATCHES,
    loadEditVariantFilePatches,
    normalizeEditTemplate,
    generateP2PWorkflow,
    generateT2IWorkflow,
    buildEditWorkflow,
    getEditCreditOperationKey,
    COMFYUI_UNET_NAME,
    COMFYUI_CLIP_NAME,
    COMFYUI_VAE_NAME
};
