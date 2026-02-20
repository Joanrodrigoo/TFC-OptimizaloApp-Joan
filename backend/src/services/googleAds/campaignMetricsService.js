import pool from "../../config/db.js";
import { toNumberOrNull, toNullIfUndefined } from "../../utils/googleAdsHelpers.js";

export async function saveCampaignSegmentMetrics(
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

export async function saveCampaignMetricsHistory(customerId, campaigns, date) {
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

            const budget_micros_value = toNumberOrNull(budget_micros) || 0;
            const average_cpc_micros = toNumberOrNull(metrics.average_cpc) || 0;
            const cost_per_conversion_micros =
                toNumberOrNull(metrics.cost_per_conversion) || 0;

            const params = [
                customerId,
                campaign_id,
                toNullIfUndefined(campaign_name),
                toNumberOrNull(campaign_status) || 0,
                toNumberOrNull(campaign_type) || 0,
                budget_micros_value,
                date,
                toNumberOrNull(metrics.impressions) || 0,
                toNumberOrNull(metrics.clicks) || 0,
                toNumberOrNull(metrics.ctr) || 0,
                average_cpc_micros,
                toNumberOrNull(metrics.cost_micros) || 0,
                toNumberOrNull(metrics.conversions) || 0,
                toNumberOrNull(metrics.conversions_value) || 0,
                toNumberOrNull(metrics.conv_rate) || 0,
                cost_per_conversion_micros,
                toNumberOrNull(metrics.all_conversions) || 0,
                toNumberOrNull(metrics.all_conversions_value) || 0,
                toNumberOrNull(metrics.value_per_all_conversions) || 0,
                toNumberOrNull(metrics.search_impression_share) || 0,
                toNumberOrNull(metrics.search_rank_lost_impression_share) || 0,
                toNumberOrNull(metrics.search_budget_lost_impression_share) || 0,
                JSON.stringify(metrics.extra || {}),
            ];

            const hasUndefined = params.some((param) => param === undefined);
            if (hasUndefined) {
                console.error("❌ Se encontraron parámetros undefined:", params);
                continue;
            }

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
        }
    } catch (error) {
        console.error("❌ Error guardando métricas campaña:", error);
        throw error;
    }
}

export async function savePmaxResourceMetrics(
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

