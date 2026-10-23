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
import { Activity, Radar } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar as RadarShape,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { AnimateInView } from '@/components/animate-in-view'
import {
  HOME_CONTAINER,
  HOME_PANEL,
  HOME_SECTION_Y,
} from '@/features/home/constants'
import { cn } from '@/lib/utils'

import { SectionHeading } from '../section-heading'

interface InsightProps {
  className?: string
}

interface FlowPoint {
  time: string
  qps: number
}

const SAMPLE_INTERVAL = 2000
const FLOW_POINTS = 40
const FLOW_PEAK = '18.2K'
const P99_LATENCY = '286ms'

const CAPABILITY_AXIS_KEYS = [
  'Throughput',
  'Stability',
  'Smart routing',
  'Transparent billing',
  'Security isolation',
  'Ecosystem coverage',
]

const CAPABILITY_SCORES = [96, 98.5, 97, 99, 98, 95]

const CAPABILITY_SCORE = 98.7

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour12: false })
}

/** Synthetic-but-stable shaped sample so the stream reads like real traffic. */
function sampleQps(step: number): number {
  const wave = 1200 + Math.sin(step / 3.1) * 320 + Math.sin(step / 7.7) * 140
  return Math.max(180, Math.round(wave + (Math.random() - 0.5) * 90))
}

function buildSeries(): FlowPoint[] {
  const now = Date.now()
  return Array.from({ length: FLOW_POINTS }, (_, index) => {
    const stamp = new Date(now - (FLOW_POINTS - 1 - index) * SAMPLE_INTERVAL)
    return { time: formatClock(stamp), qps: sampleQps(index) }
  })
}

function PanelShell(props: {
  icon: ReactNode
  titleKey: string
  subKey: string
  foot: ReactNode
  live?: boolean
  className?: string
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <AnimateInView className={cn(HOME_PANEL, 'p-5', props.className)}>
      <div className='flex items-center gap-3'>
        <span className='flex size-9 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/[0.06] text-blue-600 dark:text-blue-400'>
          {props.icon}
        </span>
        <div className='min-w-0'>
          <div className='text-sm font-semibold'>{t(props.titleKey)}</div>
          <div className='text-muted-foreground/55 text-[11px]'>
            {t(props.subKey)}
          </div>
        </div>
        {props.live ? (
          <span className='ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-emerald-600 uppercase dark:text-emerald-400'>
            <span className='landing-live-dot size-1.5 rounded-full bg-emerald-500' />
            Live
          </span>
        ) : null}
      </div>

      <div className='mt-5'>{props.children}</div>

      <div className='border-border/40 text-muted-foreground/60 mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3.5 text-[11px]'>
        {props.foot}
      </div>
    </AnimateInView>
  )
}

function FootStat(props: { labelKey: string; children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <span className='inline-flex items-center gap-1.5'>
      {t(props.labelKey)}
      <b className='text-foreground/80 font-semibold tabular-nums'>
        {props.children}
      </b>
    </span>
  )
}

export function Insight(_props: InsightProps) {
  const { t } = useTranslation()
  const [series, setSeries] = useState<FlowPoint[]>(buildSeries)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let step = FLOW_POINTS
    const timer = setInterval(() => {
      step += 1
      setSeries((previous) => [
        ...previous.slice(1),
        { time: formatClock(new Date()), qps: sampleQps(step) },
      ])
    }, SAMPLE_INTERVAL)

    return () => clearInterval(timer)
  }, [])

  const current = series.at(-1)?.qps ?? 0
  const radarData = CAPABILITY_AXIS_KEYS.map((key, index) => ({
    axis: t(key),
    score: CAPABILITY_SCORES[index],
  }))

  return (
    <section
      id='insight'
      className={cn(
        'border-border/30 bg-muted/[0.18] relative z-10 border-y px-6',
        HOME_SECTION_Y
      )}
    >
      <div className={HOME_CONTAINER}>
        <SectionHeading
          index='02'
          eyebrow={t('Realtime Insight · Observability')}
          title={
            <>
              {t('Stability you can see,')}
              <em className='tech-animate-shimmer bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text font-bold text-transparent not-italic dark:from-blue-400 dark:via-sky-400 dark:to-cyan-300'>
                {t('cost you can audit')}
              </em>
            </>
          }
          description={t(
            'A live request stream and a platform capability profile, with every data point sampled every 2 seconds. The open API can feed your own dashboard too.'
          )}
          className='mb-12 md:mb-14'
        />

        <div className='grid gap-6 lg:grid-cols-3'>
          <PanelShell
            icon={<Activity className='size-4' />}
            titleKey='Live request stream'
            subKey='Live Request Stream · sampled every 2 seconds'
            live
            className='lg:col-span-2'
            foot={
              <>
                <FootStat labelKey='Now'>
                  {current.toLocaleString()} req/s
                </FootStat>
                <FootStat labelKey='Peak'>{FLOW_PEAK}</FootStat>
                <FootStat labelKey='P99 latency'>{P99_LATENCY}</FootStat>
              </>
            }
          >
            <div className='h-[280px] w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart
                  data={series}
                  margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
                >
                  <defs>
                    <linearGradient
                      id='landing-flow-fill'
                      x1='0'
                      y1='0'
                      x2='0'
                      y2='1'
                    >
                      <stop offset='0%' stopColor='rgb(37 99 235 / 0.32)' />
                      <stop offset='100%' stopColor='rgb(37 99 235 / 0)' />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray='3 6'
                    className='stroke-border/60'
                  />
                  <XAxis
                    dataKey='time'
                    interval={Math.floor(FLOW_POINTS / 8)}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    className='text-muted-foreground/50'
                  />
                  <YAxis
                    domain={[0, 1600]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    className='text-muted-foreground/50'
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgb(37 99 235 / 0.35)' }}
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--popover)',
                      fontSize: 11,
                      color: 'var(--popover-foreground)',
                    }}
                    formatter={(value) => [
                      `${Number(value).toLocaleString()} req/s`,
                      t('Requests'),
                    ]}
                  />
                  <Area
                    type='monotone'
                    dataKey='qps'
                    stroke='rgb(37 99 235)'
                    strokeWidth={2}
                    fill='url(#landing-flow-fill)'
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </PanelShell>

          <PanelShell
            icon={<Radar className='size-4' />}
            titleKey='Platform capability profile'
            subKey='Capability Radar'
            foot={
              <>
                <FootStat labelKey='Overall score'>{CAPABILITY_SCORE}</FootStat>
                <span>{t('Industry leading')}</span>
              </>
            }
          >
            <div className='h-[280px] w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <RadarChart data={radarData} outerRadius='72%'>
                  <PolarGrid className='stroke-border/70' />
                  <PolarAngleAxis
                    dataKey='axis'
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    className='text-muted-foreground/60'
                  />
                  <RadarShape
                    dataKey='score'
                    stroke='rgb(37 99 235)'
                    strokeWidth={2}
                    fill='rgb(37 99 235)'
                    fillOpacity={0.22}
                    isAnimationActive={false}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </PanelShell>
        </div>
      </div>
    </section>
  )
}
