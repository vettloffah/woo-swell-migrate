declare module 'swell-node'{

     class Client {

        static init(clientId: string, clientKey: string, options?: Options): Client
        get(url: string, data?: Data, callback?: () => void): Promise<any>
        put(url: string, data: Data, callback?: () => void): Promise<any>
        post(url: string, data: Data, callback?: () => void): Promise<any>
        delete(url: string, data?: Data, callback?: () => void): Promise<any>

    }

    interface Options {
        id?: string,
        key?: string,
        version?: number,
        host?: string,
        port?: number,
        verifyCert?: boolean,
        debug?: boolean,
        cache?: boolean,
    }

    interface Data {
        [key: string]: any
    }

    interface Response {
        count: number,
        page: Page[],
        results: Data[]

    }

    interface Page {
        start: number,
        end: number
    }

    enum RequestMethod {
        "get", "post", "put", "delete"
    }

    export = Client;
       
}




