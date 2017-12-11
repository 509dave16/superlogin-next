"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _util = _interopRequireDefault(require("./util"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const configure = (data, defaults) => ({
  getItem: key => {
    let result = _util.default.getObjectRef(data, key);

    if (typeof result === 'undefined' || result === null) {
      result = _util.default.getObjectRef(defaults, key);
    }

    return result;
  },
  setItem: (key, value) => _util.default.setObjectRef(data, key, value),
  removeItem: key => _util.default.delObjectRef(defaults, key)
});

var _default = configure;
exports.default = _default;