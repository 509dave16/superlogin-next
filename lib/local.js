"use strict";

exports.__esModule = true;
exports.default = void 0;

var _passportHttpBearerSl = _interopRequireDefault(require("passport-http-bearer-sl"));

var _passportLocal = _interopRequireDefault(require("passport-local"));

var _util = _interopRequireDefault(require("./util"));

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

// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird');
var BearerStrategy = _passportHttpBearerSl.default.Strategy;

var local = function local(config, passport, user) {
  var _config$get$local = config.get().local,
      usernameField = _config$get$local.usernameField,
      passwordField = _config$get$local.passwordField,
      requireEmailConfirm = _config$get$local.requireEmailConfirm;

  var handleFailedLogin =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(function* (userDoc, req, done) {
      try {
        var locked = yield user.handleFailedLogin(userDoc, req);
        var message = locked ? "Maximum failed login attempts exceeded. Your account has been locked for " + Math.round(config.get().security.lockoutTime / 60) + " minutes." : 'Invalid username or password';
        return done(null, false, {
          error: 'Unauthorized',
          message: message
        });
      } catch (error) {
        console.error('handleFailedLogin error', handleFailedLogin);
        return done(null, false, {
          error: 'Unauthorized',
          message: error
        });
      }
    });

    return function handleFailedLogin(_x, _x2, _x3) {
      return _ref.apply(this, arguments);
    };
  }(); // API token strategy


  passport.use(new BearerStrategy(
  /*#__PURE__*/
  function () {
    var _ref2 = _asyncToGenerator(function* (tokenPass, done) {
      var parse = tokenPass.split(':');

      if (parse.length < 2) {
        return done(null, false, {
          message: 'invalid token'
        });
      }

      var token = parse[0];
      var password = parse[1];

      try {
        var thisUser = yield user.confirmSession(token, password);
        return done(null, thisUser);
      } catch (error) {
        console.error('error in local bearer strategy', error);
        return done(null, false, {
          message: error
        });
      }
    });

    return function (_x4, _x5) {
      return _ref2.apply(this, arguments);
    };
  }())); // Use local strategy

  passport.use(new _passportLocal.default({
    usernameField: usernameField,
    passwordField: passwordField,
    session: false,
    passReqToCallback: true
  },
  /*#__PURE__*/
  function () {
    var _ref3 = _asyncToGenerator(function* (req, username, password, done) {
      try {
        var thisUser = yield user.get(username);

        if (thisUser) {
          var thisLocal = thisUser.local,
              email = thisUser.email; // Check if the account is locked

          if (thisLocal && thisLocal.lockedUntil && thisLocal.lockedUntil > Date.now()) {
            return done(null, false, {
              error: 'Unauthorized',
              message: 'Your account is currently locked. Please wait a few minutes and try again.'
            });
          }

          if (!thisLocal || !thisLocal.derived_key) {
            return done(null, false, {
              error: 'Unauthorized',
              message: 'Invalid username or password'
            });
          }

          try {
            yield _util.default.verifyPassword(thisLocal, password); // Check if the email has been confirmed if it is required

            if (requireEmailConfirm && !email) {
              return done(null, false, {
                error: 'Unauthorized',
                message: 'You must confirm your email address.'
              });
            } // Success!!!


            return done(null, thisUser);
          } catch (error) {
            return error ? done(error) : handleFailedLogin(thisUser, req, done);
          }
        } else {
          // user not found
          return done(null, false, {
            error: 'Unauthorized',
            message: 'Invalid username or password'
          });
        }
      } catch (error) {
        console.log('error in local strategy', error);
        return done(error);
      }
    });

    return function (_x6, _x7, _x8, _x9) {
      return _ref3.apply(this, arguments);
    };
  }()));
};

var _default = local;
exports.default = _default;