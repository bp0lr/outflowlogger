import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const loadEnvFilesFromDir = (directory: string, mode: string): void => {
  const envFiles = fs.readdirSync(directory).filter((file) => file.startsWith(".env"));

  envFiles.forEach((file) => {
    const filePath = path.join(directory, file);
    dotenv.config({ path: filePath });
    //console.log(`Loaded environment variables from ${filePath}`);
  });
};

const ENVIRONMENT = process.env.NODE_ENV || "local";
const CONFIG_DIR = path.resolve(__dirname, `../../configs/${ENVIRONMENT}`);

dotenv.config({ path: path.join(CONFIG_DIR, ".env") });
const workingMode = process.env.workingMode || "default";

loadEnvFilesFromDir(CONFIG_DIR, workingMode);

interface ENV {
  GRPC_END_POINT: string | undefined;
  BinanceHotWalletAddress: string | undefined;
}

interface Config {
  GRPC_END_POINT: string;
  BinanceHotWalletAddress: string;
}

const parseEnv = <T>(key: string, parser: (value: string) => T, required = true): T => {
  const value = process.env[key];
  if (value === undefined) {
    if (required) {
      let msg = `Missing required key ${key} in environment variables`;
      throw new Error(msg);
    } else {
      return undefined as unknown as T;
    }
  }
  try {
    return parser(value);
  } catch (err) {
    let msg = `Invalid value for key ${key}: ${err.message}`;
    throw new Error(msg);
  }
};

const getConfig = (): Config => {
  return {
    GRPC_END_POINT: parseEnv("GRPC_END_POINT", String),
    BinanceHotWalletAddress: parseEnv("BinanceHotWalletAddress", String),
  };
};

const config = getConfig();

export default config;
