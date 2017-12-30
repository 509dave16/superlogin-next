import defaultConfig from './config/default.config'
import Configure from './configure'
import localConfig from './local'
import Mailer from './mailer'
import Middleware from './middleware'
import Oauth from './oauth'
import loadRoutes from './routes'
import User from './user'
import util from './util'
import { Data } from 'ejs'
import events from 'events'
import express, { Router } from 'express'
import defaultPassport, { PassportStatic, Strategy } from 'passport'
import PouchDB from 'pouchdb-node'
import PouchSecurity from 'pouchdb-security-helper'
import seed from 'pouchdb-seed-design'
import PouchUpsert from 'pouchdb-upsert'

// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird')

// tslint:disable-next-line:no-var-requires
const userDesign = require('../designDocs/user-design')

export type Data = Data
export type Strategy = Strategy

PouchDB.plugin(PouchSecurity).plugin(PouchUpsert)

const init = async (
  configData: IUserConfig,
  passport?: PassportStatic,
  userDB?: PouchDB.Database,
  couchAuthDB?: PouchDB.Database
) => {
  const config = Configure(configData, defaultConfig)
  const router: Router = express.Router()
  const emitter = new events.EventEmitter()

  const finalPassport: PassportStatic = passport || defaultPassport

  const middleware = Middleware(finalPassport)

  // Some extra default settings if no config object is specified
  if (!configData) {
    config.set(o => ({ ...o, testMode: { noEmail: true, debugEmail: true } }))
  }

  // Create the DBs if they weren't passed in
  if (!userDB) {
    userDB = new PouchDB(util.getFullDBURL(config.get().dbServer, config.get().dbServer.userDB))
  }
  if (!couchAuthDB && !config.get().dbServer.cloudant) {
    couchAuthDB = new PouchDB(
      util.getFullDBURL(config.get().dbServer, config.get().dbServer.couchAuthDB)
    )
  }
  if (!userDB) {
    throw new Error(
      'userDB must be passed in as the third argument or specified in the config file under dbServer.userDB'
    )
  }

  const mailer = Mailer(config)
  const user = User(config, userDB, couchAuthDB as PouchDB.Database, mailer, emitter)
  const oauth = Oauth(router, finalPassport, user, config)

  // Seed design docs for the user database
  const designWithProviders = util.addProvidersToDesignDoc(config, userDesign)
  try {
    await seed(userDB, designWithProviders)
  } catch (error) {
    console.error('failed seeding design docs!', error)
  }

  // Configure Passport local login and api keys
  localConfig(config, finalPassport, user)

  // Load the routes
  loadRoutes(config, router, finalPassport, user)

  const superlogin: IBaseSLInstance = {
    config,
    router,
    mailer,
    passport: finalPassport,
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
  return superlogin as ISLInstance
}

export default init
