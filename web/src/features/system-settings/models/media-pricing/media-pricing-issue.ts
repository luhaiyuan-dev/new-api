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

import type { MediaSpecIssue } from './media-pricing-types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const ISSUE_KEYS: Record<string, string> = {
  kind_required: 'Media kind is required',
  kind_invalid: 'Unsupported media kind "{{kind}}"',
  unit_required: 'Billing unit is required',
  unit_invalid: 'Unsupported billing unit "{{unit}}"',
  base_price_required: 'A per-call price is required',
  base_price_invalid: 'Price must be greater than 0 and at most {{limit}}',
  per_second_required: 'A per-second price is required',
  per_second_invalid: 'Price must be greater than 0 and at most {{limit}}',
  image_price_missing:
    'Provide a price table or a base price for per-image billing',
  price_invalid:
    'Price for {{tier}} / {{quality}} must be greater than 0 and at most {{limit}}',
  resolution_tier_empty: 'Resolution tier names must not be empty',
  resolution_size_invalid:
    'Size "{{size}}" in tier "{{tier}}" must use the WIDTHxHEIGHT format',
  resolution_size_duplicated:
    'Size "{{size}}" is already mapped to tier "{{otherTier}}"',
  tier_undeclared:
    'Tier "{{tier}}" used by {{field}} is not declared in resolution tiers',
  quality_undeclared:
    'Quality "{{quality}}" in tier "{{tier}}" is not declared in quality tiers',
  default_resolution_undeclared:
    'Default resolution tier "{{tier}}" is not declared',
  default_quality_undeclared:
    'Default quality tier "{{quality}}" is not declared',
  ratio_key_empty: 'Ratio keys must not be empty',
  ratio_invalid:
    '{{field}}["{{key}}"] must be greater than 0 and at most {{limit}}',
  duration_invalid: 'Duration values must not be negative',
  duration_max_exceeded: 'Maximum duration must be at most {{limit}} seconds',
  duration_range_invalid:
    'Minimum and default duration must not exceed the maximum',
  duration_rounding_invalid: 'Rounding must be ceil or exact',
}

export function formatMediaSpecIssue(t: Translate, issue: MediaSpecIssue): string {
  const key = ISSUE_KEYS[issue.code]
  if (!key) return issue.code
  return t(key, issue.params)
}
