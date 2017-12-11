const BPromise = require('bluebird')
const PouchDB = require('pouchdb-node')
const util = require('./../util')
const seed = require('pouchdb-seed-design')
const request = require('superagent')
const CloudantAdapter = require('./cloudant')
const CouchAdapter = require('./couchdb')

// Escapes any characters that are illegal in a CouchDB database name using percent codes inside parenthesis
// Example: 'My.name@example.com' => 'my(2e)name(40)example(2e)com'
const getLegalDBName = input => {
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

function dbauth(config, userDB, couchAuthDB) {
	const cloudant = config.getItem('dbServer.cloudant')

	let adapter

	if (cloudant) {
		adapter = CloudantAdapter
	} else {
		adapter = new CouchAdapter(couchAuthDB)
	}

	const storeKey = (username, key, password, expires, roles) =>
		adapter.storeKey(username, key, password, expires, roles)

	const removeKeys = keys => adapter.removeKeys(keys)

	const authorizeKeys = (user_id, db, keys, permissions, roles) =>
		adapter.authorizeKeys(user_id, db, keys, permissions, roles)

	const deauthorizeKeys = (db, keys) => adapter.deauthorizeKeys(db, keys)

	const deauthorizeUser = async (userDoc, keys) => {
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
						await deauthorizeKeys(db, keys)
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

	this.storeKey = storeKey
	this.removeKeys = removeKeys
	this.authorizeKeys = authorizeKeys
	this.deauthorizeKeys = deauthorizeKeys

	this.authorizeUserSessions = (user_id, personalDBs, sessionKeys, roles) => {
		const self = this
		const promises = []
		sessionKeys = util.toArray(sessionKeys)
		Object.keys(personalDBs).forEach(personalDB => {
			let { permissions } = personalDBs[personalDB]
			if (!permissions) {
				permissions =
					config.getItem(`userDBs.model.${personalDBs[personalDB].name}.permissions`) ||
					config.getItem('userDBs.model._default.permissions') ||
					[]
			}
			const db = new PouchDB(`${util.getDBURL(config.getItem('dbServer'))}/${personalDB}`, {
				skip_setup: true
			})
			promises.push(self.authorizeKeys(user_id, db, sessionKeys, permissions, roles))
		})
		return Promise.all(promises)
	}

	this.addUserDB = (userDoc, dbName, designDocs, type, permissions, adminRoles, memberRoles) => {
		const self = this
		const promises = []
		adminRoles = adminRoles || []
		memberRoles = memberRoles || []
		// Create and the database and seed it if a designDoc is specified
		const prefix = config.getItem('userDBs.privatePrefix')
			? `${config.getItem('userDBs.privatePrefix')}_`
			: ''
		let finalDBName
		let newDB
		// Make sure we have a legal database name
		let username = userDoc._id
		username = getLegalDBName(username)
		if (type === 'shared') {
			finalDBName = dbName
		} else {
			finalDBName = `${prefix + dbName}$${username}`
		}
		return self
			.createDB(finalDBName)
			.then(() => {
				newDB = new PouchDB(`${util.getDBURL(config.getItem('dbServer'))}/${finalDBName}`)
				return adapter.initSecurity(newDB, adminRoles, memberRoles)
			})
			.then(() => {
				// Seed the design docs
				if (designDocs && designDocs instanceof Array) {
					designDocs.forEach(ddName => {
						const dDoc = self.getDesignDoc(ddName)
						if (dDoc) {
							promises.push(seed(newDB, dDoc))
						} else {
							console.warn(`Failed to locate design doc: ${ddName}`)
						}
					})
				}
				// Authorize the user's existing DB keys to access the new database
				const keysToAuthorize = []
				if (userDoc.session) {
					Object.keys(userDoc.session).forEach(key => {
						if (userDoc.session[key].expires > Date.now()) {
							keysToAuthorize.push(key)
						}
					})
				}
				if (keysToAuthorize.length > 0) {
					promises.push(
						authorizeKeys(userDoc._id, newDB, keysToAuthorize, permissions, userDoc.roles)
					)
				}
				return Promise.all(promises)
			})
			.then(() => Promise.resolve(finalDBName))
	}

	this.removeExpiredKeys = () => {
		const keysByUser = {}
		const userDocs = {}
		const expiredKeys = []
		// query a list of expired keys by user
		return userDB
			.query('auth/expiredKeys', { endkey: Date.now(), include_docs: true })
			.then(results => {
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
						Object.keys(userDocs[row.value.user].session).forEach(session => {
							if (row.value.key === session) {
								delete userDocs[row.value.user].session[session]
							}
						})
					}
				})
				return removeKeys(expiredKeys)
			})
			.then(() => {
				// - deauthorize keys for each personal database of each user
				const deauthorize = []
				Object.keys(keysByUser).forEach(user => {
					deauthorize.push(deauthorizeUser(userDocs[user], keysByUser[user]))
				})
				return Promise.all(deauthorize)
			})
			.then(() => {
				const userUpdates = []
				Object.keys(userDocs).forEach(user => {
					userUpdates.push(userDocs[user])
				})
				// Bulk save user doc updates
				return userDB.bulkDocs(userUpdates)
			})
			.then(() => Promise.resolve(expiredKeys))
	}

	this.deauthorizeUser = deauthorizeUser

	this.getDesignDoc = docName => {
		if (!docName) {
			return null
		}
		let designDoc
		let designDocDir = config.getItem('userDBs.designDocDir')
		if (!designDocDir) {
			designDocDir = __dirname
		}
		try {
			// eslint-disable-next-line
			designDoc = require(`${designDocDir}/${docName}`)
		} catch (err) {
			console.warn(`Design doc: ${designDocDir}/${docName} not found.`)
			designDoc = null
		}
		return designDoc
	}

	this.getDBConfig = (dbName, type) => {
		const dbConfig = {
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
			if (dbAdminRoles && dbAdminRoles instanceof Array) {
				dbAdminRoles.forEach(role => {
					if (role && dbConfig.adminRoles.indexOf(role) === -1) {
						dbConfig.adminRoles.push(role)
					}
				})
			}
			if (dbMemberRoles && dbMemberRoles instanceof Array) {
				dbMemberRoles.forEach(role => {
					if (role && dbConfig.memberRoles.indexOf(role) === -1) {
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

	this.createDB = dbName => {
		const finalUrl = `${util.getDBURL(config.getItem('dbServer'))}/${dbName}`
		return BPromise.fromNode(callback => {
			request
				.put(finalUrl)
				.send({})
				.end(callback)
		}).then(
			res => Promise.resolve(JSON.parse(res.text)),
			err => {
				if (err.status === 412) {
					return Promise.resolve(false)
				}
				return Promise.reject(err.text)
			}
		)
	}

	this.removeDB = async dbName => {
		try {
			const db = new PouchDB(`${util.getDBURL(config.getItem('dbServer'))}/${dbName}`, {
				skip_setup: true
			})
			await db.destroy()
			return Promise.resolve()
		} catch (error) {
			console.log('remove db failed!', dbName, error)
			return Promise.reject()
		}
	}

	return this
}

export default dbauth
