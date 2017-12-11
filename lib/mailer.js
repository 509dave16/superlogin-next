"use strict";

exports.__esModule = true;
exports.default = void 0;

var _ejs = _interopRequireDefault(require("ejs"));

var _fs = _interopRequireDefault(require("fs"));

var _nodemailer = _interopRequireDefault(require("nodemailer"));

var _nodemailerStubTransport = _interopRequireDefault(require("nodemailer-stub-transport"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird');

var mailer = function mailer(config) {
  // Initialize the transport mechanism with nodermailer
  var transporter;
  var customTransport = config.getItem('mailer.transport');

  if (config.getItem('testMode.noEmail')) {
    transporter = _nodemailer.default.createTransport((0, _nodemailerStubTransport.default)());
  } else if (customTransport) {
    transporter = _nodemailer.default.createTransport(customTransport(config.getItem('mailer.options')));
  } else {
    transporter = _nodemailer.default.createTransport(config.getItem('mailer.options'));
  }

  return {
    sendEmail: function sendEmail(templateName, email, locals) {
      // load the template and parse it
      var templateFile = config.getItem("emails." + templateName + ".template");

      if (!templateFile) {
        return Promise.reject("No template found for \"" + templateName + "\".");
      }

      var template = _fs.default.readFileSync(templateFile, 'utf8');

      if (!template) {
        return Promise.reject("Failed to locate template file: " + templateFile);
      }

      var body = _ejs.default.render(template, locals); // form the email


      var subject = config.getItem("emails." + templateName + ".subject");
      var format = config.getItem("emails." + templateName + ".format");
      var mailOptions = {
        from: config.getItem('mailer.fromEmail'),
        to: email,
        subject: subject
      };

      if (format === 'html') {
        mailOptions.html = body;
      } else {
        mailOptions.text = body;
      }

      if (config.getItem('testMode.debugEmail')) {
        console.log(mailOptions);
      } // send the message


      var sendEmail = Promise.promisify(transporter.sendMail, {
        context: transporter
      });
      return sendEmail(mailOptions);
    }
  };
};

var _default = mailer;
exports.default = _default;