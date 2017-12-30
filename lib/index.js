"use strict";

exports.__esModule = true;
exports.default = void 0;

var _ejs = require("ejs");

var _events = _interopRequireDefault(require("events"));

var _express = _interopRequireDefault(require("express"));

var _passport = _interopRequireWildcard(require("passport"));

var _pouchdbNode = _interopRequireDefault(require("pouchdb-node"));

var _pouchdbSecurityHelper = _interopRequireDefault(require("pouchdb-security-helper"));

var _pouchdbSeedDesign = _interopRequireDefault(require("pouchdb-seed-design"));

var _pouchdbUpsert = _interopRequireDefault(require("pouchdb-upsert"));

var _default2 = _interopRequireDefault(require("./config/default.config"));

var _configure = _interopRequireDefault(require("./configure"));

var _local = _interopRequireDefault(require("./local"));

var _mailer = _interopRequireDefault(require("./mailer"));

var _middleware = _interopRequireDefault(require("./middleware"));

var _oauth = _interopRequireDefault(require("./oauth"));

var _routes = _interopRequireDefault(require("./routes"));

var _user = _interopRequireDefault(require("./user"));

var _util = _interopRequireDefault(require("./util"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

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

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } } function _next(value) { step("next", value); } function _throw(err) { step("throw", err); } _next(); }); }; }

// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird'); // tslint:disable-next-line:no-var-requires

var userDesign = require("../designDocs/user-design");

_pouchdbNode.default.plugin(_pouchdbSecurityHelper.default).plugin(_pouchdbUpsert.default);

var init =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(function* (configData, passport, userDB, couchAuthDB) {
    var config = (0, _configure.default)(configData, _default2.default);

    var router = _express.default.Router();

    var emitter = new _events.default.EventEmitter();
    var finalPassport = passport || _passport.default;
    var middleware = (0, _middleware.default)(finalPassport); // Some extra default settings if no config object is specified

    if (!configData) {
      config.set(function (o) {
        return _extends({}, o, {
          testMode: {
            noEmail: true,
            debugEmail: true
          }
        });
      });
    } // Create the DBs if they weren't passed in


    if (!userDB) {
      userDB = new _pouchdbNode.default(_util.default.getFullDBURL(config.get().dbServer, config.get().dbServer.userDB));
    }

    if (!couchAuthDB && !config.get().dbServer.cloudant) {
      couchAuthDB = new _pouchdbNode.default(_util.default.getFullDBURL(config.get().dbServer, config.get().dbServer.couchAuthDB));
    }

    if (!userDB) {
      throw new Error('userDB must be passed in as the third argument or specified in the config file under dbServer.userDB');
    }

    var mailer = (0, _mailer.default)(config);
    var user = (0, _user.default)(config, userDB, couchAuthDB, mailer, emitter);
    var oauth = (0, _oauth.default)(router, finalPassport, user, config); // Seed design docs for the user database

    var designWithProviders = _util.default.addProvidersToDesignDoc(config, userDesign);

    try {
      yield (0, _pouchdbSeedDesign.default)(userDB, designWithProviders);
    } catch (error) {
      console.error('failed seeding design docs!', error);
    } // Configure Passport local login and api keys


    (0, _local.default)(config, finalPassport, user); // Load the routes

    (0, _routes.default)(config, router, finalPassport, user);
    var superlogin = {
      config: config,
      router: router,
      mailer: mailer,
      passport: finalPassport,
      userDB: userDB,
      couchAuthDB: couchAuthDB,
      registerProvider: oauth.registerProvider,
      registerOAuth2: oauth.registerOAuth2,
      registerTokenProvider: oauth.registerTokenProvider,
      validateUsername: user.validateUsername,
      validateEmail: user.validateEmail,
      validateEmailUsername: user.validateEmailUsername,
      getUser: user.get,
      createUser: user.create,
      onCreate: user.onCreate,
      onLink: user.onLink,
      socialAuth: user.socialAuth,
      hashPassword: _util.default.hashPassword,
      verifyPassword: _util.default.verifyPassword,
      createSession: user.createSession,
      changePassword: user.changePassword,
      changeEmail: user.changeEmail,
      resetPassword: user.resetPassword,
      forgotPassword: user.forgotPassword,
      verifyEmail: user.verifyEmail,
      addUserDB: user.addUserDB,
      removeUserDB: user.removeUserDB,
      logoutUser: user.logoutUser,
      logoutSession: user.logoutSession,
      logoutOthers: user.logoutOthers,
      removeUser: user.remove,
      confirmSession: user.confirmSession,
      removeExpiredKeys: user.removeExpiredKeys,
      sendEmail: mailer.sendEmail,
      quitRedis: user.quitRedis,
      // authentication middleware
      requireAuth: middleware.requireAuth,
      requireRole: middleware.requireRole,
      requireAnyRole: middleware.requireAnyRole,
      requireAllRoles: middleware.requireAllRoles // tslint:disable-next-line

    };

    for (var _key in emitter) {
      superlogin[_key] = emitter[_key];
    }

    return superlogin;
  });

  return function init(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
}();

var _default = init;
exports.default = _default;