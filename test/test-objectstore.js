/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* jshint strict: true, esnext: true, newcap: false, globalstrict: true,
   devel: true, node: true */

'use strict';

const { DatabaseFactory } = require('../indexed-db-storage');
const { READ_ONLY, READ_WRITE } = require('../db/utils');
const { indexedDB } = require('sdk/indexed-db');

exports['test open and create store'] = function(assert, done) {
  var dbName = 'test3';
  var storeName = 'store1';
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName).then(function(store) {
      //console.log('stores', store.objectStoreNames, db.objectStoreNames);
      //console.log('names:', store.name, db.name);
      //console.log('versions: ', store.version, db.version);
      var request = indexedDB.open(db.name, db.version);
      request.onsuccess = function(event) {
        assert.pass('db exists');
        assert.ok(event.target.result.objectStoreNames.contains(storeName),
                  'We have the object store');
        assert.equal(event.target.result.name, db.name,
                     'db names are unequal');
        event.target.result.close();
        done();
      };
      request.onerror = function(event) {
        assert.fail('failed to open db');
      };
      request.addEventListener('upgradeneeded', function(event) {
        assert.fail('no upgrade should be needed');
      });
    });
  });
};

exports['test reopen and recreate store'] = function(assert, done) {
  var dbName = 'test3';
  var storeName = 'store1';
  var start = Date.now();
  DatabaseFactory.open(dbName).then(function(db) {
    console.log('open returned', Date.now() - start);
    db.createObjectStore(storeName).then(function(store) {
      console.log('objectStore returned', Date.now() - start);
      //console.log('stores', store.objectStoreNames, db.objectStoreNames);
      //console.log('names:', store.name, db.name);
      //console.log('versions: ', store.version, db.version);
      var request = indexedDB.open(db.name, db.version);
      request.onsuccess = function(event) {
        assert.pass('db exists');
        assert.ok(event.target.result.objectStoreNames.contains(storeName),
                  'We have the object store');
        assert.equal(event.target.result.name, db.name,
                     'db names are unequal');
        event.target.result.close();
        done();
      };
      request.onerror = function(event) {
        assert.fail('failed to open db');
      };
      request.addEventListener('upgradeneeded', function(event) {
        assert.fail('no upgrade should be needed');
      });
    });
  });
};

exports['test create objectstore w invalid options'] = function(assert, done) {
  var dbName = 'test5';
  var storeName = 'store5';
  var failWithError = function(error) {
    assert.fail(error);
    done();
  };
  var passWithError = function(error) {
    assert.pass(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName,
                         {keyPath : -1}).then(function(store) {
      assert.fail();
      done();
    }, passWithError);
  }, failWithError);
};

exports['test create objectstore with keypath'] = function(assert, done) {
  var dbName = 'test5-1';
  var storeName = 'store5-1';
  var keyPath = 'key.path';
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName,
                         {keyPath : keyPath}).then(function(store) {
      assert.equal(keyPath, db.objectStores[storeName].keyPath,
                   'keyPath is not what we set');
      done();
    });
  });
};

exports['test objectstore autoincrement add'] = function(assert, done) {
  var dbName = 'test6';
  var storeName = 'store6';
  var obj = {'save' : 'stuff'};
  var options = {autoIncrement : true};
  var failWithError = function(error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName, options).then(function(store) {
      store.add(obj).then(function(key) {
        var request = indexedDB.open(dbName, db.version);
        request.onsuccess = function(event) {
          var result = event.target.result;
          var r = result.transaction(storeName)
                        .objectStore(storeName).get(key);
          r.onsuccess = function(event) {
            assert.equal(JSON.stringify(event.target.result),
                         JSON.stringify(obj),
                         'object added is not the same as the returned result');
            result.close();
            done();
          };
        };
        request.onerror = function(event) {
          assert.fail('failed to open db');
        };
        request.addEventListener('upgradeneeded', function(event) {
          assert.fail('no upgrade should be needed in this test');
        });
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore keyPath add'] = function(assert, done) {
  var dbName = 'test7';
  var storeName = 'store7';
  var obj = {'key' : {'path' : 1}, 'save' : 'stuff'};
  var options = {keyPath : 'key.path'};
  var failWithError = function(error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName, options).then(function(store) {
      store.add(obj, 'key').then(function(key) {
        var request = indexedDB.open(dbName, db.version);
        request.onsuccess = function(event) {
          var result = event.target.result;
          var r = result.transaction(storeName)
                        .objectStore(storeName).get(key);
          r.onsuccess = function(event) {
            assert.equal(JSON.stringify(event.target.result),
                         JSON.stringify(obj),
                         'object added is not the same as the returned result');
            result.close();
            done();
          };
        };
        request.onerror = function(event) {
          assert.fail('failed to open db');
        };
        request.addEventListener('upgradeneeded', function(event) {
          assert.fail('no upgrade should be needed in this test');
        });
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore manual key add'] = function(assert, done) {
  var dbName = 'test8';
  var storeName = 'store8';
  var key = 'key8';
  var obj = {'key' : {'path' : 1}, 'save' : 'stuff'};
  var options = {autoIncrement : false};
  var failWithError = function(error) {
    assert.fail(error);
    console.error(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName, options).then(function(store) {
      store.add(obj, key).then(function(k) {
        var request = indexedDB.open(dbName, db.version);
        request.onsuccess = function(event) {
          var result = event.target.result;
          var r = result.transaction(storeName)
                        .objectStore(storeName).get(k);
          r.onsuccess = function(event) {
            assert.equal(JSON.stringify(event.target.result),
                         JSON.stringify(obj),
                         'object added is not the same as the returned result');
            result.close();
            done();
          };
        };
        request.onerror = function(event) {
          assert.fail('failed to open db');
        };
        request.addEventListener('upgradeneeded', function(event) {
          assert.fail('no upgrade should be needed in this test');
        });
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore keyPath add.error'] = function(assert, done) {
  var dbName = 'test9';
  var storeName = 'store9';
  var obj = {'key' : {'path' : 1}, 'save' : 'stuff'};
  var options = {keyPath : 'does.not.exist', autoIncrement : false};
  var passWithError = function(error) {
    assert.pass(error);
    done();
  };
  var failWithError = function(error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName, options).then(function(store) {
      store.add(obj).then(function(k) {
        assert.fail('we shouldn\'t be able to add an object without a proper' +
                    'key path');
      }, passWithError);
    }, failWithError);
  });
};

exports['test objectstore add and get and clear'] = function(assert, done) {
  var dbName = 'test10';
  var storeName = 'store10';
  var obj = {'save' : 'stuff'};
  var options = {autoIncrement : true};
  var failWithError = function(error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName, options).then(function(store) {
      store.add(obj).then(function(key) {
        store.get(key).then(function(ret) {
          assert.equal(JSON.stringify(ret), JSON.stringify(obj),
                       'returned object doesn\'t equal what we added');
          store.clear().then(function() {
            store.all().then(function(ret) {
              assert.ok(Array.isArray(ret), 'we didn\'t get back an array');
              assert.equal(ret.length, 0,
                           'returned object isn\'t empty');
              done();
            }, failWithError);
          }, failWithError);
        }, failWithError);
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore get undefined'] = function(assert, done) {
  var dbName = 'test11';
  var storeName = 'store11';
  var key = 'key11';
  var options = {autoIncrement : true};
  var failWithError = function(error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName, options).then(function(store) {
      store.get(key).then(function(ret) {
        assert.equal(ret, undefined,
                     'returned object doesn\'t equal what we added');
        done();
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore all empty'] = function(assert, done) {
  var dbName = 'test12';
  var storeName = 'store12';
  var failWithError = function(error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName).then(function(store) {
      store.all().then(function(ret) {
        assert.ok(Array.isArray(ret), 'we didn\'t get back an array');
        assert.equal(ret.length, 0,
                     'returned object isn\'t empty');
        done();
      }, failWithError);
    }, failWithError);
  });
};

exports['test objectstore add remove'] = function(assert, done) {
  var dbName = 'test13';
  var storeName = 'store13';
  var obj = {'save' : 'stuff'};
  var options = {autoIncrement : true};
  var failWithError = function(error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName, options).then(function(store) {
      store.add(obj).then(function(key) {
        store.remove(key).then(function(ret) {
          assert.equal(ret, undefined,
                       'entry is not coming back as undefined');
          var request = indexedDB.open(dbName, db.version);
          request.onsuccess = function(event) {
            var result = event.target.result;
            var r = result.transaction(storeName)
                          .objectStore(storeName).get(key);
            r.onsuccess = function(event) {
              assert.equal(event.target.result, undefined,
                           'result should be undefined');
              result.close();
              done();
            };
          };
          request.onerror = function(event) {
            console.log('error', event);
            assert.fail('failed to open db');
          };
          request.addEventListener('upgradeneeded', function(event) {
            assert.fail('no upgrade should be needed in this test');
          });
        }, failWithError);
      }, failWithError);
    }, failWithError);
  });
};

exports['test000 double open and create store'] = function(assert, done) {
  var dbName = 'test3';
  var storeName1 = 'store10';
  var storeName2 = 'store20';
  var failWithError = function(error) {
    assert.fail(error);
    done();
  };
  DatabaseFactory.open(dbName).then(function(db) {
    db.createObjectStore(storeName1).then(function(store1) {
      db.createObjectStore(storeName2).then(function(store2) {
        var request = indexedDB.open(db.name, db.version);
        request.onsuccess = function(event) {
          assert.ok(event.target.result.objectStoreNames.contains(storeName1),
                    'We have the first object store');
          assert.ok(event.target.result.objectStoreNames.contains(storeName2),
                    'We have the second object store');
          event.target.result.close();
          done();
        };
        request.onerror = function(event) {
          assert.fail('failed to open db');
        };
        request.addEventListener('upgradeneeded', function(event) {
          assert.fail('no upgrade should be needed');
        });
      }, failWithError);
    }, failWithError);
  }, failWithError);
};

require('test').run(exports);
