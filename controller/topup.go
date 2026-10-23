package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// nativePayGateway 描述一个扫码支付直连渠道在支付方式列表中的展示信息。
type nativePayGateway struct {
	methodType string
	name       string
	color      string
	minTopup   int
	enabled    bool
	// missing 记录尚未配置的必填凭证键名，仅用于管理端诊断，
	// 解释「为什么用户端看不到这个支付方式」。
	missing []string
}

// nativePayGateways 返回站点支持的扫码支付直连渠道，顺序与前端展示顺序一致。
func nativePayGateways() []nativePayGateway {
	return []nativePayGateway{
		{
			methodType: model.PaymentMethodWechat,
			name:       "微信支付",
			color:      "#07C160",
			minTopup:   setting.WechatMinTopUp,
			enabled:    isWechatTopUpEnabled(),
			missing:    missingNativePayCredentials(wechatCredentials()),
		},
		{
			methodType: model.PaymentMethodAlipay,
			name:       "支付宝",
			color:      "#1677FF",
			minTopup:   setting.AlipayMinTopUp,
			enabled:    isAlipayTopUpEnabled(),
			missing:    missingNativePayCredentials(alipayCredentials()),
		},
	}
}

// GetNativePayGatewayStatus 返回扫码支付渠道的启用状态与缺失凭证，
// 供管理端直接说明某个渠道为何没有出现在用户端充值页。
func GetNativePayGatewayStatus(c *gin.Context) {
	gateways := nativePayGateways()
	statuses := make([]gin.H, 0, len(gateways))
	for _, gateway := range gateways {
		statuses = append(statuses, gin.H{
			"type":    gateway.methodType,
			"enabled": gateway.enabled,
			"missing": gateway.missing,
		})
	}
	common.ApiSuccess(c, gin.H{
		"compliance_confirmed": isPaymentComplianceConfirmed(),
		"gateways":             statuses,
	})
}

func GetTopUpInfo(c *gin.Context) {
	complianceConfirmed := operation_setting.IsPaymentComplianceConfirmed()

	// 支付方式固定为微信支付与支付宝两个直连渠道，只有已配置资质的渠道才会展示，
	// 避免用户选到必然下单失败的方式。
	payMethods := make([]map[string]string, 0, 2)
	if complianceConfirmed {
		for _, gateway := range nativePayGateways() {
			if !gateway.enabled {
				continue
			}
			payMethods = append(payMethods, map[string]string{
				"name":      gateway.name,
				"type":      gateway.methodType,
				"color":     gateway.color,
				"min_topup": strconv.Itoa(gateway.minTopup),
			})
		}
	}

	gateways := nativePayGateways()
	data := gin.H{
		"enable_online_topup":              complianceConfirmed && (gateways[0].enabled || gateways[1].enabled),
		"enable_wechat_topup":              gateways[0].enabled,
		"enable_alipay_topup":              gateways[1].enabled,
		"enable_redemption":                complianceConfirmed,
		"payment_compliance_confirmed":     complianceConfirmed,
		"payment_compliance_terms_version": operation_setting.CurrentComplianceTermsVersion,
		"pay_methods":                      payMethods,
		"min_topup":                        operation_setting.MinTopUp,
		"amount_options":                   operation_setting.GetPaymentSetting().AmountOptions,
		"discount":                         operation_setting.GetPaymentSetting().AmountDiscount,
		"topup_link":                       common.TopUpLink,
	}
	common.ApiSuccess(c, data)
}

// nativePayOrderExpireMinutes 返回扫码支付（微信/支付宝）订单的有效期（分钟）。
func nativePayOrderExpireMinutes(provider string) int64 {
	switch provider {
	case model.PaymentProviderWechat:
		if setting.WechatOrderExpireMinutes > 0 {
			return int64(setting.WechatOrderExpireMinutes)
		}
	case model.PaymentProviderAlipay:
		if setting.AlipayOrderExpireMinutes > 0 {
			return int64(setting.AlipayOrderExpireMinutes)
		}
	}
	return 120
}

// GetTopUpStatus 查询当前登录用户的充值订单状态，供二维码支付前端轮询。
// 只读状态、不触发入账（入账只由支付平台异步回调驱动）；
// 超过订单有效期的 pending 订单在此懒过期，并尽力关闭支付单。
func GetTopUpStatus(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	id := c.GetInt("id")
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.UserId != id {
		common.ApiErrorMsg(c, "充值订单不存在")
		return
	}
	if topUp.Status == common.TopUpStatusPending && topUp.CreateTime > 0 &&
		time.Now().Unix()-topUp.CreateTime > nativePayOrderExpireMinutes(topUp.PaymentProvider)*60 {
		if err := model.UpdatePendingTopUpStatus(tradeNo, topUp.PaymentProvider, common.TopUpStatusExpired); err == nil {
			topUp.Status = common.TopUpStatusExpired
			// best-effort 关闭支付单，失败不影响本地订单状态
			if topUp.PaymentProvider == model.PaymentProviderWechat {
				closeWechatOrder(tradeNo)
			} else if topUp.PaymentProvider == model.PaymentProviderAlipay {
				closeAlipayOrder(tradeNo)
			}
			logger.LogInfo(c.Request.Context(), fmt.Sprintf("扫码支付订单过期 trade_no=%s provider=%s", tradeNo, topUp.PaymentProvider))
		}
	}
	common.ApiSuccess(c, gin.H{
		"trade_no":      topUp.TradeNo,
		"status":        topUp.Status,
		"complete_time": topUp.CompleteTime,
	})
}

type AmountRequest struct {
	Amount int64 `json:"amount"`
}

// getPayMoney 返回用户需要支付的金额（元）：充值金额乘以该档位的折扣比例。
// 到账额度仍按充值金额计算，折扣只影响实付金额。
func getPayMoney(amount int64) float64 {
	discount := amountDiscountFor(amount)
	payMoney := decimal.NewFromInt(amount).
		Mul(decimal.NewFromFloat(discount)).
		Round(2)
	return payMoney.InexactFloat64()
}

// amountDiscountFor 返回充值金额档位对应的实付比例，未配置时为 1。
// 折扣只允许降价：配置值不在 (0, 1] 区间时按原价处理并记录日志，
// 避免非法配置产生负数扣款或凭空加价。
func amountDiscountFor(amount int64) float64 {
	discount, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(amount)]
	if !ok {
		return 1
	}
	if discount <= 0 || discount > 1 {
		common.SysError(fmt.Sprintf("充值折扣配置非法，已按原价计算 amount=%d discount=%v", amount, discount))
		return 1
	}
	return discount
}

// gatewayFailureReason 拼接支付网关失败原因。
// err 可能为 nil（网关返回了响应但业务码不成功），必须避免直接解引用。
func gatewayFailureReason(err error, detail string) string {
	if err != nil && detail != "" {
		return err.Error() + " | " + detail
	}
	if err != nil {
		return err.Error()
	}
	if detail != "" {
		return detail
	}
	return "网关未返回有效结果"
}

// nativePayNotifyURL 拼接并校验支付网关异步通知地址。
// 地址为空或不是绝对 http(s) URL 时网关会直接拒单（支付宝报「回调地址不符」、
// 微信报 notify_url 格式错误），因此在下单前显式拦截并给出可操作的提示。
func nativePayNotifyURL(path string) (string, error) {
	base := strings.TrimRight(strings.TrimSpace(service.GetCallbackAddress()), "/")
	parsed, err := url.Parse(base)
	if err != nil || parsed.Host == "" ||
		(parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", errors.New("支付回调地址未配置：请填写系统设置中的「服务器地址」或「自定义回调地址」，且必须是公网可访问的 http(s) 域名")
	}
	return base + path, nil
}

// gatewayMinTopup 返回扫码支付直连渠道的最低充值数量（单位：元额度）。
// 未配置或值非法时回落到全局 MinTopUp。
func gatewayMinTopup(methodType string) int64 {
	for _, gateway := range nativePayGateways() {
		if gateway.methodType != methodType {
			continue
		}
		if gateway.minTopup > 0 {
			return int64(gateway.minTopup)
		}
		break
	}
	return int64(operation_setting.MinTopUp)
}

func getMinTopup() int64 {
	return int64(operation_setting.MinTopUp)
}

func getTopUpQuota(amount int64) (int, error) {
	quota := decimal.NewFromInt(amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	return common.WalletQuotaFromDecimalStrict(quota)
}

func getMaxTopUpAmount() int64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	maxStoredAmount := decimal.NewFromInt(common.MaxWalletQuota).
		Div(quotaPerUnit).
		Floor()
	return maxStoredAmount.IntPart()
}

func validateCreditedQuota(quota decimal.Decimal) (int, error) {
	value, err := common.WalletQuotaFromDecimalStrict(quota)
	if err != nil {
		return 0, errors.New("充值额度超出系统可表示范围")
	}
	if value <= 0 {
		return 0, errors.New("充值额度必须大于 0")
	}
	return value, nil
}

func validateTopUpQuota(amount int64) (int, error) {
	quota, err := getTopUpQuota(amount)
	if err == nil && quota > 0 {
		return quota, nil
	}
	maxAmount := getMaxTopUpAmount()
	if maxAmount > 0 && amount > maxAmount {
		return 0, fmt.Errorf("单笔充值数量不能大于 %d", maxAmount)
	}
	return 0, errors.New("充值数量无效")
}

func rejectInvalidCreditedQuota(c *gin.Context, userId int, quota decimal.Decimal) bool {
	creditedQuota, err := validateCreditedQuota(quota)
	if err == nil {
		err = model.ValidateTopUpQuotaCapacity(userId, creditedQuota)
	}
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return true
	}
	return false
}

func rejectInvalidTopUpQuota(c *gin.Context, userId int, amount int64) bool {
	creditedQuota, err := validateTopUpQuota(amount)
	if err == nil {
		err = model.ValidateTopUpQuotaCapacity(userId, creditedQuota)
	}
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return true
	}
	return false
}

// tradeNo lock
var orderLocks sync.Map
var createLock sync.Mutex

// refCountedMutex 带引用计数的互斥锁，确保最后一个使用者才从 map 中删除
type refCountedMutex struct {
	mu       sync.Mutex
	refCount int
}

// LockOrder 尝试对给定订单号加锁
func LockOrder(tradeNo string) {
	createLock.Lock()
	var rcm *refCountedMutex
	if v, ok := orderLocks.Load(tradeNo); ok {
		rcm = v.(*refCountedMutex)
	} else {
		rcm = &refCountedMutex{}
		orderLocks.Store(tradeNo, rcm)
	}
	rcm.refCount++
	createLock.Unlock()
	rcm.mu.Lock()
}

// UnlockOrder 释放给定订单号的锁
func UnlockOrder(tradeNo string) {
	v, ok := orderLocks.Load(tradeNo)
	if !ok {
		return
	}
	rcm := v.(*refCountedMutex)
	rcm.mu.Unlock()

	createLock.Lock()
	rcm.refCount--
	if rcm.refCount == 0 {
		orderLocks.Delete(tradeNo)
	}
	createLock.Unlock()
}

func RequestAmount(c *gin.Context) {
	var req AmountRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}
	payMoney := getPayMoney(req.Amount)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func GetUserTopUps(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")

	var (
		topups []*model.TopUp
		total  int64
		err    error
	)
	if keyword != "" {
		topups, total, err = model.SearchUserTopUps(userId, keyword, pageInfo)
	} else {
		topups, total, err = model.GetUserTopUps(userId, pageInfo)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(topups)
	common.ApiSuccess(c, pageInfo)
}

// GetAllTopUps 管理员获取全平台充值记录
func GetAllTopUps(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")

	var (
		topups []*model.TopUp
		total  int64
		err    error
	)
	if keyword != "" {
		topups, total, err = model.SearchAllTopUps(keyword, pageInfo)
	} else {
		topups, total, err = model.GetAllTopUps(pageInfo)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(topups)
	common.ApiSuccess(c, pageInfo)
}

type AdminCompleteTopupRequest struct {
	TradeNo string `json:"trade_no"`
}

// AdminCompleteTopUp 管理员补单接口
func AdminCompleteTopUp(c *gin.Context) {
	var req AdminCompleteTopupRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.TradeNo == "" {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	// 订单级互斥，防止并发补单
	LockOrder(req.TradeNo)
	defer UnlockOrder(req.TradeNo)

	if err := model.ManualCompleteTopUp(req.TradeNo, c.ClientIP()); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
