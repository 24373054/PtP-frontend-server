'use strict';

function errorHandler(err, req, res, _next) {
    console.error('[unhandled]', err.stack || err.message || err);

    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body too large' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large (max 20MB)' });
    }
    if (err.message && err.message.startsWith('Only image files')) {
        return res.status(400).json({ error: 'Only JPG, PNG, WEBP files are allowed' });
    }

    res.status(500).json({ error: 'Internal server error' });
}

function notFoundHandler(req, res) {
    res.status(404).json({ error: 'Not found', path: req.path });
}

module.exports = { errorHandler, notFoundHandler };
