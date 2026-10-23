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
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { staticDataTableClassNames } from '@/components/data-table/static/static-data-table-classnames'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { safeJsonParseWithValidation } from '../utils/json-parser'
import { isObjectRecord } from '../utils/json-validators'
import {
  AmountDiscountDialog,
  type DiscountTier,
} from './amount-discount-dialog'

type AmountDiscountVisualEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function AmountDiscountVisualEditor(
  props: AmountDiscountVisualEditorProps
) {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTier, setEditingTier] = useState<DiscountTier | null>(null)

  const tiers = useMemo(() => {
    const parsed = safeJsonParseWithValidation<Record<string, unknown>>(
      props.value,
      {
        fallback: {},
        validator: isObjectRecord,
        validatorMessage: t('Amount discount must be a JSON object'),
        context: 'amount discounts',
      }
    )

    return Object.entries(parsed)
      .map(([amount, rate]) => ({
        amount: Number.parseInt(amount, 10),
        rate: Number(rate),
      }))
      .filter(
        (tier) =>
          Number.isInteger(tier.amount) &&
          tier.amount > 0 &&
          Number.isFinite(tier.rate) &&
          tier.rate > 0 &&
          tier.rate <= 1
      )
      .sort((a, b) => a.amount - b.amount)
  }, [props.value, t])

  const existingAmounts = useMemo(
    () =>
      tiers
        .filter((tier) => tier.amount !== editingTier?.amount)
        .map((tier) => tier.amount),
    [tiers, editingTier]
  )

  const commit = (nextTiers: DiscountTier[]) => {
    const record: Record<string, number> = {}
    for (const tier of nextTiers) {
      record[String(tier.amount)] = tier.rate
    }
    props.onChange(JSON.stringify(record, null, 2))
  }

  const handleCreate = () => {
    setEditingTier(null)
    setDialogOpen(true)
  }

  const handleEdit = (tier: DiscountTier) => {
    setEditingTier(tier)
    setDialogOpen(true)
  }

  const handleSave = (tier: DiscountTier) => {
    const nextTiers = [...tiers.filter((item) => item.amount !== editingTier?.amount), tier].sort(
      (a, b) => a.amount - b.amount
    )
    commit(nextTiers)
    setEditingTier(null)
  }

  const handleRemove = (amount: number) => {
    commit(tiers.filter((tier) => tier.amount !== amount))
  }

  return (
    <div className='space-y-3'>
      <div className='flex justify-end'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleCreate}
          className='h-8 w-full shrink-0 sm:w-auto'
        >
          <Plus className='size-3.5' />
          {t('Add discount')}
        </Button>
      </div>

      <StaticDataTable<DiscountTier>
        tableClassName='[&_tbody_tr]:h-auto'
        data={tiers}
        getRowKey={(tier) => tier.amount}
        emptyContent={
          <span className='text-sm'>
            {t('No discount tiers yet. Add one to offer recharge discounts.')}
          </span>
        }
        emptyClassName='text-muted-foreground py-10'
        headerRowClassName={staticDataTableClassNames.mutedHeaderRow}
        columns={[
          {
            id: 'amount',
            header: t('Recharge Amount'),
            className: 'w-[32%] px-4',
            cellClassName: 'px-4 py-3',
            cell: (tier) => (
              <span className='font-mono text-sm font-medium tabular-nums'>
                ¥{tier.amount}
              </span>
            ),
          },
          {
            id: 'rate',
            header: t('Discount Rate'),
            className: 'w-[32%] px-4',
            cellClassName: 'px-4 py-3',
            cell: (tier) => (
              <span className='font-mono text-sm tabular-nums'>
                {tier.rate.toFixed(2)}
              </span>
            ),
          },
          {
            id: 'actions',
            header: t('Actions'),
            className: cn(staticDataTableClassNames.actionHeaderCell, 'px-4'),
            cellClassName: cn(
              staticDataTableClassNames.actionCell,
              'px-4 py-3'
            ),
            cell: (tier) => (
              <div className='flex justify-end gap-1'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => handleEdit(tier)}
                  className='text-muted-foreground hover:text-foreground'
                  aria-label={t('Edit discount tier')}
                >
                  <Pencil className='h-3.5 w-3.5' />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => handleRemove(tier.amount)}
                  className='text-muted-foreground hover:text-destructive'
                  aria-label={t('Delete discount tier')}
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </Button>
              </div>
            ),
          },
        ]}
      />

      <AmountDiscountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSave}
        tier={editingTier}
        existingAmounts={existingAmounts}
      />
    </div>
  )
}
