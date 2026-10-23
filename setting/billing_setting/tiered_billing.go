package billing_setting

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/samber/lo"
)

const (
	BillingModeRatio      = "ratio"
	BillingModeTieredExpr = "tiered_expr"
	BillingModeField      = "billing_mode"
	BillingExprField      = "billing_expr"
	BillingUnitField      = "billing_unit"
)

// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr,
// billing_setting.billing_unit
type BillingSetting struct {
	BillingMode map[string]string `json:"billing_mode"`
	BillingExpr map[string]string `json:"billing_expr"`
	BillingUnit map[string]string `json:"billing_unit"`
}

var billingSetting = BillingSetting{
	BillingMode: make(map[string]string),
	BillingExpr: make(map[string]string),
	BillingUnit: make(map[string]string),
}

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func GetBillingMode(model string) string {
	if mode, ok := billingSetting.BillingMode[model]; ok {
		return mode
	}
	return BillingModeRatio
}

func GetBillingExpr(model string) (string, bool) {
	expr, ok := billingSetting.BillingExpr[model]
	return expr, ok
}

func GetBillingModeCopy() map[string]string {
	return lo.Assign(billingSetting.BillingMode)
}

func GetBillingExprCopy() map[string]string {
	return lo.Assign(billingSetting.BillingExpr)
}

// GetBillingUnit returns the billing unit declared for a model. Models without
// a declaration keep the legacy per-1M-token unit.
func GetBillingUnit(model string) string {
	return billingexpr.NormalizeUnit(billingSetting.BillingUnit[model])
}

// GetDeclaredBillingUnit returns the normalized unit only when the model
// explicitly declares one, so callers can keep the field empty instead of
// echoing the implicit per-1M-token default.
func GetDeclaredBillingUnit(model string) (string, bool) {
	unit, ok := billingSetting.BillingUnit[model]
	if !ok || strings.TrimSpace(unit) == "" {
		return "", false
	}
	return billingexpr.NormalizeUnit(unit), true
}

func GetBillingUnitCopy() map[string]string {
	return lo.Assign(billingSetting.BillingUnit)
}

func GetPricingSyncData(base map[string]any) map[string]any {
	extra := make(map[string]any, 3)
	if modes := GetBillingModeCopy(); len(modes) > 0 {
		extra[BillingModeField] = modes
	}
	if exprs := GetBillingExprCopy(); len(exprs) > 0 {
		extra[BillingExprField] = exprs
	}
	if units := GetBillingUnitCopy(); len(units) > 0 {
		extra[BillingUnitField] = units
	}
	return lo.Assign(base, extra)
}

// ---------------------------------------------------------------------------
// Smoke test (called externally for validation before save)
// ---------------------------------------------------------------------------

func SmokeTestExpr(exprStr string) error {
	return SmokeTestExprWithUnit(exprStr, billingexpr.UnitPerMillionTokens)
}

// SmokeTestExprWithUnit compiles and evaluates an expression with both token
// and media vectors. It also enforces the unit/token-variable compatibility
// rules, so a mis-declared unit is rejected at save time.
func SmokeTestExprWithUnit(exprStr, unit string) error {
	if _, err := billingexpr.ResolveUnit(exprStr, unit); err != nil {
		return err
	}
	return smokeTestExpr(exprStr)
}

// ValidateBillingExprJSON validates a billing_setting.billing_expr value
// (model -> expression) before it is persisted.
func ValidateBillingExprJSON(raw string) error {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var exprs map[string]string
	if err := common.UnmarshalJsonStr(raw, &exprs); err != nil {
		return fmt.Errorf("billing_expr JSON invalid: %w", err)
	}
	for model, expr := range exprs {
		if strings.TrimSpace(expr) == "" {
			continue
		}
		if err := SmokeTestExprWithUnit(expr, GetBillingUnit(model)); err != nil {
			return fmt.Errorf("model %s: %w", model, err)
		}
	}
	return nil
}

// ValidateBillingUnitJSON validates a billing_setting.billing_unit value and
// re-checks any expression already configured for the same model.
func ValidateBillingUnitJSON(raw string) error {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var units map[string]string
	if err := common.UnmarshalJsonStr(raw, &units); err != nil {
		return fmt.Errorf("billing_unit JSON invalid: %w", err)
	}
	for model, unit := range units {
		if err := billingexpr.ValidateUnit(unit); err != nil {
			return fmt.Errorf("model %s: %w", model, err)
		}
		if expr, ok := GetBillingExpr(model); ok && strings.TrimSpace(expr) != "" {
			if err := SmokeTestExprWithUnit(expr, unit); err != nil {
				return fmt.Errorf("model %s: %w", model, err)
			}
		}
	}
	return nil
}

func smokeTestExpr(exprStr string) error {
	vectors := []billingexpr.TokenParams{
		{P: 0, C: 0, Len: 0},
		{P: 1000, C: 1000, Len: 1000},
		{P: 100000, C: 100000, Len: 100000},
		{P: 1000000, C: 1000000, Len: 1000000},
		{N: 1, Res: "1k", Q: "low"},
		{N: 4, Res: "4k", Q: "high"},
		{Dur: 1, Res: "720p"},
		{Dur: 3600, Res: "4k", Audio: 1},
	}
	requests := []billingexpr.RequestInput{
		{},
		{
			Headers: map[string]string{
				"anthropic-beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast","stream_options":{"include_usage":true},"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	}

	for _, v := range vectors {
		for _, request := range requests {
			result, _, err := billingexpr.RunExprWithRequest(exprStr, v, request)
			if err != nil {
				return fmt.Errorf("vector {p=%g, c=%g}: run failed: %w", v.P, v.C, err)
			}
			if result < 0 {
				return fmt.Errorf("vector {p=%g, c=%g}: result %f < 0", v.P, v.C, result)
			}
		}
	}
	return nil
}
