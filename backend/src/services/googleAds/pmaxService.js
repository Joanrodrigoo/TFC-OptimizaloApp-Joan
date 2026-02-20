import pool from "../../config/db.js";
import { safeQuery } from "../../utils/googleAdsHelpers.js";

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

export async function processPMaxForDate(customer, customer_id, date, poolRef) {
    // Nota: poolRef se ignora si usamos el importado, pero processPMaxForDate recibía pool
    // Usaremos el imported 'pool' si poolRef no se usa o es el mismo.
    // El código original usaba 'pool' del closure.

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
          conversion_rate = VALUES(conversion_rate),
          cost_per_conversion_micros = VALUES(cost_per_conversion_micros),
          all_conversions = VALUES(all_conversions),
          value_per_all_conversions = VALUES(value_per_all_conversions),
          updated_at = CURRENT_TIMESTAMP`,
                [
                    customer_id,
                    c.campaign.id,
                    c.campaign.name,
                    c.campaign.status,
                    c.campaign.advertising_channel_type,
                    date,
                    c.metrics?.impressions || 0,
                    c.metrics?.clicks || 0,
                    c.metrics?.ctr || 0,
                    c.metrics?.average_cpc || 0,
                    c.metrics?.cost_micros || 0,
                    c.metrics?.conversions || 0,
                    c.metrics?.conversions_from_interactions_rate || 0,
                    c.metrics?.cost_per_conversion || 0,
                    c.metrics?.all_conversions || 0,
                    c.metrics?.value_per_all_conversions || 0,
                    c.campaign_budget?.amount_micros || 0,
                    c.campaign.bidding_strategy_type || "UNKNOWN",
                ]
            );
        }

        // ✅ 3️⃣ Asset Groups
        console.log(`📊 Paso 2: Obteniendo Asset Groups...`);
        const campaignIdsStr = campaigns.map((c) => c.campaign.id).join(",");

        const queryGroups = `
      SELECT
        asset_group.id,
        asset_group.campaign,
        asset_group.name,
        asset_group.status,
        asset_group.ad_strength
      FROM asset_group
      WHERE campaign.id IN (${campaignIdsStr})
        AND asset_group.status != 'REMOVED'
    `;

        const assetGroups = await safeQuery(customer, queryGroups, {
            retries: 3,
            baseDelay: 500,
            context: {
                name: "pmax_asset_groups",
                customer_id: customer_id,
                date: date,
            },
        });

        const assetGroupIds = [];
        const assetGroupToCampaign = {};

        if (assetGroups && assetGroups.length > 0) {
            console.log(`✅ ${assetGroups.length} Asset Groups encontrados`);
            result.assetGroupsCount = assetGroups.length;

            for (const ag of assetGroups) {
                assetGroupIds.push(ag.asset_group.id);
                // Extraer ID de campaña "customers/X/campaigns/Y"
                const campMatch = ag.asset_group.campaign.match(/campaigns\/(\d+)/);
                const campId = campMatch ? campMatch[1] : null;

                if (campId) {
                    assetGroupToCampaign[ag.asset_group.id] = campId;

                    await pool.query(
                        `INSERT INTO pmax_asset_groups (
              customer_id, campaign_id, asset_group_id,
              name, status, ad_strength
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              status = VALUES(status),
              ad_strength = VALUES(ad_strength)`,
                        [
                            customer_id,
                            campId,
                            ag.asset_group.id,
                            ag.asset_group.name,
                            ag.asset_group.status,
                            ag.asset_group.ad_strength || "UNKNOWN",
                        ]
                    );
                }
            }
        }

        // ✅ 4️⃣ Assets
        if (assetGroupIds.length > 0) {
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
                `📊 Con métricas: ${metricsMap.size}, sin métricas: ${assetsGuardados - metricsMap.size
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
