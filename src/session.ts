// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird')

import FileAdapter from './sessionAdapters/FileAdapter'
import MemoryAdapter from './sessionAdapters/MemoryAdapter'
import RedisAdapter from './sessionAdapters/RedisAdapter'
import util from './util'

const tokenPrefix = 'token'

const Session = (config: IConfigure) => {
	let adapter: IAdapter
	const sessionAdapter = config.getItem('session.adapter')
	if (sessionAdapter === 'redis') {
		adapter = RedisAdapter(config)
	} else if (sessionAdapter === 'file') {
		adapter = FileAdapter(config)
	} else {
		adapter = MemoryAdapter()
	}

	return {
		confirmToken: async (key: string, password: string) => {
			let token
			try {
				const result = await adapter.getKey(`${tokenPrefix}:${key}`)
				if (!result) {
					return Promise.reject('invalid token')
				}
				token = JSON.parse(result)
				await util.verifyPassword(token, password)

				delete token.salt
				delete token.derived_key
				return token
			} catch (error) {
				console.log('confirm token error', error)
				return Promise.reject('invalid token')
			}
		},
		deleteTokens: async (keys: string | string[]) => {
			if (!Array.isArray(keys)) {
				keys = [keys]
			}
			return adapter.deleteKeys(keys.map(key => `${tokenPrefix}:${key}`))
		},
		fetchToken: async (key: string) =>
			adapter.getKey(`${tokenPrefix}:${key}`).then(result => JSON.parse(result)),
		storeToken: async (token: ISession) => {
			const finalToken = Object.assign({}, token)
			try {
				if (!finalToken.password && finalToken.salt && finalToken.derived_key) {
					await adapter.storeKey(
						`${tokenPrefix}:${finalToken.key}`,
						finalToken.expires - Date.now(),
						JSON.stringify(finalToken)
					)
					delete finalToken.salt
					delete finalToken.derived_key
					return finalToken
				}
				const hash = await util.hashPassword(finalToken.password)

				finalToken.salt = hash.salt
				finalToken.derived_key = hash.derived_key
				delete finalToken.password
				await adapter.storeKey(
					`${tokenPrefix}:${finalToken.key}`,
					finalToken.expires - Date.now(),
					JSON.stringify(finalToken)
				)

				delete finalToken.salt
				delete finalToken.derived_key
				return finalToken
			} catch (error) {
				console.log('error storing token', error)
				return undefined
			}
		},
		quit: async () => adapter.quit()
	}
}

export default Session
