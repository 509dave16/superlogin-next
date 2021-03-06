"use strict";

exports.__esModule = true;
exports.default = void 0;

var _pouchdbNode = _interopRequireDefault(require("pouchdb-node"));

var _pouchdbSeedDesign = _interopRequireDefault(require("pouchdb-seed-design"));

var _util = _interopRequireDefault(require("./../util"));

var _cloudant = _interopRequireDefault(require("./cloudant"));

var _couchdb = _interopRequireDefault(require("./couchdb"));

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

      function _unchained(v) {}

      function thenChain(res, rej) {
        this.resolve = res;
        this.reject = rej;
      }

      function Chained() {}

      ;
      Chained.prototype = {
        resolve: _unchained,
        reject: _unchained,
        then: thenChain
      };

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

  function boundThen() {
    return resolver.apply(self, arguments);
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
};

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } } function _next(value) { step("next", value); } function _throw(err) { step("throw", err); } _next(); }); }; }

// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird'); // Escapes any characters that are illegal in a CouchDB database name using percent codes inside parenthesis
// Example: 'My.name@example.com' => 'my(2e)name(40)example(2e)com'

var getLegalDBName = function getLegalDBName(input) {
  return encodeURIComponent(input.toLowerCase()).replace(/\./g, '%2E').replace(/!/g, '%21').replace(/~/g, '%7E').replace(/\*/g, '%2A').replace(/!/g, '%21').replace(/~/g, '%7E').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/-/g, '%2D').toLowerCase().replace(/(%..)/g, function (esc) {
    return "(" + esc.substr(1) + ")";
  });
};

var dbAuth = function dbAuth(config, userDB, couchAuthDB) {
  var cloudant = config.get().dbServer.cloudant;
  var adapter = cloudant ? _cloudant.default : (0, _couchdb.default)(couchAuthDB);

  var createDB =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(function* (dbName) {
      var finalUrl = _util.default.getDBURL(config.get().dbServer) + "/" + dbName;

      try {
        var db = new _pouchdbNode.default(finalUrl);
        return yield db.info();
      } catch (error) {
        console.error('create DB error', error);
        return Promise.reject(error);
      }
    });

    return function createDB(_x) {
      return _ref.apply(this, arguments);
    };
  }();

  var getDesignDoc = function getDesignDoc(docName) {
    if (!docName) {
      return null;
    }

    var userDBs = config.get().userDBs;
    var designDocDir = userDBs ? userDBs.designDocDir : __dirname;

    try {
      // tslint:disable-next-line:non-literal-require
      return require(designDocDir + "/" + docName);
    } catch (err) {
      console.warn("Design doc: " + designDocDir + "/" + docName + " not found.");
      return undefined;
    }
  };

  var storeKey =
  /*#__PURE__*/
  function () {
    var _ref2 = _asyncToGenerator(function* (username, key, password, expires, roles) {
      return adapter.storeKey(username, key, password, expires, roles);
    });

    return function storeKey(_x2, _x3, _x4, _x5, _x6) {
      return _ref2.apply(this, arguments);
    };
  }();

  var removeKeys =
  /*#__PURE__*/
  function () {
    var _ref3 = _asyncToGenerator(function* (keys) {
      return adapter.removeKeys(keys);
    });

    return function removeKeys(_x7) {
      return _ref3.apply(this, arguments);
    };
  }();

  var authorizeKeys =
  /*#__PURE__*/
  function () {
    var _ref4 = _asyncToGenerator(function* (user_id, db, keys, permissions, roles) {
      return adapter.authorizeKeys(user_id, db, keys, permissions, roles);
    });

    return function authorizeKeys(_x8, _x9, _x10, _x11, _x12) {
      return _ref4.apply(this, arguments);
    };
  }();

  var deauthorizeKeys =
  /*#__PURE__*/
  function () {
    var _ref5 = _asyncToGenerator(function* (db, keys) {
      return adapter.deauthorizeKeys(db, keys);
    });

    return function deauthorizeKeys(_x13, _x14) {
      return _ref5.apply(this, arguments);
    };
  }();

  var deauthorizeUser =
  /*#__PURE__*/
  function () {
    var _ref6 = _asyncToGenerator(function* (userDoc, keys) {
      if (!userDoc) {
        console.error('deauthorizeUser error - no userdoc specified');
        return Promise.resolve(false);
      } // If keys is not specified we will deauthorize all of the users sessions


      var finalKeys = keys ? _util.default.toArray(keys) : _util.default.getSessions(userDoc);

      if (userDoc.personalDBs && typeof userDoc.personalDBs === 'object') {
        return Promise.all(Object.keys(userDoc.personalDBs).map(
        /*#__PURE__*/
        function () {
          var _ref7 = _asyncToGenerator(function* (personalDB) {
            try {
              var db = new _pouchdbNode.default(_util.default.getDBURL(config.get().dbServer) + "/" + personalDB, {
                skip_setup: true
              });
              return deauthorizeKeys(db, finalKeys);
            } catch (error) {
              console.error('error deauthorizing db!', error);
              return Promise.resolve();
            }
          });

          return function (_x17) {
            return _ref7.apply(this, arguments);
          };
        }()));
      }

      console.error('deauthorizeUser error - user has no personalDBs');
      return Promise.resolve(false);
    });

    return function deauthorizeUser(_x15, _x16) {
      return _ref6.apply(this, arguments);
    };
  }();

  var authorizeUserSessions =
  /*#__PURE__*/
  function () {
    var _ref8 = _asyncToGenerator(function* (user_id, personalDBs, keys, roles) {
      var _config$get = config.get(),
          userDBs = _config$get.userDBs;

      try {
        var sessionKeys = _util.default.toArray(keys);

        return Promise.all(Object.keys(personalDBs).map(
        /*#__PURE__*/
        function () {
          var _ref9 = _asyncToGenerator(function* (personalDB) {
            var _personalDBs$personal = personalDBs[personalDB],
                permissions = _personalDBs$personal.permissions,
                name = _personalDBs$personal.name;
            var configModel = userDBs && userDBs.model;
            var finalPermissions = permissions || (configModel ? configModel[name] && configModel[name].permissions || configModel._default && configModel._default.permissions : undefined);
            var db = new _pouchdbNode.default(_util.default.getDBURL(config.get().dbServer) + "/" + personalDB, {
              skip_setup: true
            });
            return authorizeKeys(user_id, db, sessionKeys, finalPermissions, roles);
          });

          return function (_x22) {
            return _ref9.apply(this, arguments);
          };
        }()));
      } catch (error) {
        console.error('error authorizing user sessions', error);
        return undefined;
      }
    });

    return function authorizeUserSessions(_x18, _x19, _x20, _x21) {
      return _ref8.apply(this, arguments);
    };
  }();

  var addUserDB =
  /*#__PURE__*/
  function () {
    var _ref10 = _asyncToGenerator(function* (userDoc, dbName, designDocs, type, permissions, aRoles, mRoles) {
      var _config$get2 = config.get(),
          userDBs = _config$get2.userDBs;

      var adminRoles = aRoles || [];
      var memberRoles = mRoles || []; // Create and the database and seed it if a designDoc is specified

      var prefix = userDBs && userDBs.privatePrefix ? userDBs.privatePrefix + "_" : '';
      var username = getLegalDBName(userDoc._id); // Make sure we have a legal database name

      var finalDBName = type === 'shared' ? dbName : "" + prefix + dbName + "$" + username;

      try {
        var newDB = new _pouchdbNode.default(_util.default.getDBURL(config.get().dbServer) + "/" + finalDBName);
        yield adapter.initSecurity(newDB, adminRoles, memberRoles); // Seed the design docs

        if (designDocs && Array.isArray(designDocs)) {
          yield Promise.all(designDocs.map(
          /*#__PURE__*/
          function () {
            var _ref11 = _asyncToGenerator(function* (ddName) {
              var dDoc = getDesignDoc(ddName);

              if (dDoc) {
                yield (0, _pouchdbSeedDesign.default)(newDB, dDoc);
                return Promise.resolve();
              } else {
                console.warn("Failed to locate design doc: " + ddName);
                return Promise.resolve();
              }
            });

            return function (_x30) {
              return _ref11.apply(this, arguments);
            };
          }()));
        }

        if (userDoc.session) {
          // Authorize the user's existing DB keys to access the new database
          var keysToAuthorize = Object.keys(userDoc.session).filter(function (k) {
            var expires = userDoc.session[k].expires;
            return expires && expires > Date.now();
          });

          if (keysToAuthorize.length > 0) {
            yield authorizeKeys(userDoc._id, newDB, keysToAuthorize, permissions, userDoc.roles);
          }
        }

        return finalDBName;
      } catch (error) {
        console.error('create user db error', error);
        return finalDBName;
      }
    });

    return function addUserDB(_x23, _x24, _x25, _x26, _x27, _x28, _x29) {
      return _ref10.apply(this, arguments);
    };
  }();

  var removeExpiredKeys =
  /*#__PURE__*/
  function () {
    var _ref12 = _asyncToGenerator(function* () {
      try {
        // query a list of expired keys by user
        var results = yield userDB.query('auth/expiredKeys', {
          endkey: Date.now(),
          include_docs: true
        });

        var _results$rows$reduce = results.rows.reduce(function (r, _ref13) {
          var _extends2;

          var value = _ref13.value,
              doc = _ref13.doc;

          if (!value) {
            return r;
          }

          var user = value.user,
              key = value.key; // Append expired keys

          var newExpiredKeys = r.expiredKeys.concat([key]);

          var newKeysByUser = _extends({}, r.keysByUser, (_extends2 = {}, _extends2[user] = key, _extends2));

          if (doc) {
            var _extends3;

            var session = doc.session,
                userDoc = _objectWithoutProperties(doc, ["session"]);

            var deleted = session[key],
                finalSession = _objectWithoutProperties(session, [key]);

            var newUserDocs = _extends({}, r.userDocs, (_extends3 = {}, _extends3[user] = _extends({}, userDoc, {
              session: finalSession
            }), _extends3));

            return {
              expiredKeys: newExpiredKeys,
              userDocs: newUserDocs,
              keysByUser: newKeysByUser
            };
          }

          return _extends({}, r, {
            expiredKeys: newExpiredKeys,
            keysByUser: newKeysByUser
          });
        }, {
          expiredKeys: [''],
          userDocs: {},
          keysByUser: {}
        }),
            expiredKeys = _results$rows$reduce.expiredKeys,
            userDocs = _results$rows$reduce.userDocs,
            keysByUser = _results$rows$reduce.keysByUser;

        yield removeKeys(expiredKeys);
        yield Promise.all(Object.keys(keysByUser).map(
        /*#__PURE__*/
        function () {
          var _ref14 = _asyncToGenerator(function* (user) {
            return deauthorizeUser(userDocs[user], keysByUser[user]);
          });

          return function (_x31) {
            return _ref14.apply(this, arguments);
          };
        }())); // Bulk save user doc updates

        yield userDB.bulkDocs(Object.values(userDocs));
        return expiredKeys;
      } catch (error) {
        console.error('error expiring keys', error);
        return undefined;
      }
    });

    return function removeExpiredKeys() {
      return _ref12.apply(this, arguments);
    };
  }();

  var getDBConfig = function getDBConfig(dbName, type) {
    var _config$get3 = config.get(),
        userDBs = _config$get3.userDBs;

    if (!userDBs) {
      return {
        name: dbName,
        type: type || 'private',
        designDocs: [],
        permissions: [],
        adminRoles: [],
        memberRoles: []
      };
    }

    var defaultSecurityRoles = userDBs.defaultSecurityRoles,
        model = userDBs.model;
    var adminRoles = defaultSecurityRoles && defaultSecurityRoles.admins || [];
    var memberRoles = defaultSecurityRoles && defaultSecurityRoles.members || [];
    var dbConfigRef = model && model[dbName];

    if (dbConfigRef) {
      var refAdminRoles = dbConfigRef.adminRoles || [];
      var refMemberRoles = dbConfigRef.memberRoles || [];
      return {
        name: dbName,
        permissions: dbConfigRef.permissions || [],
        designDocs: dbConfigRef.designDocs || [],
        type: type || dbConfigRef.type || 'private',
        adminRoles: adminRoles.filter(function (r) {
          return !refAdminRoles.includes(r);
        }).concat(refAdminRoles),
        memberRoles: memberRoles.filter(function (r) {
          return !refMemberRoles.includes(r);
        }).concat(refMemberRoles)
      };
    }

    var permissions = model && model._default ? model._default.permissions : [];
    var designDocs = model && model._default && (!type || type === 'private') ? model._default.designDocs || [] : [];
    return {
      name: dbName,
      permissions: permissions,
      designDocs: designDocs,
      type: type || 'private',
      adminRoles: adminRoles,
      memberRoles: memberRoles
    };
  };

  var removeDB =
  /*#__PURE__*/
  function () {
    var _ref15 = _asyncToGenerator(function* (dbName) {
      try {
        var db = new _pouchdbNode.default(_util.default.getDBURL(config.get().dbServer) + "/" + dbName, {
          skip_setup: true
        });
        return yield db.destroy();
      } catch (error) {
        console.error('remove db failed!', dbName, error);
        return Promise.reject(error);
      }
    });

    return function removeDB(_x32) {
      return _ref15.apply(this, arguments);
    };
  }();

  return {
    removeDB: removeDB,
    createDB: createDB,
    getDBConfig: getDBConfig,
    getDesignDoc: getDesignDoc,
    removeExpiredKeys: removeExpiredKeys,
    addUserDB: addUserDB,
    authorizeUserSessions: authorizeUserSessions,
    authorizeKeys: authorizeKeys,
    deauthorizeKeys: deauthorizeKeys,
    deauthorizeUser: deauthorizeUser,
    removeKeys: removeKeys,
    storeKey: storeKey
  };
};

var _default = dbAuth;
exports.default = _default;