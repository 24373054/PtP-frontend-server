/**
 * 从 email/邮箱.txt 或环境变量加载 SMTP，用于发送验证码。
 * 发件人显示名：北京刻熵科技有限公司
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const CONFIG_PATH = path.join(__dirname, '..', 'email', '邮箱.txt');

function parseMailboxFile(content) {
    const out = {};
    if (!content || typeof content !== 'string') return out;
    const re = /mail_(\w+)\s*=\s*['"]([^'"]*)['"]/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        out[m[1]] = m[2];
    }
    return out;
}

function loadMailConfig() {
    const fromEnv = {
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT ? Number(process.env.MAIL_PORT, 10) : undefined,
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    };
    if (fromEnv.host && fromEnv.user && fromEnv.pass) {
        const portNum = fromEnv.port
            ? parseInt(String(fromEnv.port), 10)
            : 465;
        return {
            host: fromEnv.host,
            port: portNum,
            secure: portNum === 465,
            auth: { user: fromEnv.user, pass: fromEnv.pass }
        };
    }
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const p = parseMailboxFile(raw);
        if (p.user && p.pass && p.host) {
            const port = p.port ? Number(p.port, 10) : 465;
            return {
                host: p.host,
                port,
                secure: port === 465,
                auth: { user: p.user, pass: p.pass }
            };
        }
    } catch (_) {
        /* missing file */
    }
    return null;
}

let cachedTransport = null;
function getTransport() {
    if (cachedTransport) return cachedTransport;
    const cfg = loadMailConfig();
    if (!cfg) return null;
    cachedTransport = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth
    });
    return cachedTransport;
}

const SENDER_NAME = '北京刻熵科技有限公司';

async function sendVerificationCode(to, code, purpose, lang = 'zh') {
    const t = getTransport();
    if (!t) {
        throw new Error(
            'Mail is not configured: set MAIL_HOST/MAIL_USER/MAIL_PASS or create email/邮箱.txt'
        );
    }
    const cfg = loadMailConfig();
    const fromAddr = `"${SENDER_NAME}" <${cfg.auth.user}>`;
    const subjects = {
        zh: {
            register: '【刻熵】注册验证码',
            login: '【刻熵】登录验证码',
            reset_password: '【刻熵】重置密码验证码'
        },
        en: {
            register: '[KeShang] Registration code',
            login: '[KeShang] Login code',
            reset_password: '[KeShang] Password reset code'
        }
    };
    const bodies = {
        zh: {
            register: `您的注册验证码为：${code}，10 分钟内有效。如非本人操作请忽略。`,
            login: `您的登录验证码为：${code}，10 分钟内有效。如非本人操作请忽略。`,
            reset_password: `您正在重置密码，验证码：${code}，10 分钟内有效。如非本人操作请忽略。`
        },
        en: {
            register: `Your registration code is: ${code}. Valid for 10 minutes.`,
            login: `Your login code is: ${code}. Valid for 10 minutes.`,
            reset_password: `Your password reset code is: ${code}. Valid for 10 minutes.`
        }
    };
    const lk = lang === 'en' ? 'en' : 'zh';
    const subject = subjects[lk][purpose] || subjects.zh[purpose] || subjects.zh.login;
    const text = bodies[lk][purpose] || bodies.zh[purpose] || String(code);

    await t.sendMail({
        from: fromAddr,
        to,
        subject,
        text
    });
}

module.exports = {
    loadMailConfig,
    sendVerificationCode,
    SENDER_NAME
};
