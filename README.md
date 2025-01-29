# outflowlogger

Real-Time SOL Outflow Tracker via gRPC
This program listens to the outflow of SOL transactions from a specific address (default case is Binance) using gRPC. 
The received data is processed and displayed in real-time.

## Disclaimer
This project is a Proof of Concept (PoC) and is not intended for production use as-is. It serves as a foundation for further development and customization.

If you want to use this tool in a real-world scenario, you will need to modify, optimize, and expand its functionality according to your specific requirements. The current version provides a basic framework for real-time SOL transaction monitoring but may require additional features and refinements.

Use this project at your own risk, and always verify the accuracy of the data before making any financial decisions. 🚀

## Use Case
This tool is particularly useful for real-time monitoring, allowing users to track large SOL movements from Binance. It can be leveraged for strategies such as copy trading or liquidity analysis.

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js installed (v18 or above recommended) (windows / linux / mac)

## Configurations

1. Clone the repository:

```sh
git clone https://github.com/bp0lr/outflowlogger.git
```

2. Go to the project directory:

```sh
cd outflowlogger
```

3. Install the dependencies:

```sh
npm install
```

4. Rename configs/local/.env.example to configs/local/.env and add your gRPC URL.

`.env` file
```sh
GRPC_END_POINT="http://grpcserver:10000"
```

5. Then run the bot

```sh
npm run dev
```

## Contact me
- [Telegram](https://t.me/@Bp1lr)

- [Github](https://github.com/bp0lr)