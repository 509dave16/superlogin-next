const BPromise = require('bluebird')
const redis = BPromise.promisifyAll(require('redis'))

const RedisAdapter = config => {
	let redisClient

	if (!config.getItem('session.redis.unix_socket')) {
		if (config.getItem('session.redis.url')) {
			redisClient = redis.createClient(
				config.getItem('session.redis.url'),
				config.getItem('session.redis.options')
			)
		} else {
			redisClient = redis.createClient(
				config.getItem('session.redis.port') || 6379,
				config.getItem('session.redis.host') || '127.0.0.1',
				config.getItem('session.redis.options')
			)
		}
	} else {
		redisClient = redis.createClient(
			config.getItem('session.redis.unix_socket'),
			config.getItem('session.redis.options')
		)
	}

	// Authenticate with Redis if necessary
	if (config.getItem('session.redis.password')) {
		redisClient.authAsync(config.getItem('session.redis.password')).catch(err => {
			throw new Error(err)
		})
	}

	redisClient.on('error', err => {
		console.error(`Redis error: ${err}`)
	})

	redisClient.on('connect', () => {
		console.log('Redis is ready')
	})
	this._redisClient = redisClient
}

export default RedisAdapter

RedisAdapter.prototype.storeKey = function storeKey(key, life, data) {
	return this._redisClient.psetexAsync(key, life, data)
}

RedisAdapter.prototype.deleteKeys = function deleteKeys(keys) {
	return this._redisClient.delAsync(keys)
}

RedisAdapter.prototype.getKey = function getKey(key) {
	return this._redisClient.getAsync(key)
}

RedisAdapter.prototype.quit = function quit() {
	return this._redisClient.quit()
}
