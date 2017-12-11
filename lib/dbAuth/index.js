"use strict";

exports.__esModule = true;
exports.default = void 0;

var _pouchdbNode = _interopRequireDefault(require("pouchdb-node"));

var _pouchdbSeedDesign = _interopRequireDefault(require("pouchdb-seed-design"));

var _superagent = _interopRequireDefault(require("superagent"));

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

// Escapes any characters that are illegal in a CouchDB database name using percent codes inside parenthesis
// Example: 'My.name@example.com' => 'my(2e)name(40)example(2e)com'
var getLegalDBName = function getLegalDBName(input) {
  input = input.toLowerCase();
  var output = encodeURIComponent(input);
  output = output.replace(/\./g, '%2E');
  output = output.replace(/!/g, '%21');
  output = output.replace(/~/g, '%7E');
  output = output.replace(/\*/g, '%2A');
  output = output.replace(/'/g, '%27');
  output = output.replace(/\(/g, '%28');
  output = output.replace(/\)/g, '%29');
  output = output.replace(/-/g, '%2D');
  output = output.toLowerCase();
  output = output.replace(/(%..)/g, function (esc) {
    esc = esc.substr(1);
    return "(" + esc + ")";
  });
  return output;
};

var dbauth = function dbauth(config, userDB, couchAuthDB) {
  var cloudant = config.getItem('dbServer.cloudant');
  var adapter;

  if (cloudant) {
    adapter = _cloudant.default;
  } else {
    adapter = (0, _couchdb.default)(couchAuthDB);
  }

  var createDB =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(function* (dbName) {
      var finalUrl = _util.default.getDBURL(config.getItem('dbServer')) + "/" + dbName;

      try {
        var res = yield _superagent.default.put(finalUrl).send({});
        return JSON.parse(res.text);
      } catch (error) {
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

    var designDoc;
    var designDocDir = config.getItem('userDBs.designDocDir');

    if (!designDocDir) {
      designDocDir = __dirname;
    }

    try {
      // tslint:disable-next-line:non-literal-require
      designDoc = require(designDocDir + "/" + docName);
    } catch (err) {
      console.warn("Design doc: " + designDocDir + "/" + docName + " not found.");
      designDoc = null;
    }

    return designDoc;
  };

  var storeKey = function storeKey(username, key, password, expires, roles) {
    return adapter.storeKey(username, key, password, expires, roles);
  };

  var removeKeys = function removeKeys(keys) {
    return adapter.removeKeys(keys);
  }; // tslint:disable-next-line:no-any


  var authorizeKeys = function authorizeKeys(user_id, db, keys, permissions, roles) {
    return adapter.authorizeKeys(user_id, db, keys, permissions, roles);
  }; // tslint:disable-next-line:no-any


  var deauthorizeKeys = function deauthorizeKeys(db, keys) {
    return adapter.deauthorizeKeys(db, keys);
  };

  var deauthorizeUser =
  /*#__PURE__*/
  function () {
    var _ref2 = _asyncToGenerator(function* (userDoc, keys) {
      // If keys is not specified we will deauthorize all of the users sessions
      if (!keys) {
        keys = _util.default.getSessions(userDoc);
      }

      keys = _util.default.toArray(keys);

      if (userDoc.personalDBs && typeof userDoc.personalDBs === 'object') {
        return Promise.all(Object.keys(userDoc.personalDBs).map(
        /*#__PURE__*/
        function () {
          var _ref3 = _asyncToGenerator(function* (personalDB) {
            try {
              var db = new _pouchdbNode.default(_util.default.getDBURL(config.getItem('dbServer')) + "/" + personalDB, {
                skip_setup: true
              });
              deauthorizeKeys(db, keys);
              return Promise.resolve();
            } catch (error) {
              console.log('error deauthorizing db!', error);
              return Promise.resolve();
            }
          });

          return function (_x4) {
            return _ref3.apply(this, arguments);
          };
        }()));
      }

      return Promise.resolve(false);
    });

    return function deauthorizeUser(_x2, _x3) {
      return _ref2.apply(this, arguments);
    };
  }();

  var authorizeUserSessions =
  /*#__PURE__*/
  function () {
    var _ref4 = _asyncToGenerator(function* (user_id, personalDBs, sessionKeys, roles) {
      sessionKeys = _util.default.toArray(sessionKeys);
      return Promise.all(Object.keys(personalDBs).map(
      /*#__PURE__*/
      function () {
        var _ref5 = _asyncToGenerator(function* (personalDB) {
          var permissions = personalDBs[personalDB].permissions;

          if (!permissions) {
            permissions = config.getItem("userDBs.model." + personalDBs[personalDB].name + ".permissions") || config.getItem('userDBs.model._default.permissions') || [];
          }

          var db = new _pouchdbNode.default(_util.default.getDBURL(config.getItem('dbServer')) + "/" + personalDB, {
            skip_setup: true
          });
          return authorizeKeys(user_id, db, sessionKeys, permissions, roles);
        });

        return function (_x9) {
          return _ref5.apply(this, arguments);
        };
      }()));
    });

    return function authorizeUserSessions(_x5, _x6, _x7, _x8) {
      return _ref4.apply(this, arguments);
    };
  }();

  var addUserDB =
  /*#__PURE__*/
  function () {
    var _ref6 = _asyncToGenerator(function* (userDoc, dbName, designDocs, type, permissions, adminRoles, memberRoles) {
      adminRoles = adminRoles || [];
      memberRoles = memberRoles || []; // Create and the database and seed it if a designDoc is specified

      var prefix = config.getItem('userDBs.privatePrefix') ? config.getItem('userDBs.privatePrefix') + "_" : '';
      var finalDBName;
      var newDB; // Make sure we have a legal database name

      var username = userDoc._id;
      username = getLegalDBName(username);

      if (type === 'shared') {
        finalDBName = dbName;
      } else {
        finalDBName = prefix + dbName + "$" + username;
      }

      yield createDB(finalDBName);
      newDB = new _pouchdbNode.default(_util.default.getDBURL(config.getItem('dbServer')) + "/" + finalDBName);
      adapter.initSecurity(newDB, adminRoles, memberRoles); // Seed the design docs

      if (designDocs && Array.isArray(designDocs)) {
        yield Promise.all(designDocs.map(
        /*#__PURE__*/
        function () {
          var _ref7 = _asyncToGenerator(function* (ddName) {
            var dDoc = getDesignDoc(ddName);

            if (dDoc) {
              yield (0, _pouchdbSeedDesign.default)(newDB, dDoc);
            } else {
              console.warn("Failed to locate design doc: " + ddName);
              return Promise.resolve();
            }
          });

          return function (_x17) {
            return _ref7.apply(this, arguments);
          };
        }()));
      } // Authorize the user's existing DB keys to access the new database


      var keysToAuthorize = [];

      if (userDoc.session) {
        Object.keys(userDoc.session).forEach(function (key) {
          var expires = userDoc.session[key].expires;

          if (expires && expires > Date.now()) {
            keysToAuthorize.push(key);
          }
        });
      }

      if (keysToAuthorize.length > 0) {
        authorizeKeys(userDoc._id, newDB, keysToAuthorize, permissions, userDoc.roles);
      }

      return finalDBName;
    });

    return function addUserDB(_x10, _x11, _x12, _x13, _x14, _x15, _x16) {
      return _ref6.apply(this, arguments);
    };
  }();

  var removeExpiredKeys =
  /*#__PURE__*/
  function () {
    var _ref8 = _asyncToGenerator(function* () {
      var keysByUser = {};
      var userDocs = {};
      var expiredKeys = []; // query a list of expired keys by user

      var results = yield userDB.query('auth/expiredKeys', {
        endkey: Date.now(),
        include_docs: true
      }); // group by user

      results.rows.forEach(function (row) {
        keysByUser[row.value.user] = row.value.key;
        expiredKeys.push(row.value.key); // Add the user doc if it doesn't already exist

        if (typeof userDocs[row.value.user] === 'undefined') {
          userDocs[row.value.user] = row.doc;
        } // remove each key from user.session


        if (userDocs[row.value.user].session) {
          Object.keys(userDocs[row.value.user].session).forEach(function (session) {
            return row.value.key === session ? delete userDocs[row.value.user].session[session] : undefined;
          });
        }
      });
      yield Promise.all(Object.keys(keysByUser).map(
      /*#__PURE__*/
      function () {
        var _ref9 = _asyncToGenerator(function* (user) {
          return deauthorizeUser(userDocs[user], keysByUser[user]);
        });

        return function (_x18) {
          return _ref9.apply(this, arguments);
        };
      }())); // Bulk save user doc updates

      yield userDB.bulkDocs(Object.values(userDocs));
      return expiredKeys;
    });

    return function removeExpiredKeys() {
      return _ref8.apply(this, arguments);
    };
  }();

  var getDBConfig = function getDBConfig(dbName, type) {
    var dbConfig = {
      name: dbName
    };
    dbConfig.adminRoles = config.getItem('userDBs.defaultSecurityRoles.admins') || [];
    dbConfig.memberRoles = config.getItem('userDBs.defaultSecurityRoles.members') || [];
    var dbConfigRef = "userDBs.model." + dbName;

    if (config.getItem(dbConfigRef)) {
      dbConfig.permissions = config.getItem(dbConfigRef + ".permissions") || [];
      dbConfig.designDocs = config.getItem(dbConfigRef + ".designDocs") || [];
      dbConfig.type = type || config.getItem(dbConfigRef + ".type") || 'private';
      var dbAdminRoles = config.getItem(dbConfigRef + ".adminRoles");
      var dbMemberRoles = config.getItem(dbConfigRef + ".memberRoles");

      if (dbAdminRoles && Array.isArray(dbAdminRoles)) {
        dbAdminRoles.forEach(function (role) {
          if (role && dbConfig.adminRoles && dbConfig.adminRoles.indexOf(role) === -1) {
            dbConfig.adminRoles.push(role);
          }
        });
      }

      if (dbMemberRoles && dbMemberRoles instanceof Array) {
        dbMemberRoles.forEach(function (role) {
          if (role && dbConfig.memberRoles && dbConfig.memberRoles.indexOf(role) === -1) {
            dbConfig.memberRoles.push(role);
          }
        });
      }
    } else if (config.getItem('userDBs.model._default')) {
      dbConfig.permissions = config.getItem('userDBs.model._default.permissions') || []; // Only add the default design doc to a private database

      if (!type || type === 'private') {
        dbConfig.designDocs = config.getItem('userDBs.model._default.designDocs') || [];
      } else {
        dbConfig.designDocs = [];
      }

      dbConfig.type = type || 'private';
    } else {
      dbConfig.type = type || 'private';
    }

    return dbConfig;
  };

  var removeDB =
  /*#__PURE__*/
  function () {
    var _ref10 = _asyncToGenerator(function* (dbName) {
      try {
        var db = new _pouchdbNode.default(_util.default.getDBURL(config.getItem('dbServer')) + "/" + dbName, {
          skip_setup: true
        });
        yield db.destroy();
        return Promise.resolve();
      } catch (error) {
        console.log('remove db failed!', dbName, error);
        return Promise.reject(error);
      }
    });

    return function removeDB(_x19) {
      return _ref10.apply(this, arguments);
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

var _default = dbauth;
exports.default = _default;