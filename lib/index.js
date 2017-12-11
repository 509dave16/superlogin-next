'use strict';

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

var events = require('events');

var express = require('express');

var BPromise = require('bluebird');

var PouchDB = require('pouchdb-node');

var seed = require('pouchdb-seed-design');

var Configure = require('./configure');

var User = require('./user');

var Oauth = require('./oauth');

var loadRoutes = require('./routes');

var localConfig = require('./local');

var Middleware = require('./middleware');

var Mailer = require('./mailer');

var util = require('./util');

PouchDB.plugin(require('pouchdb-upsert'));

const init = (configData, passport, userDB, couchAuthDB) => new Promise(function ($return, $error) {
  var config, router, emitter, middleware, seedResult, mailer, user, oauth, superlogin;
  let userDesign;
  config = new Configure(configData, require('../config/default.config'));
  router = express.Router();
  emitter = new events.EventEmitter();

  if (!passport || typeof passport !== 'object') {
    passport = require('passport');
  }

  middleware = new Middleware(passport);

  // Some extra default settings if no config object is specified
  if (!configData) {
    config.setItem('testMode.noEmail', true);
    config.setItem('testMode.debugEmail', true);
  } // Create the DBs if they weren't passed in


  if (!userDB && config.getItem('dbServer.userDB')) {
    userDB = new PouchDB(util.getFullDBURL(config.getItem('dbServer'), config.getItem('dbServer.userDB')));
  }

  if (!couchAuthDB && config.getItem('dbServer.couchAuthDB') && !config.getItem('dbServer.cloudant')) {
    couchAuthDB = new PouchDB(util.getFullDBURL(config.getItem('dbServer'), config.getItem('dbServer.couchAuthDB')));
  }

  if (!userDB || typeof userDB !== 'object') {
    return $error(new Error('userDB must be passed in as the third argument or specified in the config file under dbServer.userDB'));
  } // Seed design docs for the user database


  userDesign = require('../designDocs/user-design');
  userDesign = util.addProvidersToDesignDoc(config, userDesign);
  return seed(userDB, userDesign).then(function ($await_1) {
    seedResult = $await_1;
    console.log('seed result', seedResult); // Configure Passport local login and api keys

    localConfig(config, passport, user); // Load the routes

    loadRoutes(config, router, passport, user);
    mailer = new Mailer(config);
    user = new User(config, userDB, couchAuthDB, mailer, emitter);
    oauth = new Oauth(router, passport, user, config);
    superlogin = {
      config: config,
      router: router,
      mailer: mailer,
      passport: passport,
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
      hashPassword: util.hashPassword,
      verifyPassword: util.verifyPassword,
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
      requireAllRoles: middleware.requireAllRoles // Inherit emitter

    };

    for (var key in emitter) {
      superlogin[key] = emitter[key];
    }

    return $return(superlogin);
  }.$asyncbind(this, $error), $error);
}.$asyncbind(this));

module.exports = init;