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
  SORT_OPTIONS,
  FILTER_ALL,
  QUOTA_TYPES,
  QUOTA_TYPE_VALUES,
  ENDPOINT_TYPES,
} from '../constants'
import type { PricingModel } from '../types'
import { getDynamicPricingTiers, isDynamicPricingModel } from './dynamic-price'
import { isTokenBasedModel } from './model-helpers'

// ----------------------------------------------------------------------------
// Filter Utilities
// ----------------------------------------------------------------------------

/**
 * Filter models by search query
 */
export function filterBySearch(
  models: PricingModel[],
  query: string
): PricingModel[] {
  if (!query) return models

  const lowerQuery = query.toLowerCase()
  return models.filter(
    (m) =>
      m.model_name?.toLowerCase().includes(lowerQuery) ||
      m.description?.toLowerCase().includes(lowerQuery) ||
      m.tags?.toLowerCase().includes(lowerQuery) ||
      m.vendor_name?.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Filter models by vendor
 */
export function filterByVendor(
  models: PricingModel[],
  vendor: string
): PricingModel[] {
  if (vendor === FILTER_ALL) return models
  return models.filter((m) => m.vendor_name === vendor)
}

/**
 * Filter models by group
 */
export function filterByGroup(
  models: PricingModel[],
  group: string
): PricingModel[] {
  if (group === FILTER_ALL) return models
  return models.filter((m) => m.enable_groups?.includes(group))
}

/**
 * Match a model against the pricing type shown in the UI.
 *
 * Dynamic pricing models win over their raw `quota_type`, because the list and
 * the detail view also display them as dynamic regardless of the fallback
 * price the backend stores for them.
 */
export function matchesPricingType(
  model: PricingModel,
  pricingType: string
): boolean {
  if (pricingType === QUOTA_TYPES.ALL) return true

  const isDynamic = isDynamicPricingModel(model)

  if (pricingType === QUOTA_TYPES.DYNAMIC) return isDynamic
  if (pricingType === QUOTA_TYPES.TOKEN) {
    return isTokenBasedModel(model) && !isDynamic
  }
  return model.quota_type === QUOTA_TYPE_VALUES.REQUEST && !isDynamic
}

/**
 * Filter models by pricing type
 */
export function filterByQuotaType(
  models: PricingModel[],
  quotaType: string
): PricingModel[] {
  if (quotaType === QUOTA_TYPES.ALL) return models
  return models.filter((m) => matchesPricingType(m, quotaType))
}

/**
 * Filter models by the media kind declared in the media price table.
 */
export function filterByMediaKind(
  models: PricingModel[],
  mediaKind: string
): PricingModel[] {
  if (mediaKind === FILTER_ALL) return models
  return models.filter((m) => m.media_kind === mediaKind)
}

/**
 * Filter models by endpoint type
 */
export function filterByEndpointType(
  models: PricingModel[],
  endpointType: string
): PricingModel[] {
  if (endpointType === ENDPOINT_TYPES.ALL) return models
  return models.filter((m) =>
    m.supported_endpoint_types?.includes(endpointType)
  )
}

/**
 * Resolve the headline price of a model in 元, so token-based, per-request and
 * dynamic models can be compared on one scale instead of mixing a multiplier
 * with a currency amount.
 *
 * Token-based models store a multiplier; `model_ratio * 2` is its 元 price per
 * 1M tokens (see `calculateTokenPrice`). Dynamic models carry per-token prices
 * in their tiers, so their first tier's input price is used. Fixed-price models
 * store their 元 price per request.
 */
function getComparablePrice(model: PricingModel): number {
  const dynamicInputPrice = Number(getDynamicPricingTiers(model)[0]?.inputPrice)
  if (Number.isFinite(dynamicInputPrice) && dynamicInputPrice > 0) {
    return dynamicInputPrice
  }
  if (isTokenBasedModel(model)) return model.model_ratio * 2
  return model.model_price || 0
}

/**
 * Sort models by specified option
 */
export function sortModels(
  models: PricingModel[],
  sortBy: string
): PricingModel[] {
  const sorted = [...models]

  switch (sortBy) {
    case SORT_OPTIONS.NAME:
      sorted.sort((a, b) =>
        (a.model_name || '').localeCompare(b.model_name || '')
      )
      break
    case SORT_OPTIONS.PRICE_LOW:
      sorted.sort((a, b) => getComparablePrice(a) - getComparablePrice(b))
      break
    case SORT_OPTIONS.PRICE_HIGH:
      sorted.sort((a, b) => getComparablePrice(b) - getComparablePrice(a))
      break
  }

  return sorted
}

/**
 * Apply all filters and sorting to models
 */
export function filterAndSortModels(
  models: PricingModel[],
  filters: {
    search: string
    vendor: string
    group: string
    quotaType: string
    mediaKind: string
    endpointType: string
    tag: string
    sortBy: string
  }
): PricingModel[] {
  let result = filterBySearch(models, filters.search)
  result = filterByVendor(result, filters.vendor)
  result = filterByGroup(result, filters.group)
  result = filterByQuotaType(result, filters.quotaType)
  result = filterByMediaKind(result, filters.mediaKind)
  result = filterByEndpointType(result, filters.endpointType)
  result = filterByTag(result, filters.tag)
  result = sortModels(result, filters.sortBy)

  return result
}

/**
 * Parse tags from comma-separated string
 */
export function parseTags(tagsString?: string): string[] {
  if (!tagsString) return []
  return tagsString
    .split(/[,;|\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Extract all unique tags from models
 */
export function extractAllTags(models: PricingModel[]): string[] {
  const tagSet = new Set<string>()

  models.forEach((model) => {
    if (model.tags) {
      const tags = parseTags(model.tags)
      tags.forEach((tag) => {
        tagSet.add(tag.toLowerCase())
      })
    }
  })

  return Array.from(tagSet).sort((a, b) => a.localeCompare(b))
}

/**
 * Filter models by tag
 */
export function filterByTag(
  models: PricingModel[],
  tag: string
): PricingModel[] {
  if (tag === FILTER_ALL) return models

  const tagLower = tag.toLowerCase()
  return models.filter((m) => {
    if (!m.tags) return false
    const modelTags = parseTags(m.tags).map((t) => t.toLowerCase())
    return modelTags.includes(tagLower)
  })
}
