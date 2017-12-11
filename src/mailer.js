const fs = require('fs')
const BPromise = require('bluebird')
const nodemailer = require('nodemailer')
const ejs = require('ejs')
const stubTransport = require('nodemailer-stub-transport')

function mailer(config) {
	// Initialize the transport mechanism with nodermailer
	let transporter
	const customTransport = config.getItem('mailer.transport')
	if (config.getItem('testMode.noEmail')) {
		transporter = nodemailer.createTransport(stubTransport())
	} else if (customTransport) {
		transporter = nodemailer.createTransport(customTransport(config.getItem('mailer.options')))
	} else {
		transporter = nodemailer.createTransport(config.getItem('mailer.options'))
	}

	this.sendEmail = (templateName, email, locals) => {
		// load the template and parse it
		const templateFile = config.getItem(`emails.${templateName}.template`)
		if (!templateFile) {
			return Promise.reject(`No template found for "${templateName}".`)
		}
		const template = fs.readFileSync(templateFile, 'utf8')
		if (!template) {
			return Promise.reject(`Failed to locate template file: ${templateFile}`)
		}
		const body = ejs.render(template, locals)
		// form the email
		const subject = config.getItem(`emails.${templateName}.subject`)
		const format = config.getItem(`emails.${templateName}.format`)
		const mailOptions = {
			from: config.getItem('mailer.fromEmail'),
			to: email,
			subject
		}
		if (format === 'html') {
			mailOptions.html = body
		} else {
			mailOptions.text = body
		}
		if (config.getItem('testMode.debugEmail')) {
			console.log(mailOptions)
		}
		// send the message
		const sendEmail = BPromise.Promisify(transporter.sendMail, { context: transporter })
		return sendEmail(mailOptions)
	}

	return this
}

export default mailer
