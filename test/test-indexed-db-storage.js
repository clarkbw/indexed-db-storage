/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* jshint strict: true, esnext: true, newcap: false, globalstrict: true,
   devel: true, node: true */

'use strict';

const { DatabaseFactory } = require("../indexed-db-storage");
const { READ_ONLY, READ_WRITE } = require('../db/utils');
const { indexedDB } = require('sdk/indexed-db');

let DB_NAME = "test1";
exports['test 001 first create and open db'] = function (assert, done) {
  DatabaseFactory.once('opened', function (db) {
    assert.pass('db opened event');
    assert.equal(DB_NAME, db.name);
  });
  DatabaseFactory.once('upgraded', function (db) {
    assert.pass('db upgraded event');
    assert.equal(DB_NAME, db.name);
  });
  DatabaseFactory.open(DB_NAME).then(function (db) {
    let request = indexedDB.open(db.name, db.version);
    request.onsuccess = ({ target : { result }}) => {
      assert.pass('db exists');
      assert.equal(result.name, db.name,
                   "db name is not the same");
      result.close();
      done();
    };
    request.onerror = () => assert.fail('failed to open db');
    request.addEventListener("upgradeneeded", () => assert.fail('no upgrade should be needed'));
  });
};

exports['test 002 next open and delete db'] = function (assert, done) {
  let fail = (error) => {
    assert.fail(error);
    done();
  };

  let cleanup = (name) => {
    let request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => {
      assert.pass('deleted db on cleanup');
      done();
    });
    request.addEventListener("error", ({target : { error }}) => fail(error));
  };

  DatabaseFactory.once('deleted', (name) => assert.equal(DB_NAME, name));
  DatabaseFactory.open(DB_NAME).then((db) => {
    DatabaseFactory.deleteDatabase(db.name).then((deldb) => {
      let request = indexedDB.open(deldb.name, 1);
      request.addEventListener("success", () => assert.pass('db exists eventually'));
      request.addEventListener("upgradeneeded", ({ target : { result }}) => {
        assert.pass('upgrade needed because this db did not exist before');
        result.close();
        cleanup(deldb.name);
      });
      request.addEventListener("error", ({target : { error }}) => fail(error));
    },fail);
  }, fail);

};

exports['test 003 open high version db'] = function (assert, done) {
  let fail = (error) => {
    assert.fail(error);
    done();
  };
  let version = 10;
  let request = indexedDB.open(DB_NAME, version);
  request.addEventListener("success", ({ target : { result }}) => {
    console.dir(result);
    assert.pass('db created ' + result.version, result.name);
    result.close();
    DatabaseFactory.open(DB_NAME).then((db) => {
      console.dir(db);
      assert.equal(version, db.version,
                   "We didn't open the db to the correct version");
      done();
    }, fail);
  });
  request.addEventListener("error", ({target : { error }}) => fail(error));
  request.addEventListener("upgradeneeded", ({target : { result : db }}) => {
    console.dir(db);
    assert.equal(version, db.version, "should be coming from a different version number");
  });
};

exports['test create index'] = function (assert, done) {
  let dbName = "test14",
      storeName = "store1",
      indexName = "index1",
      indexKeyPath = "value",
      options = {};
  let failWithError = (error) => {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName).then(function (store) {
      store.createIndex(indexName, indexKeyPath, options).then(function (index) {
        // console.log("index", index);
        // console.log("stores", store.indexNames, db.objectStoreNames);
        // console.log("names:", store.name, db.name);
        // console.log("versions: ", store.version, db.version);
        let request = indexedDB.open(dbName, db.version);
        request.onsuccess = ({ target }) => {
          let result = target.result;
          let storeIndex = result.transaction(storeName, READ_ONLY).objectStore(storeName).index(indexName);
          assert.ok(storeIndex !== null, "index does not exist");
          assert.equal(storeIndex.name, indexName, 'index does not have the correct name');
          assert.equal(storeIndex.keyPath, indexKeyPath, 'index does not have the correct keyPath');
          result.close();
          done();
        };
        request.onerror = () => {
          assert.fail('failed to open db');
        };
        request.addEventListener("upgradeneeded", () => {
          assert.fail('no upgrade should be needed in this test');
        });
      });
    }, failWithError);
  }, failWithError);
};

require('test').run(exports);
