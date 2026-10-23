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

import {
  MEDIA_KINDS,
  MEDIA_UNITS,
  type MediaDurationSpec,
  type MediaKind,
  type MediaModelSpec,
  type MediaPreviewInput,
  type MediaPreviewResult,
  type MediaPricingModels,
  type MediaPricingOpaqueModels,
  type MediaPricingParseResult,
  type MediaSpecIssue,
  type MediaSpecSummary,
  type MediaTierPrice,
  type MediaUnit,
} from './media-pricing-types'

export const MAX_UNIT_PRICE = 1_000_000
export const MAX_RATIO = 1_000
export const MAX_DURATION_SECONDS = 3_600

const SIZE_PATTERN = /^\d+x\d+$/

export const COMMON_MEDIA_SIZES = [
  '512x512',
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '720x1280',
  '1280x720',
  '1080x1920',
  '1920x1080',
  '2160x3840',
  '3840x2160',
]

type UnknownRecord = Record<string, unknown>

function isPlainObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

function normalizeNumberMap(value: unknown): Record<string, number> | undefined {
  if (!isPlainObject(value)) return undefined
  const result: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    const num = finiteNumber(raw)
    if (key.trim() && num !== undefined) result[key] = num
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const result = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  return result.length > 0 ? result : undefined
}

function normalizeResolutionTiers(
  value: unknown
): Record<string, string[]> | undefined {
  if (!isPlainObject(value)) return undefined
  const result: Record<string, string[]> = {}
  for (const [tier, sizes] of Object.entries(value)) {
    if (!tier.trim() || !Array.isArray(sizes)) continue
    const normalized = sizes
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
    if (normalized.length > 0) result[tier.trim()] = normalized
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function normalizePriceTable(
  value: unknown
): Record<string, Record<string, number>> | undefined {
  if (!isPlainObject(value)) return undefined
  const result: Record<string, Record<string, number>> = {}
  for (const [tier, row] of Object.entries(value)) {
    if (!tier.trim() || !isPlainObject(row)) continue
    const prices: Record<string, number> = {}
    for (const [quality, raw] of Object.entries(row)) {
      const num = finiteNumber(raw)
      if (quality.trim() && num !== undefined) prices[quality] = num
    }
    if (Object.keys(prices).length > 0) result[tier.trim()] = prices
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function normalizeDuration(value: unknown): MediaDurationSpec | undefined {
  if (!isPlainObject(value)) return undefined
  const duration: MediaDurationSpec = {}
  const min = finiteNumber(value.min)
  const max = finiteNumber(value.max)
  const fallback = finiteNumber(value.default)
  if (min !== undefined) duration.min = min
  if (max !== undefined) duration.max = max
  if (fallback !== undefined) duration.default = fallback
  if (value.rounding === 'ceil' || value.rounding === 'exact') {
    duration.rounding = value.rounding
  }
  return Object.keys(duration).length > 0 ? duration : undefined
}

/** Keep unknown keys, drop known keys whose JSON type would be rejected. */
export function normalizeMediaSpec(raw: UnknownRecord): MediaModelSpec {
  const spec: MediaModelSpec = { ...raw }
  const assign = <K extends keyof MediaModelSpec>(
    key: K,
    value: MediaModelSpec[K] | undefined
  ) => {
    if (value === undefined) {
      delete spec[key]
    } else {
      spec[key] = value
    }
  }

  if (typeof raw.enabled !== 'boolean') delete spec.enabled
  assign('kind', typeof raw.kind === 'string' ? raw.kind.trim() : undefined)
  assign('unit', typeof raw.unit === 'string' ? raw.unit.trim() : undefined)
  assign('base_price', finiteNumber(raw.base_price))
  assign('per_second', finiteNumber(raw.per_second))
  assign(
    'default_resolution_tier',
    typeof raw.default_resolution_tier === 'string'
      ? raw.default_resolution_tier.trim()
      : undefined
  )
  assign(
    'default_quality_tier',
    typeof raw.default_quality_tier === 'string'
      ? raw.default_quality_tier.trim()
      : undefined
  )
  assign('resolution_tiers', normalizeResolutionTiers(raw.resolution_tiers))
  assign('quality_tiers', normalizeStringList(raw.quality_tiers))
  assign('price_table', normalizePriceTable(raw.price_table))
  assign('resolution_ratios', normalizeNumberMap(raw.resolution_ratios))
  assign('quality_ratios', normalizeNumberMap(raw.quality_ratios))
  assign('extra_ratios', normalizeNumberMap(raw.extra_ratios))

  if (isPlainObject(raw.quality_aliases)) {
    const aliases: Record<string, string> = {}
    for (const [key, target] of Object.entries(raw.quality_aliases)) {
      if (key.trim() && typeof target === 'string' && target.trim()) {
        aliases[key.trim()] = target.trim()
      }
    }
    assign(
      'quality_aliases',
      Object.keys(aliases).length > 0 ? aliases : undefined
    )
  } else {
    delete spec.quality_aliases
  }

  assign('duration', normalizeDuration(raw.duration))
  return spec
}

export function emptyMediaSpec(kind: MediaKind = 'image'): MediaModelSpec {
  let unit: MediaUnit = 'per_call'
  if (kind === 'image') unit = 'per_image'
  else if (kind === 'video') unit = 'per_second'
  return { kind, unit }
}

export function parseMediaModels(json: string): MediaPricingParseResult {
  const raw = (json ?? '').trim()
  if (!raw) return { models: {}, opaque: {}, errorKey: '' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { models: {}, opaque: {}, errorKey: 'Invalid JSON' }
  }
  if (!isPlainObject(parsed)) {
    return {
      models: {},
      opaque: {},
      errorKey: 'The media price table must be a JSON object',
    }
  }

  const models: MediaPricingModels = {}
  const opaque: MediaPricingOpaqueModels = {}
  for (const [name, value] of Object.entries(parsed)) {
    const trimmed = name.trim()
    if (!trimmed) continue
    if (isPlainObject(value)) {
      models[trimmed] = normalizeMediaSpec(value)
    } else {
      opaque[trimmed] = value
    }
  }
  return { models, opaque, errorKey: '' }
}

function cleanedNumber(value: unknown, allowZero = false): number | undefined {
  const num = finiteNumber(value)
  if (num === undefined) return undefined
  if (allowZero ? num < 0 : num <= 0) return undefined
  return num
}

/** Canonical JSON shape: keeps unknown keys, drops empty optional fields. */
export function toSerializableSpec(spec: MediaModelSpec): MediaModelSpec {
  const next: MediaModelSpec = { ...spec }

  const kind = typeof spec.kind === 'string' ? spec.kind.trim() : ''
  if (kind) next.kind = kind
  else delete next.kind

  const unit = typeof spec.unit === 'string' ? spec.unit.trim() : ''
  if (unit) next.unit = unit
  else delete next.unit

  if (typeof spec.enabled !== 'boolean') delete next.enabled

  const basePrice = cleanedNumber(spec.base_price)
  if (basePrice !== undefined) next.base_price = basePrice
  else delete next.base_price

  const perSecond = cleanedNumber(spec.per_second)
  if (perSecond !== undefined) next.per_second = perSecond
  else delete next.per_second

  const resolutionTiers = normalizeResolutionTiers(spec.resolution_tiers)
  if (resolutionTiers) next.resolution_tiers = resolutionTiers
  else delete next.resolution_tiers

  const qualityTiers = normalizeStringList(spec.quality_tiers)
  if (qualityTiers) next.quality_tiers = qualityTiers
  else delete next.quality_tiers

  const priceTable = normalizePriceTable(spec.price_table)
  if (priceTable) next.price_table = priceTable
  else delete next.price_table

  for (const key of [
    'resolution_ratios',
    'quality_ratios',
    'extra_ratios',
  ] as const) {
    const map = normalizeNumberMap(spec[key])
    if (map) next[key] = map
    else delete next[key]
  }

  if (isPlainObject(spec.quality_aliases)) {
    const aliases: Record<string, string> = {}
    for (const [key, target] of Object.entries(spec.quality_aliases)) {
      if (key.trim() && typeof target === 'string' && target.trim()) {
        aliases[key.trim()] = target.trim()
      }
    }
    if (Object.keys(aliases).length > 0) next.quality_aliases = aliases
    else delete next.quality_aliases
  }

  const defaultResolution =
    typeof spec.default_resolution_tier === 'string'
      ? spec.default_resolution_tier.trim()
      : ''
  if (defaultResolution) next.default_resolution_tier = defaultResolution
  else delete next.default_resolution_tier

  const defaultQuality =
    typeof spec.default_quality_tier === 'string'
      ? spec.default_quality_tier.trim()
      : ''
  if (defaultQuality) next.default_quality_tier = defaultQuality
  else delete next.default_quality_tier

  const duration = normalizeDuration(spec.duration)
  if (duration) next.duration = duration
  else delete next.duration

  return next
}

export function serializeMediaModels(
  models: MediaPricingModels,
  opaque: MediaPricingOpaqueModels = {}
): string {
  const result: Record<string, unknown> = {}
  for (const name of Object.keys(models).sort((a, b) => a.localeCompare(b))) {
    result[name] = toSerializableSpec(models[name])
  }
  for (const [name, value] of Object.entries(opaque)) {
    result[name] = value
  }
  return JSON.stringify(result, null, 2)
}

export function getDeclaredResolutionTiers(spec: MediaModelSpec): string[] {
  const tiers = new Set<string>()
  Object.keys(spec.resolution_tiers ?? {}).forEach((tier) => tiers.add(tier))
  Object.keys(spec.resolution_ratios ?? {}).forEach((tier) => {
    if (tier !== '*') tiers.add(tier)
  })
  Object.keys(spec.price_table ?? {}).forEach((tier) => {
    if (tier !== '*') tiers.add(tier)
  })
  return sortTierNames([...tiers], spec.resolution_tiers)
}

export function getDeclaredQualityTiers(spec: MediaModelSpec): string[] {
  const tiers = new Set<string>()
  ;(spec.quality_tiers ?? []).forEach((tier) => tiers.add(tier.toLowerCase()))
  Object.keys(spec.quality_ratios ?? {}).forEach((tier) => {
    if (tier !== '*') tiers.add(tier.toLowerCase())
  })
  Object.values(spec.quality_aliases ?? {}).forEach((tier) => {
    if (tier.trim()) tiers.add(tier.trim().toLowerCase())
  })
  Object.values(spec.price_table ?? {}).forEach((row) => {
    Object.keys(row).forEach((quality) => {
      if (quality !== '*') tiers.add(quality.toLowerCase())
    })
  })
  return [...tiers].sort((a, b) => a.localeCompare(b))
}

function tierPixels(tier: string, sizes: string[] | undefined): number {
  let smallest = 0
  for (const size of sizes ?? []) {
    const [width, height] = size.split('x').map((part) => Number(part))
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue
    const pixels = width * height
    if (pixels > 0 && (smallest === 0 || pixels < smallest)) smallest = pixels
  }
  if (smallest > 0) return smallest
  const match = /^(\d+)p$/i.exec(tier)
  return match ? Number(match[1]) : 0
}

export function sortTierNames(
  tiers: string[],
  sizesByTier?: Record<string, string[]>
): string[] {
  return [...tiers].sort((left, right) => {
    const leftPixels = tierPixels(left, sizesByTier?.[left])
    const rightPixels = tierPixels(right, sizesByTier?.[right])
    if (leftPixels !== rightPixels) {
      if (leftPixels === 0) return 1
      if (rightPixels === 0) return -1
      return leftPixels - rightPixels
    }
    return left.localeCompare(right)
  })
}

function isRatio(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_RATIO
}

function isPrice(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_UNIT_PRICE
}

function hasDeclaredResolutionTier(
  spec: MediaModelSpec,
  tier: string
): boolean {
  if (!tier) return false
  if (spec.resolution_tiers && tier in spec.resolution_tiers) return true
  return Boolean(spec.resolution_ratios && tier in spec.resolution_ratios)
}

function hasDeclaredQualityTier(spec: MediaModelSpec, quality: string): boolean {
  if (!quality) return false
  const target = quality.toLowerCase()
  const declared = (spec.quality_tiers ?? []).some(
    (candidate) => candidate.trim().toLowerCase() === target
  )
  if (declared) return true
  const aliased = Object.values(spec.quality_aliases ?? {}).some(
    (candidate) => candidate.trim().toLowerCase() === target
  )
  if (aliased) return true
  return Boolean(spec.quality_ratios && quality in spec.quality_ratios)
}

function validateRatios(
  spec: MediaModelSpec,
  field: 'resolution_ratios' | 'quality_ratios' | 'extra_ratios'
): MediaSpecIssue[] {
  const issues: MediaSpecIssue[] = []
  for (const [key, ratio] of Object.entries(spec[field] ?? {})) {
    if (!key.trim()) {
      issues.push({ code: 'ratio_key_empty', path: field })
      continue
    }
    if (!isRatio(ratio)) {
      issues.push({
        code: 'ratio_invalid',
        path: `${field}.${key}`,
        params: { field, key, limit: MAX_RATIO },
      })
    }
  }
  return issues
}

function validateResolutionTiers(spec: MediaModelSpec): MediaSpecIssue[] {
  const issues: MediaSpecIssue[] = []
  const seen = new Map<string, string>()

  for (const [tier, sizes] of Object.entries(spec.resolution_tiers ?? {})) {
    if (!tier.trim()) {
      issues.push({ code: 'resolution_tier_empty', path: 'resolution_tiers' })
      continue
    }
    for (const size of sizes) {
      const normalized = size.trim().toLowerCase()
      if (!SIZE_PATTERN.test(normalized)) {
        issues.push({
          code: 'resolution_size_invalid',
          path: `resolution_tiers.${tier}`,
          params: { tier, size },
        })
        continue
      }
      const existing = seen.get(normalized)
      if (existing && existing !== tier) {
        issues.push({
          code: 'resolution_size_duplicated',
          path: `resolution_tiers.${tier}`,
          params: { size: normalized, tier, otherTier: existing },
        })
        continue
      }
      seen.set(normalized, tier)
    }
  }

  for (const tier of Object.keys(spec.price_table ?? {})) {
    if (tier !== '*' && !hasDeclaredResolutionTier(spec, tier)) {
      issues.push({
        code: 'tier_undeclared',
        path: `price_table.${tier}`,
        params: { tier, field: 'price_table' },
      })
    }
  }
  for (const tier of Object.keys(spec.resolution_ratios ?? {})) {
    if (tier !== '*' && !hasDeclaredResolutionTier(spec, tier)) {
      issues.push({
        code: 'tier_undeclared',
        path: `resolution_ratios.${tier}`,
        params: { tier, field: 'resolution_ratios' },
      })
    }
  }
  if (
    spec.default_resolution_tier &&
    !hasDeclaredResolutionTier(spec, spec.default_resolution_tier)
  ) {
    issues.push({
      code: 'default_resolution_undeclared',
      path: 'default_resolution_tier',
      params: { tier: spec.default_resolution_tier },
    })
  }

  for (const [tier, row] of Object.entries(spec.price_table ?? {})) {
    for (const quality of Object.keys(row)) {
      if (quality !== '*' && !hasDeclaredQualityTier(spec, quality)) {
        issues.push({
          code: 'quality_undeclared',
          path: `price_table.${tier}.${quality}`,
          params: { tier, quality },
        })
      }
    }
  }
  if (
    spec.default_quality_tier &&
    !hasDeclaredQualityTier(spec, spec.default_quality_tier)
  ) {
    issues.push({
      code: 'default_quality_undeclared',
      path: 'default_quality_tier',
      params: { quality: spec.default_quality_tier },
    })
  }
  return issues
}

function validateDuration(spec: MediaModelSpec): MediaSpecIssue[] {
  const duration = spec.duration
  if (!duration) return []
  const issues: MediaSpecIssue[] = []
  const min = duration.min ?? 0
  const max = duration.max ?? 0
  const fallback = duration.default ?? 0

  if (min < 0 || max < 0 || fallback < 0) {
    issues.push({ code: 'duration_invalid', path: 'duration' })
  }
  if (max > MAX_DURATION_SECONDS) {
    issues.push({
      code: 'duration_max_exceeded',
      path: 'duration.max',
      params: { limit: MAX_DURATION_SECONDS },
    })
  }
  if (max > 0 && min > max) {
    issues.push({ code: 'duration_range_invalid', path: 'duration.min' })
  }
  if (max > 0 && fallback > max) {
    issues.push({ code: 'duration_range_invalid', path: 'duration.default' })
  }
  if (
    duration.rounding &&
    duration.rounding !== 'ceil' &&
    duration.rounding !== 'exact'
  ) {
    issues.push({ code: 'duration_rounding_invalid', path: 'duration.rounding' })
  }
  return issues
}

export function validateMediaSpec(
  spec: MediaModelSpec
): MediaSpecIssue[] {
  const issues: MediaSpecIssue[] = []
  const kind = (spec.kind ?? '').toString().trim().toLowerCase()
  const unit = (spec.unit ?? '').toString().trim().toLowerCase()

  if (!kind) issues.push({ code: 'kind_required', path: 'kind' })
  else if (!MEDIA_KINDS.includes(kind as MediaKind)) {
    issues.push({ code: 'kind_invalid', path: 'kind', params: { kind } })
  }

  if (!unit) {
    issues.push({ code: 'unit_required', path: 'unit' })
  } else if (!MEDIA_UNITS.includes(unit as MediaUnit)) {
    issues.push({ code: 'unit_invalid', path: 'unit', params: { unit } })
  }

  issues.push(...validateRatios(spec, 'extra_ratios'))
  issues.push(...validateRatios(spec, 'resolution_ratios'))
  issues.push(...validateRatios(spec, 'quality_ratios'))
  issues.push(...validateDuration(spec))

  switch (unit) {
    case 'per_image':
      if (
        Object.keys(spec.price_table ?? {}).length === 0 &&
        !(spec.base_price !== undefined && isPrice(spec.base_price))
      ) {
        issues.push({ code: 'image_price_missing', path: 'price_table' })
      }
      for (const [tier, row] of Object.entries(spec.price_table ?? {})) {
        for (const [quality, price] of Object.entries(row)) {
          if (!isPrice(price)) {
            issues.push({
              code: 'price_invalid',
              path: `price_table.${tier}.${quality}`,
              params: { tier, quality, limit: MAX_UNIT_PRICE },
            })
          }
        }
      }
      issues.push(...validateResolutionTiers(spec))
      break
    case 'per_second':
      if (spec.per_second === undefined) {
        issues.push({ code: 'per_second_required', path: 'per_second' })
      } else if (!isPrice(spec.per_second)) {
        issues.push({
          code: 'per_second_invalid',
          path: 'per_second',
          params: { limit: MAX_UNIT_PRICE },
        })
      }
      issues.push(...validateResolutionTiers(spec))
      break
    case 'per_call':
      if (spec.base_price === undefined) {
        issues.push({ code: 'base_price_required', path: 'base_price' })
      } else if (!isPrice(spec.base_price)) {
        issues.push({
          code: 'base_price_invalid',
          path: 'base_price',
          params: { limit: MAX_UNIT_PRICE },
        })
      }
      break
    default:
      // per_1m_tokens and empty units are handled by the legacy ratio path.
      break
  }
  return issues
}

export function validateMediaModels(
  models: MediaPricingModels
): Record<string, MediaSpecIssue[]> {
  const result: Record<string, MediaSpecIssue[]> = {}
  for (const [name, spec] of Object.entries(models)) {
    if (!name.trim()) {
      result[''] = [{ code: 'kind_required', path: 'name' }]
      continue
    }
    const issues = validateMediaSpec(spec)
    if (issues.length > 0) result[name] = issues
  }
  return result
}

export function summarizeMediaSpec(spec: MediaModelSpec): MediaSpecSummary {
  const unit = MEDIA_UNITS.includes((spec.unit ?? '') as MediaUnit)
    ? ((spec.unit ?? '') as MediaUnit)
    : null
  const resolutionTiers = getDeclaredResolutionTiers(spec)
  const qualityTiers = getDeclaredQualityTiers(spec)
  let priceCellCount = 0
  let price: number | null = null
  let priceMax: number | null = null

  const consider = (value: number) => {
    if (!(value > 0)) return
    price = price === null ? value : Math.min(price, value)
    priceMax = priceMax === null ? value : Math.max(priceMax, value)
  }

  for (const row of Object.values(spec.price_table ?? {})) {
    for (const value of Object.values(row)) {
      priceCellCount += 1
      consider(value)
    }
  }

  if (unit === 'per_second' || unit === 'per_call') {
    const direct = unit === 'per_second' ? spec.per_second : spec.base_price
    if (direct !== undefined && direct > 0) {
      price = direct
      priceMax = direct
    } else if (priceCellCount === 0) {
      price = null
      priceMax = null
    }
  }

  if (unit === 'per_second' && price !== null) {
    // Per-second requests are scaled by the resolution ratio, so the advertised
    // range must follow the same ratios the billing path applies.
    const ratios = Object.entries(spec.resolution_ratios ?? {})
      .filter(([tier, ratio]) => tier !== '*' && ratio > 0)
      .map(([, ratio]) => ratio)
    if (ratios.length > 0) {
      const base = price
      const baseMax = priceMax ?? price
      price = base * Math.min(...ratios)
      priceMax = baseMax * Math.max(...ratios)
    }
  }

  if (unit === 'per_image') {
    const fallback = spec.base_price
    if (fallback !== undefined && fallback > 0) consider(fallback)
  }

  return {
    unit,
    price,
    priceMax,
    resolutionTiers,
    qualityTiers,
    priceCellCount,
    enabled: spec.enabled !== false,
  }
}

function durationForBilling(
  spec: MediaModelSpec,
  input: MediaPreviewInput
): { duration: number; issue?: MediaPreviewResult['issue'] } {
  const duration = spec.duration ?? {}
  let value = input.durationSec !== undefined ? input.durationSec : 0
  if (!(value > 0)) value = duration.default ?? 0
  if (!(value > 0)) return { duration: 0, issue: 'duration_required' }

  const maxLimit = Math.min(
    duration.max && duration.max > 0 ? duration.max : MAX_DURATION_SECONDS,
    MAX_DURATION_SECONDS
  )
  if (value > maxLimit) {
    return { duration: 0, issue: 'duration_exceeded' }
  }
  if (duration.min && value < duration.min) value = duration.min
  if (duration.rounding !== 'exact') value = Math.ceil(value)
  return { duration: value }
}

function lookupImagePrice(
  spec: MediaModelSpec,
  resolutionTier: string,
  qualityTier: string
): { price: number; fallback: boolean } | null {
  const table = spec.price_table ?? {}
  const row = table[resolutionTier]
  if (row) {
    if (row[qualityTier] > 0) return { price: row[qualityTier], fallback: false }
    if (row['*'] > 0) return { price: row['*'], fallback: true }
  }
  if (table['*']) {
    if (table['*'][qualityTier] > 0) {
      return { price: table['*'][qualityTier], fallback: true }
    }
  }
  if (spec.base_price && spec.base_price > 0) {
    const resolutionRatio = spec.resolution_ratios?.[resolutionTier] ?? 1
    const qualityRatio = spec.quality_ratios?.[qualityTier] ?? 1
    return {
      price: spec.base_price * resolutionRatio * qualityRatio,
      fallback: true,
    }
  }
  return null
}

export function resolveMediaPreview(
  spec: MediaModelSpec,
  input: MediaPreviewInput = {}
): MediaPreviewResult {
  const unit = MEDIA_UNITS.includes((spec.unit ?? '') as MediaUnit)
    ? ((spec.unit ?? '') as MediaUnit)
    : null
  const result: MediaPreviewResult = {
    unit,
    unitPrice: 0,
    quantity: 1,
    resolutionMultiplier: 1,
    extraRatio: 1,
    total: 0,
    fallback: false,
  }

  const flags = input.flags ?? []
  for (const flag of flags) {
    const ratio = spec.extra_ratios?.[flag]
    if (ratio && ratio > 0) result.extraRatio *= ratio
  }

  if (unit === 'per_image') {
    const resolutionTier = input.resolutionTier ?? ''
    const qualityTier = input.qualityTier ?? ''
    const found = lookupImagePrice(spec, resolutionTier, qualityTier)
    if (!found) {
      result.issue = 'price_missing'
      return result
    }
    result.unitPrice = found.price
    result.fallback = found.fallback
    result.quantity = input.count && input.count > 0 ? input.count : 1
  } else if (unit === 'per_second') {
    const { duration, issue } = durationForBilling(spec, input)
    if (issue) {
      result.issue = issue
      return result
    }
    const price = spec.per_second ?? 0
    if (!(price > 0)) {
      result.issue = 'price_missing'
      return result
    }
    result.unitPrice = price
    result.quantity = duration
    const tier = input.resolutionTier ?? ''
    const multiplier = spec.resolution_ratios?.[tier]
    result.resolutionMultiplier = multiplier && multiplier > 0 ? multiplier : 1
    result.fallback = Boolean(tier) && !multiplier
  } else if (unit === 'per_call') {
    const price = spec.base_price ?? 0
    if (!(price > 0)) {
      result.issue = 'price_missing'
      return result
    }
    result.unitPrice = price
  } else {
    result.issue = 'price_missing'
    return result
  }

  result.total =
    result.unitPrice *
    result.quantity *
    result.resolutionMultiplier *
    result.extraRatio
  return result
}

export function formatRatioProduct(result: MediaPreviewResult): string {
  const parts: string[] = [String(result.unitPrice)]
  if (result.quantity !== 1) parts.push(String(result.quantity))
  if (result.resolutionMultiplier !== 1) {
    parts.push(String(result.resolutionMultiplier))
  }
  if (result.extraRatio !== 1) parts.push(String(result.extraRatio))
  return parts.join(' × ')
}

/**
 * Prices every declared resolution × quality combination so the editor can show
 * the full price ladder instead of a single sample.
 */
export function listMediaTierPrices(
  spec: MediaModelSpec,
  input: MediaPreviewInput = {}
): MediaTierPrice[] {
  const unit = MEDIA_UNITS.includes((spec.unit ?? '') as MediaUnit)
    ? ((spec.unit ?? '') as MediaUnit)
    : null
  if (unit !== 'per_image' && unit !== 'per_second' && unit !== 'per_call') {
    return []
  }

  const resolutionTiers =
    unit === 'per_call' ? [] : getDeclaredResolutionTiers(spec)
  const qualityTiers = unit === 'per_image' ? getDeclaredQualityTiers(spec) : []
  const rows: MediaTierPrice[] = []

  for (const resolutionTier of resolutionTiers.length > 0
    ? resolutionTiers
    : ['']) {
    for (const qualityTier of qualityTiers.length > 0 ? qualityTiers : ['']) {
      const preview = resolveMediaPreview(spec, {
        ...input,
        resolutionTier,
        qualityTier,
      })
      rows.push({
        resolutionTier,
        qualityTier,
        total: preview.total,
        fallback: preview.fallback,
        issue: preview.issue,
      })
    }
  }
  return rows
}

/** Used by the upstream sync panel to render a spec without raw JSON. */
export function describeMediaSpec(spec: MediaModelSpec): string {
  const summary = summarizeMediaSpec(spec)
  const parts: string[] = []
  const kind = (spec.kind ?? '').toString().trim().toLowerCase()
  if (kind) parts.push(kind)
  if (!summary.unit) return parts.join(' · ') || '-'

  parts.push(summary.unit.replaceAll('_', ' '))
  if (summary.price !== null) parts.push(`${summary.price}`)
  if (summary.resolutionTiers.length > 0) {
    parts.push(summary.resolutionTiers.join('/'))
  }
  if (summary.qualityTiers.length > 0) {
    parts.push(summary.qualityTiers.join('/'))
  }
  return parts.join(' · ')
}
