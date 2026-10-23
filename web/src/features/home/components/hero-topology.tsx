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

interface HeroTopologyProps {
  className?: string
}

interface TopologyNode {
  /** Upstream label — real model names, identical in every language. */
  label: string
  x: number
  y: number
}

// Static geometry: six upstream providers orbiting the gateway. Purely
// decorative, so the whole graph is aria-hidden.
const NODES: TopologyNode[] = [
  { label: 'GPT-4o', x: 92, y: 74 },
  { label: 'Claude 4', x: 430, y: 74 },
  { label: 'Gemini 2.5', x: 92, y: 306 },
  { label: 'DeepSeek-V3', x: 430, y: 306 },
  { label: 'Qwen-Max', x: 261, y: 44 },
  { label: 'Llama 4 70B', x: 261, y: 336 },
]

const GATEWAY_X = 261
const GATEWAY_Y = 190
const PILL_WIDTH = 96
const PILL_HEIGHT = 30

export function HeroTopology(props: HeroTopologyProps) {
  return (
    <svg
      aria-hidden
      viewBox='0 0 522 380'
      fill='none'
      className={cn('h-full w-full', props.className)}
    >
      <defs>
        <radialGradient id='hero-topology-glow'>
          <stop offset='0%' stopColor='rgb(37 99 235 / 0.22)' />
          <stop offset='100%' stopColor='rgb(37 99 235 / 0)' />
        </radialGradient>
        <linearGradient id='hero-topology-core' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stopColor='rgb(37 99 235)' />
          <stop offset='55%' stopColor='rgb(14 165 233)' />
          <stop offset='100%' stopColor='rgb(6 182 212)' />
        </linearGradient>
      </defs>

      <circle
        cx={GATEWAY_X}
        cy={GATEWAY_Y}
        r='150'
        fill='url(#hero-topology-glow)'
      />

      {/* Orbital rings */}
      <circle
        cx={GATEWAY_X}
        cy={GATEWAY_Y}
        r='118'
        className='stroke-blue-500/12'
        strokeDasharray='3 9'
      />
      <circle
        cx={GATEWAY_X}
        cy={GATEWAY_Y}
        r='76'
        className='stroke-blue-500/18'
      />

      {/* Upstream links with travelling dashes */}
      <g className='stroke-blue-500/35' strokeWidth='1.2' strokeLinecap='round'>
        {NODES.map((node) => (
          <path
            key={node.label}
            d={`M${node.x} ${node.y} Q${(node.x + GATEWAY_X) / 2} ${
              (node.y + GATEWAY_Y) / 2 + (node.y < GATEWAY_Y ? 26 : -26)
            } ${GATEWAY_X} ${GATEWAY_Y}`}
            strokeDasharray='4 8'
            className='tech-animate-flow'
          />
        ))}
      </g>

      {/* Upstream nodes */}
      <g>
        {NODES.map((node, index) => (
          <g key={node.label}>
            <rect
              x={node.x - PILL_WIDTH / 2}
              y={node.y - PILL_HEIGHT / 2}
              width={PILL_WIDTH}
              height={PILL_HEIGHT}
              rx={PILL_HEIGHT / 2}
              className='fill-background stroke-blue-500/25'
            />
            <circle
              cx={node.x - PILL_WIDTH / 2 + 14}
              cy={node.y}
              r='3'
              className={cn(
                'tech-animate-node fill-blue-500',
                `tech-animate-node-delay-${(index % 3) + 1}`
              )}
            />
            <text
              x={node.x + 8}
              y={node.y + 4}
              textAnchor='middle'
              className='fill-slate-600 text-[11px] font-medium dark:fill-slate-300'
            >
              {node.label}
            </text>
          </g>
        ))}
      </g>

      {/* Gateway core */}
      <g>
        <circle
          cx={GATEWAY_X}
          cy={GATEWAY_Y}
          r='44'
          className='tech-animate-node fill-blue-500/10'
        />
        <circle
          cx={GATEWAY_X}
          cy={GATEWAY_Y}
          r='34'
          fill='url(#hero-topology-core)'
        />
        <text
          x={GATEWAY_X}
          y={GATEWAY_Y + 5}
          textAnchor='middle'
          className='fill-white text-[14px] font-bold tracking-[0.08em]'
        >
          API
        </text>
      </g>
    </svg>
  )
}
