"use strict";

exports.__esModule = true;
exports.default = void 0;
// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird'); // Contains middleware useful for securing your routes

var middleware = function middleware(passport) {
  var forbiddenError = {
    error: 'Forbidden',
    message: 'You do not have permission to access this resource.',
    status: 403
  };
  var superloginError = {
    error: 'superlogin',
    message: 'requireAuth must be used before checking roles',
    status: 500 // Requires that the user be authenticated with a bearer token

  };

  var requireAuth = function requireAuth(req, res, next) {
    passport.authenticate('bearer', {
      session: false
    })(req, res, next);
  }; // Requires that the user have the specified role


  var requireRole = function requireRole(requiredRole) {
    return function (req, res, next) {
      if (!req.user) {
        return next(superloginError);
      }

      var roles = req.user.roles;

      if (!roles || !roles.length || roles.indexOf(requiredRole) === -1) {
        res.status(forbiddenError.status);
        res.json(forbiddenError);
      } else {
        next();
      }

      return undefined;
    };
  }; // Requires that the user have at least one of the specified roles


  var requireAnyRole = function requireAnyRole(possibleRoles) {
    return function (req, res, next) {
      if (!req.user) {
        return next(superloginError);
      }

      var denied = true;
      var roles = req.user.roles;

      if (roles && roles.length) {
        possibleRoles.forEach(function (role) {
          return denied = roles.indexOf(role) === -1;
        });
      }

      if (denied) {
        res.status(forbiddenError.status);
        res.json(forbiddenError);
      } else {
        next();
      }

      return undefined;
    };
  };

  var requireAllRoles = function requireAllRoles(requiredRoles) {
    return function (req, res, next) {
      if (!req.user) {
        return next(superloginError);
      }

      var denied = false;
      var roles = req.user.roles;

      if (!roles || !roles.length) {
        denied = true;
      } else {
        requiredRoles.forEach(function (role) {
          return denied = roles.indexOf(role) === -1;
        });
      }

      if (denied) {
        res.status(forbiddenError.status);
        res.json(forbiddenError);
      } else {
        next();
      }

      return undefined;
    };
  };

  return {
    requireAuth: requireAuth,
    requireRole: requireRole,
    requireAnyRole: requireAnyRole,
    requireAllRoles: requireAllRoles
  };
};

var _default = middleware;
exports.default = _default;