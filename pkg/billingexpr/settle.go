package billingexpr

import "github.com/QuantumNous/new-api/common"

// quotaConversion converts raw expression output to quota based on the
// expression version and billing unit. Token-unit expressions keep the
// historical "price per 1M tokens" formula; media units multiply by the
// resolved quantity and QuotaPerUnit.
func quotaConversion(exprOutput float64, snap *BillingSnapshot, params TokenParams) float64 {
	switch snap.ExprVersion {
	default: // v1
		return QuotaFromCost(exprOutput, snap.BillingUnit, params)
	}
}

// ComputeTieredQuota runs the Expr from a frozen BillingSnapshot against
// actual token counts and returns the settlement result.
func ComputeTieredQuota(snap *BillingSnapshot, params TokenParams) (TieredResult, error) {
	return ComputeTieredQuotaWithRequest(snap, params, RequestInput{})
}

func ComputeTieredQuotaWithRequest(snap *BillingSnapshot, params TokenParams, request RequestInput) (TieredResult, error) {
	params = snap.Media.Apply(params)

	cost, trace, err := RunExprByHashWithRequest(snap.ExprString, snap.ExprHash, params, request)
	if err != nil {
		return TieredResult{}, err
	}

	quotaBeforeGroup := quotaConversion(cost, snap, params)
	afterGroup, clamp := common.QuotaRoundChecked(quotaBeforeGroup * snap.GroupRatio)
	crossed := trace.MatchedTier != snap.EstimatedTier

	return TieredResult{
		ActualQuotaBeforeGroup: quotaBeforeGroup,
		ActualQuotaAfterGroup:  afterGroup,
		MatchedTier:            trace.MatchedTier,
		RequestRules:           trace.RequestRules,
		CrossedTier:            crossed,
		Clamp:                  clamp,
	}, nil
}
