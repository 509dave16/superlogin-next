import BPromise from 'bluebird'
import fsBase from 'fs-extra'
import path from 'path'
const fs = BPromise.promisifyAll(fsBase)

const FileAdapter = (config: IConfigure): IAdapter => {
	const sessionsRoot = config.getItem('session.file.sessionsRoot')
	const _sessionFolder = path.join(process.env.PWD as string, sessionsRoot)
	console.log('File Adapter loaded')

	const _getFilepath = (key: string) =>
		path.format({
			dir: _sessionFolder,
			base: `${key}.json`
		})

	const storeKey = (key: string, life: number, data: {}) => {
		const now = Date.now()
		return fs.outputJsonAsync(_getFilepath(key), {
			data,
			expire: now + life
		})
	}

	const getKey = (key: string) => {
		const now = Date.now()
		return fs
			.readJsonAsync(_getFilepath(key))
			.then((session: { expire: number; data: {} }) => {
				if (session.expire > now) {
					return session.data
				}
				return false
			})
			.catch(() => false)
	}

	const deleteKeys = (keys: string[]) => {
		if (!(keys instanceof Array)) {
			keys = [keys]
		}
		const deleteQueue = keys.map(key => fs.removeAsync(_getFilepath(key)))

		return Promise.all(deleteQueue).then(
			done =>
				// this._removeExpired();
				done.length
		)
	}

	const quit = () => {
		return Promise.resolve()
	}

	const _removeExpired = () => {
		// open all files and check session expire date
	}

	return {
		_getFilepath,
		storeKey,
		getKey,
		deleteKeys,
		quit,
		_removeExpired
	}
}

export default FileAdapter
