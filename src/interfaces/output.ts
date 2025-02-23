export interface basicOutput {
  Txn: string;
  SolAmount: number;
  ToAddress: string;
}

/////////////////////////////////////////////////////////////////////////////////
// Solanadata token info
/////////////////////////////////////////////////////////////////////////////////
export interface Price {
  usd: number;
  quote: number;
}

export interface MarketCap {
  usd: number;
  quote: number;
}

export interface Liquidity {
  usd: number;
  quote: number;
}

export interface Token {
  address: string;
  balance: number;
  value: number;
  price: Price;
  marketCap: MarketCap;
  liquidity: Liquidity;
}

export interface TokensResponse {
  tokens: Token[];
  total: number;
  totalSol: number;
}

/////////////////////////////////////////////////////////////////////////////////
// private stats service
/////////////////////////////////////////////////////////////////////////////////

export interface WalletStats {
  sol_balance: string;
  unrealized_profit: number;
  unrealized_pnl: number;
  realized_profit: number;
  pnl: number;
  pnl_7d: number;
  pnl_30d: number;
  realized_profit_7d: number;
  realized_profit_30d: number;
  winrate: number;
  all_pnl: number;
  total_profit: number;
  total_profit_pnl: number;
  buy_30d: number;
  sell_30d: number;
  buy_7d: number;
  sell_7d: number;
  buy: number;
  sell: number;
  history_bought_cost: number;
  token_avg_cost: number;
  token_sold_avg_profit: number;
  token_num: number;
  profit_num: number;
  pnl_lt_minus_dot5_num: number;
  pnl_minus_dot5_0x_num: number;
  pnl_lt_2x_num: number;
  pnl_2x_5x_num: number;
  pnl_gt_5x_num: number;
  tags: string[];
  avg_holding_peroid: number;
}
