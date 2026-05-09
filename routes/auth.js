'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const accounts = require('../lib/accounts');
const pointLedger = require('../lib/point-ledger');
const { sendVerificationCode } = require('../lib/mail');
const { setOtp, verifyOtp, checkCooldown } = require('../lib/otp-store');
const { SUBSCRIPTION_PLANS, SIGNUP_INITIAL_CREDITS, buildPublicUserFromAccount, resolveAuth } = require('../lib/credit');
const { sendCodeLimiter } = require('../middleware/rate-limiter');

const ALLOWED_OTP_PURPOSES = new Set(['register', 'login', 'reset_password']);

function otpKey(email, purpose) {
    return `${accounts.normalizeEmail(email)}:${purpose}`;
}

function isValidUsername(username) {
    const s = String(username || '').trim();
    if (s.length < 2 || s.length > 32) return false;
    return /^[a-zA-Z0-9_\-一-龥]+$/.test(s);
}

const router = express.Router();

router.get('/api/auth/me', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ success: false, error: 'Not logged in' });
    }
    const acc = accounts.findById(req.session.userId);
    if (!acc) {
        req.session.destroy(() => {});
        return res.status(401).json({ success: false, error: 'Session invalid' });
    }
    const plan = SUBSCRIPTION_PLANS[acc.plan] || SUBSCRIPTION_PLANS.free;
    const isAdmin = acc.role === 'admin';
    const authPortal = req.session.authPortal || 'user';
    res.json({
        success: true,
        user: buildPublicUserFromAccount(acc, plan),
        isAdmin,
        authPortal
    });
});

router.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('ptp.sid', { path: '/' });
        res.json({ success: true });
    });
});

router.post('/api/auth/send-code', sendCodeLimiter, async (req, res) => {
    try {
        const { email, purpose = 'login', lang = 'zh' } = req.body || {};
        const em = accounts.normalizeEmail(email);
        if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
            return res.status(400).json({ error: 'Invalid email' });
        }
        if (!ALLOWED_OTP_PURPOSES.has(purpose)) {
            return res.status(400).json({ error: 'Invalid purpose' });
        }
        if (purpose === 'register' && accounts.findByEmail(em)) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        if ((purpose === 'login' || purpose === 'reset_password') && !accounts.findByEmail(em)) {
            return res.status(400).json({ error: 'Email not registered' });
        }
        const remaining = checkCooldown(em, purpose);
        if (remaining > 0) {
            return res.status(429).json({ error: 'Please wait about one minute before requesting another code' });
        }
        const code = String(Math.floor(100000 + Math.random() * 900000));
        setOtp(em, purpose, code);
        await sendVerificationCode(em, code, purpose, lang === 'en' ? 'en' : 'zh');
        res.json({ success: true });
    } catch (e) {
        console.error('[send-code]', e);
        res.status(500).json({ error: e.message || 'Failed to send email' });
    }
});

router.post('/api/auth/register', async (req, res) => {
    try {
        const { email, username, password, code, lang } = req.body || {};
        const em = accounts.normalizeEmail(email);
        if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
            return res.status(400).json({ error: 'Invalid email' });
        }
        if (!isValidUsername(username)) {
            return res.status(400).json({ error: 'Invalid username (2-32 chars, letters/digits/_- or CJK)' });
        }
        const pw = String(password || '');
        if (pw.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        if (accounts.findByEmail(em)) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const uname = String(username).trim();
        if (accounts.findByUsername(uname)) {
            return res.status(400).json({ error: 'Username already taken' });
        }
        if (!verifyOtp(em, 'register', code)) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }
        const passwordHash = await bcrypt.hash(pw, 10);
        const id = uuidv4();
        const user = {
            id,
            email: em,
            username: uname,
            usernameNorm: accounts.normalizeUsernameKey(uname),
            passwordHash,
            plan: 'free',
            credits: SIGNUP_INITIAL_CREDITS,
            usedCredits: 0,
            createdAt: new Date().toISOString()
        };
        accounts.addUser(user);
        req.session.userId = id;
        req.session.authPortal = 'user';
        const plan = SUBSCRIPTION_PLANS.free;
        res.json({
            success: true,
            user: buildPublicUserFromAccount(user, plan),
            isAdmin: false,
            authPortal: 'user'
        });
    } catch (e) {
        console.error('[register]', e);
        res.status(500).json({ error: e.message || 'Registration failed' });
    }
});

router.post('/api/auth/login-password', async (req, res) => {
    try {
        const { email, password, intent } = req.body || {};
        const em = accounts.normalizeEmail(email);
        const acc = accounts.findByEmail(em);
        if (!acc || !acc.passwordHash) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const ok = await bcrypt.compare(String(password || ''), acc.passwordHash);
        if (!ok) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const portal = String(intent || 'user').toLowerCase();
        if (portal === 'admin') {
            if (acc.role !== 'admin') {
                return res.status(403).json({ error: 'Administrator access denied' });
            }
            req.session.authPortal = 'admin';
        } else {
            req.session.authPortal = 'user';
        }
        req.session.userId = acc.id;
        const plan = SUBSCRIPTION_PLANS[acc.plan] || SUBSCRIPTION_PLANS.free;
        res.json({
            success: true,
            user: buildPublicUserFromAccount(acc, plan),
            isAdmin: acc.role === 'admin',
            authPortal: req.session.authPortal
        });
    } catch (e) {
        console.error('[login-password]', e);
        res.status(500).json({ error: e.message || 'Login failed' });
    }
});

router.post('/api/auth/login-code', async (req, res) => {
    try {
        const { email, code, intent } = req.body || {};
        const em = accounts.normalizeEmail(email);
        const acc = accounts.findByEmail(em);
        if (!acc) {
            return res.status(401).json({ error: 'Invalid email or code' });
        }
        if (!verifyOtp(em, 'login', code)) {
            return res.status(401).json({ error: 'Invalid or expired verification code' });
        }
        const portal = String(intent || 'user').toLowerCase();
        if (portal === 'admin') {
            if (acc.role !== 'admin') {
                return res.status(403).json({ error: 'Administrator access denied' });
            }
            req.session.authPortal = 'admin';
        } else {
            req.session.authPortal = 'user';
        }
        req.session.userId = acc.id;
        const plan = SUBSCRIPTION_PLANS[acc.plan] || SUBSCRIPTION_PLANS.free;
        res.json({
            success: true,
            user: buildPublicUserFromAccount(acc, plan),
            isAdmin: acc.role === 'admin',
            authPortal: req.session.authPortal
        });
    } catch (e) {
        console.error('[login-code]', e);
        res.status(500).json({ error: e.message || 'Login failed' });
    }
});

router.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body || {};
        const em = accounts.normalizeEmail(email);
        const acc = accounts.findByEmail(em);
        if (!acc) {
            return res.status(400).json({ error: 'Email not registered' });
        }
        if (!verifyOtp(em, 'reset_password', code)) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }
        const pw = String(newPassword || '');
        if (pw.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        const passwordHash = await bcrypt.hash(pw, 10);
        accounts.updateUser(acc.id, { passwordHash });
        req.session.userId = acc.id;
        req.session.authPortal = 'user';
        const next = accounts.findById(acc.id);
        const plan = SUBSCRIPTION_PLANS[next.plan] || SUBSCRIPTION_PLANS.free;
        res.json({
            success: true,
            user: buildPublicUserFromAccount(next, plan),
            isAdmin: next.role === 'admin',
            authPortal: 'user'
        });
    } catch (e) {
        console.error('[reset-password]', e);
        res.status(500).json({ error: e.message || 'Reset failed' });
    }
});

module.exports = router;
