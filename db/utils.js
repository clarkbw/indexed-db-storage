// https://mxr.mozilla.org/
// mozilla-central/source/dom/indexedDB/IDBDatabase.cpp#606
exports.READ_ONLY = "readonly";
exports.READ_WRITE = "readwrite";
exports.VERSION_CHANGE = "versionchange";

exports.logDomError = function logDomError(event) {
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
};
