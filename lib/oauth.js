"use strict";

exports.__esModule = true;
exports.default = void 0;

var _ejs = _interopRequireDefault(require("ejs"));

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

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
var stateRequired = ['google', 'linkedin'];

var oauth = function oauth(router, passport, user, config) {
  var getLinkCallbackURLs = function getLinkCallbackURLs(provider, req, operation, accessToken) {
    if (accessToken) {
      accessToken = encodeURIComponent(accessToken);
    }

    var protocol = (req.get('X-Forwarded-Proto') || req.protocol) + "://";

    if (operation === 'login') {
      return protocol + req.get('host') + req.baseUrl + "/" + provider + "/callback";
    }

    if (operation === 'link') {
      var reqUrl;

      if (accessToken && (stateRequired.indexOf(provider) > -1 || config.getItem("providers." + provider + ".stateRequired") === true)) {
        reqUrl = protocol + req.get('host') + req.baseUrl + "/link/" + provider + "/callback";
      } else {
        reqUrl = protocol + req.get('host') + req.baseUrl + "/link/" + provider + "/callback?state=" + accessToken;
      }

      return reqUrl;
    }

    return undefined;
  }; // Configures the passport.authenticate for the given provider, passing in options
  // Operation is 'login' or 'link'


  var passportCallback = function passportCallback(provider, options, operation) {
    return function (req, res, next) {
      var theOptions = Object.assign({}, options);

      if (provider === 'linkedin') {
        theOptions.state = true;
      }

      var accessToken = req.query.bearer_token || req.query.state;

      if (accessToken && (stateRequired.indexOf(provider) > -1 || config.getItem("providers." + provider + ".stateRequired") === true)) {
        theOptions.state = accessToken;
      }

      theOptions.callbackURL = getLinkCallbackURLs(provider, req, operation, accessToken);
      theOptions.session = false;
      return passport.authenticate(provider, theOptions)(req, res, next);
    };
  }; // Configures the passport.authenticate for the given access_token provider, passing in options


  var passportTokenCallback = function passportTokenCallback(provider, options) {
    return function (req, res, next) {
      var theOptions = Object.assign({}, options);
      theOptions.session = false;
      return passport.authenticate(provider + "-token", theOptions)(req, res, next);
    };
  }; // This is called after a user has successfully authenticated with a provider
  // If a user is authenticated with a bearer token we will link an account, otherwise log in
  // auth is an object containing 'access_token' and optionally 'refresh_token'


  var authHandler = function authHandler(req, provider, auth, profile) {
    if (req.user && req.user._id && req.user.key) {
      return user.linkSocial(req.user._id, provider, auth, profile, req);
    }

    return user.socialAuth(provider, auth, profile, req);
  }; // Gets the provider name from a callback path


  var getProvider = function getProvider(pathname) {
    var items = pathname.split('/');
    var index = items.indexOf('callback');

    if (index > 0) {
      return items[index - 1];
    }

    return undefined;
  }; // Gets the provider name from a callback path for access_token strategy


  var getProviderToken = function getProviderToken(pathname) {
    var items = pathname.split('/');
    var index = items.indexOf('token');

    if (index > 0) {
      return items[index - 1];
    }

    return '';
  }; // Function to initialize a session following authentication from a socialAuth provider


  var initSession =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(function* (req, res, next) {
      var provider = getProvider(req.path);

      try {
        var _session = yield user.createSession(req.user._id, provider, req);

        var results = {
          error: null,
          session: _session,
          link: null
        };
        var template;

        if (config.getItem('testMode.oauthTest')) {
          template = _fs.default.readFileSync(_path.default.join(__dirname, '../templates/oauth/auth-callback-test.ejs'), 'utf8');
        } else {
          template = _fs.default.readFileSync(_path.default.join(__dirname, '../templates/oauth/auth-callback.ejs'), 'utf8');
        }

        var html = _ejs.default.render(template, results);

        return res.status(200).send(html);
      } catch (error) {
        return next(error);
      }
    });

    return function initSession(_x, _x2, _x3) {
      return _ref.apply(this, arguments);
    };
  }(); // Function to initialize a session following authentication from a socialAuth provider


  var initTokenSession =
  /*#__PURE__*/
  function () {
    var _ref2 = _asyncToGenerator(function* (req, res, next) {
      var provider = getProviderToken(req.path);

      try {
        var _session2 = yield user.createSession(req.user._id, provider, req);

        return res.status(200).json(_session2);
      } catch (error) {
        return next();
      }
    });

    return function initTokenSession(_x4, _x5, _x6) {
      return _ref2.apply(this, arguments);
    };
  }(); // Called after an account has been succesfully linked


  var linkSuccess = function linkSuccess(req, res) {
    var provider = getProvider(req.path);
    var result = {
      error: null,
      session: null,
      link: provider
    };
    var template;

    if (config.getItem('testMode.oauthTest')) {
      template = _fs.default.readFileSync(_path.default.join(__dirname, '../templates/oauth/auth-callback-test.ejs'), 'utf8');
    } else {
      template = _fs.default.readFileSync(_path.default.join(__dirname, '../templates/oauth/auth-callback.ejs'), 'utf8');
    }

    var html = _ejs.default.render(template, result);

    res.status(200).send(html);
  }; // Called after an account has been succesfully linked using access_token provider


  var linkTokenSuccess = function linkTokenSuccess(req, res) {
    var provider = getProviderToken(req.path);
    res.status(200).json({
      ok: true,
      success: _util.default.capitalizeFirstLetter(provider) + " successfully linked",
      provider: provider
    });
  }; // Handles errors if authentication fails


  var oauthErrorHandler = function oauthErrorHandler(err, req, res) {
    var template;

    if (config.getItem('testMode.oauthTest')) {
      template = _fs.default.readFileSync(_path.default.join(__dirname, '../templates/oauth/auth-callback-test.ejs'), 'utf8');
    } else {
      template = _fs.default.readFileSync(_path.default.join(__dirname, '../templates/oauth/auth-callback.ejs'), 'utf8');
    }

    var html = _ejs.default.render(template, {
      error: err.message,
      session: null,
      link: null
    });

    console.error('oauthError', err);
    console.dir('oauthError', err);

    if (err.stack) {
      console.error('oauthError stack', err.stack);
    }

    res.status(400).send(html);
  }; // Handles errors if authentication from access_token provider fails


  var tokenAuthErrorHandler = function tokenAuthErrorHandler(err, req, res) {
    var status;

    if (req.user && req.user._id) {
      status = 403;
    } else {
      status = 401;
    }

    console.error('tokenAuthErrorHandler', err);
    console.dir('tokenAuthErrorHandler', err);

    if (err.stack) {
      console.error('tokenAuthErrorHandler stack', err.stack);
      delete err.stack;
    }

    res.status(status).json(err);
  }; // Framework to register OAuth providers with passport


  var registerProvider = function registerProvider( // tslint:disable-next-line:no-any
  provider, configFunction) {
    provider = provider.toLowerCase();
    var configRef = "providers." + provider;

    if (config.getItem(configRef + ".credentials")) {
      var credentials = config.getItem(configRef + ".credentials");
      credentials.passReqToCallback = true;
      var options = config.getItem(configRef + ".options") || {};
      configFunction(credentials, passport, authHandler);
      router.get("/" + provider, passportCallback(provider, options, 'login'));
      router.get("/" + provider + "/callback", passportCallback(provider, options, 'login'), initSession, oauthErrorHandler);

      if (!config.getItem('security.disableLinkAccounts')) {
        router.get("/link/" + provider, passport.authenticate('bearer', {
          session: false
        }), passportCallback(provider, options, 'link'));
        router.get("/link/" + provider + "/callback", passport.authenticate('bearer', {
          session: false
        }), passportCallback(provider, options, 'link'), linkSuccess, oauthErrorHandler);
      }

      console.log(provider + " loaded.");
    }
  }; // A shortcut to register OAuth2 providers that follow the exact accessToken, refreshToken pattern.


  var registerOAuth2 = function registerOAuth2(providerName, Strategy) {
    registerProvider(providerName, function (credentials, providerPassport, providerAuthHandler) {
      providerPassport.use(new Strategy(credentials,
      /*#__PURE__*/
      function () {
        var _ref3 = _asyncToGenerator(function* (req, accessToken, refreshToken, profile, done) {
          return providerAuthHandler(req, providerName, {
            accessToken: accessToken,
            refreshToken: refreshToken
          }, profile).asCallback(done);
        });

        return function (_x7, _x8, _x9, _x10, _x11) {
          return _ref3.apply(this, arguments);
        };
      }()));
    });
  }; // Registers a provider that accepts an access_token directly from the client, skipping the popup window and callback
  // This is for supporting Cordova, native IOS and Android apps, as well as other devices


  var registerTokenProvider = function registerTokenProvider(providerName, Strategy) {
    providerName = providerName.toLowerCase();
    var configRef = "providers." + providerName;

    if (config.getItem(configRef + ".credentials")) {
      var credentials = config.getItem(configRef + ".credentials");
      credentials.passReqToCallback = true;
      var options = config.getItem(configRef + ".options") || {}; // Configure the Passport Strategy

      passport.use(providerName + "-token", new Strategy(credentials,
      /*#__PURE__*/
      function () {
        var _ref4 = _asyncToGenerator(function* (req, accessToken, refreshToken, profile, done) {
          return authHandler(req, providerName, {
            accessToken: accessToken,
            refreshToken: refreshToken
          }, profile).asCallback(done);
        });

        return function (_x12, _x13, _x14, _x15, _x16) {
          return _ref4.apply(this, arguments);
        };
      }()));
      router.post("/" + providerName + "/token", passportTokenCallback(providerName, options), initTokenSession, tokenAuthErrorHandler);

      if (!config.getItem('security.disableLinkAccounts')) {
        router.post("/link/" + providerName + "/token", passport.authenticate('bearer', {
          session: false
        }), passportTokenCallback(providerName, options), linkTokenSuccess, tokenAuthErrorHandler);
      }

      console.log(providerName + "-token loaded.");
    }
  };

  return {
    registerProvider: registerProvider,
    registerOAuth2: registerOAuth2,
    registerTokenProvider: registerTokenProvider
  };
};

var _default = oauth;
exports.default = _default;