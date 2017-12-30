declare const Session: (config: IConfigure) => {
    confirmToken: (key: string, password: string) => Promise<{
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
    deleteTokens: (keys: string | string[]) => Promise<number>;
    fetchToken: (key: string) => Promise<any>;
    storeToken: (token: ISession) => Promise<{
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
    } | undefined>;
    quit: () => Promise<void>;
};
export default Session;
