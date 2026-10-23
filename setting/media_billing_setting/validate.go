package media_billing_setting

import (
	"fmt"
	"math"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaykitttypes "github.com/QuantumNous/new-api/relaykit/types"
)

const (
	maxUnitPrice = 1_000_000.0
	maxRatio     = 1_000.0
)

var sizePattern = regexp.MustCompile(`^\d+x\d+$`)

func decodeModels(raw string, target *map[string]MediaModelSpec) error {
	if strings.TrimSpace(raw) == "" {
		*target = make(map[string]MediaModelSpec)
		return nil
	}
	return common.UnmarshalJsonStr(raw, target)
}

// ValidateModelsJSON validates the value of media_billing_setting.models
// before it is persisted. Invalid configuration is rejected so a bad save
// cannot silently fall back to base prices at charge time.
func ValidateModelsJSON(raw string) error {
	var models map[string]MediaModelSpec
	if err := decodeModels(raw, &models); err != nil {
		return fmt.Errorf("media models JSON invalid: %w", err)
	}
	return validateModels(models)
}

func ValidateUnknownTierPolicy(policy string) error {
	switch strings.ToLower(strings.TrimSpace(policy)) {
	case "", UnknownTierFallbackBase, UnknownTierStrict, UnknownTierNearest:
		return nil
	default:
		return fmt.Errorf("unknown_tier_policy must be %q, %q or %q", UnknownTierFallbackBase, UnknownTierStrict, UnknownTierNearest)
	}
}

func validateModels(models map[string]MediaModelSpec) error {
	for name, spec := range models {
		if strings.TrimSpace(name) == "" {
			return fmt.Errorf("media model name must not be empty")
		}
		if err := validateModelSpec(name, spec); err != nil {
			return err
		}
	}
	return nil
}

func validateModelSpec(name string, spec MediaModelSpec) error {
	kind := strings.ToLower(strings.TrimSpace(spec.Kind))
	if kind == "" {
		return fmt.Errorf("model %s: kind is required", name)
	}
	if !isValidKind(kind) {
		return fmt.Errorf("model %s: unsupported kind %q", name, spec.Kind)
	}

	unit := strings.ToLower(strings.TrimSpace(spec.Unit))
	if unit == "" {
		return fmt.Errorf("model %s: unit is required", name)
	}
	if !isValidUnit(unit) {
		return fmt.Errorf("model %s: unsupported unit %q", name, spec.Unit)
	}

	if err := validateExtraRatios(name, spec.ExtraRatios); err != nil {
		return err
	}
	if err := validateRatios(name, "resolution_ratios", spec.ResolutionRatios); err != nil {
		return err
	}
	if err := validateRatios(name, "quality_ratios", spec.QualityRatios); err != nil {
		return err
	}
	if err := validateDuration(name, spec.Duration); err != nil {
		return err
	}

	switch NormalizeUnit(unit) {
	case relaykitttypes.UnitPerImage:
		return validateImageSpec(name, spec)
	case relaykitttypes.UnitPerSecond:
		if !isValidPrice(spec.PerSecond) {
			return fmt.Errorf("model %s: per_second must be > 0 and <= %g", name, maxUnitPrice)
		}
		return validateResolutionTiers(name, spec)
	case relaykitttypes.UnitPerCall:
		if !isValidPrice(spec.BasePrice) {
			return fmt.Errorf("model %s: base_price must be > 0 and <= %g for per_call", name, maxUnitPrice)
		}
		return nil
	default:
		// per_1m_tokens is a compatibility marker: the legacy ratio path owns it.
		return nil
	}
}

func validateImageSpec(name string, spec MediaModelSpec) error {
	if len(spec.PriceTable) == 0 && !isValidPrice(spec.BasePrice) {
		return fmt.Errorf("model %s: per_image requires price_table or base_price", name)
	}
	if err := validatePrices(name, spec.PriceTable); err != nil {
		return err
	}
	if err := validateResolutionTiers(name, spec); err != nil {
		return err
	}
	return nil
}

func validateResolutionTiers(name string, spec MediaModelSpec) error {
	seen := make(map[string]string)
	for tier, sizes := range spec.ResolutionTiers {
		if strings.TrimSpace(tier) == "" {
			return fmt.Errorf("model %s: resolution tier must not be empty", name)
		}
		for _, size := range sizes {
			normalized := normalizeSize(size)
			if !sizePattern.MatchString(normalized) {
				return fmt.Errorf("model %s: invalid size %q in tier %q", name, size, tier)
			}
			if existing, ok := seen[normalized]; ok && existing != tier {
				return fmt.Errorf("model %s: size %q is mapped to both %q and %q", name, size, existing, tier)
			}
			seen[normalized] = tier
		}
	}

	for tier := range spec.PriceTable {
		if tier == "*" {
			continue
		}
		if !hasDeclaredResolutionTier(spec, tier) {
			return fmt.Errorf("model %s: price_table tier %q is not declared in resolution_tiers", name, tier)
		}
	}
	for tier := range spec.ResolutionRatios {
		if tier != "*" && !hasDeclaredResolutionTier(spec, tier) {
			return fmt.Errorf("model %s: resolution_ratios tier %q is not declared in resolution_tiers", name, tier)
		}
	}
	if spec.DefaultResolutionTier != "" && !hasDeclaredResolutionTier(spec, spec.DefaultResolutionTier) {
		return fmt.Errorf("model %s: default_resolution_tier %q is not declared", name, spec.DefaultResolutionTier)
	}

	for tier, row := range spec.PriceTable {
		for quality := range row {
			if quality == "*" {
				continue
			}
			if !hasDeclaredQualityTier(spec, quality) {
				return fmt.Errorf("model %s: price_table[%q] quality %q is not declared in quality_tiers", name, tier, quality)
			}
		}
	}
	if spec.DefaultQualityTier != "" && !hasDeclaredQualityTier(spec, spec.DefaultQualityTier) {
		return fmt.Errorf("model %s: default_quality_tier %q is not declared", name, spec.DefaultQualityTier)
	}
	return nil
}

func hasDeclaredResolutionTier(spec MediaModelSpec, tier string) bool {
	if tier == "" {
		return false
	}
	if _, ok := spec.ResolutionTiers[tier]; ok {
		return true
	}
	_, ok := spec.ResolutionRatios[tier]
	return ok
}

func hasDeclaredQualityTier(spec MediaModelSpec, quality string) bool {
	if quality == "" {
		return false
	}
	for _, candidate := range spec.QualityTiers {
		if strings.EqualFold(strings.TrimSpace(candidate), quality) {
			return true
		}
	}
	for _, target := range spec.QualityAliases {
		if strings.EqualFold(strings.TrimSpace(target), quality) {
			return true
		}
	}
	_, ok := spec.QualityRatios[quality]
	return ok
}

func validatePrices(name string, table map[string]map[string]float64) error {
	for tier, row := range table {
		for quality, price := range row {
			if !isValidPrice(price) {
				return fmt.Errorf("model %s: price %q/%q must be > 0 and <= %g", name, tier, quality, maxUnitPrice)
			}
		}
	}
	return nil
}

func validateRatios(name, field string, ratios map[string]float64) error {
	for key, ratio := range ratios {
		if strings.TrimSpace(key) == "" {
			return fmt.Errorf("model %s: %s key must not be empty", name, field)
		}
		if !isValidRatio(ratio) {
			return fmt.Errorf("model %s: %s[%q] must be > 0, finite and <= %g", name, field, key, maxRatio)
		}
	}
	return nil
}

func validateExtraRatios(name string, ratios map[string]float64) error {
	for flag, ratio := range ratios {
		if strings.TrimSpace(flag) == "" {
			return fmt.Errorf("model %s: extra_ratios key must not be empty", name)
		}
		if !isValidRatio(ratio) {
			return fmt.Errorf("model %s: extra_ratios[%q] must be > 0, finite and <= %g", name, flag, maxRatio)
		}
	}
	return nil
}

func validateDuration(name string, spec DurationSpec) error {
	if spec.Max > MaxDurationSeconds {
		return fmt.Errorf("model %s: duration.max must be <= %d", name, MaxDurationSeconds)
	}
	if spec.Min < 0 || spec.Max < 0 || spec.Default < 0 {
		return fmt.Errorf("model %s: duration values must not be negative", name)
	}
	if spec.Max > 0 && spec.Min > spec.Max {
		return fmt.Errorf("model %s: duration.min must be <= duration.max", name)
	}
	if spec.Max > 0 && spec.Default > spec.Max {
		return fmt.Errorf("model %s: duration.default must be <= duration.max", name)
	}
	switch strings.ToLower(strings.TrimSpace(spec.Rounding)) {
	case "", "ceil", "exact":
	default:
		return fmt.Errorf("model %s: duration.rounding must be ceil or exact", name)
	}
	return nil
}

func isValidPrice(price float64) bool {
	return price > 0 && price <= maxUnitPrice && !math.IsNaN(price) && !math.IsInf(price, 0)
}

func isValidRatio(ratio float64) bool {
	return ratio > 0 && ratio <= maxRatio && !math.IsNaN(ratio) && !math.IsInf(ratio, 0)
}
