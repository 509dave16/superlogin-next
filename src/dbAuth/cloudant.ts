const url = require('url')
const BPromise = require('bluebird')
const request = require('superagent')
const util = require('./../util')

const getSecurityUrl = (db: { name: string }) => {
	const parsedUrl = url.parse(db.name)
	parsedUrl.pathname += '/_security'
	return url.format(parsedUrl)
}

export const getAPIKey = (db: { name: string }) => {
	const parsedUrl = url.parse(db.name)
	parsedUrl.pathname = '/_api/v2/api_keys'
	const finalUrl = url.format(parsedUrl)
	return BPromise.fromNode((callback: () => void) => {
		request
			.post(finalUrl)
			//       .set(db.getHeaders())
			.end(callback)
	}).then((res: { text: string }) => {
		const result = JSON.parse(res.text)
		if (result.key && result.password && result.ok === true) {
			return Promise.resolve(result)
		}
		return Promise.reject(result)
	})
}

export const getSecurityCloudant = (db: { name: string }) => {
	const finalUrl = getSecurityUrl(db)
	return BPromise.fromNode((callback: () => void) => {
		request
			.get(finalUrl)
			//       .set(db.getHeaders())
			.end(callback)
	}).then((res: { text: string }) => Promise.resolve(JSON.parse(res.text)))
}

export const putSecurityCloudant = (db: { name: string }, doc: {}) => {
	const finalUrl = getSecurityUrl(db)
	return BPromise.fromNode((callback: () => void) => {
		request
			.put(finalUrl)
			//       .set(db.getHeaders())
			.send(doc)
			.end(callback)
	}).then((res: { text: string }) => Promise.resolve(JSON.parse(res.text)))
}

// This is not needed with Cloudant
export const storeKey = () => Promise.resolve()

// This is not needed with Cloudant
export const removeKeys = () => Promise.resolve()

export const initSecurity = (
	db: {
		name: string
		get: (schema: string) => Promise<ISecurityDoc>
	},
	adminRoles: string[],
	memberRoles: string[]
) => {
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
		adminRoles.forEach((role: string) => {
			if (secDoc.admins.roles.indexOf(role) === -1) {
				changes = true
				secDoc.admins.roles.push(role)
			}
		})
		memberRoles.forEach((role: string) => {
			if (secDoc.members.roles.indexOf(role) === -1) {
				changes = true
				secDoc.members.roles.push(role)
			}
		})
		if (changes) {
			return putSecurityCloudant(db, secDoc)
		}
		return Promise.resolve(false)
	})
}

export const authorizeKeys = (
	user_id: string,
	db: { name: string },
	keys: string[],
	permissions: string[],
	roles: string[]
) => {
	let keysObj = {}
	if (!permissions) {
		permissions = ['_reader', '_replicator']
	}
	permissions = permissions.concat(roles || [])
	permissions.unshift(`user:${user_id}`)
	// If keys is a single value convert it to an Array
	keys = util.toArray(keys)
	// Check if keys is an array and convert it to an object
	if (keys instanceof Array) {
		keys.forEach(key => {
			keysObj[key] = permissions
		})
	} else {
		keysObj = keys
	}
	// Pull the current _security doc
	return getSecurityCloudant(db).then((secDoc: { _id: string; cloudant: {} }) => {
		if (!secDoc._id) {
			secDoc._id = '_security'
		}
		if (!secDoc.cloudant) {
			secDoc.cloudant = {}
		}
		Object.keys(keysObj).forEach(key => (secDoc.cloudant[key] = keysObj[key]))
		return putSecurityCloudant(db, secDoc)
	})
}

export const deauthorizeKeys = (db: { name: string }, keys: string[]) => {
	// cast keys to an Array
	keys = util.toArray(keys)
	return getSecurityCloudant(db).then((secDoc: { cloudant: {} }) => {
		let changes = false
		if (!secDoc.cloudant) {
			return Promise.resolve(false)
		}
		keys.forEach(key => {
			if (secDoc.cloudant[key]) {
				changes = true
				delete secDoc.cloudant[key]
			}
		})
		if (changes) {
			return putSecurityCloudant(db, secDoc)
		}
		return Promise.resolve(false)
	})
}

export default {
	getAPIKey,
	getSecurityCloudant,
	putSecurityCloudant,
	storeKey,
	removeKeys,
	initSecurity,
	authorizeKeys,
	deauthorizeKeys
}
