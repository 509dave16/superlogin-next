const util = require('./util')
const LocalStrategy = require('passport-local')
const BearerStrategy = require('passport-http-bearer-sl').Strategy

const local = (config, passport, user) => {
	const handleFailedLogin = (userDoc, req, done) => {
		const invalid = {
			error: 'Unauthorized',
			message: 'Invalid username or password'
		}
		return user.handleFailedLogin(userDoc, req).then(locked => {
			if (locked) {
				invalid.message = `Maximum failed login attempts exceeded. Your account has been locked for ${Math.round(
					config.getItem('security.lockoutTime') / 60
				)} minutes.`
			}
			return done(null, false, invalid)
		})
	}
	// API token strategy
	passport.use(
		new BearerStrategy((tokenPass, done) => {
			const parse = tokenPass.split(':')
			if (parse.length < 2) {
				done(null, false, { message: 'invalid token' })
			}
			const token = parse[0]
			const password = parse[1]
			user.confirmSession(token, password).then(
				theuser => {
					done(null, theuser)
				},
				err => {
					if (err instanceof Error) {
						done(err, false)
					} else {
						done(null, false, { message: err })
					}
				}
			)
		})
	)

	// Use local strategy
	passport.use(
		new LocalStrategy(
			{
				usernameField: config.getItem('local.usernameField') || 'username',
				passwordField: config.getItem('local.passwordField') || 'password',
				session: false,
				passReqToCallback: true
			},
			(req, username, password, done) => {
				user.get(username).then(
					theuser => {
						if (theuser) {
							// Check if the account is locked
							if (
								theuser.local &&
								theuser.local.lockedUntil &&
								theuser.local.lockedUntil > Date.now()
							) {
								return done(null, false, {
									error: 'Unauthorized',
									message:
										'Your account is currently locked. Please wait a few minutes and try again.'
								})
							}
							if (!theuser.local || !theuser.local.derived_key) {
								return done(null, false, {
									error: 'Unauthorized',
									message: 'Invalid username or password'
								})
							}
							util.verifyPassword(theuser.local, password).then(
								() => {
									// Check if the email has been confirmed if it is required
									if (config.getItem('local.requireEmailConfirm') && !theuser.email) {
										return done(null, false, {
											error: 'Unauthorized',
											message: 'You must confirm your email address.'
										})
									}
									// Success!!!
									return done(null, theuser)
								},
								err => {
									if (!err) {
										// Password didn't authenticate
										return handleFailedLogin(theuser, req, done)
									}
									// Hashing function threw an error
									return done(err)
								}
							)
						} else {
							// user not found
							return done(null, false, {
								error: 'Unauthorized',
								message: 'Invalid username or password'
							})
						}
						return undefined
					},
					err =>
						// Database threw an error
						done(err)
				)
			}
		)
	)
}

export default local
