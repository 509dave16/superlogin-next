const configure = (data: IUserConfig, defaults: IDefaultConfig): IConfigure => {
	let finalConfig = Object.assign({}, defaults, data) as IConfiguration

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
