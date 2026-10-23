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
import type { ReactNode } from 'react'

import { AnimateInView } from '@/components/animate-in-view'
import {
  HOME_DESC,
  HOME_EYEBROW,
  HOME_SECTION_INDEX,
  HOME_TITLE,
} from '@/features/home/constants'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  /** Two-digit section number rendered as a leading watermark. */
  index: string
  /** Small uppercase label, already translated by the caller. */
  eyebrow: ReactNode
  /** Section title; may embed emphasised spans. */
  title: ReactNode
  /** Supporting paragraph, already translated by the caller. */
  description: ReactNode
  className?: string
}

/**
 * Landing section header: index number, eyebrow + title, supporting copy.
 * Mirrors the three-column heading used by every section of the page.
 */
export function SectionHeading(props: SectionHeadingProps) {
  return (
    <AnimateInView
      animation='fade-up'
      className={cn(
        'grid gap-5 lg:grid-cols-[auto_1fr_1fr] lg:items-start lg:gap-10',
        props.className
      )}
    >
      <span aria-hidden className={HOME_SECTION_INDEX}>
        {props.index}
      </span>
      <div>
        <span className={HOME_EYEBROW}>{props.eyebrow}</span>
        <h2 className={cn(HOME_TITLE, 'mt-3')}>{props.title}</h2>
      </div>
      <p className={cn(HOME_DESC, 'lg:pt-7')}>{props.description}</p>
    </AnimateInView>
  )
}
