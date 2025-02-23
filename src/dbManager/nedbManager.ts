import Datastore from "@seald-io/nedb";
import { PublicKey } from "@solana/web3.js";

export class nedbManager {
  public readonly processedDB: Datastore;
  constructor() {
    this.processedDB = new Datastore();
  }

  initDB = async (): Promise<void> => {
    await this.processedDB.ensureIndexAsync({ fieldName: "uniqueID", unique: true });
  };

  returnProcessedTokensDBInstance = (): Datastore => {
    return this.processedDB;
  };

  checkIfWalletExists = async (wallets: PublicKey[]): Promise<boolean> => {
    for (const wallet of wallets) {
      const exists = await this.processedDB.countAsync({ uniqueID: wallet.toString() });
      if (exists) {
        return true;
      }
    }

    return false;
  };
}

const db = new nedbManager();
export { db };
