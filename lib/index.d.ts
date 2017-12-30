/// <reference types="express" />
/// <reference types="pouchdb-core" />
/// <reference types="pouchdb-upsert" />
import { Data } from 'ejs';
import express from 'express';
import { PassportStatic, Strategy } from 'passport';
export declare type Data = Data;
export declare type Strategy = Strategy;
declare const init: (configData: IUserConfig, passport?: PassportStatic | undefined, userDB?: PouchDB.Database<{}> | undefined, couchAuthDB?: PouchDB.Database<{}> | undefined) => Promise<ISLInstance>;
export default init;
export interface IBaseSLInstance {
    config: IConfigure;
    router: express.Router;
    mailer: IMailer;
    passport: PassportStatic;
    userDB: PouchDB.Database<{}>;
    couchAuthDB: PouchDB.Database<{}> | undefined;
    removeExpiredKeys: {};
    requireAuth: express.RequestHandler;
    registerProvider(provider: string, configFunction: (credentials: {}, passport: {}, authHandler: {}) => void): void;
    registerOAuth2(providerName: string, Strategy: Strategy): void;
    registerTokenProvider(providerName: string, Strategy: Strategy): void;
    validateUsername(username: string): Promise<string | void>;
    validateEmail(email: string): Promise<string | void>;
    validateEmailUsername(email: string): Promise<string | void>;
    getUser(login: string): Promise<PouchDB.Core.ExistingDocument<PouchDB.Core.AllDocsMeta> | null | undefined>;
    createUser(form: {}, req: {
        ip: string;
    }): Promise<IUserDoc>;
    onCreate(fn: (userDoc: IUserDoc, provider: string) => Promise<IUserDoc>): void;
    onLink(fn: (userDoc: IUserDoc, provider: string) => Promise<IUserDoc>): void;
    socialAuth(provider: string, auth: string, profile: IProfile, req: {
        ip: string;
    }): Promise<IUserDoc | undefined>;
    hashPassword(password: string): Promise<{
        salt: string;
        derived_key: string;
    }>;
    verifyPassword(hashObj: {
        iterations?: string | undefined;
        salt?: string | undefined;
        derived_key?: string | undefined;
    }, password: string): Promise<boolean>;
    createSession(user_id: string, provider: string, req: {
        ip: string;
    }): Promise<Partial<IUserDoc> | undefined>;
    changePassword(user_id: string, newPassword: string, userDoc: IUserDoc, req: {
        ip: string;
    }): Promise<boolean>;
    changeEmail(user_id: string, newEmail: string, req: {
        user: {
            provider: string;
        };
        ip: string;
    }): Promise<IUserDoc | undefined>;
    resetPassword(form: {
        token: string;
        password: string;
    }, req: {
        ip: string;
    }): {};
    forgotPassword(email: string, req: {
        ip: string;
    }): Promise<{
        expires: number;
        token: string;
        issued: number;
    } | undefined>;
    verifyEmail(token: string, req: {
        ip: string;
    }): Promise<PouchDB.UpsertResponse>;
    addUserDB(user_id: string, dbName: string, type: string, designDocs: string[], permissions: string[]): Promise<(IUserDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta) | undefined>;
    removeUserDB(user_id: string, dbName: string, deletePrivate: boolean, deleteShared: boolean): Promise<void | PouchDB.UpsertResponse>;
    logoutUser(user_id: string, session_id: string): Promise<PouchDB.UpsertResponse>;
    logoutSession(session_id: string): Promise<boolean | PouchDB.UpsertResponse>;
    logoutOthers(session_id: string): Promise<boolean | PouchDB.UpsertResponse>;
    removeUser(user_id: string, destroyDBs: boolean): Promise<void | PouchDB.Core.Response>;
    confirmSession(key: string, password: string): Promise<{
        userDBs?: {
            [name: string]: string;
        } | undefined;
        user_id?: string | undefined;
        token?: string | undefined;
        issued?: number | undefined;
        expires: number;
        provider?: string | undefined;
        ip?: string | undefined;
        _id: string;
        key: string;
        password: string;
        roles: string[];
    }>;
    sendEmail(templateName: string, email: string, locals: Data): void;
    quitRedis(): Promise<void>;
    requireRole(requiredRole: string): express.RequestHandler;
    requireAnyRole(possibleRoles: string[]): express.RequestHandler;
    requireAllRoles(requiredRoles: string[]): express.RequestHandler;
}
export interface ISLInstance extends IBaseSLInstance {
    on(event: string, cb: {}): void;
}
