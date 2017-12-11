const MemoryAdapter = (): IAdapter => {
	let _keys = {}
	let _expires = {}
	console.log('Memory Adapter loaded')

	const storeKey = (key: string, life: number, data: {}) => {
		const now = Date.now()
		_keys[key] = data
		_expires[key] = now + life
		_removeExpired()
		return Promise.resolve()
	}

	const getKey = (key: string) => {
		const now = Date.now()
		if (_keys[key] && _expires[key] > now) {
			return Promise.resolve(_keys[key])
		}
		return Promise.resolve(false)
	}

	const deleteKeys = (keys: string[]) => {
		if (!(keys instanceof Array)) {
			keys = [keys]
		}
		keys.forEach(key => {
			delete _keys[key]
			delete _expires[key]
		})
		_removeExpired()
		return Promise.resolve(keys.length)
	}

	const quit = () => {
		return Promise.resolve()
	}

	const _removeExpired = () => {
		const now = Date.now()
		Object.keys(_expires).forEach(key => {
			if (_expires[key] < now) {
				delete _keys[key]
				delete _expires[key]
			}
		})
	}

	return {
		storeKey,
		getKey,
		deleteKeys,
		quit,
		_removeExpired
	}
}

export default MemoryAdapter
