const util = require('./util')
const extend = require('util')._extend
const RedisAdapter = require('./sessionAdapters/RedisAdapter')
const MemoryAdapter = require('./sessionAdapters/MemoryAdapter')
const FileAdapter = require('./sessionAdapters/FileAdapter')

const tokenPrefix = 'token'

function Session(config) {
	let adapter
	const sessionAdapter = config.getItem('session.adapter')
	if (sessionAdapter === 'redis') {
		adapter = new RedisAdapter(config)
	} else if (sessionAdapter === 'file') {
		adapter = new FileAdapter(config)
	} else {
		adapter = new MemoryAdapter()
	}
	this._adapter = adapter
}

module.exports = Session

Session.prototype.storeToken = function storeToken(token) {
	const self = this
	token = extend({}, token)
	if (!token.password && token.salt && token.derived_key) {
		return this._adapter
			.storeKey(`${tokenPrefix}:${token.key}`, token.expires - Date.now(), JSON.stringify(token))
			.then(() => {
				delete token.salt
				delete token.derived_key
				return Promise.resolve(token)
			})
	}
	return util
		.hashPassword(token.password)
		.then(hash => {
			token.salt = hash.salt
			token.derived_key = hash.derived_key
			delete token.password
			return self._adapter.storeKey(
				`${tokenPrefix}:${token.key}`,
				token.expires - Date.now(),
				JSON.stringify(token)
			)
		})
		.then(() => {
			delete token.salt
			delete token.derived_key
			return Promise.resolve(token)
		})
}

Session.prototype.deleteTokens = function deleteTokens(keys) {
	const entries = []
	if (!(keys instanceof Array)) {
		keys = [keys]
	}
	keys.forEach(key => {
		entries.push(`${tokenPrefix}:${key}`)
	})
	return this._adapter.deleteKeys(entries)
}

Session.prototype.confirmToken = function confirmToken(key, password) {
	let token
	return this._adapter
		.getKey(`${tokenPrefix}:${key}`)
		.then(result => {
			if (!result) {
				return Promise.reject('invalid token')
			}
			token = JSON.parse(result)
			return util.verifyPassword(token, password)
		})
		.then(
			() => {
				delete token.salt
				delete token.derived_key
				return Promise.resolve(token)
			},
			() => Promise.reject('invalid token')
		)
}

Session.prototype.fetchToken = function fetchToken(key) {
	return this._adapter
		.getKey(`${tokenPrefix}:${key}`)
		.then(result => Promise.resolve(JSON.parse(result)))
}

Session.prototype.quit = function quit() {
	return this._adapter.quit()
}
