package media_billing_setting

import (
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaykitttypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/config"
)

// Unknown tier policies.
const (
	UnknownTierFallbackBase = "fallback_base"
	UnknownTierStrict       = "strict"
	// UnknownTierNearest picks the resolution tier with the closest pixel count
	// before falling back to the base price.
	UnknownTierNearest = "nearest"
)

// MaxDurationSeconds mirrors relaycommon.MaxTaskDurationSeconds. It is
// duplicated here because setting packages must not import relay/common
// (relay/common already imports setting packages).
const MaxDurationSeconds = 3600

// MediaBillingSetting is registered as "media_billing_setting" and stored as
// options rows: media_billing_setting.enabled / .unknown_tier_policy / .models.
type MediaBillingSetting struct {
	Enabled           bool                      `json:"enabled"`
	UnknownTierPolicy string                    `json:"unknown_tier_policy"`
	Models            map[string]MediaModelSpec `json:"models"`
}

// MediaModelSpec is the per-model media price definition.
type MediaModelSpec struct {
	Enabled   *bool   `json:"enabled,omitempty"`
	Kind      string  `json:"kind"`
	Unit      string  `json:"unit"`
	BasePrice float64 `json:"base_price,omitempty"`
	PerSecond float64 `json:"per_second,omitempty"`

	ResolutionTiers       map[string][]string `json:"resolution_tiers,omitempty"`
	DefaultResolutionTier string              `json:"default_resolution_tier,omitempty"`
	QualityTiers          []string            `json:"quality_tiers,omitempty"`
	QualityAliases        map[string]string   `json:"quality_aliases,omitempty"`
	DefaultQualityTier    string              `json:"default_quality_tier,omitempty"`

	PriceTable       map[string]map[string]float64 `json:"price_table,omitempty"`
	ResolutionRatios map[string]float64            `json:"resolution_ratios,omitempty"`
	QualityRatios    map[string]float64            `json:"quality_ratios,omitempty"`
	ExtraRatios      map[string]float64            `json:"extra_ratios,omitempty"`

	Duration DurationSpec `json:"duration,omitempty"`
}

// DurationSpec controls how a request duration is normalized before billing.
type DurationSpec struct {
	Min      float64 `json:"min,omitempty"`
	Max      float64 `json:"max,omitempty"`
	Default  float64 `json:"default,omitempty"`
	Rounding string  `json:"rounding,omitempty"` // ceil (default) | exact
}

var mediaBillingSetting = MediaBillingSetting{
	UnknownTierPolicy: UnknownTierFallbackBase,
	Models:            make(map[string]MediaModelSpec),
}

func init() {
	config.GlobalConfig.Register("media_billing_setting", &mediaBillingSetting)
}

func init() {
	common.SetModelKindResolver(GetModelKind)
}

func IsEnabled() bool {
	return mediaBillingSetting.Enabled
}

// GetModelsCopy returns a shallow copy of the configured media specs, keyed by
// model name.
func GetModelsCopy() map[string]MediaModelSpec {
	models := make(map[string]MediaModelSpec, len(mediaBillingSetting.Models))
	for model, spec := range mediaBillingSetting.Models {
		models[model] = spec
	}
	return models
}

// GetModelKind returns the media kind declared for a model, or "" when the
// model has no media spec. It is exposed to `common` as the endpoint-derivation
// source of truth, so it ignores the pricing switches: kind is metadata, not a
// billing decision.
func GetModelKind(model string) string {
	spec, ok := mediaBillingSetting.Models[model]
	if !ok {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(spec.Kind))
}

// DescribeModel reports the media kind and a short, language-neutral price
// summary for the public pricing API. The summary is only produced when media
// pricing is actually active, so a disabled switch never advertises prices the
// gateway will not charge.
func DescribeModel(model string) (kind string, summary string, ok bool) {
	spec, exists := mediaBillingSetting.Models[model]
	if !exists {
		return "", "", false
	}
	kind = strings.ToLower(strings.TrimSpace(spec.Kind))
	if kind == "" {
		return "", "", false
	}
	if !mediaBillingSetting.Enabled || (spec.Enabled != nil && !*spec.Enabled) {
		return kind, "", true
	}
	return kind, summarizeSpec(spec), true
}

// MediaPriceRange is the structured per-unit media price served by the public
// pricing API. Prices are CNY per billing unit (image, second, or call) so the
// pricing page can render a real price preview instead of parsing a summary.
type MediaPriceRange struct {
	Kind            string   `json:"kind"`
	Unit            string   `json:"unit"`
	MinPrice        float64  `json:"min_price"`
	MaxPrice        float64  `json:"max_price"`
	ResolutionTiers []string `json:"resolution_tiers,omitempty"`
	QualityTiers    []string `json:"quality_tiers,omitempty"`
	DefaultDuration float64  `json:"default_duration,omitempty"`
}

// DescribePriceRange reports the per-unit price range of a model's media spec.
// It returns false when media pricing is inactive or unpriced, so the public
// pricing page never advertises a price the gateway would not charge.
func DescribePriceRange(model string) (MediaPriceRange, bool) {
	spec, exists := mediaBillingSetting.Models[model]
	if !exists {
		return MediaPriceRange{}, false
	}
	kind := strings.ToLower(strings.TrimSpace(spec.Kind))
	if kind == "" || !mediaBillingSetting.Enabled || (spec.Enabled != nil && !*spec.Enabled) {
		return MediaPriceRange{}, false
	}

	priceRange := MediaPriceRange{
		Kind:            kind,
		Unit:            NormalizeUnit(spec.Unit),
		ResolutionTiers: mediaResolutionTiers(spec),
		QualityTiers:    append([]string(nil), spec.QualityTiers...),
	}

	switch priceRange.Unit {
	case relaykitttypes.UnitPerImage:
		minPrice, maxPrice := priceBounds(spec.PriceTable, spec.BasePrice)
		if minPrice <= 0 {
			return MediaPriceRange{}, false
		}
		priceRange.MinPrice, priceRange.MaxPrice = minPrice, maxPrice
	case relaykitttypes.UnitPerSecond:
		if spec.PerSecond <= 0 {
			return MediaPriceRange{}, false
		}
		minRatio, maxRatio := ratioBounds(spec.ResolutionRatios)
		priceRange.MinPrice = spec.PerSecond * minRatio
		priceRange.MaxPrice = spec.PerSecond * maxRatio
		priceRange.DefaultDuration = spec.Duration.Default
	case relaykitttypes.UnitPerCall:
		if spec.BasePrice <= 0 {
			return MediaPriceRange{}, false
		}
		priceRange.MinPrice, priceRange.MaxPrice = spec.BasePrice, spec.BasePrice
	default:
		return MediaPriceRange{}, false
	}

	if priceRange.MaxPrice < priceRange.MinPrice {
		priceRange.MaxPrice = priceRange.MinPrice
	}
	return priceRange, true
}

// mediaResolutionTiers merges every place a resolution tier can be declared so
// the preview lists the same tiers the editor accepts.
func mediaResolutionTiers(spec MediaModelSpec) []string {
	tiers := sortedTierKeys(spec.ResolutionTiers)
	seen := make(map[string]struct{}, len(tiers))
	for _, tier := range tiers {
		seen[tier] = struct{}{}
	}
	appendTier := func(tier string) {
		if _, ok := seen[tier]; ok {
			return
		}
		seen[tier] = struct{}{}
		tiers = append(tiers, tier)
	}
	for _, tier := range sortedRatioKeys(spec.ResolutionRatios) {
		appendTier(tier)
	}
	tableTiers := make([]string, 0, len(spec.PriceTable))
	for tier := range spec.PriceTable {
		if tier != "*" {
			tableTiers = append(tableTiers, tier)
		}
	}
	sort.Strings(tableTiers)
	for _, tier := range tableTiers {
		appendTier(tier)
	}
	return tiers
}

// priceBounds returns the cheapest and dearest positive price across the table
// cells and the base price.
func priceBounds(table map[string]map[string]float64, basePrice float64) (float64, float64) {
	cheapest, dearest := 0.0, 0.0
	consider := func(price float64) {
		if price <= 0 {
			return
		}
		if cheapest == 0 || price < cheapest {
			cheapest = price
		}
		if price > dearest {
			dearest = price
		}
	}
	for _, row := range table {
		for _, price := range row {
			consider(price)
		}
	}
	consider(basePrice)
	return cheapest, dearest
}

// ratioBounds returns the lowest and highest usable resolution ratio. A spec
// without ratios bills at a single rate, so both bounds are 1.
func ratioBounds(ratios map[string]float64) (float64, float64) {
	lowest, highest := 0.0, 0.0
	for tier, ratio := range ratios {
		if tier == "*" || ratio <= 0 {
			continue
		}
		if lowest == 0 || ratio < lowest {
			lowest = ratio
		}
		if ratio > highest {
			highest = ratio
		}
	}
	if lowest == 0 {
		return 1, 1
	}
	return lowest, highest
}

// summarizeSpec renders "@720p/1080p" style dimensions plus the base unit price.
func summarizeSpec(spec MediaModelSpec) string {
	switch NormalizeUnit(spec.Unit) {
	case relaykitttypes.UnitPerImage:
		price := spec.BasePrice
		if cheapest := cheapestPrice(spec.PriceTable); cheapest > 0 && (price <= 0 || cheapest < price) {
			price = cheapest
		}
		resolutions := sortedTierKeys(spec.ResolutionTiers)
		qualities := spec.QualityTiers
		dimensions := ""
		switch {
		case len(resolutions) > 0 && len(qualities) > 0:
			dimensions = strings.Join(resolutions, "/") + " × " + strings.Join(qualities, "/")
		case len(resolutions) > 0:
			dimensions = strings.Join(resolutions, "/")
		case len(qualities) > 0:
			dimensions = strings.Join(qualities, "/")
		}
		if dimensions == "" {
			return formatPrice(price) + "/image"
		}
		return formatPrice(price) + "/image · " + dimensions
	case relaykitttypes.UnitPerSecond:
		summary := formatPrice(spec.PerSecond) + "/s"
		resolutions := sortedTierKeys(spec.ResolutionTiers)
		if len(resolutions) == 0 {
			resolutions = sortedRatioKeys(spec.ResolutionRatios)
		}
		if len(resolutions) > 0 {
			summary += " @ " + strings.Join(resolutions, "/")
		}
		return summary
	case relaykitttypes.UnitPerCall:
		return formatPrice(spec.BasePrice) + "/call"
	default:
		return ""
	}
}

// sortedTierKeys orders tiers by the smallest pixel count they declare, which
// keeps "1k/2k/4k" and "720p/1080p/4k" readable without trusting map order.
func sortedTierKeys(tiers map[string][]string) []string {
	keys := make([]string, 0, len(tiers))
	for tier := range tiers {
		keys = append(keys, tier)
	}
	sort.Slice(keys, func(i, j int) bool {
		left, right := tierPixels(tiers[keys[i]]), tierPixels(tiers[keys[j]])
		if left != right {
			return left < right
		}
		return keys[i] < keys[j]
	})
	return keys
}

func tierPixels(sizes []string) int {
	smallest := 0
	for _, size := range sizes {
		widthStr, heightStr, found := strings.Cut(strings.ToLower(strings.TrimSpace(size)), "x")
		if !found {
			continue
		}
		width, widthErr := strconv.Atoi(strings.TrimSpace(widthStr))
		height, heightErr := strconv.Atoi(strings.TrimSpace(heightStr))
		if widthErr != nil || heightErr != nil {
			continue
		}
		if pixels := width * height; smallest == 0 || pixels < smallest {
			smallest = pixels
		}
	}
	return smallest
}

func sortedRatioKeys(ratios map[string]float64) []string {
	keys := make([]string, 0, len(ratios))
	for key := range ratios {
		if key == "*" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// cheapestPrice returns the smallest configured cell price, or 0 when the
// table is empty.
func cheapestPrice(table map[string]map[string]float64) float64 {
	cheapest := 0.0
	for _, row := range table {
		for _, price := range row {
			if price <= 0 {
				continue
			}
			if cheapest == 0 || price < cheapest {
				cheapest = price
			}
		}
	}
	return cheapest
}

func formatPrice(price float64) string {
	if price <= 0 {
		return "¥0"
	}
	return "¥" + strconv.FormatFloat(price, 'f', -1, 64)
}

func GetUnknownTierPolicy() string {
	policy := strings.TrimSpace(mediaBillingSetting.UnknownTierPolicy)
	if policy == "" {
		return UnknownTierFallbackBase
	}
	return policy
}

func NormalizeUnit(unit string) string {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case relaykitttypes.UnitPerCall:
		return relaykitttypes.UnitPerCall
	case relaykitttypes.UnitPerImage:
		return relaykitttypes.UnitPerImage
	case relaykitttypes.UnitPerSecond:
		return relaykitttypes.UnitPerSecond
	default:
		return relaykitttypes.UnitPerMillionTokens
	}
}

func isValidUnit(unit string) bool {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case relaykitttypes.UnitPerCall,
		relaykitttypes.UnitPerImage,
		relaykitttypes.UnitPerSecond,
		relaykitttypes.UnitPerMillionTokens:
		return true
	default:
		return false
	}
}

func isValidKind(kind string) bool {
	switch strings.ToLower(strings.TrimSpace(kind)) {
	case relaykitttypes.MediaKindImage,
		relaykitttypes.MediaKindVideo,
		relaykitttypes.MediaKindAudio,
		relaykitttypes.MediaKindMusic,
		relaykitttypes.MediaKindText,
		relaykitttypes.MediaKindEmbedding,
		relaykitttypes.MediaKindRerank:
		return true
	default:
		return false
	}
}
