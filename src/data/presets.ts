import { generateHistoricalBars } from '../engine/simulator';
import type { SimulationConfig, StockAsset } from '../types/market';

export const PRESET_STOCKS: StockAsset[] = [
  {
    symbol: '600519.SS',
    name: '贵州茅台',
    market: 'CN',
    sector: '白酒消费',
    currency: 'CNY',
    currentPrice: 1548.6,
    prevClose: 1536.2,
    pe: 22.4,
    pb: 7.6,
    dividendYield: 2.85,
    bars: generateHistoricalBars(1548.6, 90, 4, 24, 2850000, 1001, '2026-11-16'),
    position: {
      shares: 100,
      avgCost: 1492.0,
      cashReserve: 85000,
      takeProfitPrice: 1750,
      stopLossPrice: 1410,
    },
    source: 'preset',
    lastUpdated: '2026-11-16',
  },
  {
    symbol: '300750.SZ',
    name: '宁德时代',
    market: 'CN',
    sector: '动力电池',
    currency: 'CNY',
    currentPrice: 262.4,
    prevClose: 257.8,
    pe: 24.8,
    pb: 4.9,
    dividendYield: 1.92,
    bars: generateHistoricalBars(262.4, 90, 16, 36, 18400000, 2002, '2026-11-16'),
    position: {
      shares: 400,
      avgCost: 238.5,
      cashReserve: 50000,
      takeProfitPrice: 310,
      stopLossPrice: 228,
    },
    source: 'preset',
    lastUpdated: '2026-11-16',
  },
  {
    symbol: '0700.HK',
    name: '腾讯控股',
    market: 'HK',
    sector: '互联网平台',
    currency: 'HKD',
    currentPrice: 426.8,
    prevClose: 429.4,
    pe: 19.6,
    pb: 4.1,
    dividendYield: 1.15,
    bars: generateHistoricalBars(426.8, 90, 12, 31, 16200000, 3003, '2026-11-16'),
    position: {
      shares: 300,
      avgCost: 398.0,
      cashReserve: 60000,
      takeProfitPrice: 485,
      stopLossPrice: 375,
    },
    source: 'preset',
    lastUpdated: '2026-11-16',
  },
  {
    symbol: 'NVDA',
    name: '英伟达',
    market: 'US',
    sector: '半导体算力',
    currency: 'USD',
    currentPrice: 146.3,
    prevClose: 143.1,
    pe: 46.2,
    pb: 38.4,
    dividendYield: 0.03,
    bars: generateHistoricalBars(146.3, 90, 28, 46, 215000000, 4004, '2026-11-16'),
    position: {
      shares: 180,
      avgCost: 124.5,
      cashReserve: 15000,
      takeProfitPrice: 175,
      stopLossPrice: 122,
    },
    source: 'preset',
    lastUpdated: '2026-11-16',
  },
  {
    symbol: 'AAPL',
    name: '苹果',
    market: 'US',
    sector: '消费电子',
    currency: 'USD',
    currentPrice: 229.75,
    prevClose: 228.1,
    pe: 33.8,
    pb: 44.1,
    dividendYield: 0.44,
    bars: generateHistoricalBars(229.75, 90, 11, 22, 48000000, 5005, '2026-11-16'),
    position: {
      shares: 120,
      avgCost: 214.0,
      cashReserve: 12000,
      takeProfitPrice: 258,
      stopLossPrice: 205,
    },
    source: 'preset',
    lastUpdated: '2026-11-16',
  },
];

// Update prevClose from generated bars so daily change matches chart
for (const st of PRESET_STOCKS) {
  if (st.bars.length >= 2) {
    st.currentPrice = st.bars[st.bars.length - 1].close;
    st.prevClose = st.bars[st.bars.length - 2].close;
  }
}

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  config: Partial<SimulationConfig>;
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'steady-bull',
    name: '温和慢牛推演',
    description: '先窄幅整固消化浮筹，随后基本面驱动温和上行',
    config: {
      mode: 'scenario',
      horizonDays: 60,
      annualDriftPct: 16,
      annualVolPct: 24,
      meanReversion: 0.4,
      stages: [
        { id: 's1', name: '震荡筑底', days: 20, annualDriftPct: 2, annualVolPct: 20, meanReversion: 0.8 },
        { id: 's2', name: '放量突破', days: 20, annualDriftPct: 28, annualVolPct: 28, meanReversion: 0.2 },
        { id: 's3', name: '高位整固', days: 20, annualDriftPct: 10, annualVolPct: 22, meanReversion: 0.5 },
      ],
      events: [
        {
          id: 'e1',
          dayOffset: 22,
          title: '季报营收超预期',
          impactPct: 4.5,
          volMultiplier: 1.35,
          category: 'earnings',
          enabled: true,
        },
      ],
    },
  },
  {
    id: 'washout-rebound',
    name: '急跌洗盘与V型修复',
    description: '短期利空引发放量下挫，测试支撑后情绪回暖反弹',
    config: {
      mode: 'scenario',
      horizonDays: 60,
      annualDriftPct: 6,
      annualVolPct: 36,
      meanReversion: 0.6,
      stages: [
        { id: 's1', name: '恐慌下探', days: 15, annualDriftPct: -35, annualVolPct: 42, meanReversion: 0.1 },
        { id: 's2', name: '缩量磨底', days: 15, annualDriftPct: 4, annualVolPct: 26, meanReversion: 0.9 },
        { id: 's3', name: '估值修复', days: 30, annualDriftPct: 26, annualVolPct: 30, meanReversion: 0.3 },
      ],
      events: [
        {
          id: 'e1',
          dayOffset: 8,
          title: '行业短期情绪冲击',
          impactPct: -5.8,
          volMultiplier: 1.6,
          category: 'risk',
          enabled: true,
        },
        {
          id: 'e2',
          dayOffset: 32,
          title: '回购与分红预案落地',
          impactPct: 4.2,
          volMultiplier: 1.25,
          category: 'capital',
          enabled: true,
        },
      ],
    },
  },
  {
    id: 'range-grid',
    name: '高波箱体震荡',
    description: '强均值回归区间运行，适合测试高抛低吸与定投摊薄',
    config: {
      mode: 'scenario',
      horizonDays: 90,
      annualDriftPct: 4,
      annualVolPct: 30,
      meanReversion: 2.2,
      stages: [
        { id: 's1', name: '箱体震荡', days: 90, annualDriftPct: 4, annualVolPct: 32, meanReversion: 2.4 },
      ],
      events: [],
    },
  },
  {
    id: 'bear-stress',
    name: '宏观承压压力测试',
    description: '模拟连续下行与高波动率环境，检验止损与仓位防御力',
    config: {
      mode: 'scenario',
      horizonDays: 60,
      annualDriftPct: -22,
      annualVolPct: 40,
      meanReversion: 0.2,
      stages: [
        { id: 's1', name: '趋势走弱', days: 35, annualDriftPct: -28, annualVolPct: 38, meanReversion: 0.1 },
        { id: 's2', name: '低位弱稳', days: 25, annualDriftPct: -6, annualVolPct: 30, meanReversion: 0.6 },
      ],
      events: [
        {
          id: 'e1',
          dayOffset: 14,
          title: '宏观流动性收紧',
          impactPct: -4.5,
          volMultiplier: 1.5,
          category: 'macro',
          enabled: true,
        },
      ],
    },
  },
  {
    id: 'mc-neutral',
    name: '蒙特卡洛中性分布',
    description: '基于当前波动率与中性漂移运行 300 条随机路径',
    config: {
      mode: 'montecarlo',
      horizonDays: 60,
      annualDriftPct: 10,
      annualVolPct: 28,
      meanReversion: 0.35,
      mcPaths: 300,
      events: [],
    },
  },
];

export function createDefaultConfig(): SimulationConfig {
  const base = SCENARIO_TEMPLATES[0].config;
  return {
    horizonDays: base.horizonDays ?? 60,
    mode: base.mode ?? 'scenario',
    annualDriftPct: base.annualDriftPct ?? 14,
    annualVolPct: base.annualVolPct ?? 26,
    meanReversion: base.meanReversion ?? 0.4,
    mcPaths: 300,
    stages: base.stages ? base.stages.map((s) => ({ ...s })) : [],
    events: base.events ? base.events.map((e) => ({ ...e })) : [],
    dcaEnabled: false,
    dcaIntervalDays: 10,
    dcaAmount: 10000,
    autoTakeProfitSellPct: 50,
    autoStopLossSellPct: 100,
    scheduledTrades: [],
    seed: 20261116,
  };
}
