import { VersionedTransactionResponse, PublicKey } from "@solana/web3.js";
import { raydiumDecodeResponse } from "../../interfaces/decoderInterfaces";
import { TransactionFormatter } from "./transaction-formatter";
import { RaydiumAmmParser } from "./utils/raydium-amm-parser";
import Logger from "../../utils/logger";

const logger = Logger.getInstance();

export class raydiumDecoder {
  private TXN_FORMATTER: TransactionFormatter;
  private RAYDIUM_PARSER: RaydiumAmmParser;

  constructor() {
    this.RAYDIUM_PARSER = new RaydiumAmmParser();
    this.TXN_FORMATTER = new TransactionFormatter();
  }

  decodeRaydium = async (data: any): Promise<raydiumDecodeResponse> => {
    let response: raydiumDecodeResponse = { signature: "", error: true, isBuy: undefined, isFirstBuy: undefined, owner: undefined, mint: undefined, solAmount: 0 };

    try {
      if (data?.transaction) {
        const txn = this.TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());

        if (typeof txn?.transaction?.message?.staticAccountKeys === "undefined") {
          return response;
        }

        const decodedRaydiumIxs = this.decodeRaydiumTxn(txn);
        if (!decodedRaydiumIxs?.length) {
          return response;
        }
        const createPoolIx = decodedRaydiumIxs.find((decodedRaydiumIx) => {
          if (decodedRaydiumIx.name === "swapIn" || decodedRaydiumIx.name === "swapOut") {
            return decodedRaydiumIx;
          }
        });

        if (createPoolIx) {
          const tradeInfo = await this.getTradeInfo(data, txn?.transaction?.message?.header.numRequiredSignatures, txn?.transaction?.message?.staticAccountKeys);
          if (tradeInfo.error) {
            return response;
          }

          response.error = false;
          response.signature = "https://solscan.io/tx/" + txn?.transaction?.signatures[0];
          response.owner = tradeInfo.owner;
          response.isBuy = tradeInfo.isBuy;
          response.isFirstBuy = tradeInfo.isFirstBuy;
          response.mint = tradeInfo.mint;
          response.solAmount = tradeInfo.solAmount;

          return response;
        }
      }
    } catch (error) {
      logger.info("error: " + error);
    }

    return response;
  };

  decodeRaydiumTxn = (tx: VersionedTransactionResponse): any[] | undefined => {
    if (tx.meta?.err) return undefined;

    const allIxs = this.TXN_FORMATTER.flattenTransactionResponse(tx);

    //const accountsMeta = this.TXN_FORMATTER.parseTransactionAccounts(tx.transaction.message, tx.meta?.loadedAddresses);

    const raydiumIxs = allIxs.filter((ix) => ix.programId.equals(RaydiumAmmParser.PROGRAM_ID));
    const decodedIxs = raydiumIxs.map((ix) => this.RAYDIUM_PARSER.parseInstruction(ix));

    return decodedIxs;
  };

  getTradeInfo = async (tx: any, signersAmount: number, accountKeys: PublicKey[]): Promise<raydiumDecodeResponse> => {
    let mintInfo: raydiumDecodeResponse = { error: true, signature: "", owner: "", isBuy: false, isFirstBuy: true, mint: undefined, solAmount: 0 };

    const signers = accountKeys.slice(0, signersAmount).map((key) => key.toString());
    const predata = tx?.transaction?.transaction?.meta?.preTokenBalances ?? [];
    const postdata = tx?.transaction?.transaction?.meta?.postTokenBalances ?? [];

    if (!Array.isArray(predata) || !Array.isArray(postdata)) {
      return mintInfo;
    }

    if (!Array.isArray(accountKeys) || accountKeys.length < 2) {
      return mintInfo;
    }

    let prefilter: any | undefined;
    let postfilter: any | undefined;

    prefilter = predata.find((t) => typeof t.mint !== "undefined" && t.mint != null && t.mint !== "So11111111111111111111111111111111111111112" && signers.includes(t.owner));
    postfilter = postdata.find((t) => typeof t.mint !== "undefined" && t.mint != null && t.mint !== "So11111111111111111111111111111111111111112" && signers.includes(t.owner));

    if (!postfilter || !postfilter?.owner || !postfilter?.mint) {
      return mintInfo;
    }

    const preUiAmount = parseFloat(prefilter?.uiTokenAmount?.uiAmount ?? "0");
    const postUiAmount = parseFloat(postfilter?.uiTokenAmount?.uiAmount ?? "0");

    let mint = prefilter?.mint?.length > 0 ? prefilter?.mint : postfilter?.mint;
    let isBuy = preUiAmount > postUiAmount ? false : true;
    let owner = prefilter?.owner?.length > 0 ? prefilter?.owner : postfilter?.owner;

    let firstBuy = preUiAmount == 0 ? true : false;

    let SolPre = this.getTotalTokenForOwner(predata, "So11111111111111111111111111111111111111112", "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1");
    let SolPos = this.getTotalTokenForOwner(postdata, "So11111111111111111111111111111111111111112", "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1");

    let Soltotal = isBuy ? SolPos - SolPre : SolPre - SolPos;

    mintInfo = {
      error: false,
      signature: "",
      owner: owner,
      isBuy: isBuy,
      isFirstBuy: firstBuy,
      mint: mint,
      solAmount: Soltotal,
    };

    return mintInfo;
  };

  stringifyWithBigInt = (obj: any): string => {
    return JSON.stringify(obj, (key, value) => (typeof value === "bigint" ? value.toString() : value));
  };

  getTotalTokenForOwner = (data: any[], mint: string, owner: string) => {
    return data.filter((item) => item.mint === mint && item.owner === owner).reduce((total, item) => total + item.uiTokenAmount.uiAmount, 0);
  };
}
