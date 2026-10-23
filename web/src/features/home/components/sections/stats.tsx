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
  Activity,
  Layers,
  ShieldCheck,
  Store,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import {
  HOME_CONTAINER,
  HOME_PANEL,
  HOME_STAGGER,
} from '@/features/home/constants'
import { cn } from '@/lib/utils'

interface MetricsBandProps {
  className?: string
}

interface KpiMetric {
  id: string
  labelKey: string
  value: number
  decimals?: number
  suffix?: string
  /** Unit rendered after the value; omitted when the suffix already carries it. */
  unitKey?: string
  footKey: string
  /** Literal appended after the translated foot label, e.g. `18.2K`. */
  footValue?: string
  icon: ReactNode
  tone: string
}

const KPI_METRICS: KpiMetric[] = [
  {
    id: 'requests',
    labelKey: 'Total API requests',
    value: 8.64,
    decimals: 2,
    unitKey: 'billion calls',
    footKey: '+18.6% vs last month',
    icon: <Activity className='size-4' />,
    tone: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'models',
    labelKey: 'Models integrated',
    value: 128,
    unitKey: 'models',
    footKey: '6 added this week',
    icon: <Layers className='size-4' />,
    tone: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'merchants',
    labelKey: 'Merchants served',
    value: 3600,
    suffix: '+',
    unitKey: 'merchants',
    footKey: '+9.2% vs last month',
    icon: <Store className='size-4' />,
    tone: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    id: 'success',
    labelKey: 'Average success rate',
    value: 99.95,
    decimals: 2,
    suffix: '%',
    footKey: 'Rolling 30 days',
    icon: <ShieldCheck className='size-4' />,
    tone: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'qps',
    labelKey: 'Live QPS',
    value: 12057,
    unitKey: 'req/s',
    footKey: 'Current peak',
    footValue: '18.2K',
    icon: <Zap className='size-4' />,
    tone: 'text-blue-600 dark:text-blue-400',
  },
]

const QPS_BASE = 12057

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour12: false })
}

function Counter(props: {
  end: number
  suffix?: string
  decimals?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const startedRef = useRef(false)

  const format = useCallback(
    (value: number) =>
      props.decimals
        ? value.toFixed(props.decimals)
        : Math.round(value).toLocaleString(),
    [props.decimals]
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const final = `${format(props.end)}${props.suffix ?? ''}`

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = final
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || startedRef.current) return
        startedRef.current = true
        observer.unobserve(el)

        const start = performance.now()
        const duration = 1600
        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          el.textContent = `${format(eased * props.end)}${props.suffix ?? ''}`
          if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      },
      { threshold: 0.4 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [format, props.end, props.suffix])

  return (
    <span ref={ref} className={cn('tabular-nums', props.className)}>
      {format(props.end)}
      {props.suffix}
    </span>
  )
}

/**
 * Platform KPI band. Counters animate in once visible and the timestamp plus
 * live QPS keep ticking so the band reads as a live status strip.
 */
export function Stats(_props: MetricsBandProps) {
  const { t } = useTranslation()
  const [updatedAt, setUpdatedAt] = useState(() => formatTime(new Date()))
  const [qps, setQps] = useState(QPS_BASE)

  useEffect(() => {
    const clock = setInterval(() => setUpdatedAt(formatTime(new Date())), 1000)
    const sampler = setInterval(() => {
      const jitter = 1 + (Math.random() - 0.45) * 0.03
      setQps(Math.round(QPS_BASE * jitter))
    }, 2000)

    return () => {
      clearInterval(clock)
      clearInterval(sampler)
    }
  }, [])

  return (
    <section
      id='metrics'
      className='border-border/30 bg-muted/15 relative z-10 border-y'
    >
      <div className={cn(HOME_CONTAINER, 'py-14 md:py-16')}>
        <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
          <h2 className='text-xl font-bold tracking-tight md:text-2xl'>
            {t('Platform status, live')}
          </h2>
          <span className='text-muted-foreground/45 text-[11px] tracking-[0.2em] uppercase'>
            Live Platform Metrics
          </span>
          <span className='bg-border/60 hidden h-px flex-1 md:block' />
          <span className='text-muted-foreground/55 text-[11px]'>
            {t('Updated at')}{' '}
            <b className='font-mono text-blue-600 tabular-nums dark:text-blue-400'>
              {updatedAt}
            </b>
          </span>
        </div>

        <div className='mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
          {KPI_METRICS.map((metric, index) => (
            <AnimateInView
              key={metric.id}
              as='div'
              delay={index * HOME_STAGGER}
              className={cn(HOME_PANEL, 'p-5 pl-6')}
            >
              <span
                aria-hidden
                className='absolute inset-y-4 left-0 w-[3px] rounded-full bg-gradient-to-b from-blue-500 to-cyan-400'
              />
              <div className='flex items-center gap-2.5'>
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg border border-blue-500/15 bg-blue-500/[0.06]',
                    metric.tone
                  )}
                >
                  {metric.icon}
                </span>
                <span className='text-muted-foreground/70 text-xs'>
                  {t(metric.labelKey)}
                </span>
              </div>

              <div className='mt-4 flex items-baseline gap-1.5'>
                <span
                  className={cn(
                    'text-2xl leading-none font-bold tracking-tight md:text-[28px]',
                    metric.tone
                  )}
                >
                  {metric.id === 'qps' ? (
                    <span className='tabular-nums'>{qps.toLocaleString()}</span>
                  ) : (
                    <Counter
                      end={metric.value}
                      decimals={metric.decimals}
                      suffix={metric.suffix}
                    />
                  )}
                </span>
                {metric.unitKey ? (
                  <span className='text-muted-foreground/60 text-xs'>
                    {t(metric.unitKey)}
                  </span>
                ) : null}
              </div>

              <div className='text-muted-foreground/55 mt-3.5 flex items-center gap-1.5 text-[11px]'>
                <TrendingUp className='size-3 text-emerald-500 dark:text-emerald-400' />
                {t(metric.footKey)}
                {metric.footValue ? (
                  <b className='text-foreground/70 font-semibold tabular-nums'>
                    {metric.footValue}
                  </b>
                ) : null}
              </div>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
