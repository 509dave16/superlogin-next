import { Data } from 'ejs';
import { PassportStatic, Strategy } from 'passport';
export declare type Data = Data;
export declare type Strategy = Strategy;
declare const init: (configData: IUserConfig, passport?: PassportStatic | undefined, userDB?: PouchDB.Database<{}> | undefined, couchAuthDB?: PouchDB.Database<{}> | undefined) => Promise<ISLInstance>;
export default init;
