import * as Passport from 'passport'
declare module 'passport' {
	import { Request } from 'express'
	type StrategyStatic = any
	export interface Strategy {
		new (
			credentials: any,
			cb: (
				req: Request,
				accessToken: string,
				refreshToken: string,
				profile: {},
				done: () => void
			) => void
		): StrategyStatic
	}
}
