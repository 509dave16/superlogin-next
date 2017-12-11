const BPromise = require('bluebird')
const fs = BPromise.promisifyAll(require('fs-extra'))
const path = require('path')

const FileAdapter = config => {
	const sessionsRoot = config.getItem('session.file.sessionsRoot')
	this._sessionFolder = path.join(process.env.PWD, sessionsRoot)
	console.log('File Adapter loaded')
}

export default FileAdapter

FileAdapter.prototype._getFilepath = function _getFilepath(key) {
	return path.format({
		dir: this._sessionFolder,
		base: `${key}.json`
	})
}

FileAdapter.prototype.storeKey = function storeKey(key, life, data) {
	const now = Date.now()
	return fs.outputJsonAsync(this._getFilepath(key), {
		data,
		expire: now + life
	})
}

FileAdapter.prototype.getKey = function getKey(key) {
	const now = Date.now()
	return fs
		.readJsonAsync(this._getFilepath(key))
		.then(session => {
			if (session.expire > now) {
				return session.data
			}
			return false
		})
		.catch(() => false)
}

FileAdapter.prototype.deleteKeys = function deleteKeys(keys) {
	if (!(keys instanceof Array)) {
		keys = [keys]
	}
	const self = this
	const deleteQueue = keys.map(key => fs.removeAsync(self._getFilepath(key)))

	return Promise.all(deleteQueue).then(
		done =>
			// this._removeExpired();
			done.length
	)
}

FileAdapter.prototype.quit = function quit() {
	return Promise.resolve()
}

FileAdapter.prototype._removeExpired = function _removeExpired() {
	// open all files and check session expire date
}
