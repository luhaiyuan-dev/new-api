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
import { cn } from '@/lib/utils'

interface HeroNetworkProps {
  className?: string
}

// Static decorative geometry for the neural-mesh backdrop. Purely visual: the
// components below are aria-hidden and never carry meaning.
const LINES: { d: string; delay: string }[] = [
  { d: 'M70 430 L170 330', delay: '' },
  { d: 'M70 430 L250 460', delay: 'tech-animate-flow-delay' },
  { d: 'M170 330 L330 220', delay: '' },
  { d: 'M250 460 L410 340', delay: 'tech-animate-flow-delay' },
  { d: 'M330 220 L410 340', delay: '' },
  { d: 'M410 340 L480 160', delay: 'tech-animate-flow-delay' },
  { d: 'M410 340 L540 400', delay: '' },
  { d: 'M480 160 L620 280', delay: 'tech-animate-flow-delay' },
  { d: 'M540 400 L700 430', delay: '' },
  { d: 'M620 280 L720 180', delay: 'tech-animate-flow-delay' },
  { d: 'M540 400 L620 280', delay: '' },
  { d: 'M700 430 L720 180', delay: 'tech-animate-flow-delay' },
]

const NODES: { cx: number; cy: number; r: number; delay: string }[] = [
  { cx: 70, cy: 430, r: 3, delay: '' },
  { cx: 170, cy: 330, r: 3.5, delay: 'tech-animate-node-delay-1' },
  { cx: 250, cy: 460, r: 2.5, delay: 'tech-animate-node-delay-2' },
  { cx: 330, cy: 220, r: 4.5, delay: 'tech-animate-node-delay-3' },
  { cx: 410, cy: 340, r: 5, delay: 'tech-animate-node-delay-1' },
  { cx: 480, cy: 160, r: 3, delay: 'tech-animate-node-delay-2' },
  { cx: 540, cy: 400, r: 3.5, delay: 'tech-animate-node-delay-3' },
  { cx: 620, cy: 280, r: 4, delay: '' },
  { cx: 700, cy: 430, r: 3, delay: 'tech-animate-node-delay-1' },
  { cx: 720, cy: 180, r: 2.5, delay: 'tech-animate-node-delay-2' },
]

export function HeroNetwork(props: HeroNetworkProps) {
  return (
    <svg
      aria-hidden
      viewBox='0 0 800 600'
      preserveAspectRatio='xMidYMid slice'
      fill='none'
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        props.className
      )}
    >
      <defs>
        <radialGradient id='tech-node-glow'>
          <stop offset='0%' stopColor='rgb(59 130 246 / 0.20)' />
          <stop offset='100%' stopColor='rgb(59 130 246 / 0)' />
        </radialGradient>
      </defs>

      {/* Soft glows behind the mesh */}
      <circle cx='410' cy='340' r='190' fill='url(#tech-node-glow)' />
      <circle cx='170' cy='330' r='120' fill='url(#tech-node-glow)' />
      <circle cx='700' cy='200' r='120' fill='url(#tech-node-glow)' />

      {/* Data-flow links */}
      <g stroke='rgb(59 130 246 / 0.28)' strokeWidth='1' strokeLinecap='round'>
        {LINES.map((line) => (
          <path
            key={line.d}
            d={line.d}
            strokeDasharray='4 8'
            className={cn('tech-animate-flow', line.delay)}
          />
        ))}
      </g>

      {/* Network nodes */}
      <g fill='rgb(59 130 246 / 0.55)'>
        {NODES.map((node) => (
          <circle
            key={`${node.cx}-${node.cy}`}
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            className={cn('tech-animate-node', node.delay)}
          />
        ))}
      </g>
    </svg>
  )
}
