'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const accounts = require('../lib/accounts');
const community = require('../lib/community-store');
const moderationStore = require('../lib/moderation-store');
const pointLedger = require('../lib/point-ledger');
const { resolveAuth, grantRewardCredits } = require('../lib/credit');
const config = require('../lib/config');

function publicBaseUrl(req) {
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
    const host = req.get('host') || `localhost:${config.PORT}`;
    return `${proto}://${host}`;
}

function resolveLocalAssetPath(rel) {
    if (typeof rel !== 'string' || !rel.startsWith('/')) return null;
    if (rel.includes('..')) return null;
    if (rel.startsWith('/outputs/')) {
        const fn = path.basename(rel);
        const full = path.join(config.OUTPUT_DIR, fn);
        if (fs.existsSync(full)) return { full, rel: `/outputs/${fn}` };
    }
    if (rel.startsWith('/uploads/')) {
        const fn = path.basename(rel);
        const full = path.join(config.UPLOAD_DIR, fn);
        if (fs.existsSync(full)) return { full, rel: `/uploads/${fn}` };
    }
    return null;
}

function workflowFromHistoryProof(proof) {
    if (!proof || typeof proof !== 'object') return null;
    if (proof.mode === 'generate') return 't2i_generate';
    if (proof.workflowTemplate) return String(proof.workflowTemplate);
    if (proof.params && proof.params.workflowTemplate) return String(proof.params.workflowTemplate);
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
    if (key && String(key).length > 0 && req.get('x-admin-key') === String(key)) return true;
    if (req.session && req.session.userId && req.session.authPortal === 'admin') {
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

function executeTopicSettlement(topicId) {
    const built = community.buildSettlementPayouts(topicId);
    if (built.error) return { ok: false, error: built.error };
    for (const row of built.payouts) {
        if (!accounts.findById(row.userId)) return { ok: false, error: 'unknown_user', row };
    }
    const applied = [];
    for (const row of built.payouts) {
        const g = grantRewardCredits(row.userId, row.points, {
            relatedId: topicId,
            remark: `Challenge reward · rank ${row.rank} · post ${row.postId}`
        });
        applied.push({ ...row, ok: g.success, creditsAfter: g.success ? g.credits : null, error: g.success ? null : g.error || null });
        if (!g.success) return { ok: false, error: 'grant_failed', topicId, applied };
    }
    community.markTopicSettled(topicId, { payouts: applied, settledAt: new Date().toISOString() });
    return { ok: true, topicId, payouts: applied };
}

function serializeCommunityPost(req, p, viewerUserId, { includePrompt = false } = {}) {
    const base = publicBaseUrl(req);
    const likeUserIds = p.likeUserIds || [];
    const favoriteUserIds = p.favoriteUserIds || [];
    const nickname = p.user && p.user.nickname;
    const showPrompt = includePrompt && (p.publicPrompt || (viewerUserId && viewerUserId === p.userId));
    return {
        id: p.id, topicId: p.topicId,
        user: { id: p.userId, nickname, avatarUrl: (p.user && p.user.avatarUrl) || null },
        imageUrl: `${base}${p.imageRel}`,
        caption: p.caption, taskType: p.taskType, workflowTemplate: p.workflowTemplate,
        promptSummary: showPrompt ? p.promptSummary : null,
        aiLabel: p.aiLabel !== false, status: p.status,
        likeCount: likeUserIds.length,
        commentCount: (p.comments && p.comments.length) || 0,
        favoriteCount: favoriteUserIds.length,
        score: community.computeScore(p), rank: null,
        liked: viewerUserId ? likeUserIds.includes(viewerUserId) : false,
        favorited: viewerUserId ? favoriteUserIds.includes(viewerUserId) : false,
        createdAt: p.createdAt
    };
}

function serializeAdminPost(req, p) {
    const base = publicBaseUrl(req);
    const likeUserIds = p.likeUserIds || [];
    const favoriteUserIds = p.favoriteUserIds || [];
    return {
        id: p.id, topicId: p.topicId, userId: p.userId, user: p.user,
        imageRel: p.imageRel, thumbRel: p.thumbRel,
        imageUrl: `${base}${p.imageRel}`,
        thumbUrl: p.thumbRel ? `${base}${p.thumbRel}` : `${base}${p.imageRel}`,
        caption: p.caption, taskType: p.taskType, workflowTemplate: p.workflowTemplate,
        promptSummary: p.promptSummary, publicPrompt: p.publicPrompt,
        aiLabel: p.aiLabel !== false, status: p.status,
        likeUserIds: [...likeUserIds], favoriteUserIds: [...favoriteUserIds],
        likeCount: likeUserIds.length, favoriteCount: favoriteUserIds.length,
        commentCount: (p.comments && p.comments.length) || 0,
        comments: p.comments || [], historyProof: p.historyProof,
        score: community.computeScore(p), createdAt: p.createdAt
    };
}

const router = express.Router();

// Topics
router.get('/api/topics', (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 20, 50);
    const { list, ...rest } = community.listTopics({ status, page, pageSize });
    const base = publicBaseUrl(req);
    res.json({
        code: 0, message: 'ok',
        data: {
            list: list.map(t => ({
                id: t.id, title: t.title, tag: t.tag,
                coverUrl: t.coverUrl ? (t.coverUrl.startsWith('http') ? t.coverUrl : `${base}${t.coverUrl}`) : '',
                status: t.status, startAt: t.startAt, endAt: t.endAt,
                postCount: t.postCount, rewardPool: t.rewardPool,
                settlementStatus: t.settlementStatus || 'none'
            })),
            ...rest
        }
    });
});

router.get('/api/topics/:topicId', (req, res) => {
    const t = community.getTopic(req.params.topicId);
    if (!t) return res.status(404).json({ code: 40401, message: 'Topic not found', data: null });
    const auth = resolveAuth(req);
    const viewerId = auth && auth.kind === 'account' ? auth.userId : null;
    res.json({
        code: 0, message: 'ok',
        data: { ...t, mySubmitted: viewerId ? community.userHasPostInTopic(viewerId, t.id) : false }
    });
});

// Posts in topic
router.post('/api/topics/:topicId/posts', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const topic = community.getTopic(req.params.topicId);
    if (!topic) return res.status(404).json({ code: 40401, message: 'Topic not found', data: null });
    if (topic.status !== 'active') return res.status(400).json({ code: 40001, message: 'Topic not active', data: null });
    const now = Date.now();
    if (new Date(topic.startAt).getTime() > now || new Date(topic.endAt).getTime() < now) {
        return res.status(400).json({ code: 40002, message: 'Topic not in time window', data: null });
    }
    if (community.userHasPostInTopic(acc.id, topic.id)) {
        return res.status(409).json({ code: 40901, message: 'Already submitted to this topic', data: null });
    }
    const { caption = '', publicPrompt = false, historyProof } = req.body || {};
    if (!historyProof || typeof historyProof !== 'object') {
        return res.status(400).json({ code: 40003, message: 'historyProof required', data: null });
    }
    const wf = workflowFromHistoryProof(historyProof);
    if (!wf || !topic.allowedTaskTypes.includes(wf)) {
        return res.status(400).json({ code: 40004, message: 'Workflow not allowed for this topic', data: null });
    }
    const outRel = historyProof.outRel || historyProof.imageRel;
    const resolved = resolveLocalAssetPath(outRel);
    if (!resolved) return res.status(400).json({ code: 40005, message: 'Output file not found on server', data: null });
    let thumbRel = resolved.rel;
    if (historyProof.thumbRel) {
        const tr = resolveLocalAssetPath(historyProof.thumbRel);
        if (tr) thumbRel = tr.rel;
    }
    const taskType = String(historyProof.taskType || wf).slice(0, 64);
    const promptSummary = String(historyProof.prompt || historyProof.promptSummary || '').slice(0, 400);
    const post = community.createPost({
        topicId: topic.id, userId: acc.id, nickname: acc.username, avatarUrl: null,
        caption: String(caption || '').slice(0, 500),
        publicPrompt: !!publicPrompt, workflowTemplate: wf, taskType, promptSummary,
        imageRel: resolved.rel, thumbRel,
        historyProof: { historyId: historyProof.historyId, at: historyProof.at, mode: historyProof.mode }
    });
    res.json({ code: 0, message: 'ok', data: { id: post.id, status: post.status } });
});

router.get('/api/topics/:topicId/posts', (req, res) => {
    const topic = community.getTopic(req.params.topicId);
    if (!topic) return res.status(404).json({ code: 40401, message: 'Topic not found', data: null });
    const sort = req.query.sort === 'hot' || req.query.sort === 'rank' ? req.query.sort : 'latest';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 20, 50);
    const { list, ...rest } = community.listPostsForTopic(topic.id, { sort, page, pageSize });
    const auth = resolveAuth(req);
    const viewerId = auth && auth.kind === 'account' ? auth.userId : null;
    res.json({
        code: 0, message: 'ok',
        data: {
            list: list.map(({ post: p, rank }) => {
                const row = serializeCommunityPost(req, p, viewerId, { includePrompt: false });
                row.rank = rank;
                return row;
            }),
            ...rest
        }
    });
});

router.get('/api/topics/:topicId/ranking', (req, res) => {
    const topic = community.getTopic(req.params.topicId);
    if (!topic) return res.status(404).json({ code: 40401, message: 'Topic not found', data: null });
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 50, 100);
    const { list, ...rest } = community.rankingForTopic(topic.id, { page, pageSize });
    const auth = resolveAuth(req);
    const viewerId = auth && auth.kind === 'account' ? auth.userId : null;
    res.json({
        code: 0, message: 'ok',
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

// Posts
router.get('/api/posts/:postId', (req, res) => {
    const p = community.findPost(req.params.postId);
    if (!p || p.status !== 'published') return res.status(404).json({ code: 40402, message: 'Post not found', data: null });
    const auth = resolveAuth(req);
    const viewerId = auth && auth.kind === 'account' ? auth.userId : null;
    const ranked = community.rankingForTopic(p.topicId, { page: 1, pageSize: 5000 });
    const rankMap = new Map(ranked.list.map(x => [x.post.id, x.rank]));
    const row = serializeCommunityPost(req, p, viewerId, { includePrompt: true });
    row.rank = rankMap.get(p.id) || null;
    row.shareCount = 0;
    res.json({ code: 0, message: 'ok', data: row });
});

router.post('/api/posts/:postId/like', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const result = community.setPostLike(req.params.postId, acc.id, true);
    if (!result) return res.status(404).json({ code: 40402, message: 'Post not found', data: null });
    res.json({ code: 0, message: 'ok', data: result });
});

router.delete('/api/posts/:postId/like', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const result = community.setPostLike(req.params.postId, acc.id, false);
    if (!result) return res.status(404).json({ code: 40402, message: 'Post not found', data: null });
    res.json({ code: 0, message: 'ok', data: result });
});

router.post('/api/posts/:postId/comments', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const content = (req.body && req.body.content) || '';
    const c = community.addComment(req.params.postId, { userId: acc.id, nickname: acc.username, content });
    if (c === null) return res.status(404).json({ code: 40402, message: 'Post not found', data: null });
    if (c.error === 'empty') return res.status(400).json({ code: 40006, message: 'Empty comment', data: null });
    res.json({ code: 0, message: 'ok', data: { id: c.id, postId: req.params.postId, content: c.content, status: 'published', createdAt: c.createdAt } });
});

router.get('/api/posts/:postId/comments', (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 20, 50);
    const result = community.listComments(req.params.postId, { page, pageSize });
    if (!result) return res.status(404).json({ code: 40402, message: 'Post not found', data: null });
    res.json({
        code: 0, message: 'ok',
        data: { ...result, list: result.list.map(c => ({ id: c.id, user: c.user, content: c.content, createdAt: c.createdAt })) }
    });
});

router.post('/api/posts/:postId/favorite', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const result = community.setPostFavorite(req.params.postId, acc.id, true);
    if (!result) return res.status(404).json({ code: 40402, message: 'Post not found', data: null });
    res.json({ code: 0, message: 'ok', data: result });
});

router.delete('/api/posts/:postId/favorite', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const result = community.setPostFavorite(req.params.postId, acc.id, false);
    if (!result) return res.status(404).json({ code: 40402, message: 'Post not found', data: null });
    res.json({ code: 0, message: 'ok', data: result });
});

router.post('/api/posts/:postId/report', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const p = community.findPost(req.params.postId);
    if (!p || p.status !== 'published') return res.status(404).json({ code: 40402, message: 'Post not found', data: null });
    const { reason = 'other', note = '' } = req.body || {};
    const r = moderationStore.addReport({ postId: p.id, topicId: p.topicId, reporterUserId: acc.id, reason, note });
    if (r.error === 'duplicate') return res.status(409).json({ code: 40902, message: 'Already reported this post', data: null });
    res.json({ code: 0, message: 'ok', data: { id: r.report.id } });
});

// Point ledger (user-facing)
router.get('/api/auth/point-ledger', (req, res) => {
    const acc = requireSessionAccount(req, res);
    if (!acc) return;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 30, 100);
    const data = pointLedger.listForUser(acc.id, { page, pageSize });
    res.json({ code: 0, message: 'ok', data });
});

// Admin routes
router.get('/api/admin/moderation', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const status = req.query.status ? String(req.query.status) : 'open';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 50, 200);
    const data = moderationStore.listReports({ status, page, pageSize });
    res.json({ code: 0, message: 'ok', data });
});

router.post('/api/admin/moderation/:reportId/resolve', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { resolution = 'reviewed', adminNote = '' } = req.body || {};
    const out = moderationStore.resolveReport(req.params.reportId, { resolution, adminNote });
    if (!out) return res.status(404).json({ code: 40403, message: 'Report not found', data: null });
    if (out.error === 'not_open') return res.status(400).json({ code: 40012, message: 'Report already resolved', data: null });
    res.json({ code: 0, message: 'ok', data: { id: out.report.id, status: out.report.status } });
});

router.post('/api/admin/posts/:postId/hide', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const p = community.setPostHidden(req.params.postId, true);
    if (!p) return res.status(404).json({ code: 40402, message: 'Post not found', data: null });
    res.json({ code: 0, message: 'ok', data: { id: p.id, status: p.status } });
});

router.post('/api/admin/topics/:topicId/settle', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const topicId = req.params.topicId;
    const out = executeTopicSettlement(topicId);
    if (!out.ok) {
        if (out.error === 'not_found') return res.status(404).json({ code: 40401, message: 'Topic not found', data: null });
        if (out.error === 'already_settled') return res.status(400).json({ code: 40010, message: 'Topic already settled', data: null });
        if (out.error === 'topic_not_ended') return res.status(400).json({ code: 40011, message: 'Topic must be ended before settlement', data: null });
        if (out.error === 'unknown_user') return res.status(400).json({ code: 40020, message: `Unknown user in payout: ${out.row.userId}`, data: { row: out.row } });
        if (out.error === 'grant_failed') return res.status(500).json({ code: 50010, message: 'Settlement aborted after partial credit failure', data: { topicId, payouts: out.applied } });
        return res.status(500).json({ code: 50011, message: String(out.error), data: out });
    }
    res.json({ code: 0, message: 'ok', data: { topicId, payouts: out.payouts } });
});

router.get('/api/admin/summary', (req, res) => {
    if (!requireAdmin(req, res)) return;
    community.syncTopicLifecycle();
    const data = community.getAdminSummary();
    res.json({ code: 0, message: 'ok', data });
});

router.get('/api/admin/users', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const data = accounts.load();
    const list = (data.users || []).map(u => ({
        id: u.id, email: u.email, username: u.username, plan: u.plan,
        role: u.role || null, credits: u.credits, createdAt: u.createdAt
    }));
    res.json({ code: 0, message: 'ok', data: { list } });
});

router.get('/api/admin/topics', (req, res) => {
    if (!requireAdmin(req, res)) return;
    community.syncTopicLifecycle();
    const status = req.query.status ? String(req.query.status) : undefined;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 100, 200);
    const { list, ...rest } = community.listTopics({ status, page, pageSize });
    const base = publicBaseUrl(req);
    res.json({
        code: 0, message: 'ok',
        data: {
            list: list.map(t => ({
                ...t,
                coverUrl: t.coverUrl ? (String(t.coverUrl).startsWith('http') ? t.coverUrl : `${base}${t.coverUrl}`) : ''
            })),
            ...rest
        }
    });
});

router.get('/api/admin/topics/:topicId/posts', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const t = community.getTopic(req.params.topicId);
    if (!t) return res.status(404).json({ code: 40401, message: 'Topic not found', data: null });
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 50, 200);
    const { list, ...rest } = community.listPostsForTopicAdmin(t.id, { page, pageSize });
    const base = publicBaseUrl(req);
    res.json({
        code: 0, message: 'ok',
        data: {
            list: list.map(p => ({
                id: p.id, topicId: p.topicId, userId: p.userId, user: p.user,
                imageUrl: `${base}${p.imageRel}`,
                thumbUrl: p.thumbRel ? `${base}${p.thumbRel}` : `${base}${p.imageRel}`,
                caption: p.caption, status: p.status, taskType: p.taskType,
                promptSummary: p.promptSummary, publicPrompt: p.publicPrompt,
                commentCount: (p.comments && p.comments.length) || 0,
                createdAt: p.createdAt
            })),
            ...rest
        }
    });
});

router.get('/api/admin/posts/:postId', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const p = community.findPost(req.params.postId);
    if (!p) return res.status(404).json({ code: 40402, message: 'Post not found', data: null });
    res.json({ code: 0, message: 'ok', data: serializeAdminPost(req, p) });
});

router.get('/api/admin/ledger', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 50, 200);
    const data = pointLedger.listAll({ page, pageSize });
    res.json({ code: 0, message: 'ok', data });
});

module.exports = { router, executeTopicSettlement, isAdminRequest };
