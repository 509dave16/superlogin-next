import PouchDB from 'pouchdb-node'
import seed from 'pouchdb-seed-design'
import request from 'superagent'
import util from './../util'
import CloudantAdapter from './cloudant'
import CouchAdapter from './couchdb'

// Escapes any characters that are illegal in a CouchDB database name using percent codes inside parenthesis
// Example: 'My.name@example.com' => 'my(2e)name(40)example(2e)com'
const getLegalDBName = (input: string) => {
	input = input.toLowerCase()
	let output = encodeURIComponent(input)
	output = output.replace(/\./g, '%2E')
	output = output.replace(/!/g, '%21')
	output = output.replace(/~/g, '%7E')
	output = output.replace(/\*/g, '%2A')
	output = output.replace(/'/g, '%27')
	output = output.replace(/\(/g, '%28')
	output = output.replace(/\)/g, '%29')
	output = output.replace(/-/g, '%2D')
	output = output.toLowerCase()
	output = output.replace(/(%..)/g, esc => {
		esc = esc.substr(1)
		return `(${esc})`
	})
	return output
}

const dbauth = (
	config: IConfigure,
	userDB: PouchDB.Database & { name: string },
	couchAuthDB: PouchDB.Database
) => {
	const cloudant = config.getItem('dbServer.cloudant')

	let adapter: IDBAdapter

	if (cloudant) {
		adapter = CloudantAdapter
	} else {
		adapter = CouchAdapter(couchAuthDB)
	}

	const createDB = async (dbName: string) => {
		const finalUrl = `${util.getDBURL(config.getItem('dbServer'))}/${dbName}`
		try {
			const res = await request.put(finalUrl).send({})
			return JSON.parse(res.text)
		} catch (error) {
			return Promise.reject(error)
		}
	}

	const getDesignDoc = (docName: string) => {
		if (!docName) {
			return null
		}
		let designDoc
		let designDocDir = config.getItem('userDBs.designDocDir')
		if (!designDocDir) {
			designDocDir = __dirname
		}
		try {
			// tslint:disable-next-line:non-literal-require
			designDoc = require(`${designDocDir}/${docName}`)
		} catch (err) {
			console.warn(`Design doc: ${designDocDir}/${docName} not found.`)
			designDoc = null
		}
		return designDoc
	}

	const storeKey = (
		username: string,
		key: string,
		password: string,
		expires?: number,
		roles?: string[]
	) => adapter.storeKey(username, key, password, expires, roles)

	const removeKeys = (keys: string | string[]) => adapter.removeKeys(keys)

	// tslint:disable-next-line:no-any
	const authorizeKeys = (
		user_id: string,
		db: PouchDB.Database & { name: string },
		keys: string[],
		permissions?: string[],
		roles?: string[]
	) => adapter.authorizeKeys(user_id, db, keys, permissions, roles)

	// tslint:disable-next-line:no-any
	const deauthorizeKeys = (db: any, keys: string[] | string) => adapter.deauthorizeKeys(db, keys)

	const deauthorizeUser = async (userDoc: IUserDoc, keys: string[] | string) => {
		// If keys is not specified we will deauthorize all of the users sessions
		if (!keys) {
			keys = util.getSessions(userDoc)
		}
		keys = util.toArray(keys)
		if (userDoc.personalDBs && typeof userDoc.personalDBs === 'object') {
			return Promise.all(
				Object.keys(userDoc.personalDBs).map(async personalDB => {
					try {
						const db = new PouchDB(`${util.getDBURL(config.getItem('dbServer'))}/${personalDB}`, {
							skip_setup: true
						})
						deauthorizeKeys(db, keys)
						return Promise.resolve()
					} catch (error) {
						console.log('error deauthorizing db!', error)
						return Promise.resolve()
					}
				})
			)
		}
		return Promise.resolve(false)
	}

	const authorizeUserSessions = async (
		user_id: string,
		personalDBs: {},
		sessionKeys: string | string[],
		roles: string[]
	) => {
		sessionKeys = util.toArray(sessionKeys)
		return Promise.all(
			Object.keys(personalDBs).map(async personalDB => {
				let { permissions } = personalDBs[personalDB]
				if (!permissions) {
					permissions =
						config.getItem(`userDBs.model.${personalDBs[personalDB].name}.permissions`) ||
						config.getItem('userDBs.model._default.permissions') ||
						[]
				}
				const db = new PouchDB(`${util.getDBURL(config.getItem('dbServer'))}/${personalDB}`, {
					skip_setup: true
				}) as PouchDB.Database & { name: string }
				return authorizeKeys(user_id, db, sessionKeys as string[], permissions, roles)
			})
		)
	}

	const addUserDB = async (
		userDoc: IUserDoc,
		dbName: string,
		designDocs?: string[],
		type?: string,
		permissions?: string[],
		adminRoles?: string[],
		memberRoles?: string[]
	) => {
		adminRoles = adminRoles || []
		memberRoles = memberRoles || []
		// Create and the database and seed it if a designDoc is specified
		const prefix = config.getItem('userDBs.privatePrefix')
			? `${config.getItem('userDBs.privatePrefix')}_`
			: ''
		let finalDBName: string
		let newDB: PouchDB.Database & { name: string }
		// Make sure we have a legal database name
		let username = userDoc._id
		username = getLegalDBName(username)
		if (type === 'shared') {
			finalDBName = dbName
		} else {
			finalDBName = `${prefix + dbName}$${username}`
		}
		await createDB(finalDBName)
		newDB = new PouchDB(
			`${util.getDBURL(config.getItem('dbServer'))}/${finalDBName}`
		) as PouchDB.Database & { name: string }
		adapter.initSecurity(newDB, adminRoles, memberRoles)

		// Seed the design docs
		if (designDocs && Array.isArray(designDocs)) {
			await Promise.all(
				designDocs.map(async ddName => {
					const dDoc = getDesignDoc(ddName)
					if (dDoc) {
						await seed(newDB, dDoc)
					} else {
						console.warn(`Failed to locate design doc: ${ddName}`)
						return Promise.resolve()
					}
				})
			)
		}
		// Authorize the user's existing DB keys to access the new database
		const keysToAuthorize: string[] = []
		if (userDoc.session) {
			Object.keys(userDoc.session).forEach(key => {
				const { expires } = userDoc.session[key]
				if (expires && expires > Date.now()) {
					keysToAuthorize.push(key)
				}
			})
		}
		if (keysToAuthorize.length > 0) {
			authorizeKeys(userDoc._id, newDB, keysToAuthorize, permissions, userDoc.roles)
		}
		return finalDBName
	}

	const removeExpiredKeys = async () => {
		const keysByUser = {}
		const userDocs = {}
		const expiredKeys: string[] = []
		// query a list of expired keys by user
		const results = await userDB.query('auth/expiredKeys', {
			endkey: Date.now(),
			include_docs: true
		})
		// group by user
		results.rows.forEach(row => {
			keysByUser[row.value.user] = row.value.key
			expiredKeys.push(row.value.key)
			// Add the user doc if it doesn't already exist
			if (typeof userDocs[row.value.user] === 'undefined') {
				userDocs[row.value.user] = row.doc
			}
			// remove each key from user.session
			if (userDocs[row.value.user].session) {
				Object.keys(userDocs[row.value.user].session).forEach(
					session =>
						row.value.key === session ? delete userDocs[row.value.user].session[session] : undefined
				)
			}
		})
		await Promise.all(
			Object.keys(keysByUser).map(async user => deauthorizeUser(userDocs[user], keysByUser[user]))
		)
		// Bulk save user doc updates
		await userDB.bulkDocs(Object.values(userDocs))
		return expiredKeys
	}

	const getDBConfig = (dbName: string, type?: string) => {
		const dbConfig: {
			adminRoles?: string[]
			memberRoles?: string[]
			permissions?: string[]
			designDocs?: string[]
			type?: string
			name: string
		} = {
			name: dbName
		}
		dbConfig.adminRoles = config.getItem('userDBs.defaultSecurityRoles.admins') || []
		dbConfig.memberRoles = config.getItem('userDBs.defaultSecurityRoles.members') || []
		const dbConfigRef = `userDBs.model.${dbName}`
		if (config.getItem(dbConfigRef)) {
			dbConfig.permissions = config.getItem(`${dbConfigRef}.permissions`) || []
			dbConfig.designDocs = config.getItem(`${dbConfigRef}.designDocs`) || []
			dbConfig.type = type || config.getItem(`${dbConfigRef}.type`) || 'private'
			const dbAdminRoles = config.getItem(`${dbConfigRef}.adminRoles`)
			const dbMemberRoles = config.getItem(`${dbConfigRef}.memberRoles`)
			if (dbAdminRoles && Array.isArray(dbAdminRoles)) {
				dbAdminRoles.forEach(role => {
					if (role && dbConfig.adminRoles && dbConfig.adminRoles.indexOf(role) === -1) {
						dbConfig.adminRoles.push(role)
					}
				})
			}
			if (dbMemberRoles && dbMemberRoles instanceof Array) {
				dbMemberRoles.forEach(role => {
					if (role && dbConfig.memberRoles && dbConfig.memberRoles.indexOf(role) === -1) {
						dbConfig.memberRoles.push(role)
					}
				})
			}
		} else if (config.getItem('userDBs.model._default')) {
			dbConfig.permissions = config.getItem('userDBs.model._default.permissions') || []
			// Only add the default design doc to a private database
			if (!type || type === 'private') {
				dbConfig.designDocs = config.getItem('userDBs.model._default.designDocs') || []
			} else {
				dbConfig.designDocs = []
			}
			dbConfig.type = type || 'private'
		} else {
			dbConfig.type = type || 'private'
		}
		return dbConfig
	}

	const removeDB = async (dbName: string) => {
		try {
			const db = new PouchDB(`${util.getDBURL(config.getItem('dbServer'))}/${dbName}`, {
				skip_setup: true
			})
			await db.destroy()
			return Promise.resolve()
		} catch (error) {
			console.log('remove db failed!', dbName, error)
			return Promise.reject(error)
		}
	}

	return {
		removeDB,
		createDB,
		getDBConfig,
		getDesignDoc,
		removeExpiredKeys,
		addUserDB,
		authorizeUserSessions,
		authorizeKeys,
		deauthorizeKeys,
		deauthorizeUser,
		removeKeys,
		storeKey
	}
}

export default dbauth
