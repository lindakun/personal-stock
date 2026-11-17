export type MarketRegion = 'CN' | 'HK' | 'US' | 'CUSTOM';

export type ColorScheme = 'cn' | 'us';

export type SimulationMode = 'scenario' | 'montecarlo';

export interface OhlcBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HoldingPosition {
  shares: number;
  avgCost: number;
  cashReserve: number;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
}

export interface StockAsset {
  symbol: string;
  name: string;
  market: MarketRegion;
  sector: string;
  currency: 'CNY' | 'HKD' | 'USD';
  currentPrice: number;
  prevClose: number;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
  bars: OhlcBar[];
  position: HoldingPosition;
  source: 'preset' | 'live' | 'custom';
  lastUpdated: string;
}

export interface ScenarioStage {
  id: string;
  name: string;
  days: number;
  annualDriftPct: number;
  annualVolPct: number;
  meanReversion: number;
}

export type EventCategory = 'earnings' | 'macro' | 'policy' | 'capital' | 'risk';

export interface MarketEvent {
  id: string;
  dayOffset: number;
  title: string;
  impactPct: number;
  volMultiplier: number;
  category: EventCategory;
  enabled: boolean;
}

export type TradeAction = 'BUY' | 'SELL';

export interface ScheduledTrade {
  id: string;
  dayOffset: number;
  action: TradeAction;
  mode: 'SHARES' | 'AMOUNT';
  value: number;
  note: string;
  enabled: boolean;
}

export interface SimulationConfig {
  horizonDays: number;
  mode: SimulationMode;
  annualDriftPct: number;
  annualVolPct: number;
  meanReversion: number;
  mcPaths: number;
  stages: ScenarioStage[];
  events: MarketEvent[];
  dcaEnabled: boolean;
  dcaIntervalDays: number;
  dcaAmount: number;
  autoTakeProfitSellPct: number; // e.g., 50 means sell 50% when takeProfit hit
  autoStopLossSellPct: number; // e.g., 100 means liquidate when stopLoss hit
  scheduledTrades: ScheduledTrade[];
  seed: number;
}

export interface TradeExecution {
  dayIndex: number;
  date: string;
  action: TradeAction;
  shares: number;
  price: number;
  amount: number;
  reason: string;
}

export interface ProjectedPoint {
  dayIndex: number;
  date: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  activeOpen: number;
  activeHigh: number;
  activeLow: number;
  activeClose: number;
  activeVolume: number;
  stageName: string;
  eventsTriggered: MarketEvent[];
  tradesTriggered: TradeExecution[];
  positionShares: number;
  positionAvgCost: number;
  cashBalance: number;
  totalEquity: number;
  costBasisTotal: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalReturnPct: number;
}

export interface SimulationSummary {
  startPrice: number;
  p10FinalPrice: number;
  p50FinalPrice: number;
  p90FinalPrice: number;
  activeFinalPrice: number;
  expectedReturnPct: number;
  activeReturnPct: number;
  winProbabilityPct: number;
  hitTakeProfitPct: number;
  hitStopLossPct: number;
  maxDrawdownP50Pct: number;
  maxDrawdownP90Pct: number;
  activeMaxDrawdownPct: number;
  finalEquity: number;
  finalShares: number;
  finalCash: number;
  finalTotalPnl: number;
  finalTotalReturnPct: number;
  tradesCount: number;
}

export interface SimulationResult {
  points: ProjectedPoint[];
  samplePaths: number[][];
  allExecutions: TradeExecution[];
  summary: SimulationSummary;
}

export interface SavedScenario {
  id: string;
  name: string;
  symbol: string;
  stockName: string;
  createdAt: string;
  config: SimulationConfig;
  summary: SimulationSummary;
}
