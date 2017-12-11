const BPromise = require('bluebird')
const URLSafeBase64 = require('urlsafe-base64')
const uuid = require('uuid')
const pwd = require('couch-pwd')
const crypto = require('crypto')

export const URLSafeUUID = () => URLSafeBase64.encode(uuid.v4(null, Buffer.from(16)))

export const hashToken = token =>
	crypto
		.createHash('sha256')
		.update(token)
		.digest('hex')

export const hashPassword = password =>
	new Promise((resolve, reject) => {
		pwd.hash(password, (err, salt, hash) => {
			if (err) {
				return reject(err)
			}
			return resolve({
				salt,
				derivedKey: hash
			})
		})
	})

export const verifyPassword = (hashObj, password) => {
	const getHash = BPromise.Promisify(pwd.hash, { context: pwd })
	const { iterations, salt, derivedKey } = hashObj
	if (iterations) {
		pwd.iterations(iterations)
	}
	if (!salt || !derivedKey) {
		return Promise.reject(false)
	}
	return getHash(password, salt).then(hash => {
		if (hash === derivedKey) {
			return Promise.resolve(true)
		}
		return Promise.reject(false)
	})
}

export const getDBURL = db => {
	let url
	if (db.user) {
		url = `${db.protocol + encodeURIComponent(db.user)}:${encodeURIComponent(db.password)}@${
			db.host
		}`
	} else {
		url = db.protocol + db.host
	}
	return url
}

export const getFullDBURL = (dbConfig, dbName) => `${getDBURL(dbConfig)}/${dbName}`

export const toArray = obj => {
	if (!(obj instanceof Array)) {
		obj = [obj]
	}
	return obj
}

export const getSessions = userDoc => {
	const sessions = []
	if (userDoc.session) {
		Object.keys(userDoc.session).forEach(mySession => {
			sessions.push(mySession)
		})
	}
	return sessions
}

export const getExpiredSessions = (userDoc, now) => {
	const sessions = []
	if (userDoc.session) {
		Object.keys(userDoc.session).forEach(mySession => {
			if (userDoc.session[mySession].expires <= now) {
				sessions.push(mySession)
			}
		})
	}
	return sessions
}

// Takes a req object and returns the bearer token, or undefined if it is not found
export const getSessionToken = req => {
	if (req.headers && req.headers.authorization) {
		const parts = req.headers.authorization.split(' ')
		if (parts.length === 2) {
			const scheme = parts[0]
			const credentials = parts[1]
			if (/^Bearer$/i.test(scheme)) {
				const parse = credentials.split(':')
				if (parse.length < 2) {
					return undefined
				}
				return parse[0]
			}
		}
	}
	return undefined
}

// Generates views for each registered provider in the user design doc
export const addProvidersToDesignDoc = (config, ddoc) => {
	const providers = config.getItem('providers')
	if (!providers) {
		return ddoc
	}
	const ddocTemplate =
		'function(doc) => {\n' +
		'  if(doc.%PROVIDER% && doc.%PROVIDER%.profile) => {\n' +
		'    emit(doc.%PROVIDER%.profile.id, null);\n' +
		'  }\n' +
		'}'
	Object.keys(providers).forEach(provider => {
		ddoc.auth.views[provider] = ddocTemplate.replace(new RegExp('%PROVIDER%', 'g'), provider)
	})
	return ddoc
}

// Capitalizes the first letter of a string
export const capitalizeFirstLetter = string => string.charAt(0).toUpperCase() + string.slice(1)

/**
 * Access nested JavaScript objects with string key
 * http://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-with-string-key
 *
 * @param {object} obj The base object you want to get a reference to
 * @param {string} str The string addressing the part of the object you want
 * @return {object|undefined} a reference to the requested key or undefined if not found
 */

export const getObjectRef = (obj, str) => {
	str = str.replace(/\[(\w+)\]/g, '.$1') // convert indexes to properties
	str = str.replace(/^\./, '') // strip a leading dot
	const pList = str.split('.')
	while (pList.length) {
		const n = pList.shift()
		if (n in obj) {
			obj = obj[n]
		} else {
			return undefined
		}
	}
	return obj
}

/**
 * Dynamically set property of nested object
 * http://stackoverflow.com/questions/18936915/dynamically-set-property-of-nested-object
 *
 * @param {object} obj The base object you want to set the property in
 * @param {string} str The string addressing the part of the object you want
 * @param {*} val The value you want to set the property to
 * @return {*} the value the reference was set to
 */

export const setObjectRef = (obj, str, val) => {
	str = str.replace(/\[(\w+)\]/g, '.$1') // convert indexes to properties
	str = str.replace(/^\./, '') // strip a leading dot
	const pList = str.split('.')
	const len = pList.length
	for (let i = 0; i < len - 1; i += 1) {
		const elem = pList[i]
		if (!obj[elem]) {
			obj[elem] = {}
		}
		obj = obj[elem]
	}
	obj[pList[len - 1]] = val
	return val
}

/**
 * Dynamically delete property of nested object
 *
 * @param {object} obj The base object you want to set the property in
 * @param {string} str The string addressing the part of the object you want
 * @return {boolean} true if successful
 */

export const delObjectRef = (obj, str) => {
	str = str.replace(/\[(\w+)\]/g, '.$1') // convert indexes to properties
	str = str.replace(/^\./, '') // strip a leading dot
	const pList = str.split('.')
	const len = pList.length
	pList.forEach(elem => {
		if (obj[elem]) {
			obj = obj[elem]
		}
	})
	delete obj[pList[len - 1]]
	return true
}

/**
 * Concatenates two arrays and removes duplicate elements
 *
 * @param {array} a First array
 * @param {array} b Second array
 * @return {array} resulting array
 */

export const arrayUnion = (a, b) => {
	const result = a.concat(b)
	for (let i = 0; i < result.length; i += 1) {
		for (let j = i + 1; j < result.length; j += 1) {
			if (result[i] === result[j]) result.splice((j -= 1), 1)
		}
	}
	return result
}
