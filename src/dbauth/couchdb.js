const util = require('../util')

function couchdb(couchAuthDB) {
	const putSecurityCouch = (db, doc) =>
		db.request({
			method: 'PUT',
			url: '_security',
			body: doc
		})
	this.storeKey = (username, key, password, expires, roles) => {
		if (roles instanceof Array) {
			// Clone roles to not overwrite original
			roles = roles.slice(0)
		} else {
			roles = []
		}
		roles.unshift(`user:${username}`)
		const newKey = {
			_id: `org.couchdb.user:${key}`,
			type: 'user',
			name: key,
			user_id: username,
			password,
			expires,
			roles
		}
		return couchAuthDB.upsert(newKey._id, () => newKey).then(() => {
			newKey._id = key
			return Promise.resolve(newKey)
		})
	}

	this.removeKeys = keys => {
		keys = util.toArray(keys)
		const keylist = []
		// Transform the list to contain the CouchDB _user ids
		keys.forEach(key => {
			keylist.push(`org.couchdb.user:${key}`)
		})
		const toDelete = []
		return couchAuthDB.allDocs({ keys: keylist }).then(keyDocs => {
			keyDocs.rows.forEach(row => {
				if (!row.error && !row.value.deleted) {
					const deletion = {
						_id: row.id,
						_rev: row.value.rev,
						_deleted: true
					}
					toDelete.push(deletion)
				}
			})
			if (toDelete.length) {
				return couchAuthDB.bulkDocs(toDelete)
			}
			return Promise.resolve(false)
		})
	}

	this.initSecurity = (db, adminRoles, memberRoles) => {
		let changes = false
		return db.get('_security').then(secDoc => {
			if (!secDoc.admins) {
				secDoc.admins = { names: [], roles: [] }
			}
			if (!secDoc.admins.roles) {
				secDoc.admins.roles = []
			}
			if (!secDoc.members) {
				secDoc.members = { names: [], roles: [] }
			}
			if (!secDoc.members.roles) {
				secDoc.admins.roles = []
			}
			adminRoles.forEach(role => {
				if (secDoc.admins.roles.indexOf(role) === -1) {
					changes = true
					secDoc.admins.roles.push(role)
				}
			})
			memberRoles.forEach(role => {
				if (secDoc.members.roles.indexOf(role) === -1) {
					changes = true
					secDoc.members.roles.push(role)
				}
			})
			if (changes) {
				return putSecurityCouch(db, secDoc)
			}
			return Promise.resolve(false)
		})
	}

	this.authorizeKeys = (user_id, db, keys) => {
		let secDoc
		// Check if keys is an object and convert it to an array
		if (typeof keys === 'object' && !(keys instanceof Array)) {
			const keysArr = []
			Object.keys(keys).forEach(theKey => {
				keysArr.push(theKey)
			})
			keys = keysArr
		}
		// Convert keys to an array if it is just a string
		keys = util.toArray(keys)
		return db.get('_security').then(doc => {
			secDoc = doc
			if (!secDoc.members) {
				secDoc.members = { names: [], roles: [] }
			}
			if (!secDoc.members.names) {
				secDoc.members.names = []
			}
			let changes = false
			keys.forEach(key => {
				const index = secDoc.members.names.indexOf(key)
				if (index === -1) {
					secDoc.members.names.push(key)
					changes = true
				}
			})
			if (changes) {
				return putSecurityCouch(db, secDoc)
			}
			return Promise.resolve(false)
		})
	}

	this.deauthorizeKeys = async (db, keys) => {
		let secDoc
		keys = util.toArray(keys)
		try {
			const doc = await db.get('_security')
			secDoc = doc
			if (!secDoc.members || !secDoc.members.names) {
				return Promise.resolve(false)
			}
			let changes = false
			keys.forEach(key => {
				const index = secDoc.members.names.indexOf(key)
				if (index > -1) {
					secDoc.members.names.splice(index, 1)
					changes = true
				}
			})
			if (changes) {
				return await putSecurityCouch(db, secDoc)
			}
			return Promise.resolve(false)
		} catch (error) {
			console.log('error deauthorizing keys!', error)
			return Promise.resolve(false)
		}
	}

	return this
}

export default couchdb
