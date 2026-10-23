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
import { formatCNY } from '@/lib/currency'

import type { PricingModel } from '../types'
import { stripTrailingZeros } from './price'

const MEDIA_UNIT_LABEL_KEYS: Record<string, string> = {
  per_image: 'Per image',
  per_second: 'Per second',
  per_call: 'Per call',
}

export type MediaPricePreview = {
  /** i18n key of the billing unit, e.g. "Per image". */
  unitLabelKey: string
  /** Per-unit price in CNY, e.g. "¥0.1 – ¥0.4". */
  unitPrice: string
  resolutionTiers: string[]
  qualityTiers: string[]
  /** Billed duration assumed by video previews, when the spec declares one. */
  defaultDuration?: number
}

/**
 * Builds the media price preview from the structured `media_price` payload of
 * the pricing API. Returns null when the backend reports no active media price,
 * so callers can fall back to the plain `media_summary` text.
 */
export function getMediaPricePreview(
  model: PricingModel
): MediaPricePreview | null {
  const info = model.media_price
  if (!info || !(info.min_price > 0)) return null

  const cheapest = stripTrailingZeros(formatCNY(info.min_price))
  const dearest =
    info.max_price > info.min_price
      ? stripTrailingZeros(formatCNY(info.max_price))
      : ''

  return {
    unitLabelKey: MEDIA_UNIT_LABEL_KEYS[info.unit] ?? 'Per request',
    unitPrice: dearest ? `${cheapest} – ${dearest}` : cheapest,
    resolutionTiers: info.resolution_tiers ?? [],
    qualityTiers: info.quality_tiers ?? [],
    defaultDuration: info.default_duration,
  }
}
