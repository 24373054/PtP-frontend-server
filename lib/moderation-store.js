'use strict';

const sqlite = require('./imageforge-sqlite');
sqlite.init();

module.exports = {
    FILE: sqlite.moderation.FILE,
    ALLOWED_REASONS: sqlite.moderation.ALLOWED_REASONS,
    addReport: sqlite.moderation.addReport,
    listReports: sqlite.moderation.listReports,
    resolveReport: sqlite.moderation.resolveReport
};
