import util from './util'
import { Request } from 'express'
import { PassportStatic } from 'passport'
import Bearer from 'passport-http-bearer-sl'
import LocalStrategy from 'passport-local'
// tslint:disable-next-line:no-var-requires
global.Promise = require('bluebird')

const BearerStrategy = Bearer.Strategy

type IDoneFunc = (
  sth: {} | null,
  sth2?: boolean | IUserDoc,
  sth3?: { error?: string; message: string }
) => void

const local = (config: IConfigure, passport: PassportStatic, user: User) => {
  const { usernameField, passwordField, requireEmailConfirm } = config.get().local
  const handleFailedLogin = async (userDoc: IUserDoc, req: Request, done: IDoneFunc) => {
    try {
      const locked = await user.handleFailedLogin(userDoc, req)
      const message = locked
        ? `Maximum failed login attempts exceeded. Your account has been locked for ${Math.round(
            config.get().security.lockoutTime / 60
          )} minutes.`
        : 'Invalid username or password'
      return done(null, false, { error: 'Unauthorized', message })
    } catch (error) {
      console.error('handleFailedLogin error', handleFailedLogin)
      return done(null, false, { error: 'Unauthorized', message: error })
    }
  }
  // API token strategy
  passport.use(
    new BearerStrategy(async (tokenPass: string, done: IDoneFunc) => {
      const parse = tokenPass.split(':')
      if (parse.length < 2) {
        return done(null, false, { message: 'invalid token' })
      }
      const token = parse[0]
      const password = parse[1]
      try {
        const thisUser = await user.confirmSession(token, password)
        return done(null, thisUser)
      } catch (error) {
        console.error('error in local bearer strategy', error)
        return done(null, false, { message: error })
      }
    })
  )

  // Use local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField,
        passwordField,
        session: false,
        passReqToCallback: true
      },
      async (req: Request, username: string, password: string, done: IDoneFunc) => {
        try {
          const thisUser = await user.get(username)

          if (thisUser) {
            const { local: thisLocal, email } = thisUser
            // Check if the account is locked
            if (thisLocal && thisLocal.lockedUntil && thisLocal.lockedUntil > Date.now()) {
              return done(null, false, {
                error: 'Unauthorized',
                message:
                  'Your account is currently locked. Please wait a few minutes and try again.'
              })
            }
            if (!thisLocal || !thisLocal.derived_key) {
              return done(null, false, {
                error: 'Unauthorized',
                message: 'Invalid username or password'
              })
            }
            try {
              await util.verifyPassword(thisLocal, password)

              // Check if the email has been confirmed if it is required
              if (requireEmailConfirm && !email) {
                return done(null, false, {
                  error: 'Unauthorized',
                  message: 'You must confirm your email address.'
                })
              }
              // Success!!!
              return done(null, thisUser)
            } catch (error) {
              return error ? done(error) : handleFailedLogin(thisUser, req, done)
            }
          } else {
            // user not found
            return done(null, false, {
              error: 'Unauthorized',
              message: 'Invalid username or password'
            })
          }
        } catch (error) {
          console.error('error in local strategy', error)
          return done(error)
        }
      }
    )
  )
}

export default local

declare global {
  type Local = typeof local
}
