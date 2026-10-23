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
import { Gift, ExternalLink, Loader2, Receipt, WalletCards } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  getDiscountLabels,
  getPaymentIcon,
  getMinTopupAmount,
  getPayableAmount,
} from '../lib'
import type { PaymentMethod, PresetAmount, TopupInfo } from '../types'

interface RechargeFormCardProps {
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  topupAmount: number
  onTopupAmountChange: (amount: number) => void
  onPaymentMethodSelect: (method: PaymentMethod) => void
  paymentLoading: string | null
  redemptionCode: string
  onRedemptionCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  topupLink?: string
  loading?: boolean
  onOpenBilling?: () => void
}

export function RechargeFormCard({
  topupInfo,
  presetAmounts,
  selectedPreset,
  onSelectPreset,
  topupAmount,
  onTopupAmountChange,
  onPaymentMethodSelect,
  paymentLoading,
  redemptionCode,
  onRedemptionCodeChange,
  onRedeem,
  redeeming,
  topupLink,
  loading,
  onOpenBilling,
}: RechargeFormCardProps) {
  const { t } = useTranslation()
  const [localAmount, setLocalAmount] = useState(topupAmount.toString())

  useEffect(() => {
    // Empty string must survive, otherwise the field can never be cleared
    setLocalAmount((prev) =>
      prev === '' && topupAmount === 0 ? prev : topupAmount.toString()
    )
  }, [topupAmount])

  const handleAmountChange = (value: string) => {
    setLocalAmount(value)
    const numValue = Number.parseInt(value) || 0
    if (numValue >= 0) {
      onTopupAmountChange(numValue)
    }
  }

  const hasAnyTopup = topupInfo?.enable_online_topup === true
  const hasStandardPaymentMethods =
    Array.isArray(topupInfo?.pay_methods) && topupInfo.pay_methods.length > 0
  const minTopup = getMinTopupAmount(topupInfo)
  const redemptionEnabled = topupInfo?.enable_redemption !== false
  const customAmount = Number.parseInt(localAmount) || 0
  const customPayable = getPayableAmount(topupInfo, customAmount)
  const customDiscount = getDiscountLabels(customAmount, customPayable)

  if (loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-3 !pb-3 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-4 p-3 sm:space-y-6 sm:p-5'>
          <div className='space-y-4 sm:space-y-6'>
            {/* Preset Amounts Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-16' />
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                {Array.from({ length: 8 }, (_, index) => `preset-${index}`).map(
                  (key) => (
                    <Skeleton key={key} className='h-[72px] rounded-lg' />
                  )
                )}
              </div>
            </div>

            {/* Custom Amount Input Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-28' />
              <Skeleton className='h-[42px] w-full' />
            </div>

            {/* Payment Methods Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-32' />
              <div className='flex flex-wrap gap-3'>
                {['primary', 'secondary', 'tertiary'].map((key) => (
                  <Skeleton key={key} className='h-10 w-24 rounded-lg' />
                ))}
              </div>
            </div>
          </div>

          {/* Redemption Code Section Skeleton */}
          <div className='space-y-3 border-t pt-8'>
            <Skeleton className='h-3 w-24' />
            <div className='flex gap-2'>
              <Skeleton className='h-10 flex-1' />
              <Skeleton className='h-10 w-20' />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TitledCard
      title={t('Add Funds')}
      description={t('Choose an amount and payment method')}
      icon={<WalletCards className='h-4 w-4' />}
      iconTone='success'
      disableHoverEffect
      action={
        onOpenBilling ? (
          <Button
            variant='outline'
            size='sm'
            onClick={onOpenBilling}
            className='w-full gap-2 sm:w-auto'
          >
            <Receipt className='h-4 w-4' />
            {t('Order History')}
          </Button>
        ) : null
      }
      contentClassName='space-y-4 sm:space-y-6'
    >
      {/* Online Topup Section */}
      {hasAnyTopup ? (
        <div className='space-y-4 sm:space-y-6'>
          {presetAmounts.length > 0 && (
            <div className='space-y-2.5 sm:space-y-3'>
              <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                {t('Amount')}
              </Label>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4'>
                {presetAmounts.map((preset) => {
                  const isSelected = selectedPreset === preset.value
                  const payable = getPayableAmount(topupInfo, preset.value)
                  const discount = getDiscountLabels(preset.value, payable)

                  return (
                    <Button
                      key={preset.value}
                      variant='outline'
                      aria-pressed={isSelected}
                      className={cn(
                        'flex h-14 flex-col items-start justify-center gap-0.5 rounded-lg px-3.5 text-left whitespace-normal transition-colors',
                        isSelected
                          ? 'border-foreground bg-foreground/5 ring-1 ring-foreground/25 dark:border-foreground dark:bg-foreground/10'
                          : 'border-border/70 hover:border-foreground/40 hover:bg-muted/40'
                      )}
                      onClick={() => onSelectPreset(preset)}
                    >
                      <span className='text-base leading-none font-semibold tabular-nums sm:text-lg'>
                        <span className='mr-0.5 text-xs font-medium sm:text-sm'>
                          ¥
                        </span>
                        {formatNumber(preset.value)}
                      </span>
                      {discount ? (
                        <span className='text-[11px] leading-4 font-medium text-red-600 tabular-nums dark:text-red-400'>
                          {t('{{percent}}% off', discount)}
                        </span>
                      ) : null}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          <div className='space-y-2.5 sm:space-y-3'>
            <Label
              htmlFor='topup-amount'
              className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
            >
              {t('Custom Amount')}
            </Label>
            <div className='relative'>
              <span className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm'>
                ¥
              </span>
              <Input
                id='topup-amount'
                type='number'
                inputMode='numeric'
                value={localAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                min={minTopup}
                placeholder={`${t('Minimum:')} ${minTopup}`}
                className='h-10 pl-7 text-base tabular-nums sm:h-11'
              />
            </div>
            {customDiscount ? (
              <p className='text-xs font-medium text-red-600 tabular-nums dark:text-red-400'>
                {t('{{percent}}% off', customDiscount)}
              </p>
            ) : null}
          </div>

          <div className='space-y-2.5 sm:space-y-3'>
            <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Payment Method')}
            </Label>
            {hasStandardPaymentMethods ? (
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4'>
                {topupInfo?.pay_methods?.map((method) => {
                  const minTopup = Math.max(
                    method.min_topup || 0,
                    getMinTopupAmount(topupInfo)
                  )
                  const disabled = minTopup > topupAmount
                  const disabledReason = disabled
                    ? t('Minimum topup amount: {{amount}}', {
                        amount: minTopup,
                      })
                    : undefined
                  const disabledLabel = disabled
                    ? `${t('Minimum:')} ${minTopup}`
                    : undefined

                  const button = (
                    <Button
                      key={method.type}
                      variant='outline'
                      onClick={() => onPaymentMethodSelect(method)}
                      disabled={disabled || !!paymentLoading}
                      title={disabledReason}
                      aria-label={
                        disabledReason
                          ? `${method.name}. ${disabledReason}`
                          : method.name
                      }
                      className='min-h-12 min-w-0 justify-start gap-2 rounded-lg px-3 py-2.5 text-left hover:border-foreground/40 hover:bg-muted/40'
                    >
                      {paymentLoading === method.type ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        getPaymentIcon(
                          method.type,
                          'h-4 w-4',
                          method.icon,
                          method.name
                        )
                      )}
                      <span className='flex min-w-0 flex-col items-start gap-0.5'>
                        <span className='max-w-full truncate'>
                          {method.name}
                        </span>
                        {disabledLabel && (
                          <span className='text-muted-foreground max-w-full truncate text-[11px] leading-4 font-normal'>
                            {disabledLabel}
                          </span>
                        )}
                      </span>
                    </Button>
                  )

                  return disabled ? (
                    <TooltipProvider key={method.type}>
                      <Tooltip>
                        <TooltipTrigger render={button} />
                        <TooltipContent>{disabledReason}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    button
                  )
                })}
              </div>
            ) : null}
            {!hasStandardPaymentMethods && (
              <Alert>
                <AlertDescription>
                  {t(
                    'No payment methods available. Please contact administrator.'
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Online topup is not enabled. Please use redemption code or contact administrator.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Redemption Code Section */}
      {redemptionEnabled ? (
        <div className='space-y-2.5 border-t pt-4 sm:space-y-3 sm:pt-6'>
          <div className='flex items-center gap-2'>
            <IconBadge tone='warning' size='xs'>
              <Gift />
            </IconBadge>
            <Label
              htmlFor='redemption-code'
              className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
            >
              {t('Have a Code?')}
            </Label>
          </div>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
            <Input
              id='redemption-code'
              value={redemptionCode}
              onChange={(e) => onRedemptionCodeChange(e.target.value)}
              placeholder={t('Enter your redemption code')}
              className='h-9 min-w-0'
            />
            <Button
              onClick={onRedeem}
              disabled={redeeming}
              variant='outline'
              className='h-9 px-4'
            >
              {redeeming && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {t('Redeem')}
            </Button>
          </div>
          {topupLink && (
            <p className='text-muted-foreground text-xs'>
              {t('Need a redemption code?')}{' '}
              <a
                href={topupLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 underline-offset-4 hover:underline'
              >
                {t('Get one here')}
                <ExternalLink className='h-3 w-3' />
              </a>
            </p>
          )}
        </div>
      ) : (
        <Alert className='border-t'>
          <AlertDescription>
            {t(
              'Redemption codes are disabled until the administrator confirms compliance terms.'
            )}
          </AlertDescription>
        </Alert>
      )}
    </TitledCard>
  )
}
