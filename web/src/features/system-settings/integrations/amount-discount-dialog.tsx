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
import { zodResolver } from '@hookform/resolvers/zod'
import type { TFunction } from 'i18next'
import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

export type DiscountTier = {
  /** Recharge amount tier (CNY) */
  amount: number
  /** Payable ratio: 1 = full price, 0.9 = pay 90% */
  rate: number
}

type AmountDiscountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (tier: DiscountTier) => void
  /** Tier being edited, or null when creating a new one */
  tier: DiscountTier | null
  /** Recharge amounts already used by other tiers */
  existingAmounts: number[]
}

const AMOUNT_DISCOUNT_FORM_ID = 'amount-discount-tier-form'

const createDiscountTierSchema = (
  t: TFunction,
  existingAmounts: number[]
) =>
  z.object({
    amount: z
      .string()
      .trim()
      .min(1, t('Amount must be greater than 0'))
      .refine(
        (value) => /^\d+$/.test(value),
        t('Amount must be a whole number')
      )
      .refine(
        (value) => Number(value) > 0,
        t('Amount must be greater than 0')
      )
      .refine(
        (value) => !existingAmounts.includes(Number(value)),
        t('A discount tier with this recharge amount already exists')
      ),
    rate: z
      .string()
      .trim()
      .min(1, t('Discount rate must be greater than 0'))
      .refine(
        (value) => Number(value) > 0,
        t('Discount rate must be greater than 0')
      )
      .refine(
        (value) => Number(value) <= 1,
        t('Discount rate must be at most 1')
      ),
  })

type DiscountTierFormValues = z.infer<
  ReturnType<typeof createDiscountTierSchema>
>

export function AmountDiscountDialog(props: AmountDiscountDialogProps) {
  const { t } = useTranslation()
  const isEditing = props.tier !== null
  const schema = useMemo(
    () => createDiscountTierSchema(t, props.existingAmounts),
    [t, props.existingAmounts]
  )

  const form = useForm<DiscountTierFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { amount: '', rate: '1' },
  })

  const editedAmount = props.tier?.amount
  const editedRate = props.tier?.rate

  useEffect(() => {
    if (!props.open) return
    form.reset({
      amount: editedAmount === undefined ? '' : String(editedAmount),
      rate: editedRate === undefined ? '1' : String(editedRate),
    })
  }, [props.open, editedAmount, editedRate, form])

  const watchedValues = useWatch({ control: form.control })
  const amountValue = Number(watchedValues.amount)
  const rateValue = Number(watchedValues.rate)
  const hasPreview =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    Number.isFinite(rateValue) &&
    rateValue > 0 &&
    rateValue <= 1
  const payable = hasPreview
    ? Number((amountValue * rateValue).toFixed(2))
    : 0
  const savedAmount = hasPreview
    ? Number((amountValue - amountValue * rateValue).toFixed(2))
    : 0

  const handleSubmit = (values: DiscountTierFormValues) => {
    props.onSubmit({ amount: Number(values.amount), rate: Number(values.rate) })
    props.onOpenChange(false)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={isEditing ? t('Edit discount tier') : t('Add discount tier')}
      description={t('Set the payable ratio for one recharge amount tier.')}
      contentClassName='sm:max-w-md'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form={AMOUNT_DISCOUNT_FORM_ID}>
            {isEditing ? t('Update') : t('Add')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={AMOUNT_DISCOUNT_FORM_ID}
          onSubmit={form.handleSubmit(handleSubmit)}
          className='space-y-4'
        >
          <FormField
            control={form.control}
            name='amount'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Recharge Amount')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    step='1'
                    min='1'
                    inputMode='numeric'
                    placeholder={t('e.g., 100')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('Recharge amount that triggers this discount tier')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='rate'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Discount Rate')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    step='0.01'
                    min='0.01'
                    max='1'
                    inputMode='decimal'
                    placeholder={t('e.g., 0.9')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Discount rate is the payable ratio: 0.9 means users pay 90% of the recharge amount.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {hasPreview ? (
            <div className='bg-muted/40 grid gap-2 rounded-lg border px-3 py-2.5 text-sm'>
              <div className='flex items-center justify-between gap-3'>
                <span className='text-muted-foreground'>
                  {t('Payable amount')}
                </span>
                <span className='font-mono font-medium'>¥{payable}</span>
              </div>
              <div className='flex items-center justify-between gap-3'>
                <span className='text-muted-foreground'>
                  {t('Discount amount')}
                </span>
                <span className='font-mono'>¥{savedAmount}</span>
              </div>
            </div>
          ) : null}
        </form>
      </Form>
    </Dialog>
  )
}
