const util = require('./util')

const routes = (config, router, passport, user) => {
	const env = process.env.NODE_ENV || 'development'

	router.post(
		'/login',
		(req, res, next) => {
			passport.authenticate('local', (err, passportUser, info) => {
				if (err) {
					return next(err)
				}
				if (!passportUser) {
					// Authentication failed
					return res.status(401).json(info)
				}
				// Success
				req.logIn(
					passportUser,
					{ session: false },
					loginErr => (loginErr ? next(loginErr) : undefined)
				)
				return next()
			})(req, res, next)
		},
		(req, res, next) =>
			// Success handler
			user.createSession(req.user._id, 'local', req).then(
				mySession => {
					res.status(200).json(mySession)
				},
				err => next(err)
			)
	)

	router.post('/refresh', passport.authenticate('bearer', { session: false }), (req, res, next) =>
		user.refreshSession(req.user.key).then(
			mySession => {
				res.status(200).json(mySession)
			},
			err => next(err)
		)
	)

	router.post('/logout', (req, res, next) => {
		const sessionToken = util.getSessionToken(req)
		if (!sessionToken) {
			return next({
				error: 'unauthorized',
				status: 401
			})
		}
		return user.logoutSession(sessionToken).then(
			() => res.status(200).json({ ok: true, success: 'Logged out' }),
			err => {
				console.error('Logout failed')
				return next(err)
			}
		)
	})

	router.post(
		'/logout-others',
		passport.authenticate('bearer', { session: false }),
		(req, res, next) => {
			user.logoutOthers(req.user.key).then(
				() => {
					res.status(200).json({ success: 'Other sessions logged out' })
				},
				err => {
					console.error('Logout failed')
					return next(err)
				}
			)
		}
	)

	router.post('/logout-all', (req, res, next) => {
		const sessionToken = util.getSessionToken(req)
		if (!sessionToken) {
			return next({
				error: 'unauthorized',
				status: 401
			})
		}
		return user.logoutUser(null, sessionToken).then(
			() => res.status(200).json({ success: 'Logged out' }),
			err => {
				console.error('Logout-all failed')
				return next(err)
			}
		)
	})

	// Setting up the auth api
	router.post('/register', (req, res, next) => {
		user.create(req.body, req).then(
			newUser => {
				if (config.getItem('security.loginOnRegistration')) {
					return user.createSession(newUser._id, 'local', req.ip).then(
						mySession => {
							res.status(200).json(mySession)
						},
						err => next(err)
					)
				}
				return res.status(201).json({ success: 'User created.' })
			},
			err => next(err)
		)
	})

	router.post('/forgot-password', (req, res, next) =>
		user
			.forgotPassword(req.body.email, req)
			.then(
				() => res.status(200).json({ success: 'Password recovery email sent.' }),
				err => next(err)
			)
	)

	router.post('/password-reset', (req, res, next) => {
		user.resetPassword(req.body, req).then(
			currentUser => {
				if (config.getItem('security.loginOnPasswordReset')) {
					return user.createSession(currentUser._id, 'local', req.ip).then(
						mySession => {
							res.status(200).json(mySession)
						},
						err => next(err)
					)
				}
				return res.status(200).json({ success: 'Password successfully reset.' })
			},
			err => next(err)
		)
	})

	router.post(
		'/password-change',
		passport.authenticate('bearer', { session: false }),
		(req, res, next) => {
			user.changePasswordSecure(req.user._id, req.body, req).then(
				() => {
					res.status(200).json({ success: 'password changed' })
				},
				err => next(err)
			)
		}
	)

	router.post(
		'/unlink/:provider',
		passport.authenticate('bearer', { session: false }),
		(req, res, next) => {
			const { provider } = req.params
			user
				.unlink(req.user._id, provider)
				.then(
					() =>
						res.status(200).json({ success: `${util.capitalizeFirstLetter(provider)} unlinked` }),
					err => next(err)
				)
		}
	)

	router.get('/confirm-email/:token', (req, res, next) => {
		const redirectURL = config.getItem('local.confirmEmailRedirectURL')
		if (!req.params.token) {
			const err = { error: 'Email verification token required' }
			if (redirectURL) {
				return res.status(201).redirect(`${redirectURL}?error=${encodeURIComponent(err.error)}`)
			}
			return res.status(400).send(err)
		}
		return user.verifyEmail(req.params.token, req).then(
			() =>
				redirectURL
					? res.status(201).redirect(`${redirectURL}?success=true`)
					: res.status(200).send({ ok: true, success: 'Email verified' }),
			err => {
				if (redirectURL) {
					let query = `?error=${encodeURIComponent(err.error)}`
					if (err.message) {
						query += `&message=${encodeURIComponent(err.message)}`
					}
					return res.status(201).redirect(redirectURL + query)
				}
				return next(err)
			}
		)
	})

	router.get('/validate-username/:username', (req, res, next) => {
		if (!req.params.username) {
			return next({ error: 'Username required', status: 400 })
		}
		return user
			.validateUsername(req.params.username)
			.then(
				err =>
					err
						? res.status(409).json({ error: 'Username already in use' })
						: res.status(200).json({ ok: true }),
				err => next(err)
			)
	})

	router.get('/validate-email/:email', (req, res, next) => {
		let promise
		if (!req.params.email) {
			return next({ error: 'Email required', status: 400 })
		}
		if (config.getItem('local.emailUsername')) {
			promise = user.validateEmailUsername(req.params.email)
		} else {
			promise = user.validateEmail(req.params.email)
		}
		return promise.then(
			err =>
				err
					? res.status(409).json({ error: 'Email already in use' })
					: res.status(200).json({ ok: true }),
			err => next(err)
		)
	})

	router.post(
		'/change-email',
		passport.authenticate('bearer', { session: false }),
		(req, res, next) => {
			user.changeEmail(req.user._id, req.body.newEmail, req).then(
				() => {
					res.status(200).json({ ok: true, success: 'Email changed' })
				},
				err => next(err)
			)
		}
	)

	// route to test token authentication
	router.get('/session', passport.authenticate('bearer', { session: false }), (req, res) => {
		const { user: sessionUser } = req
		sessionUser.user_id = sessionUser._id
		delete sessionUser._id
		// user.token = user.key;
		delete sessionUser.key
		res.status(200).json(sessionUser)
	})

	// Error handling
	router.use((err, req, res) => {
		console.error(err)
		if (err.stack) {
			console.error(err.stack)
		}
		res.status(err.status || 500)
		if (err.stack && env !== 'development') {
			delete err.stack
		}
		res.json(err)
	})
}

export default routes
