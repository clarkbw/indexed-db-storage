/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* jshint strict: true, esnext: true, newcap: false, globalstrict: true,
   devel: true, node: true */

"use strict";

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
    EventTarget.prototype.initialize.call(this, arguments);
    namespace(this).store = store;
    namespace(this).database = database;
  },
  // adds the obj to the db with the key
  add : function add(obj, key) {
    let { promise, resolve, reject } = defer();

    if (!this.autoIncrement && this.keyPath === null &&
        typeof key === "undefined") {
      reject("Key must be provided for a non auto-incrementing " +
             "database and no keyPath specified");
      return promise;
    }

    try {
      let transaction = this._db.transaction(this.name, READ_WRITE);
      let store = transaction.objectStore(this.name);

      // the add is actually finished when this event fires
      transaction.addEventListener("complete", () => {
        emit(this, "add", obj, key);
        resolve(key);
      });
      transaction.addEventListener("abort", () => reject(this));
      transaction.addEventListener("error", () => reject(this));

      try {
        let request = null;
        if (this.autoIncrement || this.keyPath !== null) {
          request = store.add(obj);
        } else {
          request = store.add(obj, key);
        }

        request.addEventListener("blocked", ({ target : { error }}) => reject(error));
        // success doesn't mean that it added until our transaction is complete
        // however we do get to capture the key used if this is an autoIncrement
        // database
        request.addEventListener("success", ({ target : { result }}) => key = result);
        request.addEventListener("error", ({ target : { error }}) => reject(error));
        request.addEventListener("ConstraintError", ({ target : { error }}) => reject(error));

      } catch (requestException) { // request
        reject(requestException.name);
      }

    } catch (transactionException) { // transaction
      reject(transactionException.name);
    }

    return promise;
  },
  get : function get(key) {
    let { promise, resolve, reject } = defer();

    let item = null;

    try {
      let transaction = this._db.transaction(this.name, READ_ONLY);
      let store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", () => {
        emit(this, "get", key, item);
        resolve(item);
      });
      transaction.addEventListener("abort", () => reject(this));
      transaction.addEventListener("error", () => reject(this));

      try {
        let request = store.get(key);
        request.addEventListener("success", ({ target : { result }}) => item = result);
        request.addEventListener("error", ({ target : { error }}) => reject(error));
      } catch (requestException) { // request
        reject(requestException.name);
      }

    } catch (transactionException) { // transaction
      reject(transactionException.name);
    }

    return promise;
  },
  clear : function clear() {
    let { promise, resolve, reject } = defer();

    try {
      let transaction = this._db.transaction(this.name, READ_WRITE);
      let store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", () => {
        emit(this, "cleared");
        resolve(this);
      });
      transaction.addEventListener("abort", () => reject(this));
      transaction.addEventListener("error", () => reject(this));

      try {
        let request = store.clear();
        request.addEventListener("success", () => resolve(this));
        request.addEventListener("error", ({ target : { error }}) => reject(error));
      } catch (requestException) { // request
        reject(requestException.name);
      }

    } catch (transactionException) { // transaction
      reject(transactionException.name);
    }

    return promise;
  },
  all : function all() {
    let { promise, resolve, reject } = defer();

    let reserved = "continue",
        items = [];

    try {
      let transaction = this._db.transaction(this.name, READ_ONLY);
      let store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", () => {
        emit(this, "all", items);
        resolve(items);
      });
      transaction.addEventListener("abort", () => reject(this));
      transaction.addEventListener("error", () => reject(this));

      try {
        let request = store.openCursor();
        request.addEventListener("success", ({ target : { result : cursor }}) => {
          if (cursor) {
            items.push(cursor.value);
            cursor[reserved]();
          }
        });
        request.addEventListener("error", ({ target : { error }}) => reject(error));
      } catch (requestException) { // request
        reject(requestException.name);
      }

    } catch (transactionException) { // transaction
      reject(transactionException.name);
    }

    return promise;
  },

  remove : function remove(key) {
    let { promise, resolve, reject } = defer();

    let reserved = "delete",
        item = null;

    try {
      let transaction = this._db.transaction(this.name, READ_WRITE);
      let store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", () => {
        emit(this, "remove", key, item);
        resolve(item);
      });
      transaction.addEventListener("abort", () => reject(this));
      transaction.addEventListener("error", () => reject(this));

      try {
        let request = store[reserved](key);
        request.addEventListener("success", ({ target : { result }}) => item = result);
        request.addEventListener("error", ({ target : { error }}) => reject(error));
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
    EventTarget.prototype.initialize.call(this, arguments);
    namespace(this).db = db;
    this._initializeObjectStores();
  },
  _initializeObjectStores : function _initializeObjectStores() {
    this.objectStores = {};
    this.objectStoreNames.forEach((name) => {
      try {
        let store = this.db.transaction(name, READ_ONLY).objectStore(name);
        this.objectStores[name] = new ObjectStore(store, this);
      } catch (e) {
        console.log("error", this.type, e);
      }
    });
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
    let { promise, resolve, reject } = defer();

    let version = this.version + 1;

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
    let request = indexedDB.open(this.name, version);

    request.addEventListener("blocked", () => reject(this));
    request.addEventListener("success", ({ target : { result : db }}) => {
      try {
        this.db = db;
        let store = this.db.transaction(name, READ_ONLY).objectStore(name);
        let objectstore = new ObjectStore(store, this);
        this.objectStores[name] = objectstore;
        emit(this, "objectstore:added", objectstore);
        resolve(objectstore);
      } catch (e) {
        reject(e);
      }
    });
    request.addEventListener("error", () => reject(this));
    request.addEventListener("upgradeneeded", ({ target : { result : db }}) => {
      // createObjectStore can raise a DOMException
      try {
        // Create the object store
        db.createObjectStore(name, options);
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
    let { promise, resolve, reject } = defer();

    let version = this.version + 1,
        success = false;

    try {
      options = this._validateIndex(options);
    } catch (e) {
      reject(e);
      return promise;
    }

    this.close();
    let request = indexedDB.open(this.name, version);

    request.addEventListener("blocked", () => reject(this));
    request.addEventListener("success", ({ target : { result : db }}) => {
      if (success) {
        this.db = db;
        let ostore = this.db.transaction(store.name, READ_ONLY).objectStore(store.name);
        this.objectStores[store.name] = new ObjectStore(ostore, this);
        let index = ostore.index(name);
        emit(ostore, "objectstore:index", index);
        resolve(index);
      } else {
        reject(this);
      }
    });
    request.addEventListener("error", () => reject(this));
    request.addEventListener("upgradeneeded", ({ target }) => {
      // createObjectStore can raise a DOMException
      let ostore = target.transaction.objectStore(store.name);
      try {
        // Attempt to create the index
        ostore.createIndex(name, keyPath, options);
        // set our success flag to true
        success = true;
      } catch (e) {
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
  extends : EventTarget,
  type: 'IDBFactory',
  connections : new Set(),
  initialize: function initialize() {
    EventTarget.prototype.initialize.call(this, arguments);
    ensure(this);
  },
  _find : function _find(name) {
    let db = null;
    for (let item of this.connections) {
      if (item.name === name) {
        db = item;
        break;
      }      
    }
    return db;
  },
  close : function close(db) {
    if (typeof db === "string") {
      db = this._find(db);
    }
    if (db !== null) {
      this.connections.delete(db);
      db.close();    
    }
    return (db instanceof Database);
  },
  open : function open(name) {
    let deferred = defer();
    let db = this._find(name);
    if (db !== null) {
      deferred.resolve(db);
      return deferred.promise;
    }
    return this._open(name, 1);
  },
  _open : function _open(name, version) {
    let { promise, resolve, reject } = defer();

    let request = indexedDB.open(name, version);

    request.addEventListener("success", ({ target : { result : db }}) => {
      let storage = new Database(db);
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
    request.addEventListener("upgradeneeded", ({ target : { result : db }}) => {
      let storage = new Database(db);
      this.connections.add(storage);
      emit(this, "upgraded", storage);
      resolve(storage);
    });
    return promise;
  },
  deleteDatabase : function deleteDatabase(name) {
    let { promise, resolve, reject } = defer();

    let found = this.close(name);
    let request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => {
      emit(this, "deleted", name);
      resolve(this);
    });
    request.addEventListener("error", ({target : { error }}) => reject(error));
    request.addEventListener("blocked", ({target : { error }}) => reject(error));

    if (!found) {
      reject(name);
    }
    return promise;
  },
  unload : function unload() {
    for (let db of this.connections) {
      this.close(db);
    }
  }
})();

exports.DatabaseFactory = DatabaseFactory;
