<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

<!-- contributed by Bryan Clark [clarkbw@gmail.com] -->

The `indexed-db-storage` module provides a
[promise](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/packages/api-utils/promise.html)
based interface to the [indexed-db](https://developer.mozilla.org/en-US/docs/IndexedDB) storage system for use in the [mozilla addon-sdk](https://github.com/mozilla/addon-sdk/) system.

## DatabaseFactory
`DatabaseFactory` is a singleton object that maps to an [IDBFactory](https://developer.mozilla.org/en-US/docs/IndexedDB/IDBFactory).  It's primary purpose is to open and manage `Database` objects.

### Functions
#### open(`name`)
open takes only a `name` as a parameter.  If the `Database` already exists the `DatabaseFactory` will determine the version of the database and return it.  If the `Database` does not already exist it will create a new database and return that.

example:

```
DatabaseFactory.open('foo').then(function (db) { 
   console.log(db.name, " === foo"); 
}); 
```

#### deleteDatabase(`name`)
deleteDatabase requires a `name` parameter and will 

example:

```
DatabaseFactory.deleteDatabase('foo').then(function (db) { 
   console.log("the database has been deleted"); 
}); 
```

## Database
`Database` objects map to an [IDBDatabase](https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase)

### Properties

#### `name`
Name given to the `Database` when it was opened.

#### `version`
Current version of the `Database`.

#### `objectStoreNames`
Array of Strings that represent the names of the `ObjectStore`s this `Database` holds.

### Functions

#### _name(`name`)
Currently all names are being prefixed with the id of the add-on using this API.  Once 
[bug 786688](https://bugzilla.mozilla.org/show_bug.cgi?id=786688) is fixed we'll no longer need
this function and will likely no longer be able to see outside our add-ons scope.  (without this prefixed wrapper we could open databases from other add-ons)

#### createObjectStore(`name`, `options`)
Requires a `name` parameter and takes an `options` parameter as optional.  Options can include `keyPath` or `autoIncrement`.

The function creates an `ObjectStore` in the current `Database` and returns the object.  If the object store already exists this will simply return the existing object store.

example:

```
DatabaseFactory.deleteDatabase('foo').then(function (db) { 
   db.createObjectStore('store').then(function (store) {
      console.log("the object store " + store.name + " has been created"); 
   });
}); 
```

#### close()
Will close this `Database` causing all current and future transactions on this Database to fail until it is reopened.

## ObjectStore
`ObjectStore` objects map to an [IDBObjectStore](https://developer.mozilla.org/en-US/docs/IndexedDB/IDBObjectStore)

### Properties

#### `name`
Name given to the `ObjectStore` when it was created.

#### `keyPath`
The keyPath the `ObjectStore` was initialized with.  A keyPath is a string with dot notation indicating how to access the unique key of the objects you wish to save in this `ObjectStore`.

example:

`{ keyPath : "path.to.keys" }` would require objects that had a structure like this `{ 'path' : { 'to' : { 'keys' : unique } }, 'data' : 'stuff' }` where the `path` is the object that holds the object `to` which holds the object `keys` which actually references the unique id you'll query for when retrieving objects.

#### `autoIncrement`
The autoIncrement property indicates if this `ObjectStore` was created using auto-incrementing keys.  Meaning this `ObjectStore` was created with the options `{ autoIncrement : true }` and all keys will be simple incrementing integers.

### Functions

#### add(`obj`, `key`)
The `obj` parameter is required and the `key` parameter is optional if your `ObjectStore` was initialized with either auto-incrementing keys or a keyPath that will be derived from the objects.  

example:

```
DatabaseFactory.deleteDatabase('foo').then(function (db) {
   db.createObjectStore('store').then(function (store) {
      store.add({ 'mad' : 'men' }).then(function (key) {
         console.log('our object was stored with the key " + key);
      });
   });
});
```

#### get(`key`)
The `key` parameter is required.

This function returns the object associated with the parameter `key` otherwise it returns `undefined`.

example:

```
DatabaseFactory.deleteDatabase('foo').then(function (db) {
   db.createObjectStore('store').then(function (store) {
      store.get(1).then(function (obj) {
         console.log('the object at key 1 is: " + obj);
      });
   });
});
```

#### all()
This function returns all the objects stored in this `ObjectStore` as an array.

example:

```
DatabaseFactory.deleteDatabase('foo').then(function (db) {
   db.createObjectStore('store').then(function (store) {
      store.all().then(function (objs) {
         console.log('all the objects in the store are: " + objs.join(","));
      });
   });
});
```

#### remove(`key`)
The `key` parameter is required.

This function removes the object associated with the parameter `key`.

example:

```
DatabaseFactory.deleteDatabase('foo').then(function (db) {
   db.createObjectStore('store').then(function (store) {
      store.add({ "save" : "this" }).then(function (key) {
         store.remove(key).then(function (rkey) {
          console.log('deleted the object stored under the key: " + rkey);
         });
      });
   });
});
```
