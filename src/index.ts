import { outflowListener } from "./outflow/outflowlistener";

import { SolPriceFeed } from "./feed/solprice";
export class MainClass {
  private listener: outflowListener;

  constructor() {
    this.listener = new outflowListener();
  }

  init = async (): Promise<void> => {
    console.log(` `);
    console.log("---. Solana Outflow listener .---");
    console.log(" ");

    await this.listener.init();
  };
}

async function main() {
  let mc = new MainClass();
  await mc.init();
}

main().catch(console.error);
