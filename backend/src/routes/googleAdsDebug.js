import express from "express";
import { getGoogleAdsCustomer, safeQuery } from "../utils/googleAdsHelpers.js";
import { convertMicrosToEuros } from "../utils/formatters.js";

const router = express.Router();

// Endpoint para consultar keywords directamente desde Google Ads API
router.get("/debug/google-ads/keywords/:customer_id", async (req, res) => {
    const { customer_id } = req.params;
    const { campaign_id, ad_group_id, date } = req.query;

    if (!customer_id || isNaN(customer_id)) {
        return res.status(400).json({
            message: "El parámetro customer_id es requerido y debe ser numérico",
        });
    }

    if (!date) {
        return res.status(400).json({
            message: "El parámetro date es requerido (formato: YYYY-MM-DD)",
        });
    }

    try {
        // Obtener el cliente de Google Ads
        const customer = await getGoogleAdsCustomer(customer_id);

        if (!customer) {
            return res.status(404).json({
                message: `No se encontró configuración para customer_id: ${customer_id}`,
            });
        }

        const diagnostics = {
            customer_id,
            date,
            campaign_id: campaign_id || null,
            ad_group_id: ad_group_id || null,
            timestamp: new Date().toISOString(),
            source: "Google Ads API (LIVE)",
            queries_executed: [],
            results: {},
        };

        // ===== 1. CONSULTAR CAMPAÑAS (SIN FILTRO DE ESTADO) =====
        const campaignsQuery = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,  -- ✅ Mantener esto para ver el estado
    campaign.advertising_channel_type,
    metrics.impressions,
    metrics.clicks,
    metrics.ctr,
    metrics.cost_micros,
    metrics.conversions
  FROM campaign
  WHERE 1=1  -- ✅ CAMBIADO: quitar filtro de status
    ${campaign_id ? `AND campaign.id = ${campaign_id}` : ""}
    AND segments.date = '${date}'
  ORDER BY metrics.impressions DESC
  LIMIT 50
`;

        diagnostics.queries_executed.push({
            step: 1,
            query: "Campaigns",
            gaql: campaignsQuery,
        });

        const campaignsRaw = await safeQuery(customer, campaignsQuery, {
            retries: 3,
            baseDelay: 500,
        });

        diagnostics.results.campaigns = (campaignsRaw || []).map((c) => ({
            id: c?.campaign?.id,
            name: c?.campaign?.name,
            status: c?.campaign?.status,
            type: c?.campaign?.advertising_channel_type,
            impressions: c?.metrics?.impressions || 0,
            clicks: c?.metrics?.clicks || 0,
            ctr: c?.metrics?.ctr || 0,
            cost_micros: c?.metrics?.cost_micros || 0,
            cost_euros: convertMicrosToEuros(c?.metrics?.cost_micros || "0"),
            conversions: c?.metrics?.conversions || 0,
        }));

        // ===== 2. CONSULTAR AD GROUPS =====
        if (campaign_id || diagnostics.results.campaigns.length > 0) {
            const campaignsToQuery = campaign_id
                ? [campaign_id]
                : diagnostics.results.campaigns.map((c) => c.id);

            diagnostics.results.ad_groups = [];

            for (const cid of campaignsToQuery.slice(0, 5)) {
                // Limitar a 5 campañas
                const adGroupsQuery = `
          SELECT
            campaign.id,
            ad_group.id,
            ad_group.name,
            ad_group.status,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.cost_micros,
            metrics.conversions
          FROM ad_group
          WHERE ad_group.campaign = 'customers/${customer_id}/campaigns/${cid}'
            ${ad_group_id ? `AND ad_group.id = ${ad_group_id}` : ""}
            AND segments.date = '${date}'
          ORDER BY metrics.impressions DESC
          LIMIT 100
        `;

                diagnostics.queries_executed.push({
                    step: 2,
                    query: `Ad Groups for campaign ${cid}`,
                    gaql: adGroupsQuery,
                });

                const adGroupsRaw = await safeQuery(customer, adGroupsQuery, {
                    retries: 3,
                    baseDelay: 500,
                });

                diagnostics.results.ad_groups.push(
                    ...(adGroupsRaw || []).map((ag) => ({
                        campaign_id: cid,
                        id: ag?.ad_group?.id,
                        name: ag?.ad_group?.name,
                        status: ag?.ad_group?.status,
                        impressions: ag?.metrics?.impressions || 0,
                        clicks: ag?.metrics?.clicks || 0,
                        ctr: ag?.metrics?.ctr || 0,
                        cost_micros: ag?.metrics?.cost_micros || 0,
                        cost_euros: convertMicrosToEuros(ag?.metrics?.cost_micros || "0"),
                        conversions: ag?.metrics?.conversions || 0,
                    }))
                );
            }
        }

        // ===== 3. CONSULTAR KEYWORDS (SIN FILTRO DE ESTADO) =====
        diagnostics.results.keywords_no_filter = [];
        diagnostics.results.keywords_enabled_only = [];

        if (
            (campaign_id && ad_group_id) ||
            diagnostics.results.ad_groups.length > 0
        ) {
            const adGroupsToQuery = ad_group_id
                ? [{ campaign_id, ad_group_id }]
                : diagnostics.results.ad_groups
                    .slice(0, 5)
                    .map((ag) => ({ campaign_id: ag.campaign_id, ad_group_id: ag.id }));

            for (const { campaign_id: cid, ad_group_id: agid } of adGroupsToQuery) {
                // Query SIN filtro de estado
                const keywordsQueryNoFilter = `
          SELECT
            campaign.id,
            ad_group.id,
            ad_group_criterion.criterion_id,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.status,
            ad_group_criterion.negative,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.cost_micros,
            metrics.conversions
          FROM keyword_view
          WHERE campaign.id = ${cid}
            AND ad_group.id = ${agid}
            AND ad_group_criterion.negative = FALSE
            AND segments.date = '${date}'
          ORDER BY metrics.impressions DESC
          LIMIT 1000
        `;

                diagnostics.queries_executed.push({
                    step: 3,
                    query: `Keywords (NO filter) for campaign ${cid}, ad_group ${agid}`,
                    gaql: keywordsQueryNoFilter,
                });

                const keywordsRawNoFilter = await safeQuery(
                    customer,
                    keywordsQueryNoFilter,
                    { retries: 3, baseDelay: 500 }
                );

                diagnostics.results.keywords_no_filter.push(
                    ...(keywordsRawNoFilter || []).map((k) => ({
                        campaign_id: cid,
                        ad_group_id: agid,
                        criterion_id: k?.ad_group_criterion?.criterion_id,
                        keyword: k?.ad_group_criterion?.keyword?.text,
                        match_type: k?.ad_group_criterion?.keyword?.match_type,
                        status: k?.ad_group_criterion?.status,
                        is_negative: k?.ad_group_criterion?.negative,
                        impressions: k?.metrics?.impressions || 0,
                        clicks: k?.metrics?.clicks || 0,
                        ctr: k?.metrics?.ctr || 0,
                        cost_micros: k?.metrics?.cost_micros || 0,
                        cost_euros: convertMicrosToEuros(k?.metrics?.cost_micros || "0"),
                        conversions: k?.metrics?.conversions || 0,
                    }))
                );

                // Query CON filtro ENABLED
                const keywordsQueryEnabled = `
          SELECT
            campaign.id,
            ad_group.id,
            ad_group_criterion.criterion_id,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.status,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros
          FROM keyword_view
          WHERE campaign.id = ${cid}
            AND ad_group.id = ${agid}
            AND ad_group_criterion.status = 'ENABLED'
            AND ad_group_criterion.negative = FALSE
            AND segments.date = '${date}'
          ORDER BY metrics.impressions DESC
          LIMIT 1000
        `;

                diagnostics.queries_executed.push({
                    step: 4,
                    query: `Keywords (ENABLED only) for campaign ${cid}, ad_group ${agid}`,
                    gaql: keywordsQueryEnabled,
                });

                const keywordsRawEnabled = await safeQuery(
                    customer,
                    keywordsQueryEnabled,
                    { retries: 3, baseDelay: 500 }
                );

                diagnostics.results.keywords_enabled_only.push(
                    ...(keywordsRawEnabled || []).map((k) => ({
                        campaign_id: cid,
                        ad_group_id: agid,
                        criterion_id: k?.ad_group_criterion?.criterion_id,
                        keyword: k?.ad_group_criterion?.keyword?.text,
                        match_type: k?.ad_group_criterion?.keyword?.match_type,
                        status: k?.ad_group_criterion?.status,
                        impressions: k?.metrics?.impressions || 0,
                        clicks: k?.metrics?.clicks || 0,
                        cost_micros: k?.metrics?.cost_micros || 0,
                        cost_euros: convertMicrosToEuros(k?.metrics?.cost_micros || "0"),
                    }))
                );
            }
        }

        // ===== 4. RESUMEN Y COMPARACIÓN =====
        const campaignImpressions = diagnostics.results.campaigns.reduce(
            (sum, c) => sum + c.impressions,
            0
        );
        const adGroupImpressions = diagnostics.results.ad_groups.reduce(
            (sum, ag) => sum + ag.impressions,
            0
        );
        const keywordsNoFilterImpressions =
            diagnostics.results.keywords_no_filter.reduce(
                (sum, k) => sum + k.impressions,
                0
            );
        const keywordsEnabledImpressions =
            diagnostics.results.keywords_enabled_only.reduce(
                (sum, k) => sum + k.impressions,
                0
            );

        // Agrupar keywords por estado
        const keywordsByStatus = {};
        diagnostics.results.keywords_no_filter.forEach((k) => {
            if (!keywordsByStatus[k.status]) {
                keywordsByStatus[k.status] = {
                    count: 0,
                    impressions: 0,
                    clicks: 0,
                };
            }
            keywordsByStatus[k.status].count++;
            keywordsByStatus[k.status].impressions += k.impressions;
            keywordsByStatus[k.status].clicks += k.clicks;
        });

        diagnostics.summary = {
            campaign_impressions: campaignImpressions,
            ad_group_impressions: adGroupImpressions,
            keywords_no_filter_impressions: keywordsNoFilterImpressions,
            keywords_enabled_impressions: keywordsEnabledImpressions,
            total_campaigns: diagnostics.results.campaigns.length,
            total_ad_groups: diagnostics.results.ad_groups.length,
            total_keywords_no_filter: diagnostics.results.keywords_no_filter.length,
            total_keywords_enabled: diagnostics.results.keywords_enabled_only.length,
            keywords_by_status: keywordsByStatus,
            percentage_captured: {
                no_filter_vs_campaign:
                    campaignImpressions > 0
                        ? (
                            (keywordsNoFilterImpressions / campaignImpressions) *
                            100
                        ).toFixed(2) + "%"
                        : "0%",
                enabled_only_vs_campaign:
                    campaignImpressions > 0
                        ? (
                            (keywordsEnabledImpressions / campaignImpressions) *
                            100
                        ).toFixed(2) + "%"
                        : "0%",
            },
            discrepancy: {
                campaign_vs_keywords_no_filter:
                    campaignImpressions - keywordsNoFilterImpressions,
                campaign_vs_keywords_enabled:
                    campaignImpressions - keywordsEnabledImpressions,
            },
        };

        // ===== 5. DIAGNÓSTICO Y ALERTAS =====
        diagnostics.alerts = [];

        if (keywordsNoFilterImpressions === 0 && campaignImpressions > 0) {
            diagnostics.alerts.push({
                level: "CRITICAL",
                message:
                    "Google Ads API NO devuelve keywords con impresiones para esta fecha",
                possible_causes: [
                    "La campaña es Performance Max (no usa keywords tradicionales)",
                    "Las keywords fueron eliminadas antes de la consulta",
                    "Problema de permisos en la API",
                    "Las impresiones son de Display Network (no reporta keywords)",
                ],
            });
        }

        if (keywordsEnabledImpressions === 0 && keywordsNoFilterImpressions > 0) {
            diagnostics.alerts.push({
                level: "ERROR",
                message: "Hay keywords con impresiones pero NINGUNA está ENABLED",
                recommendation:
                    "Las keywords se pausaron/eliminaron después de tener impresiones. Elimina el filtro 'status = ENABLED' de tu query.",
            });
        }

        if (
            keywordsNoFilterImpressions > 0 &&
            keywordsNoFilterImpressions < campaignImpressions * 0.8
        ) {
            diagnostics.alerts.push({
                level: "WARNING",
                message: `Solo se capturan ${diagnostics.summary.percentage_captured.no_filter_vs_campaign} de las impresiones`,
                possible_causes: [
                    "Algunas búsquedas no se atribuyen a keywords específicas (concordancia amplia)",
                    "Impresiones de Display Network",
                    "Keywords con bajo volumen filtradas por privacidad",
                ],
            });
        }

        res.json(diagnostics);
    } catch (error) {
        console.error("Error consultando Google Ads API:", error);
        res.status(500).json({
            message: "Error al consultar Google Ads API",
            error: error.message,
            stack: error.stack,
        });
    }
});
// Endpoint para ver el estado REAL de la campaña en Google Ads
router.get(
    "/debug/google-ads/campaign-status/:customer_id/:campaign_id",
    async (req, res) => {
        const { customer_id, campaign_id } = req.params;

        try {
            const customer = await getGoogleAdsCustomer(customer_id);
            if (!customer) {
                return res.status(404).json({
                    message: `No se encontró configuración para customer_id: ${customer_id}`,
                });
            }

            // Query SIN segments.date para ver el estado actual
            const statusQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.serving_status
      FROM campaign
      WHERE campaign.id = ${campaign_id}
    `;

            const statusResult = await safeQuery(customer, statusQuery, {
                retries: 3,
                baseDelay: 500,
            });

            // Query CON fecha para ver métricas
            const metricsQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM campaign
      WHERE campaign.id = ${campaign_id}
        AND segments.date BETWEEN '2025-11-01' AND '2025-11-09'
      ORDER BY segments.date DESC
    `;

            const metricsResult = await safeQuery(customer, metricsQuery, {
                retries: 3,
                baseDelay: 500,
            });

            res.json({
                customer_id,
                campaign_id,
                status_info: (statusResult || []).map((c) => ({
                    id: c?.campaign?.id,
                    name: c?.campaign?.name,
                    status: c?.campaign?.status,
                    serving_status: c?.campaign?.serving_status,
                    type: c?.campaign?.advertising_channel_type,
                })),
                metrics_by_date: (metricsResult || []).map((c) => ({
                    id: c?.campaign?.id,
                    name: c?.campaign?.name,
                    status: c?.campaign?.status,
                    impressions: c?.metrics?.impressions || 0,
                    clicks: c?.metrics?.clicks || 0,
                    cost_micros: c?.metrics?.cost_micros || 0,
                })),
            });
        } catch (error) {
            console.error("Error consultando estado de campaña:", error);
            res.status(500).json({
                message: "Error al consultar estado de campaña",
                error: error.message,
            });
        }
    }
);

// Listar TODAS las campañas que Google Ads API devuelve (sin filtros)
router.get(
    "/debug/google-ads/all-campaigns/:customer_id",
    async (req, res) => {
        const { customer_id } = req.params;

        try {
            const customer = await getGoogleAdsCustomer(customer_id);
            if (!customer) {
                return res.status(404).json({
                    message: `No se encontró configuración para customer_id: ${customer_id}`,
                });
            }

            // Query súper simple: todas las campañas sin filtros
            const allCampaignsQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type
      FROM campaign
      ORDER BY campaign.id
    `;

            console.log(
                `🔍 Consultando todas las campañas para customer ${customer_id}...`
            );

            const allCampaigns = await safeQuery(customer, allCampaignsQuery, {
                retries: 3,
                baseDelay: 500,
            });

            console.log(
                `✅ Google Ads devolvió ${(allCampaigns || []).length} campañas`
            );

            res.json({
                count: (allCampaigns || []).length,
                campaigns: (allCampaigns || []).map((c) => ({
                    id: c?.campaign?.id,
                    name: c?.campaign?.name,
                    status: c?.campaign?.status,
                    type: c?.campaign?.advertising_channel_type,
                })),
            });
        } catch (error) {
            console.error("Error consultando todas las campañas:", error);
            res.status(500).json({
                message: "Error consultando campañas",
                error: error.message,
            });
        }
    }
);

export default router;
