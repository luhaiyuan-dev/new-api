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
 * Home page layout tokens.
 *
 * Every landing section composes these classes instead of re-declaring the
 * same paddings, typography and surfaces, so the page keeps one visual rhythm.
 */

export const MAIN_BASE_CLASSES = 'bg-background text-foreground w-full'

export const HOME_CONTAINER = 'mx-auto w-full max-w-6xl px-6'

/** Vertical rhythm for full-width landing sections. */
export const HOME_SECTION_Y = 'py-20 md:py-24'

/** Section header — leading index number. */
export const HOME_SECTION_INDEX =
  'font-mono text-4xl leading-none font-bold text-blue-500/25 select-none md:text-5xl dark:text-blue-400/30'

export const HOME_EYEBROW =
  'text-[11px] font-semibold tracking-[0.2em] text-blue-600 uppercase dark:text-blue-400'

export const HOME_TITLE =
  'text-2xl leading-tight font-bold tracking-tight md:text-[32px]'

export const HOME_DESC =
  'text-muted-foreground/75 text-sm leading-relaxed md:text-[15px]'

/** Surface shared by panels and cards — cool-tinted so cards lift off the page wash. */
export const HOME_PANEL =
  'border-blue-500/[0.14] bg-card relative overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(15,23,42,0.05),0_18px_40px_-24px_rgba(37,99,235,0.35)] [background-image:linear-gradient(165deg,rgba(37,99,235,0.08),transparent_48%)] dark:border-blue-400/[0.16] dark:shadow-[0_1px_2px_rgba(0,0,0,0.45),0_18px_40px_-24px_rgba(59,130,246,0.4)] dark:[background-image:linear-gradient(165deg,rgba(59,130,246,0.12),transparent_48%)]'

export const HOME_TAG =
  'inline-flex items-center rounded-full border border-blue-500/15 bg-blue-500/[0.06] px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/[0.08] dark:text-blue-300'

/** Hairline gradient revealed on card hover. */
export const HOME_CARD_HAIRLINE =
  'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:via-blue-400/50'

/** Stagger step for grid entrances. */
export const HOME_STAGGER = 80

/** Product surface a CTA should lead to, depending on auth state. */
export const AUTHED_ENTRY_ROUTE = '/dashboard'
export const GUEST_ENTRY_ROUTE = '/sign-up'

/** External support entry that exists regardless of backend configuration. */
export const COMMUNITY_URL =
  'https://docs.newapi.pro/support/community-interaction/'

export const REPOSITORY_URL = 'https://github.com/QuantumNous/new-api'

export const FALLBACK_DOCS_URL = 'https://docs.newapi.pro'
