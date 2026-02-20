import express from "express";
import pool from "../config/db.js";
import { convertMicrosToEuros, parseJsonArray } from "../utils/formatters.js";

const router = express.Router();

// ==========================================
// CAMPAIGN ROUTES
// ==========================================

// GET /api/campaign-metrics/:customer_id
router.get("/campaign-metrics/:customer_id", async (req, res) => {
    const { customer_id } = req.params;
    const { from, to } = req.query;

    if (!customer_id || isNaN(customer_id)) {
        return res.status(400).json({
            message: "El parámetro customer_id es requerido y debe ser numérico",
        });
    }
    if (!from || !to) {
        return res
            .status(400)
            .json({ message: "Los parámetros from y to son requeridos" });
    }

    try {
        const [rows] = await pool.query(
            `
SELECT 
    campaign_id,
    MAX(campaign_name) AS campaign_name,
    MAX(campaign_type) AS campaign_type,
    MAX(campaign_status) AS campaign_status,

    -- Totales
    SUM(impressions) AS impressions,
    SUM(clicks) AS clicks,
    COALESCE(SUM(clicks) / NULLIF(SUM(impressions), 0) * 100, 0) AS ctr, -- CTR %

    SUM(cost_micros) AS cost_micros,
    SUM(average_cpc_micros) AS average_cpc_micros, -- CPC medio
    SUM(conversions) AS conversions,
    SUM(conversions_value) AS conversions_value,  -- ✅ NUEVO: Valor total conversiones primarias
    SUM(conversion_rate) AS conversion_rate, -- Tasa conversión %
    SUM(cost_per_conversion_micros) AS cost_per_conversion_micros,
    SUM(all_conversions) AS all_conversions,
    SUM(all_conversions_value) AS all_conversions_value,  -- ✅ NUEVO: Valor total TODAS las conversiones

    -- Promedios
    AVG(value_per_all_conversions) AS value_per_all_conversions,
    AVG(budget_micros) AS budget_micros,
    AVG(search_impression_share) AS search_impression_share,
    AVG(search_rank_lost_impression_share) AS search_rank_lost_impression_share,
    AVG(search_budget_lost_impression_share) AS search_budget_lost_impression_share,

    -- ✅ KPIs calculados directamente en SQL
    CASE 
        WHEN SUM(cost_micros) > 0 
        THEN SUM(all_conversions_value) / (SUM(cost_micros) / 1000000)
        ELSE 0 
    END AS roas,  -- ✅ ROAS calculado

    CASE 
        WHEN SUM(all_conversions) > 0 
        THEN (SUM(cost_micros) / 1000000) / SUM(all_conversions)
        ELSE 0 
    END AS coste_por_conversion,  -- ✅ Coste/conv en euros

    CASE 
        WHEN SUM(clicks) > 0 
        THEN (SUM(all_conversions) / SUM(clicks)) * 100
        ELSE 0 
    END AS tasa_conversion_porcentaje,  -- ✅ Tasa conversión %

    -- Última fecha en el rango (para ordenar)
    MAX(date) AS last_date

FROM campaign_metrics_history
WHERE customer_id = ?
  AND date BETWEEN ? AND ?
GROUP BY campaign_id
ORDER BY last_date DESC
LIMIT 100;
      `,
            [customer_id, from, to]
        );

        const convertedRows = rows.map((row) => ({
            ...row,
            average_cpc_micros: convertMicrosToEuros(row.average_cpc_micros),
            cost_micros: convertMicrosToEuros(row.cost_micros),
            cost_per_conversion_micros: convertMicrosToEuros(
                row.cost_per_conversion_micros
            ),
            // Los nuevos campos ya vienen en euros/moneda correcta, no en micros
            conversions_value: row.conversions_value || 0,
            all_conversions_value: row.all_conversions_value || 0,
            // KPIs calculados ya vienen listos
            roas: row.roas || 0,
            coste_por_conversion: row.coste_por_conversion || 0,
            tasa_conversion_porcentaje: row.tasa_conversion_porcentaje || 0,
        }));

        res.json(convertedRows);
    } catch (error) {
        console.error("Error al obtener métricas de campañas:", error);
        res.status(500).json({
            message: "Error al obtener las métricas de campañas",
        });
    }
});

// GET /api/campaigns/:campaign_id/keywords
router.get("/campaigns/:campaign_id/keywords", async (req, res) => {
    const { campaign_id } = req.params;

    const { from, to } = req.query;

    if (!campaign_id || !from || !to) {
        return res.status(400).json({
            message: "Los parámetros campaign_id, from y to son requeridos",
        });
    }

    try {
        const [rows] = await pool.query(
            `
      SELECT 
        kw.criterion_id,
        kw.keyword_text,
        MIN(kw.customer_id) AS customer_id,
        MIN(cmh.campaign_id) AS campaign_id,
        MIN(cmh.campaign_name) AS campaign_name,
        MIN(kw.ad_group_id) AS ad_group_id,
        MIN(ag.ad_group_name) AS ad_group_name,
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
      WHERE kw.campaign_id = ?
        AND kw.date BETWEEN ? AND ?
      GROUP BY kw.criterion_id, kw.keyword_text
      ORDER BY kw.keyword_text ASC;
      `,
            [campaign_id, from, to]
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
            cost: convertMicrosToEuros(r.cost_micros),
            conversions: Number(r.conversions) || 0,
            ctr: Number(r.ctr) || 0,
            averageCpc: convertMicrosToEuros(r.average_cpc_micros),
            qualityScore: Number(r.quality_score) || 0,

            // ✅ Nuevos campos
            conversions_value: Number(r.conversions_value) || 0,
            all_conversions: Number(r.all_conversions) || 0,
            all_conversions_value: Number(r.all_conversions_value) || 0,

            // ✅ KPIs
            roas: Number(r.roas) || 0,
            coste_por_conversion: Number(r.coste_por_conversion) || 0,
            tasa_conversion: Number(r.tasa_conversion) || 0,
        }));

        res.json(result);
    } catch (error) {
        console.error("Error al obtener keywords:", error);
        res.status(500).json({ error: "Error al obtener keywords" });
    }
});

// GET /api/campaigns/:campaign_id/ad-groups
router.get("/campaigns/:campaign_id/ad-groups", async (req, res) => {
    const { campaign_id } = req.params;

    const { from, to } = req.query;

    if (!campaign_id || !from || !to) {
        return res.status(400).json({
            message: "Los parámetros campaign_id, from y to son requeridos"
        });
    }

    try {
        const [rows] = await pool.query(
            `
      SELECT
        ag.ad_group_id AS ad_group_id,
        ag.ad_group_name AS ad_group_name,
        MAX(ag.status) AS status,
        AVG(COALESCE(ag.bid_micros,0)) AS bid_micros,
        SUM(COALESCE(ag.impressions,0)) AS impressions,
        SUM(COALESCE(ag.clicks,0)) AS clicks,
        SUM(COALESCE(ag.cost_micros,0)) AS cost_micros,
        SUM(COALESCE(ag.conversions,0)) AS conversions,
        SUM(COALESCE(ag.conversions_value,0)) AS conversions_value,           -- ✅ NUEVO
        SUM(COALESCE(ag.all_conversions,0)) AS all_conversions,               -- ✅ NUEVO
        SUM(COALESCE(ag.all_conversions_value,0)) AS all_conversions_value,   -- ✅ NUEVO
        
        -- KPIs calculados
        CASE WHEN SUM(COALESCE(ag.clicks,0)) > 0
             THEN SUM(COALESCE(ag.cost_micros,0)) / SUM(COALESCE(ag.clicks,0))
             ELSE 0 END AS average_cpc_micros,
        CASE WHEN SUM(COALESCE(ag.impressions,0)) > 0
             THEN (SUM(COALESCE(ag.clicks,0)) / SUM(COALESCE(ag.impressions,0))) * 100
             ELSE 0 END AS ctr,
        CASE WHEN SUM(COALESCE(ag.cost_micros,0)) > 0
             THEN (SUM(COALESCE(ag.all_conversions_value,0)) / (SUM(COALESCE(ag.cost_micros,0)) / 1000000))
             ELSE 0 END AS roas,                                               -- ✅ ROAS
        CASE WHEN SUM(COALESCE(ag.all_conversions,0)) > 0
             THEN (SUM(COALESCE(ag.cost_micros,0)) / 1000000) / SUM(COALESCE(ag.all_conversions,0))
             ELSE 0 END AS coste_por_conversion,                               -- ✅ Coste/Conv
        CASE WHEN SUM(COALESCE(ag.clicks,0)) > 0
             THEN (SUM(COALESCE(ag.all_conversions,0)) / SUM(COALESCE(ag.clicks,0))) * 100
             ELSE 0 END AS tasa_conversion                                     -- ✅ Tasa Conv
             
      FROM ad_groups ag
      JOIN campaign_metrics_history cmh
        ON ag.campaign_id = cmh.campaign_id
       AND ag.customer_id = cmh.customer_id
       AND ag.date = cmh.date
      WHERE cmh.campaign_id = ? 
        AND ag.date BETWEEN ? AND ?
      GROUP BY ag.ad_group_id, ag.ad_group_name
      ORDER BY impressions DESC
      `,
            [campaign_id, from, to]
        );

        const result = rows.map((r) => ({
            ad_group_id: r.ad_group_id,
            ad_group_name: r.ad_group_name,
            status: r.status,
            bid: convertMicrosToEuros(r.bid_micros),
            impressions: Number(r.impressions) || 0,
            clicks: Number(r.clicks) || 0,
            cost: convertMicrosToEuros(r.cost_micros),
            average_cpc: convertMicrosToEuros(r.average_cpc_micros),
            conversions: Number(r.conversions) || 0,
            ctr: Number(r.ctr) || 0,

            // ✅ Nuevos campos
            conversions_value: Number(r.conversions_value) || 0,
            all_conversions: Number(r.all_conversions) || 0,
            all_conversions_value: Number(r.all_conversions_value) || 0,

            // ✅ KPIs
            roas: Number(r.roas) || 0,
            coste_por_conversion: Number(r.coste_por_conversion) || 0,
            tasa_conversion: Number(r.tasa_conversion) || 0,
        }));

        res.json(result);
    } catch (error) {
        console.error("Error al obtener ad groups de la campaña:", error);
        res.status(500).json({ error: "Error al obtener grupos de anuncios de la campaña" });
    }
});

// GET /api/campaigns/:campaign_id/search-terms
router.get("/campaigns/:campaign_id/search-terms", async (req, res) => {
    const { campaign_id } = req.params;

    const { from, to, ad_group_id } = req.query;

    if (!campaign_id) {
        return res.status(400).json({
            message: "El parámetro campaign_id es requerido",
        });
    }
    if (!from || !to) {
        return res
            .status(400)
            .json({ message: "Los parámetros from y to son requeridos" });
    }

    try {
        let query = `
      SELECT 
        st.search_term,
        st.keyword_text,
        st.match_type,
        cmh.campaign_id,
        SUM(COALESCE(st.impressions,0)) AS impressions,
        SUM(COALESCE(st.clicks,0)) AS clicks,
        CASE WHEN SUM(COALESCE(st.impressions,0)) > 0
             THEN (SUM(COALESCE(st.clicks,0)) / SUM(COALESCE(st.impressions,0))) * 100
             ELSE 0 END AS ctr,
        CASE WHEN SUM(COALESCE(st.clicks,0)) > 0
             THEN SUM(COALESCE(st.cost_micros,0)) / SUM(COALESCE(st.clicks,0))
             ELSE 0 END AS average_cpc_micros,
        SUM(COALESCE(st.cost_micros,0)) AS cost_micros,
        SUM(COALESCE(st.conversions,0)) AS conversions
      FROM search_terms st
      JOIN campaign_metrics_history cmh
        ON st.campaign_id = cmh.campaign_id
       AND st.customer_id = cmh.customer_id
       AND st.date = cmh.date
      WHERE cmh.campaign_id = ?
        AND st.date BETWEEN ? AND ?
    `;

        const params = [campaign_id, from, to];

        if (ad_group_id && !isNaN(ad_group_id)) {
            query += " AND st.ad_group_id = ?";
            params.push(ad_group_id);
        }

        query += `
      GROUP BY st.search_term, st.keyword_text, st.match_type, cmh.campaign_id
      ORDER BY impressions DESC
    `;

        const [rows] = await pool.query(query, params);

        const result = rows.map((r) => ({
            search_term: r.search_term,
            keyword_text: r.keyword_text,
            match_type: r.match_type,
            campaign_name: r.campaign_name,
            impressions: Number(r.impressions) || 0,
            clicks: Number(r.clicks) || 0,
            ctr: Number(r.ctr) || 0,
            average_cpc: r.average_cpc_micros ? r.average_cpc_micros / 1_000_000 : 0,
            cost: r.cost_micros ? r.cost_micros / 1_000_000 : 0,
            conversions: Number(r.conversions) || 0,
        }));

        res.json(result);
    } catch (error) {
        console.error("Error al obtener search terms:", error);
        res.status(500).json({ error: "Error al obtener search terms" });
    }
});

// GET /api/campaigns/:campaign_id/audience-segments
router.get("/campaigns/:campaign_id/audience-segments", async (req, res) => {
    const { campaign_id } = req.params;

    const { from, to } = req.query;

    if (!campaign_id) {
        return res
            .status(400)
            .json({ message: "El parámetro campaign_id es requerido" });
    }
    if (!from || !to) {
        return res
            .status(400)
            .json({ message: "Los parámetros from y to son requeridos" });
    }

    try {
        const [rows] = await pool.query(
            `
      SELECT 
        asg.customer_id,
        asg.campaign_id,
        cmh.campaign_id,
        asg.ad_group_id,
        asg.segment_type,
        asg.segment_value,
        SUM(asg.impressions) as impressions,
        SUM(asg.clicks) as clicks,
        CASE WHEN SUM(asg.impressions) > 0
             THEN (SUM(asg.clicks) / SUM(asg.impressions)) * 100
             ELSE 0 END AS ctr,
        SUM(asg.conversions) as conversions,
        SUM(asg.cost_micros) as cost_micros,
        AVG(asg.bid_modifier) as bid_modifier,
        MIN(asg.date) as date_from,
        MAX(asg.date) as date_to,
        MIN(asg.created_at) as created_at,
        SUM(asg.conversions_value) as conversions_value,
        AVG(asg.value_per_conversion) as value_per_conversion,
        AVG(asg.conversions_value_per_cost) as conversions_value_per_cost,
        SUM(asg.all_conversions_value) as all_conversions_value,
        AVG(asg.all_conversions_value_per_cost) as all_conversions_value_per_cost,
        SUM(asg.cost_per_all_conversions) as cost_per_all_conversions
      FROM audience_segments asg
      JOIN campaign_metrics_history cmh
        ON asg.campaign_id = cmh.campaign_id
       AND asg.customer_id = cmh.customer_id
       AND asg.date = cmh.date
      WHERE cmh.campaign_id = ?
        AND asg.date BETWEEN ? AND ?
      GROUP BY 
        asg.customer_id, 
        asg.campaign_id, 
        cmh.campaign_id,
        asg.ad_group_id, 
        asg.segment_type, 
        asg.segment_value
      ORDER BY asg.segment_type ASC
      `,
            [campaign_id, from, to]
        );

        const result = rows.map((segment) => ({
            customer_id: segment.customer_id,
            campaign_id: segment.campaign_id,
            campaign_name: segment.campaign_name,
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
        console.error("Error al obtener audience segments de la campaña:", error);
        res
            .status(500)
            .json({ error: "Error al obtener audience segments de la campaña" });
    }
});

// GET /api/campaigns/:campaign_id/asset-groups (PMax)
router.get("/campaigns/:campaign_id/asset-groups", async (req, res) => {
    const { campaign_id } = req.params;

    const { from, to } = req.query;

    try {
        const [rows] = await pool.query(
            `
      SELECT 
        asset_group_id,
        MAX(customer_id) AS customer_id,
        MAX(campaign_id) AS campaign_id,
        MAX(asset_group_name) AS asset_group_name,
        MAX(status) AS status,
        SUM(impressions) AS impressions,
        SUM(clicks) AS clicks,
        SUM(cost_micros) AS cost_micros,
        SUM(conversions) AS conversions,
        SUM(conversions_value) AS conversions_value,
        SUM(video_views) AS video_views,
        AVG(engagement_rate) AS engagement_rate,
        CASE WHEN SUM(impressions) > 0 
             THEN (SUM(clicks) / SUM(impressions)) * 100 
             ELSE 0 END AS ctr
      FROM asset_groups
      WHERE campaign_id = ?
        AND date BETWEEN ? AND ?
      GROUP BY asset_group_id
      ORDER BY impressions DESC
      `,
            [campaign_id, from, to]
        );

        const result = rows.map((ag) => ({
            id: ag.asset_group_id,
            assetGroupId: ag.asset_group_id,
            assetGroupName: ag.asset_group_name || "Grupo sin nombre",
            campaignId: ag.campaign_id,
            customerId: ag.customer_id,
            status: ag.status,
            impressions: Number(ag.impressions) || 0,
            clicks: Number(ag.clicks) || 0,
            cost: convertMicrosToEuros(ag.cost_micros),
            conversions: Number(ag.conversions) || 0,
            conversionsValue: Number(ag.conversions_value) || 0,
            ctr: Number(ag.ctr) || 0,
            videoViews: Number(ag.video_views) || 0,
            engagementRate: Number(ag.engagement_rate) || 0,
        }));

        res.json(result);
    } catch (err) {
        console.error("Error al obtener asset groups:", err);
        res.status(500).json({ error: "Error al obtener asset groups" });
    }
});

export default router;
