declare const configure: (data: IUserConfig, defaults: {
    security: {
        defaultRoles: string[];
        maxFailedLogins: number;
        lockoutTime: number;
        sessionLife: number;
        tokenLife: number;
        loginOnRegistration: boolean;
        loginOnPasswordReset: boolean;
    };
    local: {
        usernameField: string;
        passwordField: string;
    };
    session: {
        adapter: string;
        file: {
            sessionsRoot: string;
        };
    };
    dbServer: {
        protocol: string;
        host: string;
        designDocDir: string;
        userDB: string;
        couchAuthDB: string;
    };
    emails: {
        confirmEmail: {
            subject: string;
            template: string;
            format: string;
        };
        forgotPassword: {
            subject: string;
            template: string;
            format: string;
        };
    };
}) => IConfigure;
declare global  {
    interface IConfigure {
        get(): IConfiguration;
        set(setFunc: (oldCfg: IConfiguration) => IConfiguration): void;
    }
}
export default configure;
export {};
