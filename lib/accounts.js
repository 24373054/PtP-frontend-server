const fs = require('fs');
const path = require('path');

const ACCOUNTS_FILE = path.join(__dirname, '..', 'accounts.json');

function ensureFile() {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify({ users: [] }, null, 2), 'utf8');
    }
}

function load() {
    ensureFile();
    try {
        const j = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
        if (!j || !Array.isArray(j.users)) return { users: [] };
        return j;
    } catch (_) {
        return { users: [] };
    }
}

function save(data) {
    ensureFile();
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase();
}

function normalizeUsernameKey(username) {
    return String(username || '')
        .trim()
        .toLowerCase();
}

function findByEmail(email) {
    const e = normalizeEmail(email);
    return load().users.find((u) => u.email === e) || null;
}

function findByUsername(username) {
    const k = normalizeUsernameKey(username);
    return load().users.find((u) => u.usernameNorm === k) || null;
}

function findById(id) {
    return load().users.find((u) => u.id === id) || null;
}

function addUser(user) {
    const data = load();
    data.users.push(user);
    save(data);
    return user;
}

function updateUser(id, patch) {
    const data = load();
    const i = data.users.findIndex((u) => u.id === id);
    if (i < 0) return null;
    data.users[i] = { ...data.users[i], ...patch };
    save(data);
    return data.users[i];
}

module.exports = {
    ACCOUNTS_FILE,
    load,
    save,
    normalizeEmail,
    normalizeUsernameKey,
    findByEmail,
    findByUsername,
    findById,
    addUser,
    updateUser
};
