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
import { Network, ReceiptText, Route, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import {
  HOME_CONTAINER,
  HOME_CARD_HAIRLINE,
  HOME_PANEL,
  HOME_SECTION_Y,
  HOME_STAGGER,
  HOME_TAG,
} from '@/features/home/constants'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import { SectionHeading } from '../section-heading'

interface AdvantagesProps {
  className?: string
}

interface Reason {
  index: string
  titleKey: string
  descriptionKey: string
  tagKeys: string[]
  icon: ReactNode
  tone: string
}

const REASONS: Reason[] = [
  {
    index: '01',
    titleKey: 'Unified gateway access',
    descriptionKey:
      'One OpenAI-compatible protocol for every model, so switching providers costs zero rework.',
    tagKeys: ['OpenAI compatible', 'One-click switch', 'No rework'],
    icon: <Network className='size-5' />,
    tone: 'text-blue-600 dark:text-blue-400',
  },
  {
    index: '02',
    titleKey: 'Smart routing & scheduling',
    descriptionKey:
      'Dispatches by latency, cost and availability in real time, and fails over within seconds.',
    tagKeys: ['Latency-optimized', 'Instant failover', 'Multi-channel'],
    icon: <Route className='size-5' />,
    tone: 'text-sky-600 dark:text-sky-400',
  },
  {
    index: '03',
    titleKey: 'Millisecond transparent billing',
    descriptionKey:
      'Token-accurate metering, real-time bills and multi-dimensional usage reports.',
    tagKeys: ['Token metering', 'Real-time bills', 'Usage reports'],
    icon: <ReceiptText className='size-5' />,
    tone: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    index: '04',
    titleKey: 'Multi-tenant isolation',
    descriptionKey:
      'Merchant keys are encrypted separately, with quota throttling and audit logs end to end.',
    tagKeys: ['Key encryption', 'Quota throttling', 'Audit logs'],
    icon: <ShieldCheck className='size-5' />,
    tone: 'text-indigo-600 dark:text-indigo-400',
  },
]

export function Advantages(_props: AdvantagesProps) {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const displayName = systemName || 'New API'

  return (
    <section id='features' className={cn('relative z-10 px-6', HOME_SECTION_Y)}>
      <div className={HOME_CONTAINER}>
        <SectionHeading
          index='03'
          eyebrow={t('Why {{name}} · Core advantages', { name: displayName })}
          title={
            <>
              {t('Four reasons to choose')}
              <em className='tech-animate-shimmer bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text font-bold text-transparent not-italic dark:from-blue-400 dark:via-sky-400 dark:to-cyan-300'>
                {displayName}
              </em>
            </>
          }
          description={t(
            'From integration and scheduling to billing and security, every link is designed for high-concurrency production workloads — so your team can focus on the product itself.'
          )}
          className='mb-12 md:mb-14'
        />

        <div className='grid gap-5 sm:grid-cols-2 lg:grid-cols-4'>
          {REASONS.map((reason, index) => (
            <AnimateInView
              key={reason.index}
              as='article'
              delay={index * HOME_STAGGER}
              className={cn(
                HOME_PANEL,
                'group flex flex-col p-6 transition-colors duration-300 hover:border-blue-500/35'
              )}
            >
              <div aria-hidden className={HOME_CARD_HAIRLINE} />
              <span className='text-muted-foreground/25 absolute top-5 right-6 font-mono text-xs font-semibold'>
                {reason.index}
              </span>
              <span
                className={cn(
                  'flex size-12 items-center justify-center rounded-2xl border border-blue-500/15 bg-blue-500/[0.06]',
                  reason.tone
                )}
              >
                {reason.icon}
              </span>
              <h3 className='mt-5 text-base font-semibold tracking-tight'>
                {t(reason.titleKey)}
              </h3>
              <p className='text-muted-foreground/70 mt-2.5 text-[13px] leading-relaxed'>
                {t(reason.descriptionKey)}
              </p>
              <div className='mt-5 flex flex-wrap gap-2'>
                {reason.tagKeys.map((key) => (
                  <span key={key} className={HOME_TAG}>
                    {t(key)}
                  </span>
                ))}
              </div>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
