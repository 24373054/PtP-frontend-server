'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');
const config = require('../lib/config');
const { SUBSCRIPTION_PLANS } = require('../lib/credit');
const {
    EDIT_TEMPLATE_ALIASES,
    EDIT_VARIANT_INPUT_PATCHES,
    loadEditVariantFilePatches
} = require('../lib/workflows');

let APP_PACKAGE = { name: 'p2p-image-editor', version: '1.0.0' };
try {
    APP_PACKAGE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
} catch (_) {}

function getVersionPayload() {
    return {
        name: APP_PACKAGE.name,
        version: APP_PACKAGE.version,
        role: 'imageforge-web-bff',
        comfyuiUrl: config.COMFYUI_URL,
        sqlite: true,
        capabilities: {
            authEmailOtp: true,
            authSendCodePost: '/api/auth/send-code',
            communityTopics: true,
            pointLedger: true,
            moderationReport: true,
            storageSqlite: true,
            adminSettle: Boolean(
                process.env.IMAGEFORGE_ADMIN_KEY &&
                    String(process.env.IMAGEFORGE_ADMIN_KEY).length > 0
            )
        },
        hint: 'Web 仅请求本服务；ComfyUI 由服务端转发。鸿蒙端可对齐同一 REST/SSE 契约。'
    };
}

const router = express.Router();

router.get('/api/version', (req, res) => {
    res.json(getVersionPayload());
});

router.get('/api/health', async (req, res) => {
    try {
        await axios.get(`${config.COMFYUI_URL}/system_stats`);
        res.json({ status: 'ok', comfyui: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'error', comfyui: 'disconnected' });
    }
});

router.get('/api/presets', (req, res) => {
    try {
        const raw = fs.readFileSync(config.PRESETS_FILE, 'utf8');
        res.type('application/json').send(raw);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read presets', details: error.message });
    }
});

router.get('/api/edit-variants', (req, res) => {
    res.json({
        aliases: EDIT_TEMPLATE_ALIASES,
        builtinPatches: EDIT_VARIANT_INPUT_PATCHES,
        fileOverrides: loadEditVariantFilePatches()
    });
});

router.get('/api/plans', (req, res) => {
    const lang = req.query.lang || 'en';
    const plans = Object.entries(SUBSCRIPTION_PLANS)
        .filter(([key]) => key !== 'beta')
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

router.get('/api/network-info', (req, res) => {
    const nets = os.networkInterfaces();
    const out = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
                out.push({ name, address: net.address });
            }
        }
    }
    res.json({ interfaces: out, hostname: os.hostname() });
});

module.exports = router;
