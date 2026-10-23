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
// ============================================================================
// Wallet Constants
// ============================================================================

/**
 * Default preset amount multipliers
 * Used to generate quick select amounts based on minimum topup
 */
export const DEFAULT_PRESET_MULTIPLIERS = [1, 5, 10, 30, 50, 100, 300, 500]

/**
 * Payment method types
 *
 * 站点只支持微信支付与支付宝两条直连渠道，二者都是「下单 → 二维码 → 回调入账」
 * 的扫码支付链路。
 */
export const PAYMENT_TYPES = {
  WECHAT_PAY: 'wechat',
  ALIPAY_PAY: 'alipay',
} as const

/**
 * Default payment type
 */
export const DEFAULT_PAYMENT_TYPE = PAYMENT_TYPES.ALIPAY_PAY

/**
 * Payment icon colors (HEX format for react-icons)
 */
export const PAYMENT_ICON_COLORS = {
  [PAYMENT_TYPES.WECHAT_PAY]: '#07C160',
  [PAYMENT_TYPES.ALIPAY_PAY]: '#1677FF',
} as const

/**
 * Default minimum topup amount
 */
export const DEFAULT_MIN_TOPUP = 1
