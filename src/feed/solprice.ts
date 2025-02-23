// solPriceFeed.ts

import WebSocket from "ws";

export class SolPriceFeed {
  private readonly coinbaseWSURL = "wss://ws-feed.exchange.coinbase.com";
  private readonly productID = "SOL-USD";
  private readonly subscriptionCh = "ticker";
  private readonly reconnectDelay = 5000; // milisegundos

  private ws: WebSocket | null = null;
  private solPrice = 0;

  constructor() {
    this.initMonitorSolPrice();
  }

  public getSOLPrice(): number {
    return this.solPrice;
  }

  private initMonitorSolPrice(): void {
    setImmediate(() => {
      this.connectAndListen();
    });
  }

  private connectAndListen(): void {
    console.info("[CoinBase] Connecting to CoinBase WebSocket feed...");

    this.ws = new WebSocket(this.coinbaseWSURL);

    this.ws.on("open", () => {
      console.info("[CoinBase] connection established.");
      this.subscribeToFeed();
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      let messageStr: string;
      if (typeof data === "string") {
        messageStr = data;
      } else if (Buffer.isBuffer(data)) {
        messageStr = data.toString("utf-8");
      } else {
        messageStr = data.toString();
      }
      this.processMessage(messageStr);
    });

    this.ws.on("close", (code: number, reason: Buffer) => {
      console.log(`[CoinBase] Connection closed (code: ${code}). Error: ${reason.toString()}. ` + `reconnecting in ${this.reconnectDelay / 1000} seconds...`);
      this.scheduleReconnect();
    });

    this.ws.on("error", (err: Error) => {
      console.error(`[CoinBase] error: ${err.message}. ` + `Reconnecting in ${this.reconnectDelay / 1000} seconds...`);
      if (this.ws) {
        this.ws.close();
      }
    });
  }

  private scheduleReconnect(): void {
    setTimeout(() => {
      this.connectAndListen();
    }, this.reconnectDelay);
  }

  private subscribeToFeed(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subMsg = {
        type: "subscribe",
        product_ids: [this.productID],
        channels: [this.subscriptionCh],
      };
      this.ws.send(JSON.stringify(subMsg));
    }
  }

  private processMessage(message: string): void {
    try {
      const tickerMsg = JSON.parse(message);
      if (tickerMsg.type === "ticker" && tickerMsg.product_id === this.productID) {
        const parsedPrice = parseFloat(tickerMsg.price);
        if (!isNaN(parsedPrice)) {
          this.solPrice = parsedPrice;
          //console.info(`[CoinBase] The sol price was updated: ${this.solPrice}`);
        }
      }
    } catch (error) {
      console.error("Catch Error Sol feed:", error);
    }
  }
}

const solFeed = new SolPriceFeed();
export { solFeed };
