'use strict';

const sqlite = require('./imageforge-sqlite');
sqlite.init();

module.exports = sqlite.communityExports;
