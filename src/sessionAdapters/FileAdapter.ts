import fsBase from 'fs-extra'
import path from 'path'
// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird')

const fs = Promise.promisifyAll(fsBase)

const FileAdapter = (config: IConfigure): Superlogin.IAdapter => {
  const sessionsRoot = config.get().session.file.sessionsRoot
  const _sessionFolder = path.join(process.env.PWD as string, sessionsRoot)
  console.log('File Adapter loaded')

  const _getFilepath = (key: string) =>
    path.format({
      dir: _sessionFolder,
      base: `${key}.json`
    })

  const storeKey = (key: string, life: number, data: {}) =>
    fs.outputJsonAsync(_getFilepath(key), {
      data,
      expire: Date.now() + life
    })

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

  const deleteKeys = async (keys: string[]) => {
    if (!(keys instanceof Array)) {
      keys = [keys]
    }
    const done = await Promise.all(keys.map(async key => await fs.removeAsync(_getFilepath(key))))
    return done.length
  }

  const quit = async () => Promise.resolve()

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
