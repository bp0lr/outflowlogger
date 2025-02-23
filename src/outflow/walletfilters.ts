import { safeMilliToSec, parseNumber, wait } from "./decode/helpers";
import { processResult, HistoricIntervalData } from "../interfaces/process";
import { TokensResponse, Token, WalletStats } from "../interfaces/output";
import { basicOutput } from "../interfaces/output";
import { httpHelper } from "../utils/httpHelper";
import config from "../utils/config";

import { db } from "../dbManager/nedbManager";
import { solFeed } from "../feed/solprice";

import { WSOL_ADDRESS } from "../constants/constants";

export class WalletCheker {
  private httpH: httpHelper;
  constructor() {
    this.httpH = new httpHelper();
  }

  processWallet = async (dataInfo: basicOutput): Promise<processResult> => {
    try {
      let result: processResult = { status: false, error: "", data: undefined };

      if (dataInfo.SolAmount < config.SOL_THRESHOLD) {
        //console.log(`Wallet ${dataInfo.ToAddress} does not meet SOL balance criteria (SOL: ${dataInfo.SolAmount}).`);
        result.error = `Wallet ${dataInfo.ToAddress} does not meet SOL balance criteria (SOL: ${dataInfo.SolAmount})`;
        return result;
      }

      let alreadyProcess = await db.returnProcessedTokensDBInstance().countAsync({ uniqueID: dataInfo.ToAddress });
      if (alreadyProcess) {
        result.error = `Wallet ${dataInfo.ToAddress} was already processed`;
        return result;
      }

      await db.returnProcessedTokensDBInstance().insertAsync({ uniqueID: dataInfo.ToAddress });

      console.debug(`Processing wallet: ${dataInfo.ToAddress}`);

      // Llamada simultánea a las funciones de API
      let basicData: TokensResponse = await this.httpH.sendGet(`https://data.solanatracker.io/wallet/${dataInfo.ToAddress}/basic`);

      if (!basicData) {
        console.log(`Wallet ${dataInfo.ToAddress}: basicData API data retrieval failed.`);
        result.error = `Wallet ${dataInfo.ToAddress}: basicData API data retrieval failed.`;
        return result;
      }

      // 1) Calcular valor del portafolio en USD
      let totalSol = basicData.totalSol || 0;
      let portfolioValue = totalSol * solFeed.getSOLPrice();
      console.log(`https://data.solanatracker.io/wallet/${dataInfo.ToAddress}/basic`);
      console.log(JSON.stringify(basicData));
      console.log(`Wallet ${dataInfo.ToAddress}: (total sol: ${totalSol}) Portfolio Value = ${portfolioValue} USD (sol value: ${solFeed.getSOLPrice()})`);

      // 2) Verificar balance en WSOL
      //let tokens: Token[] = basicData.tokens || [];
      let tokens: Token[] = basicData.tokens || [];

      let wsolBalance = 0;
      for (let t of tokens) {
        if (t.address === WSOL_ADDRESS) {
          wsolBalance = t.balance || 0;
          break;
        }
      }
      if (totalSol < config.SOL_THRESHOLD && wsolBalance < config.WSOL_THRESHOLD) {
        console.log(`Wallet ${dataInfo.ToAddress} does not meet SOL/WSOL balance criteria (SOL: ${totalSol}, WSOL Balance: ${wsolBalance}).`);
        result.error = `Wallet ${dataInfo.ToAddress} does not meet SOL/WSOL balance criteria (SOL: ${totalSol}, WSOL Balance: ${wsolBalance})`;
        return result;
      }

      // FREE PLAN NEED TO WAIT 1 SECOND BETWEEN REQUESTS
      /////////////////////////////////////////////////////////////////////////////
      if (config.solanatrackerUseFreePlan) {
        wait(1100);
      }

      // I have moved the pnldata retrieval to this point because the wallet can be disqualified before and there is no need to make the request until we really need it
      let pnlData: any = await this.httpH.sendGet(`https://data.solanatracker.io//pnl/${dataInfo.ToAddress}?showHistoricPnL=true`);
      if (!pnlData) {
        console.log(`Wallet ${dataInfo.ToAddress}: basicData API data retrieval failed.`);
        result.error = `Wallet ${dataInfo.ToAddress}: basicData API data retrieval failed.`;
        return result;
      }

      // 3) Verificar la sección summary en PnL
      let summary = pnlData.summary;
      if (!summary) {
        console.log(`Wallet ${dataInfo.ToAddress}: 'summary' section missing in PnL data.`);
        result.error = `Wallet ${dataInfo.ToAddress}: 'summary' section missing in PnL data.`;
        return result;
      }

      let totalPnl = summary.total == null ? 0 : parseNumber(summary.total, 0);
      if (totalPnl < 0) {
        console.log(`Wallet ${dataInfo.ToAddress} disqualified due to negative total PnL: ${totalPnl}`);
        result.error = `Wallet ${dataInfo.ToAddress} disqualified due to negative total PnL: ${totalPnl}`;
        return result;
      }

      let totalInvested = summary.totalInvested;
      if (totalInvested == null || parseNumber(totalInvested) === 0) {
        console.log(`Wallet ${dataInfo.ToAddress}: 'totalInvested' is ${totalInvested}. Disqualifying wallet due to invalid investment data.`);
        result.error = `Wallet ${dataInfo.ToAddress}: 'totalInvested' is ${totalInvested}. Disqualifying wallet due to invalid investment data.`;
        return result;
      }
      totalInvested = parseNumber(totalInvested);

      // 4) FILTRO: Ganancias no realizadas (Unrealized Gains)
      let unrealizedGains = parseNumber(summary.unrealized, 0);
      let minUnrealized = -(config.UNREALIZED_MIN_PERCENT / 100) * portfolioValue;
      if (unrealizedGains < minUnrealized) {
        console.log(`Wallet ${dataInfo.ToAddress} disqualified due to unrealized gains ${unrealizedGains} < ${minUnrealized} (-${config.UNREALIZED_MIN_PERCENT}% of portfolio value).`);
        result.error = `Wallet ${dataInfo.ToAddress} disqualified due to unrealized gains ${unrealizedGains} < ${minUnrealized} (-${config.UNREALIZED_MIN_PERCENT}% of portfolio value).`;
        return result;
      }
      let maxUnrealized = (config.UNREALIZED_MAX_PERCENT / 100) * portfolioValue;
      if (unrealizedGains > maxUnrealized) {
        console.log(`Wallet ${dataInfo.ToAddress} disqualified due to unrealized gains ${unrealizedGains} > ${maxUnrealized} (${config.UNREALIZED_MAX_PERCENT}% of portfolio value).`);
        result.error = `Wallet ${dataInfo.ToAddress} disqualified due to unrealized gains ${unrealizedGains} > ${maxUnrealized} (${config.UNREALIZED_MAX_PERCENT}% of portfolio value).`;
        return result;
      }

      // 5) Calcular ROI
      let roi: number;
      try {
        roi = (totalPnl / totalInvested) * 100;
      } catch (error) {
        console.log(`Wallet ${dataInfo.ToAddress} - Error calculating ROI:`, error);
        result.error = `Wallet ${dataInfo.ToAddress} - Error calculating ROI: ${error}`;
        return result;
      }

      // 6) Calcular Farming Ratio
      let tokensPnl = pnlData.tokens || {};
      let totalTokens = Object.keys(tokensPnl).length;
      let farmingAttempts = 0;
      let holdingTimes: number[] = [];

      for (let tokenAddress in tokensPnl) {
        let tinfo = tokensPnl[tokenAddress];
        let lastBuy = safeMilliToSec(tinfo.last_buy_time);
        let lastSell = safeMilliToSec(tinfo.last_sell_time);
        let firstBuy = safeMilliToSec(tinfo.first_buy_time);

        if (lastBuy === 0) continue;

        let timeDiff = lastSell - lastBuy;
        if (timeDiff > 0 && timeDiff < config.FARMING_TIME_THRESHOLD) {
          farmingAttempts++;
        }

        let holdingTime = lastSell - firstBuy;
        if (holdingTime > 0) {
          holdingTimes.push(holdingTime);
        }
      }

      let farmingRatio = totalTokens > 0 ? farmingAttempts / totalTokens : 0;
      if (farmingRatio > config.FARMING_RATIO_THRESHOLD) {
        console.log(`Wallet ${dataInfo.ToAddress} disqualified due to farming ratio ${(farmingRatio * 100).toFixed(2)}% > ${(config.FARMING_RATIO_THRESHOLD * 100).toFixed(2)}%.`);
        result.error = `Wallet ${dataInfo.ToAddress} disqualified due to farming ratio ${(farmingRatio * 100).toFixed(2)}% > ${(config.FARMING_RATIO_THRESHOLD * 100).toFixed(2)}%.`;
        return result;
      }

      // 7) Verificar winrate
      let winrate = summary.winPercentage;
      if (typeof winrate === "number" || typeof winrate === "string") {
        winrate = parseNumber(winrate);
        winrate = Math.max(0, Math.min(100, winrate));
        if (winrate < config.WINRATE_LOWER_THRESHOLD || winrate > config.WINRATE_UPPER_THRESHOLD) {
          console.log(`Wallet ${dataInfo.ToAddress} disqualified due to winrate ${winrate.toFixed(2)}% not within [${config.WINRATE_LOWER_THRESHOLD}%, ${config.WINRATE_UPPER_THRESHOLD}%].`);
          result.error = `Wallet ${dataInfo.ToAddress} disqualified due to winrate ${winrate.toFixed(2)}% not within [${config.WINRATE_LOWER_THRESHOLD}%, ${config.WINRATE_UPPER_THRESHOLD}%].`;
          return result;
        }
      } else {
        console.log(`Wallet ${dataInfo.ToAddress} disqualified due to invalid winrate value: ${winrate}.`);
        result.error = `Wallet ${dataInfo.ToAddress} disqualified due to invalid winrate value: ${winrate}.`;
        return result;
      }

      // 8) FILTRO: Ganancias realizadas (Realized Gains)
      let realizedGains = parseNumber(summary.realized, 0);
      if (realizedGains < config.REALIZED_GAINS_THRESHOLD) {
        console.log(`Wallet ${dataInfo.ToAddress} disqualified due to realized gains $${realizedGains.toFixed(2)} < threshold $${config.REALIZED_GAINS_THRESHOLD}.`);
        result.error = `Wallet ${dataInfo.ToAddress} disqualified due to realized gains $${realizedGains.toFixed(2)} < threshold $${config.REALIZED_GAINS_THRESHOLD}.`;
        return result;
      }

      // 9) FILTRO: Unrealized gains no deben ser >= UNREALIZED_TO_REALIZED_RATIO * realizedGains
      if (realizedGains > 0 && unrealizedGains >= config.UNREALIZED_TO_REALIZED_RATIO * realizedGains) {
        console.log(`Wallet ${dataInfo.ToAddress} disqualified because unrealized gains ($${unrealizedGains.toFixed(2)}) >= ${config.UNREALIZED_TO_REALIZED_RATIO * 100}% of realized gains ($${realizedGains.toFixed(2)}).`);
        result.error = `Wallet ${dataInfo.ToAddress} disqualified because unrealized gains ($${unrealizedGains.toFixed(2)}) >= ${config.UNREALIZED_TO_REALIZED_RATIO * 100}% of realized gains ($${realizedGains.toFixed(2)}).`;
        return result;
      }

      // Calcular el tiempo promedio de holding en minutos
      let avgHolding = 0;
      if (holdingTimes.length > 0) {
        avgHolding = holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length;
        avgHolding /= 60; // Convertir de segundos a minutos
      }

      // 10) Extraer ROI y winrate históricos
      let historicSummary = pnlData.historic?.summary || {};
      let roi_1d = 0,
        roi_7d = 0,
        roi_30d = 0;
      let winrate_1d = 0,
        winrate_7d = 0,
        winrate_30d = 0;

      for (let interval of ["1d", "7d", "30d"]) {
        let intervalData: HistoricIntervalData = historicSummary[interval] || {};
        let percentageChange = parseNumber(intervalData.percentageChange, 0);
        let winPercentage = parseNumber(intervalData.winPercentage, 0);
        winPercentage = Math.max(0, Math.min(100, winPercentage));

        if (interval === "1d") {
          roi_1d = percentageChange;
          winrate_1d = winPercentage;
        } else if (interval === "7d") {
          roi_7d = percentageChange;
          winrate_7d = winPercentage;
        } else if (interval === "30d") {
          roi_30d = percentageChange;
          winrate_30d = winPercentage;
        }
      }

      // 11) FILTRO: Debe haber al menos TOTAL_TOKENS_MIN tokens
      if (totalTokens < config.TOTAL_TOKENS_MIN) {
        console.log(`Wallet ${dataInfo.ToAddress} disqualified due to total tokens ${totalTokens} < ${config.TOTAL_TOKENS_MIN}.`);
        result.error = `Wallet ${dataInfo.ToAddress} disqualified due to total tokens ${totalTokens} < ${config.TOTAL_TOKENS_MIN}.`;
        return result;
      }

      // 12) FILTRO: Si ROI_7D_NONZERO está activado, disqualificar si ROI 7d es 0%
      if (config.ROI_7D_NONZERO && roi_7d === 0) {
        console.log(`Wallet ${dataInfo.ToAddress} disqualified due to ROI_7d being exactly 0%.`);
        result.error = `Wallet ${dataInfo.ToAddress} disqualified due to ROI_7d being exactly 0%.`;
        return result;
      }

      // 13) FILTRO: Disqualificar si algún ROI (1d, 7d, 30d) es menor que ROI_MIN_THRESHOLD
      if (roi_1d < config.ROI_MIN_THRESHOLD || roi_7d < config.ROI_MIN_THRESHOLD || roi_30d < config.ROI_MIN_THRESHOLD) {
        console.log(`Wallet ${dataInfo.ToAddress} disqualified due to ROI thresholds: ROI_1d=${roi_1d.toFixed(2)}%, ROI_7d=${roi_7d.toFixed(2)}%, ROI_30d=${roi_30d.toFixed(2)}% below minimum threshold of ${config.ROI_MIN_THRESHOLD}%.`);
        result.error = `Wallet ${dataInfo.ToAddress} disqualified due to ROI thresholds: ROI_1d=${roi_1d.toFixed(2)}%, ROI_7d=${roi_7d.toFixed(2)}%, ROI_30d=${roi_30d.toFixed(2)}% below minimum threshold of ${config.ROI_MIN_THRESHOLD}%.`;
        return result;
      }

      // 14) NUEVA columna: "Avg Buy Size"
      let avgBuySize = parseNumber(summary.averageBuyAmount, 0);

      // 15) Calcular mayor ganancia/pérdida porcentual en trades a 30 días
      let historicTokens = pnlData.historic?.tokens || {};
      let profitPercentages: number[] = [];
      let lossPercentages: number[] = [];

      for (let tokenAddress in historicTokens) {
        let tokenData = historicTokens[tokenAddress];
        let thirtyDMetrics = tokenData["30d"]?.metrics || {};
        let totalPnlToken = thirtyDMetrics.total;
        let totalInvestedToken = thirtyDMetrics.total_invested;
        if (totalPnlToken != null && totalInvestedToken) {
          totalPnlToken = parseNumber(totalPnlToken);
          totalInvestedToken = parseNumber(totalInvestedToken);
          if (totalInvestedToken === 0) {
            console.log(`Wallet ${dataInfo.ToAddress}, Token ${tokenAddress}: total_invested is 0. Skipping PnL calculation.`);
            continue;
          }
          let pnlPercent = (totalPnlToken / totalInvestedToken) * 100;
          if (pnlPercent > 0) {
            profitPercentages.push(pnlPercent);
          } else if (pnlPercent < 0) {
            lossPercentages.push(pnlPercent);
          }
        }
      }

      let avgProfitPercent = profitPercentages.length ? profitPercentages.reduce((a, b) => a + b, 0) / profitPercentages.length : null;
      let avgLossPercent = lossPercentages.length ? lossPercentages.reduce((a, b) => a + b, 0) / lossPercentages.length : null;

      if (avgProfitPercent === null) {
        console.info(`Wallet ${dataInfo.ToAddress}: Avg Profit % Per Trade is 0 or no profitable trades.`);
      }
      if (avgLossPercent === null) {
        console.info(`Wallet ${dataInfo.ToAddress}: Avg Loss % Per Trade is 0 or no losing trades.`);
      }

      console.debug(
        `Qualified Wallet: ${dataInfo.ToAddress} | Portfolio Value: ${portfolioValue.toFixed(2)} USD | ROI: ${roi.toFixed(2)}% | ROI 1d: ${roi_1d.toFixed(2)}% | Win Rate 1d: ${winrate_1d.toFixed(2)}% | ROI 7d: ${roi_7d.toFixed(2)}% | Win Rate 7d: ${winrate_7d.toFixed(2)}% | ROI 30d: ${roi_30d.toFixed(2)}% | Win Rate 30d: ${winrate_30d.toFixed(2)}% | Realized Gains: $${realizedGains.toFixed(2)} | Unrealized Gains: $${unrealizedGains.toFixed(
          2
        )} | Farming Attempts: ${farmingAttempts} | Total Tokens: ${totalTokens} | Avg Buy Size: $${avgBuySize.toFixed(2)} | Avg Profit %: ${avgProfitPercent !== null ? avgProfitPercent.toFixed(2) : "-"}% | Avg Loss %: ${avgLossPercent !== null ? avgLossPercent.toFixed(2) : "-"}% | Average Holding Time: ${avgHolding.toFixed(2)} minutes`
      );

      let processedData = {
        wallet: dataInfo.ToAddress,
        portfolio_value_usd: portfolioValue,
        SOL_balance: wsolBalance,
        Farming_Attempts: farmingAttempts,
        Total_Tokens: totalTokens,
        Farming_Ratio_Percentage: farmingRatio * 100,
        Winrate: winrate,
        ROI: roi,
        ROI_1d: roi_1d,
        Win_Rate_1d: winrate_1d,
        ROI_7d: roi_7d,
        Win_Rate_7d: winrate_7d,
        ROI_30d: roi_30d,
        Win_Rate_30d: winrate_30d,
        Realized_Gains: realizedGains,
        Unrealized_Gains: unrealizedGains,
        Average_Holding_Time_min: avgHolding,
        Avg_Buy_Size: avgBuySize,
        Avg_Profit_Per_Trade: avgProfitPercent,
        Avg_Loss_Per_Trade: avgLossPercent,
      };

      result.status = true;
      result.data = processedData;
      return result;
    } catch (error) {
      console.log(`Error processing wallet ${dataInfo.ToAddress}:`, error);
      return { status: false, error: `Error processing wallet ${dataInfo.ToAddress}: ${error}`, data: undefined };
    }
  };

  processWalletUsingAlternativeAPI = async (dataInfo: basicOutput): Promise<processResult> => {
    let result: processResult = { status: false, error: "", data: undefined };

    if (dataInfo.SolAmount < 1) {
      //console.log(`Wallet ${dataInfo.ToAddress} does not meet SOL balance criteria (SOL: ${dataInfo.SolAmount}).`);
      result.error = `Wallet ${dataInfo.ToAddress} does not meet SOL balance criteria (SOL: ${dataInfo.SolAmount})`;
      return result;
    }

    let alreadyProcess = await db.returnProcessedTokensDBInstance().countAsync({ uniqueID: dataInfo.ToAddress });
    if (alreadyProcess) {
      result.error = `Wallet ${dataInfo.ToAddress} was already processed`;
      return result;
    }

    await db.returnProcessedTokensDBInstance().insertAsync({ uniqueID: dataInfo.ToAddress });

    console.debug(`Processing wallet: ${dataInfo.ToAddress}`);

    // Llamada simultánea a las funciones de API
    let basicData: WalletStats = await this.httpH.sendGet(`http://162.33.177.20/api/wallet/stats?address=${dataInfo.ToAddress}`);

    if (!basicData) {
      console.log(`Wallet ${dataInfo.ToAddress}: basicData API data retrieval failed.`);
      result.error = `Wallet ${dataInfo.ToAddress}: basicData API data retrieval failed.`;
      return result;
    }

    let sol_balance = parseFloat(parseFloat(basicData.sol_balance).toFixed(2));

    if (sol_balance < 5) {
      result.error = `Wallet ${dataInfo.ToAddress} less than 10 sol_balance (${sol_balance})`;
      return result;
    }

    if (basicData.buy_7d < 50 || basicData.buy_7d > 300) {
      result.error = `Wallet ${dataInfo.ToAddress} less than 50 or more than 200 buy_7d`;
      return result;
    }

    if (basicData.winrate < 0.5) {
      result.error = `Wallet ${dataInfo.ToAddress} less than 0.50 winrate`;
      return result;
    }

    if (basicData.realized_profit_7d < 750 || basicData.realized_profit_7d > 4000) {
      result.error = `Wallet ${dataInfo.ToAddress} less than 1000 or more than 5000 realized_profit_7d`;
      return result;
    }

    if (basicData.pnl < 0.3) {
      result.error = `Wallet ${dataInfo.ToAddress} less than 0.30 pnl`;
      return result;
    }

    if (basicData.pnl_7d < 0.3) {
      result.error = `Wallet ${dataInfo.ToAddress} less than 0.30 pnl_7d`;
      return result;
    }

    if (basicData.pnl_30d < 0.3) {
      result.error = `Wallet ${dataInfo.ToAddress} less than 0.30 pnl_30d`;
      return result;
    }

    console.log(JSON.stringify(basicData));
    process.exit();

    return result;
  };
}
