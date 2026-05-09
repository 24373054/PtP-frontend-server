'use strict';

const crypto = require('crypto');

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function csrfMiddleware(req, res, next) {
    // Always set/refresh the CSRF cookie on GET/HEAD/OPTIONS so the client can read it
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if (!req.cookies || !req.cookies[CSRF_COOKIE]) {
            const token = generateToken();
            res.cookie(CSRF_COOKIE, token, {
                httpOnly: false,
                sameSite: 'lax',
                secure: process.env.SESSION_COOKIE_SECURE === '1',
                maxAge: 24 * 60 * 60 * 1000
            });
        }
        return next();
    }

    // Only enforce CSRF for requests that carry a session cookie — API clients
    // and fresh sessions without cookies are allowed through.
    const hasSession = !!(req.cookies && req.cookies['ptp.sid']);
    if (!hasSession) return next();

    const cookieToken = req.cookies && req.cookies[CSRF_COOKIE];
    const headerToken = req.headers[CSRF_HEADER];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({ error: 'CSRF token mismatch' });
    }

    next();
}

module.exports = { csrfMiddleware, CSRF_COOKIE, CSRF_HEADER };
