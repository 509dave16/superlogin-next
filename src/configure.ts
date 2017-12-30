import merge from 'lodash.merge'
import { Superlogin } from './types'

const configure = (data: Superlogin.IUserConfig, defaults: IDefaultConfig): IConfigure => {
  let finalConfig = merge({}, defaults, data) as Superlogin.IConfiguration

  return {
    get: () => finalConfig,
    set: setFunc => (finalConfig = setFunc(finalConfig))
  }
}

declare global {
  interface IConfigure {
    get(): Superlogin.IConfiguration
    set(setFunc: (oldCfg: Superlogin.IConfiguration) => Superlogin.IConfiguration): void
  }
}

export default configure
