import { RequestHandlerParams } from 'express'
declare global {
	interface IAdapter {
		_getFilepath?: (path: string) => string
		_removeExpired?: (path: string) => void
		deleteKeys: (keys: string[]) => Promise<number>
		getKey: (path: string) => Promise<string>
		quit: (path?: string) => Promise<void>
		storeKey: (key: string, life: number, data: {}) => Promise<void>
	}

	interface ISecurityDoc {
		admins: { roles: string[]; names: string[]; members?: string[] }
		members: { roles: string[]; names: string[]; members?: string[] }
	}
	type DBType = 'private' | 'shared'
	interface IConfig {
		dbServer: {
			protocol?: string
			host?: string
			user?: string
			password?: string
			userDB: string
			couchAuthDB: string
		}
		mailer?: {
			fromEmail: string
			options: {
				service: string
				auth: {
					user: string
					pass: string
				}
			}
		}
	}

	interface ISession {
		userDBs?: { [name: string]: string }
		user_id?: string
		token?: string
		issued?: number
		expires: number
		provider?: string
		ip?: string
		salt?: string
		derived_key?: string
		_id: string
		provider?: string
		key: string
		password: string
		issued: number
		expires: number
		roles: string[]
	}

	interface IProfile {
		[key: string]: any
		displayName: string
		username: string
		id: string
		email: string
		emails: { value: string }[]
	}

	interface IActivity {
		timestamp: string
		action: string
		provider: string
		ip: string
	}

	interface IUserDoc extends ISession {
		activity?: IActivity[] | IActivity
		_rev: string
		rev?: string
		unverifiedEmail: { email: string; token: string }
		password: string
		confirmPassword: string
		name: string
		email: string
		_id: string
		type: string
		roles: string[]
		providers: string[]
		profile: IProfile
		forgotPassword: {
			expires: number
			token: string
			issued: number
			expires: number
		}
		local: {
			iterations?: string
			failedLoginAttempts?: number
			salt?: string
			derived_key?: string
			lockedUntil?: number
		}
		signUp: {
			provider: string
			timestamp: string
			ip: string
		}
		session: { [name: string]: { expires?: number } }
		personalDBs: { [dbName: string]: { name: string; type?: string } }
	}

	interface ISLInstance {
		addUserDB: (
			user_id: string,
			dbName: string,
			type?: DBType,
			designDoc?: string[],
			permissions?: string[]
		) => void

		onCreate: (callback: (userDoc: IUserDoc, provider: string) => Promise<IUserDoc>) => void
		on(event: string, cb: any)
		registerTokenProvider(event: string, provider: any)
		registerOAuth2(event: string, provider: any)
		removeExpiredKeys(): void
		removeUser(userId: string, destroyDBs?: boolean): Promise<void>
		getUser(userId: string): Promise<IUserSession>
		router: RequestHandlerParams
		requireAuth: RequestHandlerParams
		removeUserDB(
			userId: string,
			dbName: string,
			deletePrivate: boolean,
			deleteShared?: boolean
		): Promise<void>
		requireRole(role: string): RequestHandlerParams
		userDB: PouchDB
	}

	export type SLInstance = ISLInstance

	export type UserDoc = IUserDoc
}
