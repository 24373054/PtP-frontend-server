const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const bcrypt = require('bcrypt');
const session = require('express-session');
const accounts = require('./lib/accounts');
const community = require('./lib/community-store');
const pointLedger = require('./lib/point-ledger');
const moderationStore = require('./lib/moderation-store');
const { sendVerificationCode } = require('./lib/mail');

const app = express();
const PORT = 38024;

// 多个 ComfyUI 实例（单机单卡时只保留一个；多卡多进程时再追加端口）
const COMFYUI_INSTANCES = [
    'http://127.0.0.1:8188'
];

// 单实例模式（向后兼容）
const COMFYUI_URL = COMFYUI_INSTANCES[0];

// 与本地 ComfyUI models 扫描结果一致；旧机器若路径不同可设环境变量覆盖
const COMFYUI_UNET_NAME =
    process.env.COMFYUI_UNET_NAME || 'flux-2-klein-9b-fp8.safetensors';
const COMFYUI_CLIP_NAME =
    process.env.COMFYUI_CLIP_NAME ||
    'split_files/text_encoders/qwen_3_8b_fp8mixed.safetensors';
const COMFYUI_VAE_NAME =
    process.env.COMFYUI_VAE_NAME || 'full_encoder_small_decoder.safetensors';

function comfyuiErrorMessage(error, fallback = 'ComfyUI 请求失败') {
    const d = error.response?.data;
    if (d !== undefined && d !== null) {
        if (typeof d === 'string' && d.trim()) return d.trim().slice(0, 2000);
        if (typeof d === 'object') {
            const msg =
                d.error?.message ||
                d.message ||
                (typeof d.error === 'string' ? d.error : null);
            if (msg) return String(msg).slice(0, 2000);
            try {
                return JSON.stringify(d).slice(0, 2000);
            } catch (_) {
                /* ignore */
            }
        }
    }
    return error.message || fallback;
}

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, 'users.json');
const PRESETS_FILE = path.join(__dirname, 'workflows', 'presets.json');

let APP_PACKAGE = { name: 'p2p-image-editor', version: '1.0.0' };
try {
    APP_PACKAGE = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
    );
} catch (_) {
    /* keep defaults */
}

/** 与 GET /api/version 及 public/version-info.json 共用，便于设置页在 API 未部署时回退读取静态文件 */
function getVersionPayload() {
    return {
        name: APP_PACKAGE.name,
        version: APP_PACKAGE.version,
        role: 'imageforge-web-bff',
        comfyuiUrl: COMFYUI_URL,
        sqlite: true,
        /** 便于排查「Cannot POST /api/auth/...」：若此处无 authEmailOtp，说明跑的不是当前代码或未重启 */
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
        hint:
            'Web 仅请求本服务；ComfyUI 由服务端转发。鸿蒙端可对齐同一 REST/SSE 契约。'
    };
}

const VERSION_INFO_PUBLIC_PATH = path.join(__dirname, 'public', 'version-info.json');
function writePublicVersionInfoFile() {
    try {
        const payload = {
            ...getVersionPayload(),
            _staticFallback: true,
            _writtenAt: new Date().toISOString()
        };
        fs.writeFileSync(
            VERSION_INFO_PUBLIC_PATH,
            JSON.stringify(payload, null, 2),
            'utf8'
        );
    } catch (err) {
        console.warn('[version-info.json]', err.message);
    }
}
writePublicVersionInfoFile();

// 订阅方案配置
const SUBSCRIPTION_PLANS = {
    free: {
        name: { en: 'Free', zh: '免费版' },
        credits: 10,
        creditCost: {
            edit: 2,
            generate: 1,
            jewelry_retouch: 3,
            jewelry_cutout: 3,
            jewelry_scene: 4,
            jewelry_macro: 3
        },
        price: 0,
        features: {
            en: ['10 credits/month', 'Basic quality', 'Standard support'],
            zh: ['10 积分/月', '基础画质', '标准支持']
        }
    },
    basic: {
        name: { en: 'Basic', zh: '基础版' },
        credits: 100,
        creditCost: {
            edit: 2,
            generate: 1,
            jewelry_retouch: 3,
            jewelry_cutout: 3,
            jewelry_scene: 4,
            jewelry_macro: 3
        },
        price: 9.99,
        features: {
            en: ['100 credits/month', 'High quality', 'Priority support', 'No watermark'],
            zh: ['100 积分/月', '高清画质', '优先支持', '无水印']
        }
    },
    pro: {
        name: { en: 'Professional', zh: '专业版' },
        credits: 500,
        creditCost: {
            edit: 1,
            generate: 1,
            jewelry_retouch: 2,
            jewelry_cutout: 2,
            jewelry_scene: 3,
            jewelry_macro: 2
        },
        price: 29.99,
        features: {
            en: ['500 credits/month', 'Ultra quality', '24/7 support', 'API access', 'Commercial license'],
            zh: ['500 积分/月', '超高清画质', '24/7 支持', 'API 访问', '商业授权']
        }
    },
    enterprise: {
        name: { en: 'Enterprise', zh: '企业版' },
        credits: 2000,
        creditCost: {
            edit: 1,
            generate: 1,
            jewelry_retouch: 2,
            jewelry_cutout: 2,
            jewelry_scene: 3,
            jewelry_macro: 2
        },
        price: 99.99,
        features: {
            en: ['2000 credits/month', 'Maximum quality', 'Dedicated support', 'Custom API', 'White label', 'SLA guarantee'],
            zh: ['2000 积分/月', '最高画质', '专属支持', '定制 API', '白标服务', 'SLA 保障']
        }
    },
    beta: {
        name: { en: 'Beta User', zh: '内测用户' },
        credits: 999999,
        creditCost: {
            edit: 0,
            generate: 0,
            jewelry_retouch: 0,
            jewelry_cutout: 0,
            jewelry_scene: 0,
            jewelry_macro: 0
        },
        price: 0,
        features: {
            en: ['Unlimited credits', 'All features', 'Beta access'],
            zh: ['无限积分', '全部功能', '内测权限']
        }
    }
};

const SIGNUP_INITIAL_CREDITS = 30;

/** 邮件验证码内存存储：key -> { code, expires } */
const otpStore = new Map();
const otpSendCooldown = new Map();

function otpKey(email, purpose) {
    return `${accounts.normalizeEmail(email)}:${purpose}`;
}

function resolveCreditCost(planId, operation) {
    const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
    if (planId === 'beta') return 0;
    const c = plan.creditCost || {};
    if (Object.prototype.hasOwnProperty.call(c, operation)) return c[operation];
    if (operation === 'generate') return c.generate != null ? c.generate : 1;
    return c.edit != null ? c.edit : 2;
}

function buildPublicUserFromAccount(acc, plan) {
    return {
        userId: acc.id,
        username: acc.username,
        email: acc.email,
        plan: acc.plan,
        planName: plan.name.en,
        credits: acc.credits,
        usedCredits: acc.usedCredits || 0,
        creditCost: { ...plan.creditCost },
        features: plan.features.en,
        createdAt: acc.createdAt,
        expiresAt: acc.expiresAt != null ? acc.expiresAt : null
    };
}

function deductAccountUser(userId, operation) {
    const acc = accounts.findById(userId);
    if (!acc) {
        return { success: false, error: 'User not found' };
    }
    const plan = SUBSCRIPTION_PLANS[acc.plan] || SUBSCRIPTION_PLANS.free;
    const cost = resolveCreditCost(acc.plan, operation);
    if (acc.plan === 'beta') {
        return { success: true, credits: acc.credits, cost: 0 };
    }
    if (acc.credits < cost) {
        return {
            success: false,
            error: 'Insufficient credits',
            credits: acc.credits,
            required: cost
        };
    }
    const nextCredits = acc.credits - cost;
    const nextUsed = (acc.usedCredits || 0) + cost;
    accounts.updateUser(userId, { credits: nextCredits, usedCredits: nextUsed });
    try {
        const opLabel =
            typeof operation === 'string' ? operation : JSON.stringify(operation);
        pointLedger.appendEntry({
            userId,
            type: 'consume',
            amount: -cost,
            balanceAfter: nextCredits,
            relatedId: opLabel.slice(0, 120),
            remark: `Credits consumed (${opLabel.slice(0, 200)})`
        });
    } catch (err) {
        console.error('[point-ledger consume]', err.message || err);
    }
    return { success: true, credits: nextCredits, cost };
}

function deductCreditsAuth(auth, operation) {
    if (!auth) return { success: false, error: 'Unauthorized' };
    if (auth.kind === 'legacy') {
        return deductCredits(auth.accessCode, operation);
    }
    return deductAccountUser(auth.userId, operation);
}

function resolveAuth(req) {
    if (req.session && req.session.userId) {
        const acc = accounts.findById(req.session.userId);
        if (acc) {
            const plan = SUBSCRIPTION_PLANS[acc.plan] || SUBSCRIPTION_PLANS.free;
            return {
                kind: 'account',
                userId: acc.id,
                publicUser: buildPublicUserFromAccount(acc, plan)
            };
        }
    }
    const raw =
        (req.body && req.body.accessCode) || (req.query && req.query.accessCode);
    const code = typeof raw === 'string' ? raw.trim() : '';
    if (code) {
        const u = authenticateUser(code);
        if (u) {
            return { kind: 'legacy', accessCode: code, publicUser: u };
        }
    }
    return null;
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
        creditCost: { ...plan.creditCost },
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
    const cost = resolveCreditCost(user.plan, operation);
    
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

app.use(express.json());
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

// 靠前注册，避免线上进程因旧代码或未执行到文件后部而缺少该路由（Cannot GET /api/version）
app.get('/api/version', (req, res) => {
    res.json(getVersionPayload());
});

const ALLOWED_OTP_PURPOSES = new Set(['register', 'login', 'reset_password']);

function verifyOtp(email, purpose, code) {
    const ck = otpKey(email, purpose);
    const row = otpStore.get(ck);
    if (!row || String(row.code) !== String(code).trim()) return false;
    if (Date.now() > row.expires) {
        otpStore.delete(ck);
        return false;
    }
    otpStore.delete(ck);
    return true;
}

function isValidUsername(username) {
    const s = String(username || '').trim();
    if (s.length < 2 || s.length > 32) return false;
    return /^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(s);
}

// API: 当前登录用户（邮箱注册 Cookie 会话）
app.get('/api/auth/me', (req, res) => {
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

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('ptp.sid', { path: '/' });
        res.json({ success: true });
    });
});

app.post('/api/auth/send-code', async (req, res) => {
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
        const ck = otpKey(em, purpose);
        const last = otpSendCooldown.get(ck) || 0;
        if (Date.now() - last < 55000) {
            return res
                .status(429)
                .json({ error: 'Please wait about one minute before requesting another code' });
        }
        const code = String(Math.floor(100000 + Math.random() * 900000));
        otpStore.set(ck, { code, expires: Date.now() + 10 * 60 * 1000 });
        otpSendCooldown.set(ck, Date.now());
        await sendVerificationCode(em, code, purpose, lang === 'en' ? 'en' : 'zh');
        res.json({ success: true });
    } catch (e) {
        console.error('[send-code]', e);
        res.status(500).json({ error: e.message || 'Failed to send email' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, username, password, code, lang } = req.body || {};
        const em = accounts.normalizeEmail(email);
        if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
            return res.status(400).json({ error: 'Invalid email' });
        }
        if (!isValidUsername(username)) {
            return res.status(400).json({ error: 'Invalid username (2–32 chars, letters/digits/_- or CJK)' });
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

app.post('/api/auth/login-password', async (req, res) => {
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
                return res
                    .status(403)
                    .json({ error: 'Administrator access denied' });
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

app.post('/api/auth/login-code', async (req, res) => {
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
                return res
                    .status(403)
                    .json({ error: 'Administrator access denied' });
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

app.post('/api/auth/reset-password', async (req, res) => {
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

// 旧版邀请码（仅 users.json，供脚本或未迁移账号）
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
    
    try {
        await axios.post(`${COMFYUI_URL}/upload/image`, formData, {
            headers: formData.getHeaders()
        });
    } catch (error) {
        throw new Error(
            `上传到 ComfyUI 失败: ${comfyuiErrorMessage(error)}`
        );
    }
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
                "unet_name": COMFYUI_UNET_NAME,
                "weight_dtype": "default"
            },
            "class_type": "UNETLoader"
        },
        "75:71": {
            "inputs": {
                "clip_name": COMFYUI_CLIP_NAME,
                "type": "flux2",
                "device": "default"
            },
            "class_type": "CLIPLoader"
        },
        "75:72": {
            "inputs": {
                "vae_name": COMFYUI_VAE_NAME
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

/** 前端 / 客户端传入的模板别名 → 内部 ID */
const EDIT_TEMPLATE_ALIASES = {
    style: 'img2img_style',
    img2img_style: 'img2img_style',
    upscale: 'image_upscale',
    image_upscale: 'image_upscale',
    background: 'background_repaint',
    bg: 'background_repaint',
    background_repaint: 'background_repaint',
    /** 珠宝 / 商拍垂直模板 */
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

/**
 * 三类编辑在 ComfyUI 图上的真实差异（非仅提示词）：
 * - 风格化：低步数、1MP 量级、nearest 缩放
 * - 高清增强：lanczos + 更高 megapixels + 更高 steps（真上采样后再走 Flux2）
 * - 背景重绘：中等步数 + 略提高 CFG，强化文本对画面的牵引
 */
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
    /** 珠宝精修：略增步数与像素，偏 lanczos */
    jewelry_retouch: {
        '75:80': { upscale_method: 'lanczos', megapixels: 1.15 },
        '75:62': { steps: 6 },
        '75:63': { cfg: 1.06 },
        '9': { filename_prefix: 'if-jw-retouch' }
    },
    /** 抠图 / 白底：高 CFG + 较高步数，强化边缘 */
    jewelry_product_cutout: {
        '75:80': { upscale_method: 'lanczos', megapixels: 1 },
        '75:62': { steps: 10 },
        '75:63': { cfg: 1.3 },
        '9': { filename_prefix: 'if-jw-cutout' }
    },
    /** 场景合成 */
    jewelry_scene: {
        '75:80': { upscale_method: 'lanczos', megapixels: 1.25 },
        '75:62': { steps: 9 },
        '75:63': { cfg: 1.2 },
        '9': { filename_prefix: 'if-jw-scene' }
    },
    /** 微距 / 细节放大 */
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
        const p = path.join(__dirname, 'workflows', 'edit_variants.json');
        editVariantFileCache = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) {
        editVariantFileCache = {};
    }
    return editVariantFileCache;
}

function normalizeEditTemplate(raw) {
    const k = String(raw || 'img2img_style')
        .trim()
        .toLowerCase();
    return EDIT_TEMPLATE_ALIASES[k] || 'img2img_style';
}

/** 在 generateP2PWorkflow 基础上按模板合并真实节点参数（可被 edit_variants.json 覆盖） */
function buildEditWorkflow(templateRaw, imageName, prompt, seed) {
    const tid = normalizeEditTemplate(templateRaw);
    const workflow = generateP2PWorkflow(imageName, prompt, seed);
    const base = EDIT_VARIANT_INPUT_PATCHES[tid] || EDIT_VARIANT_INPUT_PATCHES.img2img_style;
    const extra = loadEditVariantFilePatches()[tid] || {};
    const nodeIds = new Set([
        ...Object.keys(base),
        ...Object.keys(extra)
    ]);
    for (const nodeId of nodeIds) {
        if (!workflow[nodeId] || !workflow[nodeId].inputs) continue;
        const patch = { ...(base[nodeId] || {}), ...(extra[nodeId] || {}) };
        Object.assign(workflow[nodeId].inputs, patch);
    }
    return workflow;
}

// 生成T2I工作流（文字生成图片）
function generateT2IWorkflow(prompt, width, height, seed, steps, cfg, filenamePrefix = 't2i-gen') {
    return {
        "76": {
            "inputs": {
                "value": prompt
            },
            "class_type": "PrimitiveStringMultiline"
        },
        "78": {
            "inputs": {
                "filename_prefix": filenamePrefix,
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
                "unet_name": COMFYUI_UNET_NAME,
                "weight_dtype": "default"
            },
            "class_type": "UNETLoader"
        },
        "77:71": {
            "inputs": {
                "clip_name": COMFYUI_CLIP_NAME,
                "type": "flux2",
                "device": "default"
            },
            "class_type": "CLIPLoader"
        },
        "77:72": {
            "inputs": {
                "vae_name": COMFYUI_VAE_NAME
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
    try {
        const response = await axios.post(`${COMFYUI_URL}/prompt`, {
            prompt: workflow,
            client_id: uuidv4()
        });
        return response.data.prompt_id;
    } catch (error) {
        throw new Error(
            `ComfyUI /prompt: ${comfyuiErrorMessage(error)}`
        );
    }
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

function escapeXmlForSvg(s) {
    return String(s)
        .slice(0, 120)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
    } catch (_) {
        return null;
    }
}

/**
 * 珠宝商拍导出：白边、平台尺寸 contain、可选水印。在写入 Comfy 输出后、缩略图前调用。
 */
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
        buf = await sharp(buf)
            .extend({
                top: extra,
                bottom: extra,
                left: extra,
                right: extra,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png()
            .toBuffer();
    }

    if (exp && Number(exp.width) > 0 && Number(exp.height) > 0) {
        buf = await sharp(buf)
            .resize(Math.round(exp.width), Math.round(exp.height), {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png()
            .toBuffer();
    }

    if (wm && String(wm.text || '').trim()) {
        const opacity = clampPostNum(
            wm.opacity != null ? wm.opacity : 0.35,
            0.05,
            1
        );
        const meta = await sharp(buf).metadata();
        const tw = meta.width || 800;
        const th = meta.height || 800;
        const fontSize = Math.max(
            12,
            Math.round(Math.min(tw, th) * 0.028)
        );
        const text = escapeXmlForSvg(wm.text);
        const svg = Buffer.from(
            `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">
        <text x="${tw - 16}" y="${th - 16}" font-family="sans-serif" font-size="${fontSize}"
          fill="rgba(255,255,255,${opacity})" text-anchor="end" stroke="rgba(0,0,0,${opacity * 0.6})" stroke-width="2">${text}</text>
      </svg>`,
            'utf8'
        );
        buf = await sharp(buf)
            .composite([{ input: svg, left: 0, top: 0 }])
            .png()
            .toBuffer();
    }

    await fs.promises.writeFile(outputPath, buf);
}

// 合成四宫格图片
async function createGridImage(imagePaths, outputPath) {
    try {
        // 读取所有图片
        const images = await Promise.all(
            imagePaths.map(p => sharp(p).metadata().then(meta => ({ path: p, meta })))
        );
        
        // 假设所有图片尺寸相同，取第一张的尺寸
        const width = images[0].meta.width;
        const height = images[0].meta.height;
        
        // 创建2x2网格
        const gridWidth = width * 2;
        const gridHeight = height * 2;
        
        // 读取并调整所有图片
        const buffers = await Promise.all(
            imagePaths.map(p => sharp(p).toBuffer())
        );
        
        // 创建四宫格
        await sharp({
            create: {
                width: gridWidth,
                height: gridHeight,
                channels: 3,
                background: { r: 255, g: 255, b: 255 }
            }
        })
        .composite([
            { input: buffers[0], left: 0, top: 0 },           // 左上
            { input: buffers[1], left: width, top: 0 },       // 右上
            { input: buffers[2], left: 0, top: height },      // 左下
            { input: buffers[3], left: width, top: height }   // 右下
        ])
        .png()
        .toFile(outputPath);
        
        return true;
    } catch (error) {
        console.error('Grid creation failed:', error);
        return false;
    }
}

// 并行生成多张图片
async function generateImagesParallel(prompt, width, height, seed, steps, cfg, count = 4) {
    const promises = [];
    const batchId = Date.now().toString(36); // 唯一批次ID
    
    for (let i = 0; i < count; i++) {
        const instanceUrl = COMFYUI_INSTANCES[i % COMFYUI_INSTANCES.length];
        // 每张图片使用完全独立的随机seed，避免相似结果
        const imageSeed = Math.floor(Math.random() * 1000000000000000);
        // 每个实例使用唯一的filename_prefix，避免共享输出目录时文件名冲突
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

// 提交工作流到指定实例
async function queuePromptToInstance(instanceUrl, workflow) {
    try {
        const response = await axios.post(`${instanceUrl}/prompt`, {
            prompt: workflow,
            client_id: uuidv4()
        });
        return response.data.prompt_id;
    } catch (error) {
        throw new Error(
            `ComfyUI /prompt (${instanceUrl}): ${comfyuiErrorMessage(error)}`
        );
    }
}

// 从指定实例等待完成
async function waitForCompletionFromInstance(instanceUrl, promptId, timeout = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        try {
            const historyRes = await axios.get(`${instanceUrl}/history/${promptId}`);
            const history = historyRes.data[promptId];
            
            if (history && history.status && history.status.completed) {
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

// 从指定实例下载图片
async function downloadImageFromInstance(instanceUrl, result) {
    const imageUrl = `${instanceUrl}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    
    const outputFilename = `${uuidv4()}.png`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    fs.writeFileSync(outputPath, imageResponse.data);
    
    return outputPath;
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

// 流式轮询检查任务状态（支持进度推送）
async function waitForCompletionStream(promptId, onProgress, timeout = 300000) {
    const startTime = Date.now();
    let lastProgress = 0;
    
    while (Date.now() - startTime < timeout) {
        try {
            // 获取队列状态
            const queueRes = await axios.get(`${COMFYUI_URL}/queue`);
            const queue = queueRes.data;
            
            // 检查是否在运行队列中
            const runningItem = queue.queue_running.find(item => item[1] === promptId);
            if (runningItem) {
                // 任务正在执行
                const progress = Math.min(50 + lastProgress * 0.5, 85);
                onProgress({ status: 'processing', progress: Math.floor(progress) });
                lastProgress = progress;
            }
            
            // 检查历史记录
            const historyRes = await axios.get(`${COMFYUI_URL}/history/${promptId}`);
            const history = historyRes.data[promptId];
            
            if (history && history.status) {
                if (history.status.completed) {
                    // 任务完成
                    onProgress({ status: 'completed', progress: 100 });
                    
                    const outputs = history.outputs;
                    for (const nodeId in outputs) {
                        if (outputs[nodeId].images) {
                            return outputs[nodeId].images[0];
                        }
                    }
                } else if (history.status.status_str) {
                    // 推送状态信息
                    const progress = Math.min(30 + lastProgress * 0.3, 70);
                    onProgress({ 
                        status: 'processing', 
                        progress: Math.floor(progress),
                        message: history.status.status_str 
                    });
                    lastProgress = progress;
                }
            } else {
                // 任务在队列中等待
                const pendingItem = queue.queue_pending.find(item => item[1] === promptId);
                if (pendingItem) {
                    const queuePosition = queue.queue_pending.indexOf(pendingItem) + 1;
                    onProgress({ 
                        status: 'queued', 
                        progress: 10,
                        message: `Queue position: ${queuePosition}` 
                    });
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    throw new Error('Timeout waiting for image generation');
}

// API: 文字生成图片（四宫格并行模式）
app.post('/api/generate-grid', async (req, res) => {
    try {
        const { prompt, width = 1024, height = 1024, steps = 4, cfg = 1 } = req.body;

        const auth = resolveAuth(req);
        if (!auth) {
            return res.status(401).json({ error: 'Login or access code required' });
        }

        // 检查并扣除积分（生成4张图片，消耗4倍积分）
        const creditResult = deductCreditsAuth(auth, 'generate');
        if (!creditResult.success) {
            return res.status(402).json({ 
                error: creditResult.error,
                credits: creditResult.credits,
                required: creditResult.required
            });
        }
        
        // 再扣除3次（总共4次）
        for (let i = 0; i < 3; i++) {
            const extraCredit = deductCreditsAuth(auth, 'generate');
            if (!extraCredit.success) {
                return res.status(402).json({ 
                    error: 'Insufficient credits for 4 images',
                    credits: extraCredit.credits,
                    required: extraCredit.required
                });
            }
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
        
        console.log(`🎨 开始并行生成4张图片...`);
        console.log(`   提示词: ${prompt.substring(0, 50)}...`);
        console.log(`   使用GPU: 4个实例并行`);
        
        // 并行生成4张图片
        const imagePaths = await generateImagesParallel(prompt, width, height, seed, steps, cfg, 4);
        
        console.log(`✅ 4张图片生成完成，开始合成四宫格...`);
        
        // 合成四宫格
        const gridFilename = `grid_${uuidv4()}.png`;
        const gridPath = path.join(OUTPUT_DIR, gridFilename);
        await createGridImage(imagePaths, gridPath);
        
        console.log(`✅ 四宫格合成完成: ${gridFilename}`);
        
        // 生成缩略图
        const thumbnailFilename = `thumb_${gridFilename.replace('.png', '.jpg')}`;
        const thumbnailPath = path.join(OUTPUT_DIR, thumbnailFilename);
        await generateThumbnail(gridPath, thumbnailPath, 1200);
        
        // 清理单独的图片文件（可选，如果想保留可以注释掉）
        // imagePaths.forEach(p => fs.unlinkSync(p));
        
        res.json({
            success: true,
            image: `/outputs/${gridFilename}`,
            thumbnail: `/outputs/${thumbnailFilename}`,
            individual_images: imagePaths.map(p => `/outputs/${path.basename(p)}`),
            prompt: prompt,
            width: width * 2,  // 四宫格宽度
            height: height * 2, // 四宫格高度
            seed: seed,
            creditsUsed: creditResult.cost * 4,
            creditsRemaining: creditResult.credits
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Failed to generate grid image',
            details: error.message 
        });
    }
});

// API: 文字生成图片（原单张模式，保持向后兼容）
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, width = 1024, height = 1024, steps = 4, cfg = 1 } = req.body;

        const auth = resolveAuth(req);
        if (!auth) {
            return res.status(401).json({ error: 'Login or access code required' });
        }

        // 检查并扣除积分
        const creditResult = deductCreditsAuth(auth, 'generate');
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

// API: 文字生成图片（流式SSE版本）
app.post('/api/generate-stream', async (req, res) => {
    try {
        const { prompt, width = 1024, height = 1024, steps = 4, cfg = 1 } = req.body;

        const auth = resolveAuth(req);
        if (!auth) {
            return res.status(401).json({ error: 'Login or access code required' });
        }

        // 检查并扣除积分
        const creditResult = deductCreditsAuth(auth, 'generate');
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
        
        // 设置SSE响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // 禁用nginx缓冲
        
        const sendEvent = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        
        try {
            const seed = Math.floor(Math.random() * 1000000000000000);
            
            // 发送初始化事件
            sendEvent({ status: 'initializing', progress: 5, message: 'Preparing workflow...' });
            
            // 生成并提交工作流
            const workflow = generateT2IWorkflow(prompt, width, height, seed, steps, cfg);
            const promptId = await queuePrompt(workflow);
            
            sendEvent({ status: 'queued', progress: 15, message: 'Workflow submitted...' });
            
            // 等待完成并推送进度
            const result = await waitForCompletionStream(promptId, (progressData) => {
                sendEvent(progressData);
            });
            
            sendEvent({ status: 'downloading', progress: 90, message: 'Downloading result...' });
            
            // 下载结果图片
            const imageUrl = `${COMFYUI_URL}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            
            const outputFilename = `${uuidv4()}.png`;
            const outputPath = path.join(OUTPUT_DIR, outputFilename);
            fs.writeFileSync(outputPath, imageResponse.data);
            
            sendEvent({ status: 'processing', progress: 95, message: 'Generating thumbnail...' });
            
            // 生成缩略图
            const thumbnailFilename = `thumb_${outputFilename.replace('.png', '.jpg')}`;
            const thumbnailPath = path.join(OUTPUT_DIR, thumbnailFilename);
            await generateThumbnail(outputPath, thumbnailPath, 800);
            
            // 发送完成事件
            sendEvent({
                status: 'completed',
                progress: 100,
                result: {
                    success: true,
                    image: `/outputs/${outputFilename}`,
                    thumbnail: `/outputs/${thumbnailFilename}`,
                    prompt: prompt,
                    width: width,
                    height: height,
                    seed: seed,
                    creditsUsed: creditResult.cost,
                    creditsRemaining: creditResult.credits
                }
            });
            
            res.end();
            
        } catch (error) {
            console.error('Stream error:', error);
            sendEvent({
                status: 'error',
                error: error.message || 'Failed to generate image'
            });
            res.end();
        }
        
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
        
        const { prompt, workflowTemplate } = req.body;

        const auth = resolveAuth(req);
        if (!auth) {
            return res.status(401).json({ error: 'Login or access code required' });
        }

        const creditOp = getEditCreditOperationKey(workflowTemplate);
        const creditResult = deductCreditsAuth(auth, creditOp);
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
        
        const workflow = buildEditWorkflow(workflowTemplate, imageName, prompt, seed);
        const promptId = await queuePrompt(workflow);
        
        // 等待完成
        const result = await waitForCompletion(promptId);
        
        // 下载结果图片
        const imageUrl = `${COMFYUI_URL}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        
        const outputFilename = `${uuidv4()}.png`;
        const outputPath = path.join(OUTPUT_DIR, outputFilename);
        fs.writeFileSync(outputPath, imageResponse.data);

        try {
            await applyOutputPostProcess(
                outputPath,
                parsePostProcessBody(req.body.postProcess)
            );
        } catch (pe) {
            console.error('[postProcess]', pe.message || pe);
        }
        
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

// API: 编辑图片（流式SSE版本）
app.post('/api/edit-stream', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }
        
        const { prompt, workflowTemplate } = req.body;

        const auth = resolveAuth(req);
        if (!auth) {
            return res.status(401).json({ error: 'Login or access code required' });
        }

        const creditOp = getEditCreditOperationKey(workflowTemplate);
        const creditResult = deductCreditsAuth(auth, creditOp);
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
        
        // 设置SSE响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        
        const sendEvent = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        
        try {
            const imageName = req.file.filename;
            const seed = Math.floor(Math.random() * 1000000000000000);
            
            // 发送初始化事件
            sendEvent({ status: 'initializing', progress: 5, message: 'Uploading image...' });
            
            // 上传图片到ComfyUI
            await uploadImageToComfyUI(req.file.path, imageName);
            
            sendEvent({ status: 'preparing', progress: 15, message: 'Preparing workflow...' });
            
            const workflow = buildEditWorkflow(workflowTemplate, imageName, prompt, seed);
            const promptId = await queuePrompt(workflow);
            
            sendEvent({ status: 'queued', progress: 20, message: 'Workflow submitted...' });
            
            // 等待完成并推送进度
            const result = await waitForCompletionStream(promptId, (progressData) => {
                sendEvent(progressData);
            });
            
            sendEvent({ status: 'downloading', progress: 90, message: 'Downloading result...' });
            
            // 下载结果图片
            const imageUrl = `${COMFYUI_URL}/view?filename=${result.filename}&subfolder=${result.subfolder || ''}&type=${result.type}`;
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            
            const outputFilename = `${uuidv4()}.png`;
            const outputPath = path.join(OUTPUT_DIR, outputFilename);
            fs.writeFileSync(outputPath, imageResponse.data);

            try {
                await applyOutputPostProcess(
                    outputPath,
                    parsePostProcessBody(req.body.postProcess)
                );
            } catch (pe) {
                console.error('[postProcess]', pe.message || pe);
            }
            
            sendEvent({ status: 'processing', progress: 95, message: 'Generating thumbnail...' });
            
            // 生成缩略图
            const thumbnailFilename = `thumb_${outputFilename.replace('.png', '.jpg')}`;
            const thumbnailPath = path.join(OUTPUT_DIR, thumbnailFilename);
            await generateThumbnail(outputPath, thumbnailPath, 800);
            
            // 发送完成事件
            sendEvent({
                status: 'completed',
                progress: 100,
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
            sendEvent({
                status: 'error',
                error: error.message || 'Failed to edit image'
            });
            res.end();
        }
        
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

// 工作流模板清单与编辑预置（与 workflows/presets.json 同步，供 Web / 移动端共用）
app.get('/api/presets', (req, res) => {
    try {
        const raw = fs.readFileSync(PRESETS_FILE, 'utf8');
        res.type('application/json').send(raw);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read presets', details: error.message });
    }
});

// 编辑类工作流：各模板在 ComfyUI 节点上的真实参数差异（及可选 edit_variants.json 覆盖）
app.get('/api/edit-variants', (req, res) => {
    res.json({
        aliases: EDIT_TEMPLATE_ALIASES,
        builtinPatches: EDIT_VARIANT_INPUT_PATCHES,
        fileOverrides: loadEditVariantFilePatches()
    });
});

// --- 话题挑战 / 作品社区（Phase 2：SQLite data/imageforge.sqlite，首次启动可从 community.json 等迁移；契约见 docs/ImageForge_API_Document_Template.md）---

function publicBaseUrl(req) {
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
        .split(',')[0]
        .trim();
    const host = req.get('host') || `localhost:${PORT}`;
    return `${proto}://${host}`;
}

function resolveLocalAssetPath(rel) {
    if (typeof rel !== 'string' || !rel.startsWith('/')) return null;
    if (rel.includes('..')) return null;
    if (rel.startsWith('/outputs/')) {
        const fn = path.basename(rel);
        const full = path.join(OUTPUT_DIR, fn);
        if (fs.existsSync(full)) return { full, rel: `/outputs/${fn}` };
    }
    if (rel.startsWith('/uploads/')) {
        const fn = path.basename(rel);
        const full = path.join(UPLOAD_DIR, fn);
        if (fs.existsSync(full)) return { full, rel: `/uploads/${fn}` };
    }
    return null;
}

function workflowFromHistoryProof(proof) {
    if (!proof || typeof proof !== 'object') return null;
    if (proof.mode === 'generate') return 't2i_generate';
    if (proof.workflowTemplate) return String(proof.workflowTemplate);
    if (proof.params && proof.params.workflowTemplate) {
        return String(proof.params.workflowTemplate);
    }
    return null;
}

function requireSessionAccount(req, res) {
    if (!req.session || !req.session.userId) {
        res.status(401).json({ code: 40101, message: 'Unauthorized', data: null });
        return null;
    }
    const acc = accounts.findById(req.session.userId);
    if (!acc) {
        res.status(401).json({ code: 40101, message: 'Unauthorized', data: null });
        return null;
    }
    return acc;
}

function isAdminRequest(req) {
    const key = process.env.IMAGEFORGE_ADMIN_KEY;
    if (key && String(key).length > 0 && req.get('x-admin-key') === String(key)) {
        return true;
    }
    if (
        req.session &&
        req.session.userId &&
        req.session.authPortal === 'admin'
    ) {
        const acc = accounts.findById(req.session.userId);
        if (acc && acc.role === 'admin') return true;
    }
    return false;
}

function requireAdmin(req, res) {
    if (!isAdminRequest(req)) {
        res.status(403).json({ code: 40301, message: 'Forbidden', data: null });
        return false;
    }
    return true;
}

/** 活动奖励：增加 credits 并记 point_ledger（amount 正整数） */
function grantRewardCredits(userId, amountInt, opts = {}) {
    const acc = accounts.findById(userId);
    if (!acc || !Number.isFinite(amountInt) || amountInt <= 0) {
        return { success: false, error: 'bad_request' };
    }
    const next = (acc.credits || 0) + Math.floor(amountInt);
    accounts.updateUser(userId, { credits: next });
    pointLedger.appendEntry({
        userId,
        type: 'reward',
        amount: Math.floor(amountInt),
        balanceAfter: next,
        relatedId: opts.relatedId || null,
        remark: opts.remark || 'Topic challenge reward'
    });
    return { success: true, credits: next };
}

/** 与 POST /api/admin/topics/:topicId/settle 共用；供定时自动结算调用。 */
function executeTopicSettlement(topicId) {
    const built = community.buildSettlementPayouts(topicId);
    if (built.error) {
        return { ok: false, error: built.error };
    }
    for (const row of built.payouts) {
        if (!accounts.findById(row.userId)) {
            return { ok: false, error: 'unknown_user', row };
        }
    }
    const applied = [];
    for (const row of built.payouts) {
        const g = grantRewardCredits(row.userId, row.points, {
            relatedId: topicId,
            remark: `Challenge reward · rank ${row.rank} · post ${row.postId}`
        });
        applied.push({
            ...row,
            ok: g.success,
            creditsAfter: g.success ? g.credits : null,
            error: g.success ? null : g.error || null
        });
        if (!g.success) {
            return {
                ok: false,
                error: 'grant_failed',
                topicId,
                applied
            };
        }
    }
    community.markTopicSettled(topicId, {
        payouts: applied,
        settledAt: new Date().toISOString()
    });
    return { ok: true, topicId, payouts: applied };
}

function serializeCommunityPost(req, p, viewerUserId, { includePrompt = false } = {}) {
    const base = publicBaseUrl(req);
    const likeUserIds = p.likeUserIds || [];
    const favoriteUserIds = p.favoriteUserIds || [];
    const nickname = p.user && p.user.nickname;
    const showPrompt =
        includePrompt &&
        (p.publicPrompt || (viewerUserId && viewerUserId === p.userId));
    return {
        id: p.id,
        topicId: p.topicId,
        user: {
            id: p.userId,
            nickname,
            avatarUrl: (p.user && p.user.avatarUrl) || null
        },
        imageUrl: `${base}${p.imageRel}`,
        caption: p.caption,
        taskType: p.taskType,
        workflowTemplate: p.workflowTemplate,
        promptSummary: showPrompt ? p.promptSummary : null,
        aiLabel: p.aiLabel !== false,
        status: p.status,
        likeCount: likeUserIds.length,
        commentCount: (p.comments && p.comments.length) || 0,
        favoriteCount: favoriteUserIds.length,
        score: community.computeScore(p),
        rank: null,
        liked: viewerUserId ? likeUserIds.includes(viewerUserId) : false,
        favorited: viewerUserId ? favoriteUserIds.includes(viewerUserId) : false,
        createdAt: p.createdAt
    };
}

function serializeAdminTopic(req, t) {
    if (!t) return null;
    const base = publicBaseUrl(req);
    const coverUrl = t.coverUrl
        ? String(t.coverUrl).startsWith('http')
            ? t.coverUrl
            : `${base}${t.coverUrl}`
        : '';
    return { ...t, coverUrl };
}

function serializeAdminPostBrief(req, p) {
    const base = publicBaseUrl(req);
    return {
        id: p.id,
        topicId: p.topicId,
        userId: p.userId,
        user: p.user,
        imageUrl: `${base}${p.imageRel}`,
        thumbUrl: p.thumbRel ? `${base}${p.thumbRel}` : `${base}${p.imageRel}`,
        caption: p.caption,
        status: p.status,
        taskType: p.taskType,
        promptSummary: p.promptSummary,
        publicPrompt: p.publicPrompt,
        commentCount: (p.comments && p.comments.length) || 0,
        createdAt: p.createdAt
    };
}

/** 管理端全文：含评论、prompt、historyProof、点赞/收藏用户 id */
function serializeAdminPost(req, p) {
    const base = publicBaseUrl(req);
    const likeUserIds = p.likeUserIds || [];
    const favoriteUserIds = p.favoriteUserIds || [];
    return {
        id: p.id,
        topicId: p.topicId,
        userId: p.userId,
        user: p.user,
        imageRel: p.imageRel,
        thumbRel: p.thumbRel,
        imageUrl: `${base}${p.imageRel}`,
        thumbUrl: p.thumbRel ? `${base}${p.thumbRel}` : `${base}${p.imageRel}`,
        caption: p.caption,
        taskType: p.taskType,
        workflowTemplate: p.workflowTemplate,
        promptSummary: p.promptSummary,
        publicPrompt: p.publicPrompt,
        aiLabel: p.aiLabel !== false,
        status: p.status,
        likeUserIds: [...likeUserIds],
        favoriteUserIds: [...favoriteUserIds],
        likeCount: likeUserIds.length,
        favoriteCount: favoriteUserIds.length,
        commentCount: (p.comments && p.comments.length) || 0,
        comments: p.comments || [],
        historyProof: p.historyProof,
        score: community.computeScore(p),
        createdAt: p.createdAt
    };
}

app.get('/api/topics', (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 20, 50);
    const { list, ...rest } = community.listTopics({ status, page, pageSize });
    const base = publicBaseUrl(req);
    res.json({
        code: 0,
        message: 'ok',
        data: {
            list: list.map((t) => ({
                id: t.id,
                title: t.title,
                tag: t.tag,
                coverUrl: t.coverUrl
                    ? t.coverUrl.startsWith('http')
                        ? t.coverUrl
                        : `${base}${t.coverUrl}`
                    : '',
                status: t.status,
                startAt: t.startAt,
                endAt: t.endAt,
                postCount: t.postCount,
                rewardPool: t.rewardPool,
                settlementStatus: t.settlementStatus || 'none'
            })),
            ...rest
        }
    });
});

app.get('/api/topics/:topicId', (req, res) => {
    const t = community.getTopic(req.params.topicId);
    if (!t) {
        return res
            .status(404)
            .json({ code: 40401, message: 'Topic not found', data: null });
    }
    const auth = resolveAuth(req);
    const viewerId = auth && auth.kind === 'account' ? auth.userId : null;
    res.json({
        code: 0,
        message: 'ok',
        data: {
            ...t,
            mySubmitted: viewerId
                ? community.userHasPostInTopic(viewerId, t.id)
                : false
        }
    });
});

app.post('/api/topics/:topicId/posts', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const topic = community.getTopic(req.params.topicId);
    if (!topic) {
        return res
            .status(404)
            .json({ code: 40401, message: 'Topic not found', data: null });
    }
    if (topic.status !== 'active') {
        return res.status(400).json({
            code: 40001,
            message: 'Topic not active',
            data: null
        });
    }
    const now = Date.now();
    if (
        new Date(topic.startAt).getTime() > now ||
        new Date(topic.endAt).getTime() < now
    ) {
        return res.status(400).json({
            code: 40002,
            message: 'Topic not in time window',
            data: null
        });
    }
    if (community.userHasPostInTopic(acc.id, topic.id)) {
        return res.status(409).json({
            code: 40901,
            message: 'Already submitted to this topic',
            data: null
        });
    }
    const { caption = '', publicPrompt = false, historyProof } = req.body || {};
    if (!historyProof || typeof historyProof !== 'object') {
        return res.status(400).json({
            code: 40003,
            message: 'historyProof required',
            data: null
        });
    }
    const wf = workflowFromHistoryProof(historyProof);
    if (!wf || !topic.allowedTaskTypes.includes(wf)) {
        return res.status(400).json({
            code: 40004,
            message: 'Workflow not allowed for this topic',
            data: null
        });
    }
    const outRel = historyProof.outRel || historyProof.imageRel;
    const resolved = resolveLocalAssetPath(outRel);
    if (!resolved) {
        return res.status(400).json({
            code: 40005,
            message: 'Output file not found on server',
            data: null
        });
    }
    let thumbRel = resolved.rel;
    if (historyProof.thumbRel) {
        const tr = resolveLocalAssetPath(historyProof.thumbRel);
        if (tr) thumbRel = tr.rel;
    }
    const taskType = String(historyProof.taskType || wf).slice(0, 64);
    const promptSummary = String(
        historyProof.prompt || historyProof.promptSummary || ''
    ).slice(0, 400);

    const post = community.createPost({
        topicId: topic.id,
        userId: acc.id,
        nickname: acc.username,
        avatarUrl: null,
        caption: String(caption || '').slice(0, 500),
        publicPrompt: !!publicPrompt,
        workflowTemplate: wf,
        taskType,
        promptSummary,
        imageRel: resolved.rel,
        thumbRel,
        historyProof: {
            historyId: historyProof.historyId,
            at: historyProof.at,
            mode: historyProof.mode
        }
    });
    res.json({
        code: 0,
        message: 'ok',
        data: { id: post.id, status: post.status }
    });
});

app.get('/api/topics/:topicId/posts', (req, res) => {
    const topic = community.getTopic(req.params.topicId);
    if (!topic) {
        return res
            .status(404)
            .json({ code: 40401, message: 'Topic not found', data: null });
    }
    const sort =
        req.query.sort === 'hot' || req.query.sort === 'rank'
            ? req.query.sort
            : 'latest';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 20, 50);
    const { list, ...rest } = community.listPostsForTopic(topic.id, {
        sort,
        page,
        pageSize
    });
    const auth = resolveAuth(req);
    const viewerId = auth && auth.kind === 'account' ? auth.userId : null;
    res.json({
        code: 0,
        message: 'ok',
        data: {
            list: list.map(({ post: p, rank }) => {
                const row = serializeCommunityPost(req, p, viewerId, {
                    includePrompt: false
                });
                row.rank = rank;
                return row;
            }),
            ...rest
        }
    });
});

app.get('/api/topics/:topicId/ranking', (req, res) => {
    const topic = community.getTopic(req.params.topicId);
    if (!topic) {
        return res
            .status(404)
            .json({ code: 40401, message: 'Topic not found', data: null });
    }
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 50, 100);
    const { list, ...rest } = community.rankingForTopic(topic.id, {
        page,
        pageSize
    });
    const auth = resolveAuth(req);
    const viewerId = auth && auth.kind === 'account' ? auth.userId : null;
    res.json({
        code: 0,
        message: 'ok',
        data: {
            list: list.map(({ post: p, rank, score }) => {
                const row = serializeCommunityPost(req, p, viewerId);
                row.rank = rank;
                row.score = score;
                return row;
            }),
            ...rest
        }
    });
});

app.get('/api/posts/:postId', (req, res) => {
    const p = community.findPost(req.params.postId);
    if (!p || p.status !== 'published') {
        return res
            .status(404)
            .json({ code: 40402, message: 'Post not found', data: null });
    }
    const auth = resolveAuth(req);
    const viewerId = auth && auth.kind === 'account' ? auth.userId : null;
    const ranked = community.rankingForTopic(p.topicId, {
        page: 1,
        pageSize: 5000
    });
    const rankMap = new Map(ranked.list.map((x) => [x.post.id, x.rank]));
    const row = serializeCommunityPost(req, p, viewerId, {
        includePrompt: true
    });
    row.rank = rankMap.get(p.id) || null;
    row.shareCount = 0;
    res.json({ code: 0, message: 'ok', data: row });
});

app.post('/api/posts/:postId/like', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const result = community.setPostLike(req.params.postId, acc.id, true);
    if (!result) {
        return res
            .status(404)
            .json({ code: 40402, message: 'Post not found', data: null });
    }
    res.json({ code: 0, message: 'ok', data: result });
});

app.delete('/api/posts/:postId/like', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const result = community.setPostLike(req.params.postId, acc.id, false);
    if (!result) {
        return res
            .status(404)
            .json({ code: 40402, message: 'Post not found', data: null });
    }
    res.json({ code: 0, message: 'ok', data: result });
});

app.post('/api/posts/:postId/comments', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const content = (req.body && req.body.content) || '';
    const c = community.addComment(req.params.postId, {
        userId: acc.id,
        nickname: acc.username,
        content
    });
    if (c === null) {
        return res
            .status(404)
            .json({ code: 40402, message: 'Post not found', data: null });
    }
    if (c.error === 'empty') {
        return res
            .status(400)
            .json({ code: 40006, message: 'Empty comment', data: null });
    }
    res.json({
        code: 0,
        message: 'ok',
        data: {
            id: c.id,
            postId: req.params.postId,
            content: c.content,
            status: 'published',
            createdAt: c.createdAt
        }
    });
});

app.get('/api/posts/:postId/comments', (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 20, 50);
    const result = community.listComments(req.params.postId, {
        page,
        pageSize
    });
    if (!result) {
        return res
            .status(404)
            .json({ code: 40402, message: 'Post not found', data: null });
    }
    res.json({
        code: 0,
        message: 'ok',
        data: {
            ...result,
            list: result.list.map((c) => ({
                id: c.id,
                user: c.user,
                content: c.content,
                createdAt: c.createdAt
            }))
        }
    });
});

app.post('/api/posts/:postId/favorite', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const result = community.setPostFavorite(req.params.postId, acc.id, true);
    if (!result) {
        return res
            .status(404)
            .json({ code: 40402, message: 'Post not found', data: null });
    }
    res.json({ code: 0, message: 'ok', data: result });
});

app.delete('/api/posts/:postId/favorite', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const result = community.setPostFavorite(req.params.postId, acc.id, false);
    if (!result) {
        return res
            .status(404)
            .json({ code: 40402, message: 'Post not found', data: null });
    }
    res.json({ code: 0, message: 'ok', data: result });
});

app.post('/api/posts/:postId/report', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const p = community.findPost(req.params.postId);
    if (!p || p.status !== 'published') {
        return res
            .status(404)
            .json({ code: 40402, message: 'Post not found', data: null });
    }
    const { reason = 'other', note = '' } = req.body || {};
    const r = moderationStore.addReport({
        postId: p.id,
        topicId: p.topicId,
        reporterUserId: acc.id,
        reason,
        note
    });
    if (r.error === 'duplicate') {
        return res.status(409).json({
            code: 40902,
            message: 'Already reported this post',
            data: null
        });
    }
    res.json({ code: 0, message: 'ok', data: { id: r.report.id } });
});

app.get('/api/auth/point-ledger', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 30, 100);
    const data = pointLedger.listForUser(acc.id, { page, pageSize });
    res.json({ code: 0, message: 'ok', data });
});

app.get('/api/admin/moderation', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const status = req.query.status ? String(req.query.status) : 'open';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 50, 200);
    const data = moderationStore.listReports({ status, page, pageSize });
    res.json({ code: 0, message: 'ok', data });
});

app.post('/api/admin/moderation/:reportId/resolve', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { resolution = 'reviewed', adminNote = '' } = req.body || {};
    const out = moderationStore.resolveReport(req.params.reportId, {
        resolution,
        adminNote
    });
    if (!out) {
        return res
            .status(404)
            .json({ code: 40403, message: 'Report not found', data: null });
    }
    if (out.error === 'not_open') {
        return res.status(400).json({
            code: 40012,
            message: 'Report already resolved',
            data: null
        });
    }
    res.json({ code: 0, message: 'ok', data: { id: out.report.id, status: out.report.status } });
});

app.post('/api/admin/posts/:postId/hide', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const p = community.setPostHidden(req.params.postId, true);
    if (!p) {
        return res
            .status(404)
            .json({ code: 40402, message: 'Post not found', data: null });
    }
    res.json({
        code: 0,
        message: 'ok',
        data: { id: p.id, status: p.status }
    });
});

app.post('/api/admin/topics/:topicId/settle', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const topicId = req.params.topicId;
    const out = executeTopicSettlement(topicId);
    if (!out.ok) {
        if (out.error === 'not_found') {
            return res
                .status(404)
                .json({ code: 40401, message: 'Topic not found', data: null });
        }
        if (out.error === 'already_settled') {
            return res.status(400).json({
                code: 40010,
                message: 'Topic already settled',
                data: null
            });
        }
        if (out.error === 'topic_not_ended') {
            return res.status(400).json({
                code: 40011,
                message: 'Topic must be ended before settlement',
                data: null
            });
        }
        if (out.error === 'unknown_user') {
            return res.status(400).json({
                code: 40020,
                message: `Unknown user in payout: ${out.row.userId}`,
                data: { row: out.row }
            });
        }
        if (out.error === 'grant_failed') {
            return res.status(500).json({
                code: 50010,
                message: 'Settlement aborted after partial credit failure',
                data: { topicId, payouts: out.applied }
            });
        }
        return res.status(500).json({
            code: 50011,
            message: String(out.error),
            data: out
        });
    }
    res.json({
        code: 0,
        message: 'ok',
        data: { topicId, payouts: out.payouts }
    });
});

app.get('/api/admin/summary', (req, res) => {
    if (!requireAdmin(req, res)) return;
    community.syncTopicLifecycle();
    const data = community.getAdminSummary();
    res.json({ code: 0, message: 'ok', data });
});

app.get('/api/admin/users', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const data = accounts.load();
    const list = (data.users || []).map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        plan: u.plan,
        role: u.role || null,
        credits: u.credits,
        createdAt: u.createdAt
    }));
    res.json({ code: 0, message: 'ok', data: { list } });
});

app.get('/api/admin/topics', (req, res) => {
    if (!requireAdmin(req, res)) return;
    community.syncTopicLifecycle();
    const status = req.query.status ? String(req.query.status) : undefined;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 100, 200);
    const { list, ...rest } = community.listTopics({ status, page, pageSize });
    res.json({
        code: 0,
        message: 'ok',
        data: {
            list: list.map((t) => serializeAdminTopic(req, t)),
            ...rest
        }
    });
});

app.get('/api/admin/topics/:topicId/posts', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const t = community.getTopic(req.params.topicId);
    if (!t) {
        return res
            .status(404)
            .json({ code: 40401, message: 'Topic not found', data: null });
    }
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 50, 200);
    const { list, ...rest } = community.listPostsForTopicAdmin(t.id, {
        page,
        pageSize
    });
    res.json({
        code: 0,
        message: 'ok',
        data: {
            list: list.map((p) => serializeAdminPostBrief(req, p)),
            ...rest
        }
    });
});

app.get('/api/admin/posts/:postId', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const p = community.findPost(req.params.postId);
    if (!p) {
        return res
            .status(404)
            .json({ code: 40402, message: 'Post not found', data: null });
    }
    res.json({
        code: 0,
        message: 'ok',
        data: serializeAdminPost(req, p)
    });
});

app.get('/api/admin/ledger', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 50, 200);
    const data = pointLedger.listAll({ page, pageSize });
    res.json({ code: 0, message: 'ok', data });
});

// 静态与产物目录放在 API 之后，避免意外覆盖 /api 等路由
app.use(express.static('public'));
app.use('/workflows', express.static(path.join(__dirname, 'workflows')));
app.use('/outputs', express.static(OUTPUT_DIR));

function lanIPv4Addresses() {
    const nets = os.networkInterfaces();
    const out = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            const v4 =
                net.family === 'IPv4' || net.family === 4;
            if (v4 && !net.internal) {
                out.push(net.address);
            }
        }
    }
    return out;
}

function runAutoSettlementPass() {
    const v = process.env.IMAGEFORGE_AUTO_SETTLE;
    if (v !== '1' && v !== 'true') return;
    try {
        community.syncTopicLifecycle();
        const ids = community.listTopicsAwaitingSettlement();
        for (const topicId of ids) {
            const out = executeTopicSettlement(topicId);
            if (out.ok) {
                console.log('[auto-settle] settled', topicId);
            } else {
                console.warn('[auto-settle] skip', topicId, out.error);
            }
        }
    } catch (e) {
        console.error('[auto-settle]', e);
    }
}

app.listen(PORT, '0.0.0.0', () => {
    writePublicVersionInfoFile();
    console.log(`\n=== P2P Image Editor Server ===`);
    console.log(`Local: http://localhost:${PORT}`);
    const lan = lanIPv4Addresses();
    if (lan.length) {
        for (const addr of lan) {
            console.log(`Network: http://${addr}:${PORT}`);
        }
    } else {
        console.log('Network: (未发现非回环 IPv4，请用 ip addr 查看本机地址)');
    }
    console.log(`ComfyUI: ${COMFYUI_URL}`);
    console.log(
        `Auth: POST /api/auth/send-code | register | login-password | login-code | reset-password | GET /api/auth/me`
    );
    console.log(
        `Community: GET /api/topics | /api/topics/:id | posts | ranking | GET/POST /api/posts/...`
    );
    if (
        process.env.IMAGEFORGE_AUTO_SETTLE === '1' ||
        process.env.IMAGEFORGE_AUTO_SETTLE === 'true'
    ) {
        console.log(
            'Auto-settle: IMAGEFORGE_AUTO_SETTLE enabled (hourly + 15s first run)'
        );
        setInterval(runAutoSettlementPass, 60 * 60 * 1000);
        setTimeout(runAutoSettlementPass, 15000);
    }
    console.log(`================================\n`);
});
