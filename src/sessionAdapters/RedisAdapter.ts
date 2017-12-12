// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird')

import redisBase, { RedisClient } from 'redis'

const redis = Promise.promisifyAll(redisBase)

interface IPromRedis extends RedisClient {
	authAsync(pwd: string): Promise<void>
	psetexAsync(key: string, life: {}, data: {}): Promise<void>
	delAsync(keys: string[]): Promise<number>
	getAsync(pwd: string): Promise<string>
	// tslint:disable-next-line:no-any
	quit(): any
}

const RedisAdapter = (config: IConfigure): IAdapter => {
	const { redis: redisConfig } = config.get().session
	if (!redisConfig) {
		throw new Error('No redis configuration found')
	}

	const { unix_socket, url, port, host, options, password } = redisConfig

	const redisClient = unix_socket
		? (redis.createClient(unix_socket, options) as IPromRedis)
		: url
			? (redis.createClient(url, options) as IPromRedis)
			: (redis.createClient(port || 6379, host || '127.0.0.1', options) as IPromRedis)

	// Authenticate with Redis if necessary
	if (password) {
		redisClient.authAsync(password).catch((err: string) => {
			throw new Error(err)
		})
	}

	redisClient.on('error', (err: string) => console.error(`Redis error: ${err}`))

	redisClient.on('connect', () => console.log('Redis is ready'))

	const storeKey = async (key: string, life: {}, data: {}) =>
		redisClient.psetexAsync(key, life, data)

	const deleteKeys = async (keys: string[]) => redisClient.delAsync(keys)

	const getKey = async (key: string) => redisClient.getAsync(key)

	const quit = () => redisClient.quit()

	return {
		storeKey,
		deleteKeys,
		getKey,
		quit
	}
}

export default RedisAdapter
