"use strict";

exports.__esModule = true;
exports.default = void 0;

var _passportHttpBearerSl = _interopRequireDefault(require("passport-http-bearer-sl"));

var _passportLocal = _interopRequireDefault(require("passport-local"));

var _util = _interopRequireDefault(require("./util"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird');
var BearerStrategy = _passportHttpBearerSl.default.Strategy;

var local = function local(config, passport, user) {
  var handleFailedLogin = function handleFailedLogin(userDoc, req, done) {
    var invalid = {
      error: 'Unauthorized',
      message: 'Invalid username or password'
    };
    return user.handleFailedLogin(userDoc, req).then(function (locked) {
      if (locked) {
        invalid.message = "Maximum failed login attempts exceeded. Your account has been locked for " + Math.round(config.getItem('security.lockoutTime') / 60) + " minutes.";
      }

      return done(null, false, invalid);
    });
  }; // API token strategy


  passport.use(new BearerStrategy(function (tokenPass, done) {
    var parse = tokenPass.split(':');

    if (parse.length < 2) {
      done(null, false, {
        message: 'invalid token'
      });
    }

    var token = parse[0];
    var password = parse[1];
    user.confirmSession(token, password).then(function (theuser) {
      done(null, theuser);
    }, function (err) {
      if (err instanceof Error) {
        done(err, false);
      } else {
        done(null, false, {
          message: err
        });
      }
    });
  })); // Use local strategy

  passport.use(new _passportLocal.default({
    usernameField: config.getItem('local.usernameField') || 'username',
    passwordField: config.getItem('local.passwordField') || 'password',
    session: false,
    passReqToCallback: true
  }, function (req, username, password, done) {
    user.get(username).then(function (theuser) {
      if (theuser) {
        // Check if the account is locked
        if (theuser.local && theuser.local.lockedUntil && theuser.local.lockedUntil > Date.now()) {
          return done(null, false, {
            error: 'Unauthorized',
            message: 'Your account is currently locked. Please wait a few minutes and try again.'
          });
        }

        if (!theuser.local || !theuser.local.derived_key) {
          return done(null, false, {
            error: 'Unauthorized',
            message: 'Invalid username or password'
          });
        }

        _util.default.verifyPassword(theuser.local, password).then(function () {
          // Check if the email has been confirmed if it is required
          if (config.getItem('local.requireEmailConfirm') && !theuser.email) {
            return done(null, false, {
              error: 'Unauthorized',
              message: 'You must confirm your email address.'
            });
          } // Success!!!


          return done(null, theuser);
        }, function (err) {
          if (!err) {
            // Password didn't authenticate
            return handleFailedLogin(theuser, req, done);
          } // Hashing function threw an error


          return done(err);
        });
      } else {
        // user not found
        return done(null, false, {
          error: 'Unauthorized',
          message: 'Invalid username or password'
        });
      }

      return undefined;
    }, done);
  }));
};

var _default = local;
exports.default = _default;