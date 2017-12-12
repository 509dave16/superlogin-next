/// <reference types="pouchdb-core" />

declare namespace PouchDB {
	interface Database<Content extends {} = {}> {
		name: string
	}
}
