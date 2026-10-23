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

/**
 * Mirrors setting/media_billing_setting.MediaModelSpec field by field.
 * Unknown keys are kept so a visual edit never drops hand-written options.
 */
export const MEDIA_KINDS = [
  'image',
  'video',
  'audio',
  'music',
  'text',
  'embedding',
  'rerank',
] as const

export type MediaKind = (typeof MEDIA_KINDS)[number]

export const MEDIA_KIND_LABEL_KEYS: Record<MediaKind, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  music: 'Music',
  text: 'Text',
  embedding: 'Embedding',
  rerank: 'Rerank',
}

export const MEDIA_UNITS = [
  'per_image',
  'per_second',
  'per_call',
  'per_1m_tokens',
] as const

export type MediaUnit = (typeof MEDIA_UNITS)[number]

export const MEDIA_UNIT_LABEL_KEYS: Record<MediaUnit, string> = {
  per_image: 'Per image',
  per_second: 'Per second',
  per_call: 'Per call',
  per_1m_tokens: 'Per 1M tokens',
}

export type MediaDurationRounding = 'ceil' | 'exact'

export type MediaDurationSpec = {
  min?: number
  max?: number
  default?: number
  rounding?: MediaDurationRounding | ''
}

export type MediaModelSpec = {
  enabled?: boolean
  kind?: MediaKind | string
  unit?: MediaUnit | string
  base_price?: number
  per_second?: number
  resolution_tiers?: Record<string, string[]>
  default_resolution_tier?: string
  quality_tiers?: string[]
  quality_aliases?: Record<string, string>
  default_quality_tier?: string
  price_table?: Record<string, Record<string, number>>
  resolution_ratios?: Record<string, number>
  quality_ratios?: Record<string, number>
  extra_ratios?: Record<string, number>
  duration?: MediaDurationSpec
  [key: string]: unknown
}

export type MediaPricingModels = Record<string, MediaModelSpec>

/** Entries we cannot visualise (not a JSON object) are preserved verbatim. */
export type MediaPricingOpaqueModels = Record<string, unknown>

export type MediaPricingParseResult = {
  models: MediaPricingModels
  opaque: MediaPricingOpaqueModels
  /** i18n key describing a whole-table parse failure, empty when ok. */
  errorKey: string
}

export type MediaSpecIssueCode =
  | 'kind_required'
  | 'kind_invalid'
  | 'unit_required'
  | 'unit_invalid'
  | 'base_price_required'
  | 'base_price_invalid'
  | 'per_second_required'
  | 'per_second_invalid'
  | 'image_price_missing'
  | 'price_invalid'
  | 'resolution_tier_empty'
  | 'resolution_size_invalid'
  | 'resolution_size_duplicated'
  | 'tier_undeclared'
  | 'quality_undeclared'
  | 'default_resolution_undeclared'
  | 'default_quality_undeclared'
  | 'ratio_key_empty'
  | 'ratio_invalid'
  | 'duration_invalid'
  | 'duration_max_exceeded'
  | 'duration_range_invalid'
  | 'duration_rounding_invalid'

export type MediaSpecIssue = {
  code: MediaSpecIssueCode
  /** Dotted path inside the spec, for field highlighting. */
  path: string
  params?: Record<string, string | number>
}

export type MediaSpecSummary = {
  unit: MediaUnit | null
  /** Representative price: cheapest configured price for the unit. */
  price: number | null
  /** Dearest configured price; equal to `price` when the spec has one rate. */
  priceMax: number | null
  resolutionTiers: string[]
  qualityTiers: string[]
  priceCellCount: number
  enabled: boolean
}

export type MediaPreviewInput = {
  resolutionTier?: string
  qualityTier?: string
  durationSec?: number
  flags?: string[]
  count?: number
}

export type MediaPreviewIssueCode =
  | 'duration_required'
  | 'duration_exceeded'
  | 'price_missing'

export type MediaPreviewResult = {
  unit: MediaUnit | null
  unitPrice: number
  quantity: number
  resolutionMultiplier: number
  extraRatio: number
  total: number
  fallback: boolean
  issue?: MediaPreviewIssueCode
}

/** One row of the per-tier price list rendered under the media preview. */
export type MediaTierPrice = {
  resolutionTier: string
  qualityTier: string
  total: number
  fallback: boolean
  issue?: MediaPreviewIssueCode
}
