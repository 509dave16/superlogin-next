function MemoryAdapter() {
	this._keys = {}
	this._expires = {}
	console.log('Memory Adapter loaded')
}

module.exports = MemoryAdapter

MemoryAdapter.prototype.storeKey = function storeKey(key, life, data) {
	const now = Date.now()
	this._keys[key] = data
	this._expires[key] = now + life
	this._removeExpired()
	return Promise.resolve()
}

MemoryAdapter.prototype.getKey = function getKey(key) {
	const now = Date.now()
	if (this._keys[key] && this._expires[key] > now) {
		return Promise.resolve(this._keys[key])
	}
	return Promise.resolve(false)
}

MemoryAdapter.prototype.deleteKeys = function deleteKeys(keys) {
	if (!(keys instanceof Array)) {
		keys = [keys]
	}
	const self = this
	keys.forEach(key => {
		delete self._keys[key]
		delete self._expires[key]
	})
	this._removeExpired()
	return Promise.resolve(keys.length)
}

MemoryAdapter.prototype.quit = function quit() {
	return Promise.resolve()
}

MemoryAdapter.prototype._removeExpired = function _removeExpired() {
	const now = Date.now()
	const self = this
	Object.keys(this._expires).forEach(key => {
		if (self._expires[key] < now) {
			delete self._keys[key]
			delete self._expires[key]
		}
	})
}
