import util from '../util'

const couchdb = (couchAuthDB: PouchDB.Database): IDBAdapter => {
	// tslint:disable-next-line:no-any
	const putSecurityCouch = (db: any, doc: {}) =>
		db.request({
			method: 'PUT',
			url: '_security',
			body: doc
		})

	const storeKey = async (
		username: string,
		key: string,
		password: string,
		expires: number,
		roles: string[]
	) => {
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
		await couchAuthDB.upsert(newKey._id, () => newKey)
		newKey._id = key
		return newKey
	}

	const removeKeys = async (keys: string[]) => {
		keys = util.toArray(keys)
		const keylist: string[] = []
		// Transform the list to contain the CouchDB _user ids
		keys.forEach(key => {
			keylist.push(`org.couchdb.user:${key}`)
		})
		const toDelete: {
			_id: string
			_rev: string
			_deleted: boolean
		}[] = []
		try {
			const keyDocs = await couchAuthDB.allDocs({ keys: keylist })
			keyDocs.rows.forEach(row => {
				if (!row.value.deleted) {
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
		} catch (error) {
			console.log('error removing keys!', error)
			return Promise.resolve(false)
		}
	}

	const initSecurity = async (
		db: PouchDB.Database & { name: string },
		adminRoles: string[],
		memberRoles: string[]
	) => {
		let changes = false
		const secDoc = await db.get<ISecurityDoc>('_security')

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
	}

	const authorizeKeys = async (
		user_id: string,
		db: PouchDB.Database & { name: string },
		keys: string[] | string
	) => {
		let secDoc: ISecurityDoc
		// Check if keys is an object and convert it to an array
		if (typeof keys === 'object' && !Array.isArray(keys)) {
			const keysArr: string[] = []
			Object.keys(keys).forEach(theKey => {
				keysArr.push(theKey)
			})
			keys = keysArr
		}
		if (!Array.isArray(keys)) {
			// Convert keys to an array if it is just a string
			keys = util.toArray(keys)
		}
		const doc = await db.get<ISecurityDoc>('_security')

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
	}

	const deauthorizeKeys = async (
		db: PouchDB.Database & { name: string },
		keys: string[] | string
	) => {
		let secDoc: ISecurityDoc
		keys = util.toArray(keys)
		try {
			const doc = await db.get<ISecurityDoc>('_security')
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

	return {
		initSecurity,
		authorizeKeys,
		deauthorizeKeys,
		removeKeys,
		storeKey
	}
}

declare global {
	interface IDBAdapter {
		initSecurity(db: {}, adminRoles: string[], memberRoles: string[]): void
		authorizeKeys(
			user_id: string,
			db: PouchDB.Database & { name: string },
			keys: string[] | string,
			permissions?: string[],
			roles?: string[]
		): void
		deauthorizeKeys(db: PouchDB.Database & { name: string }, keys: string[] | string): void
		removeKeys(keys: string[] | string): void
		storeKey(
			username: string,
			key: string,
			password: string,
			expires?: number,
			roles?: string[]
		): void
	}
}

export default couchdb
