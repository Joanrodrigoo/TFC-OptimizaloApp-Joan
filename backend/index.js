// index.js - BACKEND UNIFICADO

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import OpenAI from "openai";
import { GoogleAdsApi } from "google-ads-api";
import mysql from "mysql2/promise";
import testPayment from "./stripe/stripe_payments_gateway.js";
import checkoutRoutes from "./stripe/createCheckoutSession.js";
import { authenticateUser } from "./middleware/authenticateUser.js";
import activateSubscriptionRouter from "./routes/activateSubscription.js";
import webhookRoutes from "./routes/webhook.js";
import session from "express-session";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import AccountSyncQueueConcurrent from "./syncAccounts/AccountSyncQueueConcurrent.js";
import {
  createSyncTasks,
  createDailyTask,
  getSyncStatus,
  cleanCompletedTasks,
  retryFailedTasks,
} from "./syncAccounts/syncUtils.js";
import AnalysisQueueManager from "./analysisQueue/AnalysisQueueManager.js";
import {
  createWeeklyAnalysisTask,
  getAnalysisStatus,
} from "./analysisQueue/analysisUtils.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(
  cors({
    origin: "https://optimizalo.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
  })
);

app.use("/webhook", webhookRoutes);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // HTTPS
      sameSite: "none", // ✅ CAMBIO CLAVE: 'none' en lugar de 'lax'
      httpOnly: true, // Seguridad extra
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    },
  })
);

/* Middleware de debug (temporal)
app.use((req, res, next) => {
  console.log("Session ID:", req.sessionID);
  console.log("Session data:", req.session);
  console.log("Cookies:", req.headers.cookie);
  next();
});
*/

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api", activateSubscriptionRouter);

app.use("/api/stripe", testPayment);
app.use("/api/stripe", authenticateUser, checkoutRoutes);

app.get("/api/health", (req, res) => {
  res.send("✅ Backend activo");
});

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// CIRCUIT BREAKER PARA GOOGLE ADS API
/*============================================
let googleAdsFailureCount = 0;
let googleAdsCircuitOpen = false;
const CIRCUIT_THRESHOLD = 15; // Abrir circuito tras 15 fallos
const CIRCUIT_RESET_TIME = 2; // 5 minutos

function checkCircuitBreaker() {
  if (googleAdsCircuitOpen) {
    throw new Error('Circuit breaker open: Google Ads API failing repeatedly');
  }
  if (googleAdsFailureCount >= CIRCUIT_THRESHOLD) {
    googleAdsCircuitOpen = true;
    console.error('🔴 CIRCUIT BREAKER ABIERTO: Demasiados errores de Google Ads');
    console.error(`   Esperando ${CIRCUIT_RESET_TIME / 1000} segundos antes de reintentar...`);
    setTimeout(() => {
      googleAdsCircuitOpen = false;
      googleAdsFailureCount = 0;
      console.log('🟢 CIRCUIT BREAKER REINICIADO');
    }, CIRCUIT_RESET_TIME);
    throw new Error('Circuit breaker activated');
  }
}

function recordGoogleAdsSuccess() {
  // Reducir contador gradualmente en caso de éxito
  if (googleAdsFailureCount > 0) {
    googleAdsFailureCount = Math.max(0, googleAdsFailureCount - 1);
  }
}
  */

// Google OAuth
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Google Ads API
const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_DEVELOPER_TOKEN,
  use_rest: true,
});

// =============== INICIALIZAR COLA CONCURRENTE =================
const syncQueue = new AccountSyncQueueConcurrent(pool, {
  maxConcurrent: 3, // Procesar 3 cuentas a la vez
  retryDelay: 2000,
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  developerToken: process.env.GOOGLE_DEVELOPER_TOKEN,
});

console.log("🚀 Sistema de sincronización inicializado");

const analysisQueue = new AnalysisQueueManager(pool, {
  maxConcurrent: 1, // Solo 2 análisis simultáneos (IA es costosa)
  apiBase: "http://localhost:3000",
});

console.log("🤖 Sistema de análisis con IA inicializado");

// Crear carpeta de logs si no existe
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ============================================
// FUNCIONES DE LOGGING SIMPLES
// ============================================

function getLogFilename(type) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(logsDir, `${type}-${today}.log`);
}

function writeToLog(type, data) {
  try {
    const timestamp = new Date().toISOString();
    const logFile = getLogFilename(type);
    const logEntry = `
${"=".repeat(80)}
[${timestamp}]
${typeof data === "object" ? JSON.stringify(data, null, 2) : data}
${"=".repeat(80)}

`;
    fs.appendFileSync(logFile, logEntry, "utf8");
  } catch (error) {
    console.error("Error escribiendo log:", error);
  }
}

function logQueryError(context, query, error, customerObj) {
  const errorData = {
    timestamp: new Date().toISOString(),
    context: {
      name: context.name || "unknown",
      customer_id:
        context.customer_id ||
        customerObj?.customer_id ||
        customerObj?.customerId ||
        "unknown",
      campaign_id: context.campaign_id || null,
      ad_group_id: context.ad_group_id || null,
      date: context.date || null,
    },
    query: query.substring(0, 500) + (query.length > 500 ? "..." : ""), // Limitar tamaño
    error: {
      message: error.message || String(error),
      code: error.code || null,
      type: error.constructor.name,
      stack: error.stack ? error.stack.substring(0, 1000) : null,
    },
  };

  writeToLog("google-ads-query-errors", errorData);
  return errorData;
}
/*
function logCircuitBreakerEvent(event, details = {}) {
  const eventData = {
    timestamp: new Date().toISOString(),
    event,
    failureCount: googleAdsFailureCount,
    isOpen: googleAdsCircuitOpen,
    ...details
  };
  
  writeToLog('circuit-breaker', eventData);
  console.log(`🔴 Circuit Breaker: ${event}`);
}
*/

function logSyncError(customerId, phase, error, additionalData = {}) {
  const errorData = {
    timestamp: new Date().toISOString(),
    customer_id: customerId,
    phase,
    error: {
      message: error.message || String(error),
      code: error.code || null,
      type: error.constructor.name,
      stack: error.stack ? error.stack.substring(0, 1000) : null,
    },
    ...additionalData,
  };

  writeToLog("sync-errors", errorData);
}

// Endpoint para listar archivos de log
app.get("/api/logs/list", (req, res) => {
  try {
    const files = fs
      .readdirSync(logsDir)
      .filter((file) => file.endsWith(".log"))
      .map((file) => ({
        name: file,
        size: fs.statSync(path.join(logsDir, file)).size,
        modified: fs.statSync(path.join(logsDir, file)).mtime,
      }))
      .sort((a, b) => b.modified - a.modified);

    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para leer un archivo de log específico
app.get("/api/logs/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const { lines = 100 } = req.query; // Por defecto últimas 100 líneas

    const filePath = path.join(logsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    const content = fs.readFileSync(filePath, "utf8");
    const allLines = content.split("\n");
    const lastLines = allLines.slice(-parseInt(lines));

    res.json({
      filename,
      totalLines: allLines.length,
      displayedLines: lastLines.length,
      content: lastLines.join("\n"),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para limpiar logs antiguos (más de 30 días)
app.delete("/api/logs/cleanup", (req, res) => {
  try {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const files = fs.readdirSync(logsDir);
    let deleted = 0;

    files.forEach((file) => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime.getTime() < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    });

    res.json({
      message: `${deleted} archivos eliminados`,
      deleted,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============== ENDPOINTS PRINCIPALES =================

// Busca callouts y sitelinks a nivel cuenta, campaña, grupo de anuncios y anuncio
/*
async function fetchCalloutsAndSitelinks(customer, customerId, campaignId) {
  const callouts = new Set();
  const sitelinks = new Map(); // key para evitar duplicados: `${linkText}::${desc1}::${desc2}::${level}::${parentId}`

  const safePush = (level, parentId, row) => {
    const linkText = row?.asset?.sitelink_asset?.link_text;
    const desc1 = row?.asset?.sitelink_asset?.description1 || null;
    const desc2 = row?.asset?.sitelink_asset?.description2 || null;
    if (linkText) {
      const key = `${linkText}::${desc1 || ""}::${desc2 || ""}::${level}::${parentId}`;
      if (!sitelinks.has(key)) {
        sitelinks.set(key, { title: linkText, url: null, desc1, desc2, level, parentId });
      }
    }
  };

  const campaignResource = `customers/${customerId}/campaigns/${campaignId}`;

  try {
    // 1) Nivel cuenta
    try {
      const rows = await customer.query(`
        SELECT
          customer_asset.field_type,
          asset.callout_asset.callout_text,
          asset.sitelink_asset.link_text,
          asset.sitelink_asset.description1,
          asset.sitelink_asset.description2
        FROM customer_asset
        WHERE customer_asset.status = 'ENABLED'
          AND customer_asset.field_type IN ('CALLOUT', 'SITELINK')
      `);
      for (const row of rows) {
        if (row?.customer_asset?.field_type === "CALLOUT") {
          const t = row?.asset?.callout_asset?.callout_text;
          if (t) callouts.add(t);
        } else if (row?.customer_asset?.field_type === "SITELINK") {
          safePush("ACCOUNT", "ACCOUNT", row);
        }
      }
    } catch (e) {
      console.warn("⚠️ customer_asset no disponible:", e?.message || e);
    }

    // 2) Nivel campaña
    try {
      const rows = await customer.query(`
        SELECT
          campaign_asset.field_type,
          asset.callout_asset.callout_text,
          asset.sitelink_asset.link_text,
          asset.sitelink_asset.description1,
          asset.sitelink_asset.description2,
          campaign_asset.campaign
        FROM campaign_asset
        WHERE campaign_asset.status = 'ENABLED'
          AND campaign_asset.campaign = '${campaignResource}'
          AND campaign_asset.field_type IN ('CALLOUT', 'SITELINK')
      `);
      for (const row of rows) {
        if (row?.campaign_asset?.field_type === "CALLOUT") {
          const t = row?.asset?.callout_asset?.callout_text;
          if (t) callouts.add(t);
        } else if (row?.campaign_asset?.field_type === "SITELINK") {
          safePush("CAMPAIGN", campaignId, row);
        }
      }
    } catch (e) {
      console.warn("⚠️ campaign_asset no disponible:", e?.message || e);
    }

    // 3) Nivel grupo de anuncios
    try {
      const rows = await customer.query(`
        SELECT
          ad_group_asset.field_type,
          asset.callout_asset.callout_text,
          asset.sitelink_asset.link_text,
          asset.sitelink_asset.description1,
          asset.sitelink_asset.description2,
          ad_group_asset.ad_group
        FROM ad_group_asset
        WHERE ad_group_asset.status = 'ENABLED'
          AND ad_group.campaign = '${campaignResource}'
          AND ad_group_asset.field_type IN ('CALLOUT', 'SITELINK')
      `);
      for (const row of rows) {
        if (row?.ad_group_asset?.field_type === "CALLOUT") {
          const t = row?.asset?.callout_asset?.callout_text;
          if (t) callouts.add(t);
        } else if (row?.ad_group_asset?.field_type === "SITELINK") {
          const adGroupId = row?.ad_group_asset?.ad_group?.split("/").pop();
          safePush("AD_GROUP", adGroupId, row);
        }
      }
    } catch (e) {
      console.warn("⚠️ ad_group_asset no disponible:", e?.message || e);
    }

    // 4) Nivel anuncio
    try {
      const rows = await customer.query(`
        SELECT
          ad_asset.field_type,
          asset.callout_asset.callout_text,
          asset.sitelink_asset.link_text,
          asset.sitelink_asset.description1,
          asset.sitelink_asset.description2,
          ad_asset.ad
        FROM ad_asset
        WHERE ad_asset.status = 'ENABLED'
          AND ad_group.campaign = '${campaignResource}'
          AND ad_asset.field_type IN ('CALLOUT', 'SITELINK')
      `);
      for (const row of rows) {
        if (row?.ad_asset?.field_type === "CALLOUT") {
          const t = row?.asset?.callout_asset?.callout_text;
          if (t) callouts.add(t);
        } else if (row?.ad_asset?.field_type === "SITELINK") {
          const adId = row?.ad_asset?.ad?.split("/").pop();
          safePush("AD", adId, row);
        }
      }
    } catch (e) {
      console.warn("⚠️ ad_asset no disponible:", e?.message || e);
    }

    const calloutsArr = [...callouts];
    const sitelinksArr = [...sitelinks.values()];
    console.log(`✅ Extensiones obtenidas (campaña ${campaignId}) — Callouts: ${calloutsArr.length}, Sitelinks: ${sitelinksArr.length}`);
    return { callouts: calloutsArr, sitelinks: sitelinksArr };

  } catch (error) {
    console.error("❌ Error obteniendo extensiones:", error?.message || error);
    return { callouts: [], sitelinks: [] };
  }
}
*/

/**
 * Obtiene todas las imágenes asociadas a cada anuncio de Google Ads.
 *
 * Consulta la vista `ad_group_ad_asset_view` para extraer los activos
 * de tipo imagen (`asset.type = 'IMAGE'`) vinculados a los anuncios,
 * agrupándolos por el ID de anuncio.
 * NO USADA
 */
async function fetchImagesByAdId(customer, customerId) {
  const imagesByAdId = {};

  const query = `
    SELECT
      ad_group_ad.ad.id,
      asset.image_asset.full_size.url,
      asset.name
    FROM ad_group_ad_asset_view
    WHERE asset.type = 'IMAGE'
  `;

  const result = await customer.query(query);

  for (const row of result) {
    const adId = row.ad_group_ad.ad.id;
    if (!imagesByAdId[adId]) imagesByAdId[adId] = [];

    imagesByAdId[adId].push({
      url: row.asset.image_asset.full_size.url,
      type: row.asset.name || "Imagen",
    });
  }

  return imagesByAdId;
}

/**
 * Obtiene y guarda los segmentos de audiencia asociados a un grupo de anuncios en Google Ads.
 *
 * Consulta varias vistas segmentadas (DEVICE, AGE_RANGE, GENDER, INCOME_RANGE, DAY_OF_WEEK, HOUR_OF_DAY, NETWORK)
 * para un ad group específico en una fecha dada, normaliza los valores usando mapeos legibles,
 * y guarda los resultados en la tabla `audience_segments` de la base de datos.
 *
 * Incluye backfill para dispositivos y rangos de edad, asegurando que todas las categorías
 * aparezcan aunque no tengan impresiones ese día.
 *
 */

async function fetchAndSaveAudienceSegmentsForAdGroup(
  customer,
  customerId,
  campaignId,
  adGroupId,
  date,
  options = {}
) {
  console.log(
    `🔎 [audience/AdGroup] campaign=${campaignId} adGroup=${adGroupId} date=${date}`
  );

  const toNum = (v) => (v == null || isNaN(v) ? 0 : Number(v));
  const ctrPct = (clicks, impressions) =>
    impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0.0;

  const finalRows = [];

  // ✅ MEJORA 1: Timeout específico para queries de audiencia
  const AUDIENCE_TIMEOUT = 20000; // 20 segundos

  // ============================================
  // 1) GENDER
  // ============================================
  const qGender = `
    SELECT
      campaign.id,
      ad_group.id,
      ad_group_criterion.gender.type,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.conversions,
      metrics.cost_micros
      ${options.includeBidModifier ? ", ad_group_criterion.bid_modifier" : ""}
    FROM gender_view
    WHERE campaign.id = ${campaignId}
      AND ad_group.id = ${adGroupId}
      AND segments.date = '${date}'
      AND metrics.impressions > 0
    ORDER BY metrics.impressions DESC
    LIMIT 20
  `;

  try {
    const genderRows = await safeQuery(customer, qGender, {
      retries: 2, // ⬇️ Reducir reintentos
      baseDelay: 500,
      timeout: AUDIENCE_TIMEOUT, // ✅ Timeout explícito
      throwOnError: false, // ✅ No lanzar error si falla
      context: {
        name: "fetchAudienceSegments_Gender",
        campaign_id: campaignId,
        ad_group_id: adGroupId,
        date: date,
      },
    });

    console.log(`📊 [Gender] rows=${genderRows.length}`);

    // ✅ MEJORA 2: Validar que genderRows sea array
    if (Array.isArray(genderRows)) {
      for (const r of genderRows) {
        const imps = toNum(r.metrics?.impressions);
        const clicks = toNum(r.metrics?.clicks);

        // ✅ MEJORA 3: Validar que tenga datos mínimos
        if (imps === 0 && clicks === 0) continue;

        finalRows.push({
          customer_id: customerId,
          campaign_id: campaignId,
          ad_group_id: adGroupId,
          segment_type: "GENDER",
          segment_value: r.ad_group_criterion?.gender?.type || "UNKNOWN",
          impressions: imps,
          clicks: clicks,
          ctr: toNum(r.metrics?.ctr)
            ? Math.round(toNum(r.metrics.ctr) * 10000) / 100
            : ctrPct(clicks, imps),
          conversions: toNum(r.metrics?.conversions),
          cost_micros: toNum(r.metrics?.cost_micros),
          date,
          bid_modifier: options.includeBidModifier
            ? r.ad_group_criterion?.bid_modifier || null
            : null,
        });
      }
    }
  } catch (genderError) {
    console.error(`❌ [Gender] Error:`, genderError.message);
    // ✅ Continuar con siguiente segmento
  }

  // ============================================
  // 2) AGE RANGE
  // ============================================
  const qAge = `
    SELECT
      campaign.id,
      ad_group.id,
      ad_group_criterion.age_range.type,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.conversions,
      metrics.cost_micros
      ${options.includeBidModifier ? ", ad_group_criterion.bid_modifier" : ""}
    FROM age_range_view
    WHERE campaign.id = ${campaignId}
      AND ad_group.id = ${adGroupId}
      AND segments.date = '${date}'
      AND metrics.impressions > 0
    ORDER BY metrics.impressions DESC
    LIMIT 20
  `;

  try {
    const ageRows = await safeQuery(customer, qAge, {
      retries: 2,
      baseDelay: 500,
      timeout: AUDIENCE_TIMEOUT,
      throwOnError: false,
      context: {
        name: "fetchAudienceSegments_Age",
        campaign_id: campaignId,
        ad_group_id: adGroupId,
        date: date,
      },
    });

    console.log(`📊 [Age] rows=${ageRows.length}`);

    if (Array.isArray(ageRows)) {
      for (const r of ageRows) {
        const imps = toNum(r.metrics?.impressions);
        const clicks = toNum(r.metrics?.clicks);

        if (imps === 0 && clicks === 0) continue;

        finalRows.push({
          customer_id: customerId,
          campaign_id: campaignId,
          ad_group_id: adGroupId,
          segment_type: "AGE",
          segment_value: r.ad_group_criterion?.age_range?.type || "UNKNOWN",
          impressions: imps,
          clicks: clicks,
          ctr: toNum(r.metrics?.ctr)
            ? Math.round(toNum(r.metrics.ctr) * 10000) / 100
            : ctrPct(clicks, imps),
          conversions: toNum(r.metrics?.conversions),
          cost_micros: toNum(r.metrics?.cost_micros),
          date,
          bid_modifier: options.includeBidModifier
            ? r.ad_group_criterion?.bid_modifier || null
            : null,
        });
      }
    }
  } catch (ageError) {
    console.error(`❌ [Age] Error:`, ageError.message);
    // ✅ Continuar con guardado de lo que tenemos
  }

  // ============================================
  // 3) DEVICE (OPCIONAL - DESCOMENTARSI NECESARIO)
  // ============================================
  /*
  const qDevice = `
    SELECT
      campaign.id,
      ad_group.id,
      segments.device,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.conversions,
      metrics.cost_micros
    FROM ad_group
    WHERE campaign.id = ${campaignId}
      AND ad_group.id = ${adGroupId}
      AND segments.date = '${date}'
      AND metrics.impressions > 0
    ORDER BY metrics.impressions DESC
    LIMIT 10
  `;

  try {
    const deviceRows = await safeQuery(customer, qDevice, {
      retries: 2,
      baseDelay: 500,
      timeout: AUDIENCE_TIMEOUT,
      throwOnError: false,
      context: {
        name: "fetchAudienceSegments_Device",
        campaign_id: campaignId,
        ad_group_id: adGroupId,
        date: date,
      },
    });

    console.log(`📊 [Device] rows=${deviceRows.length}`);

    if (Array.isArray(deviceRows)) {
      for (const r of deviceRows) {
        const imps = toNum(r.metrics?.impressions);
        const clicks = toNum(r.metrics?.clicks);
        
        if (imps === 0 && clicks === 0) continue;
        
        finalRows.push({
          customer_id: customerId,
          campaign_id: campaignId,
          ad_group_id: adGroupId,
          segment_type: "DEVICE",
          segment_value: r.segments?.device || "UNKNOWN",
          impressions: imps,
          clicks: clicks,
          ctr: toNum(r.metrics?.ctr)
            ? Math.round(toNum(r.metrics.ctr) * 10000) / 100
            : ctrPct(clicks, imps),
          conversions: toNum(r.metrics?.conversions),
          cost_micros: toNum(r.metrics?.cost_micros),
          date,
          bid_modifier: null, // Device no tiene bid_modifier en ad_group_criterion
        });
      }
    }
  } catch (deviceError) {
    console.error(`❌ [Device] Error:`, deviceError.message);
  }
  */

  // ============================================
  // VALIDACIÓN FINAL
  // ============================================
  if (finalRows.length === 0) {
    console.log("ℹ️ [audience/AdGroup] No hay datos para guardar");
    return [];
  }

  console.log(
    `📋 [audience/AdGroup] Total segmentos a guardar: ${finalRows.length}`
  );

  // ============================================
  // GUARDADO OPTIMIZADO EN BATCH
  // ============================================
  try {
    const sql = `
      INSERT INTO audience_segments
        (customer_id, campaign_id, ad_group_id, segment_type, segment_value, 
         impressions, clicks, ctr, conversions, cost_micros, date, bid_modifier, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        ctr = VALUES(ctr),
        conversions = VALUES(conversions),
        cost_micros = VALUES(cost_micros),
        bid_modifier = VALUES(bid_modifier)
    `;

    // ✅ MEJORA 4: Guardar en batch para mejor performance
    const BATCH_SIZE = 20;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < finalRows.length; i += BATCH_SIZE) {
      const batch = finalRows.slice(i, i + BATCH_SIZE);

      for (const r of batch) {
        try {
          await pool.execute(sql, [
            r.customer_id,
            r.campaign_id,
            r.ad_group_id,
            r.segment_type,
            r.segment_value,
            r.impressions,
            r.clicks,
            r.ctr,
            r.conversions,
            r.cost_micros,
            r.date,
            r.bid_modifier,
          ]);
          inserted++;
        } catch (insertError) {
          errors++;
          // ✅ Log individual pero no lanzar error
          console.error(
            `⚠️ Error guardando ${r.segment_type}:${r.segment_value}:`,
            insertError.message
          );
        }
      }

      // ✅ Pequeña pausa entre batches
      if (i + BATCH_SIZE < finalRows.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    console.log(
      `✅ [audience/AdGroup] guardado OK: ${inserted}/${finalRows.length} (${errors} errores)`
    );
  } catch (err) {
    console.error(
      "❌ Error general guardando audience_segments (AdGroup):",
      err
    );
    // ✅ MEJORA 5: No lanzar error para no interrumpir el proceso completo
    return finalRows; // Devolver lo que se procesó
  }

  return finalRows;
}

async function fetchAndSaveAudienceSegments(
  customer,
  customerId,
  campaignId,
  date
) {
  console.log(`🔎 [audience/GEO] campaign=${campaignId} date=${date}`);

  const toNum = (v) => (v == null || isNaN(v) ? 0 : Number(v));
  const ctrPct = (clicks, impressions) =>
    impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0.0;

  const geoTempRows = [];
  const geoIdSet = new Set();

  // ✅ MEJORA 1: Timeout específico para queries GEO (30 segundos)
  const GEO_TIMEOUT = 30000;

  // ---- 1) geographic_view con LIMIT y timeout
  let geoCollected = 0;
  const qGeo = `
    SELECT
      campaign.id,
      geographic_view.country_criterion_id,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.conversions,
      metrics.cost_micros
    FROM geographic_view
    WHERE campaign.id = ${campaignId}
      AND segments.date = '${date}'
      AND metrics.impressions > 0
    ORDER BY metrics.impressions DESC
    LIMIT 500
  `;

  try {
    const geoRs = await safeQuery(customer, qGeo, {
      retries: 2, // ⬇️ Reducir reintentos
      baseDelay: 500,
      timeout: GEO_TIMEOUT, // ✅ Timeout explícito
      context: {
        name: "fetchAudienceSegments_GEO",
        campaign_id: campaignId,
        date: date,
      },
    });

    geoCollected = geoRs.length;
    console.log(`✅ [audience/GEO geographic_view] rows=${geoRs.length}`);

    for (const r of geoRs) {
      const id = r.geographic_view?.country_criterion_id;
      if (id != null) geoIdSet.add(Number(id));

      const imps = toNum(r.metrics?.impressions);
      const clicks = toNum(r.metrics?.clicks);
      geoTempRows.push({
        customer_id: customerId,
        campaign_id: campaignId,
        segment_type: "GEO",
        segment_value_raw: id,
        impressions: imps,
        clicks: clicks,
        ctr: toNum(r.metrics?.ctr)
          ? Math.round(toNum(r.metrics.ctr) * 10000) / 100
          : ctrPct(clicks, imps),
        conversions: toNum(r.metrics?.conversions),
        cost_micros: toNum(r.metrics?.cost_micros),
        date,
      });
    }
  } catch (geoError) {
    console.error(
      `❌ [audience/GEO] Error en geographic_view:`,
      geoError.message
    );
    // ✅ No lanzar error, continuar con fallback
  }

  // ---- 2) Fallback: user_location_view SOLO si no hay datos
  if (geoCollected === 0) {
    const qUserLoc = `
      SELECT
        campaign.id,
        user_location_view.country_criterion_id,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.conversions,
        metrics.cost_micros
      FROM user_location_view
      WHERE campaign.id = ${campaignId}
        AND segments.date = '${date}'
        AND metrics.impressions > 0
      ORDER BY metrics.impressions DESC
      LIMIT 500
    `;

    try {
      const userLocRs = await safeQuery(customer, qUserLoc, {
        retries: 2,
        baseDelay: 500,
        timeout: GEO_TIMEOUT,
        context: {
          name: "fetchAudienceSegments_GEO_userLocation",
          campaign_id: campaignId,
          date: date,
        },
      });

      console.log(
        `✅ [audience/GEO user_location_view] rows=${userLocRs.length}`
      );

      for (const r of userLocRs) {
        const id = r.user_location_view?.country_criterion_id;
        if (id != null) geoIdSet.add(Number(id));

        const imps = toNum(r.metrics?.impressions);
        const clicks = toNum(r.metrics?.clicks);
        geoTempRows.push({
          customer_id: customerId,
          campaign_id: campaignId,
          segment_type: "GEO",
          segment_value_raw: id,
          impressions: imps,
          clicks: clicks,
          ctr: toNum(r.metrics?.ctr)
            ? Math.round(toNum(r.metrics.ctr) * 10000) / 100
            : ctrPct(clicks, imps),
          conversions: toNum(r.metrics?.conversions),
          cost_micros: toNum(r.metrics?.cost_micros),
          date,
        });
      }
    } catch (userLocError) {
      console.error(
        `❌ [audience/GEO] Error en user_location_view:`,
        userLocError.message
      );
      // ✅ Continuar sin datos GEO
    }
  }

  // Si no hay nada, salir temprano
  if (geoTempRows.length === 0) {
    console.log("ℹ️ [audience/GEO] No hay filas que guardar");
    return [];
  }

  // ---- 3) Mapear IDs GEO → "CC - Nombre" con LÍMITE
  let GEO_MAP = {};
  const geoIds = Array.from(geoIdSet);

  if (geoIds.length > 0) {
    // ✅ MEJORA 2: Limitar cantidad de IDs a mapear (evitar query masiva)
    const MAX_GEO_IDS = 200;
    const geoIdsLimited = geoIds.slice(0, MAX_GEO_IDS);

    if (geoIds.length > MAX_GEO_IDS) {
      console.warn(
        `⚠️ [audience/GEO] Limitando mapeo de ${geoIds.length} a ${MAX_GEO_IDS} IDs`
      );
    }

    const qMap = `
      SELECT
        geo_target_constant.id,
        geo_target_constant.country_code,
        geo_target_constant.name
      FROM geo_target_constant
      WHERE geo_target_constant.id IN (${geoIdsLimited.join(",")})
      LIMIT 500
    `;

    try {
      const mapRows = await safeQuery(customer, qMap, {
        retries: 2,
        baseDelay: 500,
        timeout: 15000, // ✅ Timeout más corto para mapeo
        context: {
          name: "fetchAudienceSegments_GEO_mapping",
          campaign_id: campaignId,
          date: date,
        },
      });

      GEO_MAP = mapRows.reduce((acc, r) => {
        const id = Number(r.geo_target_constant?.id);
        const code = r.geo_target_constant?.country_code || "XX";
        const name = r.geo_target_constant?.name || `ID_${id}`;
        acc[id] = `${code} - ${name}`;
        return acc;
      }, {});
    } catch (mapError) {
      console.error(`❌ [audience/GEO] Error mapeando IDs:`, mapError.message);
      // ✅ Continuar con IDs numéricos si falla el mapeo
    }
  }

  // ---- 4) Construir filas finales con valor legible
  const finalRows = geoTempRows.map((gr) => {
    const id = Number(gr.segment_value_raw);
    return {
      customer_id: gr.customer_id,
      campaign_id: gr.campaign_id,
      segment_type: "GEO",
      segment_value: GEO_MAP[id] || (isNaN(id) ? "UNKNOWN" : `ID_${id}`),
      impressions: gr.impressions,
      clicks: gr.clicks,
      ctr: gr.ctr,
      conversions: gr.conversions,
      cost_micros: gr.cost_micros,
      date: gr.date,
    };
  });

  // ---- 5) Guardado en batch (más eficiente)
  try {
    const sql = `
      INSERT INTO audience_segments
        (customer_id, campaign_id, segment_type, segment_value, impressions, clicks, ctr, conversions, cost_micros, date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        ctr = VALUES(ctr),
        conversions = VALUES(conversions),
        cost_micros = VALUES(cost_micros)
    `;

    // ✅ MEJORA 3: Guardar en batch de 50 para evitar bloqueos largos
    const BATCH_SIZE = 50;
    let inserted = 0;

    for (let i = 0; i < finalRows.length; i += BATCH_SIZE) {
      const batch = finalRows.slice(i, i + BATCH_SIZE);

      for (const r of batch) {
        await pool.execute(sql, [
          r.customer_id,
          r.campaign_id,
          r.segment_type,
          r.segment_value,
          r.impressions,
          r.clicks,
          r.ctr,
          r.conversions,
          r.cost_micros,
          r.date,
        ]);
        inserted++;
      }

      // ✅ Pequeña pausa entre batches
      if (i + BATCH_SIZE < finalRows.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`💾 [audience/GEO] guardado OK: total=${inserted}`);
  } catch (err) {
    console.error("❌ Error guardando audience_segments (GEO):", err);
    throw err;
  }

  return finalRows;
}

/**
 * Recupera los idiomas configurados en una campaña específica de Google Ads.
 *
 * 1. Consulta la tabla `campaign_criterion` para obtener las referencias (`language_constant`)
 *    de todos los idiomas habilitados asociados a la campaña indicada.
 * 2. Con esas referencias, realiza una segunda consulta a `language_constant` para obtener
 *    el código y nombre legible de cada idioma.
 * 3. Devuelve un array de objetos con `resource_name`, `code` y `name` de cada idioma encontrado.
 *
 * Si la campaña no tiene idiomas configurados, devuelve un array vacío.
 */

async function getCampaignLanguages(customer, customerId, campaignId) {
  const criteria = await safeQuery(
    customer,
    `
    SELECT
      campaign_criterion.language.language_constant
    FROM campaign_criterion
    WHERE campaign_criterion.campaign = 'customers/${customerId}/campaigns/${campaignId}'
      AND campaign_criterion.type = 'LANGUAGE'
      AND campaign_criterion.status = 'ENABLED'
  `,
    {
      retries: 3,
      baseDelay: 500,
      context: {
        name: "getCampaignLanguages",
        customer_id: customerId,
        campaign_id: campaignId,
        date: null,
      },
    }
  );

  const languageConstants = criteria
    .map((c) => c.campaign_criterion?.language?.language_constant)
    .filter(Boolean);

  if (!languageConstants.length) return [];

  const languageStrings = languageConstants.map((lc) => `'${lc}'`).join(",");

  const languages = await safeQuery(
    customer,
    `
    SELECT
      language_constant.resource_name,
      language_constant.code,
      language_constant.name
    FROM language_constant
    WHERE language_constant.resource_name IN (${languageStrings})
  `,
    {
      retries: 3,
      baseDelay: 500,
      context: {
        name: "getCampaignLanguages_constants",
        customer_id: customerId,
        campaign_id: campaignId,
        date: null,
      },
    }
  );

  return languages.map((lang) => ({
    resource_name: lang.language_constant.resource_name,
    code: lang.language_constant.code,
    name: lang.language_constant.name,
  }));
}

/**
 * Guarda en base de datos los idiomas asociados a una campaña de Google Ads.
 *
 * 1. Recorre el array `languages` recibido (cada elemento debe incluir `resource_name`, `code` y `name`).
 * 2. Inserta cada idioma en la tabla `campaign_languages` junto con `customer_id` y `campaign_id`.
 * 3. Si ya existe un registro con la misma clave única, actualiza `code` y `name`.
 * 4. Registra la fecha de creación con `NOW()` al insertar.
 *
 * Si no hay idiomas en el array, no realiza ninguna acción.
 */

async function saveCampaignLanguages(customerId, campaignId, languages) {
  if (!languages.length) return;

  try {
    for (const lang of languages) {
      await pool.execute(
        `INSERT INTO campaign_languages (
          customer_id, campaign_id, language_constant, code, name, created_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          code=VALUES(code),
          name=VALUES(name)
        `,
        [customerId, campaignId, lang.resource_name, lang.code, lang.name]
      );
    }
  } catch (error) {
    console.error("❌ Error guardando idiomas campaña:", error);
    throw error;
  }
}

/**
 * Obtiene las ubicaciones objetivo configuradas en una campaña de Google Ads.
 *
 * 1. Consulta la tabla `campaign_criterion` para extraer los `geo_target_constant`
 *    asociados a criterios de tipo `LOCATION` con estado `ENABLED` para la campaña indicada.
 * 2. Si no hay ubicaciones configuradas, devuelve un array vacío.
 * 3. Con los `geo_target_constant` obtenidos, consulta la tabla `geo_target_constant`
 *    para recuperar su `name`, `country_code` y `target_type`.
 * 4. Devuelve un array de objetos con los datos completos de cada ubicación.
 */

async function getCampaignLocations(customer, customerId, campaignId) {
  // Paso 1: obtener geo_target_constant IDs
  const criteria = await safeQuery(
    customer,
    `
    SELECT
      campaign_criterion.location.geo_target_constant
    FROM campaign_criterion
    WHERE campaign_criterion.campaign = 'customers/${customerId}/campaigns/${campaignId}'
      AND campaign_criterion.type = 'LOCATION'
      AND campaign_criterion.status = 'ENABLED'
  `,
    {
      retries: 3,
      baseDelay: 500,
      context: {
        name: "getCampaignLocations",
        customer_id: customerId,
        campaign_id: campaignId,
        date: null,
      },
    }
  );

  const geoTargets = criteria
    .map((c) => c.campaign_criterion?.location?.geo_target_constant)
    .filter(Boolean);

  if (!geoTargets.length) return [];

  // Paso 2: obtener nombres de geo targets
  const geoTargetStrings = geoTargets.map((gt) => `'${gt}'`).join(",");

  const locations = await safeQuery(
    customer,
    `
    SELECT
      geo_target_constant.resource_name,
      geo_target_constant.name,
      geo_target_constant.country_code,
      geo_target_constant.target_type
    FROM geo_target_constant
    WHERE geo_target_constant.resource_name IN (${geoTargetStrings})
  `,
    {
      retries: 3,
      baseDelay: 500,
      context: {
        name: "getCampaignLocations_constants",
        customer_id: customerId,
        campaign_id: campaignId,
        date: null,
      },
    }
  );

  return locations.map((loc) => ({
    resource_name: loc.geo_target_constant.resource_name,
    name: loc.geo_target_constant.name,
    country_code: loc.geo_target_constant.country_code,
    target_type: loc.geo_target_constant.target_type,
  }));
}

/**
 * Guarda o actualiza las ubicaciones objetivo de una campaña en la base de datos.
 *
 * Inserta en la tabla `campaign_locations` la información de ubicaciones geográficas
 * asociadas a una campaña de Google Ads. Si la ubicación ya existe (clave duplicada),
 * actualiza los campos de nombre, código de país y tipo de objetivo.
 *
 */

async function saveCampaignLocations(customerId, campaignId, locations) {
  if (!locations.length) return;

  try {
    for (const loc of locations) {
      await pool.execute(
        `INSERT INTO campaign_locations (
          customer_id, campaign_id, geo_target_constant, name, country_code, target_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          name=VALUES(name),
          country_code=VALUES(country_code),
          target_type=VALUES(target_type)
        `,
        [
          customerId,
          campaignId,
          loc.resource_name,
          loc.name,
          loc.country_code,
          loc.target_type,
        ]
      );
    }
  } catch (error) {
    console.error("❌ Error guardando ubicaciones campaña:", error);
    throw error;
  }

  /**
   * Guarda en la base de datos el histórico de métricas diarias de campañas de Google Ads.
   *
   * - Recorre la lista de campañas recibida y extrae datos clave como nombre, estado, tipo,
   *   presupuesto y métricas principales (impresiones, clics, CTR, CPC medio, coste, conversiones, etc.).
   * - Convierte valores `undefined` en `null` y asegura que los datos numéricos sean válidos.
   * - Inserta o actualiza cada registro en la tabla `campaign_metrics_history` usando `ON DUPLICATE KEY UPDATE`.
   * - Almacena también métricas adicionales en formato JSON dentro del campo `extra_metrics`.
   * - Registra en consola el progreso y salta campañas si se detectan parámetros sin valor definido.
   */

  /**
   * Guarda el segmento GEO de una campaña en la base de datos.
   *
   * Inserta en la tabla `campaign_segment_metrics` las métricas asociadas a segmentos
   * como rango de edad, género, dispositivo o región. Cada fila corresponde a un
   * segmento específico con sus datos de rendimiento en una fecha determinada.
   *
   */

  async function saveCampaignSegmentMetrics(
    customerId,
    campaignId,
    date,
    segmentRows
  ) {
    if (!segmentRows.length) return;

    try {
      for (const row of segmentRows) {
        await pool.execute(
          `INSERT INTO campaign_segment_metrics (
          customer_id, campaign_id, date, age_range, gender, device, region_id,
          impressions, clicks, conversions, cost_micros, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            customerId,
            campaignId,
            date,
            row.age_range || null,
            row.gender || null,
            row.device || null,
            row.region_id || null,
            row.impressions || 0,
            row.clicks || 0,
            row.conversions || 0,
            row.cost_micros || 0,
          ]
        );
      }
    } catch (error) {
      console.error("❌ Error guardando segmentos de campaña:", error);
      throw error;
    }
  }
}

/**
 * Guarda en bloque el historial de assets de anuncios en la base de datos.
 *
 * Inserta en la tabla `ad_assets_history` los recursos (assets) asociados a anuncios
 * de Google Ads, registrando la información con fecha de creación y fecha de registro.
 * Se utiliza para almacenar creatividades como textos, imágenes, vídeos u otros
 * elementos de un anuncio, junto con su relación con campañas y grupos de anuncios.
 * NO USADA
 */

async function saveAdAssetsHistoryBulk(customerId, assets) {
  if (!assets.length) return;

  try {
    for (const asset of assets) {
      await pool.execute(
        `INSERT INTO ad_assets_history
    (customer_id, campaign_id, ad_group_id, ad_id, ad_row_id, date, asset_type, asset_value, date_recorded, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          asset.customer_id, // 1
          asset.campaign_id, // 2 - ¡faltaba!
          asset.ad_group_id, // 3
          asset.ad_id, // 4
          asset.ad_row_id, // 5
          asset.date, // 6
          asset.asset_type, // 7
          asset.asset_value, // 8
          asset.date_recorded, // 9
        ]
      );
    }
  } catch (error) {
    console.error("❌ Error guardando assets de anuncio:", error);
    throw error;
  }
}

/**
 * Guarda o actualiza los grupos de anuncios (ad groups) de una campaña en la base de datos.
 *
 * Inserta registros en la tabla `ad_groups` con métricas básicas como impresiones,
 * clics y CTR. Si ya existe un registro con la misma clave única (customer_id, campaign_id,
 * date, ad_group_id), se actualizan los valores existentes.
 * NO USADA
 */

async function saveAdGroups(customerId, adGroups, date) {
  try {
    const sql = `
      INSERT INTO ad_groups
        (customer_id, campaign_id, date, ad_group_id, ad_group_name, status, bid_micros,
         impressions, clicks, ctr, cost_micros, average_cpc_micros, conversions,
         conversions_value, all_conversions, all_conversions_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ad_group_name = VALUES(ad_group_name),
        status = VALUES(status),
        bid_micros = VALUES(bid_micros),
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        ctr = VALUES(ctr),
        cost_micros = VALUES(cost_micros),
        average_cpc_micros = VALUES(average_cpc_micros),
        conversions = VALUES(conversions),
        conversions_value = VALUES(conversions_value),
        all_conversions = VALUES(all_conversions),
        all_conversions_value = VALUES(all_conversions_value)
    `;

    for (const ag of adGroups) {
      await pool.execute(sql, [
        customerId,
        ag.campaign_id ?? null,
        date,
        ag.ad_group_id ?? null,
        ag.ad_group_name ?? null,
        ag.status ?? null,
        ag.bid_micros ?? null,
        Number(ag.impressions) || 0,
        Number(ag.clicks) || 0,
        Number(ag.ctr) || 0,
        Number(ag.cost_micros) || 0,
        Number(ag.average_cpc_micros) || 0,
        Number(ag.conversions) || 0,
        Number(ag.conversions_value) || 0,           // ✅ NUEVO
        Number(ag.all_conversions) || 0,             // ✅ NUEVO
        Number(ag.all_conversions_value) || 0,       // ✅ NUEVO
      ]);
      console.log(`✅ Guardado ad group ${ag.ad_group_id}`);
    }
  } catch (error) {
    console.error("❌ Error guardando grupos de anuncios:", error);
    throw error;
  }
}


/**
 * Inserta o actualiza palabras clave (keywords) en la base de datos para un cliente y fecha específicos.
 *
 * Registra datos de keywords a nivel de campaña y grupo de anuncios, incluyendo métricas
 * de rendimiento (impresiones, clics, CTR, CPC, conversiones) y métricas de calidad
 * (quality_score y subcomponentes). Si la clave primaria ya existe, actualiza los campos
 * con los nuevos valores.
 *
 */

async function saveKeywords(customerId, keywords, date) {
  if (!keywords.length) return;
  try {
    for (const k of keywords) {
      if (k.criterion_id == null) {
        console.warn("❌ Keyword sin criterion_id, omitida:", k);
        continue;
      }

      await pool.execute(
        `INSERT INTO keywords (
          customer_id, campaign_id, ad_group_id, criterion_id, date, 
          keyword_text, match_type, is_negative, status, 
          impressions, clicks, ctr, average_cpc_micros, 
          cost_micros, conversions,
          conversions_value, all_conversions, all_conversions_value,
          quality_score, creative_quality_score, post_click_quality_score, search_predicted_ctr,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          match_type=VALUES(match_type),
          is_negative=VALUES(is_negative),
          status=VALUES(status),
          impressions=VALUES(impressions),
          clicks=VALUES(clicks),
          ctr=VALUES(ctr),
          average_cpc_micros=VALUES(average_cpc_micros),
          cost_micros=VALUES(cost_micros),
          conversions=VALUES(conversions),
          conversions_value=VALUES(conversions_value),
          all_conversions=VALUES(all_conversions),
          all_conversions_value=VALUES(all_conversions_value),
          quality_score=VALUES(quality_score),
          creative_quality_score=VALUES(creative_quality_score),
          post_click_quality_score=VALUES(post_click_quality_score),
          search_predicted_ctr=VALUES(search_predicted_ctr)
        `,
        [
          customerId,
          k.campaign_id,
          k.ad_group_id,
          k.criterion_id,
          date,
          k.keyword_text,
          k.match_type,
          k.is_negative ? 1 : 0,
          k.status,
          k.impressions ?? 0,
          k.clicks ?? 0,
          k.ctr ?? 0,
          k.average_cpc_micros ?? 0,
          k.cost_micros ?? 0,
          k.conversions ?? 0,
          k.conversions_value ?? 0,           // ✅ NUEVO
          k.all_conversions ?? 0,             // ✅ NUEVO
          k.all_conversions_value ?? 0,       // ✅ NUEVO
          k.quality_score ?? null,
          k.creative_quality_score ?? null,
          k.post_click_quality_score ?? null,
          k.search_predicted_ctr ?? null,
        ]
      );
    }
  } catch (err) {
    console.error("❌ Error guardando keywords:", err);
  }
}


/**
 * Inserta o actualiza palabras clave negativas a nivel de campaña en la base de datos.
 *
 * Este método almacena keywords negativas de campaña en la tabla `keywords`,
 * sin asociarlas a un grupo de anuncios (ad_group_id = null), fijando el flag `is_negative` a 1.
 * Se usa para registrar criterios de exclusión aplicados a campañas completas.
 *
 * Si ya existe una entrada con la misma combinación de `customer_id`, `campaign_id`,
 * `ad_group_id`, `criterion_id` y `date`, actualiza los campos en lugar de duplicar el registro.
 */

async function saveNegativeCampaignKeywords(customerId, negatives, date) {
  if (!Array.isArray(negatives) || negatives.length === 0) return;

  const safe = (v, fallback = null) => (v === undefined ? fallback : v);
  const toNum = (v) => (v == null || isNaN(v) ? 0 : Number(v));

  try {
    // Asegúrate de tener este índice único (o uno equivalente)
    // CREATE UNIQUE INDEX uq_kw_neg
    //   ON keywords (customer_id, campaign_id, ad_group_id, criterion_id, date);

    const sql = `
      INSERT INTO keywords (
        customer_id,
        campaign_id,
        ad_group_id,
        criterion_id,
        date,
        keyword_text,
        match_type,
        is_negative,
        status,
        impressions,
        clicks,
        ctr,
        average_cpc_micros,
        cost_micros,
        conversions,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        match_type = VALUES(match_type),
        is_negative = VALUES(is_negative),
        status = VALUES(status),
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        ctr = VALUES(ctr),
        average_cpc_micros = VALUES(average_cpc_micros),
        cost_micros = VALUES(cost_micros),
        conversions = VALUES(conversions)
    `;

    let ok = 0;
    for (const neg of negatives) {
      // Esperamos que 'neg' venga de tu query:
      // campaign_criterion.criterion_id, .keyword.text, .keyword.match_type, .status
      await pool.execute(sql, [
        toNum(customerId),
        toNum(neg.campaign_id),
        null, // ad_group_id a nivel campaña
        toNum(neg.criterion_id), // <-- CLAVE: ahora sí lo insertamos
        safe(neg.date, date),

        safe(neg.keyword_text, ""), // texto de la negativa
        safe(neg.match_type, "EXACT"), // por si acaso
        safe(neg.status, "ENABLED"),

        0, // impressions
        0, // clicks
        0, // ctr
        0, // average_cpc_micros
        0, // cost_micros
        0, // conversions
      ]);
      ok++;
    }

    console.log(`💾 Negativas de campaña guardadas: ${ok}`);
  } catch (err) {
    console.error("❌ Error guardando negativas de campaña:", err);
    throw err;
  }
}

/**
 * Inserta o actualiza anuncios en la base de datos para un cliente, campaña y grupo de anuncios específicos.
 *
 * Procesa y normaliza la información de cada anuncio (titulares, descripciones, extensiones y métricas),
 * convirtiendo listas y elementos multimedia a formato JSON antes de guardarlos en la tabla `ads`.
 * Si el anuncio ya existe para la misma combinación de `customer_id`, `campaign_id`, `date`,
 * `ad_group_id` y `ad_id`, actualiza sus datos y métricas.
 *  NO USADA
 */

async function saveAds(customerId, campaignId, date, adGroupId, ads) {
  try {
    for (const ad of ads) {
      const ad_headline = ad.assets
        ? ad.assets
            .filter((a) => a.asset_type === "HEADLINE")
            .map((a) => a.asset_value)
            .join("\n")
        : ad.ad_headline || null;

      const ad_description = ad.assets
        ? ad.assets
            .filter((a) => a.asset_type === "DESCRIPTION")
            .map((a) => a.asset_value)
            .join("\n")
        : ad.ad_description || null;

      const full_headlines = ad.assets
        ? ad.assets
            .filter((a) => a.asset_type === "HEADLINE")
            .map((a) => a.asset_value)
        : [];

      const full_descriptions = ad.assets
        ? ad.assets
            .filter((a) => a.asset_type === "DESCRIPTION")
            .map((a) => a.asset_value)
        : [];

      const callouts = ad.callouts || [];
      const sitelinks = ad.sitelinks || [];
      const images = ad.images || [];

      const ctrDecimal = ad.ctr && ad.ctr > 1 ? ad.ctr / 100 : ad.ctr || 0;

      // 🔥 URLs
      const finalUrl = ad.final_url || null;
      const finalUrls = JSON.stringify(ad.final_urls || []);
      const finalMobileUrls = JSON.stringify(ad.final_mobile_urls || []);
      const displayUrl = ad.display_url || null;
      const path1 = ad.path1 || null;
      const path2 = ad.path2 || null;

      await pool.execute(
        `INSERT INTO ads 
          (customer_id, campaign_id, date, ad_group_id, ad_id, name, 
           ad_headline, ad_description, ad_type, status, 
           impressions, clicks, ctr, average_cpc_micros, cost_micros, conversions,
           conversions_value, all_conversions, all_conversions_value,
           final_url, final_urls, final_mobile_urls, display_url, path1, path2,
           callouts, sitelinks, images, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           ad_headline=VALUES(ad_headline),
           ad_description=VALUES(ad_description),
           ad_type=VALUES(ad_type),
           status=VALUES(status),
           impressions=VALUES(impressions),
           clicks=VALUES(clicks),
           ctr=VALUES(ctr),
           average_cpc_micros=VALUES(average_cpc_micros),
           cost_micros=VALUES(cost_micros),
           conversions=VALUES(conversions),
           conversions_value=VALUES(conversions_value),
           all_conversions=VALUES(all_conversions),
           all_conversions_value=VALUES(all_conversions_value),
           final_url=VALUES(final_url),
           final_urls=VALUES(final_urls),
           final_mobile_urls=VALUES(final_mobile_urls),
           display_url=VALUES(display_url),
           path1=VALUES(path1),
           path2=VALUES(path2),
           callouts=VALUES(callouts),
           sitelinks=VALUES(sitelinks),
           images=VALUES(images),
           created_at=NOW()
        `,
        [
          customerId,
          campaignId,
          date,
          adGroupId,
          ad.ad_id,
          ad.name,
          JSON.stringify(full_headlines),
          JSON.stringify(full_descriptions),
          ad.ad_type || null,
          ad.status || null,
          ad.impressions || 0,
          ad.clicks || 0,
          ctrDecimal,
          Math.round((ad.average_cpc || 0) * 1e6),
          ad.cost_micros || 0,
          ad.conversions || 0,
          ad.conversions_value || 0,           // ✅ NUEVO
          ad.all_conversions || 0,             // ✅ NUEVO
          ad.all_conversions_value || 0,       // ✅ NUEVO
          finalUrl,
          finalUrls,
          finalMobileUrls,
          displayUrl,
          path1,
          path2,
          JSON.stringify(callouts),
          JSON.stringify(sitelinks),
          JSON.stringify(images),
        ]
      );
      console.log(`✅ Guardado ad ${ad.ad_id}`);
    }
  } catch (error) {
    console.error("❌ Error guardando anuncios:", error);
    throw error;
  }
}


/**
 * Guarda o actualiza términos de búsqueda (search terms) en la base de datos.
 *
 * Inserta en la tabla `search_terms` los términos asociados a campañas y grupos de anuncios
 * junto con sus métricas. Si el registro ya existe (basado en clave única),
 * actualiza las métricas en lugar de crear un nuevo registro.
 *
 */
// Función para obtener las fechas de la última semana (excluyendo hoy)
function getLastWeekDates() {
  const dates = [];
  const today = new Date();

  // Empezamos desde ayer (hoy - 1) y vamos hacia atrás 7 días
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(date.toISOString().split("T")[0]); // formato YYYY-MM-DD
  }

  return dates.reverse(); // del más antiguo al más reciente
}

// Función para obtener search terms de Google Ads
async function fetchSearchTerms(
  customer,
  customerId,
  campaignId,
  adGroupId,
  date
) {
  console.log(
    `🔍 [searchTerms] campaign=${campaignId}, adGroup=${adGroupId}, date=${date}`
  );

  // ✅ MEJORA 1: LIMIT obligatorio para evitar explosión de datos
  const query = `
    SELECT
      campaign.id,
      ad_group.id,
      search_term_view.search_term,
      search_term_view.status,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions
    FROM search_term_view
    WHERE campaign.id = ${campaignId}
      AND ad_group.id = ${adGroupId}
      AND segments.date = '${date}'
      AND metrics.impressions > 0
    ORDER BY metrics.impressions DESC
    LIMIT 1000
  `;

  let results = [];

  try {
    // ✅ MEJORA 2: Timeout específico (60 segundos)
    results = await safeQuery(customer, query, {
      retries: 2, // ⬇️ Reducir reintentos
      baseDelay: 1000,
      timeout: 60000, // ✅ Timeout de 60s
      context: {
        name: "fetchSearchTerms",
        campaign_id: campaignId,
        ad_group_id: adGroupId,
        date: date,
      },
    });

    console.log(`✅ [searchTerms] encontrados: ${results.length}`);
  } catch (error) {
    console.error(
      `❌ [searchTerms] Error para campaign=${campaignId} adGroup=${adGroupId}:`,
      error.message
    );

    // ✅ MEJORA 3: Si falla, devolver array vacío en lugar de lanzar error
    return [];
  }

  // ✅ MEJORA 4: Validar datos antes de mapear
  const validResults = results.filter((row) => {
    const term = row.search_term_view?.search_term;
    return term && typeof term === "string" && term.trim().length > 0;
  });

  if (validResults.length < results.length) {
    console.warn(
      `⚠️ [searchTerms] ${
        results.length - validResults.length
      } términos inválidos omitidos`
    );
  }

  return validResults.map((row) => ({
    campaign_id: campaignId,
    ad_group_id: adGroupId,
    search_term: row.search_term_view?.search_term || "",
    keyword_text: "", // ⚠️ Este campo no está en search_term_view
    match_type: "UNKNOWN", // ⚠️ Este campo no está en search_term_view
    impressions: parseInt(row.metrics?.impressions) || 0,
    clicks: parseInt(row.metrics?.clicks) || 0,
    ctr: parseFloat(row.metrics?.ctr) || 0,
    average_cpc: parseFloat(row.metrics?.average_cpc) || 0,
    cost_micros: parseInt(row.metrics?.cost_micros) || 0,
    conversions: parseFloat(row.metrics?.conversions) || 0,
  }));
}

/**
 * Obtiene campañas y ad groups con safeQuery
 */
async function getCampaignsAndAdGroups(customer, customerId) {
  const query = `
    SELECT
      campaign.id,
      ad_group.id
    FROM ad_group
    WHERE campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
  `;

  const results = await safeQuery(customer, query, {
    retries: 3,
    baseDelay: 500,
    context: {
      name: "getCampaignsAndAdGroups",
      customer_id: customerId,
    },
  });

  return results.map((row) => ({
    campaignId: row.campaign?.id,
    adGroupId: row.ad_group?.id,
  }));
}
// Función para guardar search terms en BD
async function saveSearchTerms(customerId, searchTerms, date) {
  if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) {
    console.log("ℹ️ No hay search terms para guardar");
    return;
  }

  console.log(`💾 Guardando ${searchTerms.length} search terms para ${date}`);

  try {
    const sql = `
      INSERT INTO search_terms (
        customer_id, campaign_id, ad_group_id, search_term, keyword_text, match_type,
        impressions, clicks, ctr, average_cpc_micros, cost_micros, conversions, date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        impressions=VALUES(impressions),
        clicks=VALUES(clicks),
        ctr=VALUES(ctr),
        average_cpc_micros=VALUES(average_cpc_micros),
        cost_micros=VALUES(cost_micros),
        conversions=VALUES(conversions)
    `;

    // ✅ MEJORA: Guardar en batch para mejor performance
    const BATCH_SIZE = 100;
    let saved = 0;

    for (let i = 0; i < searchTerms.length; i += BATCH_SIZE) {
      const batch = searchTerms.slice(i, i + BATCH_SIZE);

      for (const term of batch) {
        try {
          await pool.execute(sql, [
            customerId,
            term.campaign_id,
            term.ad_group_id,
            term.search_term,
            term.keyword_text,
            term.match_type,
            term.impressions || 0,
            term.clicks || 0,
            term.ctr || 0,
            Math.round((term.average_cpc || 0) * 1e6),
            term.cost_micros || 0,
            term.conversions || 0,
            date,
          ]);
          saved++;
        } catch (termError) {
          // ✅ Log individual pero no lanzar error
          console.error(
            `⚠️ Error guardando término "${term.search_term}":`,
            termError.message
          );
        }
      }

      // ✅ Pequeña pausa entre batches
      if (i + BATCH_SIZE < searchTerms.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      `✅ Search terms guardados: ${saved}/${searchTerms.length} para ${date}`
    );
  } catch (error) {
    console.error("❌ Error guardando search terms:", error);
    // ✅ No lanzar error para no interrumpir el proceso completo
  }
}

// Función para obtener la fecha de ayer en formato YYYY-MM-DD
function getYesterday() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

async function saveCampaignMetricsHistory(customerId, campaigns, date) {
  try {
    for (const campaign of campaigns) {
      const {
        id: campaign_id,
        name: campaign_name,
        status: campaign_status,
        type: campaign_type,
        budget_micros,
        metrics = {},
      } = campaign;

      // ✅ Función helper para convertir undefined a null
      const toNullIfUndefined = (value) => (value === undefined ? null : value);
      const toNumberOrNull = (value) => {
        if (value === undefined || value === null || isNaN(value)) return null;
        return Number(value);
      };

      const budget_micros_value = toNumberOrNull(budget_micros) || 0;
      const average_cpc_micros = toNumberOrNull(metrics.average_cpc) || 0;
      const cost_per_conversion_micros =
        toNumberOrNull(metrics.cost_per_conversion) || 0;

      console.log(
        `Guardando campaña: ID=${campaign_id}, Nombre="${campaign_name}", Fecha=${date}`
      );

      // ✅ AÑADE LOS 2 CAMPOS NUEVOS AL ARRAY DE PARÁMETROS
      const params = [
        customerId, // customer_id
        campaign_id, // campaign_id
        toNullIfUndefined(campaign_name), // campaign_name
        toNumberOrNull(campaign_status) || 0, // campaign_status
        toNumberOrNull(campaign_type) || 0, // campaign_type
        budget_micros_value, // budget_micros
        date, // date
        toNumberOrNull(metrics.impressions) || 0, // impressions
        toNumberOrNull(metrics.clicks) || 0, // clicks
        toNumberOrNull(metrics.ctr) || 0, // ctr
        average_cpc_micros, // average_cpc_micros
        toNumberOrNull(metrics.cost_micros) || 0, // cost_micros
        toNumberOrNull(metrics.conversions) || 0, // conversions
        toNumberOrNull(metrics.conversions_value) || 0, // ✅ NUEVO: conversions_value
        toNumberOrNull(metrics.conv_rate) || 0, // conversion_rate
        cost_per_conversion_micros, // cost_per_conversion_micros
        toNumberOrNull(metrics.all_conversions) || 0, // all_conversions
        toNumberOrNull(metrics.all_conversions_value) || 0, // ✅ NUEVO: all_conversions_value
        toNumberOrNull(metrics.value_per_all_conversions) || 0, // value_per_all_conversions
        toNumberOrNull(metrics.search_impression_share) || 0, // search_impression_share
        toNumberOrNull(metrics.search_rank_lost_impression_share) || 0, // search_rank_lost_impression_share
        toNumberOrNull(metrics.search_budget_lost_impression_share) || 0, // search_budget_lost_impression_share
        JSON.stringify(metrics.extra || {}), // extra_metrics
      ];

      // Debug
      console.log(
        "📋 Parámetros para insertar:",
        params.map((p, i) => `${i}: ${p === null ? "NULL" : typeof p} = ${p}`)
      );

      const hasUndefined = params.some((param) => param === undefined);
      if (hasUndefined) {
        console.error("❌ Se encontraron parámetros undefined:", params);
        continue;
      }

      // ✅ AÑADE LOS 2 CAMPOS NUEVOS AL INSERT Y UPDATE
      await pool.execute(
        `INSERT INTO campaign_metrics_history
          (customer_id, campaign_id, campaign_name, campaign_status, campaign_type, budget_micros,
           date, impressions, clicks, ctr, average_cpc_micros, cost_micros, conversions,
           conversions_value, conversion_rate, cost_per_conversion_micros, all_conversions,
           all_conversions_value, value_per_all_conversions,
           search_impression_share, search_rank_lost_impression_share, search_budget_lost_impression_share,
           extra_metrics, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           campaign_name = VALUES(campaign_name),
           campaign_status = VALUES(campaign_status),
           campaign_type = VALUES(campaign_type),
           budget_micros = VALUES(budget_micros),
           impressions = VALUES(impressions),
           clicks = VALUES(clicks),
           ctr = VALUES(ctr),
           average_cpc_micros = VALUES(average_cpc_micros),
           cost_micros = VALUES(cost_micros),
           conversions = VALUES(conversions),
           conversions_value = VALUES(conversions_value),
           conversion_rate = VALUES(conversion_rate),
           cost_per_conversion_micros = VALUES(cost_per_conversion_micros),
           all_conversions = VALUES(all_conversions),
           all_conversions_value = VALUES(all_conversions_value),
           value_per_all_conversions = VALUES(value_per_all_conversions),
           search_impression_share = VALUES(search_impression_share),
           search_rank_lost_impression_share = VALUES(search_rank_lost_impression_share),
           search_budget_lost_impression_share = VALUES(search_budget_lost_impression_share),
           extra_metrics = VALUES(extra_metrics),
           updated_at = NOW()
        `,
        params
      );

      console.log(
        `✅ Campaña ID=${campaign_id} guardada/actualizada correctamente.`
      );
    }
  } catch (error) {
    console.error("❌ Error guardando métricas campaña:", error);
    throw error;
  }
}

// ✅ VERSIÓN MEJORADA - NO LANZA ERRORES, DEVUELVE ARRAY VACÍO

async function safeQuery(customerObj, query, opts = {}) {
  const retries = opts.retries ?? 1;
  const baseDelay = opts.baseDelay ?? 300;
  const throwOnError = opts.throwOnError ?? false;
  const context = opts.context || {};
  const timeoutMs = opts.timeout || 10000;
  const contextName = context.name || "unknown_query";

  if (!customerObj || typeof customerObj.query !== "function") {
    const info = customerObj
      ? customerObj.customer_id || customerObj.customerId || "unknown"
      : "no-customer";
    const validationError = new Error(
      `Cliente inválido o sin método query (${info})`
    );
    logQueryError(context, query, validationError, customerObj);
    if (throwOnError) throw validationError;
    return [];
  }

  let attempt = 0;
  let lastError = null;

  while (attempt < retries) {
    try {
      attempt++;
      const clientInfo =
        customerObj.customer_id ?? customerObj.customerId ?? "unknown";

      if (attempt === 1) {
        console.log(
          `🔎 [${contextName}] customer=${clientInfo} date=${
            context.date || "N/A"
          }`
        );
      }

      const res = await Promise.race([
        customerObj.query(query),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Query timeout")), timeoutMs)
        ),
      ]);

      return Array.isArray(res) ? res : [];
    } catch (err) {
      lastError = err;

      const msg = safeStringify(err);
      const code = err?.code;
      const errorType = classifyError(err, msg, code);

      // ✅ RATE LIMIT LOG
      if (code === "RESOURCE_EXHAUSTED" || msg.includes("RATE_EXCEEDED")) {
        console.error(`🚦 RATE LIMIT detectado en Google Ads`, {
          context: contextName,
          customer: customerObj.customer_id,
          message: err.message,
          time: new Date().toISOString(),
        });
      }

      console.warn(
        `⚠️ [${contextName}] Error (${errorType}) intento ${attempt}/${retries}: ${msg.substring(
          0,
          100
        )}`
      );

      if (attempt >= retries) logQueryError(context, query, err, customerObj);
      if (errorType === "NON_RETRYABLE") break;
      if (attempt >= retries) break;

      const wait = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  if (throwOnError) throw lastError || new Error("Query falló tras reintentos");
  return [];
}

// ✅ FUNCIÓN AUXILIAR PARA CLASIFICAR ERRORES
function classifyError(err, msg, code) {
  // Errores que NO vale la pena reintentar
  const nonRetryablePatterns = [
    "Parser cannot parse",
    "expected a value",
    "PERMISSION_DENIED",
    "NOT_FOUND",
    "INVALID_ARGUMENT",
    "INVALID_CUSTOMER_ID",
    "CUSTOMER_NOT_FOUND",
    "AUTHENTICATION_ERROR",
  ];

  if (
    nonRetryablePatterns.some(
      (pattern) => msg.includes(pattern) || code === pattern
    )
  ) {
    return "NON_RETRYABLE";
  }

  // Errores que SÍ vale la pena reintentar
  const retryablePatterns = [
    "UNKNOWN",
    "RESOURCE_EXHAUSTED",
    "DEADLINE_EXCEEDED",
    "UNAVAILABLE",
    "timeout",
    "ETIMEDOUT",
    "ECONNRESET",
    "ENOTFOUND",
    "ENETUNREACH",
    "429",
    /5\d{2}/, // 500, 502, 503, etc.
    "transient internal error",
    "Retry the request",
  ];

  if (
    retryablePatterns.some((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern.test(msg) || pattern.test(code);
      }
      return msg.includes(pattern) || code === pattern;
    })
  ) {
    return "RETRYABLE";
  }

  return "UNKNOWN";
}

// ✅ HELPER PARA STRINGIFY SEGURO (si no la tienes)
function safeStringify(err) {
  if (!err) return "Error desconocido";
  if (typeof err === "string") return err;
  if (err.message) return err.message;

  try {
    return JSON.stringify(err, Object.getOwnPropertyNames(err));
  } catch (e) {
    return String(err);
  }
}

// ============================================
// FUNCIÓN GLOBAL: processSingleDay
// ============================================

global.processSingleDay = processSingleDay;

async function processSingleDay(customer, customerId, dateStr, endDateParam) {
  // 🔥 ==================== DEBUG: INICIO ====================
  const dayStartTime = Date.now();
  const durations = {}; // Para tracking de tiempos
  console.log(
    `\n⏱️  [${customerId}] 📅 INICIO DÍA: ${dateStr} (timestamp: ${new Date().toISOString()})`
  );
  // 🔥 ======================================================

  // ----------------- helpers internos -----------------
  function safeStringify(err) {
    try {
      return err && err.message
        ? err.message
        : JSON.stringify(err, Object.getOwnPropertyNames(err));
    } catch (e) {
      return String(err);
    }
  }

  function getIdFromResource(resourceName) {
    if (!resourceName || typeof resourceName !== "string") return null;
    const parts = resourceName.split("/");
    return parts.length ? parts[parts.length - 1] : null;
  }

  // ----------------- inicio function -----------------
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📅 PROCESANDO DÍA: ${dateStr} - Customer: ${customerId}`);
  console.log("=".repeat(80));

  // 🔥 Normalizar endDate
  let endDateStr;
  if (typeof endDateParam === "string") {
    endDateStr = endDateParam;
  } else if (endDateParam instanceof Date) {
    endDateStr = endDateParam.toISOString().split("T")[0];
  } else {
    endDateStr = dateStr;
  }

  // Validación básica del cliente
  if (!customer) {
    console.error(`❌ Cliente Google Ads inválido para ${customerId}`);
    return [];
  }

  // Contadores globales del día
  let totalCampaigns = 0;
  let totalAdGroups = 0;
  let totalAds = 0;
  let totalKeywords = 0;
  let totalSearchTerms = 0;
  let totalAudienceSegments = 0;
  let totalPMaxCampaigns = 0;
  let totalAssetGroups = 0;
  let totalAssets = 0;

  // 🔥 ==================== DEBUG: Envolver TODO en try/catch ====================
  try {
    // === CAMPAÑAS TRADICIONALES (SOLO ENABLED) ===
    // 🔥 DEBUG: Timestamp inicio campaigns
    let opStart = Date.now();
    console.log(`\n📊 PASO 1: Obteniendo campañas ACTIVAS (tradicionales)...`);
    console.log(`   ⏱️  Inicio: ${new Date().toISOString()}`);

    let campaignsRaw = [];
    try {
      const q = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    campaign.bidding_strategy_type,
    campaign.campaign_budget,
    metrics.impressions,
    metrics.clicks,
    metrics.ctr,
    metrics.average_cpc,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,                      // ✅ NUEVO - Valor total conversiones primarias
    metrics.conversions_from_interactions_rate,
    metrics.cost_per_conversion,
    metrics.all_conversions,
    metrics.all_conversions_value,                  // ✅ NUEVO - Valor total TODAS las conversiones
    metrics.value_per_all_conversions,
    metrics.search_impression_share,
    metrics.search_rank_lost_impression_share,
    metrics.search_budget_lost_impression_share
  FROM campaign
  WHERE campaign.status = 'ENABLED'
    AND campaign.experiment_type = 'BASE'
    AND campaign.serving_status IN ('SERVING', 'NONE')
    AND campaign.advertising_channel_type != 'PERFORMANCE_MAX'
    AND segments.date = '${dateStr}'
  LIMIT 200
`;

      campaignsRaw = await safeQuery(customer, q, {
        retries: 4,
        baseDelay: 600,
      });
    } catch (queryError) {
      console.error(
        `  ❌ Error en query de campañas:`,
        safeStringify(queryError)
      );
      campaignsRaw = [];
    }

    // 🔥 DEBUG: Tiempo de campaigns
    durations.campaigns_query = Date.now() - opStart;
    console.log(
      `   ✅ Campaigns query completado en ${(
        durations.campaigns_query / 1000
      ).toFixed(1)}s`
    );
    if (durations.campaigns_query > 60000) {
      console.warn(
        `   ⚠️  LENTO: campaigns query tardó ${(
          durations.campaigns_query / 1000
        ).toFixed(1)}s`
      );
    }

    if (!Array.isArray(campaignsRaw) || campaignsRaw.length === 0) {
      console.log(`  ⚠️ No hay campañas tradicionales para ${dateStr}`);
    } else {
      console.log(
        `  ✅ ${campaignsRaw.length} campañas tradicionales encontradas`
      );
      totalCampaigns = campaignsRaw.length;
    }

    // Consultar presupuestos
    // 🔥 DEBUG: Timestamp budgets
    opStart = Date.now();
    const budgetIdSet = new Set();
    for (const c of campaignsRaw) {
      const resourceName = c?.campaign?.campaign_budget;
      const budgetId = getIdFromResource(resourceName);
      if (budgetId) budgetIdSet.add(budgetId);
    }
    const budgetIds = Array.from(budgetIdSet);

    let budgetMap = new Map();
    if (budgetIds.length) {
      try {
        const budgetIdsString = budgetIds.map((id) => `'${id}'`).join(",");
        const budgetRows = await safeQuery(
          customer,
          `
        SELECT campaign_budget.id, campaign_budget.amount_micros
        FROM campaign_budget
        WHERE campaign_budget.id IN (${budgetIdsString})
      `,
          { retries: 3, baseDelay: 500 }
        );

        if (Array.isArray(budgetRows)) {
          budgetMap = new Map(
            budgetRows.map((row) => [
              String(row?.campaign_budget?.id),
              row?.campaign_budget?.amount_micros || 0,
            ])
          );
        } else {
          console.warn(
            `  ⚠️ Response unexpected for budgetRows: ${JSON.stringify(
              budgetRows
            ).slice(0, 500)}`
          );
        }
      } catch (budgetError) {
        console.warn(
          `  ⚠️ Error obteniendo presupuestos:`,
          safeStringify(budgetError)
        );
      }
    }

    // 🔥 DEBUG: Tiempo de budgets
    durations.budgets_query = Date.now() - opStart;
    console.log(
      `   ✅ Budgets query completado en ${(
        durations.budgets_query / 1000
      ).toFixed(1)}s`
    );

    // Construir campañas tradicionales
    const campaigns = [];

    for (const c of campaignsRaw) {
      try {
        const budgetId = getIdFromResource(c?.campaign?.campaign_budget);
        const campaign = {
          id: c?.campaign?.id,
          name: c?.campaign?.name || `Campaign ${c?.campaign?.id}`,
          status: c?.campaign?.status,
          type: c?.campaign?.advertising_channel_type,
          bidding_strategy: c?.campaign?.bidding_strategy_type || null,
          budget_micros: (budgetId && budgetMap.get(budgetId)) || 0,
          metrics: {
            impressions: c?.metrics?.impressions || 0,
            clicks: c?.metrics?.clicks || 0,
            ctr: c?.metrics?.ctr || 0,
            average_cpc: c?.metrics?.average_cpc || 0,
            cost_micros: c?.metrics?.cost_micros || 0,
            conversions: c?.metrics?.conversions || 0,
            conversions_value: c?.metrics?.conversions_value || 0, // ✅ NUEVO
            conv_rate: c?.metrics?.conversions_from_interactions_rate || 0,
            cost_per_conversion: c?.metrics?.cost_per_conversion || 0,
            all_conversions: c?.metrics?.all_conversions || 0,
            all_conversions_value: c?.metrics?.all_conversions_value || 0, // ✅ NUEVO
            value_per_all_conversions:
              c?.metrics?.value_per_all_conversions || 0,
            search_impression_share: c?.metrics?.search_impression_share || 0,
            search_rank_lost_impression_share:
              c?.metrics?.search_rank_lost_impression_share || 0,
            search_budget_lost_impression_share:
              c?.metrics?.search_budget_lost_impression_share || 0,
            extra: {},
          },
          ad_groups: [],
          negative_keywords_campaign_level: [],
          locations: [],
          languages: [],
        };

        // Ubicaciones y idiomas (solo último día)
        if (dateStr === endDateStr) {
          try {
            campaign.locations = await getCampaignLocations(
              customer,
              customerId,
              c?.campaign?.id
            );
            await saveCampaignLocations(
              customerId,
              campaign.id,
              campaign.locations || []
            );
          } catch (error) {
            console.warn(
              `⚠️ Ubicaciones campaña ${c?.campaign?.id}:`,
              safeStringify(error)
            );
            campaign.locations = [];
          }

          try {
            campaign.languages = await getCampaignLanguages(
              customer,
              customerId,
              c?.campaign?.id
            );
            await saveCampaignLanguages(
              customerId,
              campaign.id,
              campaign.languages || []
            );
          } catch (error) {
            console.warn(
              `⚠️ Idiomas campaña ${c?.campaign?.id}:`,
              safeStringify(error)
            );
            campaign.languages = [];
          }
        }

        campaigns.push(campaign);
      } catch (campaignError) {
        console.error(
          `  ❌ Error procesando campaña ${c?.campaign?.id}:`,
          safeStringify(campaignError)
        );
        continue;
      }
    }

    // Guardar métricas de campañas tradicionales
    if (campaigns.length > 0) {
      try {
        await saveCampaignMetricsHistory(customerId, campaigns, dateStr);
        console.log(`  💾 Métricas de campañas tradicionales guardadas`);
      } catch (saveError) {
        console.error(
          `  ❌ Error guardando métricas:`,
          safeStringify(saveError)
        );
      }
    }

    // === 🔥 PERFORMANCE MAX ===
    opStart = Date.now();
    console.log(`\n🚀 PASO 1B: Procesando campañas Performance Max...`);
    console.log(`   ⏱️  Inicio: ${new Date().toISOString()}`);

    try {
      const pmaxResult = await processPMaxCampaigns(
        customer,
        customerId,
        dateStr
      );

      totalPMaxCampaigns = pmaxResult.campaignsCount;
      totalAssetGroups = pmaxResult.assetGroupsCount;
      totalAssets = pmaxResult.assetsCount;

      durations.pmax_total = Date.now() - opStart;
      console.log(
        `   ✅ PMax completado en ${(durations.pmax_total / 1000).toFixed(1)}s`
      );
      console.log(`      • Campañas: ${totalPMaxCampaigns}`);
      console.log(`      • Asset Groups: ${totalAssetGroups}`);
      console.log(`      • Assets: ${totalAssets}`);

      if (durations.pmax_total > 60000) {
        console.warn(
          `   ⚠️  LENTO: PMax tardó ${(durations.pmax_total / 1000).toFixed(
            1
          )}s`
        );
      }
    } catch (pmaxError) {
      durations.pmax_total = Date.now() - opStart;
      console.error(
        `  ❌ Error procesando Performance Max después de ${(
          durations.pmax_total / 1000
        ).toFixed(1)}s:`,
        safeStringify(pmaxError)
      );
    }

    // === PROCESAMIENTO POR CAMPAÑA TRADICIONAL ===
    // 🔥 DEBUG: Timestamp ad groups
    opStart = Date.now();
    console.log(
      `\n📊 PASO 2: Procesando Ad Groups, Ads, Keywords, Search Terms y Audiences...`
    );
    console.log(`   ⏱️  Inicio: ${new Date().toISOString()}`);

    let totalAdGroupsTime = 0;
    let totalAdsTime = 0;
    let totalKeywordsTime = 0;
    let totalSearchTermsTime = 0;
    let totalAudienceTime = 0;

    for (let campIndex = 0; campIndex < campaigns.length; campIndex++) {
      const campaign = campaigns[campIndex];
      const campaignResource = `customers/${customerId}/campaigns/${campaign.id}`;

      console.log(
        `\n  🎯 [${campIndex + 1}/${campaigns.length}] Campaña: ${
          campaign.name
        } (${campaign.id})`
      );

      // === AD GROUPS ===
      const agStart = Date.now();
      let adGroupsResult = [];
      try {
        adGroupsResult = await safeQuery(
          customer,
          `
  SELECT
    ad_group.id,
    ad_group.name,
    ad_group.status,
    ad_group.cpc_bid_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.ctr,
    metrics.average_cpc,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,        // ✅ AÑADIR
    metrics.all_conversions,          // ✅ AÑADIR
    metrics.all_conversions_value     // ✅ AÑADIR
  FROM ad_group
  WHERE ad_group.campaign = '${campaignResource}'
    AND ad_group.status = 'ENABLED'
    AND segments.date = '${dateStr}'
  `,
          { retries: 3, baseDelay: 400 }
        );
      } catch (agErr) {
        console.error(
          `     ❌ Error obteniendo ad groups para campaign ${campaign.id}:`,
          safeStringify(agErr)
        );
        adGroupsResult = [];
      }

      const agDuration = Date.now() - agStart;
      totalAdGroupsTime += agDuration;
      console.log(
        `     📁 Ad Groups encontrados: ${
          Array.isArray(adGroupsResult) ? adGroupsResult.length : 0
        } (${(agDuration / 1000).toFixed(1)}s)`
      );
      totalAdGroups += Array.isArray(adGroupsResult)
        ? adGroupsResult.length
        : 0;

      for (const ag of adGroupsResult || []) {
        const adGroup = {
          customer_id: customerId,
          campaign_id: campaign.id,
          date: dateStr,
          ad_group_id: ag?.ad_group?.id,
          ad_group_name: ag?.ad_group?.name ?? null,
          status: ag?.ad_group?.status ?? null,
          bid_micros: ag?.ad_group?.cpc_bid_micros ?? null,
          impressions: ag?.metrics?.impressions || 0,
          clicks: ag?.metrics?.clicks || 0,
          ctr: ag?.metrics?.ctr || 0,
          cost_micros: ag?.metrics?.cost_micros || 0,
          average_cpc_micros: ag?.metrics?.average_cpc || 0,
          conversions: ag?.metrics?.conversions || 0,
          conversions_value: ag?.metrics?.conversions_value || 0, // ✅ AÑADIR
          all_conversions: ag?.metrics?.all_conversions || 0, // ✅ AÑADIR
          all_conversions_value: ag?.metrics?.all_conversions_value || 0, // ✅ AÑADIR
        };

        // Guardar ad group
        try {
          await saveAdGroups(customerId, [adGroup], dateStr);
        } catch (e) {
          console.error(
            `     ❌ Error guardando ad group ${adGroup.ad_group_id}:`,
            safeStringify(e)
          );
        }

        const adGroupResource = `customers/${customerId}/adGroups/${ag?.ad_group?.id}`;

        // === ANUNCIOS ===
        const adsStart = Date.now();
        try {
          const adsResult = await safeQuery(
            customer,
            `
  SELECT
    ad_group_ad.ad.id,
    ad_group_ad.ad.name,
    ad_group_ad.ad.type,
    ad_group_ad.status,
    ad_group_ad.ad.responsive_search_ad.headlines,
    ad_group_ad.ad.responsive_search_ad.descriptions,
    ad_group_ad.ad.responsive_search_ad.path1,
    ad_group_ad.ad.responsive_search_ad.path2,
    ad_group_ad.ad.final_urls,
    ad_group_ad.ad.final_mobile_urls,
    ad_group_ad.ad.display_url,
    metrics.impressions,
    metrics.clicks,
    metrics.ctr,
    metrics.average_cpc,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,        // ✅ AÑADIR
    metrics.all_conversions,          // ✅ AÑADIR
    metrics.all_conversions_value     // ✅ AÑADIR
  FROM ad_group_ad
  WHERE ad_group_ad.ad_group = '${adGroupResource}'
    AND ad_group_ad.status = 'ENABLED'
    AND segments.date = '${dateStr}'
  `,
            { retries: 3, baseDelay: 400 }
          );

          const adsToSave = [];
          for (const row of adsResult || []) {
            const hl = (
              row?.ad_group_ad?.ad?.responsive_search_ad?.headlines || []
            )
              .map((h) => h?.text)
              .filter(Boolean);
            const desc = (
              row?.ad_group_ad?.ad?.responsive_search_ad?.descriptions || []
            )
              .map((d) => d?.text)
              .filter(Boolean);
            const finalUrls = row?.ad_group_ad?.ad?.final_urls || [];
            const finalMobileUrls =
              row?.ad_group_ad?.ad?.final_mobile_urls || [];
            const displayUrl = row?.ad_group_ad?.ad?.display_url || null;
            const path1 =
              row?.ad_group_ad?.ad?.responsive_search_ad?.path1 || null;
            const path2 =
              row?.ad_group_ad?.ad?.responsive_search_ad?.path2 || null;

            adsToSave.push({
              ad_id: row?.ad_group_ad?.ad?.id,
              name: row?.ad_group_ad?.ad?.name ?? null,
              ad_type: row?.ad_group_ad?.ad?.type ?? null,
              status: row?.ad_group_ad?.status ?? null,
              impressions: row?.metrics?.impressions || 0,
              clicks: row?.metrics?.clicks || 0,
              ctr: row?.metrics?.ctr || 0,
              average_cpc: (row?.metrics?.average_cpc || 0) / 1e6,
              cost_micros: row?.metrics?.cost_micros || 0,
              conversions: row?.metrics?.conversions || 0,
              conversions_value: row?.metrics?.conversions_value || 0, // ✅ AÑADIR
              all_conversions: row?.metrics?.all_conversions || 0, // ✅ AÑADIR
              all_conversions_value: row?.metrics?.all_conversions_value || 0, // ✅ AÑADIR
              final_url: finalUrls.length > 0 ? finalUrls[0] : null,
              final_urls: finalUrls,
              final_mobile_urls: finalMobileUrls,
              display_url: displayUrl,
              path1,
              path2,
              assets: [
                ...hl.map((v) => ({ asset_type: "HEADLINE", asset_value: v })),
                ...desc.map((v) => ({
                  asset_type: "DESCRIPTION",
                  asset_value: v,
                })),
              ],
              callouts: [],
              sitelinks: [],
              images: [],
            });
          }

          if (adsToSave.length) {
            await saveAds(
              customerId,
              campaign.id,
              dateStr,
              ag?.ad_group?.id,
              adsToSave
            );
            totalAds += adsToSave.length;
          }

          const adsDuration = Date.now() - adsStart;
          totalAdsTime += adsDuration;
          console.log(
            `     📝 Ads: ${adsToSave.length} (${(adsDuration / 1000).toFixed(
              1
            )}s)`
          );
        } catch (adsError) {
          console.error(
            `     ❌ Error procesando ads:`,
            safeStringify(adsError)
          );
        }

        // === KEYWORDS ===
        const keywordsStart = Date.now();
        try {
          const keywordResult = await safeQuery(
            customer,
            `
  SELECT
    ad_group_criterion.criterion_id,
    ad_group_criterion.keyword.text,
    ad_group_criterion.keyword.match_type,
    ad_group_criterion.status,
    ad_group_criterion.negative,
    ad_group_criterion.quality_info.quality_score,
    ad_group_criterion.quality_info.creative_quality_score,
    ad_group_criterion.quality_info.post_click_quality_score,
    ad_group_criterion.quality_info.search_predicted_ctr,
    metrics.impressions,
    metrics.clicks,
    metrics.ctr,
    metrics.average_cpc,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,        // ✅ AÑADIR
    metrics.all_conversions,          // ✅ AÑADIR
    metrics.all_conversions_value     // ✅ AÑADIR
  FROM keyword_view
  WHERE campaign.id = ${campaign.id}
    AND ad_group.id = ${ag?.ad_group?.id}
    AND campaign.status = 'ENABLED'
    AND ad_group_criterion.status = 'ENABLED'
    AND ad_group_criterion.negative = FALSE
    AND segments.date = '${dateStr}'
  `,
            { retries: 3, baseDelay: 400 }
          );

          const keywordsToSave = (keywordResult || []).map((k) => ({
            customer_id: customerId,
            campaign_id: campaign.id,
            ad_group_id: ag?.ad_group?.id,
            date: dateStr,
            criterion_id: k?.ad_group_criterion?.criterion_id,
            keyword_text: k?.ad_group_criterion?.keyword?.text,
            match_type: k?.ad_group_criterion?.keyword?.match_type,
            is_negative: false,
            status: k?.ad_group_criterion?.status,
            impressions: k?.metrics?.impressions || 0,
            clicks: k?.metrics?.clicks || 0,
            ctr: k?.metrics?.ctr || 0,
            average_cpc_micros: k?.metrics?.average_cpc || 0,
            cost_micros: k?.metrics?.cost_micros || 0,
            conversions: k?.metrics?.conversions || 0,
            conversions_value: k?.metrics?.conversions_value || 0, // ✅ AÑADIR
            all_conversions: k?.metrics?.all_conversions || 0, // ✅ AÑADIR
            all_conversions_value: k?.metrics?.all_conversions_value || 0, // ✅ AÑADIR
            quality_score:
              k?.ad_group_criterion?.quality_info?.quality_score ?? null,
            creative_quality_score:
              k?.ad_group_criterion?.quality_info?.creative_quality_score ??
              null,
            post_click_quality_score:
              k?.ad_group_criterion?.quality_info?.post_click_quality_score ??
              null,
            search_predicted_ctr:
              k?.ad_group_criterion?.quality_info?.search_predicted_ctr ?? null,
          }));

          if (keywordsToSave.length) {
            await saveKeywords(customerId, keywordsToSave, dateStr);
            totalKeywords += keywordsToSave.length;
          }

          const keywordsDuration = Date.now() - keywordsStart;
          totalKeywordsTime += keywordsDuration;
          console.log(
            `     🔑 Keywords: ${keywordsToSave.length} (${(
              keywordsDuration / 1000
            ).toFixed(1)}s)`
          );

          // 🔥 ALERTA si keywords tarda mucho
          if (keywordsDuration > 60000) {
            console.warn(
              `     ⚠️  LENTO: keywords tardó ${(
                keywordsDuration / 1000
              ).toFixed(1)}s`
            );
          }
        } catch (keywordError) {
          console.error(
            `     ❌ Error procesando keywords:`,
            safeStringify(keywordError)
          );
        }

        // === SEARCH TERMS ===
        // 🔥 DEBUG: CRÍTICO - Esta suele ser la operación más lenta
        const searchTermsStart = Date.now();
        console.log(
          `     🔍 Obteniendo search terms... (inicio: ${new Date().toISOString()})`
        );
        try {
          const searchTerms = await fetchSearchTerms(
            customer,
            customerId,
            campaign.id,
            ag?.ad_group?.id,
            dateStr
          );
          if (Array.isArray(searchTerms) && searchTerms.length > 0) {
            await saveSearchTerms(customerId, searchTerms, dateStr);
            totalSearchTerms += searchTerms.length;
          }

          const searchTermsDuration = Date.now() - searchTermsStart;
          totalSearchTermsTime += searchTermsDuration;
          console.log(
            `     ✅ Search Terms: ${searchTerms?.length || 0} (${(
              searchTermsDuration / 1000
            ).toFixed(1)}s)`
          );

          // 🔥 ALERTA si search terms tarda mucho
          if (searchTermsDuration > 60000) {
            console.warn(
              `     ⚠️  LENTO: search terms tardó ${(
                searchTermsDuration / 1000
              ).toFixed(1)}s`
            );
          }
          if (searchTermsDuration > 300000) {
            console.error(
              `     🔥 CRÍTICO: search terms tardó ${(
                searchTermsDuration /
                1000 /
                60
              ).toFixed(1)} MINUTOS`
            );
          }
        } catch (searchTermError) {
          const searchTermsDuration = Date.now() - searchTermsStart;
          console.error(
            `     ❌ Error procesando search terms después de ${(
              searchTermsDuration / 1000
            ).toFixed(1)}s:`,
            safeStringify(searchTermError)
          );
        }

        // === AUDIENCE SEGMENTS POR AD GROUP ===
        // 🔥 DEBUG: CRÍTICO - También puede ser muy lento
        const audienceStart = Date.now();
        console.log(
          `     🔍 Obteniendo audience segments... (inicio: ${new Date().toISOString()})`
        );
        try {
          const audienceSegments = await fetchAndSaveAudienceSegmentsForAdGroup(
            customer,
            customerId,
            campaign.id,
            ag?.ad_group?.id,
            dateStr,
            { includeBidModifier: true }
          );

          if (Array.isArray(audienceSegments) && audienceSegments.length > 0) {
            totalAudienceSegments += audienceSegments.length;
          }

          const audienceDuration = Date.now() - audienceStart;
          totalAudienceTime += audienceDuration;
          console.log(
            `     ✅ Audience Segments: ${audienceSegments?.length || 0} (${(
              audienceDuration / 1000
            ).toFixed(1)}s)`
          );

          // 🔥 ALERTA si audience tarda mucho
          if (audienceDuration > 60000) {
            console.warn(
              `     ⚠️  LENTO: audience segments tardó ${(
                audienceDuration / 1000
              ).toFixed(1)}s`
            );
          }
          if (audienceDuration > 300000) {
            console.error(
              `     🔥 CRÍTICO: audience segments tardó ${(
                audienceDuration /
                1000 /
                60
              ).toFixed(1)} MINUTOS`
            );
          }
        } catch (audienceError) {
          const audienceDuration = Date.now() - audienceStart;
          console.error(
            `     ❌ Error procesando audience segments después de ${(
              audienceDuration / 1000
            ).toFixed(1)}s:`,
            safeStringify(audienceError)
          );
        }
      }

      // === AUDIENCE SEGMENTS GEO POR CAMPAÑA ===
      // 🔥 DEBUG: GEO puede ser problemático
      const geoStart = Date.now();
      console.log(
        `     🔍 Obteniendo audience GEO... (inicio: ${new Date().toISOString()})`
      );
      try {
        const geoSegments = await fetchAndSaveAudienceSegments(
          customer,
          customerId,
          campaign.id,
          dateStr
        );
        if (Array.isArray(geoSegments) && geoSegments.length > 0) {
          totalAudienceSegments += geoSegments.length;
        }

        const geoDuration = Date.now() - geoStart;
        console.log(
          `     ✅ Audience GEO: ${geoSegments?.length || 0} (${(
            geoDuration / 1000
          ).toFixed(1)}s)`
        );

        if (geoDuration > 60000) {
          console.warn(
            `     ⚠️  LENTO: audience GEO tardó ${(geoDuration / 1000).toFixed(
              1
            )}s`
          );
        }
        if (geoDuration > 300000) {
          console.error(
            `     🔥 CRÍTICO: audience GEO tardó ${(
              geoDuration /
              1000 /
              60
            ).toFixed(1)} MINUTOS`
          );
        }
      } catch (geoError) {
        const geoDuration = Date.now() - geoStart;
        console.error(
          `     ❌ Error procesando audience GEO después de ${(
            geoDuration / 1000
          ).toFixed(1)}s:`,
          safeStringify(geoError)
        );
      }

      console.log(`     ✅ Campaña completada`);
    }

    // 🔥 DEBUG: Resumen de tiempos
    durations.ad_groups_total = totalAdGroupsTime;
    durations.ads_total = totalAdsTime;
    durations.keywords_total = totalKeywordsTime;
    durations.search_terms_total = totalSearchTermsTime;
    durations.audience_total = totalAudienceTime;

    console.log(`\n   📊 Tiempos acumulados:`);
    console.log(
      `      • Ad Groups total: ${(totalAdGroupsTime / 1000).toFixed(1)}s`
    );
    console.log(`      • Ads total: ${(totalAdsTime / 1000).toFixed(1)}s`);
    console.log(
      `      • Keywords total: ${(totalKeywordsTime / 1000).toFixed(1)}s`
    );
    console.log(
      `      • Search Terms total: ${(totalSearchTermsTime / 1000).toFixed(1)}s`
    );
    console.log(
      `      • Audience total: ${(totalAudienceTime / 1000).toFixed(1)}s`
    );

    // === NEGATIVAS A NIVEL CAMPAÑA (solo último día) ===
    if (dateStr === endDateStr) {
      console.log(
        `\n🚫 PASO 3: Procesando keywords negativas a nivel campaña...`
      );
      try {
        const campaignNegativesResult = await safeQuery(
          customer,
          `
        SELECT
          campaign.id,
          campaign_criterion.criterion_id,
          campaign_criterion.keyword.text,
          campaign_criterion.keyword.match_type,
          campaign_criterion.status
        FROM campaign_criterion
        WHERE campaign_criterion.negative = true
          AND campaign_criterion.keyword.text IS NOT NULL
          AND campaign.status = 'ENABLED'
          AND campaign.experiment_type = 'BASE'
          AND campaign.serving_status IN ('SERVING', 'NONE')
      `,
          { retries: 2, baseDelay: 400 }
        );

        const allNegatives = (campaignNegativesResult || []).map((neg) => ({
          customer_id: customerId,
          campaign_id: neg?.campaign?.id,
          ad_group_id: null,
          criterion_id: neg?.campaign_criterion?.criterion_id,
          date: dateStr,
          keyword_text: neg?.campaign_criterion?.keyword?.text,
          match_type: neg?.campaign_criterion?.keyword?.match_type,
          is_negative: true,
          status: neg?.campaign_criterion?.status,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          average_cpc_micros: 0,
          cost_micros: 0,
          conversions: 0,
        }));

        if (allNegatives.length) {
          await saveNegativeCampaignKeywords(customerId, allNegatives, dateStr);
          console.log(
            `  ✅ ${allNegatives.length} keywords negativas guardadas`
          );
        }
      } catch (err) {
        console.error(`  ❌ Error guardando negativas:`, safeStringify(err));
      }
    }

    // 🔥 ==================== DEBUG: FIN - RESUMEN COMPLETO ====================
    const totalTime = Date.now() - dayStartTime;

    console.log(`\n${"=".repeat(80)}`);
    console.log(`✅ DÍA COMPLETADO: ${dateStr}`);
    console.log("=".repeat(80));
    console.log(`📊 Resumen:`);
    console.log(`   🎯 Campañas tradicionales: ${totalCampaigns}`);
    console.log(`   🚀 Campañas PMax: ${totalPMaxCampaigns}`);
    console.log(`   📦 Asset Groups: ${totalAssetGroups}`);
    console.log(`   🎨 Assets: ${totalAssets}`);
    console.log(`   📁 Ad Groups: ${totalAdGroups}`);
    console.log(`   📝 Ads: ${totalAds}`);
    console.log(`   🔑 Keywords: ${totalKeywords}`);
    console.log(`   🔍 Search Terms: ${totalSearchTerms}`);
    console.log(`   👥 Audience Segments: ${totalAudienceSegments}`);

    // 🔥 DEBUG: BREAKDOWN DETALLADO DE TIEMPOS
    console.log(`\n⏱️  BREAKDOWN DE TIEMPOS:`);
    console.log(
      `   • Campaigns query:        ${(
        durations.campaigns_query / 1000
      ).toFixed(1)}s`
    );
    console.log(
      `   • Budgets query:          ${(durations.budgets_query / 1000).toFixed(
        1
      )}s`
    );
    console.log(
      `   • PMax campaigns query:   ${(
        durations.pmax_campaigns_query / 1000
      ).toFixed(1)}s`
    );
    console.log(
      `   • Ad Groups (acumulado):  ${(
        durations.ad_groups_total / 1000
      ).toFixed(1)}s`
    );
    console.log(
      `   • Ads (acumulado):        ${(durations.ads_total / 1000).toFixed(1)}s`
    );
    console.log(
      `   • Keywords (acumulado):   ${(durations.keywords_total / 1000).toFixed(
        1
      )}s`
    );
    console.log(
      `   • Search Terms (acum):    ${(
        durations.search_terms_total / 1000
      ).toFixed(1)}s`
    );
    console.log(
      `   • Audience (acumulado):   ${(durations.audience_total / 1000).toFixed(
        1
      )}s`
    );
    console.log(`   ${"─".repeat(40)}`);
    console.log(
      `   • TOTAL DÍA:              ${(totalTime / 1000).toFixed(1)}s (${(
        totalTime /
        1000 /
        60
      ).toFixed(1)} min)`
    );

    // 🔥 IDENTIFICAR CUELLO DE BOTELLA
    const bottleneck = Object.entries(durations)
      .filter(([key]) => key.includes("total") || key.includes("query"))
      .reduce((max, [key, val]) => (val > max.val ? { key, val } : max), {
        key: "",
        val: 0,
      });

    if (bottleneck.val > 0) {
      console.log(
        `   🎯 Cuello de botella: ${bottleneck.key} (${(
          bottleneck.val / 1000
        ).toFixed(1)}s)`
      );
    }

    // 🔥 ALERTAS
    if (totalTime > 120000) {
      console.warn(
        `\n   ⚠️  DÍA LENTO: ${dateStr} tardó ${(totalTime / 1000).toFixed(1)}s`
      );
    }
    if (totalTime > 300000) {
      console.error(
        `\n   🔥 DÍA CRÍTICO: ${dateStr} tardó ${(
          totalTime /
          1000 /
          60
        ).toFixed(1)} MINUTOS`
      );
    }

    console.log("=".repeat(80) + "\n");

    return campaigns;

    // 🔥 ==================== DEBUG: CATCH GLOBAL ====================
  } catch (globalError) {
    const totalTime = Date.now() - dayStartTime;
    console.error(
      `\n❌ [${customerId}] ERROR GLOBAL en día ${dateStr} después de ${(
        totalTime / 1000
      ).toFixed(1)}s`
    );
    console.error(`   💥 Error: ${safeStringify(globalError)}`);

    // Mostrar qué operaciones se completaron
    if (Object.keys(durations).length > 0) {
      console.error(`   📊 Operaciones completadas antes del error:`);
      Object.entries(durations).forEach(([key, val]) => {
        console.error(`      • ${key}: ${(val / 1000).toFixed(1)}s`);
      });
    }

    throw globalError;
  }
}

/*** tttttt***/

/**
 * Procesa campañas Performance Max para una fecha específica
 */
async function processPMaxCampaigns(customer, customerId, dateStr) {
  console.log(`\n🚀 Procesando campañas Performance Max para ${dateStr}...`);

  const result = {
    campaignsCount: 0,
    assetGroupsCount: 0,
    assetsCount: 0,
    imagesCount: 0,
  };

  try {
    // 1️⃣ Obtener campañas PMax
    const queryCampaigns = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign.campaign_budget,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_from_interactions_rate,
        metrics.cost_per_conversion,
        metrics.all_conversions,
        metrics.value_per_all_conversions
      FROM campaign
      WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
        AND campaign.status = 'ENABLED'
        AND campaign.experiment_type = 'BASE'
        AND segments.date = '${dateStr}'
      LIMIT 50
    `;

    const pmaxCampaignsRaw = await safeQuery(customer, queryCampaigns, {
      retries: 3,
      baseDelay: 600,
    });

    if (!Array.isArray(pmaxCampaignsRaw) || pmaxCampaignsRaw.length === 0) {
      console.log(`  ℹ️  No hay campañas PMax para ${dateStr}`);
      return result;
    }

    console.log(`  ✅ ${pmaxCampaignsRaw.length} campañas PMax encontradas`);
    result.campaignsCount = pmaxCampaignsRaw.length;

    // 2️⃣ Obtener presupuestos
    const pmaxBudgetIds = pmaxCampaignsRaw
      .map((c) => {
        const resourceName = c?.campaign?.campaign_budget;
        if (!resourceName || typeof resourceName !== "string") return null;
        const parts = resourceName.split("/");
        return parts.length ? parts[parts.length - 1] : null;
      })
      .filter(Boolean);

    let pmaxBudgetMap = new Map();
    if (pmaxBudgetIds.length > 0) {
      try {
        const pmaxBudgetIdsString = pmaxBudgetIds
          .map((id) => `'${id}'`)
          .join(",");
        const pmaxBudgetRows = await safeQuery(
          customer,
          `
          SELECT campaign_budget.id, campaign_budget.amount_micros
          FROM campaign_budget
          WHERE campaign_budget.id IN (${pmaxBudgetIdsString})
        `,
          { retries: 2, baseDelay: 500 }
        );

        if (Array.isArray(pmaxBudgetRows)) {
          pmaxBudgetMap = new Map(
            pmaxBudgetRows.map((row) => [
              String(row?.campaign_budget?.id),
              row?.campaign_budget?.amount_micros || 0,
            ])
          );
        }
      } catch (budgetError) {
        console.warn(
          `  ⚠️ Error obteniendo presupuestos PMax:`,
          budgetError.message
        );
      }
    }

    // 3️⃣ Guardar campañas PMax
    for (const c of pmaxCampaignsRaw) {
      try {
        const resourceName = c?.campaign?.campaign_budget;
        const parts = resourceName ? resourceName.split("/") : [];
        const budgetId = parts.length ? parts[parts.length - 1] : null;
        const budgetMicros = (budgetId && pmaxBudgetMap.get(budgetId)) || 0;

        await pool.execute(
          `INSERT INTO campaign_metrics_history (
            customer_id, campaign_id, campaign_name, campaign_status, campaign_type,
            date, impressions, clicks, ctr, average_cpc_micros, cost_micros,
            conversions, conversion_rate, cost_per_conversion_micros,
            all_conversions, value_per_all_conversions, budget_micros, bidding_strategy
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            impressions = VALUES(impressions),
            clicks = VALUES(clicks),
            ctr = VALUES(ctr),
            cost_micros = VALUES(cost_micros),
            conversions = VALUES(conversions),
            average_cpc_micros = VALUES(average_cpc_micros),
            value_per_all_conversions = VALUES(value_per_all_conversions),
            updated_at = CURRENT_TIMESTAMP`,
          [
            customerId,
            c?.campaign?.id,
            c?.campaign?.name || `PMax ${c?.campaign?.id}`,
            c?.campaign?.status,
            c?.campaign?.advertising_channel_type,
            dateStr,
            c?.metrics?.impressions || 0,
            c?.metrics?.clicks || 0,
            c?.metrics?.ctr || 0,
            c?.metrics?.average_cpc || 0,
            c?.metrics?.cost_micros || 0,
            c?.metrics?.conversions || 0,
            c?.metrics?.conversions_from_interactions_rate || 0,
            c?.metrics?.cost_per_conversion || 0,
            c?.metrics?.all_conversions || 0,
            c?.metrics?.value_per_all_conversions || 0,
            budgetMicros,
            c?.campaign?.bidding_strategy_type || null,
          ]
        );
      } catch (saveError) {
        console.error(
          `  ❌ Error guardando PMax ${c?.campaign?.id}:`,
          saveError.message
        );
      }
    }

    console.log(`  💾 Campañas PMax guardadas`);

    // 4️⃣ Procesar Asset Groups
    const assetGroupsResult = await processPMaxAssetGroups(
      customer,
      customerId,
      dateStr
    );
    result.assetGroupsCount = assetGroupsResult.assetGroupsCount;
    result.assetsCount = assetGroupsResult.assetsCount;
    result.imagesCount = assetGroupsResult.imagesCount;

    return result;
  } catch (error) {
    console.error(`  ❌ Error procesando Performance Max:`, error.message);
    throw error;
  }
}

/**
 * Procesa Asset Groups y Assets de Performance Max
 */
async function processPMaxAssetGroups(customer, customerId, dateStr) {
  console.log(`  📦 Procesando Asset Groups...`);

  const result = {
    assetGroupsCount: 0,
    assetsCount: 0,
    imagesCount: 0,
  };

  try {
    // 1️⃣ Obtener Asset Groups activos
    const queryAssetGroups = `
      SELECT
        asset_group.id,
        asset_group.name,
        asset_group.status,
        asset_group.campaign,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM asset_group
      WHERE asset_group.status = 'ENABLED'
        AND segments.date = '${dateStr}'
      LIMIT 500
    `;

    const assetGroups = await safeQuery(customer, queryAssetGroups, {
      retries: 3,
      baseDelay: 500,
    });

    if (!Array.isArray(assetGroups) || assetGroups.length === 0) {
      console.log(`     ⚠️ No hay Asset Groups activos`);
      return result;
    }

    console.log(`     ✅ ${assetGroups.length} asset groups encontrados`);
    result.assetGroupsCount = assetGroups.length;

    // 2️⃣ Crear mapa y guardar Asset Groups
    const assetGroupToCampaign = {};
    const assetGroupIds = [];

    for (const ag of assetGroups) {
      try {
        const campaignResource = ag?.asset_group?.campaign || "";
        const campaignId = campaignResource.split("/").pop();
        assetGroupToCampaign[ag.asset_group.id] = campaignId;
        assetGroupIds.push(ag.asset_group.id);

        await pool.execute(
          `INSERT INTO asset_groups (
            customer_id, campaign_id, asset_group_id, asset_group_name, status,
            date, impressions, clicks, cost_micros, conversions
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            impressions = VALUES(impressions),
            clicks = VALUES(clicks),
            cost_micros = VALUES(cost_micros),
            conversions = VALUES(conversions)`,
          [
            customerId,
            campaignId,
            ag.asset_group.id,
            ag.asset_group.name,
            ag.asset_group.status,
            dateStr,
            ag.metrics?.impressions || 0,
            ag.metrics?.clicks || 0,
            ag.metrics?.cost_micros || 0,
            ag.metrics?.conversions || 0,
          ]
        );
      } catch (agError) {
        console.error(
          `     ❌ Error guardando asset group ${ag?.asset_group?.id}:`,
          agError.message
        );
      }
    }

    console.log(`     💾 ${assetGroups.length} asset groups guardados`);

    // 3️⃣ Procesar Assets
    const assetsResult = await processPMaxAssets(
      customer,
      customerId,
      dateStr,
      assetGroupIds,
      assetGroupToCampaign
    );
    result.assetsCount = assetsResult.assetsCount;
    result.imagesCount = assetsResult.imagesCount;

    return result;
  } catch (error) {
    console.error(`  ❌ Error procesando asset groups:`, error.message);
    throw error;
  }
}

/**
 * Procesa Assets de Performance Max
 */
async function processPMaxAssets(
  customer,
  customerId,
  dateStr,
  assetGroupIds,
  assetGroupToCampaign
) {
  console.log(`  🎨 Procesando Assets...`);

  const result = {
    assetsCount: 0,
    imagesCount: 0,
  };

  try {
    // 1️⃣ Construir filtro de Asset Groups
    const assetGroupResourceNames = assetGroupIds
      .map((id) => `customers/${customerId}/assetGroups/${id}`)
      .join("','");

    // 2️⃣ Query 1: Obtener TODOS los assets
    const queryAllAssets = `
      SELECT
        asset_group_asset.asset_group,
        asset_group_asset.asset,
        asset_group_asset.field_type,
        asset_group_asset.performance_label,
        asset.type,
        asset.name,
        asset.text_asset.text,
        asset.image_asset.full_size.url,
        asset.youtube_video_asset.youtube_video_id
      FROM asset_group_asset
      WHERE asset_group_asset.asset_group IN ('${assetGroupResourceNames}')
      LIMIT 10000
    `;

    const allAssets = await safeQuery(customer, queryAllAssets, {
      retries: 3,
      baseDelay: 500,
    });

    if (!Array.isArray(allAssets) || allAssets.length === 0) {
      console.log(`     ⚠️ No hay assets`);
      return result;
    }

    console.log(`     ✅ ${allAssets.length} assets encontrados`);

    // 3️⃣ Query 2: Obtener métricas
    const queryMetrics = `
      SELECT
        asset_group_asset.asset,
        asset_group_asset.asset_group,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM asset_group_asset
      WHERE segments.date = '${dateStr}'
        AND asset_group_asset.asset_group IN ('${assetGroupResourceNames}')
      LIMIT 10000
    `;

    const assetsWithMetrics = await safeQuery(customer, queryMetrics, {
      retries: 3,
      baseDelay: 500,
    });

    console.log(`     ✅ ${assetsWithMetrics.length} assets con métricas`);

    // 4️⃣ Crear mapa de métricas
    const metricsMap = new Map();
    for (const am of assetsWithMetrics || []) {
      const assetResourceName = am.asset_group_asset?.asset || "";
      const assetMatch = assetResourceName.match(/assets\/(\d+)/);
      const assetId = assetMatch ? assetMatch[1] : null;

      const assetGroupResourceName = am.asset_group_asset?.asset_group || "";
      const assetGroupMatch =
        assetGroupResourceName.match(/assetGroups\/(\d+)/);
      const assetGroupId = assetGroupMatch ? assetGroupMatch[1] : null;

      if (assetId && assetGroupId) {
        const key = `${assetGroupId}_${assetId}`;
        metricsMap.set(key, {
          impressions: am.metrics?.impressions || 0,
          clicks: am.metrics?.clicks || 0,
          cost_micros: am.metrics?.cost_micros || 0,
          conversions: am.metrics?.conversions || 0,
        });
      }
    }

    // 5️⃣ Guardar assets
    const imageAssetIds = [];
    let assetsGuardados = 0;
    let assetsOmitidos = 0;
    const savedAssets = new Set();
    const descriptionCountByAssetGroup = new Map();

    for (const a of allAssets) {
      try {
        const assetGroupResourceName = a.asset_group_asset?.asset_group || "";
        const assetGroupMatch =
          assetGroupResourceName.match(/assetGroups\/(\d+)/);
        const assetGroupId = assetGroupMatch ? assetGroupMatch[1] : null;

        const assetResourceName = a.asset_group_asset?.asset || "";
        const assetMatch = assetResourceName.match(/assets\/(\d+)/);
        const assetId = assetMatch ? assetMatch[1] : null;

        const fieldType = a.asset_group_asset?.field_type || "UNKNOWN";

        if (!assetId || !assetGroupId) {
          assetsOmitidos++;
          continue;
        }

        // Verificar duplicados
        const uniqueKey = `${assetGroupId}_${assetId}_${fieldType}`;
        if (savedAssets.has(uniqueKey)) {
          assetsOmitidos++;
          continue;
        }
        savedAssets.add(uniqueKey);

        // Limitar descripciones a 5 por Asset Group
        if (fieldType === "DESCRIPTION") {
          const currentCount =
            descriptionCountByAssetGroup.get(assetGroupId) || 0;
          if (currentCount >= 5) {
            assetsOmitidos++;
            continue;
          }
          descriptionCountByAssetGroup.set(assetGroupId, currentCount + 1);
        }

        const campaignId = assetGroupToCampaign[assetGroupId];
        if (!campaignId) {
          assetsOmitidos++;
          continue;
        }

        // Obtener métricas
        const key = `${assetGroupId}_${assetId}`;
        const metrics = metricsMap.get(key) || {
          impressions: 0,
          clicks: 0,
          cost_micros: 0,
          conversions: 0,
        };

        if (a.asset?.type === "IMAGE") {
          imageAssetIds.push(assetId);
        }

        const validLabels = [
          "PENDING",
          "LOW",
          "GOOD",
          "BEST",
          "AVERAGE",
          "UNSPECIFIED",
          "UNKNOWN",
        ];
        const performanceLabel = validLabels.includes(
          a.asset_group_asset?.performance_label
        )
          ? a.asset_group_asset.performance_label
          : "PENDING";

        await pool.execute(
          `INSERT INTO asset_group_assets (
            customer_id, campaign_id, asset_group_id, asset_id,
            field_type, text_value, image_url, youtube_video_id, performance_label,
            impressions, clicks, cost_micros, conversions, date
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            impressions = VALUES(impressions),
            clicks = VALUES(clicks),
            cost_micros = VALUES(cost_micros),
            conversions = VALUES(conversions),
            performance_label = VALUES(performance_label),
            text_value = VALUES(text_value),
            image_url = VALUES(image_url),
            youtube_video_id = VALUES(youtube_video_id),
            updated_at = CURRENT_TIMESTAMP`,
          [
            customerId,
            campaignId,
            assetGroupId,
            assetId,
            fieldType,
            a.asset?.text_asset?.text || null,
            a.asset?.image_asset?.full_size?.url || null,
            a.asset?.youtube_video_asset?.youtube_video_id || null,
            performanceLabel,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            dateStr,
          ]
        );

        assetsGuardados++;
      } catch (assetError) {
        console.error(`     ❌ Error guardando asset:`, assetError.message);
        assetsOmitidos++;
      }
    }

    result.assetsCount = assetsGuardados;
    result.imagesCount = imageAssetIds.length;

    console.log(
      `     💾 ${assetsGuardados} assets guardados, ${assetsOmitidos} omitidos`
    );

    // 6️⃣ Actualizar URLs de imagen
    if (imageAssetIds.length > 0) {
      await updatePMaxImageUrls(customer, customerId, dateStr, imageAssetIds);
    }

    return result;
  } catch (error) {
    console.error(`  ❌ Error procesando assets:`, error.message);
    throw error;
  }
}

/**
 * Actualiza las URLs de las imágenes de los assets
 */
async function updatePMaxImageUrls(
  customer,
  customerId,
  dateStr,
  imageAssetIds
) {
  console.log(
    `     🖼️  Actualizando ${imageAssetIds.length} URLs de imagen...`
  );

  try {
    const batchSize = 200;
    let updatedCount = 0;

    for (let i = 0; i < imageAssetIds.length; i += batchSize) {
      const batch = imageAssetIds.slice(i, i + batchSize);
      const ids = batch.map((id) => `'${id}'`).join(",");

      const queryImages = `
        SELECT 
          asset.id, 
          asset.image_asset.full_size.url
        FROM asset
        WHERE asset.id IN (${ids})
          AND asset.type = 'IMAGE'
      `;

      const imageRows = await safeQuery(customer, queryImages, {
        retries: 3,
        baseDelay: 400,
      });

      for (const img of imageRows || []) {
        const imageUrl = img.asset?.image_asset?.full_size?.url;

        if (
          !imageUrl ||
          imageUrl.includes("tpc.googlesyndication.com") ||
          imageUrl.includes("placeholder")
        ) {
          continue;
        }

        await pool.execute(
          `UPDATE asset_group_assets
           SET image_url = ?
           WHERE customer_id = ? AND asset_id = ? AND date = ?`,
          [imageUrl, customerId, img.asset.id, dateStr]
        );

        updatedCount++;
      }

      if (i + batchSize < imageAssetIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    console.log(
      `     ✅ ${updatedCount}/${imageAssetIds.length} URLs actualizadas`
    );
  } catch (error) {
    console.warn(`     ⚠️ Error actualizando imágenes:`, error.message);
  }
}

app.get("/api/google-ads-pmax", async (req, res) => {
  const { customer_id, start_date, end_date } = req.query;

  // Validaciones
  if (!customer_id) {
    return res.status(400).send("<h3>❌ Falta parámetro 'customer_id'</h3>");
  }

  // Si no se especifican fechas, usar hoy
  const today = new Date().toISOString().split("T")[0];
  const startDate = start_date || today;
  const endDate = end_date || start_date || today;

  // Validar formato de fechas
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return res
      .status(400)
      .send("<h3>❌ Formato de fecha inválido. Use YYYY-MM-DD</h3>");
  }

  // Validar que start_date <= end_date
  if (new Date(startDate) > new Date(endDate)) {
    return res
      .status(400)
      .send(
        "<h3>❌ La fecha de inicio debe ser menor o igual a la fecha fin</h3>"
      );
  }

  try {
    // 1️⃣ Obtener refresh_token
    const [rows] = await pool.query(
      `SELECT t.refresh_token
       FROM tokens t
       JOIN accounts a 
         ON (a.customer_id = t.customer_id OR a.parent_account_id = t.customer_id)
       WHERE a.customer_id = ?
       LIMIT 1`,
      [customer_id]
    );

    const refresh_token = rows?.[0]?.refresh_token;
    if (!refresh_token) {
      return res.send(
        `<h3>⚠️ No se encontró refresh_token para ${customer_id}</h3>`
      );
    }

    // 2️⃣ Crear cliente Google Ads
    const customer = client.Customer({
      customer_id,
      refresh_token,
      login_customer_id: process.env.MCC_ID,
    });

    // 📅 Generar array de fechas en el rango
    const dates = getDatesInRange(startDate, endDate);
    console.log(
      `📅 Procesando ${dates.length} días: desde ${startDate} hasta ${endDate}`
    );

    // Contadores globales
    let totalCampaigns = 0;
    let totalAssetGroups = 0;
    let totalAssets = 0;
    let totalImages = 0;
    const resultsByDate = [];

    // 🔄 Procesar cada fecha
    for (const currentDate of dates) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`📅 Procesando fecha: ${currentDate}`);
      console.log(`${"=".repeat(80)}\n`);

      try {
        const dateResult = await processPMaxForDate(
          customer,
          customer_id,
          currentDate,
          pool
        );

        resultsByDate.push({
          date: currentDate,
          ...dateResult,
        });

        totalCampaigns += dateResult.campaignsCount;
        totalAssetGroups += dateResult.assetGroupsCount;
        totalAssets += dateResult.assetsCount;
        totalImages += dateResult.imagesCount;

        console.log(`✅ Fecha ${currentDate} completada`);

        // Delay entre fechas para evitar rate limiting
        if (dates.indexOf(currentDate) < dates.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // ⬆️ Aumentado a 2 segundos
        }
      } catch (dateError) {
        console.error(
          `❌ Error procesando fecha ${currentDate}:`,
          dateError.message
        );
        console.error(`Stack:`, dateError.stack);
        resultsByDate.push({
          date: currentDate,
          error: dateError.message,
          campaignsCount: 0,
          assetGroupsCount: 0,
          assetsCount: 0,
          imagesCount: 0,
        });
      }
    }

    // 8️⃣ Resumen HTML
    let html = `
      <h2>✅ Procesamiento PMax Completado</h2>
      <h3>Resumen para Customer ID: ${customer_id}</h3>
      <ul>
        <li>📅 Rango de fechas: ${startDate} → ${endDate} (${dates.length} días)</li>
        <li>🎯 Total Campañas: ${totalCampaigns}</li>
        <li>📦 Total Asset Groups: ${totalAssetGroups}</li>
        <li>🧩 Total Assets: ${totalAssets}</li>
        <li>🖼️ Total Imágenes: ${totalImages}</li>
      </ul>
      
      <h3>Resumen por Fecha:</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
        <tr style="background-color: #f0f0f0;">
          <th>Fecha</th>
          <th>Campañas</th>
          <th>Asset Groups</th>
          <th>Assets</th>
          <th>Imágenes</th>
          <th>Estado</th>
        </tr>
    `;

    for (const result of resultsByDate) {
      const status = result.error ? `❌ Error: ${result.error}` : "✅ OK";
      const rowStyle = result.error ? "background-color: #ffe0e0;" : "";

      html += `
        <tr style="${rowStyle}">
          <td>${result.date}</td>
          <td>${result.campaignsCount || 0}</td>
          <td>${result.assetGroupsCount || 0}</td>
          <td>${result.assetsCount || 0}</td>
          <td>${result.imagesCount || 0}</td>
          <td>${status}</td>
        </tr>
      `;
    }

    html += `</table>`;

    // Tabla detallada de la última fecha procesada exitosamente
    const successfulResults = resultsByDate.filter(
      (r) => !r.error && r.campaigns && r.campaigns.length > 0
    );

    if (successfulResults.length > 0) {
      const lastSuccessful = successfulResults[successfulResults.length - 1];
      html += `
        <h3>Detalle de última fecha exitosa (${lastSuccessful.date}):</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
          <tr style="background-color: #f0f0f0;">
            <th>ID</th>
            <th>Nombre</th>
            <th>Impresiones</th>
            <th>Clicks</th>
            <th>Conversiones</th>
            <th>Coste (€)</th>
          </tr>
      `;

      for (const c of lastSuccessful.campaigns) {
        const cost = (c.metrics.cost_micros / 1_000_000).toFixed(2);
        html += `
          <tr>
            <td>${c.campaign.id}</td>
            <td>${c.campaign.name}</td>
            <td>${(c.metrics.impressions || 0).toLocaleString()}</td>
            <td>${(c.metrics.clicks || 0).toLocaleString()}</td>
            <td>${(c.metrics.conversions || 0).toFixed(1)}</td>
            <td>${cost} €</td>
          </tr>
        `;
      }

      html += `</table>`;
    }

    res.send(html);
  } catch (err) {
    console.error("❌ Error en /api/google-ads-pmax:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).send(`
      <h3>❌ Error en /api/google-ads-pmax</h3>
      <pre>${err.message}</pre>
      <pre>${err.stack}</pre>
    `);
  }
});

// 🔧 Función auxiliar: Generar array de fechas en un rango
function getDatesInRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// 🔧 Función auxiliar: Procesar PMax para una fecha específica
async function processPMaxForDate(customer, customer_id, date, pool) {
  const result = {
    campaignsCount: 0,
    assetGroupsCount: 0,
    assetsCount: 0,
    imagesCount: 0,
    campaigns: [],
  };

  try {
    // ✅ 1️⃣ Campañas Performance Max
    console.log(`📊 Paso 1: Obteniendo campañas PMax para ${date}...`);

    const queryCampaigns = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign_budget.amount_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_from_interactions_rate,
        metrics.cost_per_conversion,
        metrics.all_conversions,
        metrics.value_per_all_conversions
      FROM campaign
      WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
        AND campaign.status = 'ENABLED'
        AND segments.date = '${date}'
      LIMIT 50
    `;

    const campaigns = await safeQuery(customer, queryCampaigns, {
      retries: 3,
      baseDelay: 500,
      context: {
        name: "pmax_campaigns",
        customer_id: customer_id,
        date: date,
      },
    });

    if (!campaigns || campaigns.length === 0) {
      console.log(`⚠️ No se encontraron campañas PMax para ${date}`);
      return result;
    }

    console.log(`✅ ${campaigns.length} campañas encontradas`);
    result.campaignsCount = campaigns.length;
    result.campaigns = campaigns;

    // ✅ 2️⃣ Guardar campañas
    console.log(`💾 Guardando campañas...`);

    for (const c of campaigns) {
      await pool.query(
        `INSERT INTO campaign_metrics_history (
          customer_id, campaign_id, campaign_name, campaign_status, campaign_type,
          date, impressions, clicks, ctr, average_cpc_micros, cost_micros,
          conversions, conversion_rate, cost_per_conversion_micros,
          all_conversions, value_per_all_conversions, budget_micros, bidding_strategy
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          impressions = VALUES(impressions),
          clicks = VALUES(clicks),
          ctr = VALUES(ctr),
          cost_micros = VALUES(cost_micros),
          conversions = VALUES(conversions),
          average_cpc_micros = VALUES(average_cpc_micros),
          value_per_all_conversions = VALUES(value_per_all_conversions),
          updated_at = CURRENT_TIMESTAMP`,
        [
          customer_id,
          c.campaign.id,
          c.campaign.name,
          c.campaign.status,
          3,
          date,
          c.metrics.impressions || 0,
          c.metrics.clicks || 0,
          c.metrics.ctr || 0,
          c.metrics.average_cpc || 0,
          c.metrics.cost_micros || 0,
          c.metrics.conversions || 0,
          c.metrics.conversions_from_interactions_rate || 0,
          c.metrics.cost_per_conversion || 0,
          c.metrics.all_conversions || 0,
          c.metrics.value_per_all_conversions || 0,
          c.campaign_budget?.amount_micros || 0,
          c.campaign.bidding_strategy_type || null,
        ]
      );
    }

    // ✅ 3️⃣ Asset Groups (solo ENABLED)
    console.log(`📊 Paso 2: Obteniendo Asset Groups activos...`);

    const queryAssetGroups = `
      SELECT
        asset_group.id,
        asset_group.name,
        asset_group.status,
        asset_group.campaign,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM asset_group
      WHERE asset_group.status = 'ENABLED'
        AND segments.date = '${date}'
      LIMIT 500
    `;

    const assetGroups = await safeQuery(customer, queryAssetGroups, {
      retries: 3,
      baseDelay: 500,
      context: {
        name: "pmax_asset_groups",
        customer_id: customer_id,
        date: date,
      },
    });

    console.log(`✅ ${assetGroups.length} Asset Groups activos encontrados`);
    result.assetGroupsCount = assetGroups.length;

    if (assetGroups.length === 0) {
      console.log(`⚠️ No hay Asset Groups activos`);
      return result;
    }

    // Crear mapa y lista de IDs
    const assetGroupToCampaign = {};
    const assetGroupIds = [];

    for (const ag of assetGroups) {
      const campaignId = ag.asset_group.campaign.split("/").pop();
      assetGroupToCampaign[ag.asset_group.id] = campaignId;
      assetGroupIds.push(ag.asset_group.id);

      await pool.query(
        `INSERT INTO asset_groups (
          customer_id, campaign_id, asset_group_id, asset_group_name, status,
          date, impressions, clicks, cost_micros, conversions
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          impressions = VALUES(impressions),
          clicks = VALUES(clicks),
          cost_micros = VALUES(cost_micros),
          conversions = VALUES(conversions),
          updated_at = CURRENT_TIMESTAMP`,
        [
          customer_id,
          campaignId,
          ag.asset_group.id,
          ag.asset_group.name,
          ag.asset_group.status,
          date,
          ag.metrics.impressions || 0,
          ag.metrics.clicks || 0,
          ag.metrics.cost_micros || 0,
          ag.metrics.conversions || 0,
        ]
      );
    }

    // ✅ 4️⃣ Assets - Query 1: TODOS los assets CON FILTRO
    console.log(
      `📊 Paso 3a: Obteniendo TODOS los assets de ${assetGroupIds.length} Asset Groups...`
    );

    // 🔥 CRÍTICO: Construir filtro de Asset Groups
    const assetGroupResourceNames = assetGroupIds
      .map((id) => `customers/${customer_id}/assetGroups/${id}`)
      .join("','");

    const queryAllAssets = `
      SELECT
        asset_group_asset.asset_group,
        asset_group_asset.asset,
        asset_group_asset.field_type,
        asset_group_asset.performance_label,
        asset.type,
        asset.name,
        asset.text_asset.text,
        asset.image_asset.full_size.url,
        asset.youtube_video_asset.youtube_video_id
      FROM asset_group_asset
      WHERE asset_group_asset.asset_group IN ('${assetGroupResourceNames}')
      LIMIT 10000
    `;

    const allAssets = await safeQuery(customer, queryAllAssets, {
      retries: 3,
      baseDelay: 500,
      context: {
        name: "pmax_all_assets",
        customer_id: customer_id,
        date: date,
      },
    });

    console.log(`✅ ${allAssets.length} assets totales encontrados`);

    // Contar por tipo ANTES de guardar
    const assetsByType = {};
    for (const a of allAssets) {
      const fieldType = a.asset_group_asset?.field_type || "UNKNOWN";
      assetsByType[fieldType] = (assetsByType[fieldType] || 0) + 1;
    }
    console.log(`📊 Assets por tipo:`);
    console.table(assetsByType);

    // ✅ 4️⃣ Assets - Query 2: Métricas
    console.log(`📊 Paso 3b: Obteniendo métricas...`);

    const queryMetrics = `
      SELECT
        asset_group_asset.asset,
        asset_group_asset.asset_group,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM asset_group_asset
      WHERE segments.date = '${date}'
        AND asset_group_asset.asset_group IN ('${assetGroupResourceNames}')
      LIMIT 10000
    `;

    const assetsWithMetrics = await safeQuery(customer, queryMetrics, {
      retries: 3,
      baseDelay: 500,
      context: {
        name: "pmax_metrics",
        customer_id: customer_id,
        date: date,
      },
    });

    console.log(`✅ ${assetsWithMetrics.length} assets con métricas`);

    // Crear mapa de métricas
    const metricsMap = new Map();
    for (const am of assetsWithMetrics) {
      const assetResourceName = am.asset_group_asset?.asset || "";
      const assetMatch = assetResourceName.match(/assets\/(\d+)/);
      const assetId = assetMatch ? assetMatch[1] : null;

      const assetGroupResourceName = am.asset_group_asset?.asset_group || "";
      const assetGroupMatch =
        assetGroupResourceName.match(/assetGroups\/(\d+)/);
      const assetGroupId = assetGroupMatch ? assetGroupMatch[1] : null;

      if (assetId && assetGroupId) {
        const key = `${assetGroupId}_${assetId}`;
        metricsMap.set(key, {
          impressions: am.metrics?.impressions || 0,
          clicks: am.metrics?.clicks || 0,
          cost_micros: am.metrics?.cost_micros || 0,
          conversions: am.metrics?.conversions || 0,
        });
      }
    }

    // ✅ 4️⃣ Assets - Guardar
    console.log(`💾 Paso 3c: Guardando assets...`);

    const imageAssetIds = [];
    let assetsGuardados = 0;
    let assetsOmitidos = 0;
    const savedAssets = new Set();
    const descriptionCountByAssetGroup = new Map();

    for (const a of allAssets) {
      try {
        const assetGroupResourceName = a.asset_group_asset?.asset_group || "";
        const assetGroupMatch =
          assetGroupResourceName.match(/assetGroups\/(\d+)/);
        const assetGroupId = assetGroupMatch ? assetGroupMatch[1] : null;

        const assetResourceName = a.asset_group_asset?.asset || "";
        const assetMatch = assetResourceName.match(/assets\/(\d+)/);
        const assetId = assetMatch ? assetMatch[1] : null;

        const fieldType = a.asset_group_asset?.field_type || "UNKNOWN";

        if (!assetId) {
          console.warn(`⚠️ Asset sin ID omitido (tipo: ${fieldType})`);
          assetsOmitidos++;
          continue;
        }

        if (!assetGroupId) {
          console.warn(
            `⚠️ Asset ${assetId} sin asset_group_id (tipo: ${fieldType})`
          );
          assetsOmitidos++;
          continue;
        }

        // Verificar duplicados
        const uniqueKey = `${assetGroupId}_${assetId}_${fieldType}`;
        if (savedAssets.has(uniqueKey)) {
          assetsOmitidos++;
          continue;
        }
        savedAssets.add(uniqueKey);

        // Limitar descripciones a 5 por Asset Group
        if (fieldType === "DESCRIPTION") {
          const currentCount =
            descriptionCountByAssetGroup.get(assetGroupId) || 0;
          if (currentCount >= 5) {
            assetsOmitidos++;
            continue;
          }
          descriptionCountByAssetGroup.set(assetGroupId, currentCount + 1);
        }

        const campaignId = assetGroupToCampaign[assetGroupId];
        if (!campaignId) {
          console.warn(
            `⚠️ Asset ${assetId} sin campaign_id (tipo: ${fieldType})`
          );
          assetsOmitidos++;
          continue;
        }

        // Obtener métricas
        const key = `${assetGroupId}_${assetId}`;
        const metrics = metricsMap.get(key) || {
          impressions: 0,
          clicks: 0,
          cost_micros: 0,
          conversions: 0,
        };

        if (a.asset?.type === "IMAGE") {
          imageAssetIds.push(assetId);
        }

        const validLabels = [
          "PENDING",
          "LOW",
          "GOOD",
          "BEST",
          "AVERAGE",
          "UNSPECIFIED",
          "UNKNOWN",
        ];
        const performanceLabel = validLabels.includes(
          a.asset_group_asset?.performance_label
        )
          ? a.asset_group_asset.performance_label
          : "PENDING";

        const textValue = a.asset?.text_asset?.text || null;
        const imageUrl = a.asset?.image_asset?.full_size?.url || null;

        await pool.query(
          `INSERT INTO asset_group_assets (
            customer_id, campaign_id, asset_group_id, asset_id,
            field_type, text_value, image_url, youtube_video_id, performance_label,
            impressions, clicks, cost_micros, conversions, date
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            impressions = VALUES(impressions),
            clicks = VALUES(clicks),
            cost_micros = VALUES(cost_micros),
            conversions = VALUES(conversions),
            performance_label = VALUES(performance_label),
            text_value = VALUES(text_value),
            image_url = VALUES(image_url),
            youtube_video_id = VALUES(youtube_video_id),
            updated_at = CURRENT_TIMESTAMP`,
          [
            customer_id,
            campaignId,
            assetGroupId,
            assetId,
            fieldType,
            textValue,
            imageUrl,
            a.asset?.youtube_video_asset?.youtube_video_id || null,
            performanceLabel,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            date,
          ]
        );

        assetsGuardados++;

        if (assetsGuardados % 100 === 0) {
          console.log(`  💾 ${assetsGuardados} assets guardados...`);
        }
      } catch (assetError) {
        const fieldType = a.asset_group_asset?.field_type || "UNKNOWN";
        console.error(
          `❌ Error guardando asset tipo ${fieldType}:`,
          assetError.message
        );
        assetsOmitidos++;
      }
    }

    result.assetsCount = assetsGuardados;
    result.imagesCount = imageAssetIds.length;

    console.log(
      `📊 Assets guardados: ${assetsGuardados}, omitidos: ${assetsOmitidos}`
    );
    console.log(
      `📊 Con métricas: ${metricsMap.size}, sin métricas: ${
        assetsGuardados - metricsMap.size
      }`
    );

    // Verificar en BD lo que realmente se guardó
    const [savedRows] = await pool.query(
      `SELECT field_type, COUNT(*) as count 
       FROM asset_group_assets 
       WHERE customer_id = ? AND date = ? 
       GROUP BY field_type`,
      [customer_id, date]
    );

    const savedByType = {};
    for (const row of savedRows) {
      savedByType[row.field_type] = row.count;
    }
    console.log(`📊 Verificación BD - Assets guardados por tipo:`);
    console.table(savedByType);

    // ✅ 5️⃣ Actualizar URLs de imagen
    if (imageAssetIds.length > 0) {
      console.log(
        `🖼️ Paso 4: Actualizando ${imageAssetIds.length} URLs de imagen...`
      );

      const batchSize = 200;
      let updatedCount = 0;

      for (let i = 0; i < imageAssetIds.length; i += batchSize) {
        const batch = imageAssetIds.slice(i, i + batchSize);
        const ids = batch.map((id) => `'${id}'`).join(",");

        const queryImages = `
          SELECT 
            asset.id, 
            asset.image_asset.full_size.url
          FROM asset
          WHERE asset.id IN (${ids})
            AND asset.type = 'IMAGE'
        `;

        try {
          const imageRows = await safeQuery(customer, queryImages, {
            retries: 3,
            baseDelay: 400,
            context: {
              name: "pmax_asset_images",
              customer_id: customer_id,
              date: date,
            },
          });

          for (const img of imageRows) {
            const imageUrl = img.asset?.image_asset?.full_size?.url;

            if (
              !imageUrl ||
              imageUrl.includes("tpc.googlesyndication.com") ||
              imageUrl.includes("placeholder")
            ) {
              continue;
            }

            await pool.query(
              `UPDATE asset_group_assets
               SET image_url = ?
               WHERE customer_id = ? AND asset_id = ? AND date = ?`,
              [imageUrl, customer_id, img.asset.id, date]
            );

            updatedCount++;
          }

          if (i + batchSize < imageAssetIds.length) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        } catch (error) {
          console.error(`❌ Error actualizando imágenes:`, error.message);
        }
      }

      console.log(
        `✅ URLs actualizadas: ${updatedCount}/${imageAssetIds.length}`
      );
    }

    console.log(
      `✅ Fecha ${date} completada: ${result.campaignsCount} campañas, ${result.assetGroupsCount} groups, ${result.assetsCount} assets`
    );

    return result;
  } catch (error) {
    console.error(
      `❌ Error en processPMaxForDate para ${date}:`,
      error.message
    );
    console.error(`Stack:`, error.stack);
    throw error;
  }
}

// ==========================
// AUTENTICACIÓN GOOGLE ADS
// ==========================

app.get("/auth", (req, res) => {
  const scopes = ["https://www.googleapis.com/auth/adwords"];

  const state = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  req.session.oauth_state = state;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    redirect_uri: "https://optimizalo.app/oauth2callback",
    state,
  });

  res.redirect(authUrl);
});
function cleanCustomerId(id) {
  if (typeof id === "string" && id.startsWith("customers/")) {
    return id.split("/")[1];
  }
  return id;
}

// ==========================
// AUTENTICACIÓN GOOGLE ADS - CALLBACK MEJORADO
// ==========================

app.get("/oauth2callback", async (req, res) => {
  try {
    const oauthCode = req.query.code;
    const returnedState = req.query.state;
    const expectedState = req.session?.oauth_state;

    console.log("🔑 Código recibido en callback:", oauthCode);
    console.log("🛡️ Validando state:", returnedState, "vs", expectedState);

    if (!returnedState || returnedState !== expectedState) {
      return res
        .status(400)
        .send("❌ Estado inválido o caducado. Intenta conectar de nuevo.");
    }

    delete req.session.oauth_state;

    if (!req.session || !req.session.user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login`);
    }

    const userId = req.session.user.id;
    console.log("🧑‍💻 Usuario en sesión:", req.session.user);

    let tokens;
    try {
      const result = await oauth2Client.getToken({
        code: oauthCode,
        redirect_uri: "https://optimizalo.app/oauth2callback",
      });
      tokens = result.tokens;
      oauth2Client.setCredentials(tokens);
    } catch (error) {
      console.error(
        "❌ Error al intercambiar el code por token:",
        error.response?.data || error.message
      );
      return res
        .status(400)
        .send(
          "Error en el intercambio de token: " +
            (error.response?.data?.error_description || error.message)
        );
    }

    const refresh_token = tokens.refresh_token;
    if (!refresh_token) {
      return res.status(400).send("❌ No se recibió refresh_token");
    }

    const expiry_date = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : null;

    const apiClient = new GoogleAdsApi({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_DEVELOPER_TOKEN,
    });

    const accessible = await apiClient.listAccessibleCustomers(refresh_token);
    const customerIdList = accessible.resource_names.map((resource) =>
      resource.split("/").pop()
    );

    if (!customerIdList.length) {
      return res.status(400).send("❌ No se encontraron cuentas accesibles.");
    }

    // ✅ SIN CONEXIÓN PERSISTENTE - Usar pool.execute directamente
    const cuentasConectadas = [];
    const cuentasParaSincronizar = [];

    for (const customer_id of customerIdList) {
      const customerIdClean = cleanCustomerId(customer_id);

      try {
        const customer = apiClient.Customer({
          customer_id,
          refresh_token,
        });

        // ✅ CORREGIDO: Con contexto completo
        const infoResult = await safeQuery(
          customer,
          `
          SELECT customer.id, customer.descriptive_name, customer.manager
          FROM customer
          LIMIT 1
          `,
          {
            retries: 1,
            baseDelay: 300,
            throwOnError: false,
            context: {
              name: "oauth_customer_info",
              customer_id: customerIdClean,
              date: null,
            },
          }
        );

        // Si no se pudo obtener info, saltar esta cuenta
        if (!infoResult || infoResult.length === 0) {
          console.warn(
            `⚠️ No se pudo acceder a ${customerIdClean}: Sin datos disponibles`
          );
          continue;
        }

        const info = infoResult[0];
        const is_mcc = info.customer?.manager ? 1 : 0;
        const nombre =
          info.customer?.descriptive_name || `Account ${customerIdClean}`;

        // ✅ Guardar en tokens (usando pool.execute - conexión automática corta)
        await pool.execute(
          `INSERT INTO tokens (user_id, refresh_token, customer_id, is_mcc, access_token_expiry)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE refresh_token = ?, is_mcc = ?, access_token_expiry = ?`,
          [
            userId,
            refresh_token,
            customerIdClean,
            is_mcc,
            expiry_date,
            refresh_token,
            is_mcc,
            expiry_date,
          ]
        );

        // ✅ Guardar en accounts (usando pool.execute - conexión automática corta)
        await pool.execute(
          `INSERT INTO accounts (customer_id, name, is_mcc, parent_account_id)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = ?, is_mcc = ?`,
          [customerIdClean, nombre, is_mcc, null, nombre, is_mcc]
        );

        if (is_mcc) {
          cuentasConectadas.push(`${nombre} (MCC) - ${customerIdClean}`);
          console.log(
            `🏢 Consultando subcuentas de MCC ${customerIdClean} (${nombre})...`
          );

          // ✅ CORREGIDO: Con contexto completo
          const accounts = await safeQuery(
            customer,
            `
            SELECT
              customer_client.client_customer,
              customer_client.descriptive_name,
              customer_client.status,
              customer_client.level
            FROM customer_client
            `,
            {
              retries: 1,
              baseDelay: 300,
              throwOnError: false,
              context: {
                name: "oauth_mcc_subaccounts",
                customer_id: customerIdClean,
                mcc_id: customerIdClean,
                date: null,
              },
            }
          );

          console.log(`📊 Subcuentas encontradas: ${accounts.length}`);

          for (const account of accounts) {
            try {
              const subCustomerClean = cleanCustomerId(
                account.customer_client?.client_customer
              );
              const subName =
                account.customer_client?.descriptive_name ||
                `SubAccount ${subCustomerClean}`;

              cuentasConectadas.push(`  → ${subName} - ${subCustomerClean}`);

              // ✅ Guardar subcuenta (usando pool.execute - conexión automática corta)
              await pool.execute(
                `INSERT INTO accounts (customer_id, name, is_mcc, parent_account_id)
                 VALUES (?, ?, 0, ?)
                 ON DUPLICATE KEY UPDATE name = ?`,
                [subCustomerClean, subName, customerIdClean, subName]
              );

              cuentasParaSincronizar.push(subCustomerClean);
            } catch (err) {
              console.warn(
                `⚠️ No se pudo guardar subcuenta ${account.customer_client?.client_customer}:`,
                err.message
              );
            }
          }
        } else {
          cuentasConectadas.push(`${nombre} - ${customerIdClean}`);
          cuentasParaSincronizar.push(customerIdClean);
        }

        console.log(`✅ Cuenta conectada: ${customerIdClean}`);
      } catch (e) {
        console.warn(`⚠️ No se pudo acceder a ${customerIdClean}:`, e.message);
        continue; // ⚠️ Continuar con siguiente cuenta
      }
    }

    // ✅ Sin finally porque no hay conexión persistente que liberar

    if (!cuentasConectadas.length) {
      return res
        .status(400)
        .send("❌ No se pudo guardar ninguna cuenta accesible.");
    }

    // 🔥 Programar sincronización
    console.log(
      `\n🚀 Programando sincronización para ${cuentasParaSincronizar.length} cuentas...`
    );

    if (cuentasParaSincronizar.length > 0) {
      try {
        const results = [];
        for (const accountId of cuentasParaSincronizar) {
          const result = await createSyncTasks(pool, accountId);
          results.push(result);
        }

        const createdCount = results.filter((r) => r.created).length;
        console.log(
          `✅ Tareas de sincronización creadas para ${createdCount}/${cuentasParaSincronizar.length} cuentas`
        );

        if (createdCount > 0) {
          syncQueue.onComplete = async (result) => {
            console.log(
              `\n🎉 Sincronización completada para ${result.accountsReady} cuentas`
            );
            console.log("🚀 Iniciando cola de análisis...");

            try {
              if (!analysisQueue.isRunning) {
                analysisQueue.start().catch((err) => {
                  console.error("❌ Error en cola de análisis:", err);
                });
              }
            } catch (err) {
              console.error("❌ Error iniciando análisis:", err);
            }
          };

          syncQueue.start().catch((err) => {
            console.error("❌ Error en cola de sincronización:", err);
          });
        }
      } catch (queueError) {
        console.error("⚠️ Error programando sincronización:", queueError);
      }
    }

    console.log(
      `🎉 Proceso de conexión completado. Sincronización en curso.\n`
    );

    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?connected=true&queued=${cuentasParaSincronizar.length}`
    );
  } catch (error) {
    if (
      error.code === "RESOURCE_EXHAUSTED" ||
      (error.message && error.message.includes("RATE_EXCEEDED"))
    ) {
      console.error("⚠️ RATE LIMIT alcanzado en /oauth2callback:", {
        message: error.message,
        stack: error.stack,
        time: new Date().toISOString(),
      });
    }

    console.error("❌ Error en OAuth callback:", error);
    res.status(500).send("❌ Error durante la autenticación");
  }
  // ✅ Sin finally - no hay conexión persistente que liberar
});

// ==========================
// OBTENER CAMPAÑAS DE GOOGLE ADS
// ==========================
// Función para guardar métricas de recursos PMAX en tabla específica
async function savePmaxResourceMetrics(
  customerId,
  campaignId,
  date,
  resources
) {
  try {
    for (const r of resources) {
      await pool.execute(
        `INSERT INTO pmax_resource_metrics_history
          (customer_id, campaign_id, date, resource_name, asset_type, location, device, impressions, clicks, ctr, cost_micros, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           impressions=VALUES(impressions),
           clicks=VALUES(clicks),
           ctr=VALUES(ctr),
           cost_micros=VALUES(cost_micros),
           created_at=NOW()
        `,
        [
          customerId,
          campaignId,
          date,
          r.asset?.name || r.name || "Unknown",
          r.segments?.asset_type || null,
          r.segments?.location || null,
          r.segments?.device || null,
          r.metrics?.impressions || 0,
          r.metrics?.clicks || 0,
          r.metrics?.ctr || 0,
          r.metrics?.cost_micros || 0,
        ]
      );
    }
  } catch (error) {
    console.error("❌ Error guardando métricas recursos PMAX:", error);
    throw error;
  }
}

// ============================================
// ENDPOINT PARA VER ESTADO DE LA COLA GLOBAL
// ============================================
app.get("/api/queue-status", (req, res) => {
  try {
    const status = syncQueue.getStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error("❌ Error obteniendo estado de cola:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});

app.post("/api/start-daily-sync", async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "Customer ID es requerido" });
    }

    // Crear tarea diaria
    const result = await createDailyTask(pool, customerId);

    // Si la cola no está corriendo y se creó la tarea, iniciarla
    if (!syncQueue.isRunning && result.created) {
      syncQueue.start().catch((err) => {
        console.error("❌ Error en cola de sincronización:", err);
      });
    }

    const status = syncQueue.getStatus();

    return res.status(200).json({
      message: result.created ? "Tarea diaria programada" : result.message,
      customerId,
      taskResult: result,
      queueStatus: status,
    });
  } catch (error) {
    console.error("❌ Error en start-daily-sync:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});

app.post("/api/start-sync", async (req, res) => {
  try {
    if (syncQueue.isRunning) {
      return res.status(400).json({
        error: "La sincronización ya está en ejecución",
        status: syncQueue.getStatus(),
      });
    }

    // Iniciar procesamiento asíncrono
    syncQueue.start().catch((err) => {
      console.error("❌ Error en cola de sincronización:", err);
    });

    res.status(200).json({
      message: "Sincronización iniciada",
      status: syncQueue.getStatus(),
    });
  } catch (error) {
    console.error("❌ Error iniciando sincronización:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});

app.post("/api/stop-sync", (req, res) => {
  try {
    syncQueue.stop();
    res.status(200).json({
      message: "Sincronización detenida",
      status: syncQueue.getStatus(),
    });
  } catch (error) {
    console.error("❌ Error deteniendo sincronización:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});

app.post("/api/start-account-sync", async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "Customer ID es requerido" });
    }

    // Crear tareas de sincronización
    const result = await createSyncTasks(pool, customerId);

    // Si la cola no está corriendo, iniciarla
    if (!syncQueue.isRunning && result.created) {
      syncQueue.start().catch((err) => {
        console.error("❌ Error en cola de sincronización:", err);
      });
    }

    const status = syncQueue.getStatus();

    return res.status(200).json({
      message: result.created
        ? "Cuenta programada para sincronización"
        : result.message,
      customerId,
      taskResult: result,
      queueStatus: status,
    });
  } catch (error) {
    console.error("❌ Error en start-account-sync:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});

app.get("/api/sync-status/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;

    const [queueTasks] = await pool.execute(
      `
      SELECT 
        COUNT(*) as totalTasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        MIN(start_date) as startDate,
        MAX(end_date) as endDate
      FROM sync_queue
      WHERE customer_id = ?
    `,
      [customerId]
    );

    const queueInfo = queueTasks[0];

    if (queueInfo.totalTasks === 0) {
      return res.status(404).json({
        message: "No hay sincronización para esta cuenta",
      });
    }

    // CAMBIO: Cada tarea es 1 SEMANA, no 1 día
    const totalWeeks = queueInfo.totalTasks;
    const completedWeeks = queueInfo.completed;

    // Calcular progreso basado en SEMANAS completadas
    const progressPercentage =
      totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;

    const isCompleted =
      queueInfo.pending === 0 &&
      queueInfo.processing === 0 &&
      queueInfo.failed === 0;

    const queueStatus = syncQueue.getStatus();
    const isProcessing = queueStatus.processingAccounts.includes(customerId);

    res.status(200).json({
      customerId,

      // Información de tareas (1 tarea = 1 semana)
      totalTasks: queueInfo.totalTasks,
      completed: queueInfo.completed,
      processing: queueInfo.processing,
      pending: queueInfo.pending,
      failed: queueInfo.failed,

      // CAMBIO: Información de SEMANAS (para la UI)
      totalWeeks: totalWeeks, // Ej: 3 semanas
      completedWeeks: completedWeeks, // Ej: 2 de 3
      startDate: queueInfo.startDate,
      endDate: queueInfo.endDate,

      // Para compatibilidad
      weeklyTasks: {
        total: totalWeeks,
        completed: completedWeeks,
        pending: queueInfo.pending,
      },

      // Estados
      progressPercentage,
      isCompleted,
      isCurrentlyProcessing: isProcessing,

      queueStatus: {
        isRunning: queueStatus.isRunning,
        totalProcessing: queueStatus.processingCount,
        maxConcurrent: queueStatus.maxConcurrent,
      },
    });
  } catch (error) {
    console.error("❌ Error obteniendo estado:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});

app.get("/api/test-google-ads-access/:customerId", async (req, res) => {
  const { customerId } = req.params;

  try {
    // 1. Obtener info de la cuenta
    const [account] = await pool.execute(
      `SELECT * FROM accounts WHERE customer_id = ?`,
      [customerId]
    );

    if (!account.length) {
      return res.status(404).json({ error: "Cuenta no encontrada" });
    }

    // 2. Obtener token del MCC padre
    const parentId = account[0].parent_account_id || customerId;
    const [token] = await pool.execute(
      `SELECT refresh_token FROM tokens WHERE customer_id = ?`,
      [parentId]
    );

    if (!token.length) {
      return res.status(404).json({ error: "Token no encontrado" });
    }

    // 3. Crear cliente de Google Ads
    const { GoogleAdsApi } = await import("google-ads-api");

    const apiClient = new GoogleAdsApi({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_DEVELOPER_TOKEN,
    });

    const customer = apiClient.Customer({
      customer_id: customerId,
      refresh_token: token[0].refresh_token,
      login_customer_id: parentId,
    });

    console.log(
      `🧪 Probando acceso a cuenta ${customerId} (${account[0].name})...`
    );

    // ✅ Query 1: Info básica del customer
    const customerInfo = await safeQuery(
      customer,
      `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.status
      FROM customer
      LIMIT 1
    `,
      {
        retries: 2,
        baseDelay: 300,
        context: {
          name: "test_customer_info",
          customer_id: customerId,
          date: null,
        },
      }
    );

    console.log(`   ✅ Acceso a customer exitoso`);

    // ✅ Query 2: Campañas activas (sin métricas)
    const campaigns = await safeQuery(
      customer,
      `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND campaign.experiment_type = 'BASE'
      LIMIT 10
    `,
      {
        retries: 2,
        baseDelay: 300,
        context: {
          name: "test_campaigns_enabled",
          customer_id: customerId,
          date: null,
        },
      }
    );

    console.log(`   📊 Campañas activas encontradas: ${campaigns.length}`);

    // ✅ Query 3: Cualquier campaña (incluso pausadas)
    const allCampaigns = await safeQuery(
      customer,
      `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type
      FROM campaign
      LIMIT 10
    `,
      {
        retries: 2,
        baseDelay: 300,
        context: {
          name: "test_campaigns_all",
          customer_id: customerId,
          date: null,
        },
      }
    );

    console.log(`   📊 Campañas totales: ${allCampaigns.length}`);

    // Query 4: Métricas con rango de fecha CORRECTO
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const dateFrom = sevenDaysAgo.toISOString().split("T")[0];
    const dateTo = yesterday.toISOString().split("T")[0];

    let metricsTest = [];
    let totalImpressions = 0;
    let totalClicks = 0;
    let metricsError = null;

    try {
      // ✅ Con contexto completo
      metricsTest = await safeQuery(
        customer,
        `
        SELECT 
          campaign.id,
          campaign.name,
          campaign.status,
          metrics.impressions,
          metrics.clicks
        FROM campaign
        WHERE campaign.status = 'ENABLED'
          AND campaign.experiment_type = 'BASE'
          AND segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      `,
        {
          retries: 2,
          baseDelay: 300,
          context: {
            name: "test_metrics_7d",
            customer_id: customerId,
            date: `${dateFrom} to ${dateTo}`,
          },
        }
      );

      totalImpressions = metricsTest.reduce(
        (sum, c) => sum + (c.metrics?.impressions || 0),
        0
      );
      totalClicks = metricsTest.reduce(
        (sum, c) => sum + (c.metrics?.clicks || 0),
        0
      );

      console.log(
        `   📊 Campañas con métricas (últimos 7 días): ${metricsTest.length}`
      );
      console.log(`   📈 Total impresiones: ${totalImpressions}`);
      console.log(`   🖱️  Total clicks: ${totalClicks}`);
    } catch (metricsErr) {
      metricsError = metricsErr.message;
      console.warn(
        `   ⚠️ No se pudieron obtener métricas:`,
        metricsErr.message
      );
    }

    // Query 5: Verificar datos en tu base de datos
    const [dbMetrics] = await pool.execute(
      `
      SELECT 
        COUNT(DISTINCT date) as days_with_data,
        COUNT(DISTINCT campaign_id) as campaigns_in_db,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM campaign_metrics_history
      WHERE customer_id = ?
    `,
      [customerId]
    );

    const dbData = dbMetrics[0];

    res.json({
      success: true,
      customerId,
      accountName: account[0].name,
      parentMCC: parentId,
      customerInfo: customerInfo[0]?.customer || null,
      googleAds: {
        campaigns: {
          enabled: campaigns.length,
          total: allCampaigns.length,
        },
        metrics: metricsError
          ? {
              error: metricsError,
              note: "No se pudieron obtener métricas recientes, pero esto no afecta la sincronización",
            }
          : {
              period: `${dateFrom} a ${dateTo}`,
              campaignsWithMetrics: metricsTest.length,
              totalImpressions,
              totalClicks,
              hasActivity: totalImpressions > 0 || totalClicks > 0,
            },
        campaignsList: campaigns.slice(0, 5).map((c) => ({
          id: c.campaign?.id,
          name: c.campaign?.name,
          status: c.campaign?.status,
          type: c.campaign?.advertising_channel_type,
        })),
      },
      database: {
        daysWithData: dbData.days_with_data,
        campaignsInDB: dbData.campaigns_in_db,
        totalImpressions: dbData.total_impressions,
        totalClicks: dbData.total_clicks,
        dateRange:
          dbData.days_with_data > 0
            ? `${dbData.first_date} a ${dbData.last_date}`
            : "Sin datos",
        hasSyncedData: dbData.days_with_data > 0,
      },
      diagnosis:
        allCampaigns.length === 0
          ? "❌ La cuenta no tiene campañas"
          : campaigns.length === 0
          ? "⚠️ La cuenta tiene campañas pero ninguna está activa (ENABLED)"
          : dbData.days_with_data === 0
          ? "⚠️ La cuenta es accesible pero no se ha sincronizado aún"
          : dbData.days_with_data < 7
          ? `⚠️ Datos parciales: solo ${dbData.days_with_data} días sincronizados`
          : "✅ La cuenta tiene campañas activas y datos sincronizados",
    });
  } catch (error) {
    console.error(`❌ Error probando acceso a ${customerId}:`, error);

    // Detectar error de cuenta desactivada
    const errorMsg = error.message || String(error);
    const isDeactivated =
      errorMsg.includes("not yet enabled") ||
      errorMsg.includes("has been deactivated") ||
      errorMsg.includes("can't be accessed");

    res.status(isDeactivated ? 403 : 500).json({
      success: false,
      customerId,
      error: error.message,
      errorType: error.constructor.name,
      errorCode: error.code,
      details: error.errors?.[0] || error.failure || null,
      isDeactivated,
      recommendation: isDeactivated
        ? "La cuenta está desactivada en Google Ads. Actívala desde el MCC o márcala como inactiva en tu sistema."
        : "Error técnico al acceder a la cuenta. Revisa los logs para más detalles.",
    });
  }
});

// =============== ENDPOINTS DE ANÁLISIS CON IA ===============

// Iniciar cola de análisis
app.post("/api/start-analysis", async (req, res) => {
  try {
    if (analysisQueue.isRunning) {
      console.log("ℹ️  La cola de análisis ya está en ejecución");
      return res.status(200).json({
        message: "La cola de análisis ya está en ejecución",
        alreadyRunning: true,
        status: analysisQueue.getStatus(),
      });
    }

    console.log("🚀 Iniciando cola de análisis...");

    // Iniciar procesamiento asíncrono
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

// Detener cola de análisis
app.post("/api/stop-analysis", (req, res) => {
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

// Estado de la cola de análisis
app.get("/api/analysis-queue-status", (req, res) => {
  try {
    const status = analysisQueue.getStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error("❌ Error obteniendo estado:", error);
    res.status(500).json({ error: "Error interno", details: error.message });
  }
});

// Estado de análisis por cuenta
app.get("/api/analysis-status/:customerId", async (req, res) => {
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

// Programar análisis para una cuenta específica
app.post("/api/schedule-analysis", async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "Customer ID es requerido" });
    }

    const result = await createWeeklyAnalysisTask(pool, customerId);

    // Si la cola no está corriendo y se creó la tarea, iniciarla
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

app.get("/api/google-accounts", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "No autenticado" });
  }

  const userId = req.session.user.id;

  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT a.customer_id, a.name, a.is_mcc,parent_account_id
       FROM accounts a
        JOIN tokens t
        ON t.user_id = ?
       WHERE a.customer_id = t.customer_id
          OR a.parent_account_id = t.customer_id`,
      [userId]
    );

    const transformedAccounts = rows.map((row) => ({
      id: row.customer_id,
      accountId: row.customer_id,
      accountName: row.name,
      accountType: row.is_mcc ? "MCC" : "STANDARD",
      connected: true, // Asume conectada para probar
      lastSyncedAt: null,
      parentAccountId: row.parent_account_id,
    }));

    console.log(transformedAccounts);
    res.json({ accounts: transformedAccounts });
  } catch (err) {
    console.error("Error al obtener cuentas:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/account-metrics/:customer_id", async (req, res) => {
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

// --- util: extrae JSON aunque venga entre fences ---
function extractJson(raw) {
  if (!raw) throw new Error("Respuesta vacía");
  const trimmed = raw.trim();
  const fenceMatch =
    trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ||
    trimmed.match(/```\s*([\s\S]*?)\s*```/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

// --- util: validación mínima y normalización ---
function normalizeRec(r) {
  if (!r) return null;
  const required = [
    "titulo",
    "descripcion",
    "categoria",
    "prioridad",
    "impacto_estimado",
    "tipo_objeto",
    "objeto_id",
  ];
  for (const k of required) {
    if (
      r[k] === undefined ||
      r[k] === null ||
      (typeof r[k] === "string" && r[k].trim() === "")
    ) {
      throw new Error(`Campo requerido faltante: ${k}`);
    }
  }
  return {
    titulo: String(r.titulo).slice(0, 65535),
    descripcion: String(r.descripcion).slice(0, 65535),
    categoria: String(r.categoria).slice(0, 50),
    prioridad: String(r.prioridad).slice(0, 20),
    impacto_estimado: String(r.impacto_estimado).slice(0, 100),
    tipo_objeto: String(r.tipo_objeto).slice(0, 50),
    objeto_id: String(r.objeto_id).slice(0, 100),
  };
}

async function saveRecommendationsToDB({ pool, customerId, llmRawResponse }) {
  console.log(`\n📝 [saveRecommendationsToDB] Iniciando para ${customerId}...`);

  let parsed;
  try {
    parsed =
      typeof llmRawResponse === "string"
        ? JSON.parse(llmRawResponse)
        : llmRawResponse;
  } catch (parseErr) {
    console.error(`❌ Error parseando llmRawResponse:`, parseErr.message);
    throw new Error(`JSON inválido: ${parseErr.message}`);
  }

  if (!Array.isArray(parsed)) {
    console.log(`⚠️ llmRawResponse no es un array, length: ${parsed?.length}`);
    parsed = [];
  }

  console.log(`   📊 Recomendaciones a procesar: ${parsed.length}`);

  if (parsed.length === 0) {
    console.log(`   ℹ️ No hay recomendaciones para guardar`);
    return { inserted: 0, duplicates: 0, errors: 0 };
  }

  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (let i = 0; i < parsed.length; i++) {
    const rec = parsed[i];

    try {
      // Log cada 10 recomendaciones
      if (i % 10 === 0) {
        console.log(
          `   💾 Procesando recomendación ${i + 1}/${parsed.length}...`
        );
      }

      // 🔥 MAPEO DE CAMPOS (LLM → Base de datos)
      const tipoObjeto = rec.tipo_entidad || rec.tipo_objeto || "desconocido";
      const objetoId = rec.entidad_id || rec.objeto_id || null;
      const categoria = rec.categoria || inferCategoria(tipoObjeto);

      await pool.execute(
        `INSERT INTO recomendaciones (
          customer_id, tipo_objeto, objeto_id, titulo, descripcion,
          categoria, impacto_estimado, prioridad, estado, fecha_creacion
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', NOW())
        ON DUPLICATE KEY UPDATE
          titulo = VALUES(titulo),
          descripcion = VALUES(descripcion),
          categoria = VALUES(categoria),
          impacto_estimado = VALUES(impacto_estimado),
          prioridad = VALUES(prioridad),
          fecha_creacion = NOW()`,
        [
          customerId,
          tipoObjeto,
          objetoId,
          rec.titulo || "Sin título",
          rec.descripcion || "Sin descripción",
          categoria,
          rec.impacto_estimado || "bajo",
          rec.prioridad || "media",
        ]
      );

      inserted++;
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        duplicates++;
      } else {
        errors++;
        console.error(
          `   ❌ Error guardando recomendación ${i + 1}:`,
          err.message
        );

        // Solo mostrar el primer error en detalle
        if (errors === 1) {
          console.error(`      Código error: ${err.code}`);
          console.error(`      SQL State: ${err.sqlState}`);
          console.error(`      Datos:`, JSON.stringify(rec, null, 2));
        }
      }
    }
  }

  console.log(`\n   ✅ Proceso completado:`);
  console.log(`      Insertadas: ${inserted}`);
  console.log(`      Duplicados: ${duplicates}`);
  console.log(`      Errores: ${errors}\n`);

  return { inserted, duplicates, errors };
}

// 🔥 Función auxiliar para inferir categoría si no viene del LLM
function inferCategoria(tipoObjeto) {
  const mapeo = {
    campaign: "estructura",
    adgroup: "estructura",
    ad_group: "estructura",
    ad: "anuncios",
    keyword: "keywords",
    audience_segment: "segmentacion",
    segmento_audiencia: "segmentacion",
    pmax_campaign: "estructura",
    pmax_asset_group: "estructura",
    pmax_asset: "anuncios",
    asset: "anuncios",
  };

  return mapeo[tipoObjeto] || "otros";
}

app.get("/api/analyze", async (req, res) => {
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

  function stripFences(s = "") {
    return s
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  async function callLLM({
    name,
    system,
    payload,
    model = "gpt-4o-mini",
    temperature = 0.2,
  }) {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) },
    ];
    const cmp = await openai.chat.completions.create({
      model,
      temperature,
      messages,
    });
    const raw = cmp?.choices?.[0]?.message?.content?.trim() || "[]";
    let parsed = [];
    try {
      parsed = JSON.parse(stripFences(raw));
      if (!Array.isArray(parsed)) parsed = [];
    } catch (e) {
      console.error(`${name} JSON parse error`, e, raw.slice(0, 500));
      parsed = [];
    }
    return { arr: parsed, usage: cmp?.usage || {} };
  }

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
      llmCalls.push({ name, promise: callLLM({ name, system, payload }) });
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
          `   ${i + 1}. ${
            rec.tipo_entidad || rec.tipo_objeto
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

app.get("/api/metrics/:customer_id", async (req, res) => {
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

app.get("/api/campaign-metrics/:customer_id", async (req, res) => {
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

app.get("/api/campaigns/:campaign_id/keywords", async (req, res) => {
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
    console.error("Error al obtener keywords de campaña:", error);
    res.status(500).json({ message: "Error al obtener las keywords de campaña" });
  }
});


app.get("/api/ad-groups/:ad_group_id/keywords", async (req, res) => {
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


app.get("/api/recomendaciones/:customer_id", async (req, res) => {
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

app.get("/api/recomendaciones-aplicadas/:customer_id", async (req, res) => {
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

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener recomendaciones aplicadas:", error);
    res
      .status(500)
      .json({ message: "Error al obtener las recomendaciones aplicadas" });
  }
});

app.post("/api/recomendaciones/:id/aplicar", async (req, res) => {
  const { id } = req.params;

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
       SET estado = 'aplicada', fecha_aplicacion = NOW()
       WHERE id = ?`,
      [id]
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

app.get("/api/campaigns/:campaign_id/ad-groups", async (req, res) => {
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


app.get("/api/ad-groups/:ad_group_id/ads", async (req, res) => {
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

    const parseJsonArray = (field) => {
      if (!field) return [];
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn(`Error parsing ${field}:`, e.message);
        return [];
      }
    };

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


app.get("/api/campaigns/:campaign_id/search-terms", async (req, res) => {
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

app.get("/api/campaigns/:campaign_id/audience-segments", async (req, res) => {
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

// Endpoint para obtener audience segments por ad group
app.get("/api/ad-groups/:ad_group_id/audience-segments", async (req, res) => {
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
app.get("/api/fechas-con-datos/:customerId", async (req, res) => {
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
app.get("/api/campaigns/:campaign_id/asset-groups", async (req, res) => {
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
      ctr: Number(ag.ctr) || 0,
      cost: convertMicrosToEuros(ag.cost_micros),
      conversions: Number(ag.conversions) || 0,
      conversionsValue: convertMicrosToEuros(ag.conversions_value),
      videoViews: Number(ag.video_views) || 0,
      engagementRate: Number(ag.engagement_rate) || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error al obtener asset groups:", error);
    res.status(500).json({ error: "Error al obtener grupos de recursos" });
  }
});

// Endpoint para obtener Assets de un Asset Group
app.get("/api/asset-groups/:asset_group_id/assets", async (req, res) => {
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

const convertMicrosToEuros = (micros) => {
  if (micros === null || micros === undefined || isNaN(micros)) return 0;
  return Number(micros) / 1_000_000;
};

/**
 * Obtiene un cliente de Google Ads configurado para un customer_id específico
 * @param {string} customerId - El customer ID de Google Ads
 * @returns {Promise<Customer|null>} Cliente de Google Ads o null si no se encuentra
 */
async function getGoogleAdsCustomer(customerId) {
  try {
    const cleanId = String(customerId).replace(/-/g, "");

    console.log(`\n🔍 [DEBUG] Buscando customer_id: ${cleanId}`);

    let [rows] = await pool.query(
      `
      SELECT 
        t.refresh_token as refreshtoken,
        a.customer_id as customerid,
        a.parent_account_id as parentaccountid,
        a.is_mcc as ismcc,
        a.name as accountname
      FROM accounts a
      LEFT JOIN tokens t ON a.customer_id = t.customer_id
      WHERE a.customer_id = ?
      LIMIT 1
      `,
      [cleanId]
    );

    if (!rows || rows.length === 0) {
      console.error(`❌ No se encontró customer_id ${cleanId}`);
      return null;
    }

    const { refreshtoken, customerid, parentaccountid, ismcc, accountname } =
      rows[0];

    console.log(`✅ Encontrado: ${accountname} (${customerid})`);
    console.log(`   Parent: ${parentaccountid || "N/A"}`);
    console.log(`   Is MCC: ${ismcc ? "Yes" : "No"}`);
    console.log(`   Has token: ${refreshtoken ? "Yes" : "No"}`);
    console.log(`   Token length: ${refreshtoken ? refreshtoken.length : 0}`);

    if (!refreshtoken) {
      console.error(`❌ Refresh token vacío`);
      return null;
    }

    // Configuración del cliente
    const customerConfig = {
      customer_id: cleanId,
      refresh_token: refreshtoken,
    };

    // Si tiene parent y no es MCC, añadir login_customer_id
    if (parentaccountid && !ismcc) {
      customerConfig.login_customer_id = parentaccountid;
      console.log(`   📝 Usando login_customer_id: ${parentaccountid}`);
    }

    console.log(`\n📋 Configuración del cliente:`);
    console.log(`   customer_id: ${customerConfig.customer_id}`);
    console.log(
      `   refresh_token: ${customerConfig.refresh_token.substring(0, 10)}...`
    );
    console.log(
      `   login_customer_id: ${customerConfig.login_customer_id || "N/A"}`
    );

    // IMPORTANTE: Verificar cómo se llama tu método de inicialización
    // Puede ser client.Customer() o algo diferente según tu versión
    const customer = client.Customer({
      customer_id: customerConfig.customer_id,
      refresh_token: customerConfig.refresh_token,
      login_customer_id: customerConfig.login_customer_id,
    });

    console.log(`✅ Cliente creado correctamente\n`);
    return customer;
  } catch (error) {
    console.error(`❌ Error obteniendo customer:`, error.message);
    console.error(error.stack);
    return null;
  }
}

// Endpoint para consultar keywords directamente desde Google Ads API
app.get("/api/debug/google-ads/keywords/:customer_id", async (req, res) => {
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
app.get(
  "/api/debug/google-ads/campaign-status/:customer_id/:campaign_id",
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
app.get(
  "/api/debug/google-ads/all-campaigns/:customer_id",
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
        customer_id,
        total_campaigns: (allCampaigns || []).length,
        campaigns: (allCampaigns || []).map((c) => ({
          id: c?.campaign?.id,
          name: c?.campaign?.name,
          status: c?.campaign?.status,
          type: c?.campaign?.advertising_channel_type,
        })),
      });
    } catch (error) {
      console.error("Error listando todas las campañas:", error);
      res.status(500).json({
        message: "Error al listar todas las campañas",
        error: error.message,
        stack: error.stack,
      });
    }
  }
);

// ==========================
// INICIAR SERVIDOR
// ==========================
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Visita http://localhost:${PORT}/auth para conectar Google Ads`);
});
