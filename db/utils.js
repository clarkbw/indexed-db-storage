/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* jshint strict: true, esnext: true, newcap: false, globalstrict: true,
   devel: true, node: true */

'use strict';

// https://mxr.mozilla.org/
// mozilla-central/source/dom/indexedDB/IDBDatabase.cpp#606
exports.READ_ONLY = 'readonly';
exports.READ_WRITE = 'readwrite';
exports.VERSION_CHANGE = 'versionchange';

exports.logDomError = function logDomError(event) {
  console.log('_onerror', event);
  switch (event.target.error.name) {
  case 'VersionError':
    console.log('DOMException.VersionError');
    break;
  case 'AbortError':
    console.log('DOMException.AbortError');
    break;
  case 'ConstraintError':
    console.log('DOMException.ConstraintError');
    break;
  case 'QuotaExceededError':
    console.log('DOMException.QuotaExceededError');
    break;
  case 'UnknownError':
    console.log('DOMException.UnknownError');
    break;
  case 'NoError':
    console.log('DOMException.NoError');
    break;
  }
};
