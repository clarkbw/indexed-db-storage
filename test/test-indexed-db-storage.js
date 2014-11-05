/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* jshint strict: true, esnext: true, newcap: false, globalstrict: true,
   devel: true, node: true */

'use strict';

const { DatabaseFactory } = require("../indexed-db-storage");
const { READ_ONLY, READ_WRITE } = require('../db/utils');
const { indexedDB } = require('sdk/indexed-db');

exports['test opendb'] = function (assert, done) {
  var dbName = "test1";
  DatabaseFactory.once('opened', function (db) {
    assert.pass('db opened event');
    assert.equal(dbName, db.name);
  });
  DatabaseFactory.once('upgraded', function (db) {
    assert.pass('db upgraded event');
    assert.equal(dbName, db.name);
  });
  DatabaseFactory.open(dbName).then(function (db) {
    var request = indexedDB.open(db.name, db.version);
    request.onsuccess = function (event) {
      assert.pass('db exists');
      assert.equal(event.target.result.name, db.name,
                   "db name is not the same");
      event.target.result.close();
      done();
    };
    request.onerror = function (event) {
      assert.fail('failed to open db');
    };
    request.addEventListener("upgradeneeded", function upgradeneeded(event) {
      assert.fail('no upgrade should be needed');
    });
  });
};

exports['test deletedb'] = function (assert, done) {
  var dbName = "test2";
  DatabaseFactory.once('deleted', function (name) {
    assert.pass('db deleted event');
    assert.equal(dbName, name);
  });
  DatabaseFactory.open(dbName).then(function (db) {
    DatabaseFactory.deleteDatabase(db.name).then(function (deldb) {
      var request = indexedDB.open(deldb.name, 1);
      request.onsuccess = function (event) {
        assert.pass('db exists eventually');
      };
      request.addEventListener("upgradeneeded", function (event) {
        assert.pass('upgrade needed because this db did not exist before');
        event.target.result.close();
        done();
      });
      request.onerror = function (event) {
        assert.fail('failed to open deleted db');
      };
    });
  });

};

exports['test open high version db'] = function (assert, done) {
  var dbName = "test4",
      version = 10;
  var request = indexedDB.open(dbName, version);
  request.onsuccess = function (event) {
    assert.pass('db created ' + event.target.result.version);
    event.target.result.close();
    DatabaseFactory.open(dbName).then(function (db) {
      assert.equal(version, db.version,
                   "We didn't open the db to the correct version");
      done();
    }, assert.fail);
  };
  request.onerror = function (event) {
    assert.fail('failed to open db');
  };
  request.addEventListener("upgradeneeded", function (event) {
    //assert.fail('no upgrade should be needed');
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
