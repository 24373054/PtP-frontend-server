'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { v4: uuidv4 } = require('uuid');

/** node:sqlite 无 db.transaction，用 BEGIN/COMMIT 对齐原 better-sqlite3 迁移逻辑 */
function dbTransaction(db, fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
        fn();
        db.exec('COMMIT');
    } catch (e) {
        try {
            db.exec('ROLLBACK');
        } catch (_) {
            /* ignore */
        }
        throw e;
    }
}

const ROOT = path.join(__dirname, '..');
const DATA_DIR =
    process.env.IMAGEFORGE_DATA_DIR || path.join(ROOT, 'data');
const DB_PATH =
    process.env.IMAGEFORGE_DB_PATH || path.join(DATA_DIR, 'imageforge.sqlite');
const LEGACY_COMMUNITY = path.join(ROOT, 'community.json');
const LEGACY_LEDGER = path.join(ROOT, 'point_ledger.json');
const LEGACY_MODERATION = path.join(ROOT, 'moderation.json');

const OPEN_CHALLENGE_TYPES = [
    'img2img_style',
    'image_upscale',
    'background_repaint',
    'jewelry_retouch',
    'jewelry_product_cutout',
    'jewelry_scene',
    'jewelry_macro_detail',
    't2i_generate'
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tag TEXT,
  description TEXT,
  cover_url TEXT,
  status TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  allowed_task_types TEXT NOT NULL,
  reward_rules TEXT NOT NULL,
  reward_pool INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  settlement_status TEXT DEFAULT 'none',
  settlement_completed_at TEXT,
  settlement_summary TEXT,
  score_like_w REAL DEFAULT 10,
  score_comment_w REAL DEFAULT 5,
  score_decay_half_life_hours REAL DEFAULT 168,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_json TEXT NOT NULL,
  image_rel TEXT NOT NULL,
  thumb_rel TEXT,
  caption TEXT,
  task_type TEXT,
  workflow_template TEXT,
  prompt_summary TEXT,
  public_prompt INTEGER DEFAULT 0,
  ai_label INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published',
  like_user_ids TEXT DEFAULT '[]',
  favorite_user_ids TEXT DEFAULT '[]',
  comments_json TEXT DEFAULT '[]',
  history_proof TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES topics(id)
);

CREATE INDEX IF NOT EXISTS idx_posts_topic_status ON posts(topic_id, status);

CREATE TABLE IF NOT EXISTS moderation_reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  topic_id TEXT,
  reporter_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution TEXT,
  admin_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON moderation_reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS point_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  related_id TEXT,
  remark TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_user_time ON point_ledger(user_id, created_at DESC);
`;

const ALLOWED_REASONS = new Set([
    'spam',
    'copyright',
    'illegal',
    'harassment',
    'cheating',
    'other'
]);

let _db = null;
let _inited = false;

function defaultTopics() {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    const start = new Date();
    return [
        {
            id: 'topic_open_v1',
            settlementStatus: 'none',
            title: 'ImageForge 开放挑战 · 全工具',
            tag: 'Open',
            description:
                '使用本平台任意编辑或生成功能完成作品并投稿。公开作品将显示 AI 生成/编辑标识。',
            coverUrl: '',
            status: 'active',
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            allowedTaskTypes: [...OPEN_CHALLENGE_TYPES],
            rewardRules: [
                { rankStart: 1, rankEnd: 1, points: 500 },
                { rankStart: 2, rankEnd: 5, points: 200 },
                { rankStart: 6, rankEnd: 20, points: 50 }
            ],
            rewardPool: 10000,
            postCount: 0,
            createdAt: start.toISOString()
        },
        {
            id: 'topic_jewelry_cutout_v1',
            settlementStatus: 'none',
            title: '珠宝白底图挑战',
            tag: 'Jewelry',
            description: '仅限「抠图白底 / jewelry_product_cutout」工作流作品参赛。',
            coverUrl: '',
            status: 'active',
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            allowedTaskTypes: ['jewelry_product_cutout'],
            rewardRules: [
                { rankStart: 1, rankEnd: 3, points: 300 },
                { rankStart: 4, rankEnd: 10, points: 80 }
            ],
            rewardPool: 5000,
            postCount: 0,
            createdAt: start.toISOString()
        },
        {
            id: 'topic_jewelry_scene_v1',
            settlementStatus: 'none',
            title: '轻奢场景合成挑战',
            tag: 'Scene',
            description: '仅限「场景合成」或「珠宝精修」工作流。',
            coverUrl: '',
            status: 'active',
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            allowedTaskTypes: ['jewelry_scene', 'jewelry_retouch'],
            rewardRules: [
                { rankStart: 1, rankEnd: 1, points: 800 },
                { rankStart: 2, rankEnd: 5, points: 200 }
            ],
            rewardPool: 8000,
            postCount: 0,
            createdAt: start.toISOString()
        }
    ];
}

function rowToTopic(r) {
    if (!r) return null;
    let settlementSummary = null;
    if (r.settlement_summary) {
        try {
            settlementSummary = JSON.parse(r.settlement_summary);
        } catch (_) {
            settlementSummary = r.settlement_summary;
        }
    }
    return {
        id: r.id,
        title: r.title,
        tag: r.tag,
        description: r.description,
        coverUrl: r.cover_url || '',
        status: r.status,
        startAt: r.start_at,
        endAt: r.end_at,
        allowedTaskTypes: JSON.parse(r.allowed_task_types || '[]'),
        rewardRules: JSON.parse(r.reward_rules || '[]'),
        rewardPool: r.reward_pool,
        postCount: r.post_count,
        settlementStatus: r.settlement_status || 'none',
        settlementCompletedAt: r.settlement_completed_at || null,
        settlementSummary,
        scoreLikeW: r.score_like_w,
        scoreCommentW: r.score_comment_w,
        scoreDecayHalfLifeHours: r.score_decay_half_life_hours,
        createdAt: r.created_at
    };
}

function rowToPost(r) {
    if (!r) return null;
    let historyProof = null;
    if (r.history_proof) {
        try {
            historyProof = JSON.parse(r.history_proof);
        } catch (_) {
            historyProof = r.history_proof;
        }
    }
    return {
        id: r.id,
        topicId: r.topic_id,
        userId: r.user_id,
        user: JSON.parse(r.user_json || '{}'),
        imageRel: r.image_rel,
        thumbRel: r.thumb_rel || r.image_rel,
        caption: r.caption || '',
        taskType: r.task_type,
        workflowTemplate: r.workflow_template,
        promptSummary: r.prompt_summary || '',
        publicPrompt: !!r.public_prompt,
        aiLabel: r.ai_label !== 0,
        status: r.status,
        likeUserIds: JSON.parse(r.like_user_ids || '[]'),
        favoriteUserIds: JSON.parse(r.favorite_user_ids || '[]'),
        comments: JSON.parse(r.comments_json || '[]'),
        historyProof,
        createdAt: r.created_at
    };
}

function topicToRow(t) {
    return {
        id: t.id,
        title: t.title,
        tag: t.tag || '',
        description: t.description || '',
        cover_url: t.coverUrl || '',
        status: t.status,
        start_at: t.startAt,
        end_at: t.endAt,
        allowed_task_types: JSON.stringify(t.allowedTaskTypes || []),
        reward_rules: JSON.stringify(t.rewardRules || []),
        reward_pool: t.rewardPool != null ? t.rewardPool : 0,
        post_count: t.postCount != null ? t.postCount : 0,
        settlement_status: t.settlementStatus || 'none',
        settlement_completed_at: t.settlementCompletedAt || null,
        settlement_summary: t.settlementSummary
            ? JSON.stringify(t.settlementSummary)
            : null,
        score_like_w: t.scoreLikeW != null ? t.scoreLikeW : 10,
        score_comment_w: t.scoreCommentW != null ? t.scoreCommentW : 5,
        score_decay_half_life_hours:
            t.scoreDecayHalfLifeHours != null ? t.scoreDecayHalfLifeHours : 168,
        created_at: t.createdAt || new Date().toISOString()
    };
}

function postToBindings(p) {
    return {
        id: p.id,
        topic_id: p.topicId,
        user_id: p.userId,
        user_json: JSON.stringify(p.user || { id: p.userId }),
        image_rel: p.imageRel,
        thumb_rel: p.thumbRel || p.imageRel,
        caption: p.caption || '',
        task_type: p.taskType || null,
        workflow_template: p.workflowTemplate || null,
        prompt_summary: p.promptSummary || '',
        public_prompt: p.publicPrompt ? 1 : 0,
        ai_label: p.aiLabel !== false ? 1 : 0,
        status: p.status || 'published',
        like_user_ids: JSON.stringify(p.likeUserIds || []),
        favorite_user_ids: JSON.stringify(p.favoriteUserIds || []),
        comments_json: JSON.stringify(p.comments || []),
        history_proof:
            p.historyProof != null ? JSON.stringify(p.historyProof) : null,
        created_at: p.createdAt
    };
}

function recomputePostCountsDb(db) {
    db.prepare(
        `
    UPDATE topics SET post_count = (
      SELECT COUNT(*) FROM posts po
      WHERE po.topic_id = topics.id AND po.status = 'published'
    )
    `
    ).run();
}

function syncTopicLifecycleDb(db) {
    const nowIso = new Date().toISOString();
    const info = db
        .prepare(
            `UPDATE topics SET status = 'ended'
       WHERE status = 'active' AND end_at < ?`
        )
        .run(nowIso);
    return info.changes > 0;
}

function upsertTopic(db, t) {
    const x = topicToRow(migrateTopic(t));
    db.prepare(
        `
    INSERT INTO topics (
      id, title, tag, description, cover_url, status, start_at, end_at,
      allowed_task_types, reward_rules, reward_pool, post_count,
      settlement_status, settlement_completed_at, settlement_summary,
      score_like_w, score_comment_w, score_decay_half_life_hours, created_at
    ) VALUES (
      @id, @title, @tag, @description, @cover_url, @status, @start_at, @end_at,
      @allowed_task_types, @reward_rules, @reward_pool, @post_count,
      @settlement_status, @settlement_completed_at, @settlement_summary,
      @score_like_w, @score_comment_w, @score_decay_half_life_hours, @created_at
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      tag = excluded.tag,
      description = excluded.description,
      cover_url = excluded.cover_url,
      status = excluded.status,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      allowed_task_types = excluded.allowed_task_types,
      reward_rules = excluded.reward_rules,
      reward_pool = excluded.reward_pool,
      post_count = excluded.post_count,
      settlement_status = excluded.settlement_status,
      settlement_completed_at = excluded.settlement_completed_at,
      settlement_summary = excluded.settlement_summary,
      score_like_w = excluded.score_like_w,
      score_comment_w = excluded.score_comment_w,
      score_decay_half_life_hours = excluded.score_decay_half_life_hours
    `
    ).run(x);
}

function insertPostDb(db, p) {
    const b = postToBindings(migratePost(p));
    db.prepare(
        `
    INSERT OR REPLACE INTO posts (
      id, topic_id, user_id, user_json, image_rel, thumb_rel, caption,
      task_type, workflow_template, prompt_summary, public_prompt, ai_label,
      status, like_user_ids, favorite_user_ids, comments_json, history_proof, created_at
    ) VALUES (
      @id, @topic_id, @user_id, @user_json, @image_rel, @thumb_rel, @caption,
      @task_type, @workflow_template, @prompt_summary, @public_prompt, @ai_label,
      @status, @like_user_ids, @favorite_user_ids, @comments_json, @history_proof, @created_at
    )
    `
    ).run(b);
}

function migrateCommunityJsonIfEmpty(db) {
    const n = db.prepare('SELECT COUNT(*) AS c FROM topics').get().c;
    if (n > 0) return;
    if (!fs.existsSync(LEGACY_COMMUNITY)) {
        for (const t of defaultTopics()) upsertTopic(db, t);
        return;
    }
    try {
        const j = JSON.parse(fs.readFileSync(LEGACY_COMMUNITY, 'utf8'));
        const topics = Array.isArray(j.topics) ? j.topics : [];
        const posts = Array.isArray(j.posts) ? j.posts : [];
        if (!topics.length) {
            for (const t of defaultTopics()) upsertTopic(db, t);
        } else {
            for (const t of topics) upsertTopic(db, t);
            for (const p of posts) {
                const row = legacyPostToRow(p);
                if (row) insertPostDb(db, row);
            }
        }
    } catch (_) {
        for (const t of defaultTopics()) upsertTopic(db, t);
    }
    recomputePostCountsDb(db);
}

function legacyPostToRow(p) {
    if (!p || !p.topicId || !p.userId) return null;
    migratePost(p);
    return {
        id: p.id || `post_${uuidv4()}`,
        topicId: p.topicId,
        userId: p.userId,
        user: p.user || { id: p.userId, nickname: p.userId, avatarUrl: null },
        imageRel: p.imageRel || p.images?.[0] || '',
        thumbRel: p.thumbRel || p.imageRel || p.images?.[0] || '',
        caption: p.caption || p.title || '',
        taskType: p.taskType || null,
        workflowTemplate: p.workflowTemplate || p.workflowSnapshot || null,
        promptSummary: p.promptSummary || (p.prompt ? String(p.prompt).slice(0, 400) : ''),
        publicPrompt: !!p.publicPrompt,
        aiLabel: p.aiLabel !== false,
        status: p.status || 'published',
        likeUserIds: p.likeUserIds || p.likedBy || [],
        favoriteUserIds: p.favoriteUserIds || [],
        comments: p.comments || [],
        historyProof: p.historyProof || null,
        createdAt: p.createdAt || new Date().toISOString()
    };
}

function migrateLedgerJsonIfEmpty(db) {
    const n = db.prepare('SELECT COUNT(*) AS c FROM point_ledger').get().c;
    if (n > 0) return;
    if (!fs.existsSync(LEGACY_LEDGER)) return;
    try {
        const j = JSON.parse(fs.readFileSync(LEGACY_LEDGER, 'utf8'));
        const entries = Array.isArray(j.entries) ? j.entries : [];
        const ins = db.prepare(
            `
      INSERT OR IGNORE INTO point_ledger
      (id, user_id, type, amount, balance_after, related_id, remark, created_at)
      VALUES (@id, @user_id, @type, @amount, @balance_after, @related_id, @remark, @created_at)
    `
        );
        dbTransaction(db, () => {
            for (const e of entries) {
                ins.run({
                    id: e.id || `pl_${uuidv4()}`,
                    user_id: e.userId,
                    type: e.type,
                    amount: e.amount,
                    balance_after: e.balanceAfter,
                    related_id: e.relatedId || null,
                    remark: e.remark || null,
                    created_at: e.createdAt || new Date().toISOString()
                });
            }
        });
    } catch (_) {}
}

function migrateModerationJsonIfEmpty(db) {
    const n = db.prepare('SELECT COUNT(*) AS c FROM moderation_reports').get().c;
    if (n > 0) return;
    if (!fs.existsSync(LEGACY_MODERATION)) return;
    try {
        const j = JSON.parse(fs.readFileSync(LEGACY_MODERATION, 'utf8'));
        const reports = Array.isArray(j.reports) ? j.reports : [];
        const ins = db.prepare(
            `
      INSERT OR IGNORE INTO moderation_reports
      (id, post_id, topic_id, reporter_user_id, reason, note, status, created_at, resolved_at, resolution, admin_note)
      VALUES (@id, @post_id, @topic_id, @reporter_user_id, @reason, @note, @status, @created_at, @resolved_at, @resolution, @admin_note)
    `
        );
        dbTransaction(db, () => {
            for (const r of reports) {
                ins.run({
                    id: r.id || `rep_${uuidv4()}`,
                    post_id: r.postId,
                    topic_id: r.topicId || null,
                    reporter_user_id: r.reporterUserId,
                    reason: r.reason,
                    note: r.note || null,
                    status: r.status || 'open',
                    created_at: r.createdAt || new Date().toISOString(),
                    resolved_at: r.resolvedAt || null,
                    resolution: r.resolution || null,
                    admin_note: r.adminNote || null
                });
            }
        });
    } catch (_) {}
}

function init() {
    if (_inited) return _db;
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL;');
    _db.exec(SCHEMA);
    migrateCommunityJsonIfEmpty(_db);
    migrateLedgerJsonIfEmpty(_db);
    migrateModerationJsonIfEmpty(_db);
    syncTopicLifecycleDb(_db);
    recomputePostCountsDb(_db);
    _inited = true;
    return _db;
}

function getDb() {
    if (!_db) init();
    return _db;
}

function migrateTopic(t) {
    if (!t.settlementStatus) t.settlementStatus = 'none';
    return t;
}

function migratePost(p) {
    if (!p.favoriteUserIds) p.favoriteUserIds = [];
    if (!p.status) p.status = 'published';
    if (!p.likeUserIds) p.likeUserIds = [];
    if (!p.comments) p.comments = [];
    return p;
}

function resolveRewardPoints(rewardRules, rank) {
    if (!rewardRules || !Array.isArray(rewardRules)) return 0;
    for (const rule of rewardRules) {
        const a = Number(rule.rankStart);
        const b = Number(rule.rankEnd);
        const pts = Number(rule.points);
        if (rank >= a && rank <= b && pts > 0) return pts;
    }
    return 0;
}

function computeScore(p, topicOpt) {
    const db = getDb();
    const topic =
        topicOpt ||
        rowToTopic(
            db.prepare('SELECT * FROM topics WHERE id = ?').get(p.topicId)
        );
    const likeW =
        topic && Number.isFinite(topic.scoreLikeW) ? topic.scoreLikeW : 10;
    const commentW =
        topic && Number.isFinite(topic.scoreCommentW) ? topic.scoreCommentW : 5;
    let halfLife = 168;
    if (
        topic &&
        Number.isFinite(topic.scoreDecayHalfLifeHours) &&
        topic.scoreDecayHalfLifeHours > 0
    ) {
        halfLife = topic.scoreDecayHalfLifeHours;
    }
    const likes = (p.likeUserIds && p.likeUserIds.length) || 0;
    const comments = (p.comments && p.comments.length) || 0;
    const base = likes * likeW + comments * commentW;
    const ageH =
        (Date.now() - new Date(p.createdAt).getTime()) / 3600000;
    const factor = Math.exp(-Math.max(0, ageH) / halfLife);
    return base * factor;
}

function sortPosts(arr, sort, topicId) {
    const db = getDb();
    const topic = topicId
        ? rowToTopic(db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId))
        : null;
    const scoreFn = (p) => computeScore(p, topic);
    const out = arr.slice();
    if (sort === 'hot' || sort === 'rank') {
        out.sort(
            (a, b) =>
                scoreFn(b) - scoreFn(a) ||
                new Date(b.createdAt) - new Date(a.createdAt)
        );
    } else {
        out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return out;
}

function syncTopicLifecycle() {
    const db = getDb();
    const ch = syncTopicLifecycleDb(db);
    return ch;
}

function buildSettlementPayouts(topicId) {
    const topic = getTopic(topicId);
    if (!topic) return { error: 'not_found' };
    if (topic.settlementStatus === 'completed') {
        return { error: 'already_settled' };
    }
    if (topic.status !== 'ended') {
        return { error: 'topic_not_ended' };
    }
    const { list } = rankingForTopic(topicId, { page: 1, pageSize: 5000 });
    const payouts = [];
    for (const row of list) {
        const { post, rank } = row;
        const points = resolveRewardPoints(topic.rewardRules, rank);
        if (points > 0) {
            payouts.push({
                userId: post.userId,
                postId: post.id,
                rank,
                points
            });
        }
    }
    return { topic, payouts };
}

function markTopicSettled(topicId, summary) {
    const db = getDb();
    const t = db.prepare('SELECT id FROM topics WHERE id = ?').get(topicId);
    if (!t) return null;
    db.prepare(
        `
    UPDATE topics SET
      settlement_status = 'completed',
      settlement_completed_at = ?,
      settlement_summary = ?
    WHERE id = ?
  `
    ).run(
        new Date().toISOString(),
        JSON.stringify(summary),
        topicId
    );
    return getTopic(topicId);
}

function setPostHidden(postId, hidden) {
    const db = getDb();
    const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!p) return null;
    const status = hidden ? 'hidden' : 'published';
    db.prepare('UPDATE posts SET status = ? WHERE id = ?').run(status, postId);
    recomputePostCountsDb(db);
    return rowToPost(db.prepare('SELECT * FROM posts WHERE id = ?').get(postId));
}

function setPostFavorite(postId, userId, want) {
    const db = getDb();
    const r = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!r || r.status !== 'published') return null;
    const p = rowToPost(r);
    migratePost(p);
    const set = new Set(p.favoriteUserIds || []);
    if (want) set.add(userId);
    else set.delete(userId);
    p.favoriteUserIds = [...set];
    db.prepare('UPDATE posts SET favorite_user_ids = ? WHERE id = ?').run(
        JSON.stringify(p.favoriteUserIds),
        postId
    );
    return {
        postId,
        favorited: want,
        favoriteCount: p.favoriteUserIds.length
    };
}

function listTopics({ status, page = 1, pageSize = 20 } = {}) {
    const db = getDb();
    syncTopicLifecycleDb(db);
    let rows = db.prepare('SELECT * FROM topics ORDER BY created_at ASC').all();
    if (status) rows = rows.filter((t) => t.status === status);
    const total = rows.length;
    const start = (Math.max(1, page) - 1) * pageSize;
    const slice = rows.slice(start, start + pageSize);
    return {
        list: slice.map(rowToTopic),
        page: Math.max(1, page),
        pageSize,
        total,
        hasMore: start + slice.length < total
    };
}

function getTopic(topicId) {
    const db = getDb();
    return rowToTopic(
        db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId)
    );
}

function listTopicsAwaitingSettlement() {
    const db = getDb();
    syncTopicLifecycleDb(db);
    return db
        .prepare(
            `SELECT id FROM topics WHERE status = 'ended' AND settlement_status = 'none'`
        )
        .all()
        .map((r) => r.id);
}

function getAdminSummary() {
    const db = getDb();
    syncTopicLifecycleDb(db);
    const openReports = db
        .prepare(`SELECT COUNT(*) AS c FROM moderation_reports WHERE status = 'open'`)
        .get().c;
    const pending = listTopicsAwaitingSettlement();
    const topicCount = db.prepare('SELECT COUNT(*) AS c FROM topics').get().c;
    const postCount = db
        .prepare(`SELECT COUNT(*) AS c FROM posts WHERE status = 'published'`)
        .get().c;
    const ledgerRows = db.prepare('SELECT COUNT(*) AS c FROM point_ledger').get().c;
    return {
        openReports,
        pendingSettlementTopicIds: pending,
        pendingSettlementCount: pending.length,
        topicCount,
        publishedPostCount: postCount,
        ledgerEntryCount: ledgerRows,
        dbPath: DB_PATH
    };
}

function userHasPostInTopic(userId, topicId) {
    const db = getDb();
    const r = db
        .prepare(
            `SELECT 1 FROM posts WHERE topic_id = ? AND user_id = ? AND status = 'published' LIMIT 1`
        )
        .get(topicId, userId);
    return !!r;
}

/** 管理端：含 hidden 等全部状态，按时间倒序 */
function listPostsForTopicAdmin(topicId, { page = 1, pageSize = 50 } = {}) {
    const db = getDb();
    const all = db
        .prepare(
            `SELECT * FROM posts WHERE topic_id = ? ORDER BY created_at DESC`
        )
        .all(topicId)
        .map(rowToPost);
    const total = all.length;
    const start = (Math.max(1, page) - 1) * pageSize;
    const slice = all.slice(start, start + pageSize);
    return {
        list: slice,
        page: Math.max(1, page),
        pageSize,
        total,
        hasMore: start + slice.length < total
    };
}

function listPostsForTopic(topicId, { sort = 'latest', page = 1, pageSize = 20 } = {}) {
    const db = getDb();
    let filtered = db
        .prepare(
            `SELECT * FROM posts WHERE topic_id = ? AND status = 'published'`
        )
        .all(topicId)
        .map(rowToPost);
    filtered = sortPosts(filtered, sort, topicId);
    const total = filtered.length;
    const start = (Math.max(1, page) - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    const ranked = sortPosts(
        db
            .prepare(
                `SELECT * FROM posts WHERE topic_id = ? AND status = 'published'`
            )
            .all(topicId)
            .map(rowToPost),
        'rank',
        topicId
    );
    const rankMap = new Map();
    ranked.forEach((p, i) => rankMap.set(p.id, i + 1));
    return {
        list: slice.map((p) => ({ post: p, rank: rankMap.get(p.id) || null })),
        page: Math.max(1, page),
        pageSize,
        total,
        hasMore: start + slice.length < total
    };
}

function rankingForTopic(topicId, { page = 1, pageSize = 50 } = {}) {
    const db = getDb();
    let filtered = db
        .prepare(
            `SELECT * FROM posts WHERE topic_id = ? AND status = 'published'`
        )
        .all(topicId)
        .map(rowToPost);
    filtered = sortPosts(filtered, 'rank', topicId);
    const total = filtered.length;
    const start = (Math.max(1, page) - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    const list = slice.map((p, i) => ({
        post: p,
        rank: start + i + 1,
        score: computeScore(p, getTopic(topicId))
    }));
    return {
        list,
        page: Math.max(1, page),
        pageSize,
        total,
        hasMore: start + slice.length < total
    };
}

function findPost(postId) {
    const db = getDb();
    return rowToPost(db.prepare('SELECT * FROM posts WHERE id = ?').get(postId));
}

function createPost(payload) {
    const db = getDb();
    const id = `post_${uuidv4()}`;
    const now = new Date().toISOString();
    const row = {
        id,
        topicId: payload.topicId,
        userId: payload.userId,
        user: {
            id: payload.userId,
            nickname: payload.nickname,
            avatarUrl: payload.avatarUrl || null
        },
        imageRel: payload.imageRel,
        thumbRel: payload.thumbRel || payload.imageRel,
        caption: String(payload.caption || '').slice(0, 500),
        taskType: payload.taskType,
        workflowTemplate: payload.workflowTemplate,
        promptSummary: String(payload.promptSummary || '').slice(0, 400),
        publicPrompt: !!payload.publicPrompt,
        aiLabel: true,
        status: 'published',
        likeUserIds: [],
        favoriteUserIds: [],
        comments: [],
        createdAt: now,
        historyProof: payload.historyProof || null
    };
    insertPostDb(db, row);
    recomputePostCountsDb(db);
    return row;
}

function setPostLike(postId, userId, wantLiked) {
    const db = getDb();
    const r = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!r || r.status !== 'published') return null;
    const p = rowToPost(r);
    const set = new Set(p.likeUserIds || []);
    if (wantLiked) set.add(userId);
    else set.delete(userId);
    p.likeUserIds = [...set];
    db.prepare('UPDATE posts SET like_user_ids = ? WHERE id = ?').run(
        JSON.stringify(p.likeUserIds),
        postId
    );
    return {
        postId,
        liked: wantLiked,
        likeCount: p.likeUserIds.length
    };
}

function addComment(postId, { userId, nickname, content }) {
    const db = getDb();
    const r = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!r || r.status !== 'published') return null;
    const p = rowToPost(r);
    const text = String(content || '').trim().slice(0, 1000);
    if (!text) return { error: 'empty' };
    const c = {
        id: `cmt_${uuidv4()}`,
        userId,
        user: { id: userId, nickname, avatarUrl: null },
        content: text,
        createdAt: new Date().toISOString()
    };
    p.comments = p.comments || [];
    p.comments.push(c);
    db.prepare('UPDATE posts SET comments_json = ? WHERE id = ?').run(
        JSON.stringify(p.comments),
        postId
    );
    return c;
}

function listComments(postId, { page = 1, pageSize = 20 } = {}) {
    const p = findPost(postId);
    if (!p) return null;
    const all = (p.comments || []).slice().sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const total = all.length;
    const start = (Math.max(1, page) - 1) * pageSize;
    const slice = all.slice(start, start + pageSize);
    return {
        list: slice,
        page: Math.max(1, page),
        pageSize,
        total,
        hasMore: start + slice.length < total
    };
}

function loadSnapshot() {
    const db = getDb();
    const topics = db.prepare('SELECT * FROM topics').all().map(rowToTopic);
    const posts = db.prepare('SELECT * FROM posts').all().map(rowToPost);
    return { topics, posts };
}

function saveSnapshotNoOp() {
    /* SQLite 为单一数据源；保留函数避免旧调用崩溃 */
}

function ledgerAppendEntry(row) {
    const db = getDb();
    const entry = {
        id: `pl_${uuidv4()}`,
        userId: row.userId,
        type: row.type,
        amount: row.amount,
        balanceAfter: row.balanceAfter,
        relatedId: row.relatedId || null,
        remark: row.remark ? String(row.remark).slice(0, 500) : null,
        createdAt: new Date().toISOString()
    };
    db.prepare(
        `
    INSERT INTO point_ledger (id, user_id, type, amount, balance_after, related_id, remark, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
    ).run(
        entry.id,
        entry.userId,
        entry.type,
        entry.amount,
        entry.balanceAfter,
        entry.relatedId,
        entry.remark,
        entry.createdAt
    );
    return entry;
}

function ledgerListAll({ page = 1, pageSize = 50 } = {}) {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) AS c FROM point_ledger').get().c;
    const start = (Math.max(1, page) - 1) * pageSize;
    const rows = db
        .prepare(
            `
    SELECT * FROM point_ledger
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `
        )
        .all(pageSize, start);
    const list = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        type: r.type,
        amount: r.amount,
        balanceAfter: r.balance_after,
        relatedId: r.related_id,
        remark: r.remark,
        createdAt: r.created_at
    }));
    return {
        list,
        page: Math.max(1, page),
        pageSize,
        total,
        hasMore: start + list.length < total
    };
}

function ledgerListForUser(userId, { page = 1, pageSize = 30 } = {}) {
    const db = getDb();
    const total = db
        .prepare('SELECT COUNT(*) AS c FROM point_ledger WHERE user_id = ?')
        .get(userId).c;
    const start = (Math.max(1, page) - 1) * pageSize;
    const rows = db
        .prepare(
            `
    SELECT * FROM point_ledger WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `
        )
        .all(userId, pageSize, start);
    const list = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        type: r.type,
        amount: r.amount,
        balanceAfter: r.balance_after,
        relatedId: r.related_id,
        remark: r.remark,
        createdAt: r.created_at
    }));
    return {
        list,
        page: Math.max(1, page),
        pageSize,
        total,
        hasMore: start + list.length < total
    };
}

function modAddReport({
    postId,
    topicId,
    reporterUserId,
    reason,
    note
}) {
    const db = getDb();
    const r = String(reason || 'other').toLowerCase();
    const reasonNorm = ALLOWED_REASONS.has(r) ? r : 'other';
    const dup = db
        .prepare(
            `
    SELECT 1 FROM moderation_reports
    WHERE post_id = ? AND reporter_user_id = ? AND status = 'open' LIMIT 1
  `
        )
        .get(postId, reporterUserId);
    if (dup) return { error: 'duplicate' };
    const row = {
        id: `rep_${uuidv4()}`,
        postId,
        topicId: topicId || null,
        reporterUserId,
        reason: reasonNorm,
        note: String(note || '').slice(0, 2000),
        status: 'open',
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolution: null,
        adminNote: null
    };
    db.prepare(
        `
    INSERT INTO moderation_reports
    (id, post_id, topic_id, reporter_user_id, reason, note, status, created_at, resolved_at, resolution, admin_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    ).run(
        row.id,
        row.postId,
        row.topicId,
        row.reporterUserId,
        row.reason,
        row.note,
        row.status,
        row.createdAt,
        null,
        null,
        null
    );
    return { report: row };
}

function modListReports({ status = 'open', page = 1, pageSize = 50 } = {}) {
    const db = getDb();
    let rows = db
        .prepare(`SELECT * FROM moderation_reports ORDER BY created_at DESC`)
        .all();
    if (status === 'open') rows = rows.filter((x) => x.status === 'open');
    else if (status !== 'all') {
        rows = rows.filter((x) => x.status === status);
    }
    const total = rows.length;
    const start = (Math.max(1, page) - 1) * pageSize;
    const slice = rows.slice(start, start + pageSize);
    const list = slice.map((x) => ({
        id: x.id,
        postId: x.post_id,
        topicId: x.topic_id,
        reporterUserId: x.reporter_user_id,
        reason: x.reason,
        note: x.note,
        status: x.status,
        createdAt: x.created_at,
        resolvedAt: x.resolved_at,
        resolution: x.resolution,
        adminNote: x.admin_note
    }));
    return {
        list,
        page: Math.max(1, page),
        pageSize,
        total,
        hasMore: start + list.length < total
    };
}

function modResolveReport(reportId, { resolution, adminNote }) {
    const db = getDb();
    const row = db
        .prepare(`SELECT * FROM moderation_reports WHERE id = ?`)
        .get(reportId);
    if (!row) return null;
    if (row.status !== 'open') return { error: 'not_open' };
    const now = new Date().toISOString();
    db.prepare(
        `
    UPDATE moderation_reports SET
      status = 'resolved',
      resolved_at = ?,
      resolution = ?,
      admin_note = ?
    WHERE id = ?
  `
    ).run(
        now,
        String(resolution || 'reviewed').slice(0, 64),
        String(adminNote || '').slice(0, 2000),
        reportId
    );
    const next = db
        .prepare(`SELECT * FROM moderation_reports WHERE id = ?`)
        .get(reportId);
    const report = {
        id: next.id,
        postId: next.post_id,
        topicId: next.topic_id,
        reporterUserId: next.reporter_user_id,
        reason: next.reason,
        note: next.note,
        status: next.status,
        createdAt: next.created_at,
        resolvedAt: next.resolved_at,
        resolution: next.resolution,
        adminNote: next.admin_note
    };
    return { report };
}

const communityExports = {
    DATA_FILE: LEGACY_COMMUNITY,
    OPEN_CHALLENGE_TYPES,
    load: loadSnapshot,
    save: saveSnapshotNoOp,
    listTopics,
    getTopic,
    userHasPostInTopic,
    listPostsForTopic,
    rankingForTopic,
    findPost,
    createPost,
    setPostLike,
    addComment,
    listComments,
    computeScore,
    syncTopicLifecycle,
    migrateTopic,
    migratePost,
    resolveRewardPoints,
    buildSettlementPayouts,
    markTopicSettled,
    setPostHidden,
    setPostFavorite,
    listTopicsAwaitingSettlement,
    getAdminSummary,
    listPostsForTopicAdmin
};

module.exports = {
    init,
    getDb,
    DB_PATH,
    OPEN_CHALLENGE_TYPES,
    communityExports,
    ledger: {
        LEDGER_FILE: LEGACY_LEDGER,
        appendEntry: ledgerAppendEntry,
        listForUser: ledgerListForUser,
        listAll: ledgerListAll
    },
    moderation: {
        FILE: LEGACY_MODERATION,
        ALLOWED_REASONS,
        addReport: modAddReport,
        listReports: modListReports,
        resolveReport: modResolveReport
    }
};
