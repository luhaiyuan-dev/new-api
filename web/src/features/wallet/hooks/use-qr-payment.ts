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
import i18next from 'i18next'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import {
  isApiSuccess,
  requestAlipayPayment,
  requestWechatPayment,
} from '../api'
import { isNativeWechatPayment } from '../lib/payment'
import type { NativePayResponse } from '../types'

/** 扫码订单默认有效期（秒），与支付网关的默认配置保持一致。 */
const DEFAULT_QR_EXPIRE_SECONDS = 30 * 60

/**
 * Active QR-code payment session held by the wallet page while the
 * native-pay dialog is open.
 */
export interface QrPaymentSession {
  /** Payment channel type: wechat or alipay */
  provider: string
  /** QR-code payload returned by the payment gateway */
  codeUrl?: string
  /** Alipay website cashier, opened in a separate tab for scanning. */
  paymentUrl?: string
  /** Local order number used for status polling */
  tradeNo: string
  /** Order expiry timestamp (seconds) */
  expireAt: number
  /** Payable amount in CNY, shown in the dialog */
  payAmount: number
}

export function useQrPayment() {
  const [qrPayment, setQrPayment] = useState<QrPaymentSession | null>(null)

  // Place a native (WeChat/Alipay direct) order and open the QR dialog.
  // payableAmount 是前端按折扣档位预估的实付金额，仅作为后端未返回 money 时的兜底。
  const placeNativeOrder = useCallback(
    async (
      paymentType: string,
      topupAmount: number,
      payableAmount?: number
    ): Promise<boolean> => {
      const amount = Math.floor(topupAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error(i18next.t('Please enter a valid amount'))
        return false
      }

      let response: NativePayResponse
      try {
        response = isNativeWechatPayment(paymentType)
          ? await requestWechatPayment({ amount, payment_method: paymentType })
          : await requestAlipayPayment({ amount, payment_method: paymentType })
      } catch (error) {
        // 网络异常或服务端 5xx：必须给出可见反馈，否则按钮看起来毫无响应。
        const message =
          error instanceof Error && error.message
            ? error.message
            : i18next.t('Payment request failed')
        toast.error(message)
        return false
      }

      const payload = response?.data as unknown
      if (!isApiSuccess(response) || !payload || typeof payload !== 'object') {
        // 业务失败时后端把原因放在 data 字段，message 只是 "error"。
        const reason =
          typeof payload === 'string' && payload.trim()
            ? payload
            : i18next.t('Payment request failed')
        toast.error(reason)
        return false
      }

      const session = payload as {
        code_url?: string
        payment_url?: string
        trade_no?: string
        expire_at?: number
        money?: number
      }
      // trade_no 是轮询订单状态的唯一凭据，缺失时无法确认支付结果，直接判失败。
      if (!session.trade_no) {
        toast.error(i18next.t('Payment request failed'))
        return false
      }

      const isWechat = isNativeWechatPayment(paymentType)
      if (isWechat && !session.code_url) {
        toast.error(i18next.t('Payment request failed'))
        return false
      }
      if (!isWechat) {
        try {
          const cashier = new URL(session.payment_url ?? '')
          if (
            cashier.protocol !== 'https:' ||
            ![
              'openapi.alipay.com',
              'openapi-sandbox.dl.alipaydev.com',
            ].includes(cashier.host) ||
            cashier.pathname !== '/gateway.do' ||
            cashier.username ||
            cashier.password
          ) {
            throw new Error('Invalid cashier URL')
          }
        } catch {
          toast.error(i18next.t('Payment request failed'))
          return false
        }
      }

      // 后端未返回有效期时按扫码支付默认的 30 分钟兜底，
      // 否则倒计时会在首帧就归零并把订单判定为已过期。
      const expireAt =
        typeof session.expire_at === 'number' && session.expire_at > 0
          ? session.expire_at
          : Math.floor(Date.now() / 1000) + DEFAULT_QR_EXPIRE_SECONDS

      // 以后端返回的实付金额为准，避免与折扣配置变化产生显示偏差。
      const paid =
        typeof session.money === 'number' && session.money > 0
          ? session.money
          : (payableAmount ?? amount)

      setQrPayment({
        provider: paymentType,
        codeUrl: isWechat ? session.code_url : undefined,
        paymentUrl: isWechat ? undefined : session.payment_url,
        tradeNo: session.trade_no,
        expireAt,
        payAmount: paid,
      })
      return true
    },
    []
  )

  const closeQrPayment = useCallback(() => setQrPayment(null), [])

  return { qrPayment, placeNativeOrder, closeQrPayment }
}
