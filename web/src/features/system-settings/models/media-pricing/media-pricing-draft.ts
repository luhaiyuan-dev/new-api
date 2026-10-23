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

import { emptyMediaSpec } from './media-pricing-spec'
import type {
  MediaDurationRounding,
  MediaModelSpec,
  MediaPricingModels,
} from './media-pricing-types'

export type DraftRow = {
  id: string
  key: string
  value: string
}

export type TierRow = {
  id: string
  name: string
  sizes: string
}

export type MediaPricingDraft = {
  name: string
  spec: MediaModelSpec
  tierRows: TierRow[]
  qualityRows: DraftRow[]
  aliasRows: DraftRow[]
  resolutionRatioRows: DraftRow[]
  qualityRatioRows: DraftRow[]
  extraRatioRows: DraftRow[]
  priceTable: Record<string, Record<string, string>>
  durationMin: string
  durationMax: string
  durationDefault: string
  durationRounding: MediaDurationRounding
}

let rowSeq = 0
export function nextRowId(prefix = 'row'): string {
  rowSeq += 1
  return `${prefix}-${rowSeq}`
}

function numberToText(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}

export function createEmptyDraft(name = ''): MediaPricingDraft {
  return {
    name,
    spec: emptyMediaSpec('image'),
    tierRows: [],
    qualityRows: [],
    aliasRows: [],
    resolutionRatioRows: [],
    qualityRatioRows: [],
    extraRatioRows: [],
    priceTable: {},
    durationMin: '',
    durationMax: '',
    durationDefault: '',
    durationRounding: 'ceil',
  }
}

function mapToRows(
  map: Record<string, number> | undefined,
  prefix: string
): DraftRow[] {
  return Object.entries(map ?? {}).map(([key, value]) => ({
    id: nextRowId(prefix),
    key,
    value: numberToText(value),
  }))
}

export function specToDraft(name: string, spec?: MediaModelSpec): MediaPricingDraft {
  if (!spec) return createEmptyDraft(name)
  const duration = spec.duration ?? {}
  return {
    name,
    spec,
    tierRows: Object.entries(spec.resolution_tiers ?? {}).map(
      ([tier, sizes]) => ({
        id: nextRowId('tier'),
        name: tier,
        sizes: sizes.join(', '),
      })
    ),
    qualityRows: (spec.quality_tiers ?? []).map((quality) => ({
      id: nextRowId('quality'),
      key: '',
      value: quality,
    })),
    aliasRows: Object.entries(spec.quality_aliases ?? {}).map(
      ([key, value]) => ({ id: nextRowId('alias'), key, value })
    ),
    resolutionRatioRows: mapToRows(spec.resolution_ratios, 'resolution'),
    qualityRatioRows: mapToRows(spec.quality_ratios, 'quality'),
    extraRatioRows: mapToRows(spec.extra_ratios, 'extra'),
    priceTable: Object.fromEntries(
      Object.entries(spec.price_table ?? {}).map(([tier, row]) => [
        tier,
        Object.fromEntries(
          Object.entries(row).map(([quality, price]) => [
            quality,
            numberToText(price),
          ])
        ),
      ])
    ),
    durationMin: numberToText(duration.min),
    durationMax: numberToText(duration.max),
    durationDefault: numberToText(duration.default),
    durationRounding: duration.rounding === 'exact' ? 'exact' : 'ceil',
  }
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : undefined
}

function rowsToNumericMap(rows: DraftRow[]): Record<string, number> | undefined {
  const result: Record<string, number> = {}
  for (const row of rows) {
    const key = row.key.trim()
    const num = parseOptionalNumber(row.value)
    if (!key || num === undefined) continue
    result[key] = num
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function rowsToTextMap(rows: DraftRow[]): Record<string, string> | undefined {
  const result: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    const value = row.value.trim()
    if (!key || !value) continue
    result[key] = value
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function tierRowsToRecord(
  rows: TierRow[]
): Record<string, string[]> | undefined {
  const result: Record<string, string[]> = {}
  for (const row of rows) {
    const tier = row.name.trim()
    if (!tier) continue
    const sizes = row.sizes
      .split(',')
      .map((size) => size.trim().toLowerCase())
      .filter(Boolean)
    result[tier] = sizes
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function qualityRowsToRecord(rows: DraftRow[]): string[] | undefined {
  const values = rows
    .map((row) => row.value.trim().toLowerCase())
    .filter(Boolean)
  return values.length > 0 ? [...new Set(values)] : undefined
}

function cleanPriceTable(
  priceTable: Record<string, Record<string, string>>
): Record<string, Record<string, number>> | undefined {
  const result: Record<string, Record<string, number>> = {}
  for (const [tier, row] of Object.entries(priceTable)) {
    if (!tier.trim()) continue
    const prices: Record<string, number> = {}
    for (const [quality, raw] of Object.entries(row)) {
      const price = parseOptionalNumber(raw)
      if (!quality.trim() || price === undefined || price <= 0) continue
      prices[quality] = price
    }
    if (Object.keys(prices).length > 0) result[tier] = prices
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/** Merge visual draft fields over the original spec, keeping unknown keys. */
export function buildSpecFromDraft(draft: MediaPricingDraft): MediaModelSpec {
  const next: MediaModelSpec = { ...draft.spec }

  const assign = <K extends keyof MediaModelSpec>(
    key: K,
    value: MediaModelSpec[K] | undefined
  ) => {
    if (value === undefined) delete next[key]
    else next[key] = value
  }

  assign('resolution_tiers', tierRowsToRecord(draft.tierRows))
  assign('quality_tiers', qualityRowsToRecord(draft.qualityRows))
  assign('quality_aliases', rowsToTextMap(draft.aliasRows))
  assign('resolution_ratios', rowsToNumericMap(draft.resolutionRatioRows))
  assign('quality_ratios', rowsToNumericMap(draft.qualityRatioRows))
  assign('extra_ratios', rowsToNumericMap(draft.extraRatioRows))
  assign('price_table', cleanPriceTable(draft.priceTable))

  const min = parseOptionalNumber(draft.durationMin)
  const max = parseOptionalNumber(draft.durationMax)
  const fallback = parseOptionalNumber(draft.durationDefault)
  if (min !== undefined || max !== undefined || fallback !== undefined) {
    next.duration = {
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      ...(fallback !== undefined ? { default: fallback } : {}),
      rounding: draft.durationRounding,
    }
  } else {
    delete next.duration
  }

  return next
}

export function duplicateName(
  baseName: string,
  models: MediaPricingModels
): string {
  const stem = baseName.trim() || 'model'
  let candidate = `${stem}-copy`
  let index = 2
  while (candidate in models) {
    candidate = `${stem}-copy-${index}`
    index += 1
  }
  return candidate
}
