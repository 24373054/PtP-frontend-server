'use strict';

const sqlite = require('./imageforge-sqlite');
sqlite.init();

module.exports = {
    LEDGER_FILE: sqlite.ledger.LEDGER_FILE,
    appendEntry: sqlite.ledger.appendEntry,
    listForUser: sqlite.ledger.listForUser,
    listAll: sqlite.ledger.listAll
};
