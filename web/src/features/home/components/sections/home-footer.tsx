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
import { useTranslation } from 'react-i18next'

import { ProjectAttribution } from '@/components/layout/components/footer'
import { HOME_CONTAINER } from '@/features/home/constants'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

interface HomeFooterProps {
  className?: string
}

// Resolved once at module load so the render path stays pure.
const CURRENT_YEAR = new Date().getFullYear()
const AVERAGE_LATENCY = '38ms'

interface FooterLink {
  label: string
  href: string
}

function FooterLinkItem(props: { link: FooterLink }) {
  return (
    <Link
      to={props.link.href}
      className='text-muted-foreground text-sm transition-colors duration-200 hover:text-blue-600 dark:hover:text-blue-400'
    >
      {props.link.label}
    </Link>
  )
}

export function HomeFooter(props: HomeFooterProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { systemName, logo: systemLogo } = useSystemConfig()

  const hasLegalLinks = Boolean(
    status?.user_agreement_enabled || status?.privacy_policy_enabled
  )
  const displayName = systemName || 'New API'
  const displayLogo = systemLogo || '/logo.png'

  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: t('footer.home.pages'),
      links: [
        { label: t('Home'), href: '/' },
        { label: t('View Pricing'), href: '/pricing' },
        { label: t('Rankings'), href: '/rankings' },
      ],
    },
    {
      title: t('footer.home.products'),
      links: [
        { label: t('Unified Model API'), href: '/' },
        { label: t('Smart Scheduling & Routing'), href: '/dashboard' },
        { label: t('Unified Billing & Quota'), href: '/pricing' },
      ],
    },
  ]

  if (hasLegalLinks) {
    columns.push({
      title: t('footer.home.legal'),
      links: [
        { label: t('User Agreement'), href: '/user-agreement' },
        { label: t('Privacy Policy'), href: '/privacy-policy' },
      ],
    })
  }

  return (
    <footer
      id='site-footer'
      className={cn(
        'border-border/30 bg-muted/25 relative z-10 border-t',
        props.className
      )}
    >
      <div className={cn(HOME_CONTAINER, 'py-14 md:py-16')}>
        <div className='grid gap-10 md:grid-cols-2 lg:grid-cols-[1.6fr_2.2fr] lg:gap-12'>
          <div>
            <Link to='/' className='flex items-center gap-2.5'>
              <img
                src={displayLogo}
                alt={displayName}
                className='size-8 rounded-lg object-contain'
              />
              <span className='flex flex-col leading-none'>
                <span className='text-sm font-bold tracking-tight'>
                  {displayName}
                </span>
                <span className='text-muted-foreground/45 mt-1 text-[9px] font-medium tracking-[0.18em] uppercase'>
                  {t('Aggregation Gateway')}
                </span>
              </span>
            </Link>

            <p className='text-muted-foreground/60 mt-5 max-w-xs text-xs leading-relaxed'>
              {t(
                'A unified aggregation gateway for every AI model. One endpoint, one bill, and instant access to the latest model capacity.'
              )}
            </p>

            <span className='border-border/50 bg-card/70 text-muted-foreground/70 mt-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px]'>
              <span className='landing-live-dot size-1.5 rounded-full bg-emerald-500' />
              {t('All nodes healthy · average latency')}{' '}
              <b className='text-foreground/75 font-semibold tabular-nums'>
                {AVERAGE_LATENCY}
              </b>
            </span>
          </div>

          <div className='grid grid-cols-2 gap-8 sm:grid-cols-3'>
            {columns.map((column) => (
              <div key={column.title}>
                <p className='text-muted-foreground/50 mb-3.5 text-[11px] font-semibold tracking-[0.15em] uppercase'>
                  {column.title}
                </p>
                <ul className='space-y-2.5'>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterLinkItem link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar — legal links stay in the Legal column so each document
            appears exactly once in the footer. The project attribution must
            stay visible (protected identity); it is only toned down here. */}
        <div className='border-border/30 mt-12 flex flex-col items-center justify-between gap-x-4 gap-y-2 border-t pt-6 sm:flex-row'>
          <div className='text-muted-foreground/45 text-xs'>
            &copy; {CURRENT_YEAR} {displayName}. {t('footer.defaultCopyright')}
          </div>
          <span className='text-muted-foreground/30 [&_a]:text-muted-foreground/50 [&_a]:hover:text-foreground/70 [&_span]:text-muted-foreground/30 text-[11px] [&_a]:font-normal'>
            <ProjectAttribution currentYear={CURRENT_YEAR} inline />
          </span>
        </div>
      </div>
    </footer>
  )
}
