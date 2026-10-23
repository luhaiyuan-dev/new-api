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

import type { StatusVariant } from '@/components/status-badge'
import { formatBillingCNY } from '@/lib/currency'

import { summarizeMediaSpec } from './media-pricing-spec'
import {
  MEDIA_KIND_LABEL_KEYS,
  type MediaKind,
  type MediaModelSpec,
  type MediaSpecSummary,
  type MediaUnit,
} from './media-pricing-types'

export const MEDIA_KIND_VARIANTS: Record<string, StatusVariant> = {
  image: 'blue',
  video: 'purple',
  audio: 'cyan',
  music: 'pink',
  text: 'neutral',
  embedding: 'green',
  rerank: 'amber',
}

const UNIT_SUFFIX: Record<MediaUnit, string> = {
  per_image: '/ image',
  per_second: '/ second',
  per_call: '/ call',
  per_1m_tokens: '/ 1M tokens',
}

type Translate = (key: string, options?: Record<string, unknown>) => string

export function mediaKindLabel(value: string, t: Translate): string {
  const key = MEDIA_KIND_LABEL_KEYS[value as MediaKind]
  return key ? t(key) : value || '-'
}

/** A media spec only charges when enabled and priced by image, second, or call. */
export function hasActiveMediaPricing(spec?: MediaModelSpec | null): boolean {
  if (!spec || spec.enabled === false) return false
  const unit = (spec.unit ?? '').toString().trim().toLowerCase()
  return unit !== '' && unit !== 'per_1m_tokens'
}

function formatMediaPriceSummary(
  summary: MediaSpecSummary | null,
  t: Translate
): { price: string; detail: string } {
  if (!summary || !summary.unit) {
    return { price: '-', detail: '' }
  }
  const suffix = UNIT_SUFFIX[summary.unit]
  let price = '-'
  if (summary.price !== null) {
    const cheapest = formatBillingCNY(summary.price)
    const dearest =
      summary.priceMax !== null && summary.priceMax > summary.price
        ? formatBillingCNY(summary.priceMax)
        : ''
    const amount = dearest ? `${cheapest} – ${dearest}` : cheapest
    price = `${amount} ${t(suffix)}`
  }
  let detail = ''
  if (summary.unit === 'per_image') {
    detail = t(
      '{{tiers}} resolution tiers · {{qualities}} quality tiers · {{cells}} price cells',
      {
        tiers: summary.resolutionTiers.length,
        qualities: summary.qualityTiers.length,
        cells: summary.priceCellCount,
      }
    )
  } else if (summary.resolutionTiers.length > 0) {
    detail = t('{{tiers}} resolution tiers', {
      tiers: summary.resolutionTiers.length,
    })
  }
  return { price, detail }
}

export function describeMediaPrice(
  spec: MediaModelSpec | undefined,
  t: Translate
): { price: string; detail: string } | null {
  if (!spec) return null
  return formatMediaPriceSummary(summarizeMediaSpec(spec), t)
}
