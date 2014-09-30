/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, curly:true, browser:false, es5:true,
  indent:2, maxerr:50, devel:true, node:true, boss:true, white:true,
  globalstrict:true, nomen:false, newcap:true, esnext: true */

'use strict';

const { DatabaseFactory, READ_ONLY, READ_WRITE, VERSION_CHANGE } = require("../lib/indexed-db-storage");
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
      assert.equal(db._name(event.target.result.name), db.name,
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

exports['test open and create store'] = function (assert, done) {
  var dbName = "test3",
      storeName = "store1";
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName).then(function (store) {
      //console.log("stores", store.objectStoreNames, db.objectStoreNames);
      //console.log("names:", store.name, db.name);
      //console.log("versions: ", store.version, db.version);
      var request = indexedDB.open(db.name, db.version);
      request.onsuccess = function (event) {
        assert.pass('db exists');
        assert.ok(event.target.result.objectStoreNames.contains(storeName),
                  "We have the object store");
        assert.equal(db._name(event.target.result.name), db.name,
                     "db names are unequal");
        event.target.result.close();
        done();
      };
      request.onerror = function (event) {
        assert.fail('failed to open db');
      };
      request.addEventListener("upgradeneeded", function (event) {
        assert.fail('no upgrade should be needed');
      });
    });
  });
};

exports['test reopen and recreate store'] = function (assert, done) {
  var dbName = "test3",
      storeName = "store1",
      start = Date.now();
  DatabaseFactory.open(dbName).then(function (db) {
    console.log("open returned", Date.now() - start);
    db.createObjectStore(storeName).then(function (store) {
      console.log("objectStore returned", Date.now() - start);
      //console.log("stores", store.objectStoreNames, db.objectStoreNames);
      //console.log("names:", store.name, db.name);
      //console.log("versions: ", store.version, db.version);
      var request = indexedDB.open(db.name, db.version);
      request.onsuccess = function (event) {
        assert.pass('db exists');
        assert.ok(event.target.result.objectStoreNames.contains(storeName),
                  "We have the object store");
        assert.equal(db._name(event.target.result.name), db.name,
                     "db names are unequal");
        event.target.result.close();
        done();
      };
      request.onerror = function (event) {
        assert.fail('failed to open db');
      };
      request.addEventListener("upgradeneeded", function (event) {
        assert.fail('no upgrade should be needed');
      });
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

exports['test create objectstore w invalid options'] = function (assert, done) {
  var dbName = "test5",
      storeName = "store5";
  var failWithError = function (error) {
    assert.fail(error);
    done();
  };
  var passWithError = function (error) {
    assert.pass(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName,
                         { keyPath : -1 }).then(function (store) {
      assert.fail();
      done();
    }, passWithError);
  }, failWithError);
};

exports['test create objectstore with keypath'] = function (assert, done) {
  var dbName = "test5-1",
      storeName = "store5-1",
      keyPath = "key.path";
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName,
                         { keyPath : keyPath }).then(function (store) {
      assert.equal(keyPath, db.objectStores[storeName].keyPath,
                   "keyPath is not what we set");
      done();
    });
  });
};

exports['test objectstore autoincrement add'] = function (assert, done) {
  var dbName = "test6",
      storeName = "store6",
      obj = { "save" : "stuff" },
      options = { autoIncrement : true };
  var failWithError = function (error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName, options).then(function (store) {
      store.add(obj).then(function (key) {
        var request = indexedDB.open(dbName, db.version);
        request.onsuccess = function (event) {
          var result = event.target.result;
          var r = result.transaction(storeName)
                        .objectStore(storeName).get(key);
          r.onsuccess = function (event) {
            assert.equal(JSON.stringify(event.target.result),
                         JSON.stringify(obj),
                         "object added is not the same as the returned result");
            result.close();
            done();
          };
        };
        request.onerror = function (event) {
          assert.fail('failed to open db');
        };
        request.addEventListener("upgradeneeded", function (event) {
          assert.fail('no upgrade should be needed in this test');
        });
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore keyPath add'] = function (assert, done) {
  var dbName = "test7",
      storeName = "store7",
      obj = { "key" : { "path" : 1 }, "save" : "stuff" },
      options = { keyPath : "key.path" };
  var failWithError = function (error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName, options).then(function (store) {
      store.add(obj, "key").then(function (key) {
        var request = indexedDB.open(dbName, db.version);
        request.onsuccess = function (event) {
          var result = event.target.result;
          var r = result.transaction(storeName)
                        .objectStore(storeName).get(key);
          r.onsuccess = function (event) {
            assert.equal(JSON.stringify(event.target.result),
                         JSON.stringify(obj),
                         "object added is not the same as the returned result");
            result.close();
            done();
          };
        };
        request.onerror = function (event) {
          assert.fail('failed to open db');
        };
        request.addEventListener("upgradeneeded", function (event) {
          assert.fail('no upgrade should be needed in this test');
        });
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore manual key add'] = function (assert, done) {
  var dbName = "test8",
      storeName = "store8",
      key = "key8",
      obj = { "key" : { "path" : 1 }, "save" : "stuff" },
      options = { autoIncrement : false };
  var failWithError = function (error) {
    assert.fail(error);
    console.error(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName, options).then(function (store) {
      store.add(obj, key).then(function (k) {
        var request = indexedDB.open(dbName, db.version);
        request.onsuccess = function (event) {
          var result = event.target.result;
          var r = result.transaction(storeName)
                        .objectStore(storeName).get(k);
          r.onsuccess = function (event) {
            assert.equal(JSON.stringify(event.target.result),
                         JSON.stringify(obj),
                         "object added is not the same as the returned result");
            result.close();
            done();
          };
        };
        request.onerror = function (event) {
          assert.fail('failed to open db');
        };
        request.addEventListener("upgradeneeded", function (event) {
          assert.fail('no upgrade should be needed in this test');
        });
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore keyPath add.error'] = function (assert, done) {
  var dbName = "test9",
      storeName = "store9",
      obj = { "key" : { "path" : 1 }, "save" : "stuff" },
      options = { keyPath : "does.not.exist", autoIncrement : false };
  var passWithError = function (error) {
    assert.pass(error);
    done();
  };
  var failWithError = function (error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName, options).then(function (store) {
      store.add(obj).then(function (k) {
        assert.fail("we shouldn't be able to add an object without a proper" +
                    "key path");
      }, passWithError);
    }, failWithError);
  });
};

exports['test objectstore add and get and clear'] = function (assert, done) {
  var dbName = "test10",
      storeName = "store10",
      obj = { "save" : "stuff" },
      options = { autoIncrement : true };
  var failWithError = function (error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName, options).then(function (store) {
      store.add(obj).then(function (key) {
        store.get(key).then(function (ret) {
          assert.equal(JSON.stringify(ret), JSON.stringify(obj),
                       "returned object doesn't equal what we added");
          store.clear().then(function () {
            store.all().then(function (ret) {
              assert.ok(Array.isArray(ret), "we didn't get back an array");
              assert.equal(ret.length, 0,
                           "returned object isn't empty");
              done();
            }, failWithError);
          }, failWithError);
        }, failWithError);
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore get undefined'] = function (assert, done) {
  var dbName = "test11",
      storeName = "store11",
      key = "key11",
      options = { autoIncrement : true };
  var failWithError = function (error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName, options).then(function (store) {
      store.get(key).then(function (ret) {
        assert.equal(ret, undefined,
                     "returned object doesn't equal what we added");
        done();
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore all empty'] = function (assert, done) {
  var dbName = "test12",
      storeName = "store12";
  var failWithError = function (error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName).then(function (store) {
      store.all().then(function (ret) {
        assert.ok(Array.isArray(ret), "we didn't get back an array");
        assert.equal(ret.length, 0,
                     "returned object isn't empty");
        done();
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore add remove'] = function (assert, done) {
  var dbName = "test13",
      storeName = "store13",
      obj = { "save" : "stuff" },
      options = { autoIncrement : true };
  var failWithError = function (error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName, options).then(function (store) {
      store.add(obj).then(function (key) {
        store.remove(key).then(function (ret) {
          assert.equal(ret, undefined,
                       "entry is not coming back as undefined");
          var request = indexedDB.open(dbName, db.version);
          request.onsuccess = function (event) {
            var result = event.target.result;
            var r = result.transaction(storeName)
                          .objectStore(storeName).get(key);
            r.onsuccess = function (event) {
              assert.equal(event.target.result, undefined,
                           "result should be undefined");
              result.close();
              done();
            };
          };
          request.onerror = function (event) {
            console.log("error", event);
            assert.fail('failed to open db');
          };
          request.addEventListener("upgradeneeded", function (event) {
            assert.fail('no upgrade should be needed in this test');
          });
        }, failWithError);
      }, failWithError);
    }, failWithError);
  });
};

exports['test create index'] = function (assert, done) {
  var dbName = "test14",
      storeName = "store1",
      indexName = "index1",
      indexKeyPath = "value",
      options = {};
  var failWithError = function (error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName).then(function (store) {
      store.createIndex(indexName, indexKeyPath, options).then(function (index) {
        //console.log("stores", store.objectStoreNames, db.objectStoreNames);
        //console.log("names:", store.name, db.name);
        //console.log("versions: ", store.version, db.version);
        assert.equal(store.indexNames[0], indexName, "index names not equal");
        var request = indexedDB.open(dbName, db.version);
        request.onsuccess = function (event) {
          var result = event.target.result;
          var index = result.transaction(storeName, READ_ONLY).objectStore(storeName).index(indexName);
          assert.ok(index !== null, "index does not exist");
          assert.equal(index.name, indexName, 'index does not have the correct name');
          assert.equal(index.keyPath, indexKeyPath, 'index does not have the correct keyPath');
          event.target.result.close();
          done();
        };
        request.onerror = function (event) {
          assert.fail('failed to open db');
        };
        request.addEventListener("upgradeneeded", function (event) {
          assert.fail('no upgrade should be needed in this test');
        });
      });
    }, failWithError);
  }, failWithError);
};

exports['test000 double open and create store'] = function (assert, done) {
  var dbName = "test3",
      storeName1 = "store10",
      storeName2 = "store20";
  var failWithError = function (error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName1).then(function (store1) {
      db.createObjectStore(storeName2).then(function (store2) {
        var request = indexedDB.open(db.name, db.version);
        request.onsuccess = function (event) {
          assert.ok(event.target.result.objectStoreNames.contains(storeName1),
                    "We have the first object store");
          assert.ok(event.target.result.objectStoreNames.contains(storeName2),
                    "We have the second object store");
          event.target.result.close();
          done();
        };
        request.onerror = function (event) {
          assert.fail('failed to open db');
        };
        request.addEventListener("upgradeneeded", function (event) {
          assert.fail('no upgrade should be needed');
        });
      }, failWithError);
    }, failWithError);
  }, failWithError);
};

require('test').run(exports);
