"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.deauthorizeKeys = exports.authorizeKeys = exports.initSecurity = exports.removeKeys = exports.storeKey = exports.putSecurityCloudant = exports.getSecurityCloudant = exports.getAPIKey = void 0;

const url = require('url');

const BPromise = require('bluebird');

const request = require('superagent');

const util = require('./../util');

const getSecurityUrl = db => {
  const parsedUrl = url.parse(db.name);
  parsedUrl.pathname += '/_security';
  return url.format(parsedUrl);
};

const getAPIKey = db => {
  const parsedUrl = url.parse(db.name);
  parsedUrl.pathname = '/_api/v2/api_keys';
  const finalUrl = url.format(parsedUrl);
  return BPromise.fromNode(callback => {
    request.post(finalUrl) //       .set(db.getHeaders())
    .end(callback);
  }).then(res => {
    const result = JSON.parse(res.text);

    if (result.key && result.password && result.ok === true) {
      return Promise.resolve(result);
    }

    return Promise.reject(result);
  });
};

exports.getAPIKey = getAPIKey;

const getSecurityCloudant = db => {
  const finalUrl = getSecurityUrl(db);
  return BPromise.fromNode(callback => {
    request.get(finalUrl) //       .set(db.getHeaders())
    .end(callback);
  }).then(res => Promise.resolve(JSON.parse(res.text)));
};

exports.getSecurityCloudant = getSecurityCloudant;

const putSecurityCloudant = (db, doc) => {
  const finalUrl = getSecurityUrl(db);
  return BPromise.fromNode(callback => {
    request.put(finalUrl) //       .set(db.getHeaders())
    .send(doc).end(callback);
  }).then(res => Promise.resolve(JSON.parse(res.text)));
}; // This is not needed with Cloudant


exports.putSecurityCloudant = putSecurityCloudant;

const storeKey = () => Promise.resolve(); // This is not needed with Cloudant


exports.storeKey = storeKey;

const removeKeys = () => Promise.resolve();

exports.removeKeys = removeKeys;

const initSecurity = (db, adminRoles, memberRoles) => {
  let changes = false;
  return db.get('_security').then(secDoc => {
    if (!secDoc.admins) {
      secDoc.admins = {
        names: [],
        roles: []
      };
    }

    if (!secDoc.admins.roles) {
      secDoc.admins.roles = [];
    }

    if (!secDoc.members) {
      secDoc.members = {
        names: [],
        roles: []
      };
    }

    if (!secDoc.members.roles) {
      secDoc.admins.roles = [];
    }

    adminRoles.forEach(role => {
      if (secDoc.admins.roles.indexOf(role) === -1) {
        changes = true;
        secDoc.admins.roles.push(role);
      }
    });
    memberRoles.forEach(role => {
      if (secDoc.members.roles.indexOf(role) === -1) {
        changes = true;
        secDoc.members.roles.push(role);
      }
    });

    if (changes) {
      return putSecurityCloudant(db, secDoc);
    }

    return Promise.resolve(false);
  });
};

exports.initSecurity = initSecurity;

const authorizeKeys = (user_id, db, keys, permissions, roles) => {
  let keysObj = {};

  if (!permissions) {
    permissions = ['_reader', '_replicator'];
  }

  permissions = permissions.concat(roles || []);
  permissions.unshift(`user:${user_id}`); // If keys is a single value convert it to an Array

  keys = util.toArray(keys); // Check if keys is an array and convert it to an object

  if (keys instanceof Array) {
    keys.forEach(key => {
      keysObj[key] = permissions;
    });
  } else {
    keysObj = keys;
  } // Pull the current _security doc


  return getSecurityCloudant(db).then(secDoc => {
    if (!secDoc._id) {
      secDoc._id = '_security';
    }

    if (!secDoc.cloudant) {
      secDoc.cloudant = {};
    }

    Object.keys(keysObj).forEach(key => {
      secDoc.cloudant[key] = keysObj[key];
    });
    return putSecurityCloudant(db, secDoc);
  });
};

exports.authorizeKeys = authorizeKeys;

const deauthorizeKeys = (db, keys) => {
  // cast keys to an Array
  keys = util.toArray(keys);
  return getSecurityCloudant(db).then(secDoc => {
    let changes = false;

    if (!secDoc.cloudant) {
      return Promise.resolve(false);
    }

    keys.forEach(key => {
      if (secDoc.cloudant[key]) {
        changes = true;
        delete secDoc.cloudant[key];
      }
    });

    if (changes) {
      return putSecurityCloudant(db, secDoc);
    }

    return Promise.resolve(false);
  });
};

exports.deauthorizeKeys = deauthorizeKeys;