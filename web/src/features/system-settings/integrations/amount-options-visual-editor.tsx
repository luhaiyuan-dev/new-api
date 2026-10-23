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
import { Plus, X } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { safeJsonParseWithValidation } from '../utils/json-parser'
import { isArray } from '../utils/json-validators'

type AmountOptionsVisualEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function AmountOptionsVisualEditor({
  value,
  onChange,
}: AmountOptionsVisualEditorProps) {
  const { t } = useTranslation()
  const [newAmount, setNewAmount] = useState('')

  const amounts = useMemo(() => {
    const parsed = safeJsonParseWithValidation<unknown[]>(value, {
      fallback: [],
      validator: isArray,
      validatorMessage: t('Amount options must be a JSON array'),
      context: 'amount options',
    })

    return parsed
      .filter((item) => typeof item === 'number' || !isNaN(Number(item)))
      .map(Number)
      .sort((a, b) => a - b)
  }, [value, t])

  const handleAdd = () => {
    const amount = parseFloat(newAmount)
    if (isNaN(amount) || amount <= 0) {
      return
    }

    try {
      const updatedAmounts = [...amounts, amount]
        .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
        .sort((a, b) => a - b)

      onChange(JSON.stringify(updatedAmounts, null, 2))
      setNewAmount('')
    } catch (_error) {
      // eslint-disable-next-line no-console
      console.error('Failed to add amount:', _error)
    }
  }

  const handleRemove = (amount: number) => {
    try {
      const updatedAmounts = amounts.filter((a) => a !== amount)
      onChange(JSON.stringify(updatedAmounts, null, 2))
    } catch (_error) {
      // eslint-disable-next-line no-console
      console.error('Failed to remove amount:', _error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className='space-y-3'>
      {amounts.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm'>
          {t('No amount options configured. Add amounts below to get started.')}
        </div>
      ) : (
        <div className='flex flex-wrap gap-2'>
          {amounts.map((amount) => (
            <span
              key={amount}
              className='border-border/70 bg-muted/40 inline-flex h-8 max-w-full items-center gap-1 rounded-full border pr-1 pl-3 text-sm'
            >
              <span className='font-mono font-medium tabular-nums'>
                ¥{amount}
              </span>
              <Button
                type='button'
                variant='ghost'
                size='icon-xs'
                onClick={() => handleRemove(amount)}
                className='text-muted-foreground hover:bg-background hover:text-foreground size-6 shrink-0 rounded-full'
                aria-label={t('Remove ${{amount}}', { amount })}
              >
                <X className='size-3.5' />
              </Button>
            </span>
          ))}
        </div>
      )}

      <div className='flex items-center gap-2'>
        <Input
          type='number'
          step='0.01'
          min='0'
          placeholder={t('e.g., 100')}
          aria-label={t('Add new amount')}
          className='max-w-40'
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleAdd}
          disabled={!newAmount || parseFloat(newAmount) <= 0}
          className='h-8 shrink-0'
        >
          <Plus className='size-3.5' />
          {t('Add')}
        </Button>
      </div>
    </div>
  )
}
