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
import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

interface HomeBackdropProps {
  className?: string
}

const GRID_STYLE: CSSProperties = {
  backgroundImage:
    'linear-gradient(to right, rgba(37, 99, 235, 0.055) 1px, transparent 1px), ' +
    'linear-gradient(to bottom, rgba(37, 99, 235, 0.055) 1px, transparent 1px)',
  backgroundSize: '72px 72px',
  maskImage: 'linear-gradient(to bottom, black 0%, transparent 85%)',
  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 85%)',
}

function glow(color: string): CSSProperties {
  return {
    background: `radial-gradient(closest-side, ${color}, transparent 72%)`,
  }
}

/**
 * Full-page decorative backdrop for the landing page: a fading tech grid plus
 * drifting blue/sky/cyan glows. Purely visual — hidden from assistive tech and
 * never interactive.
 */
export function HomeBackdrop(props: HomeBackdropProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-0 overflow-hidden select-none',
        props.className
      )}
    >
      {/* Cool page wash so tinted cards separate from the page instead of
          blending into a flat white (light) or flat black (dark) background. */}
      <div
        className='absolute inset-0'
        style={{
          background:
            'linear-gradient(180deg, rgba(37, 99, 235, 0.02) 0%, rgba(37, 99, 235, 0.05) 28%, rgba(14, 165, 233, 0.07) 55%, rgba(37, 99, 235, 0.08) 78%, rgba(37, 99, 235, 0.11) 100%)',
        }}
      />

      {/* Fading tech grid under the top sections */}
      <div
        className='absolute top-0 right-0 left-0 h-[760px]'
        style={GRID_STYLE}
      />

      {/* Top-right hero glow */}
      <span
        className='landing-orb-drift absolute top-[-14%] right-[-10%] size-[58vw] max-w-[760px] rounded-full'
        style={glow('rgba(59, 130, 246, 0.18)')}
      />

      {/* Left mid-page sky glow */}
      <span
        className='landing-orb-drift absolute top-[34%] left-[-14%] size-[44vw] max-w-[560px] rounded-full [animation-delay:-6s]'
        style={glow('rgba(14, 165, 233, 0.13)')}
      />

      {/* Right lower-page cyan glow */}
      <span
        className='landing-orb-drift absolute top-[62%] right-[-12%] size-[40vw] max-w-[520px] rounded-full [animation-delay:-11s]'
        style={glow('rgba(6, 182, 212, 0.12)')}
      />

      {/* Soft glow lifting the footer area off the flat background */}
      <span
        className='absolute bottom-[-6%] left-1/2 size-[70vw] max-w-[900px] -translate-x-1/2 rounded-full'
        style={glow('rgba(37, 99, 235, 0.1)')}
      />
    </div>
  )
}
