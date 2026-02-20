import pool from "../../config/db.js";
import { safeQuery } from "../../utils/googleAdsHelpers.js";

const toNum = (v) => (v == null || isNaN(v) ? 0 : Number(v));
const ctrPct = (clicks, impressions) =>
    impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0.0;

export async function fetchAndSaveAudienceSegmentsForAdGroup(
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

    const finalRows = [];
    const AUDIENCE_TIMEOUT = 20000;

    // GENDER
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
            retries: 2,
            baseDelay: 500,
            timeout: AUDIENCE_TIMEOUT,
            throwOnError: false,
            context: {
                name: "fetchAudienceSegments_Gender",
                campaign_id: campaignId,
                ad_group_id: adGroupId,
                date: date,
            },
        });

        if (Array.isArray(genderRows)) {
            for (const r of genderRows) {
                const imps = toNum(r.metrics?.impressions);
                const clicks = toNum(r.metrics?.clicks);

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
    }

    // AGE RANGE
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
    }

    if (finalRows.length === 0) {
        return [];
    }

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

        const BATCH_SIZE = 20;
        let inserted = 0;

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
                    console.error(
                        `⚠️ Error guardando ${r.segment_type}:${r.segment_value}:`,
                        insertError.message
                    );
                }
            }
            if (i + BATCH_SIZE < finalRows.length) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }
    } catch (err) {
        console.error(
            "❌ Error general guardando audience_segments (AdGroup):",
            err
        );
        return finalRows;
    }

    return finalRows;
}

export async function fetchAndSaveAudienceSegments(
    customer,
    customerId,
    campaignId,
    date
) {
    const geoTempRows = [];
    const geoIdSet = new Set();
    const GEO_TIMEOUT = 30000;

    // geographic_view
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
            retries: 2,
            baseDelay: 500,
            timeout: GEO_TIMEOUT,
            context: {
                name: "fetchAudienceSegments_GEO",
                campaign_id: campaignId,
                date: date,
            },
        });

        geoCollected = geoRs.length;

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
    }

    // Fallback: user_location_view
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
        }
    }

    if (geoTempRows.length === 0) {
        return [];
    }

    let GEO_MAP = {};
    const geoIds = Array.from(geoIdSet);

    if (geoIds.length > 0) {
        const MAX_GEO_IDS = 200;
        const geoIdsLimited = geoIds.slice(0, MAX_GEO_IDS);

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
                timeout: 15000,
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
        }
    }

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

            if (i + BATCH_SIZE < finalRows.length) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }
        console.log(`💾 [audience/GEO] guardado OK: total=${inserted}`);
    } catch (err) {
        console.error("❌ Error guardando audience_segments (GEO):", err);
    }

    return finalRows;
}
