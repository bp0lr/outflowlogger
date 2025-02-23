import { CommitmentLevel, SubscribeRequest } from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";
import { txDecoder } from "./decode/tf";
import config from "../utils/config";
import Logger from "../utils/logger";
import { basicOutput } from "../interfaces/output";
import { raydiumDecodeResponse } from "../interfaces/decoderInterfaces";
import { raydiumDecoder } from "./raydium/raydium";
import { WalletCheker } from "./walletfilters";
import { BinanceHotWalletAddress, RaydiumAddress } from "../constants/constants";
const logger = Logger.getInstance();

export class outflowListener {
  private GRPC_Client: Client;
  private GenericDecoder: txDecoder;
  private raydiumDecoder: raydiumDecoder;
  private walletCheker: WalletCheker;
  private isLocked: boolean;

  constructor() {
    this.GRPC_Client = new Client(config.GRPC_END_POINT, undefined, undefined);
    this.GenericDecoder = new txDecoder();
    this.raydiumDecoder = new raydiumDecoder();
    this.walletCheker = new WalletCheker();
    this.isLocked = false;
  }

  init = async (): Promise<void> => {
    const version = await this.GRPC_Client.getVersion();
    logger.info("[+] outflow listener module working");
    logger.info(version);

    const req: SubscribeRequest = {
      slots: {},
      accounts: {},
      transactions: {
        binance: {
          accountInclude: [BinanceHotWalletAddress],
          accountExclude: [],
          accountRequired: [],
          failed: false,
        },
        raydium: {
          accountInclude: [],
          accountExclude: [],
          accountRequired: [RaydiumAddress],
          failed: false,
        },
      },
      blocks: {},
      blocksMeta: { block: [] },
      accountsDataSlice: [],
      commitment: CommitmentLevel.PROCESSED,
      entry: {},
      transactionsStatus: {},
    };

    await this.subscribeCommand(req);
  };

  handleStream = async (args: any): Promise<void> => {
    const stream = await this.GRPC_Client.subscribe();

    const closeStream = (message: string, error?: Error) => {
      if (error) {
        logger.error(`${message}: `, error);
      } else {
        logger.info(message);
      }
      stream.end();
    };

    const streamClosed = new Promise<void>((resolve, reject) => {
      stream.on("error", (error) => {
        closeStream("Stream encountered an error", error);
        reject(error);
      });
      stream.on("end", () => {
        closeStream("Stream ended");
        resolve();
      });
      stream.on("close", () => {
        closeStream("Stream closed");
        resolve();
      });
    });

    try {
      await new Promise((resolve, reject) => {
        stream.write(args, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(false);
          }
        });
      });
    } catch (error) {
      logger.error("Error during subscription request:", error);
      throw error;
    }

    stream.on("data", async (data: any) => {
      await this.handleStreamData(data);
    });

    await streamClosed;
  };

  handleStreamData = async (data: any): Promise<void> => {
    if (!data?.transaction || !data.filters || data.filters.length === 0) {
      return;
    }

    const filterType = data.filters[0];

    switch (filterType) {
      case "binance":
        //await this.handleBinanceFilter(data);
        break;
      case "raydium":
        await this.handleRaydiumFilter(data);
        break;

      default:
        //logger.warn(`Unhandled filter type: ${filterType}`);
        break;
    }
  };

  handleBinanceFilter = async (data: any): Promise<void> => {
    try {
      if (data && !this.isLocked) {
        this.isLocked = true;
        let transactionInfo: basicOutput = await this.GenericDecoder.tOutPut(data);
        await this.processWallet(transactionInfo);
        this.isLocked = false;
        //console.log("transactionInfo: " + JSON.stringify(transactionInfo));
        //process.exit(0);
      }
    } catch (e) {
      console.log(e);
      this.isLocked = false;
    }
  };

  handleRaydiumFilter = async (data: any): Promise<void> => {
    try {
      if (data && !this.isLocked) {
        this.isLocked = true;
        let transactionInfo: raydiumDecodeResponse = await this.raydiumDecoder.decodeRaydium(data);
        if (!transactionInfo.error) {
          let boutput: basicOutput = { SolAmount: transactionInfo.solAmount, ToAddress: transactionInfo.owner, Txn: transactionInfo.signature };
          await this.processWallet(boutput);
        }
        this.isLocked = false;
        //console.log("transactionInfo: " + JSON.stringify(transactionInfo));
        //process.exit(0);
      }
    } catch (e) {
      console.log(e);
      this.isLocked = false;
    }
  };

  processWallet = async (data: basicOutput): Promise<void> => {
    //let result = await this.walletCheker.processWallet(data);
    let result = await this.walletCheker.processWalletUsingAlternativeAPI(data);

    if (result.status) {
      console.log(`[+] https://solscan.io/tx/${data.Txn}`);
      logger.info(`[+] Processing ${data.ToAddress} => ${data.SolAmount} SOL`);
      logger.info("----------------------------------------------------------------------");
      console.log(JSON.stringify(result));
      process.exit();
    } else {
      if (!result.error.includes("does not meet SOL balance criteria")) {
        logger.info(`[${data.ToAddress}] => error: ${result.error}`);
      }
    }

    //let result = await this.processWallet(output);
    //if (result[0]) {
    //  logger.info(`[+] Wallet ${output.ToAddress} qualified for further analysis.`);
    //  console.log(JSON.stringify(result[1]));
    //  process.exit(0);
    //}
  };

  subscribeCommand = async (args: any): Promise<void> => {
    while (true) {
      try {
        await this.handleStream(args);
      } catch (error) {
        logger.info("Stream error, restarting in 3 seconds...", error);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  };
}
