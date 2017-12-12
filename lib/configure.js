"use strict";

exports.__esModule = true;
exports.default = void 0;

var configure = function configure(data, defaults) {
  var finalConfig = Object.assign({}, defaults, data);
  return {
    get: function get() {
      return finalConfig;
    },
    set: function set(setFunc) {
      return finalConfig = setFunc(finalConfig);
    }
  };
};

var _default = configure;
exports.default = _default;