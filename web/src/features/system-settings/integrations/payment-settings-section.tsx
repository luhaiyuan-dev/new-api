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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Code2, Eye, Info, ShieldAlert } from 'lucide-react'
import * as React from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { JsonCodeEditor } from '@/components/json-code-editor'
import { RiskAcknowledgementDialog } from '@/components/risk-acknowledgement-dialog'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import { confirmPaymentCompliance, getPaymentGatewayStatus } from '../api'
import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { isObjectRecord } from '../utils/json-validators'
import { safeNumberFieldProps } from '../utils/numeric-field'
import { AmountDiscountVisualEditor } from './amount-discount-visual-editor'
import { AmountOptionsVisualEditor } from './amount-options-visual-editor'
import {
  formatJsonForEditor,
  getJsonError,
  normalizeJsonForComparison,
  removeTrailingSlash,
} from './utils'

function isHttpOriginUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return true

  try {
    const url = new URL(trimmed)
    const isHttpProtocol = url.protocol === 'http:' || url.protocol === 'https:'
    const hasNoPath = url.pathname === '' || url.pathname === '/'
    return isHttpProtocol && hasNoPath && !url.search && !url.hash
  } catch {
    return false
  }
}

// 最低充值金额在后端以整数元存储（strconv.Atoi），小数会被静默丢弃，
// 因此这里只接受整数，0 表示继承全局设置。
const minTopUpAmount = z.coerce
  .number()
  .int('Amount must be a whole number')
  .min(0)

const paymentSchema = z.object({
  MinTopUp: minTopUpAmount,
  CustomCallbackAddress: z
    .string()
    .refine(
      isHttpOriginUrl,
      'Enter only a top-level callback domain, for example https://api.example.com, without any path.'
    ),
  AmountOptions: z.string().superRefine((value, ctx) => {
    const error = getJsonError(value, (parsed) => Array.isArray(parsed))
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      })
    }
  }),
  AmountDiscount: z.string().superRefine((value, ctx) => {
    const error = getJsonError(value, (parsed) => {
      if (!isObjectRecord(parsed)) return false
      return Object.entries(parsed).every(([amount, rate]) => {
        const parsedAmount = Number(amount)
        return (
          Number.isInteger(parsedAmount) &&
          parsedAmount > 0 &&
          typeof rate === 'number' &&
          rate > 0 &&
          rate <= 1
        )
      })
    })
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error === 'JSON structure is invalid'
            ? 'Discounts must be a JSON object keyed by recharge amount with rates greater than 0 and at most 1, for example {"100": 0.9}'
            : error,
      })
    }
  }),
  WechatAppId: z.string(),
  WechatMchId: z.string(),
  WechatMchSerialNo: z.string(),
  WechatApiV3Key: z.string(),
  WechatMchPrivateKey: z.string(),
  WechatMinTopUp: minTopUpAmount,
  WechatOrderExpireMinutes: z.coerce.number().min(1),
  AlipayAppId: z.string(),
  AlipayPrivateKey: z.string(),
  AlipayPublicKey: z.string(),
  AlipaySandbox: z.boolean(),
  AlipayMinTopUp: minTopUpAmount,
  AlipayOrderExpireMinutes: z.coerce.number().min(1),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

const CURRENT_COMPLIANCE_TERMS_VERSION = 'v1'
const paymentTabContentClassName = 'mt-6 min-w-0'

// 网关类型与配置项键名到 i18n 文案的映射：后端只返回键名，文案统一由前端翻译。
const GATEWAY_NAME_KEYS: Record<string, string> = {
  wechat: 'WeChat Pay',
  alipay: 'Alipay',
}

const GATEWAY_CREDENTIAL_KEYS: Record<string, string> = {
  WechatAppId: 'WeChat Pay App ID',
  WechatMchId: 'WeChat Pay merchant ID',
  WechatMchSerialNo: 'Merchant API certificate serial number',
  WechatApiV3Key: 'APIv3 key',
  WechatMchPrivateKey: 'Merchant API certificate private key',
  AlipayAppId: 'Alipay App ID',
  AlipayPrivateKey: 'Application private key',
  AlipayPublicKey: 'Alipay public key',
}

type PaymentComplianceDefaults = {
  confirmed: boolean
  termsVersion: string
  confirmedAt: number
  confirmedBy: number
}

type PaymentSettingsSectionProps = {
  defaultValues: PaymentFormValues
  complianceDefaults: PaymentComplianceDefaults
}

type EditorModeToggleProps = {
  visualMode: boolean
  onToggle: () => void
}

function EditorModeToggle(props: EditorModeToggleProps) {
  const { t } = useTranslation()

  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      onClick={props.onToggle}
      className='text-muted-foreground shrink-0'
    >
      {props.visualMode ? (
        <>
          <Code2 className='h-3.5 w-3.5' />
          {t('JSON Editor')}
        </>
      ) : (
        <>
          <Eye className='h-3.5 w-3.5' />
          {t('Visual Editor')}
        </>
      )}
    </Button>
  )
}

export function PaymentSettingsSection({
  defaultValues,
  complianceDefaults,
}: PaymentSettingsSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const updateOption = useUpdateOption()
  const gatewayStatusQuery = useQuery({
    queryKey: ['payment-gateway-status'],
    queryFn: getPaymentGatewayStatus,
  })
  const gatewayStatus = gatewayStatusQuery.data?.data
  const initialFormValues = React.useMemo<PaymentFormValues>(
    () => ({ ...defaultValues }),
    [defaultValues]
  )
  const initialRef = React.useRef(initialFormValues)
  const defaultsSignature = React.useMemo(
    () => JSON.stringify(initialFormValues),
    [initialFormValues]
  )

  const [amountOptionsVisualMode, setAmountOptionsVisualMode] =
    React.useState(true)
  const [amountDiscountVisualMode, setAmountDiscountVisualMode] =
    React.useState(true)
  const [showComplianceDialog, setShowComplianceDialog] = React.useState(false)

  const complianceStatements = React.useMemo(
    () => [
      t(
        'You have legally obtained authorization for the connected model APIs, accounts, keys, and quotas.'
      ),
      t(
        'You commit to using upstream APIs, accounts, keys, quotas, and service capabilities only within the scope of lawful authorization obtained from upstream service providers, model service providers, or relevant rights holders, and will not conduct unauthorized resale, trafficking, distribution, or other non-compliant commercialization.'
      ),
      t(
        'If you provide generative AI services to the public in mainland China, you will fulfill legal obligations including filing, security assessment, content safety, complaint handling, generated content labeling, log retention, and personal information protection.'
      ),
      t(
        'You commit not to use this system to implement, assist with, or indirectly implement acts that violate applicable laws and regulations, regulatory requirements, platform rules, public interests, or the lawful rights and interests of third parties.'
      ),
      t(
        'You understand and independently bear legal responsibility arising from deployment, operation, and charging behavior.'
      ),
      t(
        'You understand this compliance reminder is only for risk notice and does not constitute legal advice, a compliance review conclusion, or a guarantee of the legality of your use of this system; you should consult professional legal or compliance advisors based on your actual business scenario.'
      ),
    ],
    [t]
  )

  const complianceRequiredText = t(
    'I have read and understood the above compliance reminder, acknowledge the related legal risks, and confirm that I bear legal responsibility arising from deployment, operation, and charging behavior.'
  )
  const complianceRequiredTextParts = React.useMemo(
    () => [
      {
        type: 'input' as const,
        text: t('I have read and understood the above compliance reminder'),
      },
      { type: 'static' as const, text: t('，') },
      {
        type: 'input' as const,
        text: t('acknowledge the related legal risks'),
      },
      { type: 'static' as const, text: t('，and ') },
      {
        type: 'input' as const,
        text: t(
          'confirm that I bear legal responsibility arising from deployment'
        ),
      },
      { type: 'static' as const, text: t('、') },
      {
        type: 'input' as const,
        text: t('operation and charging behavior'),
      },
    ],
    [t]
  )

  const complianceConfirmed =
    complianceDefaults.confirmed &&
    complianceDefaults.termsVersion === CURRENT_COMPLIANCE_TERMS_VERSION

  const confirmComplianceMutation = useMutation({
    mutationFn: confirmPaymentCompliance,
    onSuccess: (data) => {
      if (data.success) {
        toast.success(t('Compliance confirmed successfully'))
        setShowComplianceDialog(false)
        queryClient.invalidateQueries({ queryKey: ['system-options'] })
        queryClient.invalidateQueries({ queryKey: ['payment-gateway-status'] })
      } else {
        toast.error(data.message || t('Failed to confirm compliance'))
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to confirm compliance'))
    },
  })

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema) as Resolver<PaymentFormValues>,
    mode: 'onChange', // Enable real-time validation
    defaultValues: {
      ...initialFormValues,
      AmountOptions: formatJsonForEditor(initialFormValues.AmountOptions),
      AmountDiscount: formatJsonForEditor(initialFormValues.AmountDiscount),
    },
  })

  const { isSubmitting } = form.formState

  React.useEffect(() => {
    const parsedDefaults = JSON.parse(defaultsSignature) as PaymentFormValues
    initialRef.current = parsedDefaults
    form.reset({
      ...parsedDefaults,
      AmountOptions: formatJsonForEditor(parsedDefaults.AmountOptions),
      AmountDiscount: formatJsonForEditor(parsedDefaults.AmountDiscount),
    })
  }, [defaultsSignature, form])

  const onSubmit = async (values: PaymentFormValues) => {
    const sanitized = {
      MinTopUp: values.MinTopUp,
      CustomCallbackAddress: removeTrailingSlash(values.CustomCallbackAddress),
      AmountOptions: values.AmountOptions.trim(),
      AmountDiscount: values.AmountDiscount.trim(),
      WechatAppId: values.WechatAppId.trim(),
      WechatMchId: values.WechatMchId.trim(),
      WechatMchSerialNo: values.WechatMchSerialNo.trim(),
      WechatApiV3Key: values.WechatApiV3Key.trim(),
      WechatMchPrivateKey: values.WechatMchPrivateKey.trim(),
      WechatMinTopUp: values.WechatMinTopUp,
      WechatOrderExpireMinutes: values.WechatOrderExpireMinutes,
      AlipayAppId: values.AlipayAppId.trim(),
      AlipayPrivateKey: values.AlipayPrivateKey.trim(),
      AlipayPublicKey: values.AlipayPublicKey.trim(),
      AlipaySandbox: values.AlipaySandbox,
      AlipayMinTopUp: values.AlipayMinTopUp,
      AlipayOrderExpireMinutes: values.AlipayOrderExpireMinutes,
    }

    const initial = {
      MinTopUp: initialRef.current.MinTopUp,
      CustomCallbackAddress: removeTrailingSlash(
        initialRef.current.CustomCallbackAddress
      ),
      AmountOptions: initialRef.current.AmountOptions.trim(),
      AmountDiscount: initialRef.current.AmountDiscount.trim(),
      WechatAppId: initialRef.current.WechatAppId.trim(),
      WechatMchId: initialRef.current.WechatMchId.trim(),
      WechatMchSerialNo: initialRef.current.WechatMchSerialNo.trim(),
      WechatApiV3Key: initialRef.current.WechatApiV3Key.trim(),
      WechatMchPrivateKey: initialRef.current.WechatMchPrivateKey.trim(),
      WechatMinTopUp: initialRef.current.WechatMinTopUp,
      WechatOrderExpireMinutes: initialRef.current.WechatOrderExpireMinutes,
      AlipayAppId: initialRef.current.AlipayAppId.trim(),
      AlipayPrivateKey: initialRef.current.AlipayPrivateKey.trim(),
      AlipayPublicKey: initialRef.current.AlipayPublicKey.trim(),
      AlipaySandbox: initialRef.current.AlipaySandbox,
      AlipayMinTopUp: initialRef.current.AlipayMinTopUp,
      AlipayOrderExpireMinutes: initialRef.current.AlipayOrderExpireMinutes,
    }

    const updates: Array<{ key: string; value: string | number | boolean }> = []

    if (sanitized.MinTopUp !== initial.MinTopUp) {
      updates.push({ key: 'MinTopUp', value: sanitized.MinTopUp })
    }

    if (sanitized.CustomCallbackAddress !== initial.CustomCallbackAddress) {
      updates.push({
        key: 'CustomCallbackAddress',
        value: sanitized.CustomCallbackAddress,
      })
    }

    if (
      normalizeJsonForComparison(sanitized.AmountOptions) !==
      normalizeJsonForComparison(initial.AmountOptions)
    ) {
      updates.push({
        key: 'payment_setting.amount_options',
        value: sanitized.AmountOptions,
      })
    }

    if (
      normalizeJsonForComparison(sanitized.AmountDiscount) !==
      normalizeJsonForComparison(initial.AmountDiscount)
    ) {
      updates.push({
        key: 'payment_setting.amount_discount',
        value: sanitized.AmountDiscount,
      })
    }

    if (sanitized.WechatAppId !== initial.WechatAppId) {
      updates.push({ key: 'WechatAppId', value: sanitized.WechatAppId })
    }

    if (sanitized.WechatMchId !== initial.WechatMchId) {
      updates.push({ key: 'WechatMchId', value: sanitized.WechatMchId })
    }

    if (sanitized.WechatMchSerialNo !== initial.WechatMchSerialNo) {
      updates.push({
        key: 'WechatMchSerialNo',
        value: sanitized.WechatMchSerialNo,
      })
    }

    // 密钥类字段与 EpayKey 一致：仅当输入了新值才提交，避免空值覆盖已存密钥
    if (
      sanitized.WechatApiV3Key &&
      sanitized.WechatApiV3Key !== initial.WechatApiV3Key
    ) {
      updates.push({ key: 'WechatApiV3Key', value: sanitized.WechatApiV3Key })
    }

    if (
      sanitized.WechatMchPrivateKey &&
      sanitized.WechatMchPrivateKey !== initial.WechatMchPrivateKey
    ) {
      updates.push({
        key: 'WechatMchPrivateKey',
        value: sanitized.WechatMchPrivateKey,
      })
    }

    if (sanitized.WechatMinTopUp !== initial.WechatMinTopUp) {
      updates.push({ key: 'WechatMinTopUp', value: sanitized.WechatMinTopUp })
    }

    if (
      sanitized.WechatOrderExpireMinutes !== initial.WechatOrderExpireMinutes
    ) {
      updates.push({
        key: 'WechatOrderExpireMinutes',
        value: sanitized.WechatOrderExpireMinutes,
      })
    }

    if (sanitized.AlipayAppId !== initial.AlipayAppId) {
      updates.push({ key: 'AlipayAppId', value: sanitized.AlipayAppId })
    }

    if (
      sanitized.AlipayPrivateKey &&
      sanitized.AlipayPrivateKey !== initial.AlipayPrivateKey
    ) {
      updates.push({
        key: 'AlipayPrivateKey',
        value: sanitized.AlipayPrivateKey,
      })
    }

    if (
      sanitized.AlipayPublicKey &&
      sanitized.AlipayPublicKey !== initial.AlipayPublicKey
    ) {
      updates.push({ key: 'AlipayPublicKey', value: sanitized.AlipayPublicKey })
    }

    if (sanitized.AlipaySandbox !== initial.AlipaySandbox) {
      updates.push({ key: 'AlipaySandbox', value: sanitized.AlipaySandbox })
    }

    if (sanitized.AlipayMinTopUp !== initial.AlipayMinTopUp) {
      updates.push({ key: 'AlipayMinTopUp', value: sanitized.AlipayMinTopUp })
    }

    if (
      sanitized.AlipayOrderExpireMinutes !== initial.AlipayOrderExpireMinutes
    ) {
      updates.push({
        key: 'AlipayOrderExpireMinutes',
        value: sanitized.AlipayOrderExpireMinutes,
      })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    // 保存后重新拉取网关状态，让「未启用 / 缺失项」提示立即反映新配置。
    queryClient.invalidateQueries({ queryKey: ['payment-gateway-status'] })
  }

  return (
    <SettingsSection title={t('Payment Gateway')}>
      {!complianceConfirmed ? (
        <Alert variant='destructive' className='mb-6'>
          <ShieldAlert className='h-4 w-4' />
          <AlertTitle>{t('Compliance confirmation required')}</AlertTitle>
          <AlertDescription>
            <div className='space-y-3'>
              <p>
                {t(
                  'Payment, redemption codes, subscription plans, and invitation rewards are locked until the root administrator confirms the compliance terms.'
                )}
              </p>
              <ol className='list-decimal space-y-1 pl-5'>
                {complianceStatements.map((statement) => (
                  <li key={statement}>{statement}</li>
                ))}
              </ol>
            </div>
          </AlertDescription>
          <AlertAction>
            <Button
              type='button'
              size='sm'
              variant='destructive'
              onClick={() => setShowComplianceDialog(true)}
            >
              {t('Confirm compliance')}
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <Alert className='mb-6'>
          <AlertTitle>{t('Compliance confirmed')}</AlertTitle>
          <AlertDescription>
            {t('Confirmed at {{time}} by user #{{userId}}', {
              time: complianceDefaults.confirmedAt
                ? new Date(
                    complianceDefaults.confirmedAt * 1000
                  ).toLocaleString()
                : '-',
              userId: complianceDefaults.confirmedBy || '-',
            })}
          </AlertDescription>
        </Alert>
      )}

      {gatewayStatus ? (
        <div className='mb-6 space-y-3'>
          <div className='space-y-1'>
            <h3 className='text-sm font-semibold'>{t('Gateway status')}</h3>
            <p className='text-muted-foreground text-xs'>
              {t('Only fully configured gateways are available to users.')}
            </p>
          </div>
          <div className='grid gap-3 md:grid-cols-2'>
            {gatewayStatus.gateways.map((gateway) => {
              const missingLabels = gateway.missing.map((key) =>
                t(GATEWAY_CREDENTIAL_KEYS[key] ?? key)
              )
              return (
                <div
                  key={gateway.type}
                  className='border-border/60 bg-muted/20 rounded-lg border p-3'
                >
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-sm font-medium'>
                      {t(GATEWAY_NAME_KEYS[gateway.type] ?? gateway.type)}
                    </span>
                    <Badge variant={gateway.enabled ? 'default' : 'secondary'}>
                      {gateway.enabled ? t('Enabled') : t('Disabled')}
                    </Badge>
                  </div>
                  {!gateway.enabled && missingLabels.length > 0 ? (
                    <p className='text-muted-foreground mt-1.5 text-xs'>
                      {t('Missing configuration: {{fields}}', {
                        fields: missingLabels.join(', '),
                      })}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <RiskAcknowledgementDialog
        open={showComplianceDialog}
        onOpenChange={setShowComplianceDialog}
        title={t('Confirm compliance terms')}
        description={t(
          'This confirmation unlocks payment, redemption code, subscription plan, and invitation reward features. Please read the statements carefully.'
        )}
        items={complianceStatements}
        requiredText={complianceRequiredText}
        requiredTextParts={complianceRequiredTextParts}
        inputPrompt={t('Please type the following text to confirm:')}
        inputPlaceholder={t('Type the confirmation text here')}
        mismatchHint={t('The entered text does not match the required text.')}
        confirmText={t('Confirm and enable')}
        isLoading={confirmComplianceMutation.isPending}
        onConfirm={() => confirmComplianceMutation.mutate()}
      />

      <Form {...form}>
        <SettingsForm
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            'gap-y-8',
            !complianceConfirmed && 'pointer-events-none opacity-40'
          )}
          data-no-autosubmit='true'
        >
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            saveLabel='Save all settings'
          />
          <Tabs defaultValue='general' className='min-w-0'>
            <div className='overflow-x-auto pb-1'>
              <TabsList className='grid min-w-80 grid-cols-3'>
                <TabsTrigger value='general'>{t('General')}</TabsTrigger>
                <TabsTrigger value='wechat'>WeChat Pay</TabsTrigger>
                <TabsTrigger value='alipay'>Alipay</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value='general' className={paymentTabContentClassName}>
              <div className='space-y-4'>
                <div className='space-y-1'>
                  <h3 className='text-base font-semibold'>
                    {t('General Settings')}
                  </h3>
                  <p className='text-muted-foreground text-sm'>
                    {t('Shared configuration for all payment gateways')}
                  </p>
                </div>

                <div className='grid gap-4 lg:grid-cols-2 lg:items-start'>
                  <FormField
                    control={form.control}
                    name='MinTopUp'
                    render={({ field }) => (
                      <FormItem className='rounded-xl border p-4'>
                        <FormLabel>{t('Minimum top-up (CNY)')}</FormLabel>
                        <FormDescription>
                          {t('Smallest amount users can recharge')}
                        </FormDescription>
                        <FormControl>
                          <div className='relative max-w-48'>
                            <span
                              aria-hidden='true'
                              className='text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex w-8 items-center justify-center text-sm'
                            >
                              ¥
                            </span>
                            <Input
                              type='number'
                              step='1'
                              min={0}
                              className='pl-8'
                              {...safeNumberFieldProps(field)}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='AmountOptions'
                    render={({ field }) => (
                      <FormItem className='rounded-xl border p-4'>
                        <div className='flex items-center justify-between gap-2'>
                          <FormLabel>{t('Top-up amount options')}</FormLabel>
                          <EditorModeToggle
                            visualMode={amountOptionsVisualMode}
                            onToggle={() =>
                              setAmountOptionsVisualMode(
                                !amountOptionsVisualMode
                              )
                            }
                          />
                        </div>
                        <FormDescription>
                          {amountOptionsVisualMode
                            ? t('Preset recharge amounts displayed to users')
                            : t('Preset recharge amounts (JSON array)')}
                        </FormDescription>
                        <FormControl>
                          {amountOptionsVisualMode ? (
                            <AmountOptionsVisualEditor
                              value={field.value}
                              onChange={field.onChange}
                            />
                          ) : (
                            <JsonCodeEditor
                              value={field.value}
                              onChange={field.onChange}
                              name={field.name}
                              onBlur={field.onBlur}
                              textareaRef={field.ref}
                              placeholder='[10, 20, 50, 100]'
                              heightClassName='h-40 min-h-40 max-h-40'
                              aria-invalid={Boolean(
                                form.formState.errors.AmountOptions
                              )}
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name='AmountDiscount'
                  render={({ field }) => (
                    <FormItem className='gap-0 overflow-hidden rounded-xl border'>
                      <div className='flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='space-y-1'>
                          <FormLabel>{t('Amount discount')}</FormLabel>
                          <FormDescription>
                            {amountDiscountVisualMode
                              ? t(
                                  'Discount rate is the payable ratio: 0.9 means users pay 90% of the recharge amount.'
                                )
                              : t(
                                  'Recharge amounts matching a tier are charged at the configured rate; credited quota is unchanged.'
                                )}
                          </FormDescription>
                        </div>
                        <EditorModeToggle
                          visualMode={amountDiscountVisualMode}
                          onToggle={() =>
                            setAmountDiscountVisualMode(
                              !amountDiscountVisualMode
                            )
                          }
                        />
                      </div>
                      <div className='space-y-3 p-4'>
                        <FormControl>
                          {amountDiscountVisualMode ? (
                            <AmountDiscountVisualEditor
                              value={field.value}
                              onChange={field.onChange}
                            />
                          ) : (
                            <JsonCodeEditor
                              value={field.value}
                              onChange={field.onChange}
                              name={field.name}
                              onBlur={field.onBlur}
                              textareaRef={field.ref}
                              placeholder='{"100": 0.9}'
                              heightClassName='h-40 min-h-40 max-h-40'
                              aria-invalid={Boolean(
                                form.formState.errors.AmountDiscount
                              )}
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            <TabsContent value='wechat' className={paymentTabContentClassName}>
              <div className='space-y-6'>
                <div className='space-y-1'>
                  <h3 className='text-base font-semibold'>
                    {t('WeChat Pay Gateway')}
                  </h3>
                  <p className='text-muted-foreground text-sm'>
                    {t(
                      'Configuration for WeChat Pay official direct integration (APIv3, Native QR-code payment)'
                    )}
                  </p>
                </div>

                <Alert>
                  <ShieldAlert className='h-4 w-4' />
                  <AlertTitle>{t('WeChat Pay safety reminder')}</AlertTitle>
                  <AlertDescription>
                    {t(
                      'Use your own WeChat Pay merchant account. The APIv3 key and merchant private key are sensitive credentials; never share them, and rotate them immediately if leaked.'
                    )}
                  </AlertDescription>
                </Alert>

                <div className='grid gap-6 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='WechatAppId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('WeChat Pay App ID')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='wx1234567890abcdef'
                            autoComplete='off'
                            {...field}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'App ID bound to your WeChat Pay merchant account (or the service provider APPID)'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='WechatMchId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('WeChat Pay merchant ID')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='1600000000'
                            autoComplete='off'
                            {...field}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          {t('Merchant ID (MchID) of your WeChat Pay account')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='WechatMchSerialNo'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('Merchant API certificate serial number')}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('e.g., 3F1A2B...')}
                            autoComplete='off'
                            {...field}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'Serial number of the merchant API certificate used for request signing'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='WechatApiV3Key'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('APIv3 key')}</FormLabel>
                        <FormControl>
                          <Input
                            type='password'
                            placeholder={t('Enter new key to update')}
                            autoComplete='new-password'
                            {...field}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'APIv3 key set in the merchant platform; also used to decrypt payment callbacks. Leave blank unless rotating.'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name='WechatMchPrivateKey'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('Merchant API certificate private key')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('Enter new key to update')}
                          autoComplete='new-password'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Contents of apiclient_key.pem downloaded with your merchant API certificate. Leave blank unless rotating.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className='grid gap-6 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='WechatMinTopUp'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('Minimum top-up (CNY) for WeChat Pay')}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            step='1'
                            min={0}
                            {...safeNumberFieldProps(field)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='WechatOrderExpireMinutes'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Order validity (minutes)')}</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            step='1'
                            min={1}
                            {...safeNumberFieldProps(field)}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'How long the QR code stays payable; unpaid orders are closed after this'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Alert>
                  <Info className='h-4 w-4' />
                  <AlertTitle>{t('Payment notify URL')}</AlertTitle>
                  <AlertDescription>
                    {t(
                      'Set the payment notify URL in the WeChat Pay merchant platform to: your callback address (General settings) or server address, plus /api/user/wechat/notify'
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            <TabsContent value='alipay' className={paymentTabContentClassName}>
              <div className='space-y-6'>
                <div className='space-y-1'>
                  <h3 className='text-base font-semibold'>
                    {t('Alipay Gateway')}
                  </h3>
                  <p className='text-muted-foreground text-sm'>
                    {t(
                      'Configuration for Alipay Website Payment (RSA2). Requires the Website Payment product; customers scan the QR code at the Alipay cashier.'
                    )}
                  </p>
                </div>

                <Alert>
                  <ShieldAlert className='h-4 w-4' />
                  <AlertTitle>{t('Alipay safety reminder')}</AlertTitle>
                  <AlertDescription>
                    {t(
                      'Use your own Alipay application. The application private key and Alipay public key are sensitive credentials; never share them, and rotate them immediately if leaked.'
                    )}
                  </AlertDescription>
                </Alert>

                <div className='grid gap-6 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='AlipayAppId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Alipay App ID')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='2021000123456789'
                            autoComplete='off'
                            {...field}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          {t('APPID of your Alipay open platform application')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='AlipaySandbox'
                    render={({ field }) => (
                      <FormItem>
                        <div className='flex items-center justify-between gap-4'>
                          <div>
                            <FormLabel>{t('Sandbox mode')}</FormLabel>
                            <FormDescription>
                              {t(
                                'Route requests to the Alipay sandbox gateway for testing'
                              )}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='AlipayMinTopUp'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('Minimum top-up (CNY) for Alipay')}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            step='1'
                            min={0}
                            {...safeNumberFieldProps(field)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='AlipayOrderExpireMinutes'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Order validity (minutes)')}</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            step='1'
                            min={1}
                            {...safeNumberFieldProps(field)}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'How long the QR code stays payable; unpaid orders are closed after this'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name='AlipayPrivateKey'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Application private key')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('Enter new key to update')}
                          autoComplete='new-password'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'RSA2 private key generated for your application (without the BEGIN/END lines is also accepted). Leave blank unless rotating.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='AlipayPublicKey'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Alipay public key')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('Enter new key to update')}
                          autoComplete='new-password'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Alipay public key (not the application public key) from the open platform, used to verify callbacks. Leave blank unless rotating.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert>
                  <Info className='h-4 w-4' />
                  <AlertTitle>{t('Payment notify URL')}</AlertTitle>
                  <AlertDescription>
                    {t(
                      'The server sends the notify URL with every order: your callback address (General settings) or server address, plus /api/user/alipay/notify. This public URL must accept Alipay POST requests without login so paid orders can be credited automatically.'
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </Tabs>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
