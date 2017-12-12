// Type definitions for Passport 0.4
// Project: http://passportjs.org
// Definitions by: Horiuchi_H <https://github.com/horiuchi>, Eric Naeseth <https://github.com/enaeseth>, Igor Belagorudsky <https://github.com/theigor>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

/// <reference types='express-serve-static-core' />

declare namespace Express {
	export interface Request {
		logIn(passportUser: string, { session: boolean }, cb: (loginErr: string) => void): void
		user: { _id: string; key: string; roles: string[] }
	}
}

declare module 'passport' {
	export interface AuthenticateOptions {
		callbackURL?: string
		state?: boolean
		authInfo?: boolean
		assignProperty?: string
		failureFlash?: string | boolean
		failureMessage?: boolean | string
		failureRedirect?: string
		failWithError?: boolean
		session?: boolean
		scope?: string | string[]
		successFlash?: string | boolean
		successMessage?: boolean | string
		successRedirect?: string
		successReturnToOrRedirect?: string
		pauseStream?: boolean
		userProperty?: string
		passReqToCallback?: boolean
	}

	export interface Passport {
		use(strategy: StrategyStatic): this
		use(name: string, strategy: StrategyStatic): this
		unuse(name: string): this
		framework(fw: Framework): this
		initialize(options?: { userProperty: string }): express.Handler
		session(options?: { pauseStream: boolean }): express.Handler

		authenticate(strategy: string | string[], callback?: (...args: any[]) => any): express.Handler
		authenticate(
			strategy: string | string[],
			options: AuthenticateOptions,
			callback?: (...args: any[]) => any
		): express.Handler
		authorize(strategy: string | string[], callback?: (...args: any[]) => any): express.Handler
		authorize(
			strategy: string | string[],
			options: any,
			callback?: (...args: any[]) => any
		): express.Handler
		serializeUser<TUser, TID>(fn: (user: TUser, done: (err: any, id?: TID) => void) => void): void
		deserializeUser<TUser, TID>(fn: (id: TID, done: (err: any, user?: TUser) => void) => void): void
		transformAuthInfo(fn: (info: any, done: (err: any, info: any) => void) => void): void
	}

	export interface PassportStatic extends Passport {
		Passport: { new (): Passport }
		Authenticator: { new (): Passport }
	}

	export interface StrategyStatic {
		name?: string
		authenticate(req: Request, options?: any): void
	}

	export interface Strategy {
		new (
			credentials: any,
			cb: (
				req: any,
				accessToken: string,
				refreshToken: string,
				profile: {},
				done: () => void
			) => void
		): StrategyStatic
	}

	export interface Profile {
		provider: string
		id: string
		displayName: string
		username?: string
		name?: {
			familyName: string
			givenName: string
			middleName?: string
		}
		emails?: Array<{
			value: string
			type?: string
		}>
		photos?: Array<{
			value: string
		}>
	}

	export interface Framework {
		initialize(passport: Passport, options?: any): (...args: any[]) => any
		authenticate(
			passport: Passport,
			name: string,
			options?: any,
			callback?: (...args: any[]) => any
		): (...args: any[]) => any
		authorize?(
			passport: Passport,
			name: string,
			options?: any,
			callback?: (...args: any[]) => any
		): (...args: any[]) => any
	}

	declare const passport: passport.PassportStatic
	export default passport
}
