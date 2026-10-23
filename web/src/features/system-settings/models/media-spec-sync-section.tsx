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
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'

import type { MediaDifferences } from '../types'
import { describeMediaSpec } from './media-pricing/media-pricing-spec'

export interface MediaSpecSyncSectionProps {
  differences: MediaDifferences
  selections: Record<string, string>
  isDisabled: boolean
  onSelect: (model: string, channel: string | null) => void
}

export function MediaSpecSyncSection(props: MediaSpecSyncSectionProps) {
  const { t } = useTranslation()
  const models = Object.entries(props.differences)

  if (models.length === 0) return null

  return (
    <section className='shrink-0 space-y-2 rounded-lg border p-3'>
      <h3 className='text-sm font-medium'>
        {t('Media price table differences')}
      </h3>
      <div className='max-h-56 space-y-2 overflow-y-auto'>
        {models.map(([model, difference]) => {
          const selected = props.selections[model]
          return (
            <div key={model} className='rounded-md border px-3 py-2'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-mono text-xs'>{model}</span>
                {!difference.local && (
                  <span className='text-muted-foreground text-xs'>
                    {t('Not configured locally')}
                  </span>
                )}
              </div>
              <div className='mt-2 flex flex-col gap-1'>
                {Object.entries(difference.upstreams).map(
                  ([channel, spec]) => (
                    <label
                      key={channel}
                      className='hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded px-1 py-0.5'
                    >
                      <Checkbox
                        className='mt-0.5'
                        checked={selected === channel}
                        disabled={props.isDisabled}
                        onCheckedChange={(checked) =>
                          props.onSelect(
                            model,
                            checked === true ? channel : null
                          )
                        }
                      />
                      <span className='min-w-0 flex-1'>
                        <span className='text-[11px] font-medium'>
                          {channel}
                        </span>
                        <span className='text-muted-foreground block truncate text-[11px]'>
                          {describeMediaSpec(spec)}
                        </span>
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
