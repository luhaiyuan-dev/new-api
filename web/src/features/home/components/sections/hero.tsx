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
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  AUTHED_ENTRY_ROUTE,
  GUEST_ENTRY_ROUTE,
} from '@/features/home/constants'

import { HeroNetwork } from '../hero-network'
import { HeroTopology } from '../hero-topology'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

const TRUST_ITEM_KEYS = [
  'OpenAI-compatible protocol',
  '99.95% SLA guarantee',
  'Free trial quota on sign-up',
] as const

const AVATAR_INITIALS = ['B', 'D', 'C', 'A'] as const

const ORB_GRADIENTS = [
  'oklch(0.65 0.19 255 / 85%)',
  'oklch(0.7 0.14 225 / 65%)',
  'oklch(0.68 0.13 205 / 50%)',
]

/** Decorative floating motes; deterministic offsets keep renders stable. */
const MOTES = [
  { left: 8, top: 62, size: 6, duration: 19, delay: -3 },
  { left: 21, top: 78, size: 4, duration: 15, delay: -9 },
  { left: 34, top: 58, size: 7, duration: 22, delay: -6 },
  { left: 47, top: 84, size: 5, duration: 17, delay: -13 },
  { left: 58, top: 66, size: 6, duration: 20, delay: -2 },
  { left: 71, top: 88, size: 4, duration: 13, delay: -11 },
  { left: 83, top: 70, size: 7, duration: 18, delay: -7 },
  { left: 92, top: 80, size: 5, duration: 16, delay: -15 },
]

function HeroMotes() {
  return (
    <div aria-hidden className='pointer-events-none absolute inset-0 -z-10'>
      {MOTES.map((mote) => (
        <span
          key={`${mote.left}-${mote.top}`}
          className='landing-mote absolute rounded-full bg-blue-500/40'
          style={{
            left: `${mote.left}%`,
            top: `${mote.top}%`,
            width: mote.size,
            height: mote.size,
            animationDuration: `${mote.duration}s`,
            animationDelay: `${mote.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  const primaryRoute = props.isAuthenticated
    ? AUTHED_ENTRY_ROUTE
    : GUEST_ENTRY_ROUTE

  return (
    <section
      id='hero'
      className='relative z-10 overflow-hidden px-6 pt-28 pb-12 md:pt-32 md:pb-16'
    >
      {/* Radial brand wash */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-30 dark:opacity-[0.16]'
        style={{
          background: [
            `radial-gradient(ellipse 60% 50% at 20% 20%, ${ORB_GRADIENTS[0]} 0%, transparent 70%)`,
            `radial-gradient(ellipse 50% 40% at 80% 15%, ${ORB_GRADIENTS[1]} 0%, transparent 70%)`,
            `radial-gradient(ellipse 40% 35% at 40% 80%, ${ORB_GRADIENTS[2]} 0%, transparent 70%)`,
          ].join(', '),
        }}
      />
      <HeroNetwork className='-z-10 opacity-70 dark:opacity-90' />
      <div
        aria-hidden
        className='absolute -inset-16 -z-10 overflow-hidden'
        style={{
          maskImage:
            'radial-gradient(ellipse 60% 50% at 50% 30%, black 20%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 50% at 50% 30%, black 20%, transparent 100%)',
        }}
      >
        <div className='tech-animate-grid absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.22]' />
      </div>
      <HeroMotes />

      <div className='mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8'>
        <div className='flex flex-col items-start text-left lg:col-span-6'>
          <div
            className='landing-animate-fade-up mb-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-blue-500/20 bg-blue-500/5 px-3.5 py-1.5 text-[11px] font-medium text-blue-700 opacity-0 dark:border-blue-400/20 dark:bg-blue-400/5 dark:text-blue-300'
            style={{ animationDelay: '0ms' }}
          >
            <span className='relative flex size-1.5'>
              <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75' />
              <span className='relative inline-flex size-1.5 rounded-full bg-blue-500 dark:bg-blue-400' />
            </span>
            <span>{t('New-generation multi-merchant AI gateway')}</span>
            <span aria-hidden className='h-3 w-px bg-blue-500/30' />
            <span>
              {t('Aggregating')}{' '}
              <b className='text-blue-700 tabular-nums dark:text-blue-300'>
                128+
              </b>{' '}
              {t('mainstream models')}
            </span>
          </div>

          <h1
            className='landing-animate-fade-up text-[clamp(2.1rem,4.4vw,3.15rem)] leading-[1.16] font-bold tracking-tight opacity-0'
            style={{ animationDelay: '80ms' }}
          >
            {t('One interface,')}
            <span className='tech-animate-shimmer bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-sky-400 dark:to-cyan-300'>
              {t('every model')}
            </span>
            <br />
            {t('Every call,')}
            <span className='tech-animate-shimmer bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent underline decoration-blue-500/35 decoration-[6px] underline-offset-[6px] dark:from-blue-400 dark:via-sky-400 dark:to-cyan-300'>
              {t('simple and reliable')}
            </span>
          </h1>

          <p
            className='landing-animate-fade-up text-muted-foreground/80 mt-6 max-w-xl text-[15px] leading-relaxed opacity-0'
            style={{ animationDelay: '150ms' }}
          >
            {t('A unified gateway that aggregates leading models worldwide,')}{' '}
            <strong className='text-foreground/85 font-semibold'>
              {t('smart routing')}
            </strong>{' '}
            {t('picks the optimal channel automatically and')}{' '}
            <strong className='text-foreground/85 font-semibold'>
              {t('millisecond billing')}
            </strong>{' '}
            {t(
              'stays fully transparent — a stable, secure and low-cost AI foundation for developers and merchants.'
            )}
          </p>

          <div
            className='landing-animate-fade-up mt-8 flex flex-wrap items-center gap-3 opacity-0'
            style={{ animationDelay: '220ms' }}
          >
            <Button
              className='group h-11 rounded-lg px-5 text-sm font-medium'
              render={<Link to={primaryRoute} />}
            >
              {t('Start integrating')}
              <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='border-border/50 hover:border-border hover:bg-muted/50 h-11 rounded-lg px-5 text-sm font-medium'
              render={<a href='#insight' />}
            >
              {t('View live data')}
            </Button>
            <span className='text-muted-foreground/60 inline-flex items-center gap-1.5 text-xs'>
              <Clock className='size-3.5' />
              {t('3-minute integration')}
            </span>
          </div>

          <ul
            className='landing-animate-fade-up mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 opacity-0'
            style={{ animationDelay: '290ms' }}
          >
            {TRUST_ITEM_KEYS.map((key) => (
              <li
                key={key}
                className='text-muted-foreground/70 inline-flex items-center gap-1.5 text-xs'
              >
                <Check className='size-3.5 text-blue-600 dark:text-blue-400' />
                {t(key)}
              </li>
            ))}
          </ul>

          <div
            className='landing-animate-fade-up mt-9 flex items-center gap-4 opacity-0'
            style={{ animationDelay: '360ms' }}
          >
            <div aria-hidden className='flex -space-x-2.5'>
              {AVATAR_INITIALS.map((initial, index) => (
                <span
                  key={initial}
                  className='border-background flex size-8 items-center justify-center rounded-full border-2 bg-gradient-to-br from-blue-500 to-cyan-500 text-[11px] font-semibold text-white'
                  style={{ opacity: 1 - index * 0.12 }}
                >
                  {initial}
                </span>
              ))}
              <span className='border-background bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full border-2 text-[10px] font-semibold'>
                +3.6K
              </span>
            </div>
            <p className='text-muted-foreground/70 text-xs leading-relaxed'>
              <strong className='text-foreground/85 font-semibold'>
                3,600+
              </strong>{' '}
              {t('merchants and developers onboard')}
              <br />
              {t('Serving')}{' '}
              <b className='text-foreground/85 font-semibold tabular-nums'>
                1.2 {t('billion')}
              </b>{' '}
              {t('model calls every day · 6 global regions')}
            </p>
          </div>
        </div>

        <div
          className='landing-animate-scale-in relative opacity-0 lg:col-span-6'
          style={{ animationDelay: '300ms' }}
        >
          <div className='border-border/50 relative overflow-hidden rounded-3xl border bg-gradient-to-br from-blue-500/[0.08] via-sky-500/[0.04] to-transparent p-4 md:p-6'>
            <div
              aria-hidden
              className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(37,99,235,0.10),transparent_65%)]'
            />
            <HeroTopology className='relative h-[300px] md:h-[380px]' />

            <span className='border-border/50 bg-card/90 text-muted-foreground absolute top-5 left-5 rounded-lg border px-3 py-1.5 text-[11px] font-medium backdrop-blur-sm'>
              {t('Smart routing')}
              <b className='text-foreground/85 ml-1.5 font-semibold'>
                {t('auto')}
              </b>
            </span>
            <span className='border-border/50 bg-card/90 text-muted-foreground absolute right-5 bottom-5 rounded-lg border px-3 py-1.5 text-[11px] font-medium backdrop-blur-sm'>
              {t('Billing')}
              <b className='text-foreground/85 ml-1.5 font-semibold'>
                {t('per token')}
              </b>
            </span>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className='text-muted-foreground/50 mt-12 flex flex-col items-center gap-2 text-[11px]'
      >
        <span className='border-border/60 relative flex h-7 w-4 justify-center rounded-full border'>
          <span className='landing-scroll-hint mt-1.5 size-1 rounded-full bg-blue-500' />
        </span>
        {t('Scroll down')}
      </div>
    </section>
  )
}
