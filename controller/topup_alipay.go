package controller

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/alipayv3"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// 支付宝客户端缓存：应用凭据不变时复用；沙箱开关参与凭据指纹。
var (
	alipayClient       *alipayv3.Client
	alipayClientMu     sync.Mutex
	alipayClientCredID string
)

func alipayCredentialID() string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		setting.AlipayAppId,
		setting.AlipayPrivateKey,
		setting.AlipayPublicKey,
		strconv.FormatBool(setting.AlipaySandbox),
	}, "|")))
	return hex.EncodeToString(sum[:])
}

// GetAlipayClient 返回支付宝客户端，支持电脑网站支付和 V3 关单接口。
func GetAlipayClient() (*alipayv3.Client, error) {
	if !isAlipayTopUpEnabled() {
		return nil, errors.New("当前管理员未配置支付宝支付")
	}
	credID := alipayCredentialID()
	alipayClientMu.Lock()
	defer alipayClientMu.Unlock()
	if alipayClient != nil && alipayClientCredID == credID {
		return alipayClient, nil
	}
	// V3 直连：私钥用于请求签名，支付宝公钥用于响应与异步通知验签。
	client, err := alipayv3.NewClient(setting.AlipayAppId, setting.AlipayPrivateKey, setting.AlipayPublicKey, setting.AlipaySandbox)
	if err != nil {
		return nil, err
	}
	alipayClient = client
	alipayClientCredID = credID
	return client, nil
}

func getAlipayMinTopup() int64 {
	return gatewayMinTopup(model.PaymentMethodAlipay)
}

func alipayOrderExpireMinutes() int {
	if setting.AlipayOrderExpireMinutes > 0 {
		return setting.AlipayOrderExpireMinutes
	}
	return 30
}

type AlipayPayRequest struct {
	Amount int64 `json:"amount"`
}

// RequestAlipayPay 创建充值订单，返回电脑网站支付收银台地址。
func RequestAlipayPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	client, clientErr := GetAlipayClient()
	if clientErr != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 客户端初始化失败 user_id=%d error=%q", c.GetInt("id"), clientErr.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付宝支付不可用：" + clientErr.Error()})
		return
	}

	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getAlipayMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getAlipayMinTopup())})
		return
	}

	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}

	payMoney := getPayMoney(req.Amount)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// 回调地址无效时网关必然拒单，先校验再落库，避免留下无意义的 pending 订单。
	notifyURL, notifyErr := nativePayNotifyURL("/api/user/alipay/notify")
	if notifyErr != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 回调地址无效 user_id=%d error=%q", id, notifyErr.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": notifyErr.Error()})
		return
	}

	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dNO%s", id, tradeNo)

	// 先落库再拉起支付：避免支付成功后订单写入失败导致无法入账。
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          req.Amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	expireMinutes := alipayOrderExpireMinutes()
	expiresAt := time.Unix(topUp.CreateTime, 0).Add(time.Duration(expireMinutes) * time.Minute)

	paymentURL, aliErr := client.PagePayURL(alipayv3.PagePayRequest{
		OutTradeNo:  tradeNo,
		TotalAmount: strconv.FormatFloat(payMoney, 'f', 2, 64),
		Subject:     fmt.Sprintf("TUC%d", req.Amount),
		NotifyURL:   notifyURL,
		ExpiresAt:   expiresAt,
	})
	if aliErr != nil {
		reason := gatewayFailureReason(aliErr, "")
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 拉起支付失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, reason))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderAlipay, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败：" + reason})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f expire_minutes=%d", id, tradeNo, req.Amount, payMoney, expireMinutes))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"payment_url": paymentURL,
			"trade_no":    tradeNo,
			"expire_at":   expiresAt.Unix(),
			// money 是实付金额（已应用档位折扣），前端据此展示待支付金额。
			"money": payMoney,
		},
	})
}

// 支付宝交易状态常量（按开放平台协议值定义）。
const (
	alipayTradeStatusSuccess  = "TRADE_SUCCESS"
	alipayTradeStatusFinished = "TRADE_FINISHED"
)

// AlipayNotify 处理支付宝异步回调：验签 → 交易状态校验 → 金额核对 → 原子入账。
func AlipayNotify(c *gin.Context) {
	if !isAlipayWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	client, clientErr := GetAlipayClient()
	if clientErr != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 webhook client 初始化失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), clientErr.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	// 异步通知沿用表单协议，参数以 urldecode 后的值参与验签。
	if err := c.Request.ParseForm(); err != nil || len(c.Request.PostForm) == 0 {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 解析失败 path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	form := c.Request.PostForm

	if err := client.VerifyNotify(form); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 验签失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	outTradeNo := form.Get("out_trade_no")
	tradeStatus := form.Get("trade_status")
	totalAmount := form.Get("total_amount")
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 webhook 验签成功 trade_no=%s trade_status=%s total_amount=%s client_ip=%s", outTradeNo, tradeStatus, totalAmount, c.ClientIP()))

	if appID := form.Get("app_id"); appID != setting.AlipayAppId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook APPID 不匹配 trade_no=%s app_id=%s client_ip=%s", outTradeNo, appID, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if tradeStatus != alipayTradeStatusSuccess && tradeStatus != alipayTradeStatusFinished {
		// 验签通过但非成功状态，无需入账；应答 success 避免支付宝重复推送。
		_, _ = c.Writer.Write([]byte("success"))
		return
	}

	paidAmount, parseErr := decimal.NewFromString(totalAmount)
	if parseErr != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 webhook 金额解析失败 trade_no=%s total_amount=%s client_ip=%s", outTradeNo, totalAmount, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	LockOrder(outTradeNo)
	defer UnlockOrder(outTradeNo)

	alreadyDone, err := model.RechargeAlipay(outTradeNo, paidAmount, c.ClientIP())
	if err != nil {
		switch {
		case errors.Is(err, model.ErrTopUpNotFound):
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 回调订单不存在 trade_no=%s client_ip=%s", outTradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrPaymentMethodMismatch):
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 订单支付网关不匹配 trade_no=%s client_ip=%s", outTradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrTopUpStatusInvalid):
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 订单状态非法 trade_no=%s client_ip=%s", outTradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrTopUpAmountMismatch):
			logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 回调金额与订单不一致 trade_no=%s total_amount=%s client_ip=%s", outTradeNo, totalAmount, c.ClientIP()))
		default:
			logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 充值处理失败 trade_no=%s client_ip=%s error=%q", outTradeNo, c.ClientIP(), err.Error()))
		}
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if alreadyDone {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 重复回调幂等忽略 trade_no=%s client_ip=%s", outTradeNo, c.ClientIP()))
	} else {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 充值成功 trade_no=%s total_amount=%s client_ip=%s", outTradeNo, totalAmount, c.ClientIP()))
	}
	_, _ = c.Writer.Write([]byte("success"))
}

// closeAlipayOrder best-effort 关闭支付宝订单，供过期订单懒清理使用；失败仅记录日志。
func closeAlipayOrder(tradeNo string) {
	client, err := GetAlipayClient()
	if err != nil {
		return
	}
	body := map[string]string{"out_trade_no": tradeNo}
	if _, err := client.Post(context.Background(), "/v3/alipay/trade/close", body); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("支付宝 关闭过期订单失败 trade_no=%s error=%q", tradeNo, err.Error()))
	}
}
