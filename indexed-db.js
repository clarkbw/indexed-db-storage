/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

// This module has been subsumed by the sdk indexed-db module
// and only exists now to provide additional access to the indexed db vars

module.metadata = {
  "stability": "experimental"
};

const { Ci } = require('chrome');

exports.IDBCursor = Ci.nsIIDBCursor;
exports.IDBTransaction = Ci.nsIIDBTransaction;
exports.IDBOpenDBRequest = Ci.nsIIDBOpenDBRequest;
exports.IDBVersionChangeEvent = Ci.nsIIDBVersionChangeEvent;
exports.IDBDatabase = Ci.nsIIDBDatabase;
exports.IDBFactory = Ci.nsIIDBFactory;
exports.IDBIndex = Ci.nsIIDBIndex;
exports.IDBObjectStore = Ci.nsIIDBObjectStore;
exports.IDBRequest = Ci.nsIIDBRequest;
