'use strict';

const accounts = require('./accounts');
const pointLedger = require('./point-ledger');

const SUBSCRIPTION_PLANS = {
    free: {
        name: { en: 'Free', zh: '免费版' },
        credits: 10,
        creditCost: { edit: 2, generate: 1, jewelry_retouch: 3, jewelry_cutout: 3, jewelry_scene: 4, jewelry_macro: 3 },
        price: 0,
        features: { en: ['10 credits/month', 'Basic quality', 'Standard support'], zh: ['10 积分/月', '基础画质', '标准支持'] }
    },
    basic: {
        name: { en: 'Basic', zh: '基础版' },
        credits: 100,
        creditCost: { edit: 2, generate: 1, jewelry_retouch: 3, jewelry_cutout: 3, jewelry_scene: 4, jewelry_macro: 3 },
        price: 9.99,
        features: { en: ['100 credits/month', 'High quality', 'Priority support', 'No watermark'], zh: ['100 积分/月', '高清画质', '优先支持', '无水印'] }
    },
    pro: {
        name: { en: 'Professional', zh: '专业版' },
        credits: 500,
        creditCost: { edit: 1, generate: 1, jewelry_retouch: 2, jewelry_cutout: 2, jewelry_scene: 3, jewelry_macro: 2 },
        price: 29.99,
        features: { en: ['500 credits/month', 'Ultra quality', '24/7 support', 'API access', 'Commercial license'], zh: ['500 积分/月', '超高清画质', '24/7 支持', 'API 访问', '商业授权'] }
    },
    enterprise: {
        name: { en: 'Enterprise', zh: '企业版' },
        credits: 2000,
        creditCost: { edit: 1, generate: 1, jewelry_retouch: 2, jewelry_cutout: 2, jewelry_scene: 3, jewelry_macro: 2 },
        price: 99.99,
        features: { en: ['2000 credits/month', 'Maximum quality', 'Dedicated support', 'Custom API', 'White label', 'SLA guarantee'], zh: ['2000 积分/月', '最高画质', '专属支持', '定制 API', '白标服务', 'SLA 保障'] }
    },
    beta: {
        name: { en: 'Beta User', zh: '内测用户' },
        credits: 999999,
        creditCost: { edit: 0, generate: 0, jewelry_retouch: 0, jewelry_cutout: 0, jewelry_scene: 0, jewelry_macro: 0 },
        price: 0,
        features: { en: ['Unlimited credits', 'All features', 'Beta access'], zh: ['无限积分', '全部功能', '内测权限'] }
    }
};

const SIGNUP_INITIAL_CREDITS = 30;

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
    if (!acc) return { success: false, error: 'User not found' };
    const plan = SUBSCRIPTION_PLANS[acc.plan] || SUBSCRIPTION_PLANS.free;
    const cost = resolveCreditCost(acc.plan, operation);
    if (acc.plan === 'beta') return { success: true, credits: acc.credits, cost: 0 };
    if (acc.credits < cost) return { success: false, error: 'Insufficient credits', credits: acc.credits, required: cost };
    const nextCredits = acc.credits - cost;
    const nextUsed = (acc.usedCredits || 0) + cost;
    accounts.updateUser(userId, { credits: nextCredits, usedCredits: nextUsed });
    try {
        const opLabel = typeof operation === 'string' ? operation : JSON.stringify(operation);
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
    return deductAccountUser(auth.userId, operation);
}

function resolveAuth(req) {
    if (req.session && req.session.userId) {
        const acc = accounts.findById(req.session.userId);
        if (acc) {
            const plan = SUBSCRIPTION_PLANS[acc.plan] || SUBSCRIPTION_PLANS.free;
            return { kind: 'account', userId: acc.id, publicUser: buildPublicUserFromAccount(acc, plan) };
        }
    }
    return null;
}

function grantRewardCredits(userId, amountInt, opts = {}) {
    const acc = accounts.findById(userId);
    if (!acc || !Number.isFinite(amountInt) || amountInt <= 0) return { success: false, error: 'bad_request' };
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

module.exports = {
    SUBSCRIPTION_PLANS,
    SIGNUP_INITIAL_CREDITS,
    resolveCreditCost,
    buildPublicUserFromAccount,
    deductAccountUser,
    deductCreditsAuth,
    resolveAuth,
    grantRewardCredits
};
