/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, curly:true, browser:false, es5:true,
  indent:2, maxerr:50, devel:true, node:true boss:true, white:true,
  globalstrict:true, nomen:false, newcap:false esnext: true */

/*global */

"use strict";

var idb = require('./indexed-db'),
    indexedDB = idb.indexedDB, DOMException = idb.DOMException,
    IDBTransaction = idb.IDBTransaction,
    IDBVersionChangeEvent = idb.IDBVersionChangeEvent,
    IDBKeyRange = idb.IDBKeyRange;
var apiUtils = require("sdk/deprecated/api-utils");
var target = require('sdk/event/target'),
      EventTarget = target.EventTarget;
var eventcore = require('sdk/event/core'),
      on = eventcore.on, once = eventcore.once, off = eventcore.off,
      emit = eventcore.emit;
var Collection = require("sdk/util/collection").Collection;
var promiseutil = require('sdk/core/promise'),
      defer = promiseutil.defer, promised = promiseutil.promised;
var Class = require('sdk/core/heritage').Class;
var unload = require("sdk/system/unload");


var id = require('self').id;

// https://mxr.mozilla.org/
// mozilla-central/source/dom/indexedDB/IDBDatabase.cpp#606
var READ_ONLY = "readonly";
var READ_WRITE = "readwrite";


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
  type: 'ObjectStorage',
  get indexNames() {
    return Array.slice(this.store.indexNames);
  },
  get keyPath() {
    return this.store.keyPath;
  },
  get name() {
    return this.store.name;
  },
  get autoIncrement() {
    return this.store.autoIncrement;
  },
  initialize: function initialize(store) {
    this.store = store;
  },
  // adds the obj to the db with the key
  add : function add(obj, key) {
    var deferred = defer(),
        promise = deferred.promise,
        resolve = deferred.resolve,
        reject = deferred.reject;

    var storage = this,
        db = this.store.transaction.db,
        transaction = null,
        store = null,
        request = null;

    if (!this.autoIncrement && this.keyPath === null &&
        typeof key === "undefined") {
      reject("Key must be provided with an auto-incrementing " +
             "database and no keyPath specified");
      return promise;
    }

    try {
      transaction = db.transaction(this.name, READ_WRITE);
      store = transaction.objectStore(this.name);

      // the add is actually finished when this event fires
      transaction.addEventListener("complete", function (event) {
        emit(storage, "add", obj, key);
        resolve(key);
      });
      transaction.addEventListener("abort", function (event) {
        reject(storage);
      });
      transaction.addEventListener("error", function (event) {
        reject(storage);
      });

      try {
        if (this.autoIncrement) {
          request = store.add(obj);
        } else {
          request = store.add(obj, key);
        }

        request.addEventListener("blocked", function (event) {
          console.log("blocked", "request", event.target.error);
          reject(event.target.error);
        });
        // success doesn't mean that it added until our transaction is complete
        // however we do get to capture the key used if this is an autoIncrement
        // database
        request.addEventListener("success", function (event) {
          key = event.target.result;
        });
        request.addEventListener("error", function (event) {
          reject(event.target.error);
        });
        request.addEventListener("ConstrainError", function (event) {
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
    var deferred = defer(),
        promise = deferred.promise,
        resolve = deferred.resolve,
        reject = deferred.reject;

    var storage = this,
        request = null,
        db = this.store.transaction.db,
        transaction = null,
        store = null,
        item = null;

    try {
      transaction = db.transaction(this.name, READ_ONLY),
      store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", function (event) {
        emit(storage, "get", key, item);
        resolve(item);
      });
      transaction.addEventListener("abort", function (event) {
        reject(storage);
      });
      transaction.addEventListener("error", function (event) {
        reject(storage);
      });

      try {
        request = store.get(key);
        request.addEventListener("success", function (event) {
          item = event.target.result;
        });
        request.addEventListener("error", function (event) {
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
    var deferred = defer(),
        promise = deferred.promise,
        resolve = deferred.resolve,
        reject = deferred.reject;

    var storage = this,
        request = null,
        reserved = "continue",
        items = [],
        db = this.store.transaction.db,
        transaction = null,
        store = null;

    try {
      transaction = db.transaction(this.name, READ_ONLY),
      store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", function (event) {
        emit(storage, "all", items);
        resolve(items);
      });
      transaction.addEventListener("abort", function (event) {
        reject(storage);
      });
      transaction.addEventListener("error", function (event) {
        reject(storage);
      });

      try {
        request = store.openCursor();
        request.addEventListener("success", function (event) {
          var cursor = event.target.result;
          if (cursor) {
            items.push(cursor.value);
            cursor[reserved]();
          }
        });
        request.addEventListener("error", function (event) {
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
    var deferred = defer(),
        promise = deferred.promise,
        resolve = deferred.resolve,
        reject = deferred.reject;

    var storage = this,
        reserved = "delete",
        request = null,
        item = null,
        db = this.store.transaction.db,
        transaction = null,
        store = null;

    try {
      transaction = db.transaction(this.name, READ_WRITE);
      store = transaction.objectStore(this.name);

      transaction.addEventListener("complete", function (event) {
        emit(storage, "remove", key, item);
        resolve(item);
      });
      transaction.addEventListener("abort", function (event) {
        reject(storage);
      });
      transaction.addEventListener("error", function (event) {
        reject(storage);
      });

      try {
        request = store[reserved](key);
        request.addEventListener("success", function (event) {
          item = event.target.result;
        });
        request.addEventListener("error", function (event) {
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
});

// This class maps to an IDBDatabase
// https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase
var Database = Class({
  extends : EventTarget,
  type: 'Database',
  initialize: function initialize(db) {
    this.db = db;
    this.objectStores = {};
    this.objectStoreNames.forEach(function (name) {
      var store = null;
      try {
        console.log("READ ONLY");
        store = this.db.transaction(name, READ_ONLY).objectStore(name);
      } catch (e) {
        console.log("ER", e);
      }
      // this worries me because we could override an existing store
      this.objectStores[name] = new ObjectStore(store);
    }.bind(this));
  },
  // until Bug 786688 is fixed we're going to get weird names
  _name : function _name(name) {
    return name.replace(id + ":", "");
  },
  get name() {
    return (this.db) ? this._name(this.db.name) : null;
  },
  get version() { return (this.db) ? this.db.version : null; },
  get objectStoreNames() {
    return (this.db) ? Array.slice(this.db.objectStoreNames) : [];
  },
  createObjectStore : function createObjectStore(name, options) {
    var deferred = defer(),
        promise = deferred.promise,
        resolve = deferred.resolve,
        reject = deferred.reject;

    var database = this,
        request = null,
        version = this.version + 1,
        success = false;

    try {
      options = this._validateObjectStore(options);
    } catch (e) {
      reject(e);
    }

    this.close();
    request = indexedDB.open(this.name, version);

    request.addEventListener("blocked", function (event) {
      //console.log("blocked");
      reject(event);
    });
    request.addEventListener("success", function (event) {
      if (success) {
        database.db = event.target.result;
        var store = database.db.transaction(name, READ_ONLY).objectStore(name);
        var objectstore = new ObjectStore(store);
        // XXX this could allow old object stores to be overridden
        database.objectStores[name] = objectstore;
        emit(database, "objectstore:added", store);
        resolve(objectstore);
      }
    });
    request.addEventListener("error", function (event) {
      reject(event);
    });
    request.addEventListener("upgradeneeded", function (event) {
      // createObjectStore can raise a DOMException
      try {
        // set our success flag to true
        success = true;
        // Actually create the object store now
        database.db.createObjectStore(name, options);
      } catch (e) {
        // ConstraintError means the db already exists
        if (e.name === "ConstraintError") {
          console.log("ConstraintError");
          resolve(database.objectStores[name]);
        } else {
          success = false;
          reject(e);
        }
      }
    });
    return promise;
  },
  _validateObjectStore : function _validateObjectStore(options) {
    return apiUtils.validateOptions(options,
                                    { keyPath: { is : ["string",
                                                       "null",
                                                       "undefined"] },
                                      autoIncrement : { is : ["boolean",
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
    unload.ensure(this);
  },
  close : function close(db) {
    if (!(db instanceof Database) &&
        typeof db === "string") {
      for (var connection in this.connections) {
        if (connection.name === db) {
          //console.log("close", connection.name, "===", db);
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
    var factory = this;
    var deferred = defer(),
        promise = deferred.promise,
        resolve = deferred.resolve,
        reject = deferred.reject;

    var request = indexedDB.open(name, version);

    request.addEventListener("success", function (event) {
      var storage = new Database(event.target.result);
      factory.connections.add(storage);
      emit(storage, "opened", storage);
      resolve(storage);
    });
    request.addEventListener("error", function (event) {
      if (event.target.error.name === "VersionError") {
        resolve(factory._open(name, version + 1));
      } else {
        logDomError(event);
        reject(event);
      }
    });
    request.addEventListener("upgradeneeded", function (event) {
      var storage = new Database(event.target.result);
      factory.connections.add(storage);
      emit(storage, "upgraded", storage);
      resolve(storage);
    });
    return promise;
  },
  deleteDatabase : function deleteDatabase(name) {
    var deferred = defer(),
        promise = deferred.promise,
        resolve = deferred.resolve,
        reject = deferred.reject;

    var manager = this;
    var found = this.close(name);
    var request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", function (event) {
      emit(manager, "deleted", name);
      resolve(manager);
    });
    request.addEventListener("error", function (event) {
      reject(event.target.error);
    });
    request.addEventListener("blocked", function (event) {
      reject(event.target.error);
    });

    if (!found) {
      reject(name);
    }
    return promise;
  },
  extends : EventTarget,
  type: 'Factory',
  unload : function unload() {
    for (var db in this.connections) {
      this.close(db);
    }
  }
})();

exports.DatabaseFactory = DatabaseFactory;
