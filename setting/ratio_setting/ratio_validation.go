package ratio_setting

import (
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	maxModelPriceValue = 1_000_000.0
	maxRatioValue      = 1_000.0
)

// ValidateModelPriceMapJSON rejects fixed-price maps that could charge a
// negative or absurd amount per request. Zero stays valid: it means the model
// is free.
func ValidateModelPriceMapJSON(raw string) error {
	return validateFloatMapJSON(raw, "ModelPrice", maxModelPriceValue)
}

func ValidateModelRatioMapJSON(raw string) error {
	return validateFloatMapJSON(raw, "ModelRatio", maxRatioValue)
}

func ValidateCompletionRatioMapJSON(raw string) error {
	return validateFloatMapJSON(raw, "CompletionRatio", maxRatioValue)
}

func ValidateCacheRatioMapJSON(raw string) error {
	return validateFloatMapJSON(raw, "CacheRatio", maxRatioValue)
}

func ValidateCreateCacheRatioMapJSON(raw string) error {
	return validateFloatMapJSON(raw, "CreateCacheRatio", maxRatioValue)
}

func ValidateImageRatioMapJSON(raw string) error {
	return validateFloatMapJSON(raw, "ImageRatio", maxRatioValue)
}

func ValidateAudioRatioMapJSON(raw string) error {
	return validateFloatMapJSON(raw, "AudioRatio", maxRatioValue)
}

func ValidateAudioCompletionRatioMapJSON(raw string) error {
	return validateFloatMapJSON(raw, "AudioCompletionRatio", maxRatioValue)
}

// validateFloatMapJSON is the shared contract for every model -> number option
// written by the pricing editors. It parses the map and bounds every value so a
// hand-crafted request cannot persist a negative multiplier.
func validateFloatMapJSON(raw string, field string, limit float64) error {
	if strings.TrimSpace(raw) == "" {
		return fmt.Errorf("%s must be a JSON object", field)
	}
	values := make(map[string]float64)
	if err := common.UnmarshalJsonStr(raw, &values); err != nil {
		return fmt.Errorf("%s JSON invalid: %w", field, err)
	}
	for model, value := range values {
		if strings.TrimSpace(model) == "" {
			return fmt.Errorf("%s: model name must not be empty", field)
		}
		if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 || value > limit {
			return fmt.Errorf("%s[%q] must be a finite number between 0 and %g", field, model, limit)
		}
	}
	return nil
}
