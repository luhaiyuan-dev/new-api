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
import { Check, Loader2, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SiAlipay, SiWechat } from 'react-icons/si'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { getTopupStatus } from '../../api'
import type { QrPaymentSession } from '../../hooks/use-qr-payment'
import { formatCurrency } from '../../lib/format'
import { isNativeWechatPayment } from '../../lib/payment'

type QrPayState = 'waiting' | 'success' | 'expired' | 'failed'

const POLL_INTERVAL_MS = 3000
const POLL_INTERVAL_SLOW_MS = 10000
const POLL_SLOW_AFTER = 10
const RING_RADIUS = 20
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0')
  const seconds = (safe % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

interface NativePayQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: QrPaymentSession | null
  /** Called after a successful payment is observed; parent refreshes balance. */
  onSuccess: () => void
  /** Optional retry hook (create a new order) offered on the expired state. */
  onRetry?: () => void
}

export function NativePayQrDialog({
  open,
  onOpenChange,
  session,
  onSuccess,
  onRetry,
}: NativePayQrDialogProps) {
  const { t } = useTranslation()
  const [state, setState] = useState<QrPayState>('waiting')
  const [remaining, setRemaining] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const pollCountRef = useRef(0)
  const unmountedRef = useRef(false)

  const isWechat = session ? isNativeWechatPayment(session.provider) : false
  const paymentUrl = session?.paymentUrl
  const brandName = isWechat ? t('WeChat Pay') : t('Alipay')
  const BrandIcon = isWechat ? SiWechat : SiAlipay
  const brandColor = isWechat ? '#07C160' : '#1677FF'

  // Reset per-session state whenever a new order is placed.
  useEffect(() => {
    if (!open || !session) return
    const secondsLeft = Math.max(
      0,
      session.expireAt - Math.floor(Date.now() / 1000)
    )
    setState('waiting')
    pollCountRef.current = 0
    setRemaining(secondsLeft)
    setTotalSeconds(secondsLeft)
  }, [open, session])

  // Poll order status; status is read-only here — crediting is driven solely
  // by the payment gateway's async notify callback.
  useEffect(() => {
    // Alipay may notify after our local countdown ends; keep observing until
    // the dialog closes so a delayed credit still refreshes the wallet.
    if (
      !open ||
      !session ||
      (state !== 'waiting' && !(paymentUrl && state === 'expired'))
    )
      return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const poll = async () => {
      if (cancelled || unmountedRef.current) return
      pollCountRef.current += 1
      try {
        const response = await getTopupStatus(session.tradeNo)
        if (cancelled || unmountedRef.current) return
        const status = response.success ? response.data?.status : undefined
        if (status === 'success') {
          setState('success')
          return
        }
        if (status === 'failed') {
          setState(status)
          return
        }
        if (status === 'expired') {
          setState(status)
          if (!paymentUrl) return
        }
      } catch {
        // Transient polling failures stay silent; keep waiting.
      }
      if (cancelled || unmountedRef.current) return
      const delay =
        pollCountRef.current >= POLL_SLOW_AFTER
          ? POLL_INTERVAL_SLOW_MS
          : POLL_INTERVAL_MS
      timer = setTimeout(poll, delay)
    }
    timer = setTimeout(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [open, session, state, paymentUrl])

  // Countdown; reaching zero marks the order expired locally.
  useEffect(() => {
    if (!open || !session || state !== 'waiting') return
    const tick = () => {
      const left = Math.max(0, session.expireAt - Math.floor(Date.now() / 1000))
      setRemaining(left)
      if (left <= 0) setState('expired')
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [open, session, state])

  // Auto-close shortly after success so the parent can refresh the balance.
  useEffect(() => {
    if (!open || state !== 'success') return
    const timer = setTimeout(() => onSuccess(), 1500)
    return () => clearTimeout(timer)
  }, [open, state, onSuccess])

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next)
    },
    [onOpenChange]
  )

  // 剩余时间比例驱动倒计时圆环，避免在渲染中读取当前时间造成首帧跳变。
  const ringProgress =
    totalSeconds > 0
      ? Math.min(1, Math.max(0, 1 - remaining / totalSeconds))
      : 0

  let statusText = t('Waiting for payment confirmation...')
  if (state === 'success') {
    statusText = t('Payment received, crediting your account...')
  }
  if (state === 'expired') statusText = t('Order expired')
  if (state === 'failed') statusText = t('Payment failed')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='overflow-hidden border-white/20 bg-white/85 p-0 shadow-2xl backdrop-blur-xl max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md dark:border-white/10 dark:bg-gray-900/85'>
        {/* Brand header */}
        <div
          className='flex items-center gap-3 px-6 py-5 text-white'
          style={{
            background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%)`,
          }}
        >
          <span className='flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm'>
            <BrandIcon className='h-6 w-6' />
          </span>
          <div className='min-w-0'>
            <DialogHeader className='p-0 text-left'>
              <DialogTitle className='text-base font-semibold text-white'>
                {brandName}
              </DialogTitle>
              <DialogDescription className='text-xs text-white/80'>
                {t('Scan to Pay')}
              </DialogDescription>
            </DialogHeader>
          </div>
          {session && (
            <span className='ml-auto truncate font-mono text-xs text-white/70'>
              {session.tradeNo}
            </span>
          )}
        </div>

        <div className='space-y-5 px-6 py-6'>
          {/* Payable amount */}
          <div className='text-center'>
            <div className='text-muted-foreground text-xs'>{t('You Pay')}</div>
            <div
              className='text-3xl font-semibold tabular-nums'
              style={{ color: state === 'success' ? '#16A34A' : undefined }}
            >
              {session ? formatCurrency(session.payAmount) : '-'}
            </div>
          </div>

          {paymentUrl ? (
            <div className='space-y-4 rounded-xl border p-5 text-center'>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Open the Alipay cashier in a new tab and scan the QR code there. Your balance will update automatically after payment.'
                )}
              </p>
              {state === 'waiting' && (
                <Button
                  render={
                    <a
                      href={paymentUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                    />
                  }
                >
                  {t('Open Alipay cashier')}
                </Button>
              )}
              <p className='text-muted-foreground text-xs tabular-nums'>
                {t('Time remaining')}: {formatCountdown(remaining)}
              </p>
            </div>
          ) : (
            <div className='flex justify-center'>
              <div className='relative rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/5 dark:ring-white/10'>
                <div
                  className={
                    state === 'waiting' || state === 'success'
                      ? 'transition-all duration-500'
                      : 'scale-95 opacity-50 grayscale transition-all duration-500'
                  }
                >
                  {session?.codeUrl && (
                    <QRCodeSVG
                      value={session.codeUrl}
                      size={200}
                      level='M'
                      includeMargin={false}
                    />
                  )}
                </div>

                {/* Countdown ring */}
                <svg
                  className='absolute -right-2 -bottom-2 h-11 w-11'
                  viewBox='0 0 44 44'
                >
                  <circle
                    cx='22'
                    cy='22'
                    r={RING_RADIUS}
                    fill='white'
                    className='dark:fill-gray-900'
                  />
                  <circle
                    cx='22'
                    cy='22'
                    r={RING_RADIUS}
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='3'
                    strokeLinecap='round'
                    className='text-black/10 dark:text-white/15'
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={0}
                    transform='rotate(-90 22 22)'
                  />
                  <circle
                    cx='22'
                    cy='22'
                    r={RING_RADIUS}
                    fill='none'
                    stroke={state === 'expired' ? '#94A3B8' : brandColor}
                    strokeWidth='3'
                    strokeLinecap='round'
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={RING_CIRCUMFERENCE * (1 - ringProgress)}
                    transform='rotate(-90 22 22)'
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                  <text
                    x='22'
                    y='23'
                    textAnchor='middle'
                    dominantBaseline='middle'
                    className='fill-current text-[9px] font-medium text-gray-700 tabular-nums dark:text-gray-200'
                  >
                    {formatCountdown(remaining)}
                  </text>
                </svg>

                {state === 'success' && (
                  <div className='absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm dark:bg-gray-900/70'>
                    <span className='flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg'>
                      <Check className='h-8 w-8' strokeWidth={3} />
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hint */}
          {!paymentUrl && (
            <p className='text-muted-foreground text-center text-xs'>
              {isWechat
                ? t('Open WeChat and scan the QR code to complete payment')
                : t('Open Alipay and scan the QR code to complete payment')}
            </p>
          )}

          {/* Status row */}
          <div
            role='status'
            className='flex items-center justify-center gap-2 text-sm'
          >
            {state === 'waiting' && (
              <>
                <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
                <span className='text-muted-foreground'>{statusText}</span>
              </>
            )}
            {state === 'success' && (
              <span className='font-medium text-green-600'>{statusText}</span>
            )}
            {(state === 'expired' || state === 'failed') && (
              <span className='font-medium text-amber-600'>{statusText}</span>
            )}
          </div>

          {/* Actions */}
          <div className='flex gap-2'>
            <Button
              variant='outline'
              className='flex-1'
              onClick={() => handleOpenChange(false)}
            >
              <X className='mr-1.5 h-4 w-4' />
              {state === 'success' ? t('Close') : t('Cancel')}
            </Button>
            {state === 'expired' && onRetry && (
              <Button
                className='flex-1'
                style={{ backgroundColor: brandColor }}
                onClick={onRetry}
              >
                {t('Create New Order')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
