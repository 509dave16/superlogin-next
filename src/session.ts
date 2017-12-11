import util from './util'
import RedisAdapter from './sessionAdapters/RedisAdapter'
import MemoryAdapter from './sessionAdapters/MemoryAdapter'
import FileAdapter from './sessionAdapters/FileAdapter'

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
		confirmToken: (keys: string | string[], password: string) => {
			const entries: string[] = []
			if (!Array.isArray(keys)) {
				keys = [keys]
			}
			keys.forEach(key => entries.push(`${tokenPrefix}:${key}`))
			return adapter.deleteKeys(entries)
		},
		deleteTokens: (keys: string | string[]) => {
			const entries: string[] = []
			if (!Array.isArray(keys)) {
				keys = [keys]
			}
			keys.forEach(key => entries.push(`${tokenPrefix}:${key}`))
			return adapter.deleteKeys(entries)
		},
		fetchToken: (key: string) =>
			adapter.getKey(`${tokenPrefix}:${key}`).then(result => Promise.resolve(JSON.parse(result))),
		storeToken: (token: ISession) => {
			if (!token.password && token.salt && token.derived_key) {
				return adapter
					.storeKey(
						`${tokenPrefix}:${token.key}`,
						token.expires - Date.now(),
						JSON.stringify(token)
					)
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
					return adapter.storeKey(
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
		},
		quit: () => adapter.quit()
	}
}

export default Session

declare global {
	type Session = typeof Session
}
