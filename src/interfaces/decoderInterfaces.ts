export interface raydiumDecodeResponse {
  signature: string | undefined;
  error: boolean;
  isBuy: boolean | undefined;
  isFirstBuy: boolean | undefined;
  owner: string | undefined;
  mint: string | undefined;
  solAmount: number | undefined;
}
