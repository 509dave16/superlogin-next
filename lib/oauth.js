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

var fs = require('fs');

var path = require('path');

var BPromise = require('bluebird');

var ejs = require('ejs');

var extend = require('util')._extend;

var util = require('./util');

var stateRequired = ['google', 'linkedin'];

module.exports = function (router, passport, user, config) {
  // Function to initialize a session following authentication from a socialAuth provider
  function initSession(req, res, next) {
    var provider = getProvider(req.path);
    return user.createSession(req.user._id, provider, req).then(function (mySession) {
      return Promise.resolve({
        error: null,
        session: mySession,
        link: null
      });
    }).then(function (results) {
      var template;

      if (config.getItem('testMode.oauthTest')) {
        template = fs.readFileSync(path.join(__dirname, '../templates/oauth/auth-callback-test.ejs'), 'utf8');
      } else {
        template = fs.readFileSync(path.join(__dirname, '../templates/oauth/auth-callback.ejs'), 'utf8');
      }

      var html = ejs.render(template, results);
      res.status(200).send(html);
    }, function (err) {
      return next(err);
    });
  } // Function to initialize a session following authentication from a socialAuth provider


  function initTokenSession(req, res, next) {
    var provider = getProviderToken(req.path);
    return user.createSession(req.user._id, provider, req).then(function (mySession) {
      return Promise.resolve(mySession);
    }).then(function (session) {
      res.status(200).json(session);
    }, function (err) {
      return next(err);
    });
  } // Called after an account has been succesfully linked


  function linkSuccess(req, res, next) {
    var provider = getProvider(req.path);
    var result = {
      error: null,
      session: null,
      link: provider
    };
    var template;

    if (config.getItem('testMode.oauthTest')) {
      template = fs.readFileSync(path.join(__dirname, '../templates/oauth/auth-callback-test.ejs'), 'utf8');
    } else {
      template = fs.readFileSync(path.join(__dirname, '../templates/oauth/auth-callback.ejs'), 'utf8');
    }

    var html = ejs.render(template, result);
    res.status(200).send(html);
  } // Called after an account has been succesfully linked using access_token provider


  function linkTokenSuccess(req, res, next) {
    var provider = getProviderToken(req.path);
    res.status(200).json({
      ok: true,
      success: util.capitalizeFirstLetter(provider) + ' successfully linked',
      provider: provider
    });
  } // Handles errors if authentication fails


  function oauthErrorHandler(err, req, res, next) {
    var template;

    if (config.getItem('testMode.oauthTest')) {
      template = fs.readFileSync(path.join(__dirname, '../templates/oauth/auth-callback-test.ejs'), 'utf8');
    } else {
      template = fs.readFileSync(path.join(__dirname, '../templates/oauth/auth-callback.ejs'), 'utf8');
    }

    var html = ejs.render(template, {
      error: err.message,
      session: null,
      link: null
    });
    console.error(err);

    if (err.stack) {
      console.error(err.stack);
    }

    res.status(400).send(html);
  } // Handles errors if authentication from access_token provider fails


  function tokenAuthErrorHandler(err, req, res, next) {
    var status;

    if (req.user && req.user._id) {
      status = 403;
    } else {
      status = 401;
    }

    console.error(err);

    if (err.stack) {
      console.error(err.stack);
      delete err.stack;
    }

    res.status(status).json(err);
  } // Framework to register OAuth providers with passport


  function registerProvider(provider, configFunction) {
    provider = provider.toLowerCase();
    var configRef = 'providers.' + provider;

    if (config.getItem(configRef + '.credentials')) {
      var credentials = config.getItem(configRef + '.credentials');
      credentials.passReqToCallback = true;
      var options = config.getItem(configRef + '.options') || {};
      configFunction.call(null, credentials, passport, authHandler);
      router.get('/' + provider, passportCallback(provider, options, 'login'));
      router.get('/' + provider + '/callback', passportCallback(provider, options, 'login'), initSession, oauthErrorHandler);

      if (!config.getItem('security.disableLinkAccounts')) {
        router.get('/link/' + provider, passport.authenticate('bearer', {
          session: false
        }), passportCallback(provider, options, 'link'));
        router.get('/link/' + provider + '/callback', passport.authenticate('bearer', {
          session: false
        }), passportCallback(provider, options, 'link'), linkSuccess, oauthErrorHandler);
      }

      console.log(provider + ' loaded.');
    }
  } // A shortcut to register OAuth2 providers that follow the exact accessToken, refreshToken pattern.


  function registerOAuth2(providerName, Strategy) {
    registerProvider(providerName, function (credentials, passport, authHandler) {
      passport.use(new Strategy(credentials,
      /*#__PURE__*/
      function () {
        var _ref = _asyncToGenerator(function* (req, accessToken, refreshToken, profile, done) {
          return authHandler(req, providerName, {
            accessToken: accessToken,
            refreshToken: refreshToken
          }, profile).then(done);
        });

        return function (_x, _x2, _x3, _x4, _x5) {
          return _ref.apply(this, arguments);
        };
      }()));
    });
  } // Registers a provider that accepts an access_token directly from the client, skipping the popup window and callback
  // This is for supporting Cordova, native IOS and Android apps, as well as other devices


  function registerTokenProvider(providerName, Strategy) {
    providerName = providerName.toLowerCase();
    var configRef = 'providers.' + providerName;

    if (config.getItem(configRef + '.credentials')) {
      var credentials = config.getItem(configRef + '.credentials');
      credentials.passReqToCallback = true;
      var options = config.getItem(configRef + '.options') || {}; // Configure the Passport Strategy

      passport.use(providerName + '-token', new Strategy(credentials,
      /*#__PURE__*/
      function () {
        var _ref2 = _asyncToGenerator(function* (req, accessToken, refreshToken, profile, done) {
          return authHandler(req, providerName, {
            accessToken: accessToken,
            refreshToken: refreshToken
          }, profile).then(done);
        });

        return function (_x6, _x7, _x8, _x9, _x10) {
          return _ref2.apply(this, arguments);
        };
      }()));
      router.post('/' + providerName + '/token', passportTokenCallback(providerName, options), initTokenSession, tokenAuthErrorHandler);

      if (!config.getItem('security.disableLinkAccounts')) {
        router.post('/link/' + providerName + '/token', passport.authenticate('bearer', {
          session: false
        }), passportTokenCallback(providerName, options), linkTokenSuccess, tokenAuthErrorHandler);
      }

      console.log(providerName + '-token loaded.');
    }
  } // This is called after a user has successfully authenticated with a provider
  // If a user is authenticated with a bearer token we will link an account, otherwise log in
  // auth is an object containing 'access_token' and optionally 'refresh_token'


  function authHandler(req, provider, auth, profile) {
    if (req.user && req.user._id && req.user.key) {
      return user.linkSocial(req.user._id, provider, auth, profile, req);
    } else {
      return user.socialAuth(provider, auth, profile, req);
    }
  } // Configures the passport.authenticate for the given provider, passing in options
  // Operation is 'login' or 'link'


  function passportCallback(provider, options, operation) {
    return function (req, res, next) {
      var theOptions = extend({}, options);

      if (provider === 'linkedin') {
        theOptions.state = true;
      }

      var accessToken = req.query.bearer_token || req.query.state;

      if (accessToken && (stateRequired.indexOf(provider) > -1 || config.getItem('providers.' + provider + '.stateRequired') === true)) {
        theOptions.state = accessToken;
      }

      theOptions.callbackURL = getLinkCallbackURLs(provider, req, operation, accessToken);
      theOptions.session = false;
      passport.authenticate(provider, theOptions)(req, res, next);
    };
  } // Configures the passport.authenticate for the given access_token provider, passing in options


  function passportTokenCallback(provider, options) {
    return function (req, res, next) {
      var theOptions = extend({}, options);
      theOptions.session = false;
      passport.authenticate(provider + '-token', theOptions)(req, res, next);
    };
  }

  function getLinkCallbackURLs(provider, req, operation, accessToken) {
    if (accessToken) {
      accessToken = encodeURIComponent(accessToken);
    }

    var protocol = (req.get('X-Forwarded-Proto') || req.protocol) + '://';

    if (operation === 'login') {
      return protocol + req.get('host') + req.baseUrl + '/' + provider + '/callback';
    }

    if (operation === 'link') {
      var reqUrl;

      if (accessToken && (stateRequired.indexOf(provider) > -1 || config.getItem('providers.' + provider + '.stateRequired') === true)) {
        reqUrl = protocol + req.get('host') + req.baseUrl + '/link/' + provider + '/callback';
      } else {
        reqUrl = protocol + req.get('host') + req.baseUrl + '/link/' + provider + '/callback?state=' + accessToken;
      }

      return reqUrl;
    }
  } // Gets the provider name from a callback path


  function getProvider(pathname) {
    var items = pathname.split('/');
    var index = items.indexOf('callback');

    if (index > 0) {
      return items[index - 1];
    }
  } // Gets the provider name from a callback path for access_token strategy


  function getProviderToken(pathname) {
    var items = pathname.split('/');
    var index = items.indexOf('token');

    if (index > 0) {
      return items[index - 1];
    }
  }

  return {
    registerProvider: registerProvider,
    registerOAuth2: registerOAuth2,
    registerTokenProvider: registerTokenProvider
  };
};