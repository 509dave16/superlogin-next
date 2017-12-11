const url = require('url')
const Model = require('sofa-model')
const extend = require('extend')
const Session = require('./session')
const util = require('./util')
const DBAuth = require('./dbauth')
const merge = require('lodash.merge')
const cloudant = require('./dbauth/cloudant')

// regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/inupsert.js#L4
const EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/
const USER_REGEXP = /^[a-z0-9_-]{3,16}$/

export default function user(config, userDB, couchAuthDB, mailer, emitter) {
	const self = this
	const dbAuth = new DBAuth(config, userDB, couchAuthDB)
	const session = new Session(config)
	const onCreateActions = []
	const onLinkActions = []

	// Token valid for 24 hours by default
	// Forget password token life
	const tokenLife = config.getItem('security.tokenLife') || 86400
	// Session token life
	const sessionLife = config.getItem('security.sessionLife') || 86400

	const emailUsername = config.getItem('local.emailUsername')

	const addUserDBs = async newUser => {
		// Add personal DBs
		if (!config.getItem('userDBs.defaultDBs')) {
			return Promise.resolve(newUser)
		}
		newUser.personalDBs = {}

		const processUserDBs = async (dbList, type) =>
			Promise.all(
				dbList.map(async userDBName => {
					const dbConfig = dbAuth.getDBConfig(userDBName)
					const finalDBName = await dbAuth.addUserDB(
						newUser,
						userDBName,
						dbConfig.designDocs,
						type,
						dbConfig.permissions,
						dbConfig.adminRoles,
						dbConfig.memberRoles
					)
					delete dbConfig.permissions
					delete dbConfig.adminRoles
					delete dbConfig.memberRoles
					delete dbConfig.designDocs
					dbConfig.type = type
					newUser.personalDBs[finalDBName] = dbConfig
				})
			)

		// Just in case defaultDBs is not specified
		let defaultPrivateDBs = config.getItem('userDBs.defaultDBs.private')
		if (!Array.isArray(defaultPrivateDBs)) {
			defaultPrivateDBs = []
		}
		await processUserDBs(defaultPrivateDBs, 'private')
		let defaultSharedDBs = config.getItem('userDBs.defaultDBs.shared')
		if (!Array.isArray(defaultSharedDBs)) {
			defaultSharedDBs = []
		}
		await processUserDBs(defaultSharedDBs, 'shared')

		return Promise.resolve(newUser)
	}

	const generateSession = (username, roles) => {
		let getKey
		if (config.getItem('dbServer.cloudant')) {
			getKey = cloudant.getAPIKey(userDB)
		} else {
			let token = util.URLSafeUUID()
			// Make sure our token doesn't start with illegal characters
			while (token[0] === '_' || token[0] === '-') {
				token = util.URLSafeUUID()
			}
			getKey = Promise.resolve({
				key: token,
				password: util.URLSafeUUID()
			})
		}
		return getKey.then(key => {
			const now = Date.now()
			return Promise.resolve({
				_id: username,
				key: key.key,
				password: key.password,
				issued: now,
				expires: now + sessionLife * 1000,
				roles
			})
		})
	}

	// Adds numbers to a base name until it finds a unique database key
	const generateUsername = base => {
		base = base.toLowerCase()
		const entries = []
		let finalName
		return userDB
			.allDocs({ startkey: base, endkey: `${base}\uffff`, include_docs: false })
			.then(results => {
				if (results.rows.length === 0) {
					return Promise.resolve(base)
				}
				for (let i = 0; i < results.rows.length; i += 1) {
					entries.push(results.rows[i].id)
				}
				if (entries.indexOf(base) === -1) {
					return Promise.resolve(base)
				}
				let num = 0
				while (!finalName) {
					num += 1
					if (entries.indexOf(base + num) === -1) {
						finalName = base + num
					}
				}
				return Promise.resolve(finalName)
			})
	}

	this.validateUsername = username => {
		if (!username) {
			return Promise.resolve()
		}
		if (!username.match(USER_REGEXP)) {
			return Promise.resolve('Invalid username')
		}
		return userDB.query('auth/username', { key: username }).then(
			result => {
				if (result.rows.length === 0) {
					// Pass!
					return Promise.resolve()
				}
				return Promise.resolve('already in use')
			},
			err => {
				throw new Error(err)
			}
		)
	}

	this.validateEmail = async email => {
		if (!email) {
			return Promise.resolve()
		}
		if (!email.match(EMAIL_REGEXP)) {
			return Promise.resolve('invalid email')
		}
		try {
			const result = await userDB.query('auth/email', { key: email })
			if (result.rows.length === 0) {
				// Pass!
				return Promise.resolve()
			}
			return Promise.resolve('already in use')
		} catch (error) {
			console.log('error validating email', error)
			return Promise.reject(error)
		}
	}

	this.validateEmailUsername = async email => {
		if (!email) {
			return Promise.resolve()
		}
		if (!email.match(EMAIL_REGEXP)) {
			return Promise.resolve('invalid email')
		}
		try {
			const result = await userDB.query('auth/emailUsername', { key: email })
			if (result.rows.length === 0) {
				return Promise.resolve()
			}
			return Promise.resolve('already in use')
		} catch (error) {
			console.log('error validating email/username', error)
			return Promise.reject(error)
		}
	}

	// Validation function for ensuring that two fields match
	this.matches = (value, option, key, attributes) => {
		if (attributes && attributes[option] !== value) {
			return `does not match ${option}`
		}
		return ''
	}

	let passwordConstraints = {
		presence: true,
		length: {
			minimum: 6,
			message: 'must be at least 6 characters'
		},
		matches: 'confirmPassword'
	}

	passwordConstraints = extend(
		true,
		{},
		passwordConstraints,
		config.getItem('local.passwordConstraints')
	)

	const userModel = {
		async: true,
		whitelist: ['name', 'username', 'email', 'password', 'confirmPassword'],
		customValidators: {
			validateEmail: self.validateEmail,
			validateUsername: self.validateUsername,
			validateEmailUsername: self.validateEmailUsername,
			matches: self.matches
		},
		sanitize: {
			name: ['trim'],
			username: ['trim', 'toLowerCase'],
			email: ['trim', 'toLowerCase']
		},
		validate: {
			email: {
				presence: true,
				validateEmail: true
			},
			username: {
				presence: true,
				validateUsername: true
			},
			password: passwordConstraints,
			confirmPassword: {
				presence: true
			}
		},
		static: {
			type: 'user',
			roles: config.getItem('security.defaultRoles'),
			providers: ['local']
		},
		rename: {
			username: '_id'
		}
	}

	if (emailUsername) {
		delete userModel.validate.username
		delete userModel.validate.email.validateEmail
		delete userModel.rename.username
		userModel.validate.email.validateEmailUsername = true
	}

	const resetPasswordModel = {
		async: true,
		customValidators: {
			matches: self.matches
		},
		validate: {
			token: {
				presence: true
			},
			password: passwordConstraints,
			confirmPassword: {
				presence: true
			}
		}
	}

	const changePasswordModel = {
		async: true,
		customValidators: {
			matches: self.matches
		},
		validate: {
			newPassword: passwordConstraints,
			confirmPassword: {
				presence: true
			}
		}
	}

	this.onCreate = fn => {
		if (typeof fn === 'function') {
			onCreateActions.push(fn)
		} else {
			throw new TypeError('onCreate: You must pass in a function')
		}
	}

	this.onLink = fn => {
		if (typeof fn === 'function') {
			onLinkActions.push(fn)
		} else {
			throw new TypeError('onLink: You must pass in a function')
		}
	}

	const processTransformations = (fnArray, userDoc, provider) => {
		let promise
		fnArray.forEach(fn => {
			if (!promise) {
				promise = fn(null, userDoc, provider)
			} else {
				if (!promise.then || typeof Promise.then !== 'function') {
					throw new Error('onCreate function must return a promise')
				}
				promise.then(newUserDoc => fn(null, newUserDoc, provider))
			}
		})
		if (!promise) {
			promise = Promise.resolve(userDoc)
		}
		return promise
	}

	this.get = login => {
		let query
		if (emailUsername) {
			query = 'emailUsername'
		} else {
			query = EMAIL_REGEXP.test(login) ? 'email' : 'username'
		}
		return userDB.query(`auth/${query}`, { key: login, include_docs: true }).then(results => {
			if (results.rows.length > 0) {
				return Promise.resolve(results.rows[0].doc)
			}
			return Promise.resolve(null)
		})
	}

	this.create = (form, req) => {
		req = req || {}
		let finalUserModel = userModel
		const newUserModel = config.getItem('userModel')
		if (typeof newUserModel === 'object') {
			let whitelist
			if (newUserModel.whitelist) {
				whitelist = util.arrayUnion(userModel.whitelist, newUserModel.whitelist)
			}
			finalUserModel = extend(true, {}, userModel, config.getItem('userModel'))
			finalUserModel.whitelist = whitelist || finalUserModel.whitelist
		}
		const UserModel = new Model(finalUserModel)
		const u = new UserModel(form)
		let newUser
		return u
			.process()
			.then(
				result => {
					newUser = result
					if (emailUsername) {
						newUser._id = newUser.email
					}
					if (config.getItem('local.sendConfirmEmail')) {
						newUser.unverifiedEmail = {
							email: newUser.email,
							token: util.URLSafeUUID()
						}
						delete newUser.email
					}
					return util.hashPassword(newUser.password)
				},
				err =>
					Promise.reject({
						error: 'Validation failed',
						validationErrors: err,
						status: 400
					})
			)
			.then(hash => {
				// Store password hash
				newUser.local = {}
				newUser.local.salt = hash.salt
				newUser.local.derived_key = hash.derived_key
				delete newUser.password
				delete newUser.confirmPassword
				newUser.signUp = {
					provider: 'local',
					timestamp: new Date().toISOString(),
					ip: req.ip
				}
				return addUserDBs(newUser)
			})
			.then(nU => self.logActivity(nU._id, 'signup', 'local', req, nU))
			.then(nU => processTransformations(onCreateActions, nU, 'local'))
			.then(finalNewUser =>
				userDB.upsert(finalNewUser._id, oldUser => merge({}, oldUser, finalNewUser))
			)
			.then(result => {
				newUser._rev = result.rev
				if (!config.getItem('local.sendConfirmEmail')) {
					return Promise.resolve()
				}
				return mailer.sendEmail('confirmEmail', newUser.unverifiedEmail.email, {
					req,
					user: newUser
				})
			})
			.then(() => {
				emitter.emit('signup', newUser, 'local')
				return Promise.resolve(newUser)
			})
	}

	this.socialAuth = async (provider, auth, profile, req) => {
		let userDoc
		let newAccount = false
		let action
		let baseUsername
		let finalUsername
		req = req || {}
		const { ip } = req

		try {
			console.log('getting results for provider', provider)
			const results = await userDB.query(`auth/${provider}`, {
				key: profile.id,
				include_docs: true
			})
			console.log('results', results)

			if (results.rows.length > 0) {
				userDoc = results.rows[0].doc
			} else {
				newAccount = true
				userDoc = {}
				userDoc[provider] = {}
				if (profile.emails) {
					userDoc.email = profile.emails[0].value
				}
				userDoc.providers = [provider]
				userDoc.type = 'user'
				userDoc.roles = config.getItem('security.defaultRoles')
				userDoc.signUp = {
					provider,
					timestamp: new Date().toISOString(),
					ip
				}
				const emailFail = async () =>
					Promise.reject({
						error: 'Email already in use',
						message:
							'Your email is already in use. Try signing in first and then linking this account.',
						status: 409
					})
				// Now we need to generate a username
				if (emailUsername) {
					if (!userDoc.email) {
						return Promise.reject({
							error: 'No email provided',
							message: `An email is required for registration, but ${provider} didn't supply one.`,
							status: 400
						})
					}
					const err = await self.validateEmailUsername(userDoc.email)
					if (err) {
						return emailFail()
					}
					finalUsername = userDoc.email.toLowerCase()
				} else {
					if (profile.username) {
						baseUsername = profile.username.toLowerCase()
						// If a username isn't specified we'll take it from the email
					} else if (userDoc.email) {
						const parseEmail = userDoc.email.split('@')
						baseUsername = parseEmail[0].toLowerCase()
					} else if (profile.displayName) {
						baseUsername = profile.displayName.replace(/\s/g, '').toLowerCase()
					} else {
						baseUsername = profile.id.toLowerCase()
					}

					const err = await self.validateEmail(userDoc.email)
					if (err) {
						return emailFail()
					}
					finalUsername = generateUsername(baseUsername)
				}
			}
			if (finalUsername) {
				userDoc._id = finalUsername
			}
			userDoc[provider].auth = auth
			userDoc[provider].profile = profile
			if (!userDoc.name) {
				userDoc.name = profile.displayName
			}
			delete userDoc[provider].profile._raw
			if (newAccount) {
				await addUserDBs(userDoc)
			}
			action = newAccount ? 'signup' : 'login'
			await self.logActivity(userDoc._id, action, provider, req, userDoc)
			const finalUser = await processTransformations(
				newAccount ? onCreateActions : onLinkActions,
				userDoc,
				provider
			)
			await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
			if (action === 'signup') {
				emitter.emit('signup', finalUser, provider)
			}
			return Promise.resolve(finalUser)
		} catch (error) {
			console.log('social auth failed!', error)
			return Promise.reject(error)
		}
	}

	this.linkSocial = (user_id, provider, auth, profile, req) => {
		req = req || {}
		let linkUser
		// Load user doc
		return Promise.resolve()
			.then(() => userDB.query(`auth/${provider}`, { key: profile.id }))
			.then(results => {
				if (results.rows.length === 0) {
					return Promise.resolve()
				}
				if (results.rows[0].id !== user_id) {
					return Promise.reject({
						error: 'Conflict',
						message: `This ${provider} profile is already in use by another account.`,
						status: 409
					})
				}
				return Promise.resolve()
			})
			.then(() => userDB.get(user_id))
			.then(theUser => {
				linkUser = theUser
				// Check for conflicting provider
				if (linkUser[provider] && linkUser[provider].profile.id !== profile.id) {
					return Promise.reject({
						error: 'Conflict',
						message: `Your account is already linked with another ${provider}profile.`,
						status: 409
					})
				}
				// Check email for conflict
				if (!profile.emails) {
					return Promise.resolve({ rows: [] })
				}
				if (emailUsername) {
					return userDB.query('auth/emailUsername', {
						key: profile.emails[0].value
					})
				}
				return userDB.query('auth/email', { key: profile.emails[0].value })
			})
			.then(results => {
				let passed
				if (results.rows.length === 0) {
					passed = true
				} else {
					passed = true
					results.rows.forEach(row => {
						if (row.id !== user_id) {
							passed = false
						}
					})
				}
				if (!passed) {
					return Promise.reject({
						error: 'Conflict',
						message: `The email ${profile.emails[0].value} is already in use by another account.`,
						status: 409
					})
				}
				return Promise.resolve()
			})
			.then(() => {
				// Insert provider info
				linkUser[provider] = {}
				linkUser[provider].auth = auth
				linkUser[provider].profile = profile
				if (!linkUser.providers) {
					linkUser.providers = []
				}
				if (linkUser.providers.indexOf(provider) === -1) {
					linkUser.providers.push(provider)
				}
				if (!linkUser.name) {
					linkUser.name = profile.displayName
				}
				delete linkUser[provider].profile._raw
				return self.logActivity(linkUser._id, 'link', provider, req, linkUser)
			})
			.then(userDoc => processTransformations(onLinkActions, userDoc, provider))
			.then(finalUser => userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser)))
			.then(() => Promise.resolve(linkUser))
	}

	this.unlink = (user_id, provider) => {
		let unLinkUser
		return userDB
			.get(user_id)
			.then(theUser => {
				unLinkUser = theUser
				if (!provider) {
					return Promise.reject({
						error: 'Unlink failed',
						message: 'You must specify a provider to unlink.',
						status: 400
					})
				}
				// We can only unlink if there are at least two providers
				if (
					!unLinkUser.providers ||
					!(unLinkUser.providers instanceof Array) ||
					unLinkUser.providers.length < 2
				) {
					return Promise.reject({
						error: 'Unlink failed',
						message: "You can't unlink your only provider!",
						status: 400
					})
				}
				// We cannot unlink local
				if (provider === 'local') {
					return Promise.reject({
						error: 'Unlink failed',
						message: "You can't unlink local.",
						status: 400
					})
				}
				// Check that the provider exists
				if (!unLinkUser[provider] || typeof unLinkUser[provider] !== 'object') {
					return Promise.reject({
						error: 'Unlink failed',
						message: `Provider: ${util.capitalizeFirstLetter(provider)} not found.`,
						status: 404
					})
				}
				return userDB.upsert(unLinkUser._id, oldUser => {
					const { [provider]: deleted, ...newUser } = oldUser
					if (newUser.providers) {
						// Remove the unlinked provider from the list of providers
						newUser.providers.splice(unLinkUser.providers.indexOf(provider), 1)
					}
					return newUser
				})
			})
			.then(() => Promise.resolve(unLinkUser))
	}

	this.createSession = (user_id, provider, req) => {
		let createSessionUser
		let newToken
		let newSession
		let password
		req = req || {}
		const { ip } = req
		return userDB
			.get(user_id)
			.then(record => {
				createSessionUser = record
				return generateSession(createSessionUser._id, createSessionUser.roles)
			})
			.then(token => {
				// eslint-disable-next-line prefer-destructuring
				password = token.password
				newToken = token
				newToken.provider = provider
				return session.storeToken(newToken)
			})
			.then(() =>
				dbAuth.storeKey(user_id, newToken.key, password, newToken.expires, createSessionUser.roles)
			)
			.then(() => {
				// authorize the new session across all dbs
				if (!createSessionUser.personalDBs) {
					return Promise.resolve()
				}
				return dbAuth.authorizeUserSessions(
					user_id,
					createSessionUser.personalDBs,
					newToken.key,
					createSessionUser.roles
				)
			})
			.then(() => {
				if (!createSessionUser.session) {
					createSessionUser.session = {}
				}
				newSession = {
					issued: newToken.issued,
					expires: newToken.expires,
					provider,
					ip
				}
				createSessionUser.session[newToken.key] = newSession
				// Clear any failed login attempts
				if (provider === 'local') {
					if (!createSessionUser.local) createSessionUser.local = {}
					createSessionUser.local.failedLoginAttempts = 0
					delete createSessionUser.local.lockedUntil
				}
				return self.logActivity(createSessionUser._id, 'login', provider, req, createSessionUser)
			})
			.then(userDoc =>
				// Clean out expired sessions on login
				self.logoutUserSessions(userDoc, 'expired')
			)
			.then(finalUser => {
				createSessionUser = finalUser
				return userDB.upsert(finalUser._id, oldDoc => {
					if (oldDoc.local) {
						delete oldDoc.local.lockedUntil
					}

					return merge({}, oldDoc, finalUser)
				})
			})
			.then(() => {
				newSession.token = newToken.key
				newSession.password = password
				newSession.user_id = createSessionUser._id
				newSession.roles = createSessionUser.roles
				// Inject the list of userDBs
				if (typeof createSessionUser.personalDBs === 'object') {
					const userDBs = {}
					let publicURL
					if (config.getItem('dbServer.publicURL')) {
						const dbObj = url.parse(config.getItem('dbServer.publicURL'))
						dbObj.auth = `${newSession.token}:${newSession.password}`
						publicURL = dbObj.format()
					} else {
						publicURL = `${config.getItem('dbServer.protocol') + newSession.token}:${
							newSession.password
						}@${config.getItem('dbServer.host')}/`
					}
					Object.keys(createSessionUser.personalDBs).forEach(finalDBName => {
						userDBs[createSessionUser.personalDBs[finalDBName].name] = publicURL + finalDBName
					})
					newSession.userDBs = userDBs
				}
				if (createSessionUser.profile) {
					newSession.profile = createSessionUser.profile
				}
				emitter.emit('login', newSession, provider)
				return Promise.resolve(newSession, provider)
			})
	}

	this.handleFailedLogin = (loginUser, req) => {
		req = req || {}
		const maxFailedLogins = config.getItem('security.maxFailedLogins')
		if (!maxFailedLogins) {
			return Promise.resolve()
		}
		if (!loginUser.local) {
			loginUser.local = {}
		}
		if (!loginUser.local.failedLoginAttempts) {
			loginUser.local.failedLoginAttempts = 0
		}
		loginUser.local.failedLoginAttempts += 1
		if (loginUser.local.failedLoginAttempts > maxFailedLogins) {
			loginUser.local.failedLoginAttempts = 0
			loginUser.local.lockedUntil = Date.now() + config.getItem('security.lockoutTime') * 1000
		}
		return self
			.logActivity(loginUser._id, 'failed login', 'local', req, loginUser)
			.then(finalUser => userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser)))
			.then(() => Promise.resolve(!!loginUser.local.lockedUntil))
	}

	this.logActivity = async (user_id, action, provider, req, userDoc, saveDoc) => {
		const logSize = config.getItem('security.userActivityLogSize')
		if (!logSize) {
			return Promise.resolve(userDoc)
		}
		let theUser = userDoc
		if (!theUser) {
			if (saveDoc !== false) {
				saveDoc = true
			}
			theUser = await userDB.get(user_id)
		}
		userDoc = theUser
		if (!userDoc.activity || !(userDoc.activity instanceof Array)) {
			userDoc.activity = []
		}
		const entry = {
			timestamp: new Date().toISOString(),
			action,
			provider,
			ip: req.ip
		}
		userDoc.activity.unshift(entry)
		while (userDoc.activity.length > logSize) {
			userDoc.activity.pop()
		}
		if (saveDoc) {
			await userDB.upsert(userDoc._id, oldUser => merge({}, oldUser, userDoc))
		}
		return Promise.resolve(userDoc)
	}

	this.refreshSession = key => {
		let newSession
		return session
			.fetchToken(key)
			.then(oldToken => {
				newSession = oldToken
				newSession.expires = Date.now() + sessionLife * 1000
				return Promise.all([userDB.get(newSession._id), session.storeToken(newSession)])
			})
			.then(results => {
				const userDoc = results[0]
				userDoc.session[key].expires = newSession.expires
				// Clean out expired sessions on refresh
				return self.logoutUserSessions(userDoc, 'expired')
			})
			.then(finalUser => userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser)))
			.then(() => {
				delete newSession.password
				newSession.token = newSession.key
				delete newSession.key
				newSession.user_id = newSession._id
				delete newSession._id
				delete newSession.salt
				delete newSession.derived_key
				emitter.emit('refresh', newSession)
				return Promise.resolve(newSession)
			})
	}

	this.resetPassword = (form, req) => {
		req = req || {}
		const ResetPasswordModel = new Model(resetPasswordModel)
		const passwordResetForm = new ResetPasswordModel(form)
		let resetUser
		return passwordResetForm
			.validate()
			.then(
				() => {
					const tokenHash = util.hashToken(form.token)
					return userDB.query('auth/passwordReset', {
						key: tokenHash,
						include_docs: true
					})
				},
				err =>
					Promise.reject({
						error: 'Validation failed',
						validationErrors: err,
						status: 400
					})
			)
			.then(results => {
				if (!results.rows.length) {
					return Promise.reject({ status: 400, error: 'Invalid token' })
				}
				resetUser = results.rows[0].doc
				if (resetUser.forgotPassword.expires < Date.now()) {
					return Promise.reject({ status: 400, error: 'Token expired' })
				}
				return util.hashPassword(form.password)
			})
			.then(hash => {
				if (!resetUser.local) {
					resetUser.local = {}
				}
				resetUser.local.salt = hash.salt
				resetUser.local.derived_key = hash.derived_key
				if (resetUser.providers.indexOf('local') === -1) {
					resetUser.providers.push('local')
				}
				// logout user completely
				return self.logoutUserSessions(resetUser, 'all')
			})
			.then(userDoc => {
				resetUser = userDoc
				delete resetUser.forgotPassword
				return self.logActivity(resetUser._id, 'reset password', 'local', req, resetUser)
			})
			.then(finalUser =>
				userDB.upsert(finalUser._id, oldUser => {
					delete oldUser.forgotPassword
					return merge({}, oldUser, finalUser)
				})
			)
			.then(() => {
				emitter.emit('password-reset', resetUser)
				return Promise.resolve(resetUser)
			})
	}

	this.changePasswordSecure = (user_id, form, req) => {
		req = req || {}
		const ChangePasswordModel = new Model(changePasswordModel)
		const changePasswordForm = new ChangePasswordModel(form)
		let changePwUser
		return changePasswordForm
			.validate()
			.then(
				() => userDB.get(user_id),
				err =>
					Promise.reject({
						error: 'Validation failed',
						validationErrors: err,
						status: 400
					})
			)
			.then(() => userDB.get(user_id))
			.then(userDoc => {
				changePwUser = userDoc
				if (changePwUser.local && changePwUser.local.salt && changePwUser.local.derived_key) {
					// Password is required
					if (!form.currentPassword) {
						return Promise.reject({
							error: 'Password change failed',
							message: 'You must supply your current password in order to change it.',
							status: 400
						})
					}
					return util.verifyPassword(changePwUser.local, form.currentPassword)
				}
				return Promise.resolve()
			})
			.then(
				() => this.changePassword(changePwUser._id, form.newPassword, changePwUser, req),
				err =>
					Promise.reject(
						err || {
							error: 'Password change failed',
							message: 'The current password you supplied is incorrect.',
							status: 400
						}
					)
			)
			.then(() => {
				if (req.user && req.user.key) {
					return self.logoutOthers(req.user.key)
				}
				return Promise.resolve()
			})
	}

	this.changePassword = (user_id, newPassword, userDoc, req) => {
		req = req || {}
		let promise
		let changePwUser
		if (userDoc) {
			promise = Promise.resolve(userDoc)
		} else {
			promise = userDB.get(user_id)
		}
		return promise
			.then(
				doc => {
					changePwUser = doc
					return util.hashPassword(newPassword)
				},
				() =>
					Promise.reject({
						error: 'User not found',
						status: 404
					})
			)
			.then(hash => {
				if (!changePwUser.local) {
					changePwUser.local = {}
				}
				changePwUser.local.salt = hash.salt
				changePwUser.local.derived_key = hash.derived_key
				if (changePwUser.providers.indexOf('local') === -1) {
					changePwUser.providers.push('local')
				}
				return self.logActivity(changePwUser._id, 'changed password', 'local', req, changePwUser)
			})
			.then(finalUser => userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser)))
			.then(() => {
				emitter.emit('password-change', changePwUser)
			})
	}

	this.forgotPassword = (email, req) => {
		req = req || {}
		let forgotPwUser
		let token
		let tokenHash
		return userDB
			.query('auth/email', { key: email, include_docs: true })
			.then(result => {
				if (!result.rows.length) {
					return Promise.reject({
						error: 'User not found',
						status: 404
					})
				}
				forgotPwUser = result.rows[0].doc
				token = util.URLSafeUUID()
				tokenHash = util.hashToken(token)
				forgotPwUser.forgotPassword = {
					token: tokenHash, // Store secure hashed token
					issued: Date.now(),
					expires: Date.now() + tokenLife * 1000
				}
				return self.logActivity(forgotPwUser._id, 'forgot password', 'local', req, forgotPwUser)
			})
			.then(finalUser => userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser)))
			.then(
				() =>
					mailer.sendEmail(
						'forgotPassword',
						forgotPwUser.email || forgotPwUser.unverifiedEmail.email,
						{
							forgotPwUser,
							req,
							token
						}
					) // Send user the unhashed token
			)
			.then(() => {
				emitter.emit('forgot-password', forgotPwUser)
				return Promise.resolve(forgotPwUser.forgotPassword)
			})
	}

	this.verifyEmail = (token, req) => {
		req = req || {}
		let verifyEmailUser
		return userDB
			.query('auth/verifyEmail', { key: token, include_docs: true })
			.then(result => {
				if (!result.rows.length) {
					return Promise.reject({ error: 'Invalid token', status: 400 })
				}
				verifyEmailUser = result.rows[0].doc
				verifyEmailUser.email = verifyEmailUser.unverifiedEmail.email
				delete verifyEmailUser.unverifiedEmail
				emitter.emit('email-verified', verifyEmailUser)
				return self.logActivity(
					verifyEmailUser._id,
					'verified email',
					'local',
					req,
					verifyEmailUser
				)
			})
			.then(finalUser =>
				userDB.upsert(finalUser._id, oldUser => {
					delete oldUser.unverifiedEmail
					return merge({}, oldUser, finalUser)
				})
			)
	}

	this.changeEmail = (user_id, newEmail, req) => {
		req = req || {}
		if (!req.user) {
			req.user = { provider: 'local' }
		}
		let changeEmailUser
		return self
			.validateEmail(newEmail)
			.then(err => {
				if (err) {
					return Promise.reject(err)
				}
				return userDB.get(user_id)
			})
			.then(userDoc => {
				changeEmailUser = userDoc
				if (config.getItem('local.sendConfirmEmail')) {
					changeEmailUser.unverifiedEmail = {
						email: newEmail,
						token: util.URLSafeUUID()
					}
					return mailer.sendEmail('confirmEmail', changeEmailUser.unverifiedEmail.email, {
						req,
						changeEmailUser
					})
				}
				changeEmailUser.email = newEmail
				return Promise.resolve()
			})
			.then(() => {
				emitter.emit('email-changed', changeEmailUser)
				return self.logActivity(
					changeEmailUser._id,
					'changed email',
					req.user.provider,
					req,
					changeEmailUser
				)
			})
			.then(finalUser => userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser)))
	}

	this.addUserDB = (user_id, dbName, type, designDocs, permissions) => {
		let userDoc
		const dbConfig = dbAuth.getDBConfig(dbName, type || 'private')
		dbConfig.designDocs = designDocs || dbConfig.designDocs || ''
		dbConfig.permissions = permissions || dbConfig.permissions
		return userDB
			.get(user_id)
			.then(result => {
				userDoc = result
				return dbAuth.addUserDB(
					userDoc,
					dbName,
					dbConfig.designDocs,
					dbConfig.type,
					dbConfig.permissions,
					dbConfig.adminRoles,
					dbConfig.memberRoles
				)
			})
			.then(finalDBName => {
				if (!userDoc.personalDBs) {
					userDoc.personalDBs = {}
				}
				delete dbConfig.designDocs
				// If permissions is specified explicitly it will be saved, otherwise will be taken from defaults every session
				if (!permissions) {
					delete dbConfig.permissions
				}
				delete dbConfig.adminRoles
				delete dbConfig.memberRoles
				userDoc.personalDBs[finalDBName] = dbConfig
				emitter.emit('user-db-added', user_id, dbName)
				return userDB.upsert(userDoc._id, oldUser => merge({}, oldUser, userDoc))
			})
	}

	this.removeUserDB = (user_id, dbName, deletePrivate, deleteShared) => {
		let removeUser
		let update = false
		let dbID
		return userDB
			.get(user_id)
			.then(userDoc => {
				removeUser = userDoc
				if (removeUser.personalDBs && typeof removeUser.personalDBs === 'object') {
					return new Promise(async res =>
						Object.keys(removeUser.personalDBs).forEach(async db => {
							if (removeUser.personalDBs[db].name === dbName) {
								dbID = db
								const { type } = removeUser.personalDBs[db]
								delete removeUser.personalDBs[db]
								update = true
								try {
									if (type === 'private' && deletePrivate) {
										await dbAuth.removeDB(db)
										return res()
									}
									if (type === 'shared' && deleteShared) {
										await dbAuth.removeDB(db)
										return res()
									}
								} catch (error) {
									console.log('error removing user db!', db, dbName, error)
								}
							}
							return res()
						})
					)
				}
				return Promise.resolve()
			})
			.then(() => {
				if (update) {
					emitter.emit('user-db-removed', user_id, dbName)
					return userDB.upsert(removeUser._id, oldUser => {
						if (oldUser.personalDBs[dbID]) {
							delete oldUser.personalDBs[dbID]
						}
						merge({}, oldUser, removeUser)
					})
				}
				return Promise.resolve()
			})
	}

	this.logoutUser = (user_id, session_id) => {
		let promise
		let logoutUser
		if (user_id) {
			promise = userDB.get(user_id)
		} else {
			if (!session_id) {
				return Promise.reject({
					error: 'unauthorized',
					message: 'Either user_id or session_id must be specified',
					status: 401
				})
			}
			promise = userDB
				.query('auth/session', { key: session_id, include_docs: true })
				.then(results => {
					if (!results.rows.length) {
						return Promise.reject({
							error: 'unauthorized',
							status: 401
						})
					}
					return Promise.resolve(results.rows[0].doc)
				})
		}
		return promise
			.then(record => {
				logoutUser = record
				user_id = record._id
				return self.logoutUserSessions(logoutUser, 'all')
			})
			.then(() => {
				emitter.emit('logout', user_id)
				emitter.emit('logout-all', user_id)
				return userDB.upsert(logoutUser._id, oldUser => merge({}, oldUser, logoutUser))
			})
	}

	this.logoutSession = session_id => {
		let logoutUser
		let startSessions = 0
		let endSessions = 0
		return userDB
			.query('auth/session', { key: session_id, include_docs: true })
			.then(results => {
				if (!results.rows.length) {
					return Promise.reject({
						error: 'unauthorized',
						status: 401
					})
				}
				logoutUser = results.rows[0].doc
				if (logoutUser.session) {
					startSessions = Object.keys(logoutUser.session).length
					if (logoutUser.session[session_id]) {
						delete logoutUser.session[session_id]
					}
				}
				const promises = []
				promises.push(session.deleteTokens(session_id))
				promises.push(dbAuth.removeKeys(session_id))
				if (logoutUser) {
					promises.push(dbAuth.deauthorizeUser(logoutUser, session_id))
				}
				return Promise.all(promises)
			})
			.then(() =>
				// Clean out expired sessions
				self.logoutUserSessions(logoutUser, 'expired')
			)
			.then(finalUser => {
				logoutUser = finalUser
				if (logoutUser.session) {
					endSessions = Object.keys(logoutUser.session).length
				}
				emitter.emit('logout', logoutUser._id)
				if (startSessions !== endSessions) {
					return userDB.upsert(logoutUser._id, oldUser => {
						if (oldUser.session) {
							delete oldUser.session[session_id]
						}
						return merge({}, oldUser, logoutUser)
					})
				}
				return Promise.resolve(false)
			})
	}

	this.logoutOthers = session_id => {
		let logoutUser
		return userDB
			.query('auth/session', { key: session_id, include_docs: true })
			.then(results => {
				if (results.rows.length) {
					logoutUser = results.rows[0].doc
					if (logoutUser.session && logoutUser.session[session_id]) {
						return self.logoutUserSessions(logoutUser, 'other', session_id)
					}
				}
				return Promise.resolve()
			})
			.then(finalUser => {
				if (finalUser) {
					return userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
				}
				return Promise.resolve(false)
			})
	}

	this.logoutUserSessions = async (userDoc, op, currentSession) => {
		try {
			// When op is 'other' it will logout all sessions except for the specified 'currentSession'
			let sessions
			if (op === 'all' || op === 'other') {
				sessions = util.getSessions(userDoc)
			} else if (op === 'expired') {
				sessions = util.getExpiredSessions(userDoc, Date.now())
			}
			if (op === 'other' && currentSession) {
				// Remove the current session from the list of sessions we are going to delete
				const index = sessions.indexOf(currentSession)
				if (index > -1) {
					sessions.splice(index, 1)
				}
			}
			if (sessions.length) {
				// Delete the sessions from our session store
				await session.deleteTokens(sessions)
				// Remove the keys from our couchDB auth database
				await dbAuth.removeKeys(sessions)
				// Deauthorize keys from each personal database
				await dbAuth.deauthorizeUser(userDoc, sessions)
				if (op === 'expired' || op === 'other') {
					sessions.forEach(s => delete userDoc.session[s])
				}
			}
			if (op === 'all') {
				delete userDoc.session
			}
			return Promise.resolve(userDoc)
		} catch (error) {
			console.log('error logging out user sessions!', error)
			return Promise.resolve(userDoc)
		}
	}

	this.remove = async (user_id, destroyDBs) => {
		let removeUser
		const promises = []
		try {
			const userDoc = await userDB.get(user_id)
			await self.logoutUserSessions(userDoc, 'all')
			removeUser = userDoc
			if (destroyDBs !== true || !removeUser.personalDBs) {
				return Promise.resolve()
			}
			Object.keys(removeUser.personalDBs).forEach(userdb => {
				if (removeUser.personalDBs[userdb].type === 'private') {
					promises.push(dbAuth.removeDB(userdb))
				}
			})
			await Promise.all(promises)
			return userDB.remove(removeUser)
		} catch (error) {
			console.log('error removing user!', error)
			return Promise.resolve()
		}
	}

	this.removeExpiredKeys = dbAuth.removeExpiredKeys.bind(dbAuth)

	this.confirmSession = (key, password) => session.confirmToken(key, password)

	this.quitRedis = session.quit

	return this
}
