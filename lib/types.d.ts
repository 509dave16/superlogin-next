/// <reference types="express" />
/// <reference types="pouchdb-core" />
/// <reference types="pouchdb-upsert" />
import { Data } from 'ejs';
import { RequestHandler, Router } from 'express';
import { Transport, TransportOptions } from 'nodemailer';
import { PassportStatic, Strategy } from 'passport';
export declare namespace Superlogin {
    interface IAdapter {
        _getFilepath?(path: string): string;
        _removeExpired?(path: string): void;
        deleteKeys(keys: string[]): Promise<number>;
        getKey(path: string): Promise<string>;
        quit(path?: string): Promise<void>;
        storeKey(key: string, life: number, data: {}): Promise<void>;
    }
    interface ISecurityDoc {
        admins: {
            roles: string[];
            names: string[];
            members?: string[];
        };
        members: {
            roles: string[];
            names: string[];
            members?: string[];
        };
    }
    type DBType = 'private' | 'shared';
    interface IConfiguration {
        testMode?: {
            oauthTest?: boolean;
            noEmail?: boolean;
            oauthDebug?: boolean;
            debugEmail: boolean;
        };
        security: {
            defaultRoles: string[];
            disableLinkAccounts?: boolean;
            maxFailedLogins: number;
            lockoutTime: number;
            sessionLife: number;
            tokenLife: number;
            userActivityLogSize?: number;
            loginOnRegistration: boolean;
            loginOnPasswordReset: boolean;
        };
        local: {
            sendConfirmEmail?: boolean;
            requireEmailConfirm?: boolean;
            confirmEmailRedirectURL?: string;
            emailUsername?: boolean;
            usernameField: string;
            passwordField: string;
            passwordConstraints?: {
                length?: {
                    minimum: number;
                    message?: string;
                };
                matches?: string;
            };
        };
        dbServer: {
            designDocDir: string;
            protocol: string;
            host: string;
            user: string;
            password: string;
            publicURL?: string;
            cloudant?: boolean;
            userDB: string;
            couchAuthDB: string;
        };
        session: {
            adapter: 'redis' | 'memory' | 'file';
            file?: {
                sessionsRoot: string;
            };
            redis?: {
                url?: string;
                port?: number;
                host?: string;
                unix_socket?: string;
                options?: {};
                password?: string;
            };
        };
        mailer?: {
            fromEmail?: string;
            transport?: Transport;
            options: TransportOptions;
        };
        emails: {
            [name: string]: {
                subject: string;
                template: string;
                format: string;
            };
        };
        userDBs?: {
            defaultDBs?: {
                private?: string[];
                shared?: string[];
            };
            defaultSecurityRoles?: {
                admins?: string[];
                members?: string[];
            };
            model?: {
                [name: string]: {
                    designDocs?: string[];
                    permissions?: string[];
                    type: string;
                    adminRoles?: string[];
                    memberRoles?: string[];
                };
            };
            privatePrefix?: string;
            designDocDir?: string;
        };
        providers: {
            [name: string]: {
                credentials: {
                    clientID: string;
                    clientSecret: string;
                };
                options: {
                    scope: string[];
                };
                stateRequired?: boolean;
            };
        };
        userModel: {
            whitelist?: string[];
            customValidators?: {
                [key: string]: (value: any, opts: boolean, key: string, allValues: any) => any;
            };
            validate?: {
                [key: string]: {
                    [key: string]: any;
                };
            };
        };
    }
    interface IUserConfig {
        testMode?: IConfiguration['testMode'];
        security?: Partial<IConfiguration['security']>;
        local?: Partial<IConfiguration['local']>;
        dbServer?: Partial<IConfiguration['dbServer']>;
        session?: Partial<IConfiguration['session']>;
        mailer?: IConfiguration['mailer'];
        emails?: IConfiguration['emails'];
        userDBs?: IConfiguration['userDBs'];
        providers?: IConfiguration['providers'];
        userModel?: IConfiguration['userModel'];
    }
    interface ISession {
        _id: string;
        derived_key?: string;
        expires: number;
        ip?: string;
        issued: number;
        key: string;
        password: string;
        provider?: string;
        roles: string[];
        salt?: string;
        token?: string;
        userDBs?: {
            [name: string]: string;
        };
        user_id?: string;
    }
    interface IProfile {
        [key: string]: {};
        displayName: string;
        username: string;
        id: string;
        email: string;
        emails: {
            value: string;
        }[];
    }
    interface IActivity {
        timestamp: string;
        action: string;
        provider: string;
        ip: string;
    }
    interface IUserDoc extends ISession {
        activity?: IActivity[] | IActivity;
        _rev: string;
        rev?: string;
        unverifiedEmail: {
            email: string;
            token: string;
        };
        password: string;
        confirmPassword: string;
        name: string;
        email: string;
        _id: string;
        type: string;
        roles: string[];
        displayName?: string;
        companyName?: string;
        providers: string[];
        profile: IProfile;
        forgotPassword: {
            expires: number;
            token: string;
            issued: number;
        };
        local: {
            iterations?: string;
            failedLoginAttempts?: number;
            salt?: string;
            derived_key?: string;
            lockedUntil?: number;
        };
        signUp: {
            provider: string;
            timestamp: string;
            ip: string;
        };
        google?: {};
        session: {
            [name: string]: {
                expires?: number;
            };
        };
        personalDBs: {
            [dbName: string]: {
                name: string;
                type?: string;
            };
        };
    }
    interface IBaseSLInstance {
        config: IConfigure;
        router: Router;
        mailer: IMailer;
        passport: PassportStatic;
        userDB: PouchDB.Database<IUserDoc>;
        couchAuthDB: PouchDB.Database | undefined;
        requireAuth: RequestHandler;
        removeExpiredKeys(): Promise<undefined | string[]>;
        registerProvider(provider: string, configFunction: (credentials: {}, passport: {}, authHandler: {}) => void): void;
        registerOAuth2(providerName: string, Strategy: Strategy): void;
        registerTokenProvider(providerName: string, Strategy: Strategy): void;
        validateUsername(username: string): Promise<string | void>;
        validateEmail(email: string): Promise<string | void>;
        validateEmailUsername(email: string): Promise<string | void>;
        getUser(login: string): Promise<PouchDB.Core.ExistingDocument<IUserDoc> | null | undefined>;
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
        addUserDB(user_id: string, dbName: string, type: string, designDocs?: string[], permissions?: string[]): Promise<(IUserDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta) | undefined>;
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
        requireRole(requiredRole: string): RequestHandler;
        requireAnyRole(possibleRoles: string[]): RequestHandler;
        requireAllRoles(requiredRoles: string[]): RequestHandler;
    }
    interface ISLInstance extends IBaseSLInstance {
        on(event: string, cb: {}): void;
    }
}
