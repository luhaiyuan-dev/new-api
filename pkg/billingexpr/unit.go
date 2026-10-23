package billingexpr

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// Billing units for expressions. Coefficients keep their existing meaning
// (price per 1M tokens) unless a unit or a per_* primitive says otherwise.
const (
	UnitPerMillionTokens = "per_1m_tokens"
	UnitPerCall          = "per_call"
	UnitPerImage         = "per_image"
	UnitPerSecond        = "per_second"
)

var primitiveUnits = map[string]string{
	"per_image":  UnitPerImage,
	"per_second": UnitPerSecond,
	"per_call":   UnitPerCall,
}

var tokenPriceVars = map[string]bool{
	"p": true, "c": true, "len": true,
	"cr": true, "cc": true, "cc1h": true,
	"img": true, "img_o": true, "ai": true, "ao": true,
}

// NormalizeUnit maps empty or unknown values to the legacy token unit.
func NormalizeUnit(unit string) string {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case UnitPerCall:
		return UnitPerCall
	case UnitPerImage:
		return UnitPerImage
	case UnitPerSecond:
		return UnitPerSecond
	default:
		return UnitPerMillionTokens
	}
}

// IsValidUnit reports whether unit is one of the supported billing units.
func IsValidUnit(unit string) bool {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case UnitPerMillionTokens, UnitPerCall, UnitPerImage, UnitPerSecond:
		return true
	default:
		return false
	}
}

// ResolveUnit determines the effective billing unit of an expression.
//
// Rules:
//  1. A per_* primitive declares the unit and ignores the configured unit.
//  2. Only one primitive kind may appear in an expression.
//  3. Token variables cannot be mixed with media primitives, and cannot be
//     used when a non-token unit is declared.
func ResolveUnit(exprStr, declared string) (string, error) {
	declared = NormalizeUnit(declared)
	used := UsedVars(exprStr)

	primitive := ""
	for identifier, unit := range primitiveUnits {
		if !used[identifier] {
			continue
		}
		if primitive != "" && primitive != unit {
			return "", fmt.Errorf("expression mixes per_* primitives (%s and %s); use a single billing unit", primitive, unit)
		}
		primitive = unit
	}

	if primitive != "" {
		for name := range tokenPriceVars {
			if used[name] {
				return "", fmt.Errorf("expression mixes token variable %q with per_* primitives; use tokens or media units, not both", name)
			}
		}
		return primitive, nil
	}

	if declared != UnitPerMillionTokens {
		for name := range tokenPriceVars {
			if used[name] {
				return "", fmt.Errorf("expression uses token variable %q but billing unit is %s", name, declared)
			}
		}
	}
	return declared, nil
}

// ValidateUnit reports an error when a unit value is not supported.
func ValidateUnit(unit string) error {
	if strings.TrimSpace(unit) == "" || IsValidUnit(unit) {
		return nil
	}
	return fmt.Errorf("unsupported billing unit %q", unit)
}

// QuotaFromCost converts an expression result to quota before the group ratio.
// Token-unit expressions keep the historical "price per 1M tokens" meaning.
func QuotaFromCost(cost float64, unit string, params TokenParams) float64 {
	switch NormalizeUnit(unit) {
	case UnitPerCall:
		return cost * common.QuotaPerUnit
	case UnitPerImage:
		return cost * positiveOrZero(params.N) * common.QuotaPerUnit
	case UnitPerSecond:
		return cost * positiveOrZero(params.Dur) * common.QuotaPerUnit
	default:
		return cost / 1_000_000 * common.QuotaPerUnit
	}
}

func positiveOrZero(value float64) float64 {
	if value > 0 {
		return value
	}
	return 0
}
