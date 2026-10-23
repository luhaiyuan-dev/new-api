package common

// Media kinds used to derive supported endpoints for a model.
const (
	ModelKindImage = "image"
	ModelKindVideo = "video"
)

// modelKindResolver lets a setting package act as the source of truth for a
// model's media kind without making `common` depend on it.
var modelKindResolver func(modelName string) string

// SetModelKindResolver registers the media configuration as the kind resolver.
func SetModelKindResolver(resolver func(modelName string) string) {
	modelKindResolver = resolver
}

// GetModelKind resolves a model's media kind: the configured media spec wins,
// and the built-in image-name whitelist stays as the zero-config fallback.
func GetModelKind(modelName string) string {
	if modelKindResolver != nil {
		if kind := modelKindResolver(modelName); kind != "" {
			return kind
		}
	}
	if IsImageGenerationModel(modelName) {
		return ModelKindImage
	}
	return ""
}
