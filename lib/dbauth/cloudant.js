"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _url = _interopRequireDefault(require("url"));

var _bluebird = _interopRequireDefault(require("bluebird"));

var _superagent = _interopRequireDefault(require("superagent"));

var _util = _interopRequireDefault(require("./../util"));

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
          then: function (resolve) {
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
        resolve: function (value) {
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
            for (var n = 0, l = me.c.length; n < l; n++) STATE_FULFILLED(me.c[n], value);
          });
        },
        reject: function (reason) {
          if (this.state !== undefined) return;
          this.state = STATE_REJECTED;
          this.v = reason;
          var clients = this.c;
          if (clients) soon(function () {
            for (var n = 0, l = clients.length; n < l; n++) STATE_REJECTED(clients[n], reason);
          });
        },
        then: function (onF, onR) {
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

const getSecurityUrl = db => {
  const parsedUrl = _url.default.parse(db.name);

  parsedUrl.pathname += '/_security';
  return _url.default.format(parsedUrl);
};

const getAPIKey = db => new Promise(function ($return, $error) {
  var parsedUrl, finalUrl, res, result;
  parsedUrl = _url.default.parse(db.name);
  parsedUrl.pathname = '/_api/v2/api_keys';
  finalUrl = _url.default.format(parsedUrl);

  var $Try_1_Post = function () {
    return $return();
  }.$asyncbind(this, $error);

  var $Try_1_Catch = function (error) {
    console.log('error getting api key!', error);
    return $return(Promise.reject(error));
  }.$asyncbind(this, $error);

  try {
    return _superagent.default.post(finalUrl).then(function ($await_2) {
      res = $await_2;

      if (res) {
        result = JSON.parse(res.text);

        if (result.key && result.password && result.ok === true) {
          return $return(result);
        }

        return $return(Promise.reject(result));
      }

      return $Try_1_Post();
    }.$asyncbind(this, $Try_1_Catch), $Try_1_Catch);
  } catch (error) {
    $Try_1_Catch(error)
  }
}.$asyncbind(void 0));

const getSecurityCloudant = db => {
  const finalUrl = getSecurityUrl(db);
  return _bluebird.default.fromNode(callback => {
    _superagent.default.get(finalUrl) //       .set(db.getHeaders())
    .end(callback);
  }).then(res => Promise.resolve(JSON.parse(res.text)));
};

const putSecurityCloudant = (db, doc) => {
  const finalUrl = getSecurityUrl(db);
  return _bluebird.default.fromNode(callback => {
    _superagent.default.put(finalUrl) //       .set(db.getHeaders())
    .send(doc).end(callback);
  }).then(res => Promise.resolve(JSON.parse(res.text)));
}; // This is not needed with Cloudant


const storeKey = () => Promise.resolve(); // This is not needed with Cloudant


const removeKeys = () => Promise.resolve();

const initSecurity = (db, adminRoles, memberRoles) => {
  let changes = false;
  return db.get('_security').then(secDoc => {
    if (!secDoc.admins) {
      secDoc.admins = {
        names: [],
        roles: []
      };
    }

    if (!secDoc.admins.roles) {
      secDoc.admins.roles = [];
    }

    if (!secDoc.members) {
      secDoc.members = {
        names: [],
        roles: []
      };
    }

    if (!secDoc.members.roles) {
      secDoc.admins.roles = [];
    }

    adminRoles.forEach(role => {
      if (secDoc.admins.roles.indexOf(role) === -1) {
        changes = true;
        secDoc.admins.roles.push(role);
      }
    });
    memberRoles.forEach(role => {
      if (secDoc.members.roles.indexOf(role) === -1) {
        changes = true;
        secDoc.members.roles.push(role);
      }
    });

    if (changes) {
      return putSecurityCloudant(db, secDoc);
    }

    return Promise.resolve(false);
  });
};

const authorizeKeys = (user_id, db, keys, permissions, roles) => {
  let keysObj = {};

  if (!permissions) {
    permissions = ['_reader', '_replicator'];
  }

  permissions = permissions.concat(roles || []);
  permissions.unshift(`user:${user_id}`); // If keys is a single value convert it to an Array

  keys = _util.default.toArray(keys); // Check if keys is an array and convert it to an object

  if (keys instanceof Array) {
    keys.forEach(key => {
      keysObj[key] = permissions;
    });
  } else {
    keysObj = keys;
  } // Pull the current _security doc


  return getSecurityCloudant(db).then(secDoc => {
    if (!secDoc._id) {
      secDoc._id = '_security';
    }

    if (!secDoc.cloudant) {
      secDoc.cloudant = {};
    }

    Object.keys(keysObj).forEach(key => secDoc.cloudant[key] = keysObj[key]);
    return putSecurityCloudant(db, secDoc);
  });
};

const deauthorizeKeys = (db, keys) => {
  // cast keys to an Array
  keys = _util.default.toArray(keys);
  return getSecurityCloudant(db).then(secDoc => {
    let changes = false;

    if (!secDoc.cloudant) {
      return Promise.resolve(false);
    }

    keys.forEach(key => {
      if (secDoc.cloudant[key]) {
        changes = true;
        delete secDoc.cloudant[key];
      }
    });

    if (changes) {
      return putSecurityCloudant(db, secDoc);
    }

    return Promise.resolve(false);
  });
};

var _default = {
  getAPIKey,
  getSecurityCloudant,
  putSecurityCloudant,
  storeKey,
  removeKeys,
  initSecurity,
  authorizeKeys,
  deauthorizeKeys
};
exports.default = _default;