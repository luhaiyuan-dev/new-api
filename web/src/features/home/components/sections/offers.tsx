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
import { ArrowRight, Building2, Layers, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import {
  COMMUNITY_URL,
  HOME_CONTAINER,
  HOME_SECTION_Y,
  HOME_STAGGER,
} from '@/features/home/constants'
import { cn } from '@/lib/utils'

import { SectionHeading } from '../section-heading'

interface OffersProps {
  className?: string
  /** Support entry configured by the backend, used by the sales CTA. */
  docsUrl: string
}

type OfferTone = 'ink' | 'glass' | 'mist'

interface OfferCard {
  index: string
  tone: OfferTone
  recommended?: boolean
  badgeKey: string
  kickerKey: string
  titleKey: string
  descriptionKey: string
  bulletKeys: string[]
  ctaKey: string
  metaKey: string
  href: string
  icon: ReactNode
}

/** Card surface per tone. */
const TONE_SURFACE: Record<OfferTone, string> = {
  ink: 'border-blue-400/20 text-white [background:linear-gradient(135deg,#0a1224_0%,#0f2a5c_55%,#0a1224_100%)]',
  glass:
    'border-border/50 bg-card [background-image:linear-gradient(135deg,rgba(37,99,235,0.06),transparent_55%)]',
  mist: 'border-border/50 bg-card [background-image:linear-gradient(135deg,rgba(14,165,233,0.07),transparent_60%)]',
}

/** Badge styling per tone; the recommended badge overrides the tone. */
const BADGE_TONE: Record<OfferTone, string> = {
  ink: 'border border-white/15 text-white/80',
  glass:
    'border border-blue-500/20 bg-blue-500/[0.06] text-blue-700 dark:text-blue-300',
  mist: 'border border-blue-500/20 bg-blue-500/[0.06] text-blue-700 dark:text-blue-300',
}

const BADGE_DOT_TONE: Record<OfferTone, string> = {
  ink: 'bg-cyan-300',
  glass: 'bg-blue-500',
  mist: 'bg-blue-500',
}

const RECOMMENDED_BADGE =
  'bg-gradient-to-r from-blue-500/90 to-cyan-500/90 text-white'

const RECOMMENDED_BADGE_DOT = 'bg-white'

/** Decorative rings, dot grid and sweeping beam shared by every offer card. */
function OfferArt(props: { tone: OfferTone }) {
  const isInk = props.tone === 'ink'

  return (
    <div
      aria-hidden
      className='pointer-events-none absolute inset-0 overflow-hidden'
    >
      <span
        className={cn(
          'absolute -top-36 -left-36 size-[320px] rounded-full border-[28px]',
          isInk ? 'border-white/[0.08]' : 'border-blue-500/[0.09]'
        )}
      />
      <span
        className={cn(
          'absolute -top-24 -left-20 size-[190px] rounded-full border-2 border-dashed',
          isInk ? 'border-white/20' : 'border-blue-500/20'
        )}
      />
      <span
        className={cn(
          'absolute right-6 bottom-24 size-16 bg-[radial-gradient(circle,currentColor_1.5px,transparent_1.5px)] bg-[size:12px_12px]',
          isInk ? 'text-white/20' : 'text-blue-500/25'
        )}
      />
      <span className='tech-animate-beam absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent' />
    </div>
  )
}

function OfferCardView(props: { card: OfferCard; delay: number }) {
  const { t } = useTranslation()
  const card = props.card
  const isInk = card.tone === 'ink'
  const isInternal = card.href.startsWith('/')

  const ctaClassName = cn(
    'group/cta inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-transform duration-200 hover:scale-[1.02]',
    isInk
      ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white'
      : 'text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.7)] [background:linear-gradient(90deg,rgb(37,99,235),rgb(6,182,212))]'
  )

  const cta = isInternal ? (
    <Link to={card.href} className={ctaClassName}>
      {t(card.ctaKey)}
      <ArrowRight className='size-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5' />
    </Link>
  ) : (
    <a
      href={card.href}
      target='_blank'
      rel='noopener noreferrer'
      className={ctaClassName}
    >
      {t(card.ctaKey)}
      <ArrowRight className='size-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5' />
    </a>
  )

  return (
    <AnimateInView
      animation='scale-in'
      delay={props.delay}
      as='div'
      className={cn(
        'relative flex min-h-[400px] flex-col overflow-hidden rounded-3xl border p-8',
        TONE_SURFACE[card.tone]
      )}
    >
      <OfferArt tone={card.tone} />

      <span
        aria-hidden
        className={cn(
          'absolute top-6 right-8 font-mono text-5xl font-bold select-none',
          isInk ? 'text-white/10' : 'text-blue-500/10'
        )}
      >
        {card.index}
      </span>

      <span
        className={cn(
          'relative inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium',
          card.recommended ? RECOMMENDED_BADGE : BADGE_TONE[card.tone]
        )}
      >
        <i
          aria-hidden
          className={cn(
            'size-1.5 rounded-full',
            card.recommended ? RECOMMENDED_BADGE_DOT : BADGE_DOT_TONE[card.tone]
          )}
        />
        {t(card.badgeKey)}
      </span>

      <span
        className={cn(
          'relative mt-6 flex size-12 items-center justify-center rounded-2xl border',
          isInk
            ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200'
            : 'border-blue-500/20 bg-blue-500/[0.06] text-blue-600 dark:text-blue-400'
        )}
      >
        {card.icon}
      </span>

      <span
        className={cn(
          'relative mt-5 text-[11px] font-semibold tracking-[0.18em] uppercase',
          isInk ? 'text-cyan-200/70' : 'text-muted-foreground/50'
        )}
      >
        {t(card.kickerKey)}
      </span>

      <h3 className='relative mt-2 text-xl font-bold tracking-tight'>
        {t(card.titleKey)}
      </h3>
      <p
        className={cn(
          'relative mt-3 text-sm leading-relaxed',
          isInk ? 'text-white/70' : 'text-muted-foreground/75'
        )}
      >
        {t(card.descriptionKey)}
      </p>

      <ul className='relative mt-5 space-y-2.5'>
        {card.bulletKeys.map((key) => (
          <li
            key={key}
            className={cn(
              'flex items-start gap-2.5 text-[13px] leading-relaxed',
              isInk ? 'text-white/80' : 'text-foreground/75'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-1.5 size-1.5 shrink-0 rotate-45 rounded-[1px]',
                isInk ? 'bg-cyan-300' : 'bg-blue-500'
              )}
            />
            {t(key)}
          </li>
        ))}
      </ul>

      <div className='relative mt-auto flex flex-wrap items-center gap-4 pt-7'>
        {cta}
        <span
          className={cn(
            'text-[11px]',
            isInk ? 'text-white/50' : 'text-muted-foreground/55'
          )}
        >
          {t(card.metaKey)}
        </span>
      </div>
    </AnimateInView>
  )
}

export function Offers(props: OffersProps) {
  const { t } = useTranslation()

  const cards: OfferCard[] = [
    {
      index: '02',
      tone: 'ink',
      recommended: true,
      badgeKey: 'Recommended · Enterprise',
      kickerKey: 'Enterprise Plan',
      titleKey: 'Dedicated enterprise plan',
      descriptionKey:
        'Dedicated clusters and private channels, a written 99.99% SLA, full-chain auditing and corporate settlement to keep your launch on solid ground.',
      bulletKeys: [
        'Dedicated cluster / private deployment, data never leaves your region',
        'Dedicated SLA of 99.99% with a 5-minute incident response',
        'Corporate settlement / VAT invoices / compliance audit logs',
      ],
      ctaKey: 'Contact sales',
      metaKey: '480+ enterprise customers served',
      href: props.docsUrl,
      icon: <Building2 className='size-5.5' />,
    },
    {
      index: '03',
      tone: 'glass',
      badgeKey: '128+ models',
      kickerKey: 'Models Always New',
      titleKey: 'New models, every single week',
      descriptionKey:
        'The newest models from leading vendors are synced every week — callable the moment they land, without changing a single line of code.',
      bulletKeys: [
        '128+ models integrated, 6 new ones this week',
        'Chat / code / embeddings / image / speech fully covered',
        'New releases sync automatically — switch with zero rework',
      ],
      ctaKey: 'Browse model square',
      metaKey: 'Model list refreshed every Wednesday',
      href: '/pricing',
      icon: <Layers className='size-5.5' />,
    },
    {
      index: '04',
      tone: 'mist',
      badgeKey: 'Partnership',
      kickerKey: 'Multi-Merchant Revenue',
      titleKey: 'Resell and earn revenue share',
      descriptionKey:
        'The multi-merchant mode is open to everyone — resell model capacity, settle revenue share automatically, and run an AI business without a technical background.',
      bulletKeys: [
        'Open a merchant account in one click and set your own markup',
        'Revenue share settled in real time with a transparent ledger',
        'Admin console and billing system included, zero ops work',
      ],
      ctaKey: 'Apply for partnership',
      metaKey: 'Individuals and companies welcome',
      href: COMMUNITY_URL,
      icon: <TrendingUp className='size-5.5' />,
    },
  ]

  return (
    <section id='promo' className={cn('relative z-10 px-6', HOME_SECTION_Y)}>
      <div className={HOME_CONTAINER}>
        <SectionHeading
          index='01'
          eyebrow={t('Limited Offers · Featured')}
          title={
            <>
              {t('Three offers,')}
              <em className='tech-animate-shimmer bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text font-bold text-transparent not-italic dark:from-blue-400 dark:via-sky-400 dark:to-cyan-300'>
                {t('start today')}
              </em>
            </>
          }
          description={t(
            'Whether you are a developer trying models for the first time, a company that needs private deployment, or a tinkerer chasing the newest release — there is a plan waiting for you. No credit card required, active immediately after sign-up.'
          )}
          className='mb-12 md:mb-14'
        />

        <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {cards.map((card, index) => (
            <OfferCardView
              key={card.index}
              card={card}
              delay={index * HOME_STAGGER}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
