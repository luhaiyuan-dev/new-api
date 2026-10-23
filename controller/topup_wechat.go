package controller

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/go-pay/gopay"
	wechatv3 "github.com/go-pay/gopay/wechat/v3"
	"github.com/shopspring/decimal"
)

// 微信支付客户端缓存：商户凭据不变时复用同一客户端，
// 平台证书随 AutoVerifySign 的 12 小时自动刷新协程保持最新。
var (
	wechatClient       *wechatv3.ClientV3
	wechatClientMu     sync.Mutex
	wechatClientCredID string
)

func wechatCredentialID() string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		setting.WechatAppId,
		setting.WechatMchId,
		setting.WechatMchSerialNo,
		setting.WechatApiV3Key,
		setting.WechatMchPrivateKey,
	}, "|")))
	return hex.EncodeToString(sum[:])
}

// GetWechatClient 返回微信支付 APIv3 客户端；未配置或初始化失败时返回错误。
func GetWechatClient() (*wechatv3.ClientV3, error) {
	if !isWechatTopUpEnabled() {
		return nil, errors.New("当前管理员未配置微信支付")
	}
	credID := wechatCredentialID()
	wechatClientMu.Lock()
	defer wechatClientMu.Unlock()
	if wechatClient != nil && wechatClientCredID == credID {
		return wechatClient, nil
	}
	client, err := wechatv3.NewClientV3(
		setting.WechatMchId,
		setting.WechatMchSerialNo,
		setting.WechatApiV3Key,
		setting.WechatMchPrivateKey,
	)
	if err != nil {
		return nil, err
	}
	// 下载平台证书并开启自动刷新；失败仅影响回调验签能力，不阻断扫码下单本身。
	if err := client.AutoVerifySign(); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("微信支付 平台证书下载失败，回调验签暂不可用 error=%q", err.Error()))
	}
	wechatClient = client
	wechatClientCredID = credID
	return client, nil
}

func getWechatMinTopup() int64 {
	return gatewayMinTopup(model.PaymentMethodWechat)
}

func wechatOrderExpireMinutes() int {
	if setting.WechatOrderExpireMinutes > 0 {
		return setting.WechatOrderExpireMinutes
	}
	return 30
}

type WechatPayRequest struct {
	Amount int64 `json:"amount"`
}

// RequestWechatPay 微信支付 Native 扫码下单：创建充值订单，返回二维码链接（code_url）。
func RequestWechatPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	client, clientErr := GetWechatClient()
	if clientErr != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 客户端初始化失败 user_id=%d error=%q", c.GetInt("id"), clientErr.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "微信支付不可用：" + clientErr.Error()})
		return
	}

	var req WechatPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getWechatMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getWechatMinTopup())})
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

	// 微信支付以「分」为单位，金额换算集中用 decimal 完成并设上界。
	totalFen := decimal.NewFromFloat(payMoney).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
	if totalFen <= 0 || totalFen > model.MaxTopUpPaidFen {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额无效"})
		return
	}

	// 回调地址无效时网关必然拒单，先校验再落库，避免留下无意义的 pending 订单。
	notifyURL, notifyErr := nativePayNotifyURL("/api/user/wechat/notify")
	if notifyErr != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 回调地址无效 user_id=%d error=%q", id, notifyErr.Error()))
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
		PaymentMethod:   model.PaymentMethodWechat,
		PaymentProvider: model.PaymentProviderWechat,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	expireMinutes := wechatOrderExpireMinutes()
	// time_expire 按微信要求使用带偏移的 RFC3339；+08:00 为商户平台惯例时区。
	timeExpire := time.Now().Add(time.Duration(expireMinutes) * time.Minute).
		In(time.FixedZone("CST", 8*3600)).
		Format("2006-01-02T15:04:05-07:00")

	bm := make(gopay.BodyMap)
	bm.Set("appid", setting.WechatAppId).
		Set("description", fmt.Sprintf("TUC%d", req.Amount)).
		Set("out_trade_no", tradeNo).
		Set("notify_url", notifyURL).
		Set("time_expire", timeExpire).
		Set("amount", map[string]any{"total": totalFen, "currency": "CNY"})

	wxRsp, wxErr := client.V3TransactionNative(c.Request.Context(), bm)
	if wxErr != nil || wxRsp == nil || wxRsp.Response == nil || wxRsp.Response.CodeUrl == "" {
		detail := ""
		if wxRsp != nil && wxRsp.Response != nil {
			detail = "网关未返回二维码"
		}
		reason := gatewayFailureReason(wxErr, detail)
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 拉起支付失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, reason))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderWechat, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败：" + reason})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 充值订单创建成功 user_id=%d trade_no=%s amount=%d total_fen=%d expire_minutes=%d", id, tradeNo, req.Amount, totalFen, expireMinutes))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"code_url":  wxRsp.Response.CodeUrl,
			"trade_no":  tradeNo,
			"expire_at": topUp.CreateTime + int64(expireMinutes)*60,
			// money 是实付金额（已应用档位折扣），前端据此展示待支付金额。
			"money": payMoney,
		},
	})
}

// WechatNotify 处理微信支付异步回调：验签 → 交易状态校验 → 金额核对 → 原子入账。
func WechatNotify(c *gin.Context) {
	if !isWechatWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		writeWechatNotifyResponse(c, false)
		return
	}
	client, err := GetWechatClient()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 webhook client 初始化失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		writeWechatNotifyResponse(c, false)
		return
	}

	notifyReq, err := wechatv3.V3ParseNotify(c.Request)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 解析失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		writeWechatNotifyResponse(c, false)
		return
	}

	pkMap := client.WxPublicKeyMap()
	if len(pkMap) == 0 {
		// 平台证书缺失（如首次下载失败），尽力补下载一次再验签。
		if autoErr := client.AutoVerifySign(false); autoErr != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 平台证书补下载失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), autoErr.Error()))
		}
		pkMap = client.WxPublicKeyMap()
	}
	if err := notifyReq.VerifySignByPKMap(pkMap); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 验签失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		writeWechatNotifyResponse(c, false)
		return
	}

	payResult, err := notifyReq.DecryptPayCipherText(setting.WechatApiV3Key)
	if err != nil || payResult == nil || payResult.Amount == nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 webhook 解密失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		writeWechatNotifyResponse(c, false)
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 webhook 验签成功 trade_no=%s trade_state=%s payer_total=%d client_ip=%s", payResult.OutTradeNo, payResult.TradeState, payResult.Amount.PayerTotal, c.ClientIP()))

	if payResult.TradeState != wechatv3.TradeStateSuccess {
		// 非成功状态无需入账，应答成功避免微信重复推送。
		writeWechatNotifyResponse(c, true)
		return
	}
	if payResult.Mchid != "" && payResult.Mchid != setting.WechatMchId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 商户号不匹配 trade_no=%s mchid=%s client_ip=%s", payResult.OutTradeNo, payResult.Mchid, c.ClientIP()))
		writeWechatNotifyResponse(c, false)
		return
	}
	if payResult.Appid != "" && payResult.Appid != setting.WechatAppId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook APPID 不匹配 trade_no=%s appid=%s client_ip=%s", payResult.OutTradeNo, payResult.Appid, c.ClientIP()))
		writeWechatNotifyResponse(c, false)
		return
	}

	LockOrder(payResult.OutTradeNo)
	defer UnlockOrder(payResult.OutTradeNo)

	alreadyDone, err := model.RechargeWechat(payResult.OutTradeNo, int64(payResult.Amount.PayerTotal), c.ClientIP())
	if err != nil {
		switch {
		case errors.Is(err, model.ErrTopUpNotFound):
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 回调订单不存在 trade_no=%s client_ip=%s", payResult.OutTradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrPaymentMethodMismatch):
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 订单支付网关不匹配 trade_no=%s client_ip=%s", payResult.OutTradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrTopUpStatusInvalid):
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 订单状态非法 trade_no=%s client_ip=%s", payResult.OutTradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrTopUpAmountMismatch):
			logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 回调金额与订单不一致 trade_no=%s payer_total=%d client_ip=%s", payResult.OutTradeNo, payResult.Amount.PayerTotal, c.ClientIP()))
		default:
			logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 充值处理失败 trade_no=%s client_ip=%s error=%q", payResult.OutTradeNo, c.ClientIP(), err.Error()))
		}
		writeWechatNotifyResponse(c, false)
		return
	}
	if alreadyDone {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 重复回调幂等忽略 trade_no=%s client_ip=%s", payResult.OutTradeNo, c.ClientIP()))
	} else {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 充值成功 trade_no=%s payer_total=%d client_ip=%s", payResult.OutTradeNo, payResult.Amount.PayerTotal, c.ClientIP()))
	}
	writeWechatNotifyResponse(c, true)
}

func writeWechatNotifyResponse(c *gin.Context, success bool) {
	if success {
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "失败"})
}

// closeWechatOrder best-effort 关闭微信支付订单，供过期订单懒清理使用；失败仅记录日志。
func closeWechatOrder(tradeNo string) {
	client, err := GetWechatClient()
	if err != nil {
		return
	}
	if _, err := client.V3TransactionCloseOrder(context.Background(), tradeNo); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("微信支付 关闭过期订单失败 trade_no=%s error=%q", tradeNo, err.Error()))
	}
}
