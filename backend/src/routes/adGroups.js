import express from "express";
import pool from "../config/db.js";
import { convertMicrosToEuros, parseJsonArray } from "../utils/formatters.js";

const router = express.Router();

// GET /api/ad-groups/:ad_group_id/keywords
router.get("/ad-groups/:ad_group_id/keywords", async (req, res) => {
    const { ad_group_id } = req.params;
    const { from, to } = req.query;

    if (!ad_group_id || !from || !to) {
        return res.status(400).json({
            message: "Los parámetros ad_group_id, from y to son requeridos",
        });
    }

    try {
        const [rows] = await pool.query(
            `
      SELECT 
        kw.criterion_id,
        kw.keyword_text,
        MIN(kw.customer_id) AS customer_id,
        MIN(kw.campaign_id) AS campaign_id,
        MIN(kw.ad_group_id) AS ad_group_id,
        MIN(ag.ad_group_name) AS ad_group_name,
        MIN(cmh.campaign_name) AS campaign_name,
        MIN(kw.match_type) AS match_type,
        MIN(kw.status) AS keyword_status,

        SUM(kw.impressions) AS impressions,
        SUM(kw.clicks) AS clicks,
        SUM(kw.cost_micros) AS cost_micros,
        SUM(kw.conversions) AS conversions,
        SUM(kw.conversions_value) AS conversions_value,               -- ✅ NUEVO
        SUM(kw.all_conversions) AS all_conversions,                   -- ✅ NUEVO
        SUM(kw.all_conversions_value) AS all_conversions_value,       -- ✅ NUEVO

        -- KPIs calculados
        COALESCE(SUM(kw.clicks) / NULLIF(SUM(kw.impressions), 0) * 100, 0) AS ctr,
        AVG(kw.average_cpc_micros) AS average_cpc_micros,
        ROUND(AVG(kw.quality_score)) AS quality_score,
        CASE WHEN SUM(kw.cost_micros) > 0
             THEN (SUM(kw.all_conversions_value) / (SUM(kw.cost_micros) / 1000000))
             ELSE 0 END AS roas,                                       -- ✅ ROAS
        CASE WHEN SUM(kw.all_conversions) > 0
             THEN (SUM(kw.cost_micros) / 1000000) / SUM(kw.all_conversions)
             ELSE 0 END AS coste_por_conversion,                       -- ✅ Coste/Conv
        CASE WHEN SUM(kw.clicks) > 0
             THEN (SUM(kw.all_conversions) / SUM(kw.clicks)) * 100
             ELSE 0 END AS tasa_conversion                             -- ✅ Tasa Conv
             
      FROM keywords kw
      LEFT JOIN ad_groups ag 
        ON kw.customer_id = ag.customer_id 
       AND kw.campaign_id = ag.campaign_id 
       AND kw.ad_group_id = ag.ad_group_id
       AND kw.date = ag.date
      LEFT JOIN campaign_metrics_history cmh
        ON kw.customer_id = cmh.customer_id
       AND kw.campaign_id = cmh.campaign_id
       AND kw.date = cmh.date
      WHERE kw.ad_group_id = ?
        AND kw.date BETWEEN ? AND ?
      GROUP BY kw.criterion_id, kw.keyword_text
      ORDER BY kw.keyword_text ASC;
      `,
            [ad_group_id, from, to]
        );

        const result = rows.map((r) => ({
            keywordId: r.criterion_id,
            keywordText: r.keyword_text,
            customerId: r.customer_id,
            campaignId: r.campaign_id,
            campaignName: r.campaign_name,
            adGroupId: r.ad_group_id,
            adGroupName: r.ad_group_name,
            matchType: r.match_type,
            status: r.keyword_status,

            impressions: Number(r.impressions) || 0,
            clicks: Number(r.clicks) || 0,
            costMicros: Number(r.cost_micros) || 0,
            costEuros: convertMicrosToEuros(Number(r.cost_micros) || 0),
            conversions: Number(r.conversions) || 0,
            ctr: r.ctr != null ? Number(Number(r.ctr).toFixed(2)) : null,
            averageCpcMicros: r.average_cpc_micros != null ? Number(r.average_cpc_micros) : null,
            averageCpcEuros: r.average_cpc_micros != null
                ? convertMicrosToEuros(Number(r.average_cpc_micros))
                : null,
            qualityScore: r.quality_score != null ? Number(r.quality_score) : null,

            // ✅ Nuevos campos
            conversionsValue: Number(r.conversions_value) || 0,
            allConversions: Number(r.all_conversions) || 0,
            allConversionsValue: Number(r.all_conversions_value) || 0,

            // ✅ KPIs
            roas: Number(r.roas) || 0,
            costePorConversion: Number(r.coste_por_conversion) || 0,
            tasaConversion: Number(r.tasa_conversion) || 0,
        }));

        res.json(result);
    } catch (error) {
        console.error("Error al obtener keywords del ad group:", error);
        res.status(500).json({
            message: "Error al obtener las keywords del ad group",
        });
    }
});

// GET /api/ad-groups/:ad_group_id/ads
router.get("/ad-groups/:ad_group_id/ads", async (req, res) => {
    const { ad_group_id } = req.params;
    const { from, to } = req.query;

    try {
        const [rows] = await pool.query(
            `
      SELECT 
        ad_id,
        MAX(customer_id) AS customer_id,
        MAX(campaign_id) AS campaign_id,
        MAX(ad_group_id) AS ad_group_id,
        MAX(name) AS name,
        MAX(ad_type) AS ad_type,
        MAX(status) AS status,
        MAX(ad_headline) AS ad_headline,
        MAX(ad_description) AS ad_description,
        MAX(final_url) AS final_url,
        MAX(final_urls) AS final_urls,
        MAX(final_mobile_urls) AS final_mobile_urls,
        MAX(display_url) AS display_url,
        MAX(path1) AS path1,
        MAX(path2) AS path2,
        MAX(callouts) AS callouts,
        MAX(sitelinks) AS sitelinks,
        MAX(images) AS images,
        SUM(impressions) AS impressions,
        SUM(clicks) AS clicks,
        SUM(cost_micros) AS cost_micros,
        SUM(conversions) AS conversions,
        SUM(conversions_value) AS conversions_value,               -- ✅ NUEVO
        SUM(all_conversions) AS all_conversions,                   -- ✅ NUEVO
        SUM(all_conversions_value) AS all_conversions_value,       -- ✅ NUEVO
        
        -- KPIs calculados
        CASE WHEN SUM(clicks) > 0
             THEN SUM(cost_micros) / SUM(clicks)
             ELSE 0 END AS average_cpc_micros,
        CASE WHEN SUM(impressions) > 0
             THEN (SUM(clicks) / SUM(impressions)) * 100
             ELSE 0 END AS ctr,
        CASE WHEN SUM(cost_micros) > 0
             THEN (SUM(all_conversions_value) / (SUM(cost_micros) / 1000000))
             ELSE 0 END AS roas,                                   -- ✅ ROAS
        CASE WHEN SUM(all_conversions) > 0
             THEN (SUM(cost_micros) / 1000000) / SUM(all_conversions)
             ELSE 0 END AS coste_por_conversion,                   -- ✅ Coste/Conv
        CASE WHEN SUM(clicks) > 0
             THEN (SUM(all_conversions) / SUM(clicks)) * 100
             ELSE 0 END AS tasa_conversion,                        -- ✅ Tasa Conv
             
        MIN(created_at) AS created_at
      FROM ads
      WHERE ad_group_id = ?
        AND date BETWEEN ? AND ?
      GROUP BY ad_id
      ORDER BY clicks DESC
      `,
            [ad_group_id, from, to]
        );


        const result = rows.map((ad) => ({
            ad_id: ad.ad_id,
            customer_id: ad.customer_id,
            campaign_id: ad.campaign_id,
            ad_group_id: ad.ad_group_id,
            name: ad.name,
            ad_headline: parseJsonArray(ad.ad_headline),
            ad_description: parseJsonArray(ad.ad_description),
            ad_type: ad.ad_type,
            status: ad.status,

            // URLs
            final_url: ad.final_url || null,
            final_urls: parseJsonArray(ad.final_urls),
            final_mobile_urls: parseJsonArray(ad.final_mobile_urls),
            display_url: ad.display_url || null,
            path1: ad.path1 || null,
            path2: ad.path2 || null,

            // Métricas básicas
            impressions: Number(ad.impressions) || 0,
            clicks: Number(ad.clicks) || 0,
            ctr: Number(ad.ctr) || 0,
            average_cpc: convertMicrosToEuros(ad.average_cpc_micros),
            cost: convertMicrosToEuros(ad.cost_micros),
            conversions: Number(ad.conversions) || 0,

            // ✅ Nuevos campos de conversión
            conversions_value: Number(ad.conversions_value) || 0,
            all_conversions: Number(ad.all_conversions) || 0,
            all_conversions_value: Number(ad.all_conversions_value) || 0,

            // ✅ KPIs calculados
            roas: Number(ad.roas) || 0,
            coste_por_conversion: Number(ad.coste_por_conversion) || 0,
            tasa_conversion: Number(ad.tasa_conversion) || 0,

            created_at: ad.created_at,

            // Extensiones
            callouts: parseJsonArray(ad.callouts),
            sitelinks: parseJsonArray(ad.sitelinks),
            images: parseJsonArray(ad.images),
        }));

        res.json(result);
    } catch (error) {
        console.error("Error al obtener anuncios del grupo:", error);
        res.status(500).json({ error: "Error al obtener anuncios del grupo de anuncios" });
    }
});

// GET /api/ad-groups/:ad_group_id/audience-segments
router.get("/ad-groups/:ad_group_id/audience-segments", async (req, res) => {
    const { ad_group_id } = req.params;
    const { from, to } = req.query;

    try {
        const [rows] = await pool.query(
            `
      SELECT 
        customer_id,
        campaign_id,
        ad_group_id,
        segment_type,
        segment_value,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        AVG(ctr) as ctr,
        SUM(conversions) as conversions,
        SUM(cost_micros) as cost_micros,
        AVG(bid_modifier) as bid_modifier,
        MIN(date) as date_from,
        MAX(date) as date_to,
        MIN(created_at) as created_at,
        SUM(conversions_value) as conversions_value,
        AVG(value_per_conversion) as value_per_conversion,
        AVG(conversions_value_per_cost) as conversions_value_per_cost,
        SUM(all_conversions_value) as all_conversions_value,
        AVG(all_conversions_value_per_cost) as all_conversions_value_per_cost,
        SUM(cost_per_all_conversions) as cost_per_all_conversions
      FROM audience_segments
      WHERE ad_group_id = ?
        AND date BETWEEN ? AND ?
      GROUP BY customer_id, campaign_id, ad_group_id, segment_type, segment_value
      ORDER BY segment_type ASC
      `,
            [ad_group_id, from, to]
        );

        const result = rows.map((segment) => ({
            customer_id: segment.customer_id,
            campaign_id: segment.campaign_id,
            ad_group_id: segment.ad_group_id,
            segment_type: segment.segment_type,
            segment_value: segment.segment_value,
            impressions: segment.impressions || 0,
            clicks: segment.clicks || 0,
            ctr: Number(segment.ctr) || 0,
            conversions: Number(segment.conversions) || 0,
            cost: segment.cost_micros ? convertMicrosToEuros(segment.cost_micros) : 0,
            bid_modifier: Number(segment.bid_modifier) || 0,
            date_from: segment.date_from,
            date_to: segment.date_to,
            created_at: segment.created_at,
            conversions_value: Number(segment.conversions_value) || 0,
            value_per_conversion: Number(segment.value_per_conversion) || 0,
            conversions_value_per_cost:
                Number(segment.conversions_value_per_cost) || 0,
            all_conversions_value: Number(segment.all_conversions_value) || 0,
            all_conversions_value_per_cost:
                Number(segment.all_conversions_value_per_cost) || 0,
            cost_per_all_conversions: segment.cost_per_all_conversions
                ? convertMicrosToEuros(segment.cost_per_all_conversions)
                : 0,
        }));

        res.json(result);
    } catch (error) {
        console.error("Error al obtener audience segments del ad group:", error);
        res
            .status(500)
            .json({ error: "Error al obtener audience segments del ad group" });
    }
});

export default router;
