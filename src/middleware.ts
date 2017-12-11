// Contains middleware useful for securing your routes
import { Passport } from 'passport'
import { RequestHandler } from 'express'
const middleware = (passport: Passport) => {
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
			for (let i = 0; i < possibleRoles.length; i += 1) {
				if (roles.indexOf(possibleRoles[i]) !== -1) {
					denied = false
				}
			}
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
			for (let i = 0; i < requiredRoles.length; i += 1) {
				if (roles.indexOf(requiredRoles[i]) === -1) {
					denied = true
				}
			}
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
