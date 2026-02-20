import pool from "../../config/db.js";
import { safeQuery } from "../../utils/googleAdsHelpers.js";

const toNum = (v) => (v == null || isNaN(v) ? 0 : Number(v));
const ctrPct = (clicks, impressions) =>
    impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0.0;
const safe = (v, fallback = null) => (v === undefined ? fallback : v);
const toNullIfUndefined = (value) => (value === undefined ? null : value);
const toNumberOrNull = (value) => {
    if (value === undefined || value === null || isNaN(value)) return null;
    return Number(value);
};

export async function saveAdGroups(customerId, adGroups, date) {
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
                Number(ag.conversions_value) || 0,
                Number(ag.all_conversions) || 0,
                Number(ag.all_conversions_value) || 0,
            ]);
        }
    } catch (error) {
        console.error("❌ Error guardando grupos de anuncios:", error);
        throw error;
    }
}

export async function saveKeywords(customerId, keywords, date) {
    if (!keywords.length) return;
    try {
        for (const k of keywords) {
            if (k.criterion_id == null) {
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
                    k.conversions_value ?? 0,
                    k.all_conversions ?? 0,
                    k.all_conversions_value ?? 0,
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

export async function saveNegativeCampaignKeywords(customerId, negatives, date) {
    if (!Array.isArray(negatives) || negatives.length === 0) return;

    try {
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

        for (const neg of negatives) {
            await pool.execute(sql, [
                toNum(customerId),
                toNum(neg.campaign_id),
                null,
                toNum(neg.criterion_id),
                safe(neg.date, date),
                safe(neg.keyword_text, ""),
                safe(neg.match_type, "EXACT"),
                safe(neg.status, "ENABLED"),
                0,
                0,
                0,
                0,
                0,
                0,
            ]);
        }

    } catch (err) {
        console.error("❌ Error guardando negativas de campaña:", err);
        throw err;
    }
}

export async function saveAds(customerId, campaignId, date, adGroupId, ads) {
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

            // URLs
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
                    ad.conversions_value || 0,
                    ad.all_conversions || 0,
                    ad.all_conversions_value || 0,
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
        }
    } catch (error) {
        console.error("❌ Error guardando anuncios:", error);
        throw error;
    }
}

export async function fetchSearchTerms(
    customer,
    customerId,
    campaignId,
    adGroupId,
    date
) {
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
        results = await safeQuery(customer, query, {
            retries: 2,
            baseDelay: 1000,
            timeout: 60000,
            context: {
                name: "fetchSearchTerms",
                campaign_id: campaignId,
                ad_group_id: adGroupId,
                date: date,
            },
        });

    } catch (error) {
        console.error(
            `❌ [searchTerms] Error para campaign=${campaignId} adGroup=${adGroupId}:`,
            error.message
        );
        return [];
    }

    const validResults = results.filter((row) => {
        const term = row.search_term_view?.search_term;
        return term && typeof term === "string" && term.trim().length > 0;
    });

    if (validResults.length < results.length) {
        console.warn(
            `⚠️ [searchTerms] ${results.length - validResults.length
            } términos inválidos omitidos`
        );
    }

    return validResults.map((row) => ({
        campaign_id: campaignId,
        ad_group_id: adGroupId,
        search_term: row.search_term_view?.search_term || "",
        keyword_text: "",
        match_type: "UNKNOWN",
        impressions: parseInt(row.metrics?.impressions) || 0,
        clicks: parseInt(row.metrics?.clicks) || 0,
        ctr: parseFloat(row.metrics?.ctr) || 0,
        average_cpc: parseFloat(row.metrics?.average_cpc) || 0,
        cost_micros: parseInt(row.metrics?.cost_micros) || 0,
        conversions: parseFloat(row.metrics?.conversions) || 0,
    }));
}

export async function getCampaignsAndAdGroups(customer, customerId) {
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

export async function saveSearchTerms(customerId, searchTerms, date) {
    if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) {
        return;
    }

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

        const BATCH_SIZE = 100;

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
                } catch (termError) {
                    console.error(
                        `⚠️ Error guardando término "${term.search_term}":`,
                        termError.message
                    );
                }
            }

            if (i + BATCH_SIZE < searchTerms.length) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }

    } catch (error) {
        console.error("❌ Error guardando search terms:", error);
    }
}

