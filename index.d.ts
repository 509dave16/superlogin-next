import { RequestHandlerParams } from 'express'
import { TransportOptions, Transport } from 'nodemailer'
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
	interface IConfiguration {
		// Useful settings for testing and debugging your app
		testMode?: {
			oauthTest?: boolean
			// Use a stub transport so no email is actually sent
			noEmail?: boolean
			// Displays debug information in the oauth dialogs
			oauthDebug?: boolean
			// Logs out-going emails to the console
			debugEmail: boolean
		}
		security: {
			// Default roles given to a new user
			defaultRoles: string[]
			// Disables the ability to link additional providers to an account when set to true
			disableLinkAccounts?: boolean
			// Maximum number of failed logins before the account is locked
			maxFailedLogins: number
			// The amount of time the account will be locked for (in seconds) after the maximum failed logins is exceeded
			lockoutTime: number
			// The amount of time a new session is valid for (default: 24 hours)
			sessionLife: number
			// The amount of time a password reset token is valid for
			tokenLife: number
			// The maximum number of entries in the activity log in each user doc. Zero to disable completely
			userActivityLogSize?: number
			// If set to true, the user will be logged in automatically after registering
			loginOnRegistration: boolean
			// If set to true, the user will be logged in automatically after resetting the password
			loginOnPasswordReset: boolean
		}
		local: {
			// Send out a confirm email after each user signs up with local login
			sendConfirmEmail?: boolean
			// Require the email be confirmed before the user can login
			requireEmailConfirm?: boolean
			// If this is set, the user will be redirected to this location after confirming email instead of JSON response
			confirmEmailRedirectURL?: string
			// Set this to true to disable usernames and use emails instead
			emailUsername?: boolean
			// Custom names for the username and password fields in your sign-in form
			usernameField: string
			passwordField: string
			// Override default constraints
			passwordConstraints?: {
				length?: {
					minimum: number
					message?: string
				}
				matches?: string
			}
		}
		dbServer: {
			designDocDir: string
			// The CouchDB compatible server where all your databases are stored on
			protocol: string
			host: string
			user: string
			password: string
			// If the public uses a separate URL from your Node.js server to access the database specify it here.
			// This will be the access URL for all your user's personalDBs
			publicURL?: string
			// Set this to true if you are using Cloudant
			cloudant?: boolean
			// The name for the database that stores all your user information. This is distinct from CouchDB's _user database.
			// Alternatively you can pass in a PouchDB object to the SuperLogin constructor and leave this blank
			userDB: string
			// CouchDB's _users database. Each session generates the user a unique login and password. This is not used with Cloudant.
			couchAuthDB: string
		}
		session: {
			// 'redis' or 'memory'
			adapter: 'redis' | 'memory' | 'file'
			file: { sessionsRoot: string }
			redis?: {
				// If url is supplied, port and host will be ignored
				url?: string
				port?: number
				host?: string
				// If a UNIX domain socket is specified, port, host and url will be ignored
				unix_socket?: string
				options?: {}
				password?: string
			}
		}
		mailer?: {
			// Email address that all your system emails will be from
			fromEmail?: string
			// Use this if you want to specify a custom Nodemailer transport. Defaults to SMTP or sendmail.
			transport?: Transport
			// The options object that will be passed into your transport. These should usually be your SMTP settings.
			// If this is left blank, it will default to sendmail.
			options: TransportOptions
		}
		emails: {
			[name: string]: {
				subject: string
				template: string
				format: string
			}
		}
		// Custom settings to manage personal databases for your users
		userDBs?: {
			// These databases will be set up automatically for each new user
			defaultDBs?: {
				// Private databases are personal to each user. They will be prefixed with your setting below and postfixed with $USERNAME.
				private?: string[]
				// Shared databases that you want the user to be authorized to use. These will not be prefixed, so type the exact name.
				shared?: string[]
			}
			// If you specify default roles here (and use CouchDB not Cloudant) then these will be added to the _security object
			// of each new user database created. This is useful for preventing anonymous access.
			defaultSecurityRoles?: {
				admins?: string[]
				members?: string[]
			}
			// These are settings for each personal database
			model?: {
				// If your database is not listed below, these default settings will be applied
				_default?: {
					// Array containing name of the design doc files (omitting .js extension), in the directory configured below
					designDocs?: string[]
					// these permissions only work with the Cloudant API
					permissions?: string[]
				}
				[name: string]: {
					designDocs?: string[]
					permissions?: string[]
					// 'private' or 'shared'
					type: string
					// Roles that will be automatically added to the db's _security object of this specific db
					adminRoles?: string[]
					memberRoles?: string[]
				}
			}
			// Your private user databases will be prefixed with this:
			privatePrefix?: string
			// Directory that contains all your design docs
			designDocDir?: string
		}
		// Configure all your authentication providers here
		providers: {
			// Each provider follows the following pattern
			[name: string]: {
				// Supply your app's credentials here. The callback url is generated automatically.
				// See the Passport documentation for your specific strategy for details.
				credentials: {
					// Anything under credentials will be passed in to passport.use
					// It is a best practice to put any sensitive credentials in environment variables rather than your code
					clientID: string
					clientSecret: string
				} & any
				// Any additional options you want to supply your authentication strategy such as requested permissions
				options: {
					// Anything under options will be passed in with passport.authenticate
					scope: string[]
				} & any
				// This will pass in the user's auth token as a variable called 'state' when linking to this provider
				// Defaults to true for Google and LinkedIn, but you can enable it for other providers if needed
				stateRequired?: boolean
			}
		}
		// Anything here will be merged with the userModel that validates your local sign-up form.
		// See [Sofa Model documentation](http://github.com/colinskow/sofa-model) for details.
		userModel: {
			// For example, this will require each new user to specify a valid age on the sign-up form or registration will fail
			whitelist?: string[]
			validate?: {
				age?: {
					presence?: boolean
					numericality?: {
						onlyInteger?: boolean
						greaterThanOrEqualTo?: number
						lessThan?: number
						message?: string
					}
				}
			}
		}
	}

	interface IUserConfig {
		testMode?: IConfiguration['testMode']
		security?: Partial<IConfiguration['security']>
		local?: Partial<IConfiguration['local']>
		dbServer?: Partial<IConfiguration['dbServer']>
		session?: Partial<IConfiguration['session']>
		mailer?: IConfiguration['mailer']
		emails?: IConfiguration['emails']
		userDBs?: IConfiguration['userDBs']
		providers?: IConfiguration['providers']
		userModel?: IConfiguration['userModel']
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
