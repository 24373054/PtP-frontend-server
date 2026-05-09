'use strict';

const { getDb } = require('./imageforge-sqlite');
const { v4: uuidv4 } = require('uuid');

function initTable() {
    const db = getDb();
    db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            related_id TEXT,
            read_flag INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, read_flag, created_at DESC)');
}

function notify({ userId, type, title, body, relatedId }) {
    initTable();
    const db = getDb();
    const id = `notif_${uuidv4()}`;
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, related_id, read_flag, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(id, userId, type, title, body || null, relatedId || null, now);
    return { id, userId, type, title, body, relatedId, readFlag: false, createdAt: now };
}

function listForUser(userId, { page = 1, pageSize = 30 } = {}) {
    initTable();
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?').get(userId).c;
    const start = (Math.max(1, page) - 1) * pageSize;
    const rows = db.prepare(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(userId, pageSize, start);
    const list = rows.map(r => ({
        id: r.id, userId: r.user_id, type: r.type, title: r.title, body: r.body,
        relatedId: r.related_id, readFlag: !!r.read_flag, createdAt: r.created_at
    }));
    return { list, page: Math.max(1, page), pageSize, total, hasMore: start + list.length < total };
}

function unreadCount(userId) {
    initTable();
    const db = getDb();
    return db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_flag = 0').get(userId).c;
}

function markRead(userId, notificationId) {
    initTable();
    const db = getDb();
    if (notificationId === 'all') {
        db.prepare('UPDATE notifications SET read_flag = 1 WHERE user_id = ? AND read_flag = 0').run(userId);
    } else {
        db.prepare('UPDATE notifications SET read_flag = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId);
    }
    return { ok: true };
}

module.exports = { notify, listForUser, unreadCount, markRead };
