'use strict';

const path = require('path');

const COMFYUI_INSTANCES = ['http://127.0.0.1:8188'];
const COMFYUI_URL = COMFYUI_INSTANCES[0];
const PORT = 38024;
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const OUTPUT_DIR = path.join(__dirname, '..', 'outputs');
const PRESETS_FILE = path.join(__dirname, '..', 'workflows', 'presets.json');

module.exports = {
    COMFYUI_INSTANCES,
    COMFYUI_URL,
    PORT,
    UPLOAD_DIR,
    OUTPUT_DIR,
    PRESETS_FILE
};
