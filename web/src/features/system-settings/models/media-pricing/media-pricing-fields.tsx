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

import { AlertTriangle, Wand2 } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatBillingCNY } from '@/lib/currency'

import {
  buildSpecFromDraft,
  nextRowId,
  specToDraft,
  type MediaPricingDraft,
} from './media-pricing-draft'
import {
  DurationEditor,
  KeyValueRowsEditor,
  NumberField,
  PriceMatrixEditor,
  TierRowsEditor,
  ValueRowsEditor,
} from './media-pricing-editor-parts'
import { formatMediaSpecIssue } from './media-pricing-issue'
import {
  emptyMediaSpec,
  formatRatioProduct,
  getDeclaredQualityTiers,
  getDeclaredResolutionTiers,
  listMediaTierPrices,
  normalizeMediaSpec,
  resolveMediaPreview,
  toSerializableSpec,
  validateMediaSpec,
} from './media-pricing-spec'
import {
  MEDIA_KINDS,
  MEDIA_KIND_LABEL_KEYS,
  MEDIA_UNITS,
  MEDIA_UNIT_LABEL_KEYS,
  type MediaKind,
  type MediaModelSpec,
  type MediaSpecIssue,
  type MediaUnit,
} from './media-pricing-types'

type EditorTab = 'pricing' | 'tiers' | 'advanced'

export type MediaPricingFieldsHandle = {
  /** Validates the visual draft and returns the serializable spec. */
  commit: () => MediaModelSpec | null
}

type MediaPricingFieldsProps = {
  /** Existing spec, or null when the model has no media pricing yet. */
  spec?: MediaModelSpec | null
  defaultKind?: MediaKind
  /** Reports the live, uncommitted spec so a parent can preview prices. */
  onSpecChange?: (spec: MediaModelSpec) => void
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function statusSelectLabel(value: string, t: (key: string) => string): string {
  if (value === 'enabled') return t('Enabled')
  if (value === 'disabled') return t('Disabled')
  return t('Follows global switch')
}

function tabForIssues(issues: MediaSpecIssue[]): EditorTab {
  if (issues.some((issue) => issue.path.startsWith('duration'))) {
    return 'advanced'
  }
  const tierPaths = ['resolution', 'quality', 'price_table']
  if (
    issues.some((issue) =>
      tierPaths.some((prefix) => issue.path.startsWith(prefix))
    )
  ) {
    return 'tiers'
  }
  return 'pricing'
}

export const MediaPricingFields = forwardRef<
  MediaPricingFieldsHandle,
  MediaPricingFieldsProps
>(function MediaPricingFields(
  { spec, defaultKind = 'image', onSpecChange },
  ref
) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<MediaPricingDraft>(() =>
    specToDraft('', spec ?? emptyMediaSpec(defaultKind))
  )
  const [tab, setTab] = useState<EditorTab>('pricing')
  const [issues, setIssues] = useState<MediaSpecIssue[]>([])
  const [advancedJson, setAdvancedJson] = useState('')
  const [advancedError, setAdvancedError] = useState('')
  const [previewResolution, setPreviewResolution] = useState(
    () =>
      spec?.default_resolution_tier ??
      Object.keys(spec?.resolution_tiers ?? {})[0] ??
      ''
  )
  const [previewQuality, setPreviewQuality] = useState(
    () => spec?.default_quality_tier ?? (spec?.quality_tiers ?? [])[0] ?? ''
  )
  const [previewDuration, setPreviewDuration] = useState(() =>
    spec?.duration?.default !== undefined ? String(spec.duration.default) : ''
  )
  const [previewCount, setPreviewCount] = useState('1')
  const [previewFlags, setPreviewFlags] = useState<string[]>([])

  const builtSpec = useMemo(() => buildSpecFromDraft(draft), [draft])
  const declaredResolutions = useMemo(
    () => getDeclaredResolutionTiers(builtSpec),
    [builtSpec]
  )
  const declaredQualities = useMemo(
    () => getDeclaredQualityTiers(builtSpec),
    [builtSpec]
  )
  const extraRatioKeys = useMemo(
    () =>
      Object.entries(builtSpec.extra_ratios ?? {})
        .filter(([, ratio]) => typeof ratio === 'number' && ratio > 0)
        .map(([key]) => key),
    [builtSpec]
  )
  const activeFlags = useMemo(
    () => previewFlags.filter((flag) => extraRatioKeys.includes(flag)),
    [extraRatioKeys, previewFlags]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdvancedJson(JSON.stringify(toSerializableSpec(builtSpec), null, 2))
  }, [builtSpec])

  useEffect(() => {
    onSpecChange?.(builtSpec)
  }, [builtSpec, onSpecChange])

  const effectivePreviewResolution = declaredResolutions.includes(
    previewResolution
  )
    ? previewResolution
    : (builtSpec.default_resolution_tier ?? declaredResolutions[0] ?? '')
  const effectivePreviewQuality = declaredQualities.includes(previewQuality)
    ? previewQuality
    : (builtSpec.default_quality_tier ?? declaredQualities[0] ?? '')

  const previewInput = {
    resolutionTier: effectivePreviewResolution,
    qualityTier: effectivePreviewQuality,
    durationSec: Number(previewDuration) || undefined,
    count: Number(previewCount) || undefined,
    flags: activeFlags,
  }
  const preview = useMemo(
    () => resolveMediaPreview(builtSpec, previewInput),
    // previewInput is rebuilt every render; its fields are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeFlags,
      builtSpec,
      effectivePreviewQuality,
      effectivePreviewResolution,
      previewCount,
      previewDuration,
    ]
  )
  const tierPrices = useMemo(
    () =>
      listMediaTierPrices(builtSpec, {
        durationSec: Number(previewDuration) || undefined,
        count: Number(previewCount) || undefined,
        flags: activeFlags,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeFlags, builtSpec, previewCount, previewDuration]
  )

  const updateDraft = (patch: Partial<MediaPricingDraft>) =>
    setDraft((previous) => ({ ...previous, ...patch }))
  const updateSpec = (patch: Partial<MediaModelSpec>) =>
    setDraft((previous) => ({
      ...previous,
      spec: { ...previous.spec, ...patch },
    }))

  let enabledValue = 'inherit'
  if (draft.spec.enabled === true) enabledValue = 'enabled'
  else if (draft.spec.enabled === false) enabledValue = 'disabled'

  const handleKindChange = (kind: MediaKind) => {
    const previousKindUnit = emptyMediaSpec(
      (draft.spec.kind ?? 'image') as MediaKind
    ).unit
    const unit = emptyMediaSpec(kind).unit
    const currentUnit = (draft.spec.unit ?? '') as MediaUnit
    const keepUnit =
      MEDIA_UNITS.includes(currentUnit) && currentUnit !== previousKindUnit
    updateSpec({ kind, ...(keepUnit ? {} : { unit }) })
  }

  const handleApplyJson = () => {
    setAdvancedError('')
    let parsed: unknown
    try {
      parsed = JSON.parse(advancedJson)
    } catch {
      setAdvancedError(t('Invalid JSON'))
      return
    }
    if (!isPlainObject(parsed)) {
      setAdvancedError(t('The media price spec must be a JSON object'))
      return
    }
    const normalized = normalizeMediaSpec(parsed)
    setDraft(specToDraft(draft.name, normalized))
    setIssues([])
    setAdvancedError('')
  }

  useImperativeHandle(
    ref,
    () => ({
      commit: () => {
        const next = buildSpecFromDraft(draft)
        const nextIssues = validateMediaSpec(next)
        if (nextIssues.length > 0) {
          setIssues(nextIssues)
          setTab(tabForIssues(nextIssues))
          return null
        }
        setIssues([])
        return next
      },
    }),
    [draft]
  )

  // Per-call billing belongs to the fixed price. Legacy media entries stay
  // selectable so existing configurations are never rewritten by surprise.
  const unitOptions = MEDIA_UNITS.filter(
    (unit) => unit !== 'per_call' || draft.spec.unit === 'per_call'
  )

  let previewIssueText = ''
  if (preview.issue === 'duration_required') {
    previewIssueText = t('Enter a duration to preview this price')
  } else if (preview.issue === 'duration_exceeded') {
    previewIssueText = t('Duration exceeds the configured maximum')
  } else if (preview.issue === 'price_missing') {
    previewIssueText = t('No price matches the selected tiers')
  }

  return (
    <div className='space-y-5'>
      {issues.length > 0 && (
        <Alert variant='destructive'>
          <AlertTriangle data-icon='inline-start' />
          <AlertDescription>
            <ul className='list-disc space-y-1 pl-4 text-sm'>
              {issues.slice(0, 8).map((issue) => (
                <li key={`${issue.code}-${issue.path}`}>
                  {formatMediaSpecIssue(t, issue)}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <div className='grid gap-3 sm:grid-cols-2'>
          <Field>
            <FieldLabel>{t('Media kind')}</FieldLabel>
            <Select
              value={
                MEDIA_KINDS.includes((draft.spec.kind ?? '') as MediaKind)
                  ? (draft.spec.kind as string)
                  : ''
              }
              onValueChange={(value) => handleKindChange(value as MediaKind)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('Select a media kind')}>
                  {MEDIA_KINDS.includes((draft.spec.kind ?? '') as MediaKind)
                    ? t(MEDIA_KIND_LABEL_KEYS[draft.spec.kind as MediaKind])
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MEDIA_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {t(MEDIA_KIND_LABEL_KEYS[kind])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>{t('Billing unit')}</FieldLabel>
            <Select
              value={
                MEDIA_UNITS.includes((draft.spec.unit ?? '') as MediaUnit)
                  ? (draft.spec.unit as string)
                  : ''
              }
              onValueChange={(value) =>
                updateSpec({ unit: value ?? undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('Select a billing unit')}>
                  {MEDIA_UNITS.includes((draft.spec.unit ?? '') as MediaUnit)
                    ? t(MEDIA_UNIT_LABEL_KEYS[draft.spec.unit as MediaUnit])
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {t(MEDIA_UNIT_LABEL_KEYS[unit])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel>{t('Model status')}</FieldLabel>
          <Select
            value={enabledValue}
            onValueChange={(value) =>
              updateSpec({
                enabled: value === 'inherit' ? undefined : value === 'enabled',
              })
            }
          >
            <SelectTrigger>
              <SelectValue>{statusSelectLabel(enabledValue, t)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='inherit'>
                {t('Follows global switch')}
              </SelectItem>
              <SelectItem value='enabled'>{t('Enabled')}</SelectItem>
              <SelectItem value='disabled'>{t('Disabled')}</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>
            {t(
              'Disabled models keep their configuration but are never charged through the media price table.'
            )}
          </FieldDescription>
        </Field>
      </FieldGroup>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as EditorTab)}
        className='gap-4'
      >
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='pricing'>{t('Price')}</TabsTrigger>
          <TabsTrigger value='tiers'>{t('Tiers & matrix')}</TabsTrigger>
          <TabsTrigger value='advanced'>{t('Rules & JSON')}</TabsTrigger>
        </TabsList>

        <TabsContent value='pricing' className='space-y-5'>
          <FieldGroup>
            {draft.spec.unit === 'per_call' && (
              <>
                <NumberField
                  label={t('Price per call')}
                  description={t('Charged once per request in CNY.')}
                  value={
                    draft.spec.base_price !== undefined
                      ? String(draft.spec.base_price)
                      : ''
                  }
                  placeholder='0.5'
                  onChange={(value) =>
                    updateSpec({
                      base_price: value === '' ? undefined : Number(value),
                    })
                  }
                />
                <p className='text-muted-foreground rounded-md border border-dashed p-3 text-xs'>
                  {t(
                    'Use the fixed price for per-request billing. This legacy media option is kept for compatibility.'
                  )}
                </p>
              </>
            )}

            {draft.spec.unit === 'per_second' && (
              <NumberField
                label={t('Price per second')}
                description={t(
                  'Multiplied by the billed duration and any resolution ratio.'
                )}
                value={
                  draft.spec.per_second !== undefined
                    ? String(draft.spec.per_second)
                    : ''
                }
                placeholder='0.1'
                onChange={(value) =>
                  updateSpec({
                    per_second: value === '' ? undefined : Number(value),
                  })
                }
              />
            )}

            {draft.spec.unit === 'per_image' && (
              <NumberField
                label={t('Base price per image')}
                description={t(
                  'Used when no price table cell matches. Optional when the price matrix is complete.'
                )}
                value={
                  draft.spec.base_price !== undefined
                    ? String(draft.spec.base_price)
                    : ''
                }
                placeholder='0.1'
                onChange={(value) =>
                  updateSpec({
                    base_price: value === '' ? undefined : Number(value),
                  })
                }
              />
            )}

            {draft.spec.unit === 'per_1m_tokens' && (
              <p className='text-muted-foreground rounded-md border border-dashed p-4 text-sm'>
                {t(
                  'Token-priced models keep using the model ratio or fixed price. The media table only declares the model kind.'
                )}
              </p>
            )}
          </FieldGroup>

          <div className='bg-muted/20 space-y-3 rounded-lg border p-3'>
            <div className='text-sm font-medium'>{t('Price preview')}</div>
            <div className='grid gap-3 sm:grid-cols-3'>
              <Field>
                <FieldLabel>{t('Resolution')}</FieldLabel>
                <Select
                  value={effectivePreviewResolution || '__none__'}
                  onValueChange={(value) =>
                    setPreviewResolution(
                      value === '__none__' ? '' : (value ?? '')
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {effectivePreviewResolution || t('Not set')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>{t('Not set')}</SelectItem>
                    {declaredResolutions.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('Quality')}</FieldLabel>
                <Select
                  value={effectivePreviewQuality || '__none__'}
                  onValueChange={(value) =>
                    setPreviewQuality(value === '__none__' ? '' : (value ?? ''))
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {effectivePreviewQuality || t('Not set')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>{t('Not set')}</SelectItem>
                    {declaredQualities.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('Duration (seconds)')}</FieldLabel>
                <Input
                  type='number'
                  min={0}
                  step='any'
                  value={previewDuration}
                  disabled={draft.spec.unit !== 'per_second'}
                  onChange={(event) => setPreviewDuration(event.target.value)}
                />
              </Field>
              {draft.spec.unit === 'per_image' && (
                <Field>
                  <FieldLabel>{t('Images per request')}</FieldLabel>
                  <Input
                    type='number'
                    min={1}
                    step={1}
                    value={previewCount}
                    onChange={(event) => setPreviewCount(event.target.value)}
                  />
                </Field>
              )}
            </div>
            {extraRatioKeys.length > 0 && (
              <div className='space-y-2'>
                <div className='text-xs font-medium'>{t('Extra ratios')}</div>
                <div className='flex flex-wrap gap-2'>
                  {extraRatioKeys.map((key) => {
                    const active = activeFlags.includes(key)
                    return (
                      <Button
                        key={key}
                        type='button'
                        size='sm'
                        variant={active ? 'secondary' : 'outline'}
                        className='h-7 gap-1 px-2 text-xs'
                        aria-pressed={active}
                        onClick={() =>
                          setPreviewFlags((previous) =>
                            previous.includes(key)
                              ? previous.filter((item) => item !== key)
                              : [...previous, key]
                          )
                        }
                      >
                        {key}
                        <span className='text-muted-foreground'>
                          ×{builtSpec.extra_ratios?.[key]}
                        </span>
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}
            {previewIssueText ? (
              <p className='text-muted-foreground text-sm'>
                {previewIssueText}
              </p>
            ) : (
              <div className='space-y-1'>
                <div className='text-lg font-semibold tabular-nums'>
                  {formatBillingCNY(preview.total)}
                </div>
                <p className='text-muted-foreground font-mono text-xs'>
                  {formatRatioProduct(preview)}
                </p>
                {preview.fallback && (
                  <p className='text-muted-foreground text-xs'>
                    {t('This request falls back to a wildcard or base price.')}
                  </p>
                )}
              </div>
            )}
            {tierPrices.length > 1 && (
              <div className='space-y-2'>
                <div className='text-xs font-medium'>{t('Price by tier')}</div>
                <div className='overflow-x-auto rounded-md border'>
                  <table className='w-full text-xs'>
                    <thead className='bg-muted/40'>
                      <tr>
                        <th className='px-2 py-1 text-left font-medium'>
                          {t('Resolution')}
                        </th>
                        {declaredQualities.length > 0 && (
                          <th className='px-2 py-1 text-left font-medium'>
                            {t('Quality')}
                          </th>
                        )}
                        <th className='px-2 py-1 text-right font-medium'>
                          {t('Total')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tierPrices.map((row) => (
                        <tr
                          key={`${row.resolutionTier}:${row.qualityTier}`}
                          className='border-t'
                        >
                          <td className='px-2 py-1 font-mono'>
                            {row.resolutionTier || t('Not set')}
                          </td>
                          {declaredQualities.length > 0 && (
                            <td className='px-2 py-1 font-mono'>
                              {row.qualityTier || t('Not set')}
                            </td>
                          )}
                          <td className='px-2 py-1 text-right font-mono tabular-nums'>
                            {row.issue
                              ? '-'
                              : formatBillingCNY(row.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value='tiers' className='space-y-5'>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('Resolution tiers')}</FieldLabel>
              <TierRowsEditor
                rows={draft.tierRows}
                onChange={(rows) => updateDraft({ tierRows: rows })}
                onAdd={() =>
                  updateDraft({
                    tierRows: [
                      ...draft.tierRows,
                      { id: nextRowId('tier'), name: '', sizes: '' },
                    ],
                  })
                }
              />
            </Field>

            <Field>
              <FieldLabel>{t('Default resolution tier')}</FieldLabel>
              <Select
                value={draft.spec.default_resolution_tier ?? '__none__'}
                onValueChange={(value) =>
                  updateSpec({
                    default_resolution_tier:
                      value === '__none__' ? undefined : (value ?? undefined),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {draft.spec.default_resolution_tier || t('Not set')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>{t('Not set')}</SelectItem>
                  {declaredResolutions.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t('Quality tiers')}</FieldLabel>
              <ValueRowsEditor
                rows={draft.qualityRows}
                valuePlaceholder='hd'
                label={t('Quality tier')}
                onChange={(rows) => updateDraft({ qualityRows: rows })}
                onAdd={() =>
                  updateDraft({
                    qualityRows: [
                      ...draft.qualityRows,
                      { id: nextRowId('quality'), key: '', value: '' },
                    ],
                  })
                }
              />
            </Field>

            <Field>
              <FieldLabel>{t('Default quality tier')}</FieldLabel>
              <Select
                value={draft.spec.default_quality_tier ?? '__none__'}
                onValueChange={(value) =>
                  updateSpec({
                    default_quality_tier:
                      value === '__none__' ? undefined : (value ?? undefined),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {draft.spec.default_quality_tier || t('Not set')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>{t('Not set')}</SelectItem>
                  {declaredQualities.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t('Quality aliases')}</FieldLabel>
              <FieldDescription>
                {t(
                  'Map request values to a declared quality tier, for example hd to high.'
                )}
              </FieldDescription>
              <KeyValueRowsEditor
                rows={draft.aliasRows}
                keyPlaceholder={t('Request value')}
                valuePlaceholder={t('Quality tier')}
                onChange={(rows) => updateDraft({ aliasRows: rows })}
                onAdd={() =>
                  updateDraft({
                    aliasRows: [
                      ...draft.aliasRows,
                      { id: nextRowId('alias'), key: '', value: '' },
                    ],
                  })
                }
              />
            </Field>

            <Field>
              <FieldLabel>{t('Price matrix')}</FieldLabel>
              <FieldDescription>
                {t(
                  'Rows are resolution tiers, columns are quality tiers. Leave a cell empty to fall through to the wildcard or base price.'
                )}
              </FieldDescription>
              <PriceMatrixEditor
                resolutionTiers={declaredResolutions}
                qualityTiers={declaredQualities}
                value={draft.priceTable}
                onChange={(priceTable) => updateDraft({ priceTable })}
              />
            </Field>
          </FieldGroup>
        </TabsContent>

        <TabsContent value='advanced' className='space-y-5'>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('Resolution ratios')}</FieldLabel>
              <KeyValueRowsEditor
                rows={draft.resolutionRatioRows}
                numeric
                keyPlaceholder='1080p'
                valuePlaceholder='2'
                onChange={(rows) => updateDraft({ resolutionRatioRows: rows })}
                onAdd={() =>
                  updateDraft({
                    resolutionRatioRows: [
                      ...draft.resolutionRatioRows,
                      { id: nextRowId('resolution'), key: '', value: '' },
                    ],
                  })
                }
              />
            </Field>

            <Field>
              <FieldLabel>{t('Quality ratios')}</FieldLabel>
              <KeyValueRowsEditor
                rows={draft.qualityRatioRows}
                numeric
                keyPlaceholder='hd'
                valuePlaceholder='1.5'
                onChange={(rows) => updateDraft({ qualityRatioRows: rows })}
                onAdd={() =>
                  updateDraft({
                    qualityRatioRows: [
                      ...draft.qualityRatioRows,
                      { id: nextRowId('quality'), key: '', value: '' },
                    ],
                  })
                }
              />
            </Field>

            <Field>
              <FieldLabel>{t('Extra ratios')}</FieldLabel>
              <FieldDescription>
                {t(
                  'Multiplied when the request carries the matching flag, for example hifi or watermark.'
                )}
              </FieldDescription>
              <KeyValueRowsEditor
                rows={draft.extraRatioRows}
                numeric
                keyPlaceholder='hifi'
                valuePlaceholder='1.5'
                onChange={(rows) => updateDraft({ extraRatioRows: rows })}
                onAdd={() =>
                  updateDraft({
                    extraRatioRows: [
                      ...draft.extraRatioRows,
                      { id: nextRowId('extra'), key: '', value: '' },
                    ],
                  })
                }
              />
            </Field>

            {draft.spec.unit === 'per_second' && (
              <Field>
                <FieldLabel>{t('Duration rules')}</FieldLabel>
                <DurationEditor
                  min={draft.durationMin}
                  max={draft.durationMax}
                  fallback={draft.durationDefault}
                  rounding={draft.durationRounding}
                  onChange={(patch) =>
                    updateDraft({
                      ...(patch.min !== undefined
                        ? { durationMin: patch.min }
                        : {}),
                      ...(patch.max !== undefined
                        ? { durationMax: patch.max }
                        : {}),
                      ...(patch.fallback !== undefined
                        ? { durationDefault: patch.fallback }
                        : {}),
                      ...(patch.rounding !== undefined
                        ? { durationRounding: patch.rounding }
                        : {}),
                    })
                  }
                />
              </Field>
            )}

            <Field>
              <FieldLabel>{t('Advanced JSON')}</FieldLabel>
              <FieldDescription>
                {t(
                  'Edit this model spec directly. Applying replaces the visual fields above.'
                )}
              </FieldDescription>
              <Textarea
                className='min-h-64 font-mono text-xs'
                spellCheck={false}
                value={advancedJson}
                onChange={(event) => {
                  setAdvancedJson(event.target.value)
                  setAdvancedError('')
                }}
              />
              {advancedError && (
                <p className='text-destructive text-sm'>{advancedError}</p>
              )}
              <div className='flex justify-end'>
                <Button variant='outline' size='sm' onClick={handleApplyJson}>
                  <Wand2 data-icon='inline-start' />
                  {t('Apply JSON')}
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </TabsContent>
      </Tabs>
    </div>
  )
})
