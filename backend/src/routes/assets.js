import express from "express";
import pool from "../config/db.js";
import { convertMicrosToEuros } from "../utils/formatters.js";

const router = express.Router();

// GET /api/asset-groups/:asset_group_id/assets
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
