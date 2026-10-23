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

import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { DraftRow, TierRow } from './media-pricing-draft'
import { COMMON_MEDIA_SIZES } from './media-pricing-spec'
import type { MediaDurationRounding } from './media-pricing-types'

const SIZE_DATALIST_ID = 'media-pricing-size-options'

export function NumberField(props: {
  label: string
  description?: string
  value: string
  placeholder?: string
  step?: string
  min?: number
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{props.label}</FieldLabel>
      <Input
        type='number'
        inputMode='decimal'
        min={props.min}
        step={props.step ?? 'any'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.description && (
        <FieldDescription>{props.description}</FieldDescription>
      )}
    </Field>
  )
}

export function TierRowsEditor(props: {
  rows: TierRow[]
  onChange: (rows: TierRow[]) => void
  onAdd: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className='space-y-3'>
      <datalist id={SIZE_DATALIST_ID}>
        {COMMON_MEDIA_SIZES.map((size) => (
          <option key={size} value={size} />
        ))}
      </datalist>
      <div className='space-y-2'>
        {props.rows.map((row) => (
          <div key={row.id} className='flex items-start gap-2'>
            <Input
              className='w-32 shrink-0'
              value={row.name}
              placeholder='1k'
              aria-label={t('Resolution tier name')}
              onChange={(event) =>
                props.onChange(
                  props.rows.map((item) =>
                    item.id === row.id
                      ? { ...item, name: event.target.value }
                      : item
                  )
                )
              }
            />
            <Input
              list={SIZE_DATALIST_ID}
              value={row.sizes}
              placeholder='1024x1024, 1536x1024'
              aria-label={t('Sizes in this tier')}
              onChange={(event) =>
                props.onChange(
                  props.rows.map((item) =>
                    item.id === row.id
                      ? { ...item, sizes: event.target.value }
                      : item
                  )
                )
              }
            />
            <Button
              variant='ghost'
              size='icon-sm'
              className='mt-1.5'
              aria-label={t('Remove tier')}
              onClick={() =>
                props.onChange(props.rows.filter((item) => item.id !== row.id))
              }
            >
              <Trash2 className='text-destructive' />
            </Button>
          </div>
        ))}
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <Button variant='outline' size='sm' onClick={props.onAdd}>
          <Plus data-icon='inline-start' />
          {t('Add resolution tier')}
        </Button>
        <p className='text-muted-foreground text-xs'>
          {t('Sizes use the WIDTHxHEIGHT format, separated by commas.')}
        </p>
      </div>
    </div>
  )
}

export function ValueRowsEditor(props: {
  rows: DraftRow[]
  onChange: (rows: DraftRow[]) => void
  onAdd: () => void
  valuePlaceholder?: string
  label?: string
}) {
  const { t } = useTranslation()
  return (
    <div className='space-y-2'>
      {props.rows.map((row) => (
        <div key={row.id} className='flex items-center gap-2'>
          <Input
            value={row.value}
            placeholder={props.valuePlaceholder}
            aria-label={props.label ?? t('Value')}
            onChange={(event) =>
              props.onChange(
                props.rows.map((item) =>
                  item.id === row.id
                    ? { ...item, value: event.target.value }
                    : item
                )
              )
            }
          />
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={t('Remove')}
            onClick={() =>
              props.onChange(props.rows.filter((item) => item.id !== row.id))
            }
          >
            <Trash2 className='text-destructive' />
          </Button>
        </div>
      ))}
      <Button variant='outline' size='sm' onClick={props.onAdd}>
        <Plus data-icon='inline-start' />
        {t('Add')}
      </Button>
    </div>
  )
}

export function KeyValueRowsEditor(props: {
  rows: DraftRow[]
  onChange: (rows: DraftRow[]) => void
  onAdd: () => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  numeric?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className='space-y-2'>
      {props.rows.map((row) => (
        <div key={row.id} className='flex items-center gap-2'>
          <Input
            className='min-w-0 flex-1'
            value={row.key}
            placeholder={props.keyPlaceholder}
            aria-label={t('Key')}
            onChange={(event) =>
              props.onChange(
                props.rows.map((item) =>
                  item.id === row.id
                    ? { ...item, key: event.target.value }
                    : item
                )
              )
            }
          />
          <Input
            className='w-32 shrink-0'
            type={props.numeric ? 'number' : 'text'}
            step={props.numeric ? 'any' : undefined}
            min={props.numeric ? 0 : undefined}
            value={row.value}
            placeholder={props.valuePlaceholder}
            aria-label={t('Value')}
            onChange={(event) =>
              props.onChange(
                props.rows.map((item) =>
                  item.id === row.id
                    ? { ...item, value: event.target.value }
                    : item
                )
              )
            }
          />
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={t('Remove')}
            onClick={() =>
              props.onChange(props.rows.filter((item) => item.id !== row.id))
            }
          >
            <Trash2 className='text-destructive' />
          </Button>
        </div>
      ))}
      <Button variant='outline' size='sm' onClick={props.onAdd}>
        <Plus data-icon='inline-start' />
        {t('Add')}
      </Button>
    </div>
  )
}

export function PriceMatrixEditor(props: {
  resolutionTiers: string[]
  qualityTiers: string[]
  value: Record<string, Record<string, string>>
  onChange: (value: Record<string, Record<string, string>>) => void
}) {
  const { t } = useTranslation()
  const rows = ['*', ...props.resolutionTiers.filter((tier) => tier !== '*')]
  const columns = ['*', ...props.qualityTiers.filter((tier) => tier !== '*')]

  const setCell = (tier: string, quality: string, raw: string) => {
    const row = { ...props.value[tier] }
    if (raw.trim() === '') delete row[quality]
    else row[quality] = raw
    const next = { ...props.value }
    if (Object.keys(row).length === 0) delete next[tier]
    else next[tier] = row
    props.onChange(next)
  }

  return (
    <div className='overflow-x-auto rounded-md border'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='bg-muted/40 text-xs'>
            <th className='text-muted-foreground px-3 py-2 text-left font-medium'>
              {t('Resolution')}
            </th>
            {columns.map((quality) => (
              <th
                key={quality}
                className='text-muted-foreground min-w-24 px-2 py-2 text-left font-medium'
              >
                {quality === '*' ? t('Any quality') : quality}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((tier) => (
            <tr key={tier} className='border-t'>
              <th className='px-3 py-2 text-left font-medium'>
                {tier === '*' ? t('Any resolution') : tier}
              </th>
              {columns.map((quality) => (
                <td key={quality} className='px-2 py-2'>
                  <Input
                    className={cn('h-8 w-24 font-mono tabular-nums')}
                    type='number'
                    step='any'
                    min={0}
                    value={props.value[tier]?.[quality] ?? ''}
                    aria-label={`${tier}/${quality}`}
                    placeholder={t('unset')}
                    onChange={(event) =>
                      setCell(tier, quality, event.target.value)
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DurationEditor(props: {
  min: string
  max: string
  fallback: string
  rounding: MediaDurationRounding
  onChange: (patch: {
    min?: string
    max?: string
    fallback?: string
    rounding?: MediaDurationRounding
  }) => void
}) {
  const { t } = useTranslation()
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <NumberField
        label={t('Minimum seconds')}
        value={props.min}
        placeholder='1'
        onChange={(value) => props.onChange({ min: value })}
      />
      <NumberField
        label={t('Maximum seconds')}
        value={props.max}
        placeholder='3600'
        onChange={(value) => props.onChange({ max: value })}
      />
      <NumberField
        label={t('Default seconds')}
        description={t('Used when the request does not declare a duration.')}
        value={props.fallback}
        placeholder='5'
        onChange={(value) => props.onChange({ fallback: value })}
      />
      <Field>
        <FieldLabel>{t('Duration rounding')}</FieldLabel>
        <Select
          value={props.rounding}
          onValueChange={(value) =>
            props.onChange({
              rounding: value === 'exact' ? 'exact' : 'ceil',
            })
          }
        >
          <SelectTrigger>
            <SelectValue>
              {props.rounding === 'exact'
                ? t('Keep exact seconds')
                : t('Round up to whole seconds')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='ceil'>{t('Round up to whole seconds')}</SelectItem>
            <SelectItem value='exact'>{t('Keep exact seconds')}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}
