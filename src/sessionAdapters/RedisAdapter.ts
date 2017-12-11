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
	let redisClient: IPromRedis

	if (!config.getItem('session.redis.unix_socket')) {
		if (config.getItem('session.redis.url')) {
			redisClient = redis.createClient(
				config.getItem('session.redis.url'),
				config.getItem('session.redis.options')
			) as IPromRedis
		} else {
			redisClient = redis.createClient(
				config.getItem('session.redis.port') || 6379,
				config.getItem('session.redis.host') || '127.0.0.1',
				config.getItem('session.redis.options')
			) as IPromRedis
		}
	} else {
		redisClient = redis.createClient(
			config.getItem('session.redis.unix_socket'),
			config.getItem('session.redis.options')
		) as IPromRedis
	}

	// Authenticate with Redis if necessary
	if (config.getItem('session.redis.password')) {
		redisClient.authAsync(config.getItem('session.redis.password')).catch((err: string) => {
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
