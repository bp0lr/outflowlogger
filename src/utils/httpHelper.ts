import got from "got-cjs";
import { HttpsProxyAgent } from "hpagent";
import config from "./config";
const staticHeaders = [];

const agentConfig = {
  https: new HttpsProxyAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 256,
    maxFreeSockets: 256,
    scheduling: "lifo",
    rejectUnauthorized: false,
    //proxy: "http://192.168.0.150:8080",
    //proxy: process.env.PROXY,
    proxy: undefined,
  }),
};

export class httpHelper {
  public readonly useProxy: boolean;

  constructor(useProxy = false) {
    this.useProxy = useProxy;
  }

  async sendGet(url: string, extraHeaders = {}): Promise<any> {
    //sendGet = async (url: string, extraHeaders = {}) => {
    var _this = this;
    try {
      staticHeaders["Accept"] = "application/json";
      staticHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      staticHeaders["x-api-key"] = config.solanatrackerAPIKey;

      for (const [key, value] of Object.entries(extraHeaders)) {
        //console.log("adding: " + key + " => " + value);
        staticHeaders[key] = value;
      }

      let options = {
        hooks: {
          beforeRequest: [
            function (options) {
              //console.log(options);
            },
          ],
        },
        //timeout: {
        //  request: 5000,
        //},
        responseType: "json",
        headers: staticHeaders,
        throwHttpErrors: false,
        https: { rejectUnauthorized: false },
        retry: { limit: 1, methods: ["GET", "POST"] },
      };

      if (_this.useProxy == true) {
        console.log("using proxy");
        options["agent"] = agentConfig;
      }

      let response = await got.get(url, options as any);

      return response.body;
    } catch (err) {
      console.log("[-] Error sendGet");
      console.log("[-] " + err);
      //process.exit(0);
      return undefined;
    }
  }

  sendPost = async (url: string, jsonData): Promise<any> => {
    //console.log("debug payload: " + JSON.stringify(jsonData));
    var _this = this;
    try {
      staticHeaders["Content-Type"] = "application/json";
      staticHeaders["x-api-key"] = config.solanatrackerAPIKey;

      let options = {
        json: jsonData,
        responseType: "json",
        throwHttpErrors: false,
        headers: staticHeaders,
        https: { rejectUnauthorized: false },
        retry: { limit: 3, methods: ["GET", "POST"] },
      };

      if (_this.useProxy == true) {
        console.log("using proxy");
        options["agent"] = agentConfig;
      }
      let response = await got.post(url, options as any);

      return response.body;
    } catch (err) {
      console.log("[-] Error sendPost");
      console.log("[-] " + err);
      return undefined;
    }
  };
}
