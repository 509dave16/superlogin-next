import { Data } from 'ejs';
import { PassportStatic, Strategy } from 'passport';
import { Superlogin } from './types';
export declare type DBType = Superlogin.DBType;
export declare type Data = Data;
export declare type IActivity = Superlogin.IActivity;
export declare type IAdapter = Superlogin.IAdapter;
export declare type IBaseSLInstance = Superlogin.IBaseSLInstance;
export declare type IConfiguration = Superlogin.IConfiguration;
export declare type IProfile = Superlogin.IProfile;
export declare type ISLInstance = Superlogin.ISLInstance;
export declare type ISecurityDoc = Superlogin.ISecurityDoc;
export declare type ISession = Superlogin.ISession;
export declare type IUserConfig = Superlogin.IUserConfig;
export declare type IUserDoc = Superlogin.IUserDoc;
export declare type Strategy = Strategy;
declare const init: (configData: Superlogin.IUserConfig, passport?: PassportStatic | undefined, userDB?: PouchDB.Database<{}> | undefined, couchAuthDB?: PouchDB.Database<{}> | undefined) => Promise<Superlogin.ISLInstance>;
export default init;
