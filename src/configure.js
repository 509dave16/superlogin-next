const util = require('./util')

function configure(data, defaults) {
	this.config = data || {}
	this.defaults = defaults || {}

	this.getItem = key => {
		let result = util.getObjectRef(this.config, key)
		if (typeof result === 'undefined' || result === null) {
			result = util.getObjectRef(this.defaults, key)
		}
		return result
	}

	this.setItem = (key, value) => util.setObjectRef(this.config, key, value)

	this.removeItem = key => util.delObjectRef(this.config, key)
}

export default configure
