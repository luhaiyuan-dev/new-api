package alipayv3

import (
	"net/url"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// PagePayRequest describes a merchant order for the Alipay website cashier.
type PagePayRequest struct {
	OutTradeNo  string
	TotalAmount string
	Subject     string
	NotifyURL   string
	ExpiresAt   time.Time
}

// PagePayURL signs the page API's gateway.do parameters. Unlike V3 server APIs,
// alipay.trade.page.pay is opened by the buyer's browser and does not return JSON.
// A generated URL is not proof of payment; only a verified notification can credit it.
func (c *Client) PagePayURL(order PagePayRequest) (string, error) {
	chinaTime := time.FixedZone("UTC+8", 8*60*60)
	biz, err := common.Marshal(map[string]string{
		"out_trade_no": order.OutTradeNo,
		"total_amount": order.TotalAmount,
		"subject":      order.Subject,
		"product_code": "FAST_INSTANT_TRADE_PAY",
		"qr_pay_mode":  "2",
		"time_expire":  order.ExpiresAt.In(chinaTime).Format("2006-01-02 15:04:05"),
	})
	if err != nil {
		return "", err
	}
	params := url.Values{
		"app_id":      {c.appID},
		"method":      {"alipay.trade.page.pay"},
		"format":      {"json"},
		"charset":     {"utf-8"},
		"sign_type":   {"RSA2"},
		"timestamp":   {time.Now().In(chinaTime).Format("2006-01-02 15:04:05")},
		"version":     {"1.0"},
		"notify_url":  {order.NotifyURL},
		"biz_content": {string(biz)},
	}
	// Page requests include sign_type in the sorted, unescaped signing content.
	signature, err := signRSA2(c.privateKey, notifySignContent(params, true))
	if err != nil {
		return "", err
	}
	params.Set("sign", signature)
	return c.endpoint + "/gateway.do?" + params.Encode(), nil
}
