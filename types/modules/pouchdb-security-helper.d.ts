/// <reference types="pouchdb-core" />

declare namespace PouchDB {
	interface ISecurityType {
		size: number
		add(items: string | string[]): void
		has(item: string): boolean
		remove(items: string | string[]): void
		removeAll(): void
	}
	interface ISecurityLevel {
		names: ISecurityType
		roles: ISecurityType
		removeAll(): void
		isEmpty(): boolean
		add(data: { roles: string[]; names: string[] }): boolean
	}
	interface ISecurity {
		admins: ISecurityLevel
		members: ISecurityLevel
		fetch(): Promise<void>
		save(): Promise<void>
		hasMembers(): Boolean
		hasAdmins(): Boolean
		userHasAccess(userCtx: { name: string; roles: string[] }): Boolean
		nameHasAccess(name: string): Boolean
		roleHasAccess(role: string): Boolean
		toJSON(): {}
		reset(): void
	}
	interface Database<Content extends {} = {}> {
		security(): ISecurity
	}
}

declare module 'pouchdb-security-helper' {
	const plugin: PouchDB.Plugin
	export = plugin
}
