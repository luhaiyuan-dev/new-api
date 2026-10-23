package service

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// GetCallbackAddress 返回支付网关异步通知地址的前缀，供微信支付与支付宝的
// notify URL 拼接使用。管理员配置了自定义回调地址时优先使用自定义值。
func GetCallbackAddress() string {
	if operation_setting.CustomCallbackAddress == "" {
		return system_setting.ServerAddress
	}
	return operation_setting.CustomCallbackAddress
}
