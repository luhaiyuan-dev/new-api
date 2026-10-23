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
import {
  PAYMENT_TYPES,
  DEFAULT_PRESET_MULTIPLIERS,
  DEFAULT_PAYMENT_TYPE,
  DEFAULT_MIN_TOPUP,
} from '../constants'
import type { PaymentMethod, PresetAmount, TopupInfo } from '../types'

// ============================================================================
// Payment Processing Functions
// ============================================================================

/**
 * Check if payment method is WeChat Pay (official direct integration)
 */
export function isNativeWechatPayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.WECHAT_PAY
}

/**
 * Check if payment method is Alipay (official direct integration)
 */
export function isNativeAlipayPayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.ALIPAY_PAY
}

export interface PaymentProcessors {
  native: (topupAmount: number, paymentType: string) => Promise<boolean>
}

/**
 * 该支付方式是否在页面当前可选渠道内。
 *
 * `pay_methods` 是后端按渠道配置过滤后的结果，也正是充值卡片上渲染出来的按钮来源，
 * 因此它是「渠道是否可用」的唯一依据。额外的 enable_*_topup 标记在渠道配置不完整或
 * 前后端版本不一致时会与按钮列表自相矛盾：按钮能点，下单却必然被拦。
 */
export function isPaymentMethodAvailable(
  paymentMethod: PaymentMethod,
  topupInfo: TopupInfo | null
): boolean {
  const methods = topupInfo?.pay_methods
  if (!methods || methods.length === 0) {
    return false
  }

  return methods.some((method) => method.type === paymentMethod.type)
}

export async function dispatchSelectedPayment(
  paymentMethod: PaymentMethod,
  topupAmount: number,
  processors: PaymentProcessors
): Promise<boolean> {
  // 只有微信支付与支付宝两个直连渠道，两者都走扫码支付流程。
  if (
    !isNativeWechatPayment(paymentMethod.type) &&
    !isNativeAlipayPayment(paymentMethod.type)
  ) {
    return false
  }

  return processors.native(topupAmount, paymentMethod.type)
}

/**
 * Get default payment type from topup info
 */
export function getDefaultPaymentType(topupInfo: TopupInfo | null): string {
  if (!topupInfo) {
    return DEFAULT_PAYMENT_TYPE
  }

  // Return first available payment method or default
  if (topupInfo.pay_methods?.length > 0) {
    return topupInfo.pay_methods[0].type
  }

  return DEFAULT_PAYMENT_TYPE
}

/**
 * 计算某档充值金额的实付金额。
 * 折扣只下调实付金额，到账额度仍按充值金额计算；未配置档位或比例非法时
 * 返回原价，与后端 getPayMoney 的计价规则保持一致。
 */
export function getPayableAmount(
  topupInfo: TopupInfo | null,
  topupAmount: number
): number {
  const amount = Math.floor(topupAmount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return topupAmount
  }

  const rate = topupInfo?.discount?.[String(amount)]
  if (typeof rate !== 'number' || !(rate > 0) || rate > 1) {
    return amount
  }

  return Math.round(amount * rate * 100) / 100
}

export type DiscountLabels = {
  /** 折扣百分比，用于「X% off」文案 */
  percent: number
  /** 折后成数（9.8 表示 9.8 折），用于中文「X 折」文案 */
  rate: number
}

/**
 * 计算折扣展示文案的参数。实付不低于面额（即无折扣）时返回 null。
 */
export function getDiscountLabels(
  amount: number,
  payable: number
): DiscountLabels | null {
  if (!(amount > 0) || !(payable > 0) || payable >= amount) {
    return null
  }

  return {
    percent: Math.round(((amount - payable) / amount) * 100),
    rate: Number(((payable / amount) * 10).toFixed(1)),
  }
}

/**
 * Get minimum topup amount from topup info
 */
export function getMinTopupAmount(topupInfo: TopupInfo | null): number {
  if (!topupInfo) {
    return DEFAULT_MIN_TOPUP
  }

  if (topupInfo.min_topup > 0) {
    return topupInfo.min_topup
  }

  return DEFAULT_MIN_TOPUP
}

/**
 * Generate preset amounts based on minimum topup
 */
export function generatePresetAmounts(minAmount: number): PresetAmount[] {
  return DEFAULT_PRESET_MULTIPLIERS.map((multiplier) => ({
    value: minAmount * multiplier,
  }))
}

/**
 * Build preset amounts from the configured amount options
 */
export function mergePresetAmounts(amountOptions: number[]): PresetAmount[] {
  if (!amountOptions || amountOptions.length === 0) {
    return []
  }

  return amountOptions.map((amount) => ({ value: amount }))
}
