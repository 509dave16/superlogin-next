// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird')
import events from 'events'
import express from 'express'
import PouchDB from 'pouchdb-node'
import seed from 'pouchdb-seed-design'

import defaultPassport from 'passport'
import PouchSecurity from 'pouchdb-security-helper'
import PouchUpsert from 'pouchdb-upsert'
import defaultConfig from './config/default.config'
import Configure from './configure'
import localConfig from './local'
import Mailer from './mailer'
import Middleware from './middleware'
import Oauth from './oauth'
import loadRoutes from './routes'
import User from './user'
import util from './util'

PouchDB.plugin(PouchSecurity)
PouchDB.plugin(PouchUpsert)

const init = async (
	configData: IConfig,
	// tslint:disable-next-line:no-any
	passport?: any,
	userDB?: PouchDB.Database & { name: string },
	couchAuthDB?: PouchDB.Database & { name: string }
) => {
	const config = Configure(configData, defaultConfig)
	const router = express.Router()
	const emitter = new events.EventEmitter()

	if (!passport || typeof passport !== 'object') {
		passport = defaultPassport
	}
	const middleware = Middleware(passport)

	// Some extra default settings if no config object is specified
	if (!configData) {
		config.setItem('testMode.noEmail', true)
		config.setItem('testMode.debugEmail', true)
	}

	// Create the DBs if they weren't passed in
	if (!userDB && config.getItem('dbServer.userDB')) {
		userDB = new PouchDB(
			util.getFullDBURL(config.getItem('dbServer'), config.getItem('dbServer.userDB'))
		) as PouchDB.Database & { name: string }
	}
	if (
		!couchAuthDB &&
		config.getItem('dbServer.couchAuthDB') &&
		!config.getItem('dbServer.cloudant')
	) {
		couchAuthDB = new PouchDB(
			util.getFullDBURL(config.getItem('dbServer'), config.getItem('dbServer.couchAuthDB'))
		) as PouchDB.Database & { name: string }
	}
	if (!userDB || typeof userDB !== 'object') {
		throw new Error(
			'userDB must be passed in as the third argument or specified in the config file under dbServer.userDB'
		)
	}

	const mailer = Mailer(config)
	const user = User(
		config,
		userDB,
		couchAuthDB as PouchDB.Database & { name: string },
		mailer,
		emitter
	)
	const oauth = Oauth(router, passport, user, config)

	// Seed design docs for the user database
	// tslint:disable-next-line:no-var-requires
	let userDesign = require('../designDocs/user-design')
	userDesign = util.addProvidersToDesignDoc(config, userDesign)
	try {
		await seed(userDB, userDesign)
	} catch (error) {
		console.log('failed seeding design docs!', error)
	}
	// Configure Passport local login and api keys
	localConfig(config, passport, user)
	// Load the routes
	loadRoutes(config, router, passport, user)

	const superlogin = {
		config,
		router,
		mailer,
		passport,
		userDB,
		couchAuthDB,
		registerProvider: oauth.registerProvider,
		registerOAuth2: oauth.registerOAuth2,
		registerTokenProvider: oauth.registerTokenProvider,
		validateUsername: user.validateUsername,
		validateEmail: user.validateEmail,
		validateEmailUsername: user.validateEmailUsername,
		getUser: user.get,
		createUser: user.create,
		onCreate: user.onCreate,
		onLink: user.onLink,
		socialAuth: user.socialAuth,
		hashPassword: util.hashPassword,
		verifyPassword: util.verifyPassword,
		createSession: user.createSession,
		changePassword: user.changePassword,
		changeEmail: user.changeEmail,
		resetPassword: user.resetPassword,
		forgotPassword: user.forgotPassword,
		verifyEmail: user.verifyEmail,
		addUserDB: user.addUserDB,
		removeUserDB: user.removeUserDB,
		logoutUser: user.logoutUser,
		logoutSession: user.logoutSession,
		logoutOthers: user.logoutOthers,
		removeUser: user.remove,
		confirmSession: user.confirmSession,
		removeExpiredKeys: user.removeExpiredKeys,
		sendEmail: mailer.sendEmail,
		quitRedis: user.quitRedis,
		// authentication middleware
		requireAuth: middleware.requireAuth,
		requireRole: middleware.requireRole,
		requireAnyRole: middleware.requireAnyRole,
		requireAllRoles: middleware.requireAllRoles
	}
	// tslint:disable-next-line
	for (const key in emitter) {
		superlogin[key] = emitter[key]
	}
	return superlogin
}

export default init
