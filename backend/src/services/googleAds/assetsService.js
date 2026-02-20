import pool from "../../config/db.js";

export async function fetchCalloutsAndSitelinks(customer, customerId, campaignId) {
    const callouts = new Set();
    const sitelinks = new Map();

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

export async function fetchImagesByAdId(customer, customerId) {
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

export async function saveAdAssetsHistoryBulk(customerId, assets) {
    if (!assets.length) return;

    try {
        for (const asset of assets) {
            await pool.execute(
                `INSERT INTO ad_assets_history
    (customer_id, campaign_id, ad_group_id, ad_id, ad_row_id, date, asset_type, asset_value, date_recorded, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    asset.customer_id,
                    asset.campaign_id,
                    asset.ad_group_id,
                    asset.ad_id,
                    asset.ad_row_id,
                    asset.date,
                    asset.asset_type,
                    asset.asset_value,
                    asset.date_recorded,
                ]
            );
        }
    } catch (error) {
        console.error("❌ Error guardando assets de anuncio:", error);
        throw error;
    }
}

