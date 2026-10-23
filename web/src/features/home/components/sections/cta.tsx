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
import { ArrowRight, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import {
  AUTHED_ENTRY_ROUTE,
  GUEST_ENTRY_ROUTE,
  HOME_CONTAINER,
  HOME_SECTION_Y,
} from '@/features/home/constants'
import { cn } from '@/lib/utils'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
  /** Support entry configured by the backend, used by the demo CTA. */
  docsUrl: string
}

const FINE_PRINT_KEYS = [
  'No credit card required',
  '24/7 technical support',
  'Average cost reduction of 40%',
]

function QuickstartCard() {
  const { t } = useTranslation()
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const endpoint = `${origin}/v1/chat/completions`

  return (
    <div className='overflow-hidden rounded-2xl border border-white/10 bg-[#070d1a]/85 shadow-[0_24px_60px_-30px_rgba(2,6,23,0.9)] backdrop-blur-sm'>
      <div className='flex items-center gap-2.5 border-b border-white/10 px-4 py-2.5'>
        <span aria-hidden className='flex gap-1.5'>
          <i className='size-2.5 rounded-full bg-rose-400/80' />
          <i className='size-2.5 rounded-full bg-amber-400/80' />
          <i className='size-2.5 rounded-full bg-emerald-400/80' />
        </span>
        <span className='ml-1 font-mono text-[11px] text-white/60'>
          quickstart.sh
        </span>
        <span className='ml-auto rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-emerald-300'>
          200 OK
        </span>
      </div>

      <pre className='overflow-x-auto px-4 py-4 font-mono text-[12px] leading-[1.7] whitespace-pre text-white/85'>
        <span className='text-white/35'>
          # {t('OpenAI-compatible SDK — only base_url and api_key change')}
        </span>
        {'\n'}
        <span className='text-emerald-300'>curl</span>{' '}
        <span className='text-amber-200'>{endpoint}</span> \{'\n  '}
        <span className='text-sky-300'>-H</span>{' '}
        <span className='text-amber-200'>
          &quot;Authorization: Bearer $API_KEY&quot;
        </span>{' '}
        \{'\n  '}
        <span className='text-sky-300'>-H</span>{' '}
        <span className='text-amber-200'>
          &quot;Content-Type: application/json&quot;
        </span>{' '}
        \{'\n  '}
        <span className='text-sky-300'>-d</span>{' '}
        <span className='text-amber-200'>&apos;&#123;</span>
        {'\n    '}
        <span className='text-violet-300'>&quot;model&quot;</span>
        <span className='text-white/45'>: </span>
        <span className='text-amber-200'>&quot;gpt-4o&quot;</span>
        <span className='text-white/45'>,</span>
        {'\n    '}
        <span className='text-violet-300'>&quot;messages&quot;</span>
        <span className='text-white/45'>: </span>
        <span className='text-amber-200'>
          [&#123;&quot;role&quot;:&quot;user&quot;,&quot;content&quot;:&quot;
          {t('hello')}&quot;&#125;]
        </span>
        {'\n  '}
        <span className='text-amber-200'>&#125;&apos;</span>
      </pre>

      <div className='flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 px-4 py-2.5 font-mono text-[10px] text-white/45'>
        <span>
          {t('Latency')} <b className='text-white/80'>42ms</b>
        </span>
        <span className='size-1 rounded-full bg-white/15' />
        <span>
          tokens <b className='text-white/80'>1,284</b>
        </span>
        <span className='size-1 rounded-full bg-white/15' />
        <span>
          {t('Cost')} <b className='text-white/80'>¥0.0214</b>
        </span>
      </div>
    </div>
  )
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()
  const primaryRoute = props.isAuthenticated
    ? AUTHED_ENTRY_ROUTE
    : GUEST_ENTRY_ROUTE

  return (
    <section id='cta' className={cn('relative z-10 px-6', HOME_SECTION_Y)}>
      <div className={HOME_CONTAINER}>
        <AnimateInView
          animation='scale-in'
          className='relative overflow-hidden rounded-[28px] text-white [background:linear-gradient(125deg,#081226_0%,#0f2f6b_48%,#0b6fa4_100%)]'
        >
          {/* Decoration: concentric rings, dot grid, sweeping beam */}
          <div
            aria-hidden
            className='pointer-events-none absolute inset-0 overflow-hidden'
          >
            <span className='absolute -top-40 -right-32 size-[420px] rounded-full border-[36px] border-white/[0.05]' />
            <span className='absolute -top-24 -right-16 size-[240px] rounded-full border-2 border-dashed border-white/15' />
            <span className='absolute bottom-10 left-8 size-20 bg-[radial-gradient(circle,rgb(255_255_255/0.18)_1.5px,transparent_1.5px)] bg-[size:14px_14px]' />
            <span className='tech-animate-beam absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent' />
          </div>

          <div className='relative grid gap-10 p-8 md:p-12 lg:grid-cols-2 lg:items-center lg:gap-14'>
            <div>
              <span className='text-[11px] font-semibold tracking-[0.2em] text-cyan-200/80 uppercase'>
                {t('Get Started · Start now')}
              </span>
              <h2 className='mt-4 text-2xl leading-tight font-bold tracking-tight md:text-[34px]'>
                {t('Integrate in three minutes,')}
                <br />
                {t('put every model inside your product')}
              </h2>
              <p className='mt-5 max-w-lg text-sm leading-relaxed text-white/70 md:text-[15px]'>
                {t(
                  'Sign up and get ¥50 of trial quota, migrate without touching your OpenAI-compatible code, and launch with a dedicated technical advisor. Join 3,600+ merchants cutting AI cost by 40%.'
                )}
              </p>

              <div className='mt-8 flex flex-wrap items-center gap-3'>
                <Button
                  className='group bg-white text-slate-900 hover:bg-white/90'
                  render={<Link to={primaryRoute} />}
                >
                  {props.isAuthenticated
                    ? t('Go to Dashboard')
                    : t('Create a free account')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                <Button
                  variant='outline'
                  className='border-white/25 bg-transparent text-white hover:border-white/45 hover:bg-white/10 hover:text-white'
                  render={
                    <a
                      href={props.docsUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                    />
                  }
                >
                  {t('Book a business demo')}
                </Button>
              </div>

              <ul className='mt-7 flex flex-wrap items-center gap-x-6 gap-y-2'>
                {FINE_PRINT_KEYS.map((key) => (
                  <li
                    key={key}
                    className='inline-flex items-center gap-1.5 text-xs text-white/60'
                  >
                    <Check className='size-3.5 text-cyan-300' />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>

            <QuickstartCard />
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
