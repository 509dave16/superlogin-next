// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird')

import util from '../util'

const couchdb = (couchAuthDB: PouchDB.Database): IDBAdapter => {
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

	const removeKeys = async (keys: string | string[]) => {
		keys = util.toArray(keys)
		// Transform the list to contain the CouchDB _user ids
		const keylist: string[] = keys.map(key => `org.couchdb.user:${key}`)
		const toDelete: {
			_id: string
			_rev: string
			_deleted: boolean
		}[] = []
		try {
			// tslint:disable-next-line:no-any
			const keyDocs: any = await couchAuthDB.allDocs({ keys: keylist })
			keyDocs.rows.forEach(
				(row: { id: string; error: string; value: { rev: string; _deleted: boolean } }) => {
					if (!row.error && (!row.value || !row.value._deleted)) {
						const deletion = {
							_id: row.id,
							_rev: row.value.rev,
							_deleted: true
						}
						toDelete.push(deletion)
					}
				}
			)
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
		try {
			console.log(' initSecurity', adminRoles, memberRoles)
			const security = db.security()
			await security.fetch()

			security.members.roles.add(memberRoles)
			security.admins.roles.add(adminRoles)
			return security.save()
		} catch (error) {
			console.log('error initializing security', error)
			return Promise.resolve(false)
		}
	}

	const authorizeKeys = async (
		user_id: string,
		db: PouchDB.Database & { name: string },
		keys: string[] | string
	) => {
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
		try {
			console.log('authorizeKeys', keys)
			const security = db.security()
			await security.fetch()

			security.members.names.add(keys)
			return security.save()
		} catch (error) {
			console.log('error authorizing keys', error)
			return Promise.resolve(false)
		}
	}

	const deauthorizeKeys = async (
		db: PouchDB.Database & { name: string },
		keys: string[] | string
	) => {
		keys = util.toArray(keys)
		try {
			console.log('deauthorizeKeys', keys)
			const security = db.security()
			await security.fetch()

			security.members.names.remove(keys)
			return security.save()
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
		initSecurity(db: {}, adminRoles: string[], memberRoles: string[]): Promise<void | boolean>
		authorizeKeys(
			user_id: string,
			db: PouchDB.Database & { name: string },
			keys: string[] | string,
			permissions?: string[],
			roles?: string[]
		): Promise<void | boolean>
		deauthorizeKeys(
			db: PouchDB.Database & { name: string },
			keys: string[] | string
		): Promise<void | boolean>
		removeKeys(keys: string[] | string): Promise<boolean | PouchDB.Core.Response[]>
		storeKey(
			username: string,
			key: string,
			password: string,
			expires?: number,
			roles?: string[]
		): Promise<{
			_id: string
			type: string
			name: string
			user_id: string
			password: string
			expires: number
			roles: string[]
		}>
	}
}

export default couchdb
