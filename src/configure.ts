// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird')
import util from './util'

const configure = (data: {}, defaults: {}): IConfigure => ({
	getItem: (key: string) => {
		let result = util.getObjectRef(data, key)
		if (typeof result === 'undefined' || result === null) {
			result = util.getObjectRef(defaults, key)
		}
		return result
	},
	setItem: (key: string, value: string | boolean) => util.setObjectRef(data, key, value),
	removeItem: (key: string) => util.delObjectRef(defaults, key)
})

declare global {
	interface IConfigure {
		// tslint:disable-next-line:no-any
		getItem(key: string): any
		setItem(key: string, value: string | boolean): void
		removeItem(key: string): void
	}
}

export default configure
