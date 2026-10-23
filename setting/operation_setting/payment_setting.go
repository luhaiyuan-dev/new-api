package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PaymentSetting struct {
	AmountOptions []int `json:"amount_options"`

	// AmountDiscount 充值金额对应的实付折扣，例如 {100: 0.9} 表示充值 100 元
	// 只需支付 90 元；到账额度仍按充值金额计算。缺省或非法值按 1 处理。
	AmountDiscount map[int]float64 `json:"amount_discount"`

	ComplianceConfirmed    bool   `json:"compliance_confirmed"`
	ComplianceTermsVersion string `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64  `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int    `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string `json:"compliance_confirmed_ip"`
}

const CurrentComplianceTermsVersion = "v1"

// CustomCallbackAddress 覆盖支付回调地址前缀，留空时回落到系统对外地址。
// 微信支付与支付宝的异步通知 URL 都以它为基础拼接。
var CustomCallbackAddress = ""

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}

func IsPaymentComplianceConfirmed() bool {
	return paymentSetting.ComplianceConfirmed &&
		paymentSetting.ComplianceTermsVersion == CurrentComplianceTermsVersion
}
