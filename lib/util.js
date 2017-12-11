"use strict";

exports.__esModule = true;
exports.default = void 0;

var _bluebird = _interopRequireDefault(require("bluebird"));

var _couchPwd = _interopRequireDefault(require("couch-pwd"));

var _crypto = _interopRequireDefault(require("crypto"));

var _urlsafeBase = _interopRequireDefault(require("urlsafe-base64"));

var _uuid = _interopRequireDefault(require("uuid"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

Function.prototype.$asyncbind = function $asyncbind(self, catcher) {
  "use strict";

  if (!Function.prototype.$asyncbind) {
    Object.defineProperty(Function.prototype, "$asyncbind", {
      value: $asyncbind,
      enumerable: false,
      configurable: true,
      writable: true
    });
  }

  if (!$asyncbind.trampoline) {
    $asyncbind.trampoline = function trampoline(t, x, s, e, u) {
      return function b(q) {
        while (q) {
          if (q.then) {
            q = q.then(b, e);
            return u ? undefined : q;
          }

          try {
            if (q.pop) {
              if (q.length) return q.pop() ? x.call(t) : q;
              q = s;
            } else q = q.call(t);
          } catch (r) {
            return e(r);
          }
        }
      };
    };
  }

  if (!$asyncbind.LazyThenable) {
    $asyncbind.LazyThenable = function () {
      function isThenable(obj) {
        return obj && obj instanceof Object && typeof obj.then === "function";
      }

      function resolution(p, r, how) {
        try {
          var x = how ? how(r) : r;
          if (p === x) return p.reject(new TypeError("Promise resolution loop"));

          if (isThenable(x)) {
            x.then(function (y) {
              resolution(p, y);
            }, function (e) {
              p.reject(e);
            });
          } else {
            p.resolve(x);
          }
        } catch (ex) {
          p.reject(ex);
        }
      }

      function Chained() {}

      ;
      Chained.prototype = {
        resolve: _unchained,
        reject: _unchained,
        then: thenChain
      };

      function _unchained(v) {}

      function thenChain(res, rej) {
        this.resolve = res;
        this.reject = rej;
      }

      function then(res, rej) {
        var chain = new Chained();

        try {
          this._resolver(function (value) {
            return isThenable(value) ? value.then(res, rej) : resolution(chain, value, res);
          }, function (ex) {
            resolution(chain, ex, rej);
          });
        } catch (ex) {
          resolution(chain, ex, rej);
        }

        return chain;
      }

      function Thenable(resolver) {
        this._resolver = resolver;
        this.then = then;
      }

      ;

      Thenable.resolve = function (v) {
        return Thenable.isThenable(v) ? v : {
          then: function then(resolve) {
            return resolve(v);
          }
        };
      };

      Thenable.isThenable = isThenable;
      return Thenable;
    }();

    $asyncbind.EagerThenable = $asyncbind.Thenable = ($asyncbind.EagerThenableFactory = function (tick) {
      tick = tick || typeof process === "object" && process.nextTick || typeof setImmediate === "function" && setImmediate || function (f) {
        setTimeout(f, 0);
      };

      var soon = function () {
        var fq = [],
            fqStart = 0,
            bufferSize = 1024;

        function callQueue() {
          while (fq.length - fqStart) {
            try {
              fq[fqStart]();
            } catch (ex) {}

            fq[fqStart++] = undefined;

            if (fqStart === bufferSize) {
              fq.splice(0, bufferSize);
              fqStart = 0;
            }
          }
        }

        return function (fn) {
          fq.push(fn);
          if (fq.length - fqStart === 1) tick(callQueue);
        };
      }();

      function Zousan(func) {
        if (func) {
          var me = this;
          func(function (arg) {
            me.resolve(arg);
          }, function (arg) {
            me.reject(arg);
          });
        }
      }

      Zousan.prototype = {
        resolve: function resolve(value) {
          if (this.state !== undefined) return;
          if (value === this) return this.reject(new TypeError("Attempt to resolve promise with self"));
          var me = this;

          if (value && (typeof value === "function" || typeof value === "object")) {
            try {
              var first = 0;
              var then = value.then;

              if (typeof then === "function") {
                then.call(value, function (ra) {
                  if (!first++) {
                    me.resolve(ra);
                  }
                }, function (rr) {
                  if (!first++) {
                    me.reject(rr);
                  }
                });
                return;
              }
            } catch (e) {
              if (!first) this.reject(e);
              return;
            }
          }

          this.state = STATE_FULFILLED;
          this.v = value;
          if (me.c) soon(function () {
            for (var n = 0, l = me.c.length; n < l; n++) {
              STATE_FULFILLED(me.c[n], value);
            }
          });
        },
        reject: function reject(reason) {
          if (this.state !== undefined) return;
          this.state = STATE_REJECTED;
          this.v = reason;
          var clients = this.c;
          if (clients) soon(function () {
            for (var n = 0, l = clients.length; n < l; n++) {
              STATE_REJECTED(clients[n], reason);
            }
          });
        },
        then: function then(onF, onR) {
          var p = new Zousan();
          var client = {
            y: onF,
            n: onR,
            p: p
          };

          if (this.state === undefined) {
            if (this.c) this.c.push(client);else this.c = [client];
          } else {
            var s = this.state,
                a = this.v;
            soon(function () {
              s(client, a);
            });
          }

          return p;
        }
      };

      function STATE_FULFILLED(c, arg) {
        if (typeof c.y === "function") {
          try {
            var yret = c.y.call(undefined, arg);
            c.p.resolve(yret);
          } catch (err) {
            c.p.reject(err);
          }
        } else c.p.resolve(arg);
      }

      function STATE_REJECTED(c, reason) {
        if (typeof c.n === "function") {
          try {
            var yret = c.n.call(undefined, reason);
            c.p.resolve(yret);
          } catch (err) {
            c.p.reject(err);
          }
        } else c.p.reject(reason);
      }

      Zousan.resolve = function (val) {
        if (val && val instanceof Zousan) return val;
        var z = new Zousan();
        z.resolve(val);
        return z;
      };

      Zousan.reject = function (err) {
        if (err && err instanceof Zousan) return err;
        var z = new Zousan();
        z.reject(err);
        return z;
      };

      Zousan.version = "2.3.3-nodent";
      return Zousan;
    })();
  }

  var resolver = this;

  switch (catcher) {
    case true:
      return new $asyncbind.Thenable(boundThen);

    case 0:
      return new $asyncbind.LazyThenable(boundThen);

    case undefined:
      boundThen.then = boundThen;
      return boundThen;

    default:
      return function () {
        try {
          return resolver.apply(self, arguments);
        } catch (ex) {
          return catcher(ex);
        }
      };
  }

  function boundThen() {
    return resolver.apply(self, arguments);
  }
};

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } } function _next(value) { step("next", value); } function _throw(err) { step("throw", err); } _next(); }); }; }

var URLSafeUUID = function URLSafeUUID() {
  return _urlsafeBase.default.encode(_uuid.default.v4(null, new Buffer(16)));
};

var hashToken = function hashToken(token) {
  return _crypto.default.createHash('sha256').update(token).digest('hex');
};

var hashPassword =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(function* (password) {
    return new Promise(function (resolve, reject) {
      _couchPwd.default.hash(password, function (err, salt, hash) {
        if (err) {
          return reject(err);
        }

        return resolve({
          salt: salt,
          derived_key: hash
        });
      });
    });
  });

  return function hashPassword(_x) {
    return _ref.apply(this, arguments);
  };
}();

var verifyPassword =
/*#__PURE__*/
function () {
  var _ref2 = _asyncToGenerator(function* (hashObj, password) {
    // tslint:disable-next-line:no-any
    var getHash = _bluebird.default.promisify(_couchPwd.default.hash, {
      context: _couchPwd.default
    });

    var iterations = hashObj.iterations,
        salt = hashObj.salt,
        derived_key = hashObj.derived_key;

    if (iterations) {
      _couchPwd.default.iterations(iterations);
    }

    if (!salt || !derived_key) {
      return Promise.reject(false);
    }

    var hash = yield getHash(password, salt);

    if (hash === derived_key) {
      return Promise.resolve(true);
    }

    return Promise.reject(false);
  });

  return function verifyPassword(_x2, _x3) {
    return _ref2.apply(this, arguments);
  };
}();

var getDBURL = function getDBURL(db) {
  var url;

  if (db.user) {
    url = db.protocol + encodeURIComponent(db.user) + ":" + encodeURIComponent(db.password) + "@" + db.host;
  } else {
    url = db.protocol + db.host;
  }

  return url;
};

var getFullDBURL = function getFullDBURL(dbConfig, dbName) {
  return getDBURL(dbConfig) + "/" + dbName;
}; // tslint:disable-next-line:no-any


var toArray = function toArray(obj) {
  if (!(obj instanceof Array)) {
    obj = [obj];
  }

  return obj;
};

var getSessions = function getSessions(userDoc) {
  var sessions = [];

  if (userDoc.session) {
    Object.keys(userDoc.session).forEach(function (mySession) {
      sessions.push(mySession);
    });
  }

  return sessions;
};

var getExpiredSessions = function getExpiredSessions(userDoc, now) {
  var sessions = [];

  if (userDoc.session) {
    Object.keys(userDoc.session).forEach(function (mySession) {
      if (userDoc.session[mySession].expires <= now) {
        sessions.push(mySession);
      }
    });
  }

  return sessions;
}; // Takes a req object and returns the bearer token, or undefined if it is not found


var getSessionToken = function getSessionToken(req) {
  if (req.headers && req.headers.authorization) {
    var _auth = req.headers.authorization;

    var parts = _auth.split(' ');

    if (parts.length === 2) {
      var scheme = parts[0];
      var credentials = parts[1];

      if (/^Bearer$/i.test(scheme)) {
        var parse = credentials.split(':');

        if (parse.length < 2) {
          return undefined;
        }

        return parse[0];
      }
    }
  }

  return undefined;
}; // Generates views for each registered provider in the user design doc


var addProvidersToDesignDoc = function addProvidersToDesignDoc(config, ddoc) {
  var providers = config.getItem('providers');

  if (!providers) {
    return ddoc;
  }

  var ddocTemplate = function ddocTemplate(provider) {
    return "function(doc){ if(doc." + provider + " && doc." + provider + ".profile) { emit(doc." + provider + ".profile.id,null); } }";
  };

  Object.keys(providers).forEach(function (provider) {
    ddoc.auth.views[provider] = {
      map: ddocTemplate(provider)
    };
  });
  return ddoc;
}; // Capitalizes the first letter of a string


var capitalizeFirstLetter = function capitalizeFirstLetter(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
};
/**
 * Access nested JavaScript objects with string key
 * http://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-with-string-key
 *
 * @param {object} obj The base object you want to get a reference to
 * @param {string} str The string addressing the part of the object you want
 * @return {object|undefined} a reference to the requested key or undefined if not found
 */


var getObjectRef = function getObjectRef(obj, str) {
  str = str.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties

  str = str.replace(/^\./, ''); // strip a leading dot

  var pList = str.split('.');

  while (pList.length) {
    var n = pList.shift();

    if (n && n in obj) {
      obj = obj[n];
    } else {
      return undefined;
    }
  }

  return obj;
};
/**
 * Dynamically set property of nested object
 * http://stackoverflow.com/questions/18936915/dynamically-set-property-of-nested-object
 *
 * @param {object} obj The base object you want to set the property in
 * @param {string} str The string addressing the part of the object you want
 * @param {*} val The value you want to set the property to
 * @return {*} the value the reference was set to
 */


var setObjectRef = function setObjectRef(obj, str, val) {
  str = str.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties

  str = str.replace(/^\./, ''); // strip a leading dot

  var pList = str.split('.');
  var len = pList.length;

  for (var i = 0; i < len - 1; i += 1) {
    var elem = pList[i];

    if (!obj[elem]) {
      obj[elem] = {};
    }

    obj = obj[elem];
  }

  obj[pList[len - 1]] = val;
  return val;
};
/**
 * Dynamically delete property of nested object
 *
 * @param {object} obj The base object you want to set the property in
 * @param {string} str The string addressing the part of the object you want
 * @return {boolean} true if successful
 */


var delObjectRef = function delObjectRef(obj, str) {
  str = str.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties

  str = str.replace(/^\./, ''); // strip a leading dot

  var pList = str.split('.');
  var len = pList.length;
  pList.forEach(function (elem) {
    if (obj[elem]) {
      obj = obj[elem];
    }
  });
  delete obj[pList[len - 1]];
  return true;
};
/**
 * Concatenates two arrays and removes duplicate elements
 *
 * @param {array} a First array
 * @param {array} b Second array
 * @return {array} resulting array
 */
// tslint:disable-next-line:no-any


var arrayUnion = function arrayUnion(a, b) {
  var result = a.concat(b);

  for (var i = 0; i < result.length; i += 1) {
    for (var j = i + 1; j < result.length; j += 1) {
      if (result[i] === result[j]) {
        result.splice(j -= 1, 1);
      }
    }
  }

  return result;
};

var _default = {
  URLSafeUUID: URLSafeUUID,
  hashToken: hashToken,
  hashPassword: hashPassword,
  verifyPassword: verifyPassword,
  getDBURL: getDBURL,
  getFullDBURL: getFullDBURL,
  getSessions: getSessions,
  getExpiredSessions: getExpiredSessions,
  getSessionToken: getSessionToken,
  addProvidersToDesignDoc: addProvidersToDesignDoc,
  capitalizeFirstLetter: capitalizeFirstLetter,
  getObjectRef: getObjectRef,
  setObjectRef: setObjectRef,
  delObjectRef: delObjectRef,
  arrayUnion: arrayUnion,
  toArray: toArray
};
exports.default = _default;