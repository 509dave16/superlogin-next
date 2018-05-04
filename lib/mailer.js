"use strict";

exports.__esModule = true;
exports.default = void 0;

var _debug = _interopRequireDefault(require("debug"));

var _ejs = _interopRequireDefault(require("ejs"));

var _fs = _interopRequireDefault(require("fs"));

var _nodemailer = _interopRequireDefault(require("nodemailer"));

var _nodemailerStubTransport = _interopRequireDefault(require("nodemailer-stub-transport"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird');
var debug = (0, _debug.default)('superlogin');

var mailer = function mailer(config) {
  var configMailer = config.get().mailer;
  var configTestMode = config.get().testMode;
  var transport = !configMailer || configTestMode && configTestMode.noEmail ? (0, _nodemailerStubTransport.default)() : configMailer.transport || configMailer.options; // Initialize the transport mechanism with nodermailer

  var transporter = _nodemailer.default.createTransport(transport);

  var sendEmail = Promise.promisify(transporter.sendMail, {
    context: transporter
  });
  return {
    sendEmail: function (_sendEmail) {
      function sendEmail(_x, _x2, _x3) {
        return _sendEmail.apply(this, arguments);
      }

      sendEmail.toString = function () {
        return _sendEmail.toString();
      };

      return sendEmail;
    }(function (templateName, email, locals) {
      // load the template and parse it
      var template = config.get().emails[templateName];

      if (!template) {
        return Promise.reject("No template found for \"" + templateName + "\".");
      }

      var subject = template.subject,
          format = template.format,
          templatePath = template.template;

      var templateFile = _fs.default.readFileSync(templatePath, 'utf8');

      if (!templateFile) {
        return Promise.reject("Failed to locate template file: " + templatePath);
      }

      var body = _ejs.default.render(templateFile, locals); // form the email


      var mailOptions = {
        from: configMailer ? configMailer.fromEmail : undefined,
        to: email,
        subject: subject,
        html: format === 'html' ? body : undefined,
        text: format !== 'html' ? body : undefined
      };

      if (configTestMode && configTestMode.debugEmail) {
        debug(mailOptions);
      } // send the message


      return sendEmail(mailOptions);
    })
  };
};

var _default = mailer;
exports.default = _default;