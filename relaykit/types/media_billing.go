package types

// Media model kinds used by the media billing configuration.
const (
	MediaKindImage     = "image"
	MediaKindVideo     = "video"
	MediaKindAudio     = "audio"
	MediaKindMusic     = "music"
	MediaKindText      = "text"
	MediaKindEmbedding = "embedding"
	MediaKindRerank    = "rerank"
)

// Media billing units.
const (
	UnitPerMillionTokens = "per_1m_tokens"
	UnitPerCall          = "per_call"
	UnitPerImage         = "per_image"
	UnitPerSecond        = "per_second"
)

// MediaBillingMeta describes the billable dimensions of a request as reported
// by a channel adaptor. It intentionally carries raw request values only:
// tier normalization and prices are resolved from configuration, so adaptors
// never hard-code multipliers.
type MediaBillingMeta struct {
	Kind        string   `json:"kind,omitempty"`         // image | video | audio | music | text | embedding | rerank
	Count       int      `json:"count,omitempty"`        // generated item count (n)
	Size        string   `json:"size,omitempty"`         // raw size, e.g. 1024x1024
	Resolution  string   `json:"resolution,omitempty"`   // resolution hint, e.g. 1080p / 4k
	Quality     string   `json:"quality,omitempty"`      // raw quality, e.g. low / medium / high / auto / hd
	DurationSec float64  `json:"duration_sec,omitempty"` // media duration in seconds
	FPS         int      `json:"fps,omitempty"`          // frame rate; 0 when unknown
	Flags       []string `json:"flags,omitempty"`        // audio / video_input / edit / reference_image
}

func (m *MediaBillingMeta) HasFlag(flag string) bool {
	if m == nil {
		return false
	}
	for _, f := range m.Flags {
		if f == flag {
			return true
		}
	}
	return false
}

// ResolvedMediaPrice is the outcome of looking a request's media dimensions up
// in the configured price table. Quantity is the count of billed units:
// images for per_image, seconds for per_second, 1 for per_call.
type ResolvedMediaPrice struct {
	Kind                 string             `json:"kind,omitempty"`
	Unit                 string             `json:"unit,omitempty"`
	UnitPrice            float64            `json:"unit_price,omitempty"`
	Quantity             float64            `json:"quantity,omitempty"`
	ResolutionTier       string             `json:"resolution_tier,omitempty"`
	QualityTier          string             `json:"quality_tier,omitempty"`
	ResolutionMultiplier float64            `json:"resolution_multiplier,omitempty"`
	ExtraRatios          map[string]float64 `json:"extra_ratios,omitempty"`
	TierFallback         bool               `json:"tier_fallback,omitempty"`
}

// ExtraMultiplier returns the product of the applied extra ratios.
func (r *ResolvedMediaPrice) ExtraMultiplier() float64 {
	if r == nil {
		return 1
	}
	multiplier := 1.0
	for _, ratio := range r.ExtraRatios {
		multiplier *= ratio
	}
	return multiplier
}

// BaseMultiplier returns the product of every dimension multiplier except the
// unit price and quantity.
func (r *ResolvedMediaPrice) BaseMultiplier() float64 {
	if r == nil {
		return 1
	}
	multiplier := r.ExtraMultiplier()
	if r.ResolutionMultiplier > 0 && r.ResolutionMultiplier != 1 {
		multiplier *= r.ResolutionMultiplier
	}
	return multiplier
}
