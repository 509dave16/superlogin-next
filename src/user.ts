import DBAuth from 'dbAuth'
import { EventEmitter } from 'events'
import merge from 'lodash.merge'
import Model from 'sofa-model'
import url from 'url'
import cloudant from './dbauth/cloudant'
import Session from './session'
import util from './util'

// regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/inupsert.js#L4
const EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/
const USER_REGEXP = /^[a-z0-9_-]{3,16}$/

const user = (
	config: IConfigure,
	userDB: PouchDB.Database & { name: string },
	couchAuthDB: PouchDB.Database,
	mailer: IMailer,
	emitter: EventEmitter
) => {
	const dbAuth = DBAuth(config, userDB, couchAuthDB)
	const session = Session(config)
	const onCreateActions: ((userDoc: IUserDoc, provider: string) => Promise<IUserDoc>)[] = []
	const onLinkActions: ((userDoc: IUserDoc, provider: string) => Promise<IUserDoc>)[] = []

	// Token valid for 24 hours by default
	// Forget password token life
	const tokenLife = config.getItem('security.tokenLife') || 86400
	// Session token life
	const sessionLife = config.getItem('security.sessionLife') || 86400

	const emailUsername = config.getItem('local.emailUsername')

	const logActivity = async (
		user_id: string,
		action: string,
		provider: string,
		req: { ip: string },
		userDoc: IUserDoc,
		saveDoc?: boolean
	) => {
		const logSize = config.getItem('security.userActivityLogSize')
		if (!logSize) {
			return Promise.resolve(userDoc)
		}
		let theUser = userDoc
		if (!theUser) {
			if (saveDoc !== false) {
				saveDoc = true
			}
			theUser = await userDB.get<IUserDoc>(user_id)
		}
		userDoc = theUser
		if (!userDoc.activity || !Array.isArray(userDoc.activity)) {
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

	const logoutUserSessions = async (userDoc: IUserDoc, op: string, currentSession?: string) => {
		try {
			// When op is 'other' it will logout all sessions except for the specified 'currentSession'
			let sessions: string[] = []
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
				dbAuth.removeKeys(sessions)
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

	const changePassword = async (
		user_id: string,
		newPassword: string,
		userDoc: IUserDoc,
		req: { ip: string }
	) => {
		req = req || {}
		let changePwUser: IUserDoc
		let doc = userDoc
		try {
			if (!userDoc) {
				doc = await userDB.get<IUserDoc>(user_id)
			}
		} catch (error) {
			return Promise.reject({
				error: 'User not found',
				status: 404
			})
		}
		changePwUser = doc
		const hash = await util.hashPassword(newPassword)

		if (!changePwUser.local) {
			changePwUser.local = {}
		}
		changePwUser.local.salt = hash.salt
		changePwUser.local.derived_key = hash.derived_key
		if (changePwUser.providers.indexOf('local') === -1) {
			changePwUser.providers.push('local')
		}
		const finalUser = await logActivity(
			changePwUser._id,
			'changed password',
			'local',
			req,
			changePwUser
		)
		await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
		return emitter.emit('password-change', changePwUser)
	}

	const logoutOthers = async (session_id: string) => {
		let logoutUserDoc: IUserDoc
		let finalUser: IUserDoc | undefined
		const results = await userDB.query<IUserDoc>('auth/session', {
			key: session_id,
			include_docs: true
		})

		if (results.rows.length) {
			logoutUserDoc = results.rows[0].doc as IUserDoc
			if (logoutUserDoc.session && logoutUserDoc.session[session_id]) {
				finalUser = await logoutUserSessions(logoutUserDoc, 'other', session_id)
			}
		}

		if (finalUser) {
			return userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
		}
		return Promise.resolve(false)
	}

	const addUserDBs = async (newUser: IUserDoc) => {
		// Add personal DBs
		if (!config.getItem('userDBs.defaultDBs')) {
			return Promise.resolve(newUser)
		}
		newUser.personalDBs = {}

		const processUserDBs = async (dbList: string[], type: string) =>
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

	const generateSession = async (username: string, roles: string[]) => {
		try {
			let key: { key: string; password: string }
			if (config.getItem('dbServer.cloudant')) {
				key = (await cloudant.getAPIKey(userDB)) as { key: string; password: string }
			} else {
				let token = util.URLSafeUUID()
				// Make sure our token doesn't start with illegal characters
				while (token[0] === '_' || token[0] === '-') {
					token = util.URLSafeUUID()
				}
				key = {
					key: token,
					password: util.URLSafeUUID()
				}
			}

			const now = Date.now()
			return Promise.resolve({
				_id: username,
				key: key.key,
				password: key.password,
				issued: now,
				expires: now + sessionLife * 1000,
				roles
			})
		} catch (error) {
			console.log('error generating session!', error)
			return Promise.reject(error)
		}
	}

	// ------> FIXME <------
	// Adds numbers to a base name until it finds a unique database key
	const generateUsername = async (base: string) => {
		base = base.toLowerCase()
		const entries: string[] = []
		let finalName = ''
		const results = await userDB.allDocs({
			startkey: base,
			endkey: `${base}\uffff`,
			include_docs: false
		})

		if (results.rows.length === 0) {
			return Promise.resolve(base)
		}
		results.rows.forEach(({ id }) => entries.push(id))
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
		return finalName
	}

	const validateUsername = async (username: string) => {
		if (!username) {
			return Promise.resolve()
		}
		if (!username.match(USER_REGEXP)) {
			return Promise.resolve('Invalid username')
		}
		try {
			const result = await userDB.query('auth/username', { key: username })
			if (result.rows.length === 0) {
				// Pass!
				return Promise.resolve()
			}
			return Promise.resolve()
		} catch (error) {
			throw new Error(error)
		}
	}

	const validateEmail = async (email: string) => {
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

	const validateEmailUsername = async (email: string) => {
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
	const matches = (value: string, option: string, key: string, attributes: {}) => {
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

	passwordConstraints = Object.assign(
		{},
		passwordConstraints,
		config.getItem('local.passwordConstraints')
	)

	const userModel = {
		async: true,
		whitelist: ['name', 'username', 'email', 'password', 'confirmPassword'],
		customValidators: {
			validateEmail,
			validateUsername,
			validateEmailUsername,
			matches
		},
		sanitize: {
			name: ['trim'],
			username: ['trim', 'toLowerCase'],
			email: ['trim', 'toLowerCase']
		},
		validate: {
			email: {
				presence: true,
				validateEmail: true,
				validateEmailUsername: false
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
			matches
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
			matches
		},
		validate: {
			newPassword: passwordConstraints,
			confirmPassword: {
				presence: true
			}
		}
	}

	const onCreate = (fn: () => Promise<IUserDoc>) => {
		if (typeof fn === 'function') {
			onCreateActions.push(fn)
		} else {
			throw new TypeError('onCreate: You must pass in a function')
		}
	}

	const onLink = (fn: () => Promise<IUserDoc>) => {
		if (typeof fn === 'function') {
			onLinkActions.push(fn)
		} else {
			throw new TypeError('onLink: You must pass in a function')
		}
	}

	const processTransformations = async (
		fnArray: ((userDoc: IUserDoc, provider: string) => Promise<IUserDoc>)[],
		userDoc: IUserDoc,
		provider: string
	) => {
		let finalDoc = userDoc
		await Promise.all(fnArray.map(async fn => (finalDoc = await fn(finalDoc, provider))))
		return finalDoc
	}

	const get = async (login: string) => {
		let query
		if (emailUsername) {
			query = 'emailUsername'
		} else {
			query = EMAIL_REGEXP.test(login) ? 'email' : 'username'
		}
		const results = await userDB.query(`auth/${query}`, { key: login, include_docs: true })
		if (results.rows.length > 0) {
			return results.rows[0].doc
		}
		return null
	}

	const create = async (form: {}, req: { ip: string }) => {
		req = req || {}
		let finalUserModel = userModel
		const newUserModel = config.getItem('userModel')
		if (typeof newUserModel === 'object') {
			let whitelist: string[] = []
			if (newUserModel.whitelist) {
				whitelist = util.arrayUnion(userModel.whitelist, newUserModel.whitelist)
			}
			finalUserModel = Object.assign({}, userModel, config.getItem('userModel'))
			finalUserModel.whitelist = whitelist || finalUserModel.whitelist
		}
		const UserModel = new Model(finalUserModel)
		const u = new UserModel(form)
		let newUser: IUserDoc
		return u
			.process()
			.then(
				async (result: typeof newUser) => {
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
				async (err: string) =>
					Promise.reject({
						error: 'Validation failed',
						validationErrors: err,
						status: 400
					})
			)
			.then(async (hash: { salt: string; derived_key: string }) => {
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
			.then(async (nU: IUserDoc) => logActivity(nU._id, 'signup', 'local', req, nU))
			.then(async (nU: IUserDoc) => processTransformations(onCreateActions, nU, 'local'))
			.then(async (finalNewUser: IUserDoc) =>
				userDB.upsert(finalNewUser._id, oldUser => merge({}, oldUser, finalNewUser))
			)
			.then(async (result: IUserDoc) => {
				newUser._rev = result.rev as string
				if (!config.getItem('local.sendConfirmEmail')) {
					return Promise.resolve()
				}
				return mailer.sendEmail('confirmEmail', newUser.unverifiedEmail.email, {
					req,
					user: newUser
				})
			})
			.then(async () => {
				emitter.emit('signup', newUser, 'local')
				return Promise.resolve(newUser)
			})
	}

	const socialAuth = async (
		provider: string,
		auth: string,
		profile: IProfile,
		req: { ip: string }
	) => {
		let userDoc: IUserDoc
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
				userDoc = results.rows[0].doc as IUserDoc
			} else {
				newAccount = true
				// tslint:disable-next-line:no-object-literal-type-assertion
				userDoc = {} as IUserDoc
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
					const err = await validateEmailUsername(userDoc.email)
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

					const err = await validateEmail(userDoc.email)
					if (err) {
						return emailFail()
					}
					finalUsername = await generateUsername(baseUsername)
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
			await logActivity(userDoc._id, action, provider, req, userDoc)
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

	const linkSocial = async (
		user_id: string,
		provider: string,
		auth: string,
		profile: IProfile,
		req: { ip: string }
	) => {
		req = req || {}
		let linkUser: IUserDoc
		const results = await userDB.query(`auth/${provider}`, { key: profile.id })

		if (results.rows.length > 0 && results.rows[0].id !== user_id) {
			return Promise.reject({
				error: 'Conflict',
				message: `This ${provider} profile is already in use by another account.`,
				status: 409
			})
		}
		const theUser = await userDB.get<IUserDoc>(user_id)

		linkUser = theUser
		// Check for conflicting provider
		if (linkUser[provider] && linkUser[provider].profile.id !== profile.id) {
			return Promise.reject({
				error: 'Conflict',
				message: `Your account is already linked with another ${provider}profile.`,
				status: 409
			})
		}
		let emailConflict: { rows: { id?: string }[] }
		// Check email for conflict
		if (!profile.emails) {
			emailConflict = { rows: [] }
		} else if (emailUsername) {
			emailConflict = await userDB.query('auth/emailUsername', {
				key: profile.emails[0].value
			})
		} else {
			emailConflict = await userDB.query('auth/email', { key: profile.emails[0].value })
		}

		let passed
		if (emailConflict.rows.length === 0) {
			passed = true
		} else {
			passed = true
			emailConflict.rows.forEach(row => {
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
		const userDoc = await logActivity(linkUser._id, 'link', provider, req, linkUser)
		const finalUser = await processTransformations(onLinkActions, userDoc, provider)
		return userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
	}

	const unlink = async (user_id: string, provider: string) => {
		let unLinkUser: IUserDoc
		const theUser = await userDB.get<IUserDoc>(user_id)
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
		return userDB.upsert<IUserDoc>(unLinkUser._id, oldUser => {
			const { [provider]: deleted, ...newUser } = oldUser
			if (newUser.providers) {
				// Remove the unlinked provider from the list of providers
				newUser.providers.splice(unLinkUser.providers.indexOf(provider), 1)
			}
			return newUser
		})
	}

	const createSession = async (user_id: string, provider: string, req: { ip: string }) => {
		let createSessionUser: IUserDoc
		let newToken: ISession
		let newSession: Partial<IUserDoc>
		let password: string
		req = req || {}
		const { ip } = req
		createSessionUser = await userDB.get<IUserDoc>(user_id)
		const token = await generateSession(createSessionUser._id, createSessionUser.roles)
		password = token.password
		newToken = token
		newToken.provider = provider
		await session.storeToken(newToken)
		dbAuth.storeKey(user_id, newToken.key, password, newToken.expires, createSessionUser.roles)

		// authorize the new session across all dbs
		if (!!createSessionUser.personalDBs) {
			await dbAuth.authorizeUserSessions(
				user_id,
				createSessionUser.personalDBs,
				newToken.key,
				createSessionUser.roles
			)
		}

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
			if (!createSessionUser.local) {
				createSessionUser.local = {}
			}
			createSessionUser.local.failedLoginAttempts = 0
			delete createSessionUser.local.lockedUntil
		}
		const userDoc = await logActivity(
			createSessionUser._id,
			'login',
			provider,
			req,
			createSessionUser
		)
		const finalUser = await logoutUserSessions(userDoc, 'expired')
		createSessionUser = finalUser
		await userDB.upsert<IUserDoc>(finalUser._id, oldDoc => {
			if (oldDoc.local) {
				delete oldDoc.local.lockedUntil
			}

			return merge({}, oldDoc, finalUser)
		})

		newSession.token = newToken.key
		newSession.password = password
		newSession.user_id = createSessionUser._id
		newSession.roles = createSessionUser.roles
		// Inject the list of userDBs
		if (typeof createSessionUser.personalDBs === 'object') {
			const userDBs = {}
			let publicURL: string
			if (config.getItem('dbServer.publicURL')) {
				const dbObj = url.parse(config.getItem('dbServer.publicURL'))
				dbObj.auth = `${newSession.token}:${newSession.password}`
				publicURL = dbObj.href as string
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
		return newSession
	}

	const handleFailedLogin = async (loginUser: IUserDoc, req: { ip: string }) => {
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
		const finalUser = await logActivity(loginUser._id, 'failed login', 'local', req, loginUser)
		await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
		return !!loginUser.local.lockedUntil
	}

	const refreshSession = async (key: string) => {
		let newSession: ISession
		const oldToken = await session.fetchToken(key)
		newSession = oldToken
		newSession.expires = Date.now() + sessionLife * 1000
		const results = await Promise.all([
			userDB.get<IUserDoc>(newSession._id),
			session.storeToken(newSession)
		])
		const userDoc: IUserDoc = results[0]
		userDoc.session[key].expires = newSession.expires
		// Clean out expired sessions on refresh
		const finalUser = await logoutUserSessions(userDoc, 'expired')
		await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
		delete newSession.password
		newSession.token = newSession.key
		delete newSession.key
		newSession.user_id = newSession._id
		delete newSession._id
		delete newSession.salt
		delete newSession.derived_key
		emitter.emit('refresh', newSession)
		return newSession
	}

	const resetPassword = (form: { token: string; password: string }, req: { ip: string }) => {
		req = req || {}
		const ResetPasswordModel = new Model(resetPasswordModel)
		const passwordResetForm = new ResetPasswordModel(form)
		let resetUser: IUserDoc
		return passwordResetForm
			.validate()
			.then(
				async () => {
					const tokenHash = util.hashToken(form.token)
					return userDB.query('auth/passwordReset', {
						key: tokenHash,
						include_docs: true
					})
				},
				async (err: string) =>
					Promise.reject({
						error: 'Validation failed',
						validationErrors: err,
						status: 400
					})
			)
			.then(async (results: { rows: { doc: IUserDoc }[] }) => {
				if (!results.rows.length) {
					return Promise.reject({ status: 400, error: 'Invalid token' })
				}
				resetUser = results.rows[0].doc
				if (resetUser.forgotPassword.expires < Date.now()) {
					return Promise.reject({ status: 400, error: 'Token expired' })
				}
				return util.hashPassword(form.password)
			})
			.then(async (hash: ISession) => {
				if (!resetUser.local) {
					resetUser.local = {}
				}
				resetUser.local.salt = hash.salt
				resetUser.local.derived_key = hash.derived_key
				if (resetUser.providers.indexOf('local') === -1) {
					resetUser.providers.push('local')
				}
				// logout user completely
				return logoutUserSessions(resetUser, 'all')
			})
			.then(async (userDoc: IUserDoc) => {
				resetUser = userDoc
				delete resetUser.forgotPassword
				return logActivity(resetUser._id, 'reset password', 'local', req, resetUser)
			})
			.then(async (finalUser: IUserDoc) =>
				userDB.upsert<IUserDoc>(finalUser._id, oldUser => {
					delete oldUser.forgotPassword
					return merge({}, oldUser, finalUser)
				})
			)
			.then(async () => {
				emitter.emit('password-reset', resetUser)
				return Promise.resolve(resetUser)
			})
	}

	const changePasswordSecure = async (
		user_id: string,
		form: { newPassword: string; currentPassword: string },
		req: { ip: string; user: { key: string } }
	) => {
		req = req || {}
		const ChangePasswordModel = new Model(changePasswordModel)
		const changePasswordForm = new ChangePasswordModel(form)
		let changePwUser: IUserDoc
		return changePasswordForm
			.validate()
			.then(
				async () => userDB.get(user_id),
				async (err: string) =>
					Promise.reject({
						error: 'Validation failed',
						validationErrors: err,
						status: 400
					})
			)
			.then(async () => userDB.get(user_id))
			.then(async (userDoc: IUserDoc) => {
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
				async () => changePassword(changePwUser._id, form.newPassword, changePwUser, req),
				async (err: string) =>
					Promise.reject(
						err || {
							error: 'Password change failed',
							message: 'The current password you supplied is incorrect.',
							status: 400
						}
					)
			)
			.then(async () => {
				if (req.user && req.user.key) {
					return logoutOthers(req.user.key)
				}
				return Promise.resolve()
			})
	}

	const forgotPassword = async (email: string, req: { ip: string }) => {
		req = req || {}
		let forgotPwUser: IUserDoc
		let token: string
		let tokenHash: string
		const result = await userDB.query<IUserDoc>('auth/email', { key: email, include_docs: true })

		if (!result.rows.length) {
			return Promise.reject({
				error: 'User not found',
				status: 404
			})
		}
		forgotPwUser = result.rows[0].doc as IUserDoc
		token = util.URLSafeUUID()
		tokenHash = util.hashToken(token)
		forgotPwUser.forgotPassword = {
			token: tokenHash, // Store secure hashed token
			issued: Date.now(),
			expires: Date.now() + tokenLife * 1000
		}
		const finalUser = await logActivity(
			forgotPwUser._id,
			'forgot password',
			'local',
			req,
			forgotPwUser
		)
		await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
		mailer.sendEmail('forgotPassword', forgotPwUser.email || forgotPwUser.unverifiedEmail.email, {
			forgotPwUser,
			req,
			token
		}) // Send user the unhashed token
		emitter.emit('forgot-password', forgotPwUser)
		return forgotPwUser.forgotPassword
	}

	const verifyEmail = async (token: string, req: { ip: string }) => {
		req = req || {}
		let verifyEmailUser: IUserDoc
		const result = await userDB.query<IUserDoc>('auth/verifyEmail', {
			key: token,
			include_docs: true
		})

		if (!result.rows.length) {
			return Promise.reject({ error: 'Invalid token', status: 400 })
		}
		verifyEmailUser = result.rows[0].doc as IUserDoc
		verifyEmailUser.email = verifyEmailUser.unverifiedEmail.email
		delete verifyEmailUser.unverifiedEmail
		emitter.emit('email-verified', verifyEmailUser)
		const finalUser = await logActivity(
			verifyEmailUser._id,
			'verified email',
			'local',
			req,
			verifyEmailUser
		)
		return userDB.upsert<IUserDoc>(finalUser._id, oldUser => {
			delete oldUser.unverifiedEmail
			return merge({}, oldUser, finalUser)
		})
	}

	const changeEmail = async (
		user_id: string,
		newEmail: string,
		req: { user: { provider: string }; ip: string }
	) => {
		req = req || {}
		if (!req.user) {
			req.user = { provider: 'local' }
		}
		let changeEmailUser: IUserDoc
		const err = await validateEmail(newEmail)

		if (err) {
			return Promise.reject(err)
		}
		const userDoc = await userDB.get<IUserDoc>(user_id)

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

		emitter.emit('email-changed', changeEmailUser)
		const finalUser = await logActivity(
			changeEmailUser._id,
			'changed email',
			req.user.provider,
			req,
			changeEmailUser
		)
		return userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
	}

	const addUserDB = async (
		user_id: string,
		dbName: string,
		type: string,
		designDocs: string[],
		permissions: string[]
	) => {
		let userDoc: IUserDoc
		const dbConfig = dbAuth.getDBConfig(dbName, type || 'private')
		dbConfig.designDocs = designDocs || dbConfig.designDocs || ''
		dbConfig.permissions = permissions || dbConfig.permissions
		const result = await userDB.get<IUserDoc>(user_id)

		userDoc = result
		const finalDBName = await dbAuth.addUserDB(
			userDoc,
			dbName,
			dbConfig.designDocs,
			dbConfig.type,
			dbConfig.permissions,
			dbConfig.adminRoles,
			dbConfig.memberRoles
		)
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
	}

	const removeUserDB = async (
		user_id: string,
		dbName: string,
		deletePrivate: boolean,
		deleteShared: boolean
	) => {
		let removeUser: IUserDoc
		let update = false
		let dbID: string
		const userDoc = await userDB.get<IUserDoc>(user_id)
		removeUser = userDoc
		if (removeUser.personalDBs && typeof removeUser.personalDBs === 'object') {
			await Promise.all(
				Object.keys(removeUser.personalDBs).map(async db => {
					if (removeUser.personalDBs[db].name === dbName) {
						dbID = db
						const { type } = removeUser.personalDBs[db]
						delete removeUser.personalDBs[db]
						update = true
						try {
							if (type === 'private' && deletePrivate) {
								await dbAuth.removeDB(db)
								return Promise.resolve()
							}
							if (type === 'shared' && deleteShared) {
								await dbAuth.removeDB(db)
								return Promise.resolve()
							}
						} catch (error) {
							console.log('error removing user db!', db, dbName, error)
						}
					}
					return Promise.resolve()
				})
			)
		}

		if (update) {
			emitter.emit('user-db-removed', user_id, dbName)
			return userDB.upsert<IUserDoc>(removeUser._id, oldUser => {
				if (oldUser.personalDBs[dbID]) {
					delete oldUser.personalDBs[dbID]
				}
				return merge({}, oldUser, removeUser)
			})
		}
		return Promise.resolve()
	}

	const logoutUser = async (user_id: string, session_id: string) => {
		let logoutUserDoc: IUserDoc
		if (user_id) {
			logoutUserDoc = await userDB.get<IUserDoc>(user_id)
		} else {
			if (!session_id) {
				return Promise.reject({
					error: 'unauthorized',
					message: 'Either user_id or session_id must be specified',
					status: 401
				})
			}
			const results = await userDB.query<IUserDoc>('auth/session', {
				key: session_id,
				include_docs: true
			})

			if (!results.rows.length) {
				return Promise.reject({
					error: 'unauthorized',
					status: 401
				})
			}
			logoutUserDoc = results.rows[0].doc as IUserDoc
			user_id = logoutUserDoc._id
			await logoutUserSessions(logoutUserDoc, 'all')
		}
		emitter.emit('logout', user_id)
		emitter.emit('logout-all', user_id)
		return userDB.upsert(logoutUserDoc._id, oldUser => merge({}, oldUser, logoutUserDoc))
	}

	const logoutSession = async (session_id: string) => {
		let logoutUserDoc: IUserDoc
		let startSessions = 0
		let endSessions = 0
		const results = await userDB.query<IUserDoc>('auth/session', {
			key: session_id,
			include_docs: true
		})

		if (!results.rows.length) {
			return Promise.reject({
				error: 'unauthorized',
				status: 401
			})
		}
		logoutUserDoc = results.rows[0].doc as IUserDoc
		if (logoutUserDoc.session) {
			startSessions = Object.keys(logoutUserDoc.session).length
			if (logoutUserDoc.session[session_id]) {
				delete logoutUserDoc.session[session_id]
			}
		}
		await session.deleteTokens(session_id)
		dbAuth.removeKeys(session_id)
		if (logoutUserDoc) {
			await dbAuth.deauthorizeUser(logoutUserDoc, session_id)
		}
		const finalUser = await logoutUserSessions(logoutUserDoc, 'expired')

		logoutUserDoc = finalUser
		if (logoutUserDoc.session) {
			endSessions = Object.keys(logoutUserDoc.session).length
		}
		emitter.emit('logout', logoutUserDoc._id)
		if (startSessions !== endSessions) {
			return userDB.upsert<IUserDoc>(logoutUserDoc._id, oldUser => {
				if (oldUser.session) {
					delete oldUser.session[session_id]
				}
				return merge({}, oldUser, logoutUserDoc)
			})
		}
		return Promise.resolve(false)
	}

	const remove = async (user_id: string, destroyDBs: boolean) => {
		let removeUser: IUserDoc
		try {
			const userDoc = await userDB.get<IUserDoc>(user_id)
			await logoutUserSessions(userDoc, 'all')
			removeUser = userDoc
			if (destroyDBs !== true || !removeUser.personalDBs) {
				return Promise.resolve()
			}
			await Promise.all(
				Object.keys(removeUser.personalDBs).map(async userdb => {
					if (removeUser.personalDBs[userdb].type === 'private') {
						await dbAuth.removeDB(userdb)
					}
					return Promise.resolve()
				})
			)
			return userDB.remove(removeUser)
		} catch (error) {
			console.log('error removing user!', error)
			return Promise.resolve()
		}
	}

	const removeExpiredKeys = dbAuth.removeExpiredKeys.bind(dbAuth)

	const confirmSession = async (key: string, password: string) =>
		session.confirmToken(key, password)

	const quitRedis = session.quit

	return {
		dbAuth,
		session,
		onCreateActions,
		onLinkActions,

		// Token valid for 24 hours by default
		// Forget password token life
		tokenLife,
		// Session token life
		sessionLife,

		emailUsername,

		addUserDBs,

		generateSession,

		// ------> FIXME <------
		// Adds numbers to a base name until it finds a unique database key
		generateUsername,

		validateUsername,

		validateEmail,

		validateEmailUsername,

		// Validation function for ensuring that two fields match
		matches,

		passwordConstraints,

		userModel,

		resetPasswordModel,

		changePasswordModel,

		onCreate,

		onLink,

		processTransformations,

		get,

		create,

		socialAuth,

		linkSocial,

		unlink,

		createSession,

		handleFailedLogin,

		refreshSession,

		resetPassword,

		changePasswordSecure,

		changePassword,

		forgotPassword,

		verifyEmail,

		changeEmail,

		addUserDB,

		removeUserDB,

		logoutUser,

		logoutSession,

		logoutOthers,

		logoutUserSessions,

		remove,

		removeExpiredKeys,

		confirmSession,

		quitRedis
	}
}

declare global {
	// tslint:disable-next-line:no-any
	type User = any
}

export default user
