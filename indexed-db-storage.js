/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* jshint strict: true, esnext: true, newcap: false, globalstrict: true,
   devel: true, node: true */

"use strict";

const { indexedDB } = require('sdk/indexed-db');
const { EventTarget } = require('sdk/event/target');
const { emit } = require('sdk/event/core');
const { Class } = require('sdk/core/heritage');
const { ensure } = require('sdk/system/unload');
const { defer } = require('sdk/core/promise');

const { Database } = require('./db/database');

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
