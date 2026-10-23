// Package alipayv3 实现支付宝 OpenAPI V3（OAS3.0）的最小客户端。
// 支付宝官方未提供 Go SDK，这里按 V3 协议直接对接网关：
// 整体报文 RSA2 签名 + Authorization 头鉴权 + 响应签名校验。
package alipayv3

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	// ProductionEndpoint 生产网关地址。
	ProductionEndpoint = "https://openapi.alipay.com"
	// SandboxEndpoint 沙箱网关地址。
	SandboxEndpoint = "https://openapi-sandbox.dl.alipaydev.com"

	// requestTimeout 单次网关调用超时。
	requestTimeout = 15 * time.Second
	// maxResponseBytes 网关响应体上限，避免异常响应占满内存。
	maxResponseBytes = 1 << 20
)

// Client 是支付宝 V3 网关客户端，凭据不变时可复用。
type Client struct {
	appID      string
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	endpoint   string
	httpClient *http.Client
}

// APIError 表示 V3 网关返回的 HTTP 错误。
type APIError struct {
	HTTPStatus int
	Code       string
	Msg        string
	SubCode    string
	SubMsg     string
}

func (e *APIError) Error() string {
	detail := "code=" + e.Code
	if e.SubCode != "" {
		detail += " sub_code=" + e.SubCode
	}
	if e.Msg != "" {
		detail += " msg=" + e.Msg
	}
	if e.SubMsg != "" {
		detail += " sub_msg=" + e.SubMsg
	}
	if e.HTTPStatus != 0 && e.HTTPStatus != http.StatusOK {
		detail += fmt.Sprintf(" http_status=%d", e.HTTPStatus)
	}
	return detail
}

type apiResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// NewClient 创建 V3 客户端；应用私钥与支付宝公钥均必填，后者用于响应与通知验签。
func NewClient(appID, appPrivateKey, alipayPublicKey string, sandbox bool) (*Client, error) {
	if strings.TrimSpace(appID) == "" {
		return nil, errors.New("支付宝 APPID 未配置")
	}
	privateKey, err := ParsePrivateKey(appPrivateKey)
	if err != nil {
		return nil, err
	}
	publicKey, err := ParsePublicKey(alipayPublicKey)
	if err != nil {
		return nil, err
	}
	endpoint := ProductionEndpoint
	if sandbox {
		endpoint = SandboxEndpoint
	}
	return &Client{
		appID:      appID,
		privateKey: privateKey,
		publicKey:  publicKey,
		endpoint:   endpoint,
		httpClient: &http.Client{Timeout: requestTimeout},
	}, nil
}

// Post 以 JSON 请求体调用 V3 接口，返回原始响应体。
// HTTP 错误时返回 *APIError，保留 V3 的 code/message 和 HTTP 状态。
func (c *Client) Post(ctx context.Context, path string, body any) ([]byte, error) {
	var payload []byte
	if body != nil {
		marshaled, err := common.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("支付宝请求序列化失败：%w", err)
		}
		payload = marshaled
	}
	return c.do(ctx, http.MethodPost, path, payload)
}

// VerifyNotify 校验异步通知签名。
// 通知按表单参数名字典序拼成 k=v&k=v 后签名；历史上组串是否包含 sign_type 存在差异，
// 因此先按包含 sign_type 验一次，不通过再去掉 sign_type 验一次。
func (c *Client) VerifyNotify(values url.Values) error {
	signature := values.Get("sign")
	if signature == "" {
		return errors.New("支付宝通知缺少签名")
	}
	for _, keepSignType := range []bool{true, false} {
		if err := verifyRSA2(c.publicKey, notifySignContent(values, keepSignType), signature); err == nil {
			return nil
		}
	}
	return errors.New("支付宝通知验签失败")
}

func (c *Client) do(ctx context.Context, method, path string, payload []byte) ([]byte, error) {
	authString := fmt.Sprintf("app_id=%s,nonce=%s,timestamp=%d", c.appID, common.GetUUID(), time.Now().UnixMilli())
	// V3 待签名串：授权串、请求方法、请求路径、请求体依次以 \n 连接，末尾保留 \n。
	signContent := authString + "\n" + method + "\n" + path + "\n" + string(payload) + "\n"
	signature, err := signRSA2(c.privateKey, signContent)
	if err != nil {
		return nil, fmt.Errorf("支付宝请求签名失败：%w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.endpoint+path, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("alipay-request-id", common.GetUUID())
	req.Header.Set("Authorization", "ALIPAY-SHA256withRSA "+authString+",sign="+signature)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("支付宝网关请求失败：%w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return nil, fmt.Errorf("支付宝响应读取失败：%w", err)
	}
	if len(respBody) == 0 {
		return nil, fmt.Errorf("支付宝响应为空 http_status=%d", resp.StatusCode)
	}

	var parsed apiResponse
	if err := common.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("支付宝响应解析失败 http_status=%d", resp.StatusCode)
	}
	// V3 成功响应直接包含业务字段，不带 V2 的 code=10000。
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, &APIError{
			HTTPStatus: resp.StatusCode,
			Code:       parsed.Code,
			Msg:        parsed.Message,
		}
	}
	if err := c.verifyResponse(resp.Header, respBody); err != nil {
		return nil, err
	}
	return respBody, nil
}

// verifyResponse 校验同步响应签名：HTTP 错误已在上游处理，
// 这里只对成功响应强制验签，避免被篡改的二维码等数据被采用。
func (c *Client) verifyResponse(header http.Header, body []byte) error {
	signature := header.Get("alipay-signature")
	if signature == "" {
		return errors.New("支付宝响应缺少签名")
	}
	content := header.Get("alipay-timestamp") + "\n" + header.Get("alipay-nonce") + "\n" + string(body) + "\n"
	if err := verifyRSA2(c.publicKey, content, signature); err != nil {
		return fmt.Errorf("支付宝响应验签失败：%w", err)
	}
	return nil
}

func notifySignContent(values url.Values, keepSignType bool) string {
	keys := make([]string, 0, len(values))
	for key := range values {
		if key == "sign" || values.Get(key) == "" {
			continue
		}
		if key == "sign_type" && !keepSignType {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	pairs := make([]string, 0, len(keys))
	for _, key := range keys {
		pairs = append(pairs, key+"="+values.Get(key))
	}
	return strings.Join(pairs, "&")
}

func signRSA2(privateKey *rsa.PrivateKey, content string) (string, error) {
	digest := sha256.Sum256([]byte(content))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func verifyRSA2(publicKey *rsa.PublicKey, content, signature string) error {
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signature))
	if err != nil {
		return err
	}
	digest := sha256.Sum256([]byte(content))
	return rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, digest[:], decoded)
}

// ParsePrivateKey 解析应用私钥，兼容 PEM（PKCS#1/PKCS#8）与裸 Base64 两种配置形式。
func ParsePrivateKey(raw string) (*rsa.PrivateKey, error) {
	der, err := keyDER(raw)
	if err != nil {
		return nil, fmt.Errorf("应用私钥解析失败：%w", err)
	}
	if parsed, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		privateKey, ok := parsed.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("应用私钥不是 RSA 密钥")
		}
		return privateKey, nil
	}
	privateKey, err := x509.ParsePKCS1PrivateKey(der)
	if err != nil {
		return nil, errors.New("应用私钥解析失败：仅支持 PKCS#1/PKCS#8 格式的 RSA 私钥")
	}
	return privateKey, nil
}

// ParsePublicKey 解析支付宝公钥，兼容 PEM（PKIX/PKCS#1）与裸 Base64 两种配置形式。
func ParsePublicKey(raw string) (*rsa.PublicKey, error) {
	der, err := keyDER(raw)
	if err != nil {
		return nil, fmt.Errorf("支付宝公钥解析失败：%w", err)
	}
	if parsed, err := x509.ParsePKIXPublicKey(der); err == nil {
		publicKey, ok := parsed.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("支付宝公钥不是 RSA 密钥")
		}
		return publicKey, nil
	}
	publicKey, err := x509.ParsePKCS1PublicKey(der)
	if err != nil {
		return nil, errors.New("支付宝公钥解析失败：仅支持 PKIX/PKCS#1 格式的 RSA 公钥")
	}
	return publicKey, nil
}

func keyDER(raw string) ([]byte, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("密钥内容为空")
	}
	if strings.Contains(trimmed, "-----BEGIN") {
		block, _ := pem.Decode([]byte(trimmed))
		if block == nil {
			return nil, errors.New("PEM 格式无法解析")
		}
		return block.Bytes, nil
	}
	return base64.StdEncoding.DecodeString(strings.Join(strings.Fields(trimmed), ""))
}
