import type {
  HoldingPosition,
  MarketEvent,
  OhlcBar,
  ProjectedPoint,
  ScenarioStage,
  SimulationConfig,
  SimulationResult,
  TradeExecution,
} from '../types/market';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createNormalSampler(rng: () => number): () => number {
  return () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };
}

export function generateFutureTradingDates(lastDateStr: string, count: number): string[] {
  const result: string[] = [];
  const base = new Date(`${lastDateStr}T00:00:00Z`);
  const cursor = Number.isNaN(base.getTime()) ? new Date() : base;

  while (result.length < count) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      result.push(cursor.toISOString().slice(0, 10));
    }
  }
  return result;
}

export function generateHistoricalBars(
  endPrice: number,
  days: number,
  annualDriftPct: number,
  annualVolPct: number,
  baseVolume: number,
  seed: number,
  endDateStr = '2026-11-16',
): OhlcBar[] {
  const rng = mulberry32(seed);
  const randn = createNormalSampler(rng);
  const dt = 1 / 252;
  const mu = annualDriftPct / 100;
  const sigma = annualVolPct / 100;

  // Build backwards or forward then scale to hit endPrice cleanly
  const closes: number[] = [100];
  for (let i = 1; i < days; i += 1) {
    const z = randn();
    const ret = (mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z;
    closes.push(closes[i - 1] * Math.exp(ret));
  }

  const scale = endPrice / closes[closes.length - 1];
  const dates: string[] = [];
  const cursor = new Date(`${endDateStr}T00:00:00Z`);
  while (dates.length < days) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.unshift(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const bars: OhlcBar[] = [];
  for (let i = 0; i < days; i += 1) {
    const close = Number((closes[i] * scale).toFixed(2));
    const prevClose = i === 0 ? close * (1 + (rng() - 0.5) * 0.01) : bars[i - 1].close;
    const gap = (rng() - 0.5) * sigma * Math.sqrt(dt) * 0.45;
    const open = Number(Math.max(0.01, prevClose * (1 + gap)).toFixed(2));
    const intradayRange = Math.abs(randn()) * sigma * Math.sqrt(dt) * 0.65;
    const high = Number((Math.max(open, close) * (1 + intradayRange * 0.65)).toFixed(2));
    const low = Number(Math.max(0.01, Math.min(open, close) * (1 - intradayRange * 0.65)).toFixed(2));
    const moveFactor = 1 + Math.min(2.2, Math.abs(close - open) / Math.max(0.01, open) * 35);
    const volume = Math.round(baseVolume * (0.65 + rng() * 0.7) * moveFactor);

    bars.push({
      date: dates[i],
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return bars;
}

function getStageForDay(stages: ScenarioStage[], dayIndex: number, fallback: ScenarioStage): ScenarioStage {
  if (!stages.length) return fallback;
  let acc = 0;
  for (const st of stages) {
    acc += Math.max(1, st.days);
    if (dayIndex <= acc) {
      return st;
    }
  }
  return stages[stages.length - 1];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function computeMaxDrawdown(series: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const val of series) {
    if (val > peak) peak = val;
    if (peak > 0) {
      const dd = ((peak - val) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

export function runSimulation(
  bars: OhlcBar[],
  position: HoldingPosition,
  config: SimulationConfig,
): SimulationResult {
  const lastBar = bars[bars.length - 1];
  const startPrice = lastBar ? lastBar.close : 100;
  const avgHistVol =
    bars.length > 0
      ? bars.slice(-20).reduce((sum, b) => sum + b.volume, 0) / Math.min(20, bars.length)
      : 1000000;

  const horizon = Math.max(5, Math.min(252, Math.round(config.horizonDays)));
  const numPaths = Math.max(40, Math.min(1000, Math.round(config.mcPaths)));
  const dt = 1 / 252;

  const rng = mulberry32(config.seed || 20261116);
  const randn = createNormalSampler(rng);

  const fallbackStage: ScenarioStage = {
    id: 'default',
    name: '基准趋势',
    days: horizon,
    annualDriftPct: config.annualDriftPct,
    annualVolPct: config.annualVolPct,
    meanReversion: config.meanReversion,
  };

  const activeEvents = config.events.filter((ev) => ev.enabled && ev.dayOffset >= 1 && ev.dayOffset <= horizon);
  const eventMap = new Map<number, MarketEvent[]>();
  for (const ev of activeEvents) {
    const list = eventMap.get(ev.dayOffset) || [];
    list.push(ev);
    eventMap.set(ev.dayOffset, list);
  }

  const dates = generateFutureTradingDates(lastBar?.date || '2026-11-16', horizon);

  // Matrix: paths[p][t] where t in 0..horizon-1
  const paths: number[][] = Array.from({ length: numPaths }, () => new Array(horizon).fill(startPrice));
  const stageNames: string[] = new Array(horizon).fill('');

  // Precompute day stage & vol multiplier
  const dayParams = Array.from({ length: horizon }, (_, idx) => {
    const dayIndex = idx + 1;
    const stage =
      config.mode === 'scenario'
        ? getStageForDay(config.stages, dayIndex, fallbackStage)
        : fallbackStage;
    stageNames[idx] = stage.name;

    // Event impact and temporary vol boost (decays over 5 trading days)
    let shockPct = 0;
    let volBoost = 1;
    for (const ev of activeEvents) {
      if (ev.dayOffset === dayIndex) {
        shockPct += ev.impactPct;
      }
      const dist = dayIndex - ev.dayOffset;
      if (dist >= 0 && dist <= 5) {
        const decay = 1 - dist / 6;
        volBoost *= 1 + (ev.volMultiplier - 1) * decay;
      }
    }

    return {
      mu: stage.annualDriftPct / 100,
      sigma: (stage.annualVolPct / 100) * volBoost,
      kappa: stage.meanReversion,
      shockFactor: Math.max(0.2, 1 + shockPct / 100),
    };
  });

  // Simulate all paths
  for (let p = 0; p < numPaths; p += 1) {
    let price = startPrice;
    let anchor = startPrice;
    for (let t = 0; t < horizon; t += 1) {
      const { mu, sigma, kappa, shockFactor } = dayParams[t];
      // Expected drifting anchor for mean reversion
      anchor = anchor * Math.exp(mu * dt);
      const reversionTerm = kappa > 0 ? kappa * Math.log(anchor / Math.max(0.01, price)) * dt : 0;
      const z = randn();
      const logRet = (mu - 0.5 * sigma * sigma) * dt + reversionTerm + sigma * Math.sqrt(dt) * z;
      price = Math.max(0.01, price * Math.exp(logRet) * shockFactor);
      paths[p][t] = Number(price.toFixed(2));
    }
  }

  // Pick path[0] as the active interactive path (resampling changes seed -> changes path[0])
  const activeCloses = paths[0];
  const samplePaths = paths.slice(0, Math.min(18, numPaths));

  // Build OHLC + Portfolio sandbox progression for the active path
  let shares = Math.max(0, position.shares);
  let avgCost = Math.max(0, position.avgCost);
  let cash = Math.max(0, position.cashReserve);
  let realizedPnl = 0;
  let takeProfitExecuted = false;
  let stopLossExecuted = false;

  const initialEquity = cash + shares * startPrice;
  const allExecutions: TradeExecution[] = [];
  const points: ProjectedPoint[] = [];

  for (let t = 0; t < horizon; t += 1) {
    const dayIndex = t + 1;
    const date = dates[t];
    const dayEvents = eventMap.get(dayIndex) || [];

    // Cross-sectional percentiles
    const col = paths.map((arr) => arr[t]).sort((a, b) => a - b);
    const p10 = Number(quantile(col, 0.1).toFixed(2));
    const p25 = Number(quantile(col, 0.25).toFixed(2));
    const p50 = Number(quantile(col, 0.5).toFixed(2));
    const p75 = Number(quantile(col, 0.75).toFixed(2));
    const p90 = Number(quantile(col, 0.9).toFixed(2));

    const prevClose = t === 0 ? startPrice : activeCloses[t - 1];
    const activeClose = activeCloses[t];
    const { sigma } = dayParams[t];
    const gapNoise = (rng() - 0.5) * sigma * Math.sqrt(dt) * 0.35;
    const activeOpen = Number(Math.max(0.01, prevClose * (1 + gapNoise)).toFixed(2));
    const wickSpread = Math.abs(randn()) * sigma * Math.sqrt(dt) * 0.55;
    const activeHigh = Number((Math.max(activeOpen, activeClose) * (1 + wickSpread)).toFixed(2));
    const activeLow = Number(Math.max(0.01, Math.min(activeOpen, activeClose) * (1 - wickSpread)).toFixed(2));
    const moveScale = 1 + Math.min(2.5, Math.abs(activeClose - prevClose) / Math.max(0.01, prevClose) * 32);
    const eventVolScale = dayEvents.length > 0 ? 1.45 : 1;
    const activeVolume = Math.round(avgHistVol * (0.7 + rng() * 0.6) * moveScale * eventVolScale);

    const tradesTriggered: TradeExecution[] = [];

    const executeBuy = (targetShares: number, execPrice: number, reason: string) => {
      const affordable = Math.floor(cash / execPrice);
      const qty = Math.min(targetShares, affordable);
      if (qty <= 0) return;
      const amount = Number((qty * execPrice).toFixed(2));
      const newTotalShares = shares + qty;
      avgCost = newTotalShares > 0 ? (shares * avgCost + amount) / newTotalShares : execPrice;
      shares = newTotalShares;
      cash = Number((cash - amount).toFixed(2));
      const exec: TradeExecution = {
        dayIndex,
        date,
        action: 'BUY',
        shares: qty,
        price: execPrice,
        amount,
        reason,
      };
      tradesTriggered.push(exec);
      allExecutions.push(exec);
    };

    const executeSell = (targetShares: number, execPrice: number, reason: string) => {
      const qty = Math.min(targetShares, shares);
      if (qty <= 0) return;
      const amount = Number((qty * execPrice).toFixed(2));
      realizedPnl += (execPrice - avgCost) * qty;
      shares -= qty;
      if (shares === 0) avgCost = 0;
      cash = Number((cash + amount).toFixed(2));
      const exec: TradeExecution = {
        dayIndex,
        date,
        action: 'SELL',
        shares: qty,
        price: execPrice,
        amount,
        reason,
      };
      tradesTriggered.push(exec);
      allExecutions.push(exec);
    };

    // 1. Periodic DCA
    if (
      config.dcaEnabled &&
      config.dcaIntervalDays > 0 &&
      config.dcaAmount > 0 &&
      dayIndex % config.dcaIntervalDays === 0
    ) {
      const qty = Math.floor(config.dcaAmount / activeClose);
      if (qty > 0) {
        executeBuy(qty, activeClose, `定期定投 (每${config.dcaIntervalDays}交易日)`);
      }
    }

    // 2. Scheduled manual sandbox trades
    for (const tr of config.scheduledTrades) {
      if (!tr.enabled || tr.dayOffset !== dayIndex || tr.value <= 0) continue;
      if (tr.action === 'BUY') {
        const qty = tr.mode === 'SHARES' ? Math.floor(tr.value) : Math.floor(tr.value / activeClose);
        executeBuy(qty, activeClose, tr.note || '计划加仓');
      } else {
        const qty = tr.mode === 'SHARES' ? Math.floor(tr.value) : Math.floor(tr.value / activeClose);
        executeSell(qty, activeClose, tr.note || '计划减仓');
      }
    }

    // 3. Conditional Take Profit
    if (
      !takeProfitExecuted &&
      position.takeProfitPrice != null &&
      position.takeProfitPrice > 0 &&
      activeHigh >= position.takeProfitPrice &&
      shares > 0 &&
      config.autoTakeProfitSellPct > 0
    ) {
      const qty = Math.max(1, Math.round((shares * config.autoTakeProfitSellPct) / 100));
      executeSell(qty, position.takeProfitPrice, `触及止盈线 (${position.takeProfitPrice.toFixed(2)})`);
      takeProfitExecuted = true;
    }

    // 4. Conditional Stop Loss
    if (
      !stopLossExecuted &&
      position.stopLossPrice != null &&
      position.stopLossPrice > 0 &&
      activeLow <= position.stopLossPrice &&
      shares > 0 &&
      config.autoStopLossSellPct > 0
    ) {
      const qty = Math.max(1, Math.round((shares * config.autoStopLossSellPct) / 100));
      executeSell(qty, position.stopLossPrice, `触及止损线 (${position.stopLossPrice.toFixed(2)})`);
      stopLossExecuted = true;
    }

    const marketVal = shares * activeClose;
    const totalEquity = Number((cash + marketVal).toFixed(2));
    const costBasisTotal = Number((shares * avgCost).toFixed(2));
    const unrealizedPnl = Number(((activeClose - avgCost) * shares).toFixed(2));
    const totalPnl = Number((realizedPnl + unrealizedPnl).toFixed(2));
    const totalReturnPct =
      initialEquity > 0 ? Number((((totalEquity - initialEquity) / initialEquity) * 100).toFixed(2)) : 0;

    points.push({
      dayIndex,
      date,
      p10,
      p25,
      p50,
      p75,
      p90,
      activeOpen,
      activeHigh,
      activeLow,
      activeClose,
      activeVolume,
      stageName: stageNames[t],
      eventsTriggered: dayEvents,
      tradesTriggered,
      positionShares: shares,
      positionAvgCost: Number(avgCost.toFixed(2)),
      cashBalance: cash,
      totalEquity,
      costBasisTotal,
      realizedPnl: Number(realizedPnl.toFixed(2)),
      unrealizedPnl,
      totalPnl,
      totalReturnPct,
    });
  }

  // Cross-path summary statistics
  const finalPrices = paths.map((arr) => arr[horizon - 1]);
  const winCount = finalPrices.filter((p) => p > startPrice).length;

  let hitTpCount = 0;
  let hitSlCount = 0;
  const drawdowns: number[] = [];

  for (const path of paths) {
    drawdowns.push(computeMaxDrawdown([startPrice, ...path]));
    if (position.takeProfitPrice != null && path.some((p) => p >= position.takeProfitPrice!)) {
      hitTpCount += 1;
    }
    if (position.stopLossPrice != null && path.some((p) => p <= position.stopLossPrice!)) {
      hitSlCount += 1;
    }
  }

  drawdowns.sort((a, b) => a - b);

  const lastPoint = points[points.length - 1];
  const p50Final = lastPoint ? lastPoint.p50 : startPrice;
  const activeFinal = lastPoint ? lastPoint.activeClose : startPrice;

  return {
    points,
    samplePaths,
    allExecutions,
    summary: {
      startPrice,
      p10FinalPrice: lastPoint ? lastPoint.p10 : startPrice,
      p50FinalPrice: p50Final,
      p90FinalPrice: lastPoint ? lastPoint.p90 : startPrice,
      activeFinalPrice: activeFinal,
      expectedReturnPct: Number((((p50Final - startPrice) / startPrice) * 100).toFixed(2)),
      activeReturnPct: Number((((activeFinal - startPrice) / startPrice) * 100).toFixed(2)),
      winProbabilityPct: Number(((winCount / numPaths) * 100).toFixed(1)),
      hitTakeProfitPct: Number(((hitTpCount / numPaths) * 100).toFixed(1)),
      hitStopLossPct: Number(((hitSlCount / numPaths) * 100).toFixed(1)),
      maxDrawdownP50Pct: Number(quantile(drawdowns, 0.5).toFixed(2)),
      maxDrawdownP90Pct: Number(quantile(drawdowns, 0.9).toFixed(2)),
      activeMaxDrawdownPct: Number(computeMaxDrawdown([startPrice, ...activeCloses]).toFixed(2)),
      finalEquity: lastPoint ? lastPoint.totalEquity : initialEquity,
      finalShares: lastPoint ? lastPoint.positionShares : shares,
      finalCash: lastPoint ? lastPoint.cashBalance : cash,
      finalTotalPnl: lastPoint ? lastPoint.totalPnl : 0,
      finalTotalReturnPct: lastPoint ? lastPoint.totalReturnPct : 0,
      tradesCount: allExecutions.length,
    },
  };
}
