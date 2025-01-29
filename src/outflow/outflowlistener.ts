import { CommitmentLevel, SubscribeRequest } from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";
import { tOutPut } from "./decode/tf";
import config from "../utils/config";
import Logger from "../utils/logger";

const logger = Logger.getInstance();

export class outflowListener {
  private GRPC_Client: Client;

  constructor() {
    this.GRPC_Client = new Client(config.GRPC_END_POINT, undefined, undefined);
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
          accountInclude: [config.BinanceHotWalletAddress],
          accountExclude: [],
          accountRequired: [],
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
        await this.handleBinanceFilter(data);
        break;

      default:
        //logger.warn(`Unhandled filter type: ${filterType}`);
        break;
    }
  };

  handleBinanceFilter = async (data: any): Promise<void> => {
    try {
      if (data) {
        const txn = tOutPut(data);

        if (txn?.meta?.preTokenBalances.length == 0) {
          //console.log("txn: " + JSON.stringify(txn));

          let total = (txn.meta.postBalances[2] - txn.meta.preBalances[2]) / 10 ** 9;
          console.log(`[+] https://solscan.io/tx/${txn.signature}`);
          logger.info(`[+] from ${txn.message.accountKeys[0]} => ${txn.message.accountKeys[2]} sent ${total} SOL`);
          logger.info("----------------------------------------------------------------------");

          //process.exit();
        }
      }
    } catch (e) {
      console.log(e);
    }
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
