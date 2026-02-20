import express from "express";
import pool from "../config/db.js";
import { GoogleAdsApi } from "google-ads-api";
import { getDatesInRange } from "../services/syncService.js";
import { processPMaxForDate } from "../services/googleAds/pmaxService.js";

const router = express.Router();

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_DEVELOPER_TOKEN,
});

router.get("/api/google-ads-pmax", async (req, res) => {
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

export default router;
