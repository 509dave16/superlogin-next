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
		confirmToken: async (keys: string | string[], password: string) => {
			const entries: string[] = []
			if (!Array.isArray(keys)) {
				keys = [keys]
			}
			keys.forEach(key => entries.push(`${tokenPrefix}:${key}`))
			return adapter.deleteKeys(entries)
		},
		deleteTokens: async (keys: string | string[]) => {
			const entries: string[] = []
			if (!Array.isArray(keys)) {
				keys = [keys]
			}
			keys.forEach(key => entries.push(`${tokenPrefix}:${key}`))
			return adapter.deleteKeys(entries)
		},
		fetchToken: async (key: string) =>
			adapter.getKey(`${tokenPrefix}:${key}`).then(result => JSON.parse(result)),
		storeToken: async (token: ISession) => {
			if (!token.password && token.salt && token.derived_key) {
				await adapter.storeKey(
					`${tokenPrefix}:${token.key}`,
					token.expires - Date.now(),
					JSON.stringify(token)
				)
				delete token.salt
				delete token.derived_key
			}
			const hash = await util.hashPassword(token.password)

			token.salt = hash.salt
			token.derived_key = hash.derived_key
			delete token.password
			await adapter.storeKey(
				`${tokenPrefix}:${token.key}`,
				token.expires - Date.now(),
				JSON.stringify(token)
			)

			delete token.salt
			delete token.derived_key
			return Promise.resolve(token)
		},
		quit: async () => adapter.quit()
	}
}

export default Session
