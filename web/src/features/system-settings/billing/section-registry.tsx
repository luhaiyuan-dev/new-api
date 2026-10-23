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

import { CheckinSettingsSection } from '../general/checkin-settings-section'
import { PricingSection } from '../general/pricing-section'
import { QuotaSettingsSection } from '../general/quota-settings-section'
import { PaymentSettingsSection } from '../integrations/payment-settings-section'
import { RatioSettingsCard } from '../models/ratio-settings-card'
import type { BillingSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'

const getModelDefaults = (settings: BillingSettings) => ({
  ModelPrice: settings.ModelPrice,
  ModelRatio: settings.ModelRatio,
  CacheRatio: settings.CacheRatio,
  CreateCacheRatio: settings.CreateCacheRatio,
  CompletionRatio: settings.CompletionRatio,
  ImageRatio: settings.ImageRatio,
  AudioRatio: settings.AudioRatio,
  AudioCompletionRatio: settings.AudioCompletionRatio,
  ExposeRatioEnabled: settings.ExposeRatioEnabled,
  BillingMode: settings['billing_setting.billing_mode'],
  BillingExpr: settings['billing_setting.billing_expr'],
  MediaModels: settings['media_billing_setting.models'],
  MediaEnabled: settings['media_billing_setting.enabled'],
  MediaPolicy: settings['media_billing_setting.unknown_tier_policy'],
})

const getGroupDefaults = (settings: BillingSettings) => ({
  GroupRatio: settings.GroupRatio,
  UserUsableGroups: settings.UserUsableGroups,
  GroupGroupRatio: settings.GroupGroupRatio,
  AutoGroups: settings.AutoGroups,
  MaxTokenAutoGroups: settings.MaxTokenAutoGroups,
  DefaultUseAutoGroup: settings.DefaultUseAutoGroup,
  GroupSpecialUsableGroup:
    settings['group_ratio_setting.group_special_usable_group'],
})

const BILLING_SECTIONS = [
  {
    id: 'quota',
    titleKey: 'Quota Settings',
    build: (settings: BillingSettings) => (
      <QuotaSettingsSection
        defaultValues={{
          QuotaForNewUser: settings.QuotaForNewUser,
          PreConsumedQuota: settings.PreConsumedQuota,
          QuotaForInviter: settings.QuotaForInviter,
          QuotaForInvitee: settings.QuotaForInvitee,
          TopUpLink: settings.TopUpLink,
          general_setting: {
            docs_link: settings['general_setting.docs_link'],
          },
          quota_setting: {
            enable_free_model_pre_consume:
              settings['quota_setting.enable_free_model_pre_consume'],
          },
        }}
        complianceConfirmed={
          (settings['payment_setting.compliance_confirmed'] ?? false) &&
          settings['payment_setting.compliance_terms_version'] === 'v1'
        }
      />
    ),
  },
  {
    id: 'currency',
    titleKey: 'Currency & Display',
    build: (settings: BillingSettings) => (
      <PricingSection
        defaultValues={{
          QuotaPerUnit: settings.QuotaPerUnit,
          DisplayTokenStatEnabled: settings.DisplayTokenStatEnabled,
        }}
      />
    ),
  },
  {
    id: 'model-pricing',
    titleKey: 'Model Pricing',
    build: (settings: BillingSettings) => (
      <RatioSettingsCard
        titleKey='Model Pricing'
        modelDefaults={getModelDefaults(settings)}
        groupDefaults={getGroupDefaults(settings)}
        toolPricesDefault={settings['tool_price_setting.prices']}
        visibleTabs={['models', 'unset-models', 'tool-prices', 'upstream-sync']}
      />
    ),
  },
  {
    id: 'group-pricing',
    titleKey: 'Group Pricing',
    build: (settings: BillingSettings) => (
      <RatioSettingsCard
        titleKey='Group Pricing'
        modelDefaults={getModelDefaults(settings)}
        groupDefaults={getGroupDefaults(settings)}
        toolPricesDefault={settings['tool_price_setting.prices']}
        visibleTabs={['groups']}
      />
    ),
  },
  {
    id: 'payment',
    titleKey: 'Payment Gateway',
    build: (settings: BillingSettings) => (
      <PaymentSettingsSection
        defaultValues={{
          MinTopUp: settings.MinTopUp,
          CustomCallbackAddress: settings.CustomCallbackAddress,
          AmountOptions: settings['payment_setting.amount_options'],
          AmountDiscount: settings['payment_setting.amount_discount'] ?? '',
          WechatAppId: settings.WechatAppId ?? '',
          WechatMchId: settings.WechatMchId ?? '',
          WechatMchSerialNo: settings.WechatMchSerialNo ?? '',
          WechatApiV3Key: settings.WechatApiV3Key ?? '',
          WechatMchPrivateKey: settings.WechatMchPrivateKey ?? '',
          WechatMinTopUp: settings.WechatMinTopUp ?? 1,
          WechatOrderExpireMinutes: settings.WechatOrderExpireMinutes ?? 30,
          AlipayAppId: settings.AlipayAppId ?? '',
          AlipayPrivateKey: settings.AlipayPrivateKey ?? '',
          AlipayPublicKey: settings.AlipayPublicKey ?? '',
          AlipaySandbox: settings.AlipaySandbox ?? false,
          AlipayMinTopUp: settings.AlipayMinTopUp ?? 1,
          AlipayOrderExpireMinutes: settings.AlipayOrderExpireMinutes ?? 30,
        }}
        complianceDefaults={{
          confirmed: settings['payment_setting.compliance_confirmed'] ?? false,
          termsVersion:
            settings['payment_setting.compliance_terms_version'] ?? '',
          confirmedAt: settings['payment_setting.compliance_confirmed_at'] ?? 0,
          confirmedBy: settings['payment_setting.compliance_confirmed_by'] ?? 0,
        }}
      />
    ),
  },
  {
    id: 'checkin',
    titleKey: 'Check-in Rewards',
    build: (settings: BillingSettings) => (
      <CheckinSettingsSection
        defaultValues={{
          enabled: settings['checkin_setting.enabled'],
          minQuota: settings['checkin_setting.min_quota'],
          maxQuota: settings['checkin_setting.max_quota'],
        }}
      />
    ),
  },
] as const

export type BillingSectionId = (typeof BILLING_SECTIONS)[number]['id']

const billingRegistry = createSectionRegistry<
  BillingSectionId,
  BillingSettings
>({
  sections: BILLING_SECTIONS,
  defaultSection: 'quota',
  basePath: '/system-settings/billing',
  urlStyle: 'path',
})

export const BILLING_SECTION_IDS = billingRegistry.sectionIds
export const BILLING_DEFAULT_SECTION = billingRegistry.defaultSection
export const getBillingSectionNavItems = billingRegistry.getSectionNavItems
export const getBillingSectionContent = billingRegistry.getSectionContent
export const getBillingSectionMeta = billingRegistry.getSectionMeta
