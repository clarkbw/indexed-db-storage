/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, curly:true, browser:false, es5:true,
  indent:2, maxerr:50, devel:true, node:true, boss:true, white:true,
  globalstrict:true, nomen:false, newcap:true, esnext: true */

'use strict';

var DatabaseFactory = require("indexed-db-storage").DatabaseFactory;
var indexedDB = require('indexed-db').indexedDB;

exports['test opendb'] = function (assert, done) {
  var dbName = "test1";
  DatabaseFactory.open(dbName).then(function (db) {
    var request = indexedDB.open(db.name, db.version);
    request.onsuccess = function (event) {
      assert.pass('db exists');
      assert.equal(db._name(event.target.result.name), db.name,
                   "db name is not the same");
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
  DatabaseFactory.open(dbName).then(function (db) {
    DatabaseFactory.deleteDatabase(db.name).then(function (deldb) {
      var request = indexedDB.open(deldb.name, 1);
      request.onsuccess = function (event) {
        assert.pass('db exists eventually');
      };
      request.addEventListener("upgradeneeded", function (event) {
        assert.pass('upgrade needed because this db did not exist before');
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

exports['test objectstore add and get'] = function (assert, done) {
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
          done();
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
          assert.equal(JSON.stringify(ret), JSON.stringify(key),
                       "key returned is the same");
          var request = indexedDB.open(dbName, db.version);
          request.onsuccess = function (event) {
            var result = event.target.result;
            var r = result.transaction(storeName)
                          .objectStore(storeName).get(key);
            r.onsuccess = function (event) {
              assert.equal(event.target.result, undefined,
                           "result should be undefined");
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

/*exports['test if key exists'] = function (assert, done) {
  var dbName = "test5",
      storeName = "store5",
      key = "key1",
      obj = { "save" : "stuff" };
  DatabaseFactory.open(dbName).then(function (db) {
    db.createObjectStore(storeName).then(function (store) {
      console.log("adding", key, obj);
      db.add(key, obj).then(function (added) {
        console.log("added", added);
        db.exists(key).then(function (value) {
          console.log("value", value);
          assert.equal(obj, value, "the object we saved exists");
          done();
        });
      });
    });
  });
}*/;

//exports['test add'] = function (assert, done) {
//  var dbName = "test3",
//      objectName = "object3",
//      key = "key1",
//      value = { "save" : "stuff" };
//  DatabaseFactory.open(dbName).then(function (db) {
//    db.get(objectName).then(function (storage) {
//      console.log("got it ", storage);
//    });
//    storage.add(key, value).then(function (results) {
//      assert.equal(results.save,
//                   value.save, 'Value returned is correct');
//      var req = indexedDB.open(dbName);
//      req.onsuccess = function (event) {
//        var db = event.target.result;
//        var transaction = db.transaction([dbName]);
//        var objectStore = transaction.objectStore(dbName);
//        var request = objectStore.get(key);
//        request.onerror = function (ev) {
//          assert.fail('Failed to retrive data');
//        };
//        request.onsuccess = function (ev) {
//          assert.equal(ev.target.result.save,
//                       value.save, 'Value read is correct');
//          done();
//        };
//      };
//      req.onerror = function (event) {
//        assert.fail('failed to open db');
//      };
//      assert.pass("storage added " + results.save);
//    });
//  });
//};
//
//exports['test all'] = function (assert, done) {
//  var dbName = "test4",
//      key1 = "key1",
//      value1 = { "save" : "stuff" },
//      key2 = "key1",
//      value2 = { "save" : "stuff" };
//  DatabaseFactory.open(dbName).then(function (storage) {
//    var request = indexedDB.open(dbName);
//    request.onsuccess = function (event) {
//      assert.pass('db exists');
//    };
//    request.onerror = function (event) {
//      assert.fail('failed to open db');
//    };
//    storage.add(key1, value1).then(function (one) {
//      console.log("one", one);
//      storage.add(key2, value2).then(function (two) {
//        console.log("two", two);
//        storage.all().then(function (results) {
//          console.log(results);
//          for (var i in results) {
//            console.log("i", i, results[i]);
//          }
//          assert.pass("db get" + results);
//          done();
//        });
//      });
//    });
//  });
//};

require('test').run(exports);
