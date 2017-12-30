/// <reference types="pouchdb-core" />
declare const couchdb: (couchAuthDB: PouchDB.Database<{}>) => IDBAdapter;
declare global  {
    interface IDBAdapter {
        initSecurity(db: {}, adminRoles: string[], memberRoles: string[]): Promise<void | boolean>;
        authorizeKeys(user_id: string, db: PouchDB.Database, keys: string[] | string, permissions?: string[], roles?: string[]): Promise<void | boolean>;
        deauthorizeKeys(db: PouchDB.Database, keys: string[] | string): Promise<void | boolean>;
        removeKeys(keys: string[] | string): Promise<boolean | PouchDB.Core.Response[]>;
        storeKey(username: string, key: string, password: string, expires?: number, roles?: string[]): Promise<{
            _id: string;
            type: string;
            name: string;
            user_id: string;
            password: string;
            expires: number;
            roles: string[];
        }>;
    }
}
export default couchdb;
export {};
