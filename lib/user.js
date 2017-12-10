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

function _readOnlyError(name) { throw new Error("\"" + name + "\" is read-only"); }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } } function _next(value) { step("next", value); } function _throw(err) { step("throw", err); } _next(); }); }; }

var url = require('url');

var BPromise = require('bluebird');

var Model = require('sofa-model');

var nodemailer = require('nodemailer');

var extend = require('extend');

var Session = require('./session');

var util = require('./util');

var DBAuth = require('./dbauth');

var merge = require('lodash.merge'); // regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/inupsert.js#L4


var EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/;
var USER_REGEXP = /^[a-z0-9_-]{3,16}$/;

module.exports = function (config, userDB, couchAuthDB, mailer, emitter) {
  var self = this;
  var dbAuth = new DBAuth(config, userDB, couchAuthDB);
  var session = new Session(config);
  var onCreateActions = [];
  var onLinkActions = []; // Token valid for 24 hours by default
  // Forget password token life

  var tokenLife = config.getItem('security.tokenLife') || 86400; // Session token life

  var sessionLife = config.getItem('security.sessionLife') || 86400;
  var emailUsername = config.getItem('local.emailUsername');

  this.validateUsername = function (username) {
    if (!username) {
      return Promise.resolve();
    }

    if (!username.match(USER_REGEXP)) {
      return Promise.resolve('Invalid username');
    }

    return userDB.query('auth/username', {
      key: username
    }).then(function (result) {
      if (result.rows.length === 0) {
        // Pass!
        return Promise.resolve();
      } else {
        return Promise.resolve('already in use');
      }
    }, function (err) {
      throw new Error(err);
    });
  };

  this.validateEmail =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(function* (email) {
      if (!email) {
        return Promise.resolve();
      }

      if (!email.match(EMAIL_REGEXP)) {
        return Promise.resolve('invalid email');
      }

      try {
        var result = yield userDB.query('auth/email', {
          key: email
        });

        if (result.rows.length === 0) {
          // Pass!
          return Promise.resolve();
        } else {
          return Promise.resolve('already in use');
        }
      } catch (error) {
        console.log('error validating email', error);
        return Promise.reject(error);
      }
    });

    return function (_x) {
      return _ref.apply(this, arguments);
    };
  }();

  this.validateEmailUsername =
  /*#__PURE__*/
  function () {
    var _ref2 = _asyncToGenerator(function* (email) {
      if (!email) {
        return Promise.resolve();
      }

      if (!email.match(EMAIL_REGEXP)) {
        return Promise.resolve('invalid email');
      }

      try {
        var result = yield userDB.query('auth/emailUsername', {
          key: email
        });

        if (result.rows.length === 0) {
          return Promise.resolve();
        } else {
          return Promise.resolve('already in use');
        }
      } catch (error) {
        console.log('error validating email/username', error);
        return Promise.reject(error);
      }
    });

    return function (_x2) {
      return _ref2.apply(this, arguments);
    };
  }(); // Validation function for ensuring that two fields match


  this.matches = function (value, option, key, attributes) {
    if (attributes && attributes[option] !== value) {
      return 'does not match ' + option;
    }
  };

  var passwordConstraints = {
    presence: true,
    length: {
      minimum: 6,
      message: 'must be at least 6 characters'
    },
    matches: 'confirmPassword'
  };
  passwordConstraints = extend(true, {}, passwordConstraints, config.getItem('local.passwordConstraints'));
  var userModel = {
    async: true,
    whitelist: ['name', 'username', 'email', 'password', 'confirmPassword'],
    customValidators: {
      validateEmail: self.validateEmail,
      validateUsername: self.validateUsername,
      validateEmailUsername: self.validateEmailUsername,
      matches: self.matches
    },
    sanitize: {
      name: ['trim'],
      username: ['trim', 'toLowerCase'],
      email: ['trim', 'toLowerCase']
    },
    validate: {
      email: {
        presence: true,
        validateEmail: true
      },
      username: {
        presence: true,
        validateUsername: true
      },
      password: passwordConstraints,
      confirmPassword: {
        presence: true
      }
    },
    static: {
      type: 'user',
      roles: config.getItem('security.defaultRoles'),
      providers: ['local']
    },
    rename: {
      username: '_id'
    }
  };

  if (emailUsername) {
    delete userModel.validate.username;
    delete userModel.validate.email.validateEmail;
    delete userModel.rename.username;
    userModel.validate.email.validateEmailUsername = true;
  }

  var resetPasswordModel = {
    async: true,
    customValidators: {
      matches: self.matches
    },
    validate: {
      token: {
        presence: true
      },
      password: passwordConstraints,
      confirmPassword: {
        presence: true
      }
    }
  };
  var changePasswordModel = {
    async: true,
    customValidators: {
      matches: self.matches
    },
    validate: {
      newPassword: passwordConstraints,
      confirmPassword: {
        presence: true
      }
    }
  };

  this.onCreate = function (fn) {
    if (typeof fn === 'function') {
      onCreateActions.push(fn);
    } else {
      throw new TypeError('onCreate: You must pass in a function');
    }
  };

  this.onLink = function (fn) {
    if (typeof fn === 'function') {
      onLinkActions.push(fn);
    } else {
      throw new TypeError('onLink: You must pass in a function');
    }
  };

  function processTransformations(fnArray, userDoc, provider) {
    var promise;
    fnArray.forEach(function (fn) {
      if (!promise) {
        promise = fn.call(null, userDoc, provider);
      } else {
        if (!promise.then || typeof Promise.then !== 'function') {
          throw new Error('onCreate function must return a promise');
        }

        promise.then(function (newUserDoc) {
          return fn.call(null, newUserDoc, provider);
        });
      }
    });

    if (!promise) {
      promise = Promise.resolve(userDoc);
    }

    return promise;
  }

  this.get = function (login) {
    var query;

    if (emailUsername) {
      query = 'emailUsername';
    } else {
      query = EMAIL_REGEXP.test(login) ? 'email' : 'username';
    }

    return userDB.query('auth/' + query, {
      key: login,
      include_docs: true
    }).then(function (results) {
      if (results.rows.length > 0) {
        return Promise.resolve(results.rows[0].doc);
      } else {
        return Promise.resolve(null);
      }
    });
  };

  this.create = function (form, req) {
    req = req || {};
    var finalUserModel = userModel;
    var newUserModel = config.getItem('userModel');

    if (typeof newUserModel === 'object') {
      var whitelist;

      if (newUserModel.whitelist) {
        whitelist = util.arrayUnion(userModel.whitelist, newUserModel.whitelist);
      }

      finalUserModel = extend(true, {}, userModel, config.getItem('userModel'));
      finalUserModel.whitelist = whitelist || finalUserModel.whitelist;
    }

    var UserModel = new Model(finalUserModel);
    var user = new UserModel(form);
    var newUser;
    return user.process().then(function (result) {
      newUser = result;

      if (emailUsername) {
        newUser._id = newUser.email;
      }

      if (config.getItem('local.sendConfirmEmail')) {
        newUser.unverifiedEmail = {
          email: newUser.email,
          token: util.URLSafeUUID()
        };
        delete newUser.email;
      }

      return util.hashPassword(newUser.password);
    }, function (err) {
      return Promise.reject({
        error: 'Validation failed',
        validationErrors: err,
        status: 400
      });
    }).then(function (hash) {
      // Store password hash
      newUser.local = {};
      newUser.local.salt = hash.salt;
      newUser.local.derived_key = hash.derived_key;
      delete newUser.password;
      delete newUser.confirmPassword;
      newUser.signUp = {
        provider: 'local',
        timestamp: new Date().toISOString(),
        ip: req.ip
      };
      return addUserDBs(newUser);
    }).then(function (newUser) {
      return self.logActivity(newUser._id, 'signup', 'local', req, newUser);
    }).then(function (newUser) {
      return processTransformations(onCreateActions, newUser, 'local');
    }).then(function (finalNewUser) {
      return userDB.upsert(finalNewUser._id, function (oldUser) {
        return merge({}, oldUser, finalNewUser);
      });
    }).then(function (result) {
      newUser._rev = result.rev;

      if (!config.getItem('local.sendConfirmEmail')) {
        return Promise.resolve();
      }

      return mailer.sendEmail('confirmEmail', newUser.unverifiedEmail.email, {
        req: req,
        user: newUser
      });
    }).then(function () {
      emitter.emit('signup', newUser, 'local');
      return Promise.resolve(newUser);
    });
  };

  this.socialAuth =
  /*#__PURE__*/
  function () {
    var _ref3 = _asyncToGenerator(function* (provider, auth, profile, req) {
      var user;
      var newAccount = false;
      var action;
      var baseUsername;
      req = req || {};
      var ip = req.ip;

      try {
        console.log('getting results');
        var results = yield userDB.query('auth/' + provider, {
          key: profile.id,
          include_docs: true
        });
        console.log('results', results);

        if (results.rows.length > 0) {
          user = results.rows[0].doc;
        } else {
          var _finalUsername;

          newAccount = true;
          user = {};
          user[provider] = {};

          if (profile.emails) {
            user.email = profile.emails[0].value;
          }

          user.providers = [provider];
          user.type = 'user';
          user.roles = config.getItem('security.defaultRoles');
          user.signUp = {
            provider: provider,
            timestamp: new Date().toISOString(),
            ip: ip
          };

          var emailFail =
          /*#__PURE__*/
          function () {
            var _ref4 = _asyncToGenerator(function* () {
              return Promise.reject({
                error: 'Email already in use',
                message: 'Your email is already in use. Try signing in first and then linking this account.',
                status: 409
              });
            });

            return function emailFail() {
              return _ref4.apply(this, arguments);
            };
          }(); // Now we need to generate a username


          if (emailUsername) {
            if (!user.email) {
              return Promise.reject({
                error: 'No email provided',
                message: 'An email is required for registration, but ' + provider + " didn't supply one.",
                status: 400
              });
            }

            var err = yield self.validateEmailUsername(user.email);

            if (err) {
              return emailFail();
            }

            _finalUsername = user.email.toLowerCase();
          } else {
            if (profile.username) {
              baseUsername = profile.username.toLowerCase();
            } else {
              // If a username isn't specified we'll take it from the email
              if (user.email) {
                var parseEmail = user.email.split('@');
                baseUsername = parseEmail[0].toLowerCase();
              } else if (profile.displayName) {
                baseUsername = profile.displayName.replace(/\s/g, '').toLowerCase();
              } else {
                baseUsername = profile.id.toLowerCase();
              }
            }

            var _err = yield self.validateEmail(user.email);

            if (_err) {
              return emailFail();
            }

            _finalUsername = generateUsername(baseUsername);
          }
        }

        if (finalUsername) {
          user._id = finalUsername;
        }

        user[provider].auth = auth;
        user[provider].profile = profile;

        if (!user.name) {
          user.name = profile.displayName;
        }

        delete user[provider].profile._raw;

        if (newAccount) {
          yield addUserDBs(user);
        }

        action = newAccount ? 'signup' : 'login';
        yield self.logActivity(user._id, action, provider, req, user);
        var finalUser = yield processTransformations(newAccount ? onCreateActions : onLinkActions, userDoc, provider);
        yield userDB.upsert(finalUser._id, function (oldUser) {
          return merge({}, oldUser, finalUser);
        });

        if (action === 'signup') {
          emitter.emit('signup', user, provider);
        }

        return Promise.resolve(user);
      } catch (error) {
        console.log('social auth failed!', error);
        return Promise.reject(error);
      }
    });

    return function (_x3, _x4, _x5, _x6) {
      return _ref3.apply(this, arguments);
    };
  }();

  this.linkSocial = function (user_id, provider, auth, profile, req) {
    req = req || {};
    var user; // Load user doc

    return Promise.resolve().then(function () {
      return userDB.query('auth/' + provider, {
        key: profile.id
      });
    }).then(function (results) {
      if (results.rows.length === 0) {
        return Promise.resolve();
      } else {
        if (results.rows[0].id !== user_id) {
          return Promise.reject({
            error: 'Conflict',
            message: 'This ' + provider + ' profile is already in use by another account.',
            status: 409
          });
        }
      }
    }).then(function () {
      return userDB.get(user_id);
    }).then(function (theUser) {
      user = theUser; // Check for conflicting provider

      if (user[provider] && user[provider].profile.id !== profile.id) {
        return Promise.reject({
          error: 'Conflict',
          message: 'Your account is already linked with another ' + provider + 'profile.',
          status: 409
        });
      } // Check email for conflict


      if (!profile.emails) {
        return Promise.resolve({
          rows: []
        });
      }

      if (emailUsername) {
        return userDB.query('auth/emailUsername', {
          key: profile.emails[0].value
        });
      } else {
        return userDB.query('auth/email', {
          key: profile.emails[0].value
        });
      }
    }).then(function (results) {
      var passed;

      if (results.rows.length === 0) {
        passed = true;
      } else {
        passed = true;
        results.rows.forEach(function (row) {
          if (row.id !== user_id) {
            passed = false;
          }
        });
      }

      if (!passed) {
        return Promise.reject({
          error: 'Conflict',
          message: 'The email ' + profile.emails[0].value + ' is already in use by another account.',
          status: 409
        });
      } else {
        return Promise.resolve();
      }
    }).then(function () {
      // Insert provider info
      user[provider] = {};
      user[provider].auth = auth;
      user[provider].profile = profile;

      if (!user.providers) {
        user.providers = [];
      }

      if (user.providers.indexOf(provider) === -1) {
        user.providers.push(provider);
      }

      if (!user.name) {
        user.name = profile.displayName;
      }

      delete user[provider].profile._raw;
      return self.logActivity(user._id, 'link', provider, req, user);
    }).then(function (userDoc) {
      return processTransformations(onLinkActions, userDoc, provider);
    }).then(function (finalUser) {
      return userDB.upsert(finalUser._id, function (oldUser) {
        return merge({}, oldUser, finalUser);
      });
    }).then(function () {
      return Promise.resolve(user);
    });
  };

  this.unlink = function (user_id, provider) {
    var user;
    return userDB.get(user_id).then(function (theUser) {
      user = theUser;

      if (!provider) {
        return Promise.reject({
          error: 'Unlink failed',
          message: 'You must specify a provider to unlink.',
          status: 400
        });
      } // We can only unlink if there are at least two providers


      if (!user.providers || !(user.providers instanceof Array) || user.providers.length < 2) {
        return Promise.reject({
          error: 'Unlink failed',
          message: "You can't unlink your only provider!",
          status: 400
        });
      } // We cannot unlink local


      if (provider === 'local') {
        return Promise.reject({
          error: 'Unlink failed',
          message: "You can't unlink local.",
          status: 400
        });
      } // Check that the provider exists


      if (!user[provider] || typeof user[provider] !== 'object') {
        return Promise.reject({
          error: 'Unlink failed',
          message: 'Provider: ' + util.capitalizeFirstLetter(provider) + ' not found.',
          status: 404
        });
      }

      return userDB.upsert(user._id, function (oldUser) {
        var deleted = oldUser[provider];

        if (oldUser.providers) {
          // Remove the unlinked provider from the list of providers
          oldUser.providers.splice(user.providers.indexOf(provider), 1);
        }

        return oldUser;
      });
    }).then(function () {
      return Promise.resolve(user);
    });
  };

  this.createSession = function (user_id, provider, req) {
    var user;
    var newToken;
    var newSession;
    var password;
    req = req || {};
    var ip = req.ip;
    return userDB.get(user_id).then(function (record) {
      user = record;
      return generateSession(user._id, user.roles);
    }).then(function (token) {
      password = token.password;
      newToken = token;
      newToken.provider = provider;
      return session.storeToken(newToken);
    }).then(function () {
      return dbAuth.storeKey(user_id, newToken.key, password, newToken.expires, user.roles);
    }).then(function () {
      // authorize the new session across all dbs
      if (!user.personalDBs) {
        return Promise.resolve();
      }

      return dbAuth.authorizeUserSessions(user_id, user.personalDBs, newToken.key, user.roles);
    }).then(function () {
      if (!user.session) {
        user.session = {};
      }

      newSession = {
        issued: newToken.issued,
        expires: newToken.expires,
        provider: provider,
        ip: ip
      };
      user.session[newToken.key] = newSession; // Clear any failed login attempts

      if (provider === 'local') {
        if (!user.local) user.local = {};
        user.local.failedLoginAttempts = 0;
        delete user.local.lockedUntil;
      }

      return self.logActivity(user._id, 'login', provider, req, user);
    }).then(function (userDoc) {
      // Clean out expired sessions on login
      return self.logoutUserSessions(userDoc, 'expired');
    }).then(function (finalUser) {
      user = finalUser;
      return userDB.upsert(finalUser._id, function (oldDoc) {
        if (oldDoc.local) {
          delete oldDoc.local.lockedUntil;
        }

        return merge({}, oldDoc, finalUser);
      });
    }).then(function () {
      newSession.token = newToken.key;
      newSession.password = password;
      newSession.user_id = user._id;
      newSession.roles = user.roles; // Inject the list of userDBs

      if (typeof user.personalDBs === 'object') {
        var userDBs = {};
        var publicURL;

        if (config.getItem('dbServer.publicURL')) {
          var dbObj = url.parse(config.getItem('dbServer.publicURL'));
          dbObj.auth = newSession.token + ':' + newSession.password;
          publicURL = dbObj.format();
        } else {
          publicURL = config.getItem('dbServer.protocol') + newSession.token + ':' + newSession.password + '@' + config.getItem('dbServer.host') + '/';
        }

        Object.keys(user.personalDBs).forEach(function (finalDBName) {
          userDBs[user.personalDBs[finalDBName].name] = publicURL + finalDBName;
        });
        newSession.userDBs = userDBs;
      }

      if (user.profile) {
        newSession.profile = user.profile;
      }

      emitter.emit('login', newSession, provider);
      return Promise.resolve(newSession, provider);
    });
  };

  this.handleFailedLogin = function (user, req) {
    req = req || {};
    var maxFailedLogins = config.getItem('security.maxFailedLogins');

    if (!maxFailedLogins) {
      return Promise.resolve();
    }

    if (!user.local) {
      user.local = {};
    }

    if (!user.local.failedLoginAttempts) {
      user.local.failedLoginAttempts = 0;
    }

    user.local.failedLoginAttempts++;

    if (user.local.failedLoginAttempts > maxFailedLogins) {
      user.local.failedLoginAttempts = 0;
      user.local.lockedUntil = Date.now() + config.getItem('security.lockoutTime') * 1000;
    }

    return self.logActivity(user._id, 'failed login', 'local', req, user).then(function (finalUser) {
      return userDB.upsert(finalUser._id, function (oldUser) {
        return merge({}, oldUser, finalUser);
      });
    }).then(function () {
      return Promise.resolve(!!user.local.lockedUntil);
    });
  };

  this.logActivity =
  /*#__PURE__*/
  function () {
    var _ref5 = _asyncToGenerator(function* (user_id, action, provider, req, userDoc, saveDoc) {
      var logSize = config.getItem('security.userActivityLogSize');

      if (!logSize) {
        return Promise.resolve(userDoc);
      }

      var promise;
      var theUser = userDoc;

      if (!theUser) {
        if (saveDoc !== false) {
          saveDoc = true;
        }

        theUser = yield userDB.get(user_id);
      }

      userDoc = theUser;

      if (!userDoc.activity || !(userDoc.activity instanceof Array)) {
        userDoc.activity = [];
      }

      var entry = {
        timestamp: new Date().toISOString(),
        action: action,
        provider: provider,
        ip: req.ip
      };
      userDoc.activity.unshift(entry);

      while (userDoc.activity.length > logSize) {
        userDoc.activity.pop();
      }

      if (saveDoc) {
        yield userDB.upsert(userDoc._id, function (oldUser) {
          return merge({}, oldUser, userDoc);
        });
      }

      return Promise.resolve(userDoc);
    });

    return function (_x7, _x8, _x9, _x10, _x11, _x12) {
      return _ref5.apply(this, arguments);
    };
  }();

  this.refreshSession = function (key) {
    var newSession;
    return session.fetchToken(key).then(function (oldToken) {
      newSession = oldToken;
      newSession.expires = Date.now() + sessionLife * 1000;
      return Promise.all([userDB.get(newSession._id), session.storeToken(newSession)]);
    }).then(function (results) {
      var userDoc = results[0];
      userDoc.session[key].expires = newSession.expires; // Clean out expired sessions on refresh

      return self.logoutUserSessions(userDoc, 'expired');
    }).then(function (finalUser) {
      return userDB.upsert(finalUser._id, function (oldUser) {
        return merge({}, oldUser, finalUser);
      });
    }).then(function () {
      delete newSession.password;
      newSession.token = newSession.key;
      delete newSession.key;
      newSession.user_id = newSession._id;
      delete newSession._id;
      delete newSession.salt;
      delete newSession.derived_key;
      emitter.emit('refresh', newSession);
      return Promise.resolve(newSession);
    });
  };

  this.resetPassword = function (form, req) {
    req = req || {};
    var ResetPasswordModel = new Model(resetPasswordModel);
    var passwordResetForm = new ResetPasswordModel(form);
    var user;
    return passwordResetForm.validate().then(function () {
      var tokenHash = util.hashToken(form.token);
      return userDB.query('auth/passwordReset', {
        key: tokenHash,
        include_docs: true
      });
    }, function (err) {
      return Promise.reject({
        error: 'Validation failed',
        validationErrors: err,
        status: 400
      });
    }).then(function (results) {
      if (!results.rows.length) {
        return Promise.reject({
          status: 400,
          error: 'Invalid token'
        });
      }

      user = results.rows[0].doc;

      if (user.forgotPassword.expires < Date.now()) {
        return Promise.reject({
          status: 400,
          error: 'Token expired'
        });
      }

      return util.hashPassword(form.password);
    }).then(function (hash) {
      if (!user.local) {
        user.local = {};
      }

      user.local.salt = hash.salt;
      user.local.derived_key = hash.derived_key;

      if (user.providers.indexOf('local') === -1) {
        user.providers.push('local');
      } // logout user completely


      return self.logoutUserSessions(user, 'all');
    }).then(function (userDoc) {
      user = userDoc;
      delete user.forgotPassword;
      return self.logActivity(user._id, 'reset password', 'local', req, user);
    }).then(function (finalUser) {
      return userDB.upsert(finalUser._id, function (oldUser) {
        delete oldUser.forgotPassword;
        return merge({}, oldUser, finalUser);
      });
    }).then(function () {
      emitter.emit('password-reset', user);
      return Promise.resolve(user);
    });
  };

  this.changePasswordSecure = function (user_id, form, req) {
    req = req || {};
    var self = this;
    var ChangePasswordModel = new Model(changePasswordModel);
    var changePasswordForm = new ChangePasswordModel(form);
    var user;
    return changePasswordForm.validate().then(function () {
      return userDB.get(user_id);
    }, function (err) {
      return Promise.reject({
        error: 'Validation failed',
        validationErrors: err,
        status: 400
      });
    }).then(function () {
      return userDB.get(user_id);
    }).then(function (userDoc) {
      user = userDoc;

      if (user.local && user.local.salt && user.local.derived_key) {
        // Password is required
        if (!form.currentPassword) {
          return Promise.reject({
            error: 'Password change failed',
            message: 'You must supply your current password in order to change it.',
            status: 400
          });
        }

        return util.verifyPassword(user.local, form.currentPassword);
      } else {
        return Promise.resolve();
      }
    }).then(function () {
      return self.changePassword(user._id, form.newPassword, user, req);
    }, function (err) {
      return Promise.reject(err || {
        error: 'Password change failed',
        message: 'The current password you supplied is incorrect.',
        status: 400
      });
    }).then(function () {
      if (req.user && req.user.key) {
        return self.logoutOthers(req.user.key);
      } else {
        return Promise.resolve();
      }
    });
  };

  this.changePassword = function (user_id, newPassword, userDoc, req) {
    req = req || {};
    var promise, user;

    if (userDoc) {
      promise = Promise.resolve(userDoc);
    } else {
      promise = userDB.get(user_id);
    }

    return promise.then(function (doc) {
      user = doc;
      return util.hashPassword(newPassword);
    }, function (err) {
      return Promise.reject({
        error: 'User not found',
        status: 404
      });
    }).then(function (hash) {
      if (!user.local) {
        user.local = {};
      }

      user.local.salt = hash.salt;
      user.local.derived_key = hash.derived_key;

      if (user.providers.indexOf('local') === -1) {
        user.providers.push('local');
      }

      return self.logActivity(user._id, 'changed password', 'local', req, user);
    }).then(function (finalUser) {
      return userDB.upsert(finalUser._id, function (oldUser) {
        return merge({}, oldUser, finalUser);
      });
    }).then(function () {
      emitter.emit('password-change', user);
    });
  };

  this.forgotPassword = function (email, req) {
    req = req || {};
    var user, token, tokenHash;
    return userDB.query('auth/email', {
      key: email,
      include_docs: true
    }).then(function (result) {
      if (!result.rows.length) {
        return Promise.reject({
          error: 'User not found',
          status: 404
        });
      }

      user = result.rows[0].doc;
      token = util.URLSafeUUID();
      tokenHash = util.hashToken(token);
      user.forgotPassword = {
        token: tokenHash,
        // Store secure hashed token
        issued: Date.now(),
        expires: Date.now() + tokenLife * 1000
      };
      return self.logActivity(user._id, 'forgot password', 'local', req, user);
    }).then(function (finalUser) {
      return userDB.upsert(finalUser._id, function (oldUser) {
        return merge({}, oldUser, finalUser);
      });
    }).then(function () {
      return mailer.sendEmail('forgotPassword', user.email || user.unverifiedEmail.email, {
        user: user,
        req: req,
        token: token
      }); // Send user the unhashed token
    }).then(function () {
      emitter.emit('forgot-password', user);
      return Promise.resolve(user.forgotPassword);
    });
  };

  this.verifyEmail = function (token, req) {
    req = req || {};
    var user;
    return userDB.query('auth/verifyEmail', {
      key: token,
      include_docs: true
    }).then(function (result) {
      if (!result.rows.length) {
        return Promise.reject({
          error: 'Invalid token',
          status: 400
        });
      }

      user = result.rows[0].doc;
      user.email = user.unverifiedEmail.email;
      delete user.unverifiedEmail;
      emitter.emit('email-verified', user);
      return self.logActivity(user._id, 'verified email', 'local', req, user);
    }).then(function (finalUser) {
      return userDB.upsert(finalUser._id, function (oldUser) {
        delete oldUser.unverifiedEmail;
        return merge({}, oldUser, finalUser);
      });
    });
  };

  this.changeEmail = function (user_id, newEmail, req) {
    req = req || {};

    if (!req.user) {
      req.user = {
        provider: 'local'
      };
    }

    var user;
    return self.validateEmail(newEmail).then(function (err) {
      if (err) {
        return Promise.reject(err);
      }

      return userDB.get(user_id);
    }).then(function (userDoc) {
      user = userDoc;

      if (config.getItem('local.sendConfirmEmail')) {
        user.unverifiedEmail = {
          email: newEmail,
          token: util.URLSafeUUID()
        };
        return mailer.sendEmail('confirmEmail', user.unverifiedEmail.email, {
          req: req,
          user: user
        });
      } else {
        user.email = newEmail;
        return Promise.resolve();
      }
    }).then(function () {
      emitter.emit('email-changed', user);
      return self.logActivity(user._id, 'changed email', req.user.provider, req, user);
    }).then(function (finalUser) {
      return userDB.upsert(finalUser._id, function (oldUser) {
        return merge({}, oldUser, finalUser);
      });
    });
  };

  this.addUserDB = function (user_id, dbName, type, designDocs, permissions) {
    var userDoc;
    var dbConfig = dbAuth.getDBConfig(dbName, type || 'private');
    dbConfig.designDocs = designDocs || dbConfig.designDocs || '';
    dbConfig.permissions = permissions || dbConfig.permissions;
    return userDB.get(user_id).then(function (result) {
      userDoc = result;
      return dbAuth.addUserDB(userDoc, dbName, dbConfig.designDocs, dbConfig.type, dbConfig.permissions, dbConfig.adminRoles, dbConfig.memberRoles);
    }).then(function (finalDBName) {
      if (!userDoc.personalDBs) {
        userDoc.personalDBs = {};
      }

      delete dbConfig.designDocs; // If permissions is specified explicitly it will be saved, otherwise will be taken from defaults every session

      if (!permissions) {
        delete dbConfig.permissions;
      }

      delete dbConfig.adminRoles;
      delete dbConfig.memberRoles;
      userDoc.personalDBs[finalDBName] = dbConfig;
      emitter.emit('user-db-added', user_id, dbName);
      return userDB.upsert(userDoc._id, function (oldUser) {
        return merge({}, oldUser, userDoc);
      });
    });
  };

  this.removeUserDB = function (user_id, dbName, deletePrivate, deleteShared) {
    var user;
    var update = false;
    var dbID;
    return userDB.get(user_id).then(function (userDoc) {
      user = userDoc;

      if (user.personalDBs && typeof user.personalDBs === 'object') {
        return new Promise(
        /*#__PURE__*/
        function () {
          var _ref6 = _asyncToGenerator(function* (res) {
            return Object.keys(user.personalDBs).forEach(
            /*#__PURE__*/
            function () {
              var _ref7 = _asyncToGenerator(function* (db) {
                if (user.personalDBs[db].name === dbName) {
                  dbID = db;
                  var type = user.personalDBs[db].type;
                  delete user.personalDBs[db];
                  update = true;

                  try {
                    if (type === 'private' && deletePrivate) {
                      yield dbAuth.removeDB(db);
                      return res();
                    }

                    if (type === 'shared' && deleteShared) {
                      yield dbAuth.removeDB(db);
                      return res();
                    }
                  } catch (error) {
                    console.log('error removing user db!', db, dbName, error);
                  }
                }

                return res();
              });

              return function (_x14) {
                return _ref7.apply(this, arguments);
              };
            }());
          });

          return function (_x13) {
            return _ref6.apply(this, arguments);
          };
        }());
      }

      return Promise.resolve();
    }).then(function () {
      if (update) {
        emitter.emit('user-db-removed', user_id, dbName);
        return userDB.upsert(user._id, function (oldUser) {
          if (oldUser.personalDBs[dbID]) {
            delete oldUser.personalDBs[dbID];
          }

          merge({}, oldUser, user);
        });
      }

      return Promise.resolve();
    });
  };

  this.logoutUser = function (user_id, session_id) {
    var promise, user;

    if (user_id) {
      promise = userDB.get(user_id);
    } else {
      if (!session_id) {
        return Promise.reject({
          error: 'unauthorized',
          message: 'Either user_id or session_id must be specified',
          status: 401
        });
      }

      promise = userDB.query('auth/session', {
        key: session_id,
        include_docs: true
      }).then(function (results) {
        if (!results.rows.length) {
          return Promise.reject({
            error: 'unauthorized',
            status: 401
          });
        }

        return Promise.resolve(results.rows[0].doc);
      });
    }

    return promise.then(function (record) {
      user = record;
      user_id = record._id;
      return self.logoutUserSessions(user, 'all');
    }).then(function () {
      emitter.emit('logout', user_id);
      emitter.emit('logout-all', user_id);
      return userDB.upsert(user._id, function (oldUser) {
        return merge({}, oldUser, user);
      });
    });
  };

  this.logoutSession = function (session_id) {
    var user;
    var startSessions = 0;
    var endSessions = 0;
    return userDB.query('auth/session', {
      key: session_id,
      include_docs: true
    }).then(function (results) {
      if (!results.rows.length) {
        return Promise.reject({
          error: 'unauthorized',
          status: 401
        });
      }

      user = results.rows[0].doc;

      if (user.session) {
        startSessions = Object.keys(user.session).length;

        if (user.session[session_id]) {
          delete user.session[session_id];
        }
      }

      var promises = [];
      promises.push(session.deleteTokens(session_id));
      promises.push(dbAuth.removeKeys(session_id));

      if (user) {
        promises.push(dbAuth.deauthorizeUser(user, session_id));
      }

      return Promise.all(promises);
    }).then(function () {
      // Clean out expired sessions
      return self.logoutUserSessions(user, 'expired');
    }).then(function (finalUser) {
      user = finalUser;

      if (user.session) {
        endSessions = Object.keys(user.session).length;
      }

      emitter.emit('logout', user._id);

      if (startSessions !== endSessions) {
        return userDB.upsert(user._id, function (oldUser) {
          if (oldUser.session) {
            delete oldUser.session[session_id];
          }

          return merge({}, oldUser, user);
        });
      } else {
        return Promise.resolve(false);
      }
    });
  };

  this.logoutOthers = function (session_id) {
    var user;
    return userDB.query('auth/session', {
      key: session_id,
      include_docs: true
    }).then(function (results) {
      if (results.rows.length) {
        user = results.rows[0].doc;

        if (user.session && user.session[session_id]) {
          return self.logoutUserSessions(user, 'other', session_id);
        }
      }

      return Promise.resolve();
    }).then(function (finalUser) {
      if (finalUser) {
        return userDB.upsert(finalUser._id, function (oldUser) {
          return merge({}, oldUser, finalUser);
        });
      } else {
        return Promise.resolve(false);
      }
    });
  };

  this.logoutUserSessions =
  /*#__PURE__*/
  function () {
    var _ref8 = _asyncToGenerator(function* (userDoc, op, currentSession) {
      try {
        // When op is 'other' it will logout all sessions except for the specified 'currentSession'
        var sessions;

        if (op === 'all' || op === 'other') {
          sessions = util.getSessions(userDoc);
        } else if (op === 'expired') {
          sessions = util.getExpiredSessions(userDoc, Date.now());
        }

        if (op === 'other' && currentSession) {
          // Remove the current session from the list of sessions we are going to delete
          var index = sessions.indexOf(currentSession);

          if (index > -1) {
            sessions.splice(index, 1);
          }
        }

        if (sessions.length) {
          console.log('deleting sessions', sessions);
          console.log('deleting session tokens'); // Delete the sessions from our session store

          yield session.deleteTokens(sessions);
          console.log('remove session keys'); // Remove the keys from our couchDB auth database

          yield dbAuth.removeKeys(sessions);
          console.log('deauthorizeUser'); // Deauthorize keys from each personal database

          yield dbAuth.deauthorizeUser(userDoc, sessions);
          console.log('deauthorizeUser done');

          if (op === 'expired' || op === 'other') {
            sessions.forEach(function (session) {
              delete userDoc.session[session];
            });
          }
        }

        if (op === 'all') {
          delete userDoc.session;
        }

        return Promise.resolve(userDoc);
      } catch (error) {
        console.log('error logging out user sessions!', error);
        return Promise.resolve(userDoc);
      }
    });

    return function (_x15, _x16, _x17) {
      return _ref8.apply(this, arguments);
    };
  }();

  this.remove =
  /*#__PURE__*/
  function () {
    var _ref9 = _asyncToGenerator(function* (user_id, destroyDBs) {
      var user;
      var promises = [];

      try {
        var _userDoc = yield userDB.get(user_id);

        var res = yield self.logoutUserSessions(_userDoc, 'all');
        user = _userDoc;

        if (destroyDBs !== true || !user.personalDBs) {
          return Promise.resolve();
        }

        Object.keys(user.personalDBs).forEach(function (userdb) {
          if (user.personalDBs[userdb].type === 'private') {
            promises.push(dbAuth.removeDB(userdb));
          }
        });
        yield Promise.all(promises);
        return userDB.remove(user);
      } catch (error) {
        console.log('error removing user!', error);
        return Promise.resolve();
      }
    });

    return function (_x18, _x19) {
      return _ref9.apply(this, arguments);
    };
  }();

  this.removeExpiredKeys = dbAuth.removeExpiredKeys.bind(dbAuth);

  this.confirmSession = function (key, password) {
    return session.confirmToken(key, password);
  };

  this.quitRedis = function () {
    return session.quit();
  };

  function generateSession(username, roles) {
    var getKey;

    if (config.getItem('dbServer.cloudant')) {
      getKey = require('./dbauth/cloudant').getAPIKey(userDB);
    } else {
      var token = util.URLSafeUUID(); // Make sure our token doesn't start with illegal characters

      while (token[0] === '_' || token[0] === '-') {
        token = util.URLSafeUUID();
      }

      getKey = Promise.resolve({
        key: token,
        password: util.URLSafeUUID()
      });
    }

    return getKey.then(function (key) {
      var now = Date.now();
      return Promise.resolve({
        _id: username,
        key: key.key,
        password: key.password,
        issued: now,
        expires: now + sessionLife * 1000,
        roles: roles
      });
    });
  } // Adds numbers to a base name until it finds a unique database key


  function generateUsername(base) {
    base = base.toLowerCase();
    var entries = [];
    var finalName;
    return userDB.allDocs({
      startkey: base,
      endkey: base + "\uFFFF",
      include_docs: false
    }).then(function (results) {
      if (results.rows.length === 0) {
        return Promise.resolve(base);
      }

      for (var i = 0; i < results.rows.length; i++) {
        entries.push(results.rows[i].id);
      }

      if (entries.indexOf(base) === -1) {
        return Promise.resolve(base);
      }

      var num = 0;

      while (!finalName) {
        num++;

        if (entries.indexOf(base + num) === -1) {
          finalName = base + num;
        }
      }

      return Promise.resolve(finalName);
    });
  }

  var addUserDBs =
  /*#__PURE__*/
  function () {
    var _ref10 = _asyncToGenerator(function* (newUser) {
      // Add personal DBs
      if (!config.getItem('userDBs.defaultDBs')) {
        return Promise.resolve(newUser);
      }

      var promises = [];
      newUser.personalDBs = {};

      var processUserDBs =
      /*#__PURE__*/
      function () {
        var _ref11 = _asyncToGenerator(function* (dbList, type) {
          return Promise.all(dbList.map(
          /*#__PURE__*/
          function () {
            var _ref12 = _asyncToGenerator(function* (userDBName) {
              var dbConfig = dbAuth.getDBConfig(userDBName);
              var finalDBName = yield dbAuth.addUserDB(newUser, userDBName, dbConfig.designDocs, type, dbConfig.permissions, dbConfig.adminRoles, dbConfig.memberRoles);
              delete dbConfig.permissions;
              delete dbConfig.adminRoles;
              delete dbConfig.memberRoles;
              delete dbConfig.designDocs;
              dbConfig.type = type;
              newUser.personalDBs[finalDBName] = dbConfig;
            });

            return function (_x23) {
              return _ref12.apply(this, arguments);
            };
          }()));
        });

        return function processUserDBs(_x21, _x22) {
          return _ref11.apply(this, arguments);
        };
      }(); // Just in case defaultDBs is not specified


      var defaultPrivateDBs = config.getItem('userDBs.defaultDBs.private');

      if (!Array.isArray(defaultPrivateDBs)) {
        defaultPrivateDBs = (_readOnlyError("defaultPrivateDBs"), (_readOnlyError("defaultPrivateDBs"), []));
      }

      yield processUserDBs(defaultPrivateDBs, 'private');
      var defaultSharedDBs = config.getItem('userDBs.defaultDBs.shared');

      if (!Array.isArray(defaultSharedDBs)) {
        defaultSharedDBs = (_readOnlyError("defaultSharedDBs"), (_readOnlyError("defaultSharedDBs"), []));
      }

      yield processUserDBs(defaultSharedDBs, 'shared');
      return Promise.resolve(newUser);
    });

    return function addUserDBs(_x20) {
      return _ref10.apply(this, arguments);
    };
  }();

  return this;
};