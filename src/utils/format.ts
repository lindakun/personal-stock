import type { ColorScheme, MarketRegion } from '../types/market';

export function getCurrencySymbol(currency: 'CNY' | 'HKD' | 'USD'): string {
  switch (currency) {
    case 'CNY':
      return '¥';
    case 'HKD':
      return 'HK$';
    case 'USD':
      return '$';
  }
}

export function getMarketLabel(market: MarketRegion): string {
  switch (market) {
    case 'CN':
      return 'A股';
    case 'HK':
      return '港股';
    case 'US':
      return '美股';
    case 'CUSTOM':
      return '沙盘标的';
  }
}

export function formatPrice(value: number, currency?: 'CNY' | 'HKD' | 'USD'): string {
  const prefix = currency ? getCurrencySymbol(currency) : '';
  return `${prefix}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMoney(value: number, currency: 'CNY' | 'HKD' | 'USD' = 'CNY'): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const sym = getCurrencySymbol(currency);
  if (abs >= 1e8) {
    return `${sign}${sym}${(abs / 1e8).toFixed(2)}亿`;
  }
  if (abs >= 1e5 && currency !== 'USD') {
    return `${sign}${sym}${(abs / 1e4).toFixed(2)}万`;
  }
  return `${sign}${sym}${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatSignedPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(vol: number): string {
  if (vol >= 1e8) return `${(vol / 1e8).toFixed(2)}亿`;
  if (vol >= 1e4) return `${(vol / 1e4).toFixed(1)}万`;
  return `${vol}`;
}

export function getTrendTextColor(delta: number, scheme: ColorScheme): string {
  if (delta === 0) return 'text-slate-500 dark:text-slate-400';
  const isUp = delta > 0;
  if (scheme === 'cn') {
    return isUp
      ? 'text-red-600 dark:text-red-400'
      : 'text-emerald-600 dark:text-emerald-400';
  }
  return isUp
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
}

export function getTrendHexColors(scheme: ColorScheme): {
  up: string;
  down: string;
  upSoft: string;
  downSoft: string;
} {
  if (scheme === 'cn') {
    return {
      up: '#dc2626',
      down: '#16a34a',
      upSoft: 'rgba(220, 38, 38, 0.28)',
      downSoft: 'rgba(22, 163, 74, 0.28)',
    };
  }
  return {
    up: '#16a34a',
    down: '#dc2626',
    upSoft: 'rgba(22, 163, 74, 0.28)',
    downSoft: 'rgba(220, 38, 38, 0.28)',
  };
}
