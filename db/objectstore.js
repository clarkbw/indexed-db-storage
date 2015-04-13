/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* jshint strict: true, esnext: true, newcap: false, globalstrict: true,
   devel: true, node: true */

'use strict';

const { EventTarget } = require('sdk/event/target');
const { emit } = require('sdk/event/core');
const { Class } = require('sdk/core/heritage');
const { defer } = require('sdk/core/promise');
const { IDBKeyRange } = require('sdk/indexed-db');

const namespace = require('sdk/core/namespace').ns();

const { READ_ONLY, READ_WRITE, logDomError } = require('./utils');

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
        typeof key === 'undefined') {
      reject('Key must be provided for a non auto-incrementing ' +
             'database and no keyPath specified');
      return promise;
    }

    try {
      let transaction = this._db.transaction(this.name, READ_WRITE);
      let store = transaction.objectStore(this.name);

      // the add is actually finished when this event fires
      transaction.addEventListener('complete', () => {
        emit(this, 'add', obj, key);
        resolve(key);
      });
      transaction.addEventListener('abort', () => reject(this));
      transaction.addEventListener('error', () => reject(this));

      try {
        let request = null;
        if (this.autoIncrement || this.keyPath !== null) {
          request = store.add(obj);
        } else {
          request = store.add(obj, key);
        }

        request.addEventListener('blocked', ({ target : { error }}) => reject(error));
        // success doesn't mean that it added until our transaction is complete
        // however we do get to capture the key used if this is an autoIncrement
        // database
        request.addEventListener('success', ({ target : { result }}) => key = result);
        request.addEventListener('error', ({ target : { error }}) => reject(error));
        request.addEventListener('ConstraintError', ({ target : { error }}) => reject(error));

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

      transaction.addEventListener('complete', () => {
        emit(this, 'get', key, item);
        resolve(item);
      });
      transaction.addEventListener('abort', () => reject(this));
      transaction.addEventListener('error', () => reject(this));

      try {
        let request = store.get(key);
        request.addEventListener('success', ({ target : { result }}) => item = result);
        request.addEventListener('error', ({ target : { error }}) => reject(error));
      } catch (requestException) { // request
        reject(requestException.name);
      }

    } catch (transactionException) { // transaction
      reject(transactionException.name);
    }

    return promise;
  },
  find : function find(term) {
    let { promise, resolve, reject } = defer();

    let reserved = 'continue';
    let items = [];

    try {
      let transaction = this._db.transaction(this.name, READ_ONLY);
      let store = transaction.objectStore(this.name);

      transaction.addEventListener('complete', () => {
        emit(this, 'all', items);
        resolve(items);
      });
      transaction.addEventListener('abort', () => reject(this));
      transaction.addEventListener('error', () => reject(this));

      try {
        let request = store.openCursor(IDBKeyRange.bound(term, term + '\uffff'), 'prev');
        request.addEventListener('success', ({ target : { result : cursor }}) => {
          if (cursor) {
            items.push(cursor.value);
            cursor[reserved]();
          }
        });
        request.addEventListener('error', ({ target : { error }}) => reject(error));
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

      transaction.addEventListener('complete', () => {
        emit(this, 'cleared');
        resolve(this);
      });
      transaction.addEventListener('abort', () => reject(this));
      transaction.addEventListener('error', () => reject(this));

      try {
        let request = store.clear();
        request.addEventListener('success', () => resolve(this));
        request.addEventListener('error', ({ target : { error }}) => reject(error));
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

    let reserved = 'continue';
    let items = [];

    try {
      let transaction = this._db.transaction(this.name, READ_ONLY);
      let store = transaction.objectStore(this.name);

      transaction.addEventListener('complete', () => {
        emit(this, 'all', items);
        resolve(items);
      });
      transaction.addEventListener('abort', () => reject(this));
      transaction.addEventListener('error', () => reject(this));

      try {
        let request = store.openCursor();
        request.addEventListener('success', ({ target : { result : cursor }}) => {
          if (cursor) {
            items.push(cursor.value);
            cursor[reserved]();
          }
        });
        request.addEventListener('error', ({ target : { error }}) => reject(error));
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

    let reserved = 'delete';
    let item = null;

    try {
      let transaction = this._db.transaction(this.name, READ_WRITE);
      let store = transaction.objectStore(this.name);

      transaction.addEventListener('complete', () => {
        emit(this, 'remove', key, item);
        resolve(item);
      });
      transaction.addEventListener('abort', () => reject(this));
      transaction.addEventListener('error', () => reject(this));

      try {
        let request = store[reserved](key);
        request.addEventListener('success', ({ target : { result }}) => item = result);
        request.addEventListener('error', ({ target : { error }}) => reject(error));
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

exports.ObjectStore = ObjectStore;
