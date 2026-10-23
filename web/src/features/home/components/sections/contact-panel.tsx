import { ArrowUp, Handshake, Headset, QrCode, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ContactPanelProps {
  className?: string
}

interface WeChatEntry {
  id: 'business' | 'support'
  labelKey: string
  descriptionKey: string
  icon: ReactNode
  featured?: boolean
}

/** Scroll distance after which the back-to-top action appears. */
const BACK_TO_TOP_THRESHOLD = 480

function WeChatCard(props: {
  entry: WeChatEntry
  onSelect: (id: WeChatEntry['id']) => void
}) {
  const { t } = useTranslation()

  return (
    <button
      type='button'
      onClick={() => props.onSelect(props.entry.id)}
      className={cn(
        'flex min-h-[68px] w-[68px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2 text-center backdrop-blur-xl transition-transform duration-200 hover:scale-[1.04]',
        props.entry.featured
          ? 'border-transparent text-white shadow-[0_10px_24px_-14px_rgba(37,99,235,0.9)] [background:linear-gradient(135deg,rgb(37,99,235),rgb(6,182,212))]'
          : 'border-border/70 bg-card/95 text-foreground hover:border-blue-500/40 hover:text-blue-600 dark:hover:text-blue-400'
      )}
    >
      <span aria-hidden className='shrink-0'>
        {props.entry.icon}
      </span>
      <span className='text-[11px] leading-tight font-medium'>
        {t(props.entry.labelKey)}
      </span>
    </button>
  )
}

/**
 * Floating shortcut rail on the right edge: business cooperation and
 * after-sales service entries that each open a WeChat QR dialog, plus a
 * back-to-top action once the visitor scrolls down.
 */
export function ContactPanel(props: ContactPanelProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(true)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [openEntry, setOpenEntry] = useState<WeChatEntry['id'] | null>(null)

  useEffect(() => {
    const handleScroll = () =>
      setShowBackToTop(window.scrollY > BACK_TO_TOP_THRESHOLD)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const entries: WeChatEntry[] = [
    {
      id: 'business',
      labelKey: 'Business Cooperation',
      descriptionKey: 'Scan the QR code with WeChat to contact us',
      icon: <Handshake className='size-4' />,
      featured: true,
    },
    {
      id: 'support',
      labelKey: 'After-sales Service',
      descriptionKey: 'Scan the QR code with WeChat to contact us',
      icon: <Headset className='size-4' />,
    },
  ]

  const activeEntry = entries.find((entry) => entry.id === openEntry)

  return (
    <aside
      aria-label={t('Quick links')}
      className={cn(
        'fixed top-1/2 right-2 z-40 hidden -translate-y-1/2 flex-col items-center gap-2 md:right-4 md:flex',
        props.className
      )}
    >
      <button
        type='button'
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
        aria-label={expanded ? t('Hide quick links') : t('Show quick links')}
        className='border-border/70 bg-card/95 text-muted-foreground grid size-6 place-items-center rounded-full border shadow-sm backdrop-blur-xl transition-colors hover:border-blue-500/40 hover:text-blue-600 dark:hover:text-blue-400'
      >
        {expanded ? (
          <X className='size-3.5' />
        ) : (
          <ArrowUp className='size-3.5 rotate-45' />
        )}
      </button>

      {expanded
        ? entries.map((entry) => (
            <WeChatCard key={entry.id} entry={entry} onSelect={setOpenEntry} />
          ))
        : null}

      {showBackToTop ? (
        <button
          type='button'
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                .matches
                ? 'auto'
                : 'smooth',
            })
          }
          aria-label={t('Back to top')}
          className='mt-1 grid size-10 place-items-center rounded-full text-white shadow-[0_12px_28px_-14px_rgba(37,99,235,0.95)] transition-transform duration-200 [background:linear-gradient(135deg,rgb(37,99,235),rgb(6,182,212))] hover:scale-[1.06]'
        >
          <ArrowUp className='size-4' />
        </button>
      ) : null}

      <Dialog
        open={openEntry !== null}
        onOpenChange={(open) => {
          if (!open) setOpenEntry(null)
        }}
      >
        <DialogContent className='sm:max-w-72'>
          <DialogHeader className='items-center text-center'>
            <span
              className={cn(
                'mb-1 flex size-11 items-center justify-center rounded-2xl border',
                'border-blue-500/20 bg-blue-500/[0.06] text-blue-600 dark:text-blue-400'
              )}
            >
              {activeEntry?.icon}
            </span>
            <DialogTitle>
              {activeEntry ? t(activeEntry.labelKey) : null}
            </DialogTitle>
            <DialogDescription>
              {activeEntry ? t(activeEntry.descriptionKey) : null}
            </DialogDescription>
          </DialogHeader>

          {/* TODO: 替换为真实微信二维码图片 */}
          <div className='border-border/70 bg-muted/30 mx-auto grid aspect-square w-44 place-items-center rounded-2xl border-2 border-dashed'>
            <div className='flex flex-col items-center gap-2'>
              <QrCode className='text-muted-foreground/35 size-10' />
              <span className='text-muted-foreground/45 text-xs'>
                {t('WeChat QR code')}
              </span>
            </div>
          </div>
          <p className='text-muted-foreground/45 -mt-1 text-center text-[11px]'>
            {t('QR code to be added')}
          </p>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
