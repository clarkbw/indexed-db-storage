/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* jshint strict: true, esnext: true, newcap: false, globalstrict: true,
   devel: true, node: true */

"use strict";

const { IDBTransaction, IDBVersionChangeEvent } = require('./indexed-db');
const { indexedDB, DOMException, IDBKeyRange } = require('sdk/indexed-db');
const { EventTarget } = require('sdk/event/target');
const { on, once, off, emit } = require('sdk/event/core');
const { Collection } = require("sdk/util/collection");
const { Class } = require('sdk/core/heritage');
const { when: unload, ensure } = require('sdk/system/unload');
const { defer } = require('sdk/core/promise');
const { validateOptions } = require('sdk/deprecated/api-utils');

const namespace = require('sdk/core/namespace').ns();

const { id } = require('sdk/self');

// https://mxr.mozilla.org/
// mozilla-central/source/dom/indexedDB/IDBDatabase.cpp#606
const READ_ONLY = exports.READ_ONLY = "readonly";
const READ_WRITE = exports.READ_WRITE = "readwrite";
const VERSION_CHANGE = exports.VERSION_CHANGE = "versionchange";

function logDomError(event) {
  console.log("_onerror", event);
  switch (event.target.error.name) {
  case "VersionError":
    console.log("DOMException.VersionError");
    break;
  case "AbortError":
    console.log("DOMException.AbortError");
    break;
  case "ConstraintError":
    console.log("DOMException.ConstraintError");
    break;
  case "QuotaExceededError":
    console.log("DOMException.QuotaExceededError");
    break;
  case "UnknownError":
    console.log("DOMException.UnknownError");
    break;
  case "NoError":
    console.log("DOMException.NoError");
    break;
  }
}

// This class maps to an IDBObjectStore
// https://developer.mozilla.org/en-US/docs/IndexedDB/IDBObjectStore
var ObjectStore = Class({
  extends : EventTarget,
  type: 'IDBObjectStore',
  get indexNames() {
    return Array.slice(namespace(this).store.indexNames);
  },
  get keyPath() {
    return namespace(this).store.keyPath;
  },
  get name() {
    return namespace(this).store.name;
  },
  get autoIncrement() {
    return namespace(this).store.autoIncrement;
  },
  get _db() {
    return namespace(this).database.db;
  },
  initialize: function initialize(store, database) {
    namespace(this).store = store;
    namespace(this).database = database;
  },
  // adds the obj to the db with the key
  add : function add(obj, key) {
    var { promise, resolve, reject } = defer();

    var db = this._db,
        transaction = null,
        store = null,
        request = null;

    if (!this.autoIncrement && this.keyPath === null &&
        typeof key === "undefined") {
      reject("Key must be provided for a non auto-incrementing " +
             "database and no keyPath specified");
      return promise;
    }

    try {
      transaction = db.transaction(this.name, READ_WRITE);
      store = transaction.objectStore(this.name);

      // the add is actually finished when this event fires
      transaction.addEventListener("complete", event => {
        emit(this, "add", obj, key);
        resolve(key);
      });
      transaction.addEventListener("abort", event => {
        reject(this);
      });
      transaction.addEventListener("error", event => {
        reject(this);
      });

      try {
        if (this.autoIncrement || this.keyPath !== null) {
          request = store.add(obj);
        } else {
          request = store.add(obj, key);
        }

        request.addEventListener("blocked", event => {
          reject(event.target.error);
        });
        // success doesn't mean that it added until our transaction is complete
        // however we do get to capture the key used if this is an autoIncrement
        // database
        request.addEventListener("success", event => {
          key = event.target.result;
        });
        request.addEventListener("error", event => {
          reject(event.target.error);
        });
        request.addEventListener("ConstrainError", event => {
          reject(event.target.error);
        });

      } catch (requestException) { // request
        reject(requestException.name);
      }

    } catch (transactionException) { // transaction
      reject(transactionException.name);
    }

    return promise;
  },
  get : function get(key) {
    var { promise, resolve, reject } = defer();

    var request = null,
        db = this._db,
        transaction = null,
        store = null,
        item = null;

    try {
      transaction = db.transaction(this.name, READ_ONLY);
      store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", event => {
        emit(this, "get", key, item);
        resolve(item);
      });
      transaction.addEventListener("abort", event => {
        reject(this);
      });
      transaction.addEventListener("error", event => {
        reject(this);
      });

      try {
        request = store.get(key);
        request.addEventListener("success", event => {
          item = event.target.result;
        });
        request.addEventListener("error", event => {
          reject(event.target.error);
        });
      } catch (requestException) { // request
        reject(requestException.name);
      }

    } catch (transactionException) { // transaction
      reject(transactionException.name);
    }

    return promise;
  },
  clear : function clear() {
    var { promise, resolve, reject } = defer();

    var request = null,
        db = this._db,
        transaction = null,
        store = null;

    try {
      transaction = db.transaction(this.name, READ_WRITE);
      store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", event => {
        emit(this, "cleared");
        resolve(this);
      });
      transaction.addEventListener("abort", event => {
        reject(this);
      });
      transaction.addEventListener("error", event => {
        reject(this);
      });

      try {
        request = store.clear();
        request.addEventListener("success", event => {
          resolve(this);
        });
        request.addEventListener("error", event => {
          reject(event.target.error);
        });
      } catch (requestException) { // request
        reject(requestException.name);
      }

    } catch (transactionException) { // transaction
      reject(transactionException.name);
    }

    return promise;
  },
  all : function all() {
    var { promise, resolve, reject } = defer();

    var request = null,
        reserved = "continue",
        items = [],
        db = this._db,
        transaction = null,
        store = null;

    try {
      transaction = db.transaction(this.name, READ_ONLY);
      store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", event => {
        emit(this, "all", items);
        resolve(items);
      });
      transaction.addEventListener("abort", event => {
        reject(this);
      });
      transaction.addEventListener("error", event => {
        reject(this);
      });

      try {
        request = store.openCursor();
        request.addEventListener("success", event => {
          var cursor = event.target.result;
          if (cursor) {
            items.push(cursor.value);
            cursor[reserved]();
          }
        });
        request.addEventListener("error", event => {
          reject(event.target.error);
        });
      } catch (requestException) { // request
        reject(requestException.name);
      }

    } catch (transactionException) { // transaction
      reject(transactionException.name);
    }

    return promise;
  },

  remove : function remove(key) {
    var { promise, resolve, reject } = defer();

    var reserved = "delete",
        request = null,
        item = null,
        db = this._db,
        transaction = null,
        store = null;

    try {
      transaction = db.transaction(this.name, READ_WRITE);
      store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", event => {
        emit(this, "remove", key, item);
        resolve(item);
      });
      transaction.addEventListener("abort", event => {
        reject(this);
      });
      transaction.addEventListener("error", event => {
        reject(this);
      });

      try {
        request = store[reserved](key);
        request.addEventListener("success", event => {
          item = event.target.result;
        });
        request.addEventListener("error", event => {
          reject(event.target.error);
        });
      } catch (requestException) { // request
        reject(requestException.name);
      }

    } catch (transactionException) { // transaction
      reject(transactionException.name);
    }

    return promise;
  },
  // create an index on this object store
  /**
   *
   * @see https://developer.mozilla.org/en-US/docs/IndexedDB/IDBObjectStore#createIndex%28%29
   */
  createIndex : function createIndex(name, keyPath, options) {
    // we send this up to the DB level since we'll need to upgrade the version
    return namespace(this).database._createIndex(this, name, keyPath, options);
  },
});

// This class maps to an IDBDatabase
// https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase
var Database = Class({
  extends : EventTarget,
  type: 'IDBDatabase',
  initialize: function initialize(db) {
    namespace(this).db = db;
    this._initializeObjectStores();
  },
  _initializeObjectStores : function _initializeObjectStores() {
    this.objectStores = {};
    this.objectStoreNames.forEach(function (name) {
      var store = null;
      try {
        store = this.db.transaction(name, READ_ONLY).objectStore(name);
        this.objectStores[name] = new ObjectStore(store, this);
      } catch (e) {
        console.error(this.type, e);
      }
    }, this);
  },
  get db() {
    return namespace(this).db;
  },
  set db(db) {
    if (namespace(this).db) {
      namespace(this).db.close();
    }
    namespace(this).db = db;
  },
  get name() {
    return (this.db) ? this.db.name : null;
  },
  get version() { return (this.db) ? this.db.version : 1; },
  get objectStoreNames() {
    return (this.db) ? Array.slice(this.db.objectStoreNames) : [];
  },
  createObjectStore : function createObjectStore(name, options) {
    var { promise, resolve, reject } = defer();

    var request = null,
        version = this.version + 1;

    try {
      options = this._validateObjectStore(options);
    } catch (e) {
      reject(e);
      return promise;
    }

    // if this exact object store already exists lets just return that
    if (this.objectStoreNames.some(function (e) { return e === name; })) {
      resolve(this.objectStores[name]);
      return promise;
    }

    this.close();
    request = indexedDB.open(this.name, version);

    request.addEventListener("blocked", event => {
      reject(this);
    });
    request.addEventListener("success", event => {
      try {
        this.db = event.target.result;
        var store = this.db.transaction(name, READ_ONLY).objectStore(name);
        var objectstore = new ObjectStore(store, this);
        this.objectStores[name] = objectstore;
        emit(this, "objectstore:added", objectstore);
        resolve(objectstore);
      } catch (e) {
        reject(e);
      }
    });
    request.addEventListener("error", event => {
      reject(this);
    });
    request.addEventListener("upgradeneeded", event => {
      // createObjectStore can raise a DOMException
      try {
        // Create the object store
        this.db.createObjectStore(name, options);
      } catch (e) {
        // ConstraintError means the db already exists
        if (e.name === "ConstraintError") {
          resolve(this.objectStores[name]);
        } else {
          reject(e);
        }
      }
    });
    return promise;
  },
  _validateObjectStore : function _validateObjectStore(options) {
    return validateOptions(options,
                          { keyPath: { is : ["string",
                                             "null",
                                             "undefined"] },
                            autoIncrement : { is : ["boolean",
                                                    "undefined"]
                            }
                          });
  },
  _createIndex : function _createIndex(store, name, keyPath, options) {
    var { promise, resolve, reject } = defer();

    var request = null,
        version = this.version + 1,
        success = false;

    try {
      options = this._validateIndex(options);
    } catch (e) {
      reject(e);
      return promise;
    }

    this.close();
    request = indexedDB.open(this.name, version);

    request.addEventListener("blocked", reject);
    request.addEventListener("success", event => {
      if (success) {
        this.db = event.target.result;
        var index = this.db.transaction(store.name, READ_ONLY).objectStore(store.name).index(name);
        emit(store, "objectstore:index", index);
        resolve(index);
      } else {
        reject(event);
      }
    });
    request.addEventListener("error", reject);
    request.addEventListener("upgradeneeded", ({ target }) => {
      // createObjectStore can raise a DOMException
      var ostore = target.transaction.objectStore(store.name);
      try {
        // Attempt to create the index
        ostore.createIndex(name, keyPath, options);
        // set our success flag to true
        success = true;
      } catch (e) {
        console.error(id, e);
        // ConstraintError means the index already exists
        if (e.name === "ConstraintError") {
          console.log("_createIndex.ConstraintError");
          success = true;
          resolve(ostore.index(name));
        } else {
          success = false;
          reject(e);
        }
      }
    });
    return promise;
  },
  _validateIndex : function _validateIndex(options) {
    return validateOptions(options,
                          { unique: { is : ["boolean",
                                             "undefined"] },
                            multiEntry : { is : ["boolean",
                                                  "undefined"]
                            }
                          });
  },
  close : function close() {
    this.db.close();
  },
  unload : function unload() {
    this.db = null;
    this.objectStore = null;
  }
});

// This class maps to an IDBFactory
// https://developer.mozilla.org/en-US/docs/IndexedDB/IDBFactory
var DatabaseFactory = Class({
  connections : new Collection(),
  initialize: function initialize() {
    EventTarget.prototype.initialize.call(this, arguments);
    ensure(this);
  },
  close : function close(db) {
    if (!(db instanceof Database) &&
        typeof db === "string") {
      for (var connection in this.connections) {
        if (connection.name === db) {
          db = connection;
          break;
        }
      }
    }
    this.connections.remove(db);
    db.close();
    return (db instanceof Database);
  },
  open : function open(name) {
    for (var db in this.connections) {
      if (db.name === name) {
        var deferred = defer();
        deferred.resolve(db);
        return deferred.promise;
      }
    }
    return this._open(name, 1);
  },
  _open : function _open(name, version) {
    var { promise, resolve, reject } = defer();

    var request = indexedDB.open(name, version);

    request.addEventListener("success", ({target : { result }}) => {
      var storage = new Database(result);
      this.connections.add(storage);
      emit(this, "opened", storage);
      resolve(storage);
    });
    request.addEventListener("error", event => {
      if (event.target.error.name === "VersionError") {
        version += 1;
        emit(this, "version", name, version);
        resolve(this._open(name, version));
      } else {
        logDomError(event);
        reject(event);
      }
    });
    request.addEventListener("upgradeneeded", ({target : { result }}) => {
      var storage = new Database(result);
      this.connections.add(storage);
      emit(this, "upgraded", storage);
      resolve(storage);
    });
    return promise;
  },
  deleteDatabase : function deleteDatabase(name) {
    var { promise, resolve, reject } = defer();

    var found = this.close(name);
    var request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", event => {
      emit(this, "deleted", name);
      resolve(this);
    });
    request.addEventListener("error", ({target : { error }}) => {
      reject(error);
    });
    request.addEventListener("blocked", ({target : { error }}) => {
      reject(error);
    });

    if (!found) {
      reject(name);
    }
    return promise;
  },
  extends : EventTarget,
  type: 'IDBFactory',
  unload : function unload() {
    for (var db in this.connections) {
      this.close(db);
    }
  }
})();

exports.DatabaseFactory = DatabaseFactory;
