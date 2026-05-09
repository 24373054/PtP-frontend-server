'use strict';

const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const OUTPUT_DIR = path.join(__dirname, '..', 'outputs');

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cleanDirectory(dir, maxAge = MAX_AGE_MS) {
    if (!fs.existsSync(dir)) return { deleted: 0, errors: 0 };
    const now = Date.now();
    let deleted = 0;
    let errors = 0;
    let entries;
    try {
        entries = fs.readdirSync(dir);
    } catch (e) {
        return { deleted: 0, errors: 1 };
    }
    for (const name of entries) {
        const full = path.join(dir, name);
        try {
            const st = fs.statSync(full);
            if (st.isFile() && now - st.mtimeMs > maxAge) {
                fs.unlinkSync(full);
                deleted++;
            }
        } catch (_) {
            errors++;
        }
    }
    return { deleted, errors };
}

function runCleanup() {
    const up = cleanDirectory(UPLOAD_DIR);
    const out = cleanDirectory(OUTPUT_DIR);
    if (up.deleted > 0 || out.deleted > 0) {
        console.log(
            `[cleanup] Removed ${up.deleted} uploads, ${out.deleted} outputs (errors: ${up.errors + out.errors})`
        );
    }
}

function scheduleCleanup(intervalMs = 6 * 60 * 60 * 1000) {
    setInterval(runCleanup, intervalMs);
    // Run once after 5 minutes of startup
    setTimeout(runCleanup, 5 * 60 * 1000);
}

module.exports = { cleanDirectory, runCleanup, scheduleCleanup, UPLOAD_DIR, OUTPUT_DIR };
