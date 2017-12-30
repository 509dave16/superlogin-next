import merge from 'lodash.merge'

const configure = (data: IUserConfig, defaults: IDefaultConfig): IConfigure => {
  let finalConfig = merge({}, defaults, data) as IConfiguration

  return {
    get: () => finalConfig,
    set: setFunc => (finalConfig = setFunc(finalConfig))
  }
}

declare global {
  interface IConfigure {
    get(): IConfiguration
    set(setFunc: (oldCfg: IConfiguration) => IConfiguration): void
  }
}

export default configure
