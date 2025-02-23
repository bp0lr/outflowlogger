export interface processResult {
  status: boolean;
  error: string;
  data: ProcessedWalletData;
}

export interface ProcessedWalletData {
  wallet: string;
  portfolio_value_usd: number;
  SOL_balance: number;
  Farming_Attempts: number;
  Total_Tokens: number;
  Farming_Ratio_Percentage: number;
  Winrate: number;
  ROI: number;
  ROI_1d: number;
  Win_Rate_1d: number;
  ROI_7d: number;
  Win_Rate_7d: number;
  ROI_30d: number;
  Win_Rate_30d: number;
  Realized_Gains: number;
  Unrealized_Gains: number;
  Average_Holding_Time_min: number;
  Avg_Buy_Size: number;
  Avg_Profit_Per_Trade: number | null;
  Avg_Loss_Per_Trade: number | null;
}

export interface Summary {
  total?: number | string;
  totalInvested?: number | string;
  unrealized?: number | string;
  winPercentage?: number | string;
  realized?: number | string;
  averageBuyAmount?: number | string;
  // ... otras propiedades
}

export interface HistoricIntervalData {
  percentageChange?: number | string;
  winPercentage?: number | string;
}

export interface PnlData {
  summary?: Summary;
  tokens?: { [tokenAddress: string]: any };
  historic?: {
    summary?: {
      "1d"?: HistoricIntervalData;
      "7d"?: HistoricIntervalData;
      "30d"?: HistoricIntervalData;
    };
    tokens?: { [tokenAddress: string]: any };
  };
}
