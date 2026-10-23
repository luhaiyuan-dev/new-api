/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * ============================================================================
 * Currency Formatting Library
 * ============================================================================
 *
 * 站点以人民币（CNY）为唯一计价与展示单位，不存在汇率换算层。
 *
 * ## Key Concepts
 *
 * 1. **计价单位（元）**：系统内部的最小记账单位是「元」，`common.QuotaPerUnit`
 *    个 quota 等于 1 元（默认 500,000）。模型价格单位是「元 / 1M tokens」。
 * 2. **quota**：系统内部计费单位，由数据库存储。1 元 = quotaPerUnit 个 quota。
 * 3. **充值多少得多少**：用户充值 10 元即得 10 元额度，不存在充值单价系数。
 *
 * ## When to Use Each Function
 *
 * - `formatCNY()`：额度 / 余额展示（入参为「元」）
 * - `formatBillingCNY()`：账单 / 定价展示（与上一函数等价，保留只为语义清晰）
 * - `formatLocalCurrencyAmount()`：已经是人民币的金额（如充值应付金额）直接格式化
 * - `formatQuotaWithCurrency()`：入参为原始 quota，先除以 quotaPerUnit 再按元展示
 *
 * ## Example Scenario
 *
 * - quotaPerUnit = 500000（1 元 = 50 万 quota）
 *
 * 1. 充值档位：10 元 → formatCNY(10) → "¥10"
 * 2. 应付金额：10 元 → formatLocalCurrencyAmount(10) → "¥10"
 * 3. 用户余额：5,000,000 quota → formatQuotaWithCurrency(5000000) → "¥10"
 *
 * ## Critical Rules
 *
 * 1. **不要重复换算**：已是「元」的金额直接用 `formatLocalCurrencyAmount()`
 * 2. **数据库中的 quota**：用 `formatQuotaWithCurrency()` 转成元再展示
 * 3. **已是「元」的数值**：用 `formatCNY()`
 */
import {
  useSystemConfigStore,
  DEFAULT_CURRENCY_CONFIG,
  type CurrencyConfig,
} from '@/stores/system-config-store'

export interface CurrencyFormatOptions {
  /** Fraction digits to use when |value| >= 1 */
  digitsLarge?: number
  /** Fraction digits to use when |value| < 1 */
  digitsSmall?: number
  /** Whether to abbreviate thousands with k suffix */
  abbreviate?: boolean
  /** Minimal absolute value to display when rounding would produce zero */
  minimumNonZero?: number
  /**
   * Use locale-aware compact notation for large values (e.g. "¥28万" in zh,
   * "¥280K" in en). The currency symbol is preserved.
   */
  compact?: boolean
  /** Whether to include the currency symbol */
  showSymbol?: boolean
  /** Locale used for number formatting (defaults to the runtime locale) */
  locale?: Intl.LocalesArgument | undefined
}

type ResolvedCurrencyFormatOptions = Omit<
  Required<CurrencyFormatOptions>,
  'locale'
> & {
  locale: Intl.LocalesArgument | undefined
}

/** 站点固定的人民币展示元数据。汇率恒为 1，字段保留仅为兼容既有调用。 */
type DisplayMeta = {
  kind: 'currency'
  symbol: '¥'
  currencyCode: 'CNY'
  exchangeRate: 1
}

const CNY_DISPLAY_META: DisplayMeta = {
  kind: 'currency',
  symbol: '¥',
  currencyCode: 'CNY',
  exchangeRate: 1,
}

const DEFAULT_FORMAT_OPTIONS: ResolvedCurrencyFormatOptions = {
  digitsLarge: 2,
  digitsSmall: 4,
  abbreviate: true,
  minimumNonZero: 0,
  compact: false,
  showSymbol: true,
  locale: undefined,
}

function getConfig(): CurrencyConfig {
  const { config } = useSystemConfigStore.getState()
  const currency = config?.currency ?? DEFAULT_CURRENCY_CONFIG
  return {
    quotaPerUnit:
      currency?.quotaPerUnit && currency.quotaPerUnit > 0
        ? currency.quotaPerUnit
        : DEFAULT_CURRENCY_CONFIG.quotaPerUnit,
  }
}

function mergeOptions(
  options?: CurrencyFormatOptions
): ResolvedCurrencyFormatOptions {
  if (!options) return DEFAULT_FORMAT_OPTIONS
  return {
    digitsLarge: options.digitsLarge ?? DEFAULT_FORMAT_OPTIONS.digitsLarge,
    digitsSmall: options.digitsSmall ?? DEFAULT_FORMAT_OPTIONS.digitsSmall,
    abbreviate: options.abbreviate ?? DEFAULT_FORMAT_OPTIONS.abbreviate,
    minimumNonZero:
      options.minimumNonZero ?? DEFAULT_FORMAT_OPTIONS.minimumNonZero,
    compact: options.compact ?? DEFAULT_FORMAT_OPTIONS.compact,
    showSymbol: options.showSymbol ?? DEFAULT_FORMAT_OPTIONS.showSymbol,
    locale: options.locale ?? DEFAULT_FORMAT_OPTIONS.locale,
  }
}

function getFractionDigits(
  value: number,
  digitsLarge: number,
  digitsSmall: number
): number {
  return Math.abs(value) >= 1 ? digitsLarge : digitsSmall
}

/** Return the configured fraction digits for a plain currency value. */
export function getCurrencyFractionDigits(
  value: number,
  options?: CurrencyFormatOptions
): number {
  const merged = mergeOptions(options)
  return getFractionDigits(value, merged.digitsLarge, merged.digitsSmall)
}

function adjustForMinimum(
  value: number,
  digits: number,
  minimumNonZero: number
): number {
  if (value === 0) return value

  const threshold = minimumNonZero > 0 ? minimumNonZero : Math.pow(10, -digits)
  const abs = Math.abs(value)
  if (abs > 0 && abs < threshold) {
    return value > 0 ? threshold : -threshold
  }
  return value
}

function formatCurrencyValue(
  value: number,
  options: ResolvedCurrencyFormatOptions
): string {
  const digits = getFractionDigits(
    value,
    options.digitsLarge,
    options.digitsSmall
  )
  const adjustedValue = adjustForMinimum(value, digits, options.minimumNonZero)

  if (!options.showSymbol) {
    return new Intl.NumberFormat(options.locale, {
      notation: options.compact ? 'compact' : 'standard',
      minimumFractionDigits: 0,
      maximumFractionDigits: options.compact ? 1 : digits,
    }).format(adjustedValue)
  }

  return new Intl.NumberFormat(options.locale, {
    style: 'currency',
    currency: CNY_DISPLAY_META.currencyCode,
    currencyDisplay: 'narrowSymbol',
    notation: options.compact ? 'compact' : 'standard',
    minimumFractionDigits: 0,
    maximumFractionDigits: options.compact ? 1 : digits,
  }).format(adjustedValue)
}

/**
 * Get the current currency configuration and display metadata.
 *
 * @returns Object containing config and display metadata
 *
 * @internal
 * This is primarily for internal use. Most consumers should use the
 * higher-level formatting functions instead.
 */
export function getCurrencyDisplay() {
  const config = getConfig()
  return { config, meta: CNY_DISPLAY_META }
}

/**
 * Format an amount denominated in the site's unit (CNY).
 *
 * This is the PRIMARY function for displaying quota/balance/credit amounts
 * that are already expressed in 元.
 *
 * @param amount - Amount in 元 (e.g., user balance converted from quota)
 * @param options - Optional formatting configuration
 *
 * @example
 * formatCNY(10) → "¥10"
 * formatCNY(1234) → "¥1.2k"
 */
export function formatCNY(
  amount: number | null | undefined,
  options?: CurrencyFormatOptions
): string {
  if (amount == null || Number.isNaN(amount)) return '-'

  return formatCurrencyValue(amount, mergeOptions(options))
}

/**
 * Format amounts for billing/payment contexts.
 *
 * Kept as a separate export so billing/pricing call sites read clearly; the
 * behaviour is identical to `formatCNY` because there is a single
 * display currency.
 *
 * @param amount - Amount in 元
 * @param options - Optional formatting configuration
 */
export function formatBillingCNY(
  amount: number | null | undefined,
  options?: CurrencyFormatOptions
): string {
  if (amount == null || Number.isNaN(amount)) return '-'

  return formatCurrencyValue(amount, mergeOptions(options))
}

/**
 * Format raw quota values to CNY.
 *
 * Converts raw quota amounts to 元 first (quota ÷ quotaPerUnit), then formats.
 *
 * @param quota - Raw quota amount (e.g., 5000000)
 * @param options - Optional formatting configuration
 *
 * @example
 * // With quotaPerUnit: 500000
 * formatQuotaWithCurrency(5000000) → "¥10"
 */
export function formatQuotaWithCurrency(
  quota: number | null | undefined,
  options?: CurrencyFormatOptions
): string {
  if (quota == null || Number.isNaN(quota)) return '-'

  const { config } = getCurrencyDisplay()
  return formatCNY(quota / config.quotaPerUnit, options)
}

/**
 * Get the currency label for UI display.
 *
 * @returns "CNY"
 */
export function getCurrencyLabel(): string {
  return 'CNY'
}

/**
 * Format an amount that is ALREADY in CNY.
 *
 * ⚠️ CRITICAL: This function does NOT apply any exchange rate conversion
 * (站点为人民币单一计价，本就不存在换算层)。
 *
 * @param amount - Amount already in 元
 * @param options - Optional formatting configuration
 *
 * @remarks
 * Use this function for:
 * - 充值应付金额（充值多少得多少）
 * - Actual money charged to user's payment method
 *
 * DO NOT use for:
 * - Values that still need conversion → use formatCNY()
 * - Raw quota values → use formatQuotaWithCurrency()
 */
export function formatLocalCurrencyAmount(
  amount: number | null | undefined,
  options?: CurrencyFormatOptions
): string {
  if (amount == null || Number.isNaN(amount)) return '-'

  return formatCurrencyValue(amount, mergeOptions(options))
}
