'use strict';

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('./lib/config');
const { csrfMiddleware } = require('./middleware/csrf');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const { apiLimiter, authLimiter } = require('./middleware/rate-limiter');
const { scheduleCleanup } = require('./lib/cleanup');

const app = express();

// --- Production safeguards ---
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'dev-session-secret-change-me') {
    console.warn('[warn] SESSION_SECRET is using the default/dev value. Set a strong secret in production.');
}

// --- Request logging ---
app.use(morgan('short'));

// --- Body parsing ---
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// --- Session ---
app.use(
    session({
        name: 'ptp.sid',
        secret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.SESSION_COOKIE_SECURE === '1'
        }
    })
);

// --- CSRF protection for state-changing requests ---
app.use(csrfMiddleware);

// --- Global rate limit ---
app.use('/api/', apiLimiter);

// --- Auth rate limit ---
app.use('/api/auth/', authLimiter);

// --- Routes ---
const miscRoutes = require('./routes/misc');
const authRoutes = require('./routes/auth');
const generateRoutes = require('./routes/generate');
const { router: editRoutes } = require('./routes/edit');
const { router: communityRoutes, executeTopicSettlement } = require('./routes/community');

app.use(miscRoutes);
app.use(authRoutes);
app.use(generateRoutes);
app.use(editRoutes);
app.use(communityRoutes);

// --- Version info file for static fallback ---
function writePublicVersionInfoFile() {
    try {
        const APP_PACKAGE = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        const payload = {
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
                adminSettle: Boolean(process.env.IMAGEFORGE_ADMIN_KEY && String(process.env.IMAGEFORGE_ADMIN_KEY).length > 0)
            },
            _staticFallback: true,
            _writtenAt: new Date().toISOString()
        };
        fs.writeFileSync(path.join(__dirname, 'public', 'version-info.json'), JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
        console.warn('[version-info.json]', err.message);
    }
}
writePublicVersionInfoFile();

// --- Static files ---
app.use(express.static('public'));
app.use('/workflows', express.static(path.join(__dirname, 'workflows')));
app.use('/outputs', express.static(config.OUTPUT_DIR));

// --- Error handling ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Network info ---
function lanIPv4Addresses() {
    const nets = os.networkInterfaces();
    const out = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if ((net.family === 'IPv4' || net.family === 4) && !net.internal) out.push(net.address);
        }
    }
    return out;
}

// --- Auto-settlement ---
function runAutoSettlementPass() {
    const v = process.env.IMAGEFORGE_AUTO_SETTLE;
    if (v !== '1' && v !== 'true') return;
    try {
        const community = require('./lib/community-store');
        community.syncTopicLifecycle();
        const ids = community.listTopicsAwaitingSettlement();
        for (const topicId of ids) {
            const out = executeTopicSettlement(topicId);
            if (out.ok) console.log('[auto-settle] settled', topicId);
            else console.warn('[auto-settle] skip', topicId, out.error);
        }
    } catch (e) {
        console.error('[auto-settle]', e);
    }
}

// --- Start server ---
const PORT = parseInt(process.env.PORT, 10) || config.PORT;

const server = app.listen(PORT, '0.0.0.0', () => {
    writePublicVersionInfoFile();
    console.log(`\n=== ImageForge Web Server ===`);
    console.log(`Local: http://localhost:${PORT}`);
    const lan = lanIPv4Addresses();
    if (lan.length) {
        for (const addr of lan) console.log(`Network: http://${addr}:${PORT}`);
    } else {
        console.log('Network: (no non-loopback IPv4 found)');
    }
    console.log(`ComfyUI: ${config.COMFYUI_URL}`);
    console.log(`Auth: POST /api/auth/send-code | register | login-password | login-code | reset-password`);
    console.log(`Community: GET /api/topics | /api/topics/:id | posts | ranking`);
    console.log(`Rate limiting: enabled (auth: 30/15min per IP, send-code: 5/15min, API: 60/min)`);

    if (process.env.IMAGEFORGE_AUTO_SETTLE === '1' || process.env.IMAGEFORGE_AUTO_SETTLE === 'true') {
        console.log('Auto-settle: enabled (hourly + 15s first run)');
        setInterval(runAutoSettlementPass, 60 * 60 * 1000);
        setTimeout(runAutoSettlementPass, 15000);
    }

    // Schedule file cleanup (every 6 hours, first after 5 min)
    scheduleCleanup();

    console.log(`================================\n`);
});

// --- Graceful shutdown ---
function gracefulShutdown(signal) {
    console.log(`\n[shutdown] Received ${signal}, closing gracefully...`);
    server.close(() => {
        console.log('[shutdown] HTTP server closed');

        // Close SQLite database
        try {
            const { getDb } = require('./lib/imageforge-sqlite');
            const db = getDb();
            if (db) {
                db.close();
                console.log('[shutdown] SQLite database closed');
            }
        } catch (e) {
            // db may not have been initialized
        }

        console.log('[shutdown] Done');
        process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('[shutdown] Forced exit after timeout');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { COMFYUI_INSTANCES: config.COMFYUI_INSTANCES };
