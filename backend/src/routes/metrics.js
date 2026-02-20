import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// Helper func from index.js
function convertMicrosToEuros(micros) {
  return Number((micros / 1000000).toFixed(2));
}

router.get("/account-metrics/:customer_id", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "No autenticado" });
  }

  const { customer_id } = req.params;
  const { from, to } = req.query;

  // Validación de parámetros
  if (!customer_id || !from || !to) {
    return res.status(400).json({
      error: "Los parámetros customer_id, from y to son requeridos",
    });
  }

  try {
    // === CONSULTA PRINCIPAL (corregida) ===
    const [rows] = await pool.execute(
      `SELECT 
        SUM(cmh.impressions) AS impressions,
        SUM(cmh.clicks) AS clicks,
        COALESCE(SUM(cmh.clicks) / NULLIF(SUM(cmh.impressions), 0) * 100, 0) AS ctr,
        CASE 
          WHEN SUM(clicks) > 0 
          THEN SUM(cost_micros) / SUM(clicks) 
          ELSE 0 
        END AS average_cpc_micros,
        SUM(cmh.cost_micros) AS cost_micros,
        SUM(cmh.conversions) AS conversions,
        CASE 
          WHEN SUM(clicks) > 0 
          THEN (SUM(conversions) / SUM(clicks)) * 100
          ELSE 0 
        END AS conversion_rate,
        CASE 
          WHEN SUM(conversions) > 0 
          THEN SUM(cost_micros) / SUM(conversions) 
          ELSE 0 
        END AS cost_per_conversion_micros
       FROM campaign_metrics_history cmh
       WHERE cmh.customer_id = ? AND cmh.date BETWEEN ? AND ?
       GROUP BY cmh.customer_id`,
      [customer_id, from, to]
    );

    // Si no hay datos, devolver estructura vacía
    if (!rows || rows.length === 0) {
      return res.json({
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        cpc: 0,
        conversionRate: 0,
        costPerConversion: 0,
        changes: {
          spend: "0%",
          impressions: "0%",
          clicks: "0%",
          conversions: "0%",
          ctr: "0%",
          cpc: "0%",
          conversionRate: "0%",
          costPerConversion: "0%",
        },
      });
    }

    const data = rows[0];

    // Convertir micros a valores normales
    const spend = (data.cost_micros || 0) / 1000000;
    const cpc = (data.average_cpc_micros || 0) / 1000000;
    const costPerConversion = (data.cost_per_conversion_micros || 0) / 1000000;

    // Estructura de respuesta principal
    const currentMetrics = {
      spend: spend,
      impressions: parseInt(data.impressions || 0),
      clicks: parseInt(data.clicks || 0),
      conversions: parseInt(data.conversions || 0),
      ctr: parseFloat(data.ctr || 0),
      cpc: cpc,
      conversionRate: parseFloat(data.conversion_rate || 0),
      costPerConversion: costPerConversion,
    };

    // === LÓGICA PARA COMPARACIÓN ===
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Calcular la duración del período
    const periodDurationMs = toDate.getTime() - fromDate.getTime();

    // Calcular fechas del período anterior
    const previousToDate = new Date(fromDate.getTime() - 1); // Un día antes del inicio del período actual
    const previousFromDate = new Date(
      previousToDate.getTime() - periodDurationMs
    );

    // Formatear fechas para la consulta SQL
    const formatDate = (date) => date.toISOString().split("T")[0];
    const previousFrom = formatDate(previousFromDate);
    const previousTo = formatDate(previousToDate);

    // Consulta para el período anterior (IGUAL que la principal pero con fechas diferentes)
    const [previousRows] = await pool.execute(
      `SELECT 
        SUM(cmh.impressions) AS impressions,
        SUM(cmh.clicks) AS clicks,
        COALESCE(SUM(cmh.clicks) / NULLIF(SUM(cmh.impressions), 0) * 100, 0) AS ctr,
        CASE 
          WHEN SUM(clicks) > 0 
          THEN SUM(cost_micros) / SUM(clicks) 
          ELSE 0 
        END AS average_cpc_micros,
        SUM(cmh.cost_micros) AS cost_micros,
        SUM(cmh.conversions) AS conversions,
        CASE 
          WHEN SUM(clicks) > 0 
          THEN (SUM(conversions) / SUM(clicks)) * 100
          ELSE 0 
        END AS conversion_rate,
        CASE 
          WHEN SUM(conversions) > 0 
          THEN SUM(cost_micros) / SUM(conversions) 
          ELSE 0 
        END AS cost_per_conversion_micros
       FROM campaign_metrics_history cmh
       WHERE cmh.customer_id = ? AND cmh.date BETWEEN ? AND ?
       GROUP BY cmh.customer_id`,
      [customer_id, previousFrom, previousTo]
    );

    // Procesar datos del período anterior
    let previousMetrics = {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      ctr: 0,
      cpc: 0,
      conversionRate: 0,
      costPerConversion: 0,
    };

    if (previousRows && previousRows.length > 0) {
      const previousData = previousRows[0];
      const previousSpend = (previousData.cost_micros || 0) / 1000000;
      const previousCpc = (previousData.average_cpc_micros || 0) / 1000000;
      const previousCostPerConversion =
        (previousData.cost_per_conversion_micros || 0) / 1000000;

      previousMetrics = {
        spend: previousSpend,
        impressions: parseInt(previousData.impressions || 0),
        clicks: parseInt(previousData.clicks || 0),
        conversions: parseInt(previousData.conversions || 0),
        ctr: parseFloat(previousData.ctr || 0),
        cpc: previousCpc,
        conversionRate: parseFloat(previousData.conversion_rate || 0),
        costPerConversion: previousCostPerConversion,
      };
    }

    // Función para calcular el cambio porcentual
    const calculateChange = (current, previous) => {
      if (!previous || previous === 0) {
        return current > 0 ? "+100%" : "0%";
      }

      const change = ((current - previous) / previous) * 100;
      const sign = change >= 0 ? "+" : "";
      return `${sign}${change.toFixed(1)}%`;
    };

    // Calcular cambios porcentuales
    const changes = {
      spend: calculateChange(currentMetrics.spend, previousMetrics.spend),
      impressions: calculateChange(
        currentMetrics.impressions,
        previousMetrics.impressions
      ),
      clicks: calculateChange(currentMetrics.clicks, previousMetrics.clicks),
      conversions: calculateChange(
        currentMetrics.conversions,
        previousMetrics.conversions
      ),
      ctr: calculateChange(currentMetrics.ctr, previousMetrics.ctr),
      cpc: calculateChange(currentMetrics.cpc, previousMetrics.cpc),
      conversionRate: calculateChange(
        currentMetrics.conversionRate,
        previousMetrics.conversionRate
      ),
      costPerConversion: calculateChange(
        currentMetrics.costPerConversion,
        previousMetrics.costPerConversion
      ),
    };

    // Respuesta final: datos actuales + cambios
    const response = {
      ...currentMetrics,
      changes: changes,
    };

    res.json(response);
  } catch (err) {
    console.error("❌ Error en /account-metrics:", err);
    res.status(500).json({
      error: "Error interno del servidor al obtener métricas de cuenta",
      details: err.message,
    });
  }
});


router.get("/metrics/:customer_id", async (req, res) => {
  const { customer_id } = req.params;

  if (!customer_id) {
    return res
      .status(400)
      .json({ message: "El parámetro customer_id es requerido" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM campaign_metrics_history WHERE customer_id = ? ORDER BY date DESC",
      [customer_id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener métricas:", error);
    res.status(500).json({ message: "Error al obtener las métricas" });
  }
});




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




// Endpoint para obtener audience segments por ad group
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

// Endpoint para obtener días disponibles
router.get("/fechas-con-datos/:customerId", async (req, res) => {
  const { customerId } = req.params;

  try {
    const [rows] = await pool.execute(
      `
      SELECT date
      FROM campaign_metrics_history
      WHERE customer_id = ?
        AND date <= CURDATE()
      GROUP BY date
      ORDER BY date
      `,
      [customerId]
    );

    const fechas = rows.map((r) => r.date); // Array de strings "YYYY-MM-DD"
    res.json({ fechas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener fechas" });
  }
});

// Endpoint para obtener Asset Groups de una campaña Pmax

// Endpoint para obtener Assets de un Asset Group
router.get("/asset-groups/:asset_group_id/assets", async (req, res) => {
  const { asset_group_id } = req.params;
  const { from, to } = req.query;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        asset_id,
        MAX(customer_id) AS customer_id,
        MAX(campaign_id) AS campaign_id,
        MAX(asset_group_id) AS asset_group_id,
        MAX(field_type) AS field_type,
        MAX(text_value) AS text_value,
        MAX(image_url) AS image_url,
        MAX(youtube_video_id) AS youtube_video_id,
        MAX(performance_label) AS performance_label,
        SUM(impressions) AS impressions,
        SUM(clicks) AS clicks,
        SUM(cost_micros) AS cost_micros,
        SUM(conversions) AS conversions,
        CASE WHEN SUM(impressions) > 0 
             THEN (SUM(clicks) / SUM(impressions)) * 100 
             ELSE 0 END AS ctr
      FROM asset_group_assets
      WHERE asset_group_id = ?
        AND date BETWEEN ? AND ?
      GROUP BY asset_id
      ORDER BY clicks DESC
      `,
      [asset_group_id, from, to]
    );

    const result = rows.map((asset) => {
      const youtubeId = asset.youtube_video_id || null;
      const youtubeLink = youtubeId
        ? `https://www.youtube.com/watch?v=${youtubeId}`
        : null;

      return {
        id: asset.asset_id,
        assetId: asset.asset_id,
        assetGroupId: asset.asset_group_id,
        campaignId: asset.campaign_id,
        customerId: asset.customer_id,
        fieldType: asset.field_type,
        textValue: asset.text_value || null,
        imageUrl: asset.image_url || null,
        youtubeVideoId: youtubeId,
        youtubeLink, // 👈 aquí agregamos el link construido
        performanceLabel: asset.performance_label || "UNSPECIFIED",
        impressions: Number(asset.impressions) || 0,
        clicks: Number(asset.clicks) || 0,
        ctr: Number(asset.ctr) || 0,
        cost: convertMicrosToEuros(asset.cost_micros),
        conversions: Number(asset.conversions) || 0,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error al obtener assets:", error);
    res.status(500).json({ error: "Error al obtener recursos del grupo" });
  }
});

export default router;