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
  solanatrackerAPIKey: string | undefined;
  solanatrackerUseFreePlan: boolean | undefined;
  SOL_THRESHOLD: number | undefined;
  WSOL_THRESHOLD: number | undefined;
  FARMING_TIME_THRESHOLD: number | undefined;
  FARMING_RATIO_THRESHOLD: number | undefined;
  WINRATE_LOWER_THRESHOLD: number | undefined;
  WINRATE_UPPER_THRESHOLD: number | undefined;
  REALIZED_GAINS_THRESHOLD: number | undefined;
  TOTAL_TOKENS_MIN: number | undefined;
  ROI_MIN_THRESHOLD: number | undefined;
  ROI_7D_NONZERO: boolean | undefined;
  UNREALIZED_MIN_PERCENT: number | undefined;
  UNREALIZED_MAX_PERCENT: number | undefined;
  UNREALIZED_TO_REALIZED_RATIO: number | undefined;
}

interface Config {
  GRPC_END_POINT: string;
  solanatrackerAPIKey: string;
  solanatrackerUseFreePlan: boolean;
  SOL_THRESHOLD: number;
  WSOL_THRESHOLD: number;
  FARMING_TIME_THRESHOLD: number;
  FARMING_RATIO_THRESHOLD: number;
  WINRATE_LOWER_THRESHOLD: number;
  WINRATE_UPPER_THRESHOLD: number;
  REALIZED_GAINS_THRESHOLD: number;
  TOTAL_TOKENS_MIN: number;
  ROI_MIN_THRESHOLD: number;
  ROI_7D_NONZERO: boolean;
  UNREALIZED_MIN_PERCENT: number;
  UNREALIZED_MAX_PERCENT: number;
  UNREALIZED_TO_REALIZED_RATIO: number;
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
    solanatrackerAPIKey: parseEnv("solanatrackerAPIKey", String),
    solanatrackerUseFreePlan: parseEnv("solanatrackerUseFreePlan", (value) => value === "true"),
    SOL_THRESHOLD: parseEnv("SOL_THRESHOLD", Number),
    WSOL_THRESHOLD: parseEnv("WSOL_THRESHOLD", Number),
    FARMING_TIME_THRESHOLD: parseEnv("FARMING_TIME_THRESHOLD", Number),
    FARMING_RATIO_THRESHOLD: parseEnv("FARMING_RATIO_THRESHOLD", Number),
    WINRATE_LOWER_THRESHOLD: parseEnv("WINRATE_LOWER_THRESHOLD", Number),
    WINRATE_UPPER_THRESHOLD: parseEnv("WINRATE_UPPER_THRESHOLD", Number),
    REALIZED_GAINS_THRESHOLD: parseEnv("REALIZED_GAINS_THRESHOLD", Number),
    TOTAL_TOKENS_MIN: parseEnv("TOTAL_TOKENS_MIN", Number),
    ROI_MIN_THRESHOLD: parseEnv("ROI_MIN_THRESHOLD", Number),
    ROI_7D_NONZERO: parseEnv("ROI_7D_NONZERO", (value) => value === "true"),
    UNREALIZED_MIN_PERCENT: parseEnv("UNREALIZED_MIN_PERCENT", Number),
    UNREALIZED_MAX_PERCENT: parseEnv("UNREALIZED_MAX_PERCENT", Number),
    UNREALIZED_TO_REALIZED_RATIO: parseEnv("UNREALIZED_TO_REALIZED_RATIO", Number),
  };
};

const config = getConfig();

export default config;
