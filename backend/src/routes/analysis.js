import express from "express";
import pool from "../config/db.js";
import analysisQueue from "../services/analysisQueue/analysisQueueInstance.js";
import {
  createWeeklyAnalysisTask,
  getAnalysisStatus
} from "../services/analysisQueue/analysisUtils.js";
import { cleanCustomerId } from "../utils/googleAdsHelpers.js";
import { callLLM, callAI, saveRecommendationsToDB, extractJson, normalizeRec, inferCategoria, stripFences } from "../services/analysis/llmService.js";

import { getGoogleAdsCustomer } from "../utils/googleAdsHelpers.js";
import { safeQuery } from "../utils/queryUtils.js";

const router = express.Router();

router.post("/start-analysis", async (req, res) => {
  try {
    if (analysisQueue.isRunning) {
      return res.status(200).json({
        message: "La cola de análisis ya está en ejecución",
        alreadyRunning: true,
        status: analysisQueue.getStatus(),
      });
    }

    analysisQueue.start().catch((err) => {
      console.error("❌ Error en cola de análisis:", err);
    });

    res.status(200).json({
      message: "Cola de análisis iniciada correctamente",
      alreadyRunning: false,
      status: analysisQueue.getStatus(),
    });
  } catch (error) {
    console.error("❌ Error iniciando análisis:", error);
    res.status(500).json({
      error: "Error interno al iniciar análisis",
      details: error.message,
    });
  }
});

router.post("/stop-analysis", (req, res) => {
  try {
    analysisQueue.stop();
    res.status(200).json({
      message: "Cola de análisis detenida",
      status: analysisQueue.getStatus(),
    });
  } catch (error) {
    console.error("❌ Error deteniendo análisis:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});

router.get("/analysis-queue-status", (req, res) => {
  try {
    const status = analysisQueue.getStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error("❌ Error obteniendo estado:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});

router.get("/analysis-status/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const status = await getAnalysisStatus(pool, customerId);

    if (!status) {
      return res.status(404).json({
        message: "No hay análisis para esta cuenta",
      });
    }

    res.status(200).json(status);
  } catch (error) {
    console.error("❌ Error obteniendo estado:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});

router.post("/schedule-analysis", async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "Customer ID es requerido" });
    }

    const result = await createWeeklyAnalysisTask(pool, customerId);

    if (!analysisQueue.isRunning && result.created) {
      analysisQueue.start().catch((err) => {
        console.error("❌ Error en cola de análisis:", err);
      });
    }

    return res.status(200).json({
      message: result.created ? "Análisis programado" : result.reason,
      customerId,
      taskResult: result,
      queueStatus: analysisQueue.getStatus(),
    });
  } catch (error) {
    console.error("❌ Error en schedule-analysis:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});




router.get("/analyze", async (req, res) => {
  const customerId = req.query.customerId;
  if (!customerId) return res.status(400).send("Customer ID es requerido");

  // ===== Helpers =====
  function mapCampaignType(code) {
    if (code === 2) return "SEARCH";
    if (code === 10) return "PERFORMANCE_MAX";
    return `TYPE_${code}`;
  }
  const n0 = (v) => (v == null ? 0 : Number(v));
  const n2 = (v, div = 1) =>
    v == null ? null : Number((Number(v) / div).toFixed(2));
  const nF = (v) => (v == null ? null : Number(v));
  const toNum = (v) => (v == null ? 0 : Number(v));
  const round = (v, p) => (v == null ? null : Number(v.toFixed(p)));
  const isNum = (x) => typeof x === "number" && Number.isFinite(x);
  const avg = (arr) => {
    const nums = arr.map(Number).filter(Number.isFinite);
    if (!nums.length) return null;
    return round(nums.reduce((s, n) => s + n, 0) / nums.length, 4);
  };
  const toISO = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toISOString().slice(0, 10);
  };



  const aggWindow = (daysArr) => {
    const impr = daysArr.reduce((s, d) => s + (d.impresiones || 0), 0);
    const clk = daysArr.reduce((s, d) => s + (d.clics || 0), 0);
    const cost = daysArr.reduce((s, d) => s + (d.gasto || 0), 0);
    const conv = daysArr.reduce((s, d) => s + (toNum(d.conversiones) || 0), 0);
    const val = daysArr.reduce(
      (s, d) => s + (toNum(d.valor_all_conversions) || 0),
      0
    );
    return {
      impresiones: impr,
      clics: clk,
      gasto: round(cost, 2),
      conversiones: round(conv, 2),
      ctr: impr > 0 ? round(clk / impr, 4) : null,
      cpc_medio: clk > 0 ? round(cost / clk, 2) : null,
      conversion_rate: clk > 0 ? round(conv / clk, 4) : null,
      cpa: conv > 0 ? round(cost / conv, 2) : null,
      roas: cost > 0 && val > 0 ? round(val / cost, 2) : null,
    };
  };

  const aggWindowGroup = (daysArr) => {
    const impr = daysArr.reduce((s, d) => s + (d.impresiones || 0), 0);
    const clk = daysArr.reduce((s, d) => s + (d.clics || 0), 0);
    const cost = daysArr.reduce((s, d) => s + (d.gasto || 0), 0);
    const conv = daysArr.reduce((s, d) => s + (toNum(d.conversiones) || 0), 0);
    const val = daysArr.reduce((s, d) => s + (toNum(d.valor_conv) || 0), 0);
    const vviews = daysArr.reduce((s, d) => s + (d.video_views || 0), 0);
    const erate = daysArr.length
      ? round(
        daysArr.reduce(
          (s, d) => s + (isNum(d.engagement_rate) ? d.engagement_rate : 0),
          0
        ) / daysArr.length,
        4
      )
      : null;

    return {
      impresiones: impr,
      clics: clk,
      gasto: round(cost, 2),
      conversiones: round(conv, 2),
      valor_conv: round(val, 2),
      ctr: impr > 0 ? round(clk / impr, 4) : null,
      cpc_medio: clk > 0 ? round(cost / clk, 2) : null,
      conversion_rate: clk > 0 ? round(conv / clk, 4) : null,
      cpa: conv > 0 ? round(cost / conv, 2) : null,
      roas: cost > 0 && val > 0 ? round(val / cost, 2) : null,
      video_views: vviews,
      engagement_rate: erate,
    };
  };

  const aggWindowAsset = (daysArr) => {
    const impr = daysArr.reduce((s, d) => s + (d.impresiones || 0), 0);
    const clk = daysArr.reduce((s, d) => s + (d.clics || 0), 0);
    const cost = daysArr.reduce((s, d) => s + (d.gasto || 0), 0);
    const conv = daysArr.reduce((s, d) => s + (toNum(d.conversiones) || 0), 0);
    return {
      impresiones: impr,
      clics: clk,
      gasto: round(cost, 2),
      conversiones: round(conv, 2),
      ctr: impr > 0 ? round(clk / impr, 4) : null,
      cpc_medio: clk > 0 ? round(cost / clk, 2) : null,
      conversion_rate: clk > 0 ? round(conv / clk, 4) : null,
      cpa: conv > 0 ? round(cost / conv, 2) : null,
    };
  };

  const trend = (curr7, prev7, key) => {
    const a = curr7[key],
      b = prev7[key];
    if (!isNum(a) || !isNum(b) || b === 0) return null;
    return round(((a - b) / Math.abs(b)) * 100, 1);
  };

  try {
    const historial_cambios = [];

    // ===================== CAMPAÑAS SEARCH (14 días) =====================
    const [rows] = await pool.execute(
      `
      SELECT
        date, campaign_id, campaign_name, campaign_status, campaign_type, location_option_setting,
        impressions, clicks, ctr, average_cpc_micros, cost_micros, conversions, conversion_rate,
        cost_per_conversion_micros, all_conversions, value_per_all_conversions,
        search_impression_share, search_rank_lost_impression_share, search_budget_lost_impression_share,
        video_views, video_view_rate, engagements, engagement_rate,
        phone_calls, phone_impressions, phone_through_rate,
        view_through_conversions, percent_new_visitors, average_time_on_site,
        bidding_strategy, budget_micros
      FROM campaign_metrics_history
      WHERE customer_id = ?
        AND campaign_type IN (2)
        AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND CURDATE()
        AND (
          IFNULL(impressions,0) > 0
          OR IFNULL(clicks,0) > 0
          OR IFNULL(cost_micros,0) > 0
          OR IFNULL(conversions,0) > 0
          OR IFNULL(all_conversions,0) > 0
        )
      ORDER BY campaign_id, date ASC
      `,
      [customerId]
    );

    const campañasById = {};
    for (const r of rows) {
      const id = String(r.campaign_id);
      if (!campañasById[id]) {
        campañasById[id] = {
          campaign_id: r.campaign_id,
          nombre: r.campaign_name,
          tipo: mapCampaignType(r.campaign_type),
          status_actual: r.campaign_status,
          location_option_setting: r.location_option_setting,
          bidding_strategy_actual: r.bidding_strategy,
          presupuesto_actual: n2(r.budget_micros, 1_000_000),
          dias: [],
        };
      }
      const dateISO = toISO(r.date);
      campañasById[id].dias.push({
        date: dateISO,
        impresiones: n0(r.impressions),
        clics: n0(r.clicks),
        ctr: nF(r.ctr),
        cpc_medio: n2(r.average_cpc_micros, 1_000_000),
        gasto: n2(r.cost_micros, 1_000_000),
        conversiones: nF(r.conversions),
        conversion_rate: nF(r.conversion_rate),
        cpa: n2(r.cost_per_conversion_micros, 1_000_000),
        all_conversions: nF(r.all_conversions),
        valor_all_conversions: nF(r.value_per_all_conversions),
        search_is: nF(r.search_impression_share),
        lost_rank_is: nF(r.search_rank_lost_impression_share),
        lost_budget_is: nF(r.search_budget_lost_impression_share),
        video_views: n0(r.video_views),
        video_view_rate: nF(r.video_view_rate),
        engagements: n0(r.engagements),
        engagement_rate: nF(r.engagement_rate),
        phone_calls: n0(r.phone_calls),
        phone_impressions: n0(r.phone_impressions),
        phone_through_rate: nF(r.phone_through_rate),
        vtc: n0(r.view_through_conversions),
        percent_new_visitors: nF(r.percent_new_visitors),
        average_time_on_site: nF(r.average_time_on_site),
        status: r.campaign_status,
        bidding_strategy: r.bidding_strategy,
        budget: n2(r.budget_micros, 1_000_000),
      });
    }

    // Idiomas por campaña
    const [languagesRows] = await pool.query(
      `SELECT campaign_id, code, name
       FROM campaign_languages
       WHERE customer_id = ?`,
      [customerId]
    );

    const languagesByCampaign = languagesRows.reduce((acc, row) => {
      if (!acc[row.campaign_id]) acc[row.campaign_id] = [];
      acc[row.campaign_id].push({ name: row.name });
      return acc;
    }, {});

    // Ubicaciones por campaña
    const [locationsRows] = await pool.query(
      `SELECT campaign_id, geo_target_constant, name, country_code, target_type
       FROM campaign_locations
       WHERE customer_id = ?`,
      [customerId]
    );

    const locationsByCampaign = locationsRows.reduce((acc, row) => {
      (acc[row.campaign_id] ||= []).push({
        name: row.name,
        country_code: row.country_code,
        target_type: row.target_type,
      });
      return acc;
    }, {});

    const campañas = [];
    for (const camp of Object.values(campañasById)) {
      camp.dias.sort((a, b) => a.date.localeCompare(b.date));

      const last7 = camp.dias.slice(-7);
      const prev7 = camp.dias.slice(-14, -7);

      const aggLast = aggWindow(last7);
      const aggPrev = prev7.length ? aggWindow(prev7) : null;

      const tendencias = aggPrev
        ? {
          impresiones_pct: trend(aggLast, aggPrev, "impresiones"),
          clics_pct: trend(aggLast, aggPrev, "clics"),
          gasto_pct: trend(aggLast, aggPrev, "gasto"),
          conversiones_pct: trend(aggLast, aggPrev, "conversiones"),
          ctr_pct: trend(aggLast, aggPrev, "ctr"),
          cpc_medio_pct: trend(aggLast, aggPrev, "cpc_medio"),
          cpa_pct: trend(aggLast, aggPrev, "cpa"),
          roas_pct: trend(aggLast, aggPrev, "roas"),
        }
        : null;

      const lastDay = camp.dias[camp.dias.length - 1];
      const diag = {
        riesgo_budget_cap:
          isNum(lastDay?.lost_budget_is) && lastDay.lost_budget_is >= 0.2,
        riesgo_rank:
          isNum(lastDay?.lost_rank_is) && lastDay.lost_rank_is >= 0.3,
        pacing_aprox:
          aggLast.gasto != null && isNum(lastDay?.budget)
            ? round(aggLast.gasto / Math.max(lastDay.budget, 0.01), 2)
            : null,
      };

      // Anomalías DoD + cambios
      for (let i = 1; i < camp.dias.length; i++) {
        const prev = camp.dias[i - 1],
          curr = camp.dias[i];

        if (isNum(prev.gasto) && isNum(curr.gasto) && prev.gasto > 0) {
          const delta = (curr.gasto - prev.gasto) / prev.gasto;
          if (delta >= 0.4) {
            historial_cambios.push({
              tipo: "campaign_cost_spike",
              campaign_id: camp.campaign_id,
              nombre: camp.nombre,
              from_cost: prev.gasto,
              to_cost: curr.gasto,
              pct: round(delta * 100, 1),
              date: curr.date,
            });
          }
        }

        if (
          isNum(prev.conversiones) &&
          isNum(curr.conversiones) &&
          prev.conversiones > 0
        ) {
          const deltaConv =
            (curr.conversiones - prev.conversiones) / prev.conversiones;
          if (deltaConv <= -0.4) {
            historial_cambios.push({
              tipo: "campaign_conversions_drop",
              campaign_id: camp.campaign_id,
              nombre: camp.nombre,
              from_conv: prev.conversiones,
              to_conv: curr.conversiones,
              pct: round(deltaConv * 100, 1),
              date: curr.date,
            });
          }
        }

        if (prev.status !== curr.status) {
          historial_cambios.push({
            tipo: "campaign_status_change",
            campaign_id: camp.campaign_id,
            nombre: camp.nombre,
            de: prev.status,
            a: curr.status,
            date: curr.date,
          });
        }
        if (prev.bidding_strategy !== curr.bidding_strategy) {
          historial_cambios.push({
            tipo: "campaign_bid_strategy_change",
            campaign_id: camp.campaign_id,
            nombre: camp.nombre,
            de: prev.bidding_strategy,
            a: curr.bidding_strategy,
            date: curr.date,
          });
        }
        if (
          isNum(prev.budget) &&
          isNum(curr.budget) &&
          prev.budget !== curr.budget
        ) {
          const diffPct = (curr.budget - prev.budget) / (prev.budget || 1);
          if (Math.abs(diffPct) >= 0.05) {
            historial_cambios.push({
              tipo: "campaign_budget_change",
              campaign_id: camp.campaign_id,
              nombre: camp.nombre,
              de: prev.budget,
              a: curr.budget,
              pct: round(diffPct * 100, 1),
              date: curr.date,
            });
          }
        }
      }

      campañas.push({
        id: camp.campaign_id,
        nombre: camp.nombre,
        tipo: camp.tipo,
        status: camp.status_actual,
        location_option_setting: camp.location_option_setting,
        bidding_strategy: camp.bidding_strategy_actual,
        presupuesto: camp.presupuesto_actual,
        idiomas: languagesByCampaign[camp.campaign_id] || [],
        ubicaciones: locationsByCampaign[camp.campaign_id] || [],
        agregados_7d: aggLast,
        tendencias_7vs7: tendencias,
        diagnosticos: diag,
        datos_por_día: req.query.debug
          ? Object.fromEntries(camp.dias.map((d) => [d.date, d]))
          : undefined,
      });
    }

    campañas.sort(
      (a, b) => (b.agregados_7d.gasto || 0) - (a.agregados_7d.gasto || 0)
    );

    // ===================== P-MAX CAMPAÑAS (14 días) =====================
    const [rowsPmaxCamp] = await pool.execute(
      `
      SELECT
        date, campaign_id, campaign_name, campaign_status, campaign_type, location_option_setting,
        impressions, clicks, ctr, average_cpc_micros, cost_micros, conversions, conversion_rate,
        cost_per_conversion_micros, all_conversions, value_per_all_conversions,
        video_views, video_view_rate, engagements, engagement_rate,
        bidding_strategy, budget_micros
      FROM campaign_metrics_history
      WHERE customer_id = ?
        AND campaign_type = 10
        AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND CURDATE()
        AND (
          IFNULL(impressions,0) > 0
          OR IFNULL(clicks,0) > 0
          OR IFNULL(cost_micros,0) > 0
          OR IFNULL(conversions,0) > 0
          OR IFNULL(all_conversions,0) > 0
        )
      ORDER BY campaign_id, date ASC
      `,
      [customerId]
    );

    const pmaxById = {};
    for (const r of rowsPmaxCamp) {
      const id = String(r.campaign_id);
      if (!pmaxById[id]) {
        pmaxById[id] = {
          campaign_id: r.campaign_id,
          nombre: r.campaign_name,
          tipo: mapCampaignType(r.campaign_type),
          status_actual: r.campaign_status,
          location_option_setting: r.location_option_setting,
          bidding_strategy_actual: r.bidding_strategy,
          presupuesto_actual: n2(r.budget_micros, 1_000_000),
          dias: [],
        };
      }
      const dateISO = toISO(r.date);
      pmaxById[id].dias.push({
        date: dateISO,
        impresiones: n0(r.impressions),
        clics: n0(r.clicks),
        ctr: nF(r.ctr),
        cpc_medio: n2(r.average_cpc_micros, 1_000_000),
        gasto: n2(r.cost_micros, 1_000_000),
        conversiones: nF(r.conversions),
        conversion_rate: nF(r.conversion_rate),
        cpa: n2(r.cost_per_conversion_micros, 1_000_000),
        all_conversions: nF(r.all_conversions),
        valor_all_conversions: nF(r.value_per_all_conversions),
        video_views: n0(r.video_views),
        video_view_rate: nF(r.video_view_rate),
        engagements: n0(r.engagements),
        engagement_rate: nF(r.engagement_rate),
        status: r.campaign_status,
        bidding_strategy: r.bidding_strategy,
        budget: n2(r.budget_micros, 1_000_000),
      });
    }

    const pmax_campañas = [];
    for (const camp of Object.values(pmaxById)) {
      camp.dias.sort((a, b) => a.date.localeCompare(b.date));
      const last7 = camp.dias.slice(-7);
      const prev7 = camp.dias.slice(-14, -7);

      const aggLast = aggWindow(last7);
      const aggPrev = prev7.length ? aggWindow(prev7) : null;

      const tendencias = aggPrev
        ? {
          impresiones_pct: trend(aggLast, aggPrev, "impresiones"),
          clics_pct: trend(aggLast, aggPrev, "clics"),
          gasto_pct: trend(aggLast, aggPrev, "gasto"),
          conversiones_pct: trend(aggLast, aggPrev, "conversiones"),
          ctr_pct: trend(aggLast, aggPrev, "ctr"),
          cpc_medio_pct: trend(aggLast, aggPrev, "cpc_medio"),
          cpa_pct: trend(aggLast, aggPrev, "cpa"),
          roas_pct: trend(aggLast, aggPrev, "roas"),
        }
        : null;

      pmax_campañas.push({
        id: camp.campaign_id,
        nombre: camp.nombre,
        tipo: camp.tipo,
        status: camp.status_actual,
        location_option_setting: camp.location_option_setting,
        bidding_strategy: camp.bidding_strategy_actual,
        presupuesto: camp.presupuesto_actual,
        agregados_7d: aggLast,
        tendencias_7vs7: tendencias,
        datos_por_día: req.query.debug
          ? Object.fromEntries(camp.dias.map((d) => [d.date, d]))
          : undefined,
      });
    }

    pmax_campañas.sort(
      (a, b) => (b.agregados_7d.gasto || 0) - (a.agregados_7d.gasto || 0)
    );

    // ===================== P-MAX ASSET GROUPS (14 días) =====================
    const [rowsPmaxGroups] = await pool.execute(
      `
      SELECT
        date, customer_id, campaign_id, asset_group_id, asset_group_name, status,
        impressions, clicks, ctr, cost_micros, conversions, conversions_value,
        video_views, engagement_rate
      FROM asset_groups
      WHERE customer_id = ?
        AND campaign_id IN (
          SELECT DISTINCT campaign_id
          FROM campaign_metrics_history
          WHERE customer_id = ?
            AND campaign_type = 10
        )
        AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND CURDATE()
        AND (
          IFNULL(impressions,0) > 0
          OR IFNULL(clicks,0) > 0
          OR IFNULL(cost_micros,0) > 0
          OR IFNULL(conversions,0) > 0
        )
      ORDER BY asset_group_id, date ASC
      `,
      [customerId, customerId]
    );

    const pmaxGroupsById = {};
    for (const r of rowsPmaxGroups) {
      const id = String(r.asset_group_id);
      if (!pmaxGroupsById[id]) {
        pmaxGroupsById[id] = {
          asset_group_id: r.asset_group_id,
          nombre: r.asset_group_name,
          campaign_id: r.campaign_id,
          status_actual: r.status,
          dias: [],
        };
      }
      const dateISO = toISO(r.date);
      pmaxGroupsById[id].dias.push({
        date: dateISO,
        impresiones: n0(r.impressions),
        clics: n0(r.clicks),
        ctr: nF(r.ctr),
        gasto: n2(r.cost_micros, 1_000_000),
        conversiones: nF(r.conversions),
        valor_conv: nF(r.conversions_value),
        video_views: n0(r.video_views),
        engagement_rate: nF(r.engagement_rate),
        status: r.status,
      });
    }

    const pmax_asset_groups = [];
    for (const g of Object.values(pmaxGroupsById)) {
      g.dias.sort((a, b) => a.date.localeCompare(b.date));
      const last7 = g.dias.slice(-7);
      const prev7 = g.dias.slice(-14, -7);

      const aggLast = aggWindowGroup(last7);
      const aggPrev = prev7.length ? aggWindowGroup(prev7) : null;

      const tendencias = aggPrev
        ? {
          impresiones_pct: trend(aggLast, aggPrev, "impresiones"),
          clics_pct: trend(aggLast, aggPrev, "clics"),
          gasto_pct: trend(aggLast, aggPrev, "gasto"),
          conversiones_pct: trend(aggLast, aggPrev, "conversiones"),
          valor_conv_pct: trend(aggLast, aggPrev, "valor_conv"),
          ctr_pct: trend(aggLast, aggPrev, "ctr"),
          cpc_medio_pct: trend(aggLast, aggPrev, "cpc_medio"),
          cpa_pct: trend(aggLast, aggPrev, "cpa"),
          roas_pct: trend(aggLast, aggPrev, "roas"),
        }
        : null;

      pmax_asset_groups.push({
        id: g.asset_group_id,
        nombre: g.nombre,
        campaign_id: g.campaign_id,
        status: g.status_actual,
        agregados_7d: aggLast,
        tendencias_7vs7: tendencias,
        datos_por_día: req.query.debug
          ? Object.fromEntries(g.dias.map((d) => [d.date, d]))
          : undefined,
      });
    }

    pmax_asset_groups.sort(
      (a, b) => (b.agregados_7d.gasto || 0) - (a.agregados_7d.gasto || 0)
    );

    // ===================== P-MAX ASSETS (14 días) =====================
    const [rowsPmaxAssets] = await pool.execute(
      `
      SELECT
        date, customer_id, campaign_id, asset_group_id, asset_id,
        field_type, text_value, image_url, youtube_video_id, performance_label,
        impressions, clicks, cost_micros, conversions
      FROM asset_group_assets
      WHERE customer_id = ?
        AND campaign_id IN (
          SELECT DISTINCT campaign_id
          FROM campaign_metrics_history
          WHERE customer_id = ?
            AND campaign_type = 10
        )
        AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND CURDATE()
      ORDER BY asset_id, date ASC
      `,
      [customerId, customerId]
    );

    const pmaxAssetsById = {};
    for (const r of rowsPmaxAssets) {
      const id = String(
        r.asset_id || `${r.asset_group_id}|${r.field_type}|${toISO(r.date)}`
      );
      if (!pmaxAssetsById[id]) {
        pmaxAssetsById[id] = {
          asset_id: r.asset_id || null,
          asset_group_id: r.asset_group_id,
          campaign_id: r.campaign_id,
          field_type: r.field_type,
          text_value: r.text_value,
          image_url: r.image_url,
          youtube_video_id: r.youtube_video_id,
          performance_label: r.performance_label,
          dias: [],
        };
      }
      const dateISO = toISO(r.date);
      pmaxAssetsById[id].dias.push({
        date: dateISO,
        impresiones: n0(r.impressions),
        clics: n0(r.clicks),
        gasto: n2(r.cost_micros, 1_000_000),
        conversiones: nF(r.conversions),
        ctr: r.impressions ? round(n0(r.clicks) / n0(r.impressions), 4) : null,
      });
    }

    const pmax_assets = [];
    for (const a of Object.values(pmaxAssetsById)) {
      a.dias.sort((x, y) => x.date.localeCompare(y.date));
      const last7 = a.dias.slice(-7);
      const prev7 = a.dias.slice(-14, -7);

      const aggLast = aggWindowAsset(last7);
      const aggPrev = prev7.length ? aggWindowAsset(prev7) : null;

      const tendencias = aggPrev
        ? {
          impresiones_pct: trend(aggLast, aggPrev, "impresiones"),
          clics_pct: trend(aggLast, aggPrev, "clics"),
          gasto_pct: trend(aggLast, aggPrev, "gasto"),
          conversiones_pct: trend(aggLast, aggPrev, "conversiones"),
          ctr_pct: trend(aggLast, aggPrev, "ctr"),
          cpc_medio_pct: trend(aggLast, aggPrev, "cpc_medio"),
          cpa_pct: trend(aggLast, aggPrev, "cpa"),
        }
        : null;

      pmax_assets.push({
        id: a.asset_id,
        asset_group_id: a.asset_group_id,
        campaign_id: a.campaign_id,
        tipo: a.field_type,
        performance_label: a.performance_label,
        text_value: a.text_value,
        image_url: a.image_url,
        youtube_video_id: a.youtube_video_id,
        agregados_7d: aggLast,
        tendencias_7vs7: tendencias,
        datos_por_día: req.query.debug
          ? Object.fromEntries(a.dias.map((d) => [d.date, d]))
          : undefined,
      });
    }

    pmax_assets.sort(
      (a, b) => (b.agregados_7d.gasto || 0) - (a.agregados_7d.gasto || 0)
    );

    // ===================== AD GROUPS (14 días) =====================
    let adgroups = [];
    let adgroups_error = null;

    try {
      const [agRows] = await pool.execute(
        `
        SELECT
          date,
          ad_group_id,
          ad_group_name,
          status,
          campaign_id,
          COALESCE(impressions,0)   AS impressions,
          COALESCE(clicks,0)        AS clicks,
          COALESCE(cost_micros,0)   AS cost_micros,
          COALESCE(conversions,0)   AS conversions
        FROM ad_groups
        WHERE customer_id = ?
          AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND CURDATE()
          AND (impressions>0 OR clicks>0 OR cost_micros>0 OR conversions>0)
        ORDER BY ad_group_id, date ASC
        `,
        [customerId]
      );

      const byId = {};
      for (const r of agRows) {
        const id = String(r.ad_group_id);
        if (!byId[id]) {
          byId[id] = {
            id: r.ad_group_id,
            nombre: r.ad_group_name,
            campaign_id: r.campaign_id,
            status: r.status,
            dias: [],
          };
        }
        byId[id].dias.push({
          date:
            typeof r.date === "string"
              ? r.date
              : new Date(r.date).toISOString(),
          impresiones: toNum(r.impressions),
          clics: toNum(r.clicks),
          gasto: toNum(r.cost_micros) / 1_000_000,
          conversiones: toNum(r.conversions),
        });
      }

      adgroups = Object.values(byId).map((g) => {
        g.dias.sort((a, b) => new Date(a.date) - new Date(b.date));

        const last7 = g.dias.slice(-7);
        const prev7 = g.dias.slice(-14, -7);

        const aggLast = aggWindow(last7);
        const aggPrev = prev7.length ? aggWindow(prev7) : null;

        const tendencias = aggPrev
          ? {
            impresiones_pct: trend(aggLast, aggPrev, "impresiones"),
            clics_pct: trend(aggLast, aggPrev, "clics"),
            gasto_pct: trend(aggLast, aggPrev, "gasto"),
            conversiones_pct: trend(aggLast, aggPrev, "conversiones"),
            ctr_pct: trend(aggLast, aggPrev, "ctr"),
            cpc_medio_pct: trend(aggLast, aggPrev, "cpc_medio"),
            cpa_pct: trend(aggLast, aggPrev, "cpa"),
          }
          : null;

        return {
          id: g.id,
          nombre: g.nombre,
          campaign_id: g.campaign_id,
          status: g.status,
          agregados_7d: aggLast,
          tendencias_7vs7: tendencias,
          datos_por_día:
            req.query.preview === "true"
              ? undefined
              : req.query.debug === "true"
                ? g.dias
                : undefined,
        };
      });

      adgroups.sort(
        (a, b) => (b.agregados_7d.gasto || 0) - (a.agregados_7d.gasto || 0)
      );
    } catch (e) {
      console.error("ADGROUPS_BLOCK_ERROR:", e);
      adgroups_error = String(e?.message || e);
    }

    // ===================== ADS (14 días usando created_at) =====================
    let ads = [];
    let ads_error = null;

    try {
      const [colsInfo] = await pool.execute(`SHOW COLUMNS FROM ads`);
      const COLS = new Set((colsInfo || []).map((c) => c.Field));
      const has = (c) => COLS.has(c);

      const BASE_COLS = [
        "ad_id",
        "ad_group_id",
        "campaign_id",
        "created_at",
      ].filter(has);

      const STATUS_COL = has("status") ? "status" : null;

      const METRIC_COLS = [
        "impressions",
        "clicks",
        "ctr",
        "cost_micros",
        "average_cpc_micros",
        "conversions",
        "all_conversions",
        "conversion_rate",
        "value_per_all_conversions",
        "view_through_conversions",
        "engagements",
        "engagement_rate",
        "video_views",
        "video_view_rate",
        "phone_calls",
        "phone_impressions",
        "phone_through_rate",
      ].filter(has);

      const CREATIVE_COLS = [
        "ad_headline",
        "ad_headline_1",
        "ad_headline_2",
        "ad_description",
        "ad_description_1",
        "ad_description_2",
        "ad_path1",
        "ad_path2",
        "final_url",
        "display_url",
      ].filter(has);

      if (!BASE_COLS.includes("ad_id") || !BASE_COLS.includes("created_at")) {
        throw new Error(
          "La tabla 'ads' debe tener al menos 'ad_id' y 'created_at'."
        );
      }

      const SELECT_COLS = [
        ...BASE_COLS,
        ...(STATUS_COL ? [STATUS_COL] : []),
        ...METRIC_COLS,
        ...CREATIVE_COLS,
      ];

      const [adsRows] = await pool.execute(
        `
        SELECT ${SELECT_COLS.join(", ")}
        FROM ads
        WHERE customer_id = ?
          AND created_at BETWEEN DATE_SUB(NOW(), INTERVAL 13 DAY) AND NOW()
        ORDER BY ad_id, created_at ASC
        `,
        [customerId]
      );

      const onlyDate = (iso) => iso.slice(0, 10);

      const byAd = {};
      for (const r of adsRows) {
        const id = String(r.ad_id);
        if (!byAd[id]) {
          byAd[id] = {
            id: r.ad_id,
            ad_group_id: r.ad_group_id,
            campaign_id: r.campaign_id,
            status: STATUS_COL ? r[STATUS_COL] : undefined,
            creativo_actual: {},
            _diasMap: {},
          };
        }

        const createdISO = toISO(r.created_at);
        const dayKey = onlyDate(createdISO);

        if (CREATIVE_COLS.length) {
          byAd[id].creativo_actual = Object.fromEntries(
            CREATIVE_COLS.map((c) => [c, r[c]])
          );
        }
        if (STATUS_COL) byAd[id].status = r[STATUS_COL];

        if (!byAd[id]._diasMap[dayKey]) {
          byAd[id]._diasMap[dayKey] = {
            date: dayKey,
            impresiones: 0,
            clics: 0,
            gasto: 0,
            conversiones: 0,
            ctr: null,
            cpc_medio: null,
            conversion_rate: null,
            cpa: null,
            creativo: CREATIVE_COLS.length
              ? Object.fromEntries(CREATIVE_COLS.map((c) => [c, r[c]]))
              : undefined,
            status: STATUS_COL ? r[STATUS_COL] : undefined,
          };
        }

        const bucket = byAd[id]._diasMap[dayKey];

        const impresiones = has("impressions") ? toNum(r.impressions) : 0;
        const clics = has("clicks") ? toNum(r.clicks) : 0;
        const gasto = has("cost_micros") ? toNum(r.cost_micros) / 1_000_000 : 0;
        const convs = has("conversions")
          ? toNum(r.conversions)
          : has("all_conversions")
            ? toNum(r.all_conversions)
            : 0;

        bucket.impresiones += impresiones;
        bucket.clics += clics;
        bucket.gasto = round((bucket.gasto || 0) + gasto, 2);
        bucket.conversiones = round((bucket.conversiones || 0) + convs, 2);
      }

      function finalizeDayMetrics(d) {
        d.ctr = d.impresiones > 0 ? round(d.clics / d.impresiones, 4) : null;
        d.cpc_medio = d.clics > 0 ? round(d.gasto / d.clics, 2) : null;
        d.conversion_rate =
          d.clics > 0 ? round(d.conversiones / d.clics, 4) : null;
        d.cpa = d.conversiones > 0 ? round(d.gasto / d.conversiones, 2) : null;
        return d;
      }

      ads = Object.values(byAd).map((a) => {
        const dias = Object.values(a._diasMap)
          .map(finalizeDayMetrics)
          .sort((x, y) => x.date.localeCompare(y.date));

        const last7 = dias.slice(-7);
        const prev7 = dias.slice(-14, -7);

        const aggLast = aggWindow(last7);
        const aggPrev = prev7.length ? aggWindow(prev7) : null;

        const tendencias = aggPrev
          ? {
            impresiones_pct: trend(aggLast, aggPrev, "impresiones"),
            clics_pct: trend(aggLast, aggPrev, "clics"),
            gasto_pct: trend(aggLast, aggPrev, "gasto"),
            conversiones_pct: trend(aggLast, aggPrev, "conversiones"),
            ctr_pct: trend(aggLast, aggPrev, "ctr"),
            cpc_medio_pct: trend(aggLast, aggPrev, "cpc_medio"),
            cpa_pct: trend(aggLast, aggPrev, "cpa"),
          }
          : null;

        for (let i = 1; i < dias.length; i++) {
          const prev = dias[i - 1];
          const curr = dias[i];

          if (STATUS_COL && prev.status !== curr.status) {
            historial_cambios.push({
              tipo: "ad_status_change",
              date: curr.date,
              ad_id: a.id,
              ad_group_id: a.ad_group_id,
              campaign_id: a.campaign_id,
              de: prev.status,
              a: curr.status,
            });
          }

          if (isNum(prev.gasto) && isNum(curr.gasto) && prev.gasto > 0) {
            const delta = (curr.gasto - prev.gasto) / prev.gasto;
            if (delta >= 0.5) {
              historial_cambios.push({
                tipo: "ad_cost_spike",
                date: curr.date,
                ad_id: a.id,
                ad_group_id: a.ad_group_id,
                campaign_id: a.campaign_id,
                from_cost: round(prev.gasto, 2),
                to_cost: round(curr.gasto, 2),
                pct: round(delta * 100, 1),
              });
            }
          }

          if (
            isNum(prev.conversiones) &&
            isNum(curr.conversiones) &&
            prev.conversiones > 0
          ) {
            const deltaConv =
              (curr.conversiones - prev.conversiones) / prev.conversiones;
            if (deltaConv <= -0.6) {
              historial_cambios.push({
                tipo: "ad_conversions_drop",
                date: curr.date,
                ad_id: a.id,
                ad_group_id: a.ad_group_id,
                campaign_id: a.campaign_id,
                from_conv: round(prev.conversiones, 2),
                to_conv: round(curr.conversiones, 2),
                pct: round(deltaConv * 100, 1),
              });
            }
          }
        }

        return {
          id: a.id,
          ad_group_id: a.ad_group_id,
          campaign_id: a.campaign_id,
          status: a.status,
          creativo_actual: a.creativo_actual,
          agregados_7d: aggLast,
          tendencias_7vs7: tendencias,
          datos_por_día:
            req.query.preview === "true"
              ? undefined
              : req.query.debug === "true"
                ? dias
                : undefined,
        };
      });

      ads.sort(
        (x, y) => (y.agregados_7d.gasto || 0) - (x.agregados_7d.gasto || 0)
      );
    } catch (e) {
      console.error("ADS_BLOCK_ERROR:", e);
      ads_error = String(e?.message || e);
    }

    // ===================== KEYWORDS (14 días) =====================
    let keywords = [];
    let keywords_error = null;

    try {
      const [kwRows] = await pool.execute(
        `
        SELECT
          date,
          keyword_text,
          match_type,
          ad_group_id,
          campaign_id,
          status,
          is_negative,
          COALESCE(impressions,0) AS impressions,
          COALESCE(clicks,0)      AS clicks,
          COALESCE(cost_micros,0) AS cost_micros,
          COALESCE(conversions,0) AS conversions
        FROM keywords
        WHERE customer_id = ?
          AND is_negative = 0
          AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND CURDATE()
          AND (impressions>0 OR clicks>0 OR cost_micros>0 OR conversions>0)
        ORDER BY keyword_text, match_type, ad_group_id, date ASC
        `,
        [customerId]
      );

      const byKey = {};
      for (const r of kwRows) {
        const key = `${r.keyword_text}||${r.match_type}||${r.ad_group_id}||${r.campaign_id}`;
        if (!byKey[key]) {
          byKey[key] = {
            keyword: r.keyword_text,
            match_type: r.match_type,
            ad_group_id: r.ad_group_id,
            campaign_id: r.campaign_id,
            status_actual: r.status,
            dias: [],
          };
        }
        byKey[key].dias.push({
          date:
            typeof r.date === "string"
              ? r.date
              : new Date(r.date).toISOString(),
          impresiones: toNum(r.impressions),
          clics: toNum(r.clicks),
          gasto: toNum(r.cost_micros) / 1_000_000,
          conversiones: toNum(r.conversions),
          status: r.status,
        });
      }

      const local_hist = [];
      keywords = Object.values(byKey).map((k) => {
        k.dias.sort((a, b) => new Date(a.date) - new Date(b.date));

        for (let i = 1; i < k.dias.length; i++) {
          const prev = k.dias[i - 1],
            curr = k.dias[i];
          if (prev.status !== curr.status) {
            local_hist.push({
              tipo: "keyword_status_change",
              date: curr.date?.slice(0, 10),
              keyword: k.keyword,
              match_type: k.match_type,
              ad_group_id: k.ad_group_id,
              campaign_id: k.campaign_id,
              de: prev.status,
              a: curr.status,
            });
          }
        }

        const last7 = k.dias.slice(-7);
        const prev7 = k.dias.slice(-14, -7);

        const aggLast = aggWindow(last7);
        const aggPrev = prev7.length ? aggWindow(prev7) : null;

        const tendencias = aggPrev
          ? {
            impresiones_pct: trend(aggLast, aggPrev, "impresiones"),
            clics_pct: trend(aggLast, aggPrev, "clics"),
            gasto_pct: trend(aggLast, aggPrev, "gasto"),
            conversiones_pct: trend(aggLast, aggPrev, "conversiones"),
            ctr_pct: trend(aggLast, aggPrev, "ctr"),
            cpc_medio_pct: trend(aggLast, aggPrev, "cpc_medio"),
            cpa_pct: trend(aggLast, aggPrev, "cpa"),
          }
          : null;

        return {
          keyword: k.keyword,
          match_type: k.match_type,
          ad_group_id: k.ad_group_id,
          campaign_id: k.campaign_id,
          status: k.status_actual,
          agregados_7d: aggLast,
          tendencias_7vs7: tendencias,
          datos_por_día:
            req.query.preview === "true"
              ? undefined
              : req.query.debug === "true"
                ? k.dias
                : undefined,
        };
      });

      historial_cambios.push(...local_hist);

      keywords.sort(
        (a, b) => (b.agregados_7d.gasto || 0) - (a.agregados_7d.gasto || 0)
      );
    } catch (e) {
      console.error("KEYWORDS_BLOCK_ERROR:", e);
      keywords_error = String(e?.message || e);
    }

    // ===================== SEGMENTOS DE AUDIENCIA (7d) =====================
    const [audRows] = await pool.execute(
      `
      SELECT
        segment_type, segment_value,
        SUM(impressions) AS impr, SUM(clicks) AS clk,
        SUM(cost_micros) AS cost_micros,
        SUM(conversions) AS convs
      FROM audience_segments
      WHERE customer_id = ?
        AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND CURDATE()
      GROUP BY segment_type, segment_value
      ORDER BY segment_type, segment_value
      `,
      [customerId]
    );

    const segmentos_audiencia = {};
    for (const r of audRows) {
      const tipo = r.segment_type || "UNKNOWN";
      if (!segmentos_audiencia[tipo]) segmentos_audiencia[tipo] = [];
      const impresiones = n0(r.impr);
      const clics = n0(r.clk);
      const gasto = n2(r.cost_micros, 1_000_000);
      const convs = Number(r.convs ?? 0);
      segmentos_audiencia[tipo].push({
        valor: r.segment_value,
        impresiones,
        clics,
        gasto,
        conversiones: convs,
        ctr: impresiones > 0 ? round(clics / impresiones, 4) : null,
        cpc: clics > 0 ? round(gasto / clics, 2) : null,
        cpa: convs > 0 ? round(gasto / convs, 2) : null,
      });
    }

    // ===================== DEBUG MODE =====================
    if (req.query.debug === "true") {
      const datosAnalizados = {
        campañas,
        pmax_campañas,
        pmax_asset_groups,
        pmax_assets,
        adgroups,
        ads,
        keywords,
        segmentos_audiencia,
        historial_cambios,
      };
      res.setHeader("Content-Type", "application/json");
      return res.send(JSON.stringify(datosAnalizados, null, 2));
    }

    // ===================== PREPARAR PAYLOADS =====================
    const setCampañas = Array.isArray(campañas) ? campañas : [];
    const setAdgroups = Array.isArray(adgroups) ? adgroups : [];
    const setAds = Array.isArray(ads) ? ads : [];
    const setKeywords = Array.isArray(keywords) ? keywords : [];
    const setSegs = segmentos_audiencia;
    const setCambios = Array.isArray(historial_cambios)
      ? historial_cambios
      : [];

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📊 RESUMEN DE DATOS RECOPILADOS PARA ${customerId}`);
    console.log("=".repeat(80));
    console.log(`   Campañas Search: ${setCampañas.length}`);
    console.log(`   Campañas PMax: ${pmax_campañas.length}`);
    console.log(`   PMax Asset Groups: ${pmax_asset_groups.length}`);
    console.log(`   PMax Assets: ${pmax_assets.length}`);
    console.log(`   Ad Groups: ${setAdgroups.length}`);
    console.log(`   Ads: ${setAds.length}`);
    console.log(`   Keywords: ${setKeywords.length}`);
    console.log(`   Tipos de segmentos: ${Object.keys(setSegs).length}`);
    console.log(`   Cambios históricos: ${setCambios.length}`);
    console.log("=".repeat(80) + "\n");

    // ===================== SYSTEM PROMPTS =====================
    const OUTPUT_RULES = `DEVUELVE EXCLUSIVAMENTE un array JSON VÁLIDO sin backticks ni texto extra.
Emite recomendaciones solo si hay evidencia clara (si algo rinde bien, no devuelvas nada).

Cada objeto DEBE tener:
- titulo
- descripcion: acción concreta, sin vaguedades
- categoria: una de (pujas,presupuesto,estructura,anuncios,keywords,searchterms,landingpages,segmentacion,otros)
- prioridad: (alta,media,baja)
- impacto_estimado: CALCULA el valor numérico real basado en las métricas. Ejemplos:
  * Para reducción de presupuesto: calcula el % de ahorro real (ej: "-15% coste")
  * Para aumento de CTR: calcula el incremento esperado (ej: "+2.5% CTR")
  * Para mejora de conversiones: indica "↑ conversiones" o calcula el valor
  * Si no puedes calcularlo: "impacto desconocido"
  IMPORTANTE: Nunca uses placeholders como -Y% o -X%, siempre valores reales calculados.
- tipo_objeto: (según prompt: campaign|adgroup|ad|keyword|segmento_audiencia)
- objeto_id: ID real del objeto (para audiencia: campaignId|dimension|valor)
- evidencia: métricas reales 7d y, si hay, vs 7d prev

Prohibido frases genéricas, inventar cifras/keywords/URLs. Si no hay acciones con base, devuelve [].`;

    const systemPromptCampaign = `
Eres "SEM-GPT", estratega senior de Google Ads. Analiza EXCLUSIVAMENTE CAMPAÑAS.
${OUTPUT_RULES}
Reglas específicas campañas:
- Presupuesto: detectar IS perdido por presupuesto, pacing y sugerir +/− con importe/% concreto.
- Reasignación: de → a con % o €, justificando con CPA/ROAS/CVR 7d vs 7d prev si existe.
- Pujas/estrategia: ajuste % o cambio solo con evidencia.
- Segmentación: idiomas/ubicaciones si existen; citar exactamente códigos/países/idiomas del dataset.
- "evidencia": impr, clics, gasto, conv, CPA, ROAS y 7vs7 si está, más search_is/lost_budget_is/lost_rank_is y presupuesto diario si lo usas.
- tipo_objeto="campaign".
- Aumentar presupuesto SOLO si lost_budget_is ≥ 0.20 o pacing < 0.9 y además buena señal (p.ej. ≥3 conv o mejora vs prev).
- Reducir/pausar si conv_7d = 0 con clics_7d ≥ 40 o gasto_7d ≥ 100€.
`;

    const systemPromptAdgroup = `
Eres "SEM-GPT", estratega senior de Google Ads. Analiza EXCLUSIVAMENTE GRUPOS DE ANUNCIOS.
${OUTPUT_RULES}
POLÍTICA AD GROUPS:
- Objetivo por defecto: optimizar sin pausar.
- PROHIBIDO recomendar "pausar" salvo:
  (A) SIN ENTREGA: impresiones_7d = 0 y clics_7d = 0.
  (B) INEFICIENCIA SEVERA con alternativa en la misma campaña.
- En el resto: reasignar presupuesto, mover keywords, iterar anuncios, ajustar pujas.
- Evidencia: impr, clics, gasto, conv, CTR, CPC, CVR, CPA/ROAS, benchmarks de campaña.
- tipo_objeto="ad_group".
`;

    const systemPromptAd = `
Eres "SEM-GPT", estratega senior de Google Ads. Analiza EXCLUSIVAMENTE ANUNCIOS.
${OUTPUT_RULES}
POLÍTICA ADS:
- Objetivo: iterar creatividades (test A/B) y mejorar relevancia/CTR/CVR.
- PROHIBIDO pausar salvo SIN ENTREGA (impresiones_7d = 0 y clics_7d = 0).
- En todos los demás casos: new_headlines, new_descriptions, assets, paths.
- Benchmarks: CTR_ad vs CTR_adgroup, CVR_ad vs CVR_adgroup.
- Evidencia: impr_7d, clics_7d, CTR_ad, conv_7d, CPA/ROAS, benchmarks.
- tipo_objeto="ad".
`;

    const systemPromptKeyword = `
Eres "SEM-GPT", estratega senior de Google Ads. Analiza EXCLUSIVAMENTE KEYWORDS.
${OUTPUT_RULES}
REGLAS GENERALES:
- Pausar SOLO si conv_7d = 0 y (clics_7d ≥ 25 o gasto_7d ≥ 30€) + señal adicional.
- Si propones negativas/positivas, lista exacta con match, nivel, IDs.
REGLAS CORE KEYWORDS (protección):
- PROHIBIDO pausar salvo condiciones extremas (4 condiciones simultáneas).
- Alternativa: bid_adjustment, cambio match type, negativas.
- tipo_objeto="keyword".
`;

    const systemPromptAudience = `
Eres "SEM-GPT", estratega senior de Google Ads. Analiza EXCLUSIVAMENTE SEGMENTOS DE AUDIENCIA.
${OUTPUT_RULES}
Reglas:
- Volumen mínimo: (impr_7d >= 300) O (clics_7d >= 20).
- Ajustes de puja: aumentar (+10% a +25%) o reducir (−10% a −25%) según ROAS/CPA.
- Exclusiones: CVR_seg = 0 con ≥30 clics o CPA_seg ≥ 2× CPA_campaña.
- tipo_objeto="segmento_audiencia".
- objeto_id="campaignId:dimension:valor".
`;
    const systemPmaxCampaigns = `
Eres "SEM-GPT", estratega senior de Google Ads experto en Performance Max.
Analiza EXCLUSIVAMENTE CAMPAÑAS Performance Max (nivel campaign).
${OUTPUT_RULES}

REGLAS ESPECÍFICAS PMAX (CAMPAGNAS):
- Analiza: gasto_7d, conv_7d, CPA, ROAS, pacing, lost_budget_is, conversion_value, search_lost_rank_is.
- tipo_objeto="campaign".
- Si pacing < 0.9 o lost_budget_is > 0.20 y buena performance (≥3 conv o ROAS> target), sugerir ↑ presupuesto con cantidad (€ o %).
- Si CPA empeora ≥20% o conv_7d=0 con gasto_7d>100€, sugerir ↓ presupuesto o revisar asset groups.
- Detectar desbalance de inversión entre asset_groups: si 1 grupo absorbe >60% gasto → redistribuir.
- Identificar saturación (pocas impresiones, pacing bajo, gasto sin delivery).
- Revisar estrategia de puja: maximizar conversiones vs valor → justificar cambio con datos.
- Proponer ajustes estratégicos: señales de audiencia, países/idiomas activos, ajustes estacionales.
- Incluir siempre evidencia numérica: impr, clics, gasto, conv, CPA, ROAS, pacing, lost_budget_is.
- categoría="presupuesto | estrategia | rendimiento".
`;

    const systemPmaxGroups = `
Eres "SEM-GPT", estratega senior de Google Ads especializado en grupos de recursos de Performance Max.
Analiza EXCLUSIVAMENTE asset_groups (grupos de recursos).
${OUTPUT_RULES}

REGLAS ESPECÍFICAS PMAX (ASSET GROUPS):
- tipo_objeto="asset_group".
- Objetivo: detectar desequilibrios y oportunidades creativas o de cobertura.
- Si un grupo tiene gasto_7d < 10% del total o impresiones muy bajas → revisar o sustituir assets.
- Si CTR o CVR del grupo difieren ±30% del promedio de campaña → destacar con evidencia.
- Si asset_group tiene alto CTR pero bajo CVR → sugerir ajuste de landing o audiencia.
- Si asset_group sin conversiones y gasto>100€ → reducir prioridad o mover presupuesto.
- Evaluar presencia de assets: headlines, descriptions, imágenes, vídeos y señales → sugerir mejoras.
- categoría="estructura | rendimiento | cobertura".
`;

    const systemPmaxAssets = `
Eres "SEM-GPT", estratega creativo y analista de assets de Performance Max.
Analiza EXCLUSIVAMENTE assets individuales (textos, imágenes, vídeos).
${OUTPUT_RULES}

REGLAS ESPECÍFICAS PMAX (ASSETS):
- tipo_objeto="asset".
- Usa las métricas disponibles (impr, clics, CTR, conv, CVR, performance_label).
- Detecta assets con "Low" o "Pending" performance_label → sugerir reemplazo o test A/B.
- Propón headlines/descriptions alternativos coherentes con el objetivo de campaña y mensaje.
- Si CTR del asset < promedio grupo → sugerir mejora copy; si CVR < promedio → revisar propuesta de valor o call-to-action.
- Revisar equilibrio de tipos de asset: texto, imagen, vídeo; sugerir añadir si falta alguno.
- Devuelve array JSON con sugerencias específicas por asset.
- categoría="creatividades | rendimiento | testing".
`;

    // ===================== PAYLOADS =====================
    const payloadCampaigns = {
      campañas: setCampañas,
      segmentos_audiencia: setSegs,
      historial_cambios: setCambios,
    };

    const payloadAdgroups = {
      adgroups: setAdgroups,
      campañas: setCampañas,
    };

    const payloadAds = {
      ads: setAds,
      adgroups: setAdgroups,
    };

    const payloadKeywords = {
      keywords: setKeywords,
      adgroups: setAdgroups,
      campañas: setCampañas,
    };

    const payloadAudience = {
      segmentos_audiencia: setSegs,
      campañas: setCampañas,
    };

    const pmax_payload_campaigns = { campañas: pmax_campañas };
    const pmax_payload_groups = {
      campañas: pmax_campañas,
      grupos: pmax_asset_groups,
    };
    const pmax_payload_assets = {
      campañas: pmax_campañas,
      grupos: pmax_asset_groups,
      assets: pmax_assets,
    };

    // ===================== EJECUTAR LLAMADAS LLM =====================
    console.log("🤖 Preparando llamadas a modelos de IA...\n");

    const llmCalls = [];

    const addCall = (name, system, payload) => {
      llmCalls.push({ name, promise: callAI({ name, system, payload }) });

    };

    // Agregar llamadas solo si hay datos
    if (setCampañas.length > 0) {
      console.log(
        `📞 Llamada 1/8: Análisis de ${setCampañas.length} campañas tradicionales...`
      );
      addCall("campaigns", systemPromptCampaign, payloadCampaigns);
    }

    if (setAdgroups.length > 0) {
      console.log(
        `📞 Llamada 2/8: Análisis de ${setAdgroups.length} ad groups...`
      );
      addCall("adgroups", systemPromptAdgroup, payloadAdgroups);
    }

    if (setAds.length > 0) {
      console.log(`📞 Llamada 3/8: Análisis de ${setAds.length} ads...`);
      addCall("ads", systemPromptAd, payloadAds);
    }

    if (setKeywords.length > 0) {
      console.log(
        `📞 Llamada 4/8: Análisis de ${setKeywords.length} keywords...`
      );
      addCall("keywords", systemPromptKeyword, payloadKeywords);
    }

    if (Object.keys(setSegs).length > 0) {
      console.log(`📞 Llamada 5/8: Análisis de segmentos de audiencia...`);
      addCall("audience", systemPromptAudience, payloadAudience);
    }

    if (pmax_campañas.length > 0) {
      console.log(
        `📞 Llamada 6/8: Análisis de ${pmax_campañas.length} campañas PMax...`
      );
      addCall("pmax_campaigns", systemPmaxCampaigns, pmax_payload_campaigns);
    }

    if (pmax_asset_groups.length > 0) {
      console.log(
        `📞 Llamada 7/8: Análisis de ${pmax_asset_groups.length} asset groups PMax...`
      );
      addCall("pmax_groups", systemPmaxGroups, pmax_payload_groups);
    }

    if (pmax_assets.length > 0) {
      console.log(
        `📞 Llamada 8/8: Análisis de ${pmax_assets.length} assets PMax...`
      );
      addCall("pmax_assets", systemPmaxAssets, pmax_payload_assets);
    }

    console.log(`\n⏳ Esperando respuestas de ${llmCalls.length} modelos...\n`);

    // Ejecutar todas las promesas en paralelo
    const results = await Promise.all(llmCalls.map((c) => c.promise));

    // Asociar resultados
    let recCamp = [],
      recGroups = [],
      recAds = [],
      recKeys = [],
      recSegs = [],
      recPmaxCamp = [],
      recPmaxGroups = [],
      recPmaxAssets = [];

    let uCamp = {},
      uGroups = {},
      uAds = {},
      uKeys = {},
      uSegs = {},
      uPmaxCamp = {},
      uPmaxGroups = {},
      uPmaxAssets = {};

    results.forEach((result, idx) => {
      const name = llmCalls[idx].name;
      const arr = result.arr || [];
      const usage = result.usage || {};

      switch (name) {
        case "campaigns":
          recCamp = arr;
          uCamp = usage;
          console.log(`   ✅ Campañas: ${arr.length} recomendaciones`);
          break;
        case "adgroups":
          recGroups = arr;
          uGroups = usage;
          console.log(`   ✅ Ad Groups: ${arr.length} recomendaciones`);
          break;
        case "ads":
          recAds = arr;
          uAds = usage;
          console.log(`   ✅ Ads: ${arr.length} recomendaciones`);
          break;
        case "keywords":
          recKeys = arr;
          uKeys = usage;
          console.log(`   ✅ Keywords: ${arr.length} recomendaciones`);
          break;
        case "audience":
          recSegs = arr;
          uSegs = usage;
          console.log(`   ✅ Audiencia: ${arr.length} recomendaciones`);
          break;
        case "pmax_campaigns":
          recPmaxCamp = arr;
          uPmaxCamp = usage;
          console.log(`   ✅ PMax Campañas: ${arr.length} recomendaciones`);
          break;
        case "pmax_groups":
          recPmaxGroups = arr;
          uPmaxGroups = usage;
          console.log(`   ✅ PMax Groups: ${arr.length} recomendaciones`);
          break;
        case "pmax_assets":
          recPmaxAssets = arr;
          uPmaxAssets = usage;
          console.log(`   ✅ PMax Assets: ${arr.length} recomendaciones`);
          break;
      }
    });

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📊 RECOMENDACIONES GENERADAS POR TIPO`);
    console.log("=".repeat(80));
    console.log(`   Campañas tradicionales: ${recCamp.length}`);
    console.log(`   Ad Groups: ${recGroups.length}`);
    console.log(`   Ads: ${recAds.length}`);
    console.log(`   Keywords: ${recKeys.length}`);
    console.log(`   Segmentos audiencia: ${recSegs.length}`);
    console.log(`   PMax Campañas: ${recPmaxCamp.length}`);
    console.log(`   PMax Groups: ${recPmaxGroups.length}`);
    console.log(`   PMax Assets: ${recPmaxAssets.length}`);
    console.log("=".repeat(80));

    // Merge y dedupe
    const allRecs = [
      ...recCamp,
      ...recGroups,
      ...recAds,
      ...recKeys,
      ...recSegs,
      ...recPmaxCamp,
      ...recPmaxGroups,
      ...recPmaxAssets,
    ];

    const seen = new Set();
    const merged = [];
    for (const it of allRecs) {
      const key = `${it.tipo_objeto ?? ""}::${it.objeto_id ?? ""}::${(
        it.titulo ?? ""
      ).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(it);
    }

    console.log(`\n📦 Total recomendaciones combinadas: ${merged.length}\n`);

    if (merged.length === 0) {
      console.log(`⚠️ ADVERTENCIA CRÍTICA: No se generaron recomendaciones`);
      console.log(`   Posibles causas:`);
      console.log(`   - Todos los arrays del LLM están vacíos`);
      console.log(`   - Los LLMs no encontraron oportunidades de mejora`);
      console.log(`   - Error en el parsing de respuestas JSON`);
    } else {
      console.log(`📋 Primeras 3 recomendaciones a guardar:`);
      merged.slice(0, 3).forEach((rec, i) => {
        console.log(
          `   ${i + 1}. ${rec.tipo_entidad || rec.tipo_objeto
          } - ${rec.titulo?.substring(0, 60)}...`
        );
      });
    }

    // ===================== GUARDAR EN DB =====================
    console.log(`\n💾 Guardando recomendaciones en base de datos...`);

    try {
      const outcome = await saveRecommendationsToDB({
        pool,
        customerId,
        llmRawResponse: JSON.stringify(merged),
      });

      console.log(`✅ Guardado exitoso:`);
      console.log(`   - Recomendaciones insertadas: ${outcome.inserted}`);
      console.log(`   - Duplicados omitidos: ${outcome.duplicates || 0}`);

      if (outcome.inserted === 0 && merged.length > 0) {
        console.log(
          `\n⚠️ PROBLEMA: Se generaron ${merged.length} recomendaciones pero NO se insertó ninguna`
        );
        console.log(`   Posibles causas:`);
        console.log(`   - Todas ya existían (duplicados)`);
        console.log(`   - Error en saveRecommendationsToDB`);
        console.log(`   - Problema con constraints de la tabla`);
      }
    } catch (saveError) {
      console.error(`\n❌ ERROR AL GUARDAR RECOMENDACIONES:`);
      console.error(`   Tipo: ${saveError.constructor.name}`);
      console.error(`   Mensaje: ${saveError.message}`);
      console.error(`   Code: ${saveError.code}`);

      if (merged.length > 0) {
        console.error(`\n📋 Ejemplo de dato que falló:`);
        console.error(JSON.stringify(merged[0], null, 2));
      }

      throw saveError;
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log(`✅ ANÁLISIS COMPLETADO PARA ${customerId}`);
    console.log("=".repeat(80) + "\n");

    // ===================== RESPUESTA FINAL =====================
    res.send({
      ok: true,
      respuesta: JSON.stringify(merged),
      usage: {
        campaigns: uCamp,
        adgroups: uGroups,
        ads: uAds,
        keywords: uKeys,
        audience: uSegs,
        pmax_campaigns: uPmaxCamp,
        pmax_groups: uPmaxGroups,
        pmax_assets: uPmaxAssets,
      },
      datosPreview:
        req.query.preview === "true"
          ? {
            campañas: setCampañas,
            pmax_campañas,
            pmax_asset_groups,
            pmax_assets,
            adgroups: setAdgroups,
            ads: setAds,
            keywords: setKeywords,
            segmentos_audiencia: setSegs,
            historial_cambios: setCambios,
          }
          : undefined,
    });
  } catch (error) {
    console.error(`\n${"❌".repeat(40)}`);
    console.error(`❌ ERROR CRÍTICO EN ANÁLISIS DE ${customerId}`);
    console.error("❌".repeat(40));
    console.error(`Tipo: ${error.constructor.name}`);
    console.error(`Mensaje: ${error.message}`);
    console.error(`Stack:`, error.stack);
    console.error("❌".repeat(40) + "\n");

    res.status(500).send(`Error: ${error.message}`);
  }
});

router.get("/recomendaciones/:customer_id", async (req, res) => {
  const { customer_id } = req.params;
  const { limite = 100 } = req.query; // Solo parámetro de límite

  if (!customer_id) {
    return res
      .status(400)
      .json({ message: "El parámetro customer_id es requerido" });
  }

  // Validar que el customer_id no esté vacío después del trim
  const cleanCustomerId = customer_id.trim();
  if (!cleanCustomerId) {
    return res
      .status(400)
      .json({ message: "El customer_id no puede estar vacío" });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        id, 
        customer_id, 
        titulo, 
        descripcion, 
        categoria, 
        prioridad, 
        impacto_estimado,
        tipo_objeto, 
        objeto_id, 
        estado, 
        fecha_aplicacion, 
        fecha_creacion
      FROM recomendaciones
      WHERE customer_id = ? AND estado IN ('activa', 'pendiente')
      ORDER BY 
        CASE 
          WHEN prioridad = 'alta' THEN 1
          WHEN prioridad = 'media' THEN 2
          WHEN prioridad = 'baja' THEN 3
          ELSE 4
        END,
        fecha_creacion DESC
      LIMIT ?
      `,
      [cleanCustomerId, parseInt(limite)]
    );

    // Devolver directamente el array de recomendaciones
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener recomendaciones:", error);
    res.status(500).json({
      message: "Error al obtener las recomendaciones",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.get("/recomendaciones-aplicadas/:customer_id", async (req, res) => {
  const { customer_id } = req.params;

  if (!customer_id) {
    return res
      .status(400)
      .json({ message: "El parámetro customer_id es requerido" });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        id, customer_id, titulo, descripcion, categoria, prioridad, impacto_estimado,
        tipo_objeto, objeto_id, estado, fecha_aplicacion, fecha_creacion
      FROM recomendaciones
      WHERE customer_id = ?
        AND estado = 'aplicada'
      ORDER BY fecha_aplicacion DESC
      LIMIT 100
      `,
      [customer_id]
    );

    const formattedRows = rows.map(r => ({
      ...r,
      resultado: {
        estado: 'improved',
        mejora_real: r.mejora_real || r.impacto_estimado,
        periodo_comparacion: r.periodo_comparacion || "7 días",
        variacion_kpi: r.variacion_kpi || 0
      }
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error("Error al obtener recomendaciones aplicadas:", error);
    res
      .status(500)
      .json({ message: "Error al obtener las recomendaciones aplicadas" });
  }
});

router.post("/recomendaciones/:id/aplicar", async (req, res) => {
  const { id } = req.params;
  const { resultado } = req.body || {};

  if (!id) {
    return res.status(400).json({ message: "El parámetro id es requerido" });
  }

  try {
    // Verificar si la recomendación existe
    const [rows] = await pool.query(
      "SELECT * FROM recomendaciones WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Recomendación no encontrada" });
    }

    const recomendacion = rows[0];

    // Verificar si ya estaba aplicada
    if (recomendacion.estado === "aplicada") {
      return res
        .status(400)
        .json({ message: "La recomendación ya está aplicada" });
    }

    // Actualizar la recomendación
    await pool.query(
      `UPDATE recomendaciones
       SET estado = 'aplicada', 
           fecha_aplicacion = NOW(),
           mejora_real = ?,
           periodo_comparacion = ?,
           variacion_kpi = ?
       WHERE id = ?`,
      [
        resultado?.mejora_real || null,
        resultado?.periodo_comparacion || null,
        resultado?.variacion_kpi || null,
        id
      ]
    );

    res.json({
      message: "Recomendación marcada como aplicada",
      id: Number(id),
    });
  } catch (error) {
    console.error("Error al aplicar recomendación:", error);
    res.status(500).json({ message: "Error al aplicar la recomendación" });
  }
});

export default router;
