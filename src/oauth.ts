// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird')
import ejs from 'ejs'
import { Request, RequestHandler, Response, Router } from 'express'
import fs from 'fs'
import { Passport, Strategy as StrategyType } from 'passport'
import path from 'path'
import util from './util'

const stateRequired = ['google', 'linkedin']

const oauth = (router: Router, passport: Passport, user: User, config: IConfigure) => {
	const getLinkCallbackURLs = (
		provider: string,
		req: Request,
		operation: string,
		accessToken: string
	) => {
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
	const passportCallback = (
		provider: string,
		options: { callbackURL?: string; state: boolean; session: boolean },
		operation: string
	): RequestHandler => (req, res, next) => {
		const theOptions = Object.assign({}, options)
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
		return passport.authenticate(provider, theOptions)(req, res, next)
	}

	// Configures the passport.authenticate for the given access_token provider, passing in options
	const passportTokenCallback = (
		provider: string,
		options: { callbackURL?: string; state: boolean; session: boolean }
	): RequestHandler => (req, res, next) => {
		const theOptions = Object.assign({}, options)
		theOptions.session = false
		return passport.authenticate(`${provider}-token`, theOptions)(req, res, next)
	}

	// This is called after a user has successfully authenticated with a provider
	// If a user is authenticated with a bearer token we will link an account, otherwise log in
	// auth is an object containing 'access_token' and optionally 'refresh_token'
	const authHandler = (
		req: Request,
		provider: string,
		auth: { accessToken: string; refreshToken: string },
		profile: {}
	) => {
		if (req.user && req.user._id && req.user.key) {
			return user.linkSocial(req.user._id, provider, auth, profile, req)
		}
		return user.socialAuth(provider, auth, profile, req)
	}
	// Gets the provider name from a callback path
	const getProvider = (pathname: string) => {
		const items = pathname.split('/')
		const index = items.indexOf('callback')
		if (index > 0) {
			return items[index - 1]
		}
		return undefined
	}

	// Gets the provider name from a callback path for access_token strategy
	const getProviderToken = (pathname: string) => {
		const items = pathname.split('/')
		const index = items.indexOf('token')
		if (index > 0) {
			return items[index - 1]
		}
		return ''
	}
	// Function to initialize a session following authentication from a socialAuth provider
	const initSession: RequestHandler = async (req, res, next) => {
		const provider = getProvider(req.path)
		try {
			const session = await user.createSession(req.user._id, provider, req)
			const results = {
				error: null,
				session,
				link: null
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
			const html = ejs.render(template, results)
			return res.status(200).send(html)
		} catch (error) {
			return next(error)
		}
	}

	// Function to initialize a session following authentication from a socialAuth provider
	const initTokenSession: RequestHandler = async (req, res, next) => {
		const provider = getProviderToken(req.path)
		try {
			const session = await user.createSession(req.user._id, provider, req)
			return res.status(200).json(session)
		} catch (error) {
			return next()
		}
	}

	// Called after an account has been succesfully linked
	const linkSuccess: RequestHandler = (req, res) => {
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
	const linkTokenSuccess: RequestHandler = (req, res) => {
		const provider = getProviderToken(req.path)
		res.status(200).json({
			ok: true,
			success: `${util.capitalizeFirstLetter(provider)} successfully linked`,
			provider
		})
	}

	// Handles errors if authentication fails
	const oauthErrorHandler = (
		err: { message: string; stack: string },
		req: Request,
		res: Response
	) => {
		try {
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
			console.error('oauthError', err)
			console.dir('oauthError', err)
			if (err.stack) {
				console.error('oauthError stack', err.stack)
			}
			res.status(400).send(html)
		} catch (error) {
			console.log('failed sending oauthError', error)
			return res.status(500)
		}
	}

	// Handles errors if authentication from access_token provider fails
	const tokenAuthErrorHandler = (
		err: { message: string; stack: string },
		req: Request,
		res: Response
	) => {
		try {
			let status
			if (req.user && req.user._id) {
				status = 403
			} else {
				status = 401
			}
			console.error('tokenAuthErrorHandler', err)
			console.dir('tokenAuthErrorHandler', err)
			if (err.stack) {
				console.error('tokenAuthErrorHandler stack', err.stack)
				delete err.stack
			}
			res.status(status).json(err)
		} catch (error) {
			console.log('failed sending oauthError', error)
			return res.status(500)
		}
	}

	// Framework to register OAuth providers with passport
	const registerProvider = (
		// tslint:disable-next-line:no-any
		provider: string,
		configFunction: (
			credentials: string,
			// tslint:disable-next-line:no-any
			passport: any,
			// tslint:disable-next-line:no-any
			authHandler: any
		) => void
	) => {
		provider = provider.toLowerCase()
		const configRef = `providers.${provider}`
		if (config.getItem(`${configRef}.credentials`)) {
			const credentials = config.getItem(`${configRef}.credentials`)
			credentials.passReqToCallback = true
			const options = config.getItem(`${configRef}.options`) || {}
			configFunction(credentials, passport, authHandler)
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
	const registerOAuth2 = (providerName: string, Strategy: StrategyType) => {
		registerProvider(providerName, (credentials, providerPassport, providerAuthHandler) => {
			providerPassport.use(
				new Strategy(credentials, async (req, accessToken, refreshToken, profile, done) =>
					providerAuthHandler(req, providerName, { accessToken, refreshToken }, profile).asCallback(
						done
					)
				)
			)
		})
	}

	// Registers a provider that accepts an access_token directly from the client, skipping the popup window and callback
	// This is for supporting Cordova, native IOS and Android apps, as well as other devices
	const registerTokenProvider = (providerName: string, Strategy: StrategyType) => {
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
					authHandler(req, providerName, { accessToken, refreshToken }, profile).asCallback(done)
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

declare global {
	type Oauth = typeof oauth
}

export default oauth