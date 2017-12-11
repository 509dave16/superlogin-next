declare module 'couch-pwd' {
	interface IPwd {
		hash: any
		iterations(iterations: string): void
	}
	const pwd: IPwd
	export default pwd
}
