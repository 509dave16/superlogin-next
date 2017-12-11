"use strict";

exports.__esModule = true;
exports.default = void 0;

var _util = _interopRequireDefault(require("./util"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var configure = function configure(data, defaults) {
  return {
    getItem: function getItem(key) {
      var result = _util.default.getObjectRef(data, key);

      if (typeof result === 'undefined' || result === null) {
        result = _util.default.getObjectRef(defaults, key);
      }

      return result;
    },
    setItem: function setItem(key, value) {
      return _util.default.setObjectRef(data, key, value);
    },
    removeItem: function removeItem(key) {
      return _util.default.delObjectRef(defaults, key);
    }
  };
};

var _default = configure;
exports.default = _default;