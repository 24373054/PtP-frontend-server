'use strict';

const { getDb } = require('./imageforge-sqlite');

function initOtpTable() {
    const db = getDb();
    db.exec(`
        CREATE TABLE IF NOT EXISTS otp_codes (
            key TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            expires INTEGER NOT NULL,
            cooldown_until INTEGER
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires)');
}

function otpKey(email, purpose) {
    const accounts = require('./accounts');
    return `${accounts.normalizeEmail(email)}:${purpose}`;
}

function setOtp(email, purpose, code, ttlMs = 10 * 60 * 1000, cooldownMs = 55000) {
    initOtpTable();
    const db = getDb();
    const key = otpKey(email, purpose);
    const expires = Date.now() + ttlMs;
    const cooldownUntil = Date.now() + cooldownMs;
    db.prepare(
        `INSERT OR REPLACE INTO otp_codes (key, code, expires, cooldown_until) VALUES (?, ?, ?, ?)`
    ).run(key, String(code), expires, cooldownUntil);
}

function verifyOtp(email, purpose, code) {
    initOtpTable();
    const db = getDb();
    const key = otpKey(email, purpose);
    const row = db.prepare('SELECT * FROM otp_codes WHERE key = ?').get(key);
    if (!row || String(row.code) !== String(code).trim()) return false;
    if (Date.now() > row.expires) {
        db.prepare('DELETE FROM otp_codes WHERE key = ?').run(key);
        return false;
    }
    db.prepare('DELETE FROM otp_codes WHERE key = ?').run(key);
    return true;
}

function checkCooldown(email, purpose) {
    initOtpTable();
    const db = getDb();
    const key = otpKey(email, purpose);
    const row = db.prepare('SELECT cooldown_until FROM otp_codes WHERE key = ?').get(key);
    if (row && row.cooldown_until && Date.now() < row.cooldown_until) {
        return row.cooldown_until - Date.now();
    }
    return 0;
}

function purgeExpired() {
    initOtpTable();
    try {
        const db = getDb();
        db.prepare('DELETE FROM otp_codes WHERE expires < ?').run(Date.now());
    } catch (_) { /* table may not exist yet if init was deferred */ }
}

// Run purge every 10 minutes
setInterval(purgeExpired, 10 * 60 * 1000);

module.exports = { setOtp, verifyOtp, checkCooldown, purgeExpired };
