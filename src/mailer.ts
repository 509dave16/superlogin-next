import fs from 'fs'
import BPromise from 'bluebird'
import nodemailer, { Transporter } from 'nodemailer'
import ejs, { Data } from 'ejs'
import stubTransport from 'nodemailer-stub-transport'

const mailer = (config: IConfigure): IMailer => {
	// Initialize the transport mechanism with nodermailer
	let transporter: Transporter
	const customTransport = config.getItem('mailer.transport')
	if (config.getItem('testMode.noEmail')) {
		transporter = nodemailer.createTransport(stubTransport())
	} else if (customTransport) {
		transporter = nodemailer.createTransport(customTransport(
			config.getItem('mailer.options')
		) as string)
	} else {
		transporter = nodemailer.createTransport(config.getItem('mailer.options'))
	}
	return {
		sendEmail: (templateName: string, email: string, locals: Data) => {
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
			const mailOptions: {
				from: string
				to: string
				subject: string
				html?: string
				text?: string
			} = {
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
			const sendEmail = BPromise.promisify(transporter.sendMail, { context: transporter })
			return sendEmail(mailOptions)
		}
	}
}

declare global {
	interface IMailer {
		sendEmail(templateName: string, email: string, locals: Data): void
	}
}

export default mailer
