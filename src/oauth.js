const fs = require('fs')
const path = require('path')
const ejs = require('ejs')
const extend = require('util')._extend
const util = require('./util')

const stateRequired = ['google', 'linkedin']

const oauth = (router, passport, user, config) => {
	const getLinkCallbackURLs = (provider, req, operation, accessToken) => {
		if (accessToken) {
			accessToken = encodeURIComponent(accessToken)
		}
		const protocol = `${req.get('X-Forwarded-Proto') || req.protocol}://`
		if (operation === 'login') {
			return `${protocol + req.get('host') + req.baseUrl}/${provider}/callback`
		}
		if (operation === 'link') {
			let reqUrl
			if (
				accessToken &&
				(stateRequired.indexOf(provider) > -1 ||
					config.getItem(`providers.${provider}.stateRequired`) === true)
			) {
				reqUrl = `${protocol + req.get('host') + req.baseUrl}/link/${provider}/callback`
			} else {
				reqUrl = `${protocol +
					req.get('host') +
					req.baseUrl}/link/${provider}/callback?state=${accessToken}`
			}
			return reqUrl
		}
		return undefined
	}

	// Configures the passport.authenticate for the given provider, passing in options
	// Operation is 'login' or 'link'
	const passportCallback = (provider, options, operation) => (req, res, next) => {
		const theOptions = extend({}, options)
		if (provider === 'linkedin') {
			theOptions.state = true
		}
		const accessToken = req.query.bearer_token || req.query.state
		if (
			accessToken &&
			(stateRequired.indexOf(provider) > -1 ||
				config.getItem(`providers.${provider}.stateRequired`) === true)
		) {
			theOptions.state = accessToken
		}
		theOptions.callbackURL = getLinkCallbackURLs(provider, req, operation, accessToken)
		theOptions.session = false
		passport.authenticate(provider, theOptions)(req, res, next)
	}

	// Configures the passport.authenticate for the given access_token provider, passing in options
	const passportTokenCallback = (provider, options) => (req, res, next) => {
		const theOptions = extend({}, options)
		theOptions.session = false
		passport.authenticate(`${provider}-token`, theOptions)(req, res, next)
	}

	// This is called after a user has successfully authenticated with a provider
	// If a user is authenticated with a bearer token we will link an account, otherwise log in
	// auth is an object containing 'access_token' and optionally 'refresh_token'
	const authHandler = (req, provider, auth, profile) => {
		if (req.user && req.user._id && req.user.key) {
			return user.linkSocial(req.user._id, provider, auth, profile, req)
		}
		return user.socialAuth(provider, auth, profile, req)
	}
	// Gets the provider name from a callback path
	const getProvider = pathname => {
		const items = pathname.split('/')
		const index = items.indexOf('callback')
		if (index > 0) {
			return items[index - 1]
		}
		return undefined
	}

	// Gets the provider name from a callback path for access_token strategy
	const getProviderToken = pathname => {
		const items = pathname.split('/')
		const index = items.indexOf('token')
		if (index > 0) {
			return items[index - 1]
		}
		return undefined
	}
	// Function to initialize a session following authentication from a socialAuth provider
	const initSession = (req, res, next) => {
		const provider = getProvider(req.path)
		return user
			.createSession(req.user._id, provider, req)
			.then(mySession =>
				Promise.resolve({
					error: null,
					session: mySession,
					link: null
				})
			)
			.then(
				results => {
					let template
					if (config.getItem('testMode.oauthTest')) {
						template = fs.readFileSync(
							path.join(__dirname, '../templates/oauth/auth-callback-test.ejs'),
							'utf8'
						)
					} else {
						template = fs.readFileSync(
							path.join(__dirname, '../templates/oauth/auth-callback.ejs'),
							'utf8'
						)
					}
					const html = ejs.render(template, results)
					res.status(200).send(html)
				},
				err => next(err)
			)
	}

	// Function to initialize a session following authentication from a socialAuth provider
	const initTokenSession = (req, res, next) => {
		const provider = getProviderToken(req.path)
		return user
			.createSession(req.user._id, provider, req)
			.then(mySession => Promise.resolve(mySession))
			.then(
				session => {
					res.status(200).json(session)
				},
				err => next(err)
			)
	}

	// Called after an account has been succesfully linked
	const linkSuccess = (req, res) => {
		const provider = getProvider(req.path)
		const result = {
			error: null,
			session: null,
			link: provider
		}
		let template
		if (config.getItem('testMode.oauthTest')) {
			template = fs.readFileSync(
				path.join(__dirname, '../templates/oauth/auth-callback-test.ejs'),
				'utf8'
			)
		} else {
			template = fs.readFileSync(
				path.join(__dirname, '../templates/oauth/auth-callback.ejs'),
				'utf8'
			)
		}
		const html = ejs.render(template, result)
		res.status(200).send(html)
	}

	// Called after an account has been succesfully linked using access_token provider
	const linkTokenSuccess = (req, res) => {
		const provider = getProviderToken(req.path)
		res.status(200).json({
			ok: true,
			success: `${util.capitalizeFirstLetter(provider)} successfully linked`,
			provider
		})
	}

	// Handles errors if authentication fails
	const oauthErrorHandler = (err, req, res) => {
		let template
		if (config.getItem('testMode.oauthTest')) {
			template = fs.readFileSync(
				path.join(__dirname, '../templates/oauth/auth-callback-test.ejs'),
				'utf8'
			)
		} else {
			template = fs.readFileSync(
				path.join(__dirname, '../templates/oauth/auth-callback.ejs'),
				'utf8'
			)
		}
		const html = ejs.render(template, { error: err.message, session: null, link: null })
		console.error(err)
		if (err.stack) {
			console.error(err.stack)
		}
		res.status(400).send(html)
	}

	// Handles errors if authentication from access_token provider fails
	const tokenAuthErrorHandler = (err, req, res) => {
		let status
		if (req.user && req.user._id) {
			status = 403
		} else {
			status = 401
		}
		console.error(err)
		if (err.stack) {
			console.error(err.stack)
			delete err.stack
		}
		res.status(status).json(err)
	}

	// Framework to register OAuth providers with passport
	const registerProvider = (provider, configFunction) => {
		provider = provider.toLowerCase()
		const configRef = `providers.${provider}`
		if (config.getItem(`${configRef}.credentials`)) {
			const credentials = config.getItem(`${configRef}.credentials`)
			credentials.passReqToCallback = true
			const options = config.getItem(`${configRef}.options`) || {}
			configFunction.call(null, credentials, passport, authHandler)
			router.get(`/${provider}`, passportCallback(provider, options, 'login'))
			router.get(
				`/${provider}/callback`,
				passportCallback(provider, options, 'login'),
				initSession,
				oauthErrorHandler
			)
			if (!config.getItem('security.disableLinkAccounts')) {
				router.get(
					`/link/${provider}`,
					passport.authenticate('bearer', { session: false }),
					passportCallback(provider, options, 'link')
				)
				router.get(
					`/link/${provider}/callback`,
					passport.authenticate('bearer', { session: false }),
					passportCallback(provider, options, 'link'),
					linkSuccess,
					oauthErrorHandler
				)
			}
			console.log(`${provider} loaded.`)
		}
	}

	// A shortcut to register OAuth2 providers that follow the exact accessToken, refreshToken pattern.
	const registerOAuth2 = (providerName, Strategy) => {
		registerProvider(providerName, (credentials, providerPassport, providerAuthHandler) => {
			providerPassport.use(
				new Strategy(credentials, async (req, accessToken, refreshToken, profile, done) =>
					providerAuthHandler(req, providerName, { accessToken, refreshToken }, profile).then(done)
				)
			)
		})
	}

	// Registers a provider that accepts an access_token directly from the client, skipping the popup window and callback
	// This is for supporting Cordova, native IOS and Android apps, as well as other devices
	const registerTokenProvider = (providerName, Strategy) => {
		providerName = providerName.toLowerCase()
		const configRef = `providers.${providerName}`
		if (config.getItem(`${configRef}.credentials`)) {
			const credentials = config.getItem(`${configRef}.credentials`)
			credentials.passReqToCallback = true
			const options = config.getItem(`${configRef}.options`) || {}
			// Configure the Passport Strategy
			passport.use(
				`${providerName}-token`,
				new Strategy(credentials, async (req, accessToken, refreshToken, profile, done) =>
					authHandler(req, providerName, { accessToken, refreshToken }, profile).then(done)
				)
			)
			router.post(
				`/${providerName}/token`,
				passportTokenCallback(providerName, options),
				initTokenSession,
				tokenAuthErrorHandler
			)
			if (!config.getItem('security.disableLinkAccounts')) {
				router.post(
					`/link/${providerName}/token`,
					passport.authenticate('bearer', { session: false }),
					passportTokenCallback(providerName, options),
					linkTokenSuccess,
					tokenAuthErrorHandler
				)
			}
			console.log(`${providerName}-token loaded.`)
		}
	}

	return {
		registerProvider,
		registerOAuth2,
		registerTokenProvider
	}
}

export default oauth
