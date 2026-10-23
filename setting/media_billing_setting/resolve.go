package media_billing_setting

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	relaykitttypes "github.com/QuantumNous/new-api/relaykit/types"
)

// Resolve looks up a request's raw media dimensions in the configured price
// table. It returns ok=false when the model has no enabled media spec or when
// the spec is token-priced (the legacy ModelRatio path owns that case).
func Resolve(model string, meta *relaykitttypes.MediaBillingMeta) (relaykitttypes.ResolvedMediaPrice, bool, error) {
	if !mediaBillingSetting.Enabled {
		return relaykitttypes.ResolvedMediaPrice{}, false, nil
	}
	spec, ok := mediaBillingSetting.Models[model]
	if !ok {
		return relaykitttypes.ResolvedMediaPrice{}, false, nil
	}
	if spec.Enabled != nil && !*spec.Enabled {
		return relaykitttypes.ResolvedMediaPrice{}, false, nil
	}

	unit := NormalizeUnit(spec.Unit)
	if unit == relaykitttypes.UnitPerMillionTokens {
		return relaykitttypes.ResolvedMediaPrice{}, false, nil
	}

	if meta == nil {
		meta = &relaykitttypes.MediaBillingMeta{}
	}
	kind := strings.ToLower(strings.TrimSpace(spec.Kind))
	if kind == "" {
		kind = strings.ToLower(strings.TrimSpace(meta.Kind))
	}

	resolved := relaykitttypes.ResolvedMediaPrice{
		Kind: kind,
		Unit: unit,
	}
	if spec.ExtraRatios != nil {
		for _, flag := range meta.Flags {
			ratio, exists := spec.ExtraRatios[flag]
			if !exists || !isValidRatio(ratio) {
				continue
			}
			if resolved.ExtraRatios == nil {
				resolved.ExtraRatios = make(map[string]float64)
			}
			resolved.ExtraRatios[flag] = ratio
		}
	}

	switch unit {
	case relaykitttypes.UnitPerImage:
		quantity := meta.Count
		if quantity <= 0 {
			quantity = 1
		}
		tier, fallback := resolveResolutionTier(spec, meta)
		quality, qualityFallback := resolveQualityTier(spec, meta)
		price, priceFallback, err := lookupImagePrice(spec, tier, quality)
		if err != nil {
			return relaykitttypes.ResolvedMediaPrice{}, false, err
		}
		resolved.UnitPrice = price
		resolved.Quantity = float64(quantity)
		resolved.ResolutionTier = tier
		resolved.QualityTier = quality
		resolved.TierFallback = fallback || qualityFallback || priceFallback

	case relaykitttypes.UnitPerSecond:
		duration, err := resolveDuration(spec, meta)
		if err != nil {
			return relaykitttypes.ResolvedMediaPrice{}, false, err
		}
		tier, fallback := resolveResolutionTier(spec, meta)
		resolved.UnitPrice = spec.PerSecond
		resolved.Quantity = duration
		resolved.ResolutionTier = tier
		resolved.ResolutionMultiplier = ratioOrDefault(spec.ResolutionRatios, tier)
		resolved.TierFallback = fallback

	case relaykitttypes.UnitPerCall:
		resolved.UnitPrice = spec.BasePrice
		resolved.Quantity = 1

	default:
		return relaykitttypes.ResolvedMediaPrice{}, false, nil
	}

	if resolved.UnitPrice <= 0 || math.IsNaN(resolved.UnitPrice) || math.IsInf(resolved.UnitPrice, 0) {
		return relaykitttypes.ResolvedMediaPrice{}, false, fmt.Errorf("media price for model %s is not configured", model)
	}
	if resolved.Quantity <= 0 {
		return relaykitttypes.ResolvedMediaPrice{}, false, fmt.Errorf("media quantity for model %s must be positive", model)
	}
	if resolved.TierFallback && GetUnknownTierPolicy() == UnknownTierStrict {
		return relaykitttypes.ResolvedMediaPrice{}, false, fmt.Errorf("model %s: unknown resolution or quality tier", model)
	}
	return resolved, true, nil
}

// ResolveTiers normalizes raw size/quality into configuration tier keys for
// expression variables. Models without a media spec keep their raw values.
func ResolveTiers(model string, meta *relaykitttypes.MediaBillingMeta) (string, string) {
	if meta == nil {
		return "", ""
	}
	rawResolution := strings.ToLower(strings.TrimSpace(meta.Resolution))
	rawQuality := strings.ToLower(strings.TrimSpace(meta.Quality))

	spec, ok := mediaBillingSetting.Models[model]
	if !ok {
		return rawResolution, rawQuality
	}
	resolution, _ := resolveResolutionTier(spec, meta)
	quality, _ := resolveQualityTier(spec, meta)
	if resolution == "" {
		resolution = rawResolution
	}
	if quality == "" {
		quality = rawQuality
	}
	return resolution, quality
}

func resolveResolutionTier(spec MediaModelSpec, meta *relaykitttypes.MediaBillingMeta) (string, bool) {
	size := normalizeSize(meta.Size)
	if size != "" {
		for tier, sizes := range spec.ResolutionTiers {
			for _, candidate := range sizes {
				if normalizeSize(candidate) == size {
					return tier, false
				}
			}
		}
	}

	hint := normalizeResolutionKey(meta.Resolution)
	if hint != "" && hasResolutionTier(spec, hint) {
		return hint, false
	}

	if tier := nearestResolutionTier(spec, size); tier != "" {
		return tier, true
	}

	if spec.DefaultResolutionTier != "" {
		return spec.DefaultResolutionTier, true
	}
	if tier := singleResolutionTier(spec); tier != "" {
		return tier, true
	}
	return "", true
}

// nearestResolutionTier picks the tier whose declared sizes are closest in pixel
// count to the requested size. Key-only tiers (matched by name) carry no pixel
// information and therefore fall through to the default resolution tier.
func nearestResolutionTier(spec MediaModelSpec, size string) string {
	if size == "" || GetUnknownTierPolicy() != UnknownTierNearest {
		return ""
	}
	width, height, parsed := parseSizePixels(size)
	if !parsed {
		return ""
	}
	target := width * height
	bestTier, bestDistance := "", 0
	for tier, sizes := range spec.ResolutionTiers {
		for _, candidate := range sizes {
			candidateWidth, candidateHeight, candidateParsed := parseSizePixels(normalizeSize(candidate))
			if !candidateParsed {
				continue
			}
			distance := candidateWidth*candidateHeight - target
			if distance < 0 {
				distance = -distance
			}
			if bestTier == "" || distance < bestDistance || (distance == bestDistance && tier < bestTier) {
				bestTier, bestDistance = tier, distance
			}
		}
	}
	return bestTier
}

func parseSizePixels(size string) (int, int, bool) {
	widthPart, heightPart, found := strings.Cut(strings.ToLower(strings.TrimSpace(size)), "x")
	if !found {
		return 0, 0, false
	}
	width, widthErr := strconv.Atoi(strings.TrimSpace(widthPart))
	height, heightErr := strconv.Atoi(strings.TrimSpace(heightPart))
	if widthErr != nil || heightErr != nil || width <= 0 || height <= 0 {
		return 0, 0, false
	}
	return width, height, true
}

func resolveQualityTier(spec MediaModelSpec, meta *relaykitttypes.MediaBillingMeta) (string, bool) {
	quality := strings.ToLower(strings.TrimSpace(meta.Quality))
	if quality != "" {
		if mapped, ok := spec.QualityAliases[quality]; ok && mapped != "" {
			quality = strings.ToLower(strings.TrimSpace(mapped))
		}
		if hasQualityTier(spec, quality) {
			return quality, false
		}
	}
	if spec.DefaultQualityTier != "" {
		return spec.DefaultQualityTier, true
	}
	if quality := singleQualityTier(spec); quality != "" {
		return quality, true
	}
	return "", true
}

func lookupImagePrice(spec MediaModelSpec, resolutionTier, qualityTier string) (float64, bool, error) {
	if row, ok := spec.PriceTable[resolutionTier]; ok {
		if price, ok := row[qualityTier]; ok && price > 0 {
			return price, false, nil
		}
		if price, ok := row["*"]; ok && price > 0 {
			return price, true, nil
		}
	}
	if row, ok := spec.PriceTable["*"]; ok {
		if price, ok := row[qualityTier]; ok && price > 0 {
			return price, true, nil
		}
	}

	if spec.BasePrice > 0 {
		price := spec.BasePrice
		if ratio, ok := spec.ResolutionRatios[resolutionTier]; ok && ratio > 0 {
			price *= ratio
		}
		if ratio, ok := spec.QualityRatios[qualityTier]; ok && ratio > 0 {
			price *= ratio
		}
		return price, true, nil
	}
	return 0, true, fmt.Errorf("no image price configured for tier %q/%q", resolutionTier, qualityTier)
}

func resolveDuration(spec MediaModelSpec, meta *relaykitttypes.MediaBillingMeta) (float64, error) {
	duration := meta.DurationSec
	if duration <= 0 {
		duration = spec.Duration.Default
	}
	if duration <= 0 {
		return 0, fmt.Errorf("duration is required for per-second billing")
	}

	maxDuration := spec.Duration.Max
	if maxDuration <= 0 {
		maxDuration = MaxDurationSeconds
	}
	if maxDuration > MaxDurationSeconds {
		maxDuration = MaxDurationSeconds
	}
	if duration > maxDuration {
		return 0, fmt.Errorf("duration %.2fs exceeds the allowed maximum %.0fs", duration, maxDuration)
	}
	if spec.Duration.Min > 0 && duration < spec.Duration.Min {
		duration = spec.Duration.Min
	}

	if strings.ToLower(strings.TrimSpace(spec.Duration.Rounding)) != "exact" {
		duration = math.Ceil(duration)
	}
	return duration, nil
}

func hasResolutionTier(spec MediaModelSpec, tier string) bool {
	if tier == "" {
		return false
	}
	if _, ok := spec.ResolutionTiers[tier]; ok {
		return true
	}
	if _, ok := spec.ResolutionRatios[tier]; ok {
		return true
	}
	_, ok := spec.PriceTable[tier]
	return ok
}

func hasQualityTier(spec MediaModelSpec, quality string) bool {
	if quality == "" {
		return false
	}
	for _, candidate := range spec.QualityTiers {
		if strings.EqualFold(strings.TrimSpace(candidate), quality) {
			return true
		}
	}
	if _, ok := spec.QualityRatios[quality]; ok {
		return true
	}
	for _, row := range spec.PriceTable {
		if _, ok := row[quality]; ok {
			return true
		}
	}
	return false
}

func singleResolutionTier(spec MediaModelSpec) string {
	tiers := make(map[string]struct{})
	for tier := range spec.ResolutionTiers {
		tiers[tier] = struct{}{}
	}
	for tier := range spec.ResolutionRatios {
		if tier != "*" {
			tiers[tier] = struct{}{}
		}
	}
	for tier := range spec.PriceTable {
		if tier != "*" {
			tiers[tier] = struct{}{}
		}
	}
	if len(tiers) == 1 {
		for tier := range tiers {
			return tier
		}
	}
	return ""
}

func singleQualityTier(spec MediaModelSpec) string {
	tiers := make(map[string]struct{})
	for _, tier := range spec.QualityTiers {
		tiers[strings.ToLower(strings.TrimSpace(tier))] = struct{}{}
	}
	for tier := range spec.QualityRatios {
		tiers[tier] = struct{}{}
	}
	for _, row := range spec.PriceTable {
		for tier := range row {
			if tier != "*" {
				tiers[tier] = struct{}{}
			}
		}
	}
	if len(tiers) == 1 {
		for tier := range tiers {
			return tier
		}
	}
	return ""
}

func ratioOrDefault(ratios map[string]float64, key string) float64 {
	if ratio, ok := ratios[key]; ok && ratio > 0 {
		return ratio
	}
	return 1
}

func normalizeSize(size string) string {
	return strings.ToLower(strings.TrimSpace(size))
}

func normalizeResolutionKey(resolution string) string {
	key := strings.ToLower(strings.TrimSpace(resolution))
	if key == "" {
		return ""
	}
	if isDigits(key) {
		key += "p"
	}
	return key
}

func isDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, char := range value {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}
