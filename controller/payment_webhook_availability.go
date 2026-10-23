package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// nativePayCredential 描述扫码支付渠道的一项必填凭证。
// Key 与 /api/option 的配置键保持一致，管理端据此定位并提示缺失项。
type nativePayCredential struct {
	Key   string
	Value func() string
}

// wechatCredentials 返回微信支付直连所需的全部凭证，顺序即管理端提示顺序。
func wechatCredentials() []nativePayCredential {
	return []nativePayCredential{
		{Key: "WechatAppId", Value: func() string { return setting.WechatAppId }},
		{Key: "WechatMchId", Value: func() string { return setting.WechatMchId }},
		{Key: "WechatMchSerialNo", Value: func() string { return setting.WechatMchSerialNo }},
		{Key: "WechatApiV3Key", Value: func() string { return setting.WechatApiV3Key }},
		{Key: "WechatMchPrivateKey", Value: func() string { return setting.WechatMchPrivateKey }},
	}
}

// alipayCredentials 返回支付宝直连所需的全部凭证，顺序即管理端提示顺序。
func alipayCredentials() []nativePayCredential {
	return []nativePayCredential{
		{Key: "AlipayAppId", Value: func() string { return setting.AlipayAppId }},
		{Key: "AlipayPrivateKey", Value: func() string { return setting.AlipayPrivateKey }},
		{Key: "AlipayPublicKey", Value: func() string { return setting.AlipayPublicKey }},
	}
}

// missingNativePayCredentials 返回尚未配置（含仅含空白字符）的凭证键名。
func missingNativePayCredentials(credentials []nativePayCredential) []string {
	missing := make([]string, 0, len(credentials))
	for _, credential := range credentials {
		if strings.TrimSpace(credential.Value()) == "" {
			missing = append(missing, credential.Key)
		}
	}
	return missing
}

func isPaymentComplianceConfirmed() bool {
	return operation_setting.IsPaymentComplianceConfirmed()
}

func isWechatTopUpEnabled() bool {
	return isPaymentComplianceConfirmed() && len(missingNativePayCredentials(wechatCredentials())) == 0
}

func isWechatWebhookConfigured() bool {
	return isWechatTopUpEnabled()
}

func isWechatWebhookEnabled() bool {
	return isWechatTopUpEnabled()
}

func isAlipayTopUpEnabled() bool {
	return isPaymentComplianceConfirmed() && len(missingNativePayCredentials(alipayCredentials())) == 0
}

func isAlipayWebhookConfigured() bool {
	return isAlipayTopUpEnabled()
}

func isAlipayWebhookEnabled() bool {
	return isAlipayTopUpEnabled()
}
