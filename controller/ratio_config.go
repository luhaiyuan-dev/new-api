package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/setting/media_billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetRatioConfig(c *gin.Context) {
	if !ratio_setting.IsExposeRatioEnabled() {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "倍率配置接口未启用",
		})
		return
	}

	data := ratio_setting.GetExposedData()
	// Media price tables travel with the exposed ratio config so peer instances
	// can import them through the upstream ratio sync flow.
	if mediaModels := media_billing_setting.GetModelsCopy(); len(mediaModels) > 0 {
		data[mediaModelsSyncField] = mediaModels
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}
