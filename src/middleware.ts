// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird')
// Contains middleware useful for securing your routes
import { RequestHandler } from 'express'
import { PassportStatic } from 'passport'
const middleware = (passport: PassportStatic) => {
	const forbiddenError = {
		error: 'Forbidden',
		message: 'You do not have permission to access this resource.',
		status: 403
	}

	const superloginError = {
		error: 'superlogin',
		message: 'requireAuth must be used before checking roles',
		status: 500
	}

	// Requires that the user be authenticated with a bearer token
	const requireAuth: RequestHandler = (req, res, next) => {
		passport.authenticate('bearer', { session: false })(req, res, next)
	}

	// Requires that the user have the specified role
	const requireRole = (requiredRole: string): RequestHandler => (req, res, next) => {
		if (!req.user) {
			return next(superloginError)
		}
		const { roles } = req.user
		if (!roles || !roles.length || roles.indexOf(requiredRole) === -1) {
			res.status(forbiddenError.status)
			res.json(forbiddenError)
		} else {
			next()
		}
		return undefined
	}

	// Requires that the user have at least one of the specified roles
	const requireAnyRole = (possibleRoles: string[]): RequestHandler => (req, res, next) => {
		if (!req.user) {
			return next(superloginError)
		}
		let denied = true
		const { roles } = req.user
		if (roles && roles.length) {
			possibleRoles.forEach(role => (roles.indexOf(role) > -1 ? (denied = false) : undefined))
		}
		if (denied) {
			res.status(forbiddenError.status)
			res.json(forbiddenError)
		} else {
			next()
		}
		return undefined
	}

	const requireAllRoles = (requiredRoles: string[]): RequestHandler => (req, res, next) => {
		if (!req.user) {
			return next(superloginError)
		}
		let denied = false
		const { roles } = req.user
		if (!roles || !roles.length) {
			denied = true
		} else {
			requiredRoles.forEach(role => (roles.indexOf(role) === -1 ? (denied = true) : undefined))
		}
		if (denied) {
			res.status(forbiddenError.status)
			res.json(forbiddenError)
		} else {
			next()
		}
		return undefined
	}

	return {
		requireAuth,
		requireRole,
		requireAnyRole,
		requireAllRoles
	}
}

declare global {
	type Middleware = typeof middleware
}

export default middleware
