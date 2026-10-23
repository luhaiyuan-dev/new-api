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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatCurrency, getPaymentIcon } from '../../lib'
import type { PaymentMethod } from '../../types'

interface PaymentConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  topupAmount: number
  /** 实付金额：命中充值档位折扣时低于充值金额 */
  payableAmount?: number
  paymentMethod: PaymentMethod | undefined
  processing: boolean
}

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  topupAmount,
  payableAmount,
  paymentMethod,
  processing,
}: PaymentConfirmDialogProps) {
  const { t } = useTranslation()
  const paid = payableAmount ?? topupAmount
  const hasDiscount = paid < topupAmount

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-xl font-semibold'>
            {t('Confirm Payment')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('Review your payment details')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='space-y-3 py-3 sm:space-y-4 sm:py-4'>
          {hasDiscount && (
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Recharge Amount')}
              </span>
              <span className='text-muted-foreground text-sm tabular-nums line-through'>
                {formatCurrency(topupAmount)}
              </span>
            </div>
          )}

          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              {t('You Pay')}
            </span>
            <div className='flex items-center gap-2'>
              <span className='text-2xl font-semibold tabular-nums'>
                {formatCurrency(paid)}
              </span>
              {hasDiscount && (
                <span className='rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400'>
                  {t('Discount')}
                </span>
              )}
            </div>
          </div>

          <div className='border-t pt-4'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Payment Method')}
              </span>
              <div className='flex items-center gap-2'>
                {getPaymentIcon(
                  paymentMethod?.type,
                  'h-4 w-4',
                  paymentMethod?.icon,
                  paymentMethod?.name
                )}
                <span className='font-medium'>{paymentMethod?.name}</span>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter className='grid grid-cols-2 gap-2 sm:flex'>
          <AlertDialogCancel disabled={processing}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={processing}>
            {processing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Confirm Payment')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
