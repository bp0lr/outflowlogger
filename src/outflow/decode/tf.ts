import base58 from "bs58";
import { basicOutput } from "../../interfaces/output";
import Logger from "../../utils/logger";
import config from "../../utils/config";
import { db } from "../../dbManager/nedbManager";

const logger = Logger.getInstance();

export class txDecoder {
  constructor() {}

  decodeTransact = (data: any) => {
    const output = data ? base58.encode(Buffer.from(data, "base64")) : "";
    return output;
  };

  tOutPut = async (data: any): Promise<basicOutput> => {
    const dataTx = data ? data?.transaction?.transaction : null;
    const signature = this.decodeTransact(dataTx?.signature);
    const message = dataTx?.transaction?.message;
    //const header = message?.header;
    const accountKeys = message?.accountKeys.map((t) => {
      return this.decodeTransact(t);
    });
    //const recentBlockhash = decodeTransact(message?.recentBlockhash);
    //const instructions = message?.instructions;
    const meta = dataTx?.meta;
    let total = (meta.postBalances[2] - meta.preBalances[2]) / 10 ** 9;
    try {
      if (total > config.SOL_THRESHOLD && accountKeys[2] != "ComputeBudget111111111111111111111111111111") {
        let alreadyProcessed = await db.returnProcessedTokensDBInstance().countAsync({ uniqueID: accountKeys[2] });
        if (alreadyProcessed) {
          return undefined;
        }

        await db.returnProcessedTokensDBInstance().insertAsync({ uniqueID: accountKeys[2] });

        let output: basicOutput = { SolAmount: total, ToAddress: accountKeys[2], Txn: signature };
        return output;
      }

      return undefined;
    } catch (e) {
      console.log("error tOutPut: " + e);
      return undefined;
    }
  };
}
