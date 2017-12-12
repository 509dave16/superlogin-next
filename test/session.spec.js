'use strict'
var Promise = require('bluebird')
var expect = require('chai').expect
var Session = require('../lib/session').default
var Configure = require('../lib/configure').default
var rimraf = Promise.promisify(require('rimraf'))
var merge = require('lodash.merge')

var testToken = {
	_id: 'colinskow',
	roles: ['admin', 'user'],
	key: 'test123',
	password: 'pass123',
	issued: Date.now(),
	expires: Date.now() + 50000
}

var config = Configure({
	session: {
		adapter: 'memory'
	}
})

var fileConfig = Configure({
	session: {
		adapter: 'file',
		file: {
			sessionsRoot: '.session'
		}
	}
})

describe('Session', function() {
	return runTest(config, 'Memory adapter')
		.finally(function() {
			return runTest(fileConfig, 'File adapter')
		})
		.finally(function() {
			config.set(old => merge({}, old, { session: { adapter: 'redis' } }))
			return runTest(config, 'Redis adapter')
		})
		.finally(function() {
			return rimraf('./.session')
		})
})

function runTest(config, adapter) {
	var session = Session(config)
	var previous

	return new Promise(function(resolve, reject) {
		describe(adapter, function() {
			it('should store a token', function(done) {
				previous = session
					.storeToken(testToken)
					.then(function() {
						return session.confirmToken(testToken.key, testToken.password)
					})
					.then(function(result) {
						// console.log('stored token');
						expect(result.key).to.equal(testToken.key)
						done()
					})
					.catch(function(err) {
						done(err)
					})
			})

			it('should confirm a key and return the full token if valid', function(done) {
				previous.then(function() {
					return session
						.confirmToken(testToken.key, testToken.password)
						.then(function(result) {
							// console.log('confirmed token');
							expect(result._id).to.equal('colinskow')
							done()
						})
						.catch(function(err) {
							done(err)
						})
				})
			})

			it('should reject an invalid token', function(done) {
				previous.then(function() {
					return session.confirmToken('faketoken', testToken.password).catch(function(err) {
						// console.log('rejected invalid token');
						expect(err).to.equal('invalid token')
						done()
					})
				})
			})

			it('should reject a wrong password', function(done) {
				previous.then(function() {
					return session.confirmToken(testToken.key, 'wrongpass').catch(function(err) {
						// console.log('rejected invalid token');
						expect(err).to.equal('invalid token')
						done()
					})
				})
			})

			it('should delete a token', function(done) {
				previous.then(function() {
					return session
						.deleteTokens(testToken.key)
						.then(function(result) {
							expect(result).to.equal(1)
							return session.confirmToken(testToken.key)
						})
						.then(function() {
							throw new Error('failed to delete token')
						})
						.catch(function(err) {
							// console.log('deleted token');
							expect(err).to.equal('invalid token')
							session.quit()
							done()
							resolve()
						})
				})
			})
		})
	})
}
