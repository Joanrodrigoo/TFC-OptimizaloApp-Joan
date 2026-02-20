import pool from "../config/db.js";
import { processPMaxForDate } from "./googleAds/pmaxService.js";
import { safeQuery, safeStringify } from "../utils/googleAdsHelpers.js";
import { fetchImagesByAdId, fetchCalloutsAndSitelinks } from "./googleAds/assetsService.js";
import { saveAdGroups, saveAds, saveKeywords, saveNegativeCampaignKeywords, fetchSearchTerms, saveSearchTerms } from "./googleAds/entitySyncService.js";
import { fetchAndSaveAudienceSegments, fetchAndSaveAudienceSegmentsForAdGroup } from "./googleAds/segmentsService.js";
import { saveCampaignLanguages, getCampaignLanguages, saveCampaignLocations, getCampaignLocations } from "./googleAds/campaignSettingsService.js";
import { saveCampaignMetricsHistory, savePmaxResourceMetrics } from "./googleAds/campaignMetricsService.js";

// ===========================================
// HELPERS LOCALES
// ===========================================
const toNum = (v) => (v == null || isNaN(v) ? 0 : Number(v));
const ctrPct = (clicks, impressions) =>
    impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0.0;
const safe = (v, fallback = null) => (v === undefined ? fallback : v);

const toNullIfUndefined = (value) => (value === undefined ? null : value);
const toNumberOrNull = (value) => {
    if (value === undefined || value === null || isNaN(value)) return null;
    return Number(value);
};

// ===========================================
// FUNCIONES EXPORTADAS
// ===========================================

export function getDatesInRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

export async function processSingleDay(
    customer,
    customerId,
    dateStr,
    endDate
) {
    console.log(`\nðŸ“… Procesando fecha: ${dateStr}`);

    try {
        // ===========================================
        // 1. CAMPAÃ‘AS (MODERNA)
        // ===========================================
        const queryCampaigns = `
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.bidding_strategy_type,
            campaign_budget.amount_micros,
            campaign.advertising_channel_type,
            metrics.cost_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.conversions,
            metrics.conversions_value,
            metrics.all_conversions,
            metrics.all_conversions_value,
            metrics.average_cpc,
            metrics.ctr,
            metrics.cost_per_conversion,
            metrics.value_per_all_conversions
            -- PMAX specific fields handled in processPMaxForDate
        FROM campaign
        -- WHERE segments.date = '${dateStr}'
        -- Eliminar WHERE date para traer todas, filtraremos por status si es necesario
        -- Para mÃ©tricas, SÃ necesitamos segments.date
        WHERE segments.date = '${dateStr}'
          AND campaign.status = 'ENABLED'
        `;

        const campaigns = await safeQuery(customer, queryCampaigns, {
            retries: 3,
            baseDelay: 1000,
            context: {
                name: "fetchCampaigns",
                customer_id: customerId,
                date: dateStr,
            },
        });

        if (campaigns && campaigns.length > 0) {
            console.log(`âœ… ${campaigns.length} campaÃ±as encontradas.`);
            await saveCampaignMetricsHistory(customerId, campaigns, dateStr);

            // ===========================================
            // 2. IDIOMAS Y UBICACIONES (Solo para campaÃ±as activas)
            // ===========================================
            for (const campaign of campaigns) {
                const campaignId = campaign.campaign.id;

                // Idiomas
                const languages = await getCampaignLanguages(customer, customerId, campaignId);
                await saveCampaignLanguages(customerId, campaignId, languages);

                // Ubicaciones
                const locations = await getCampaignLocations(customer, customerId, campaignId);
                await saveCampaignLocations(customerId, campaignId, locations);

                // Extensiones
                await fetchCalloutsAndSitelinks(customer, customerId, campaignId);
            }
        } else {
            console.log(`âš ï¸ No se encontraron campaÃ±as activas para ${dateStr}`);
        }

        // ===========================================
        // 3. AD GROUPS
        // ===========================================
        const queryAdGroups = `
        SELECT
            campaign.id,
            ad_group.id,
            ad_group.name,
            ad_group.status,
            ad_group.cpc_bid_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.cost_micros,
            metrics.average_cpc,
            metrics.conversions,
            metrics.conversions_value,
            metrics.all_conversions,
            metrics.all_conversions_value
        FROM ad_group
        WHERE segments.date = '${dateStr}'
          AND ad_group.status = 'ENABLED'
          AND campaign.status = 'ENABLED'
        `;

        const adGroups = await safeQuery(customer, queryAdGroups, {
            retries: 3,
            baseDelay: 1000,
            context: {
                name: "fetchAdGroups",
                customer_id: customerId,
                date: dateStr,
            },
        });

        if (adGroups && adGroups.length > 0) {
            console.log(`âœ… ${adGroups.length} grupos de anuncios encontrados.`);

            const formattedAdGroups = adGroups.map(row => ({
                campaign_id: row.campaign.id,
                ad_group_id: row.ad_group.id,
                ad_group_name: row.ad_group.name,
                status: row.ad_group.status,
                bid_micros: row.ad_group.cpc_bid_micros,
                impressions: row.metrics.impressions,
                clicks: row.metrics.clicks,
                ctr: row.metrics.ctr,
                cost_micros: row.metrics.cost_micros,
                average_cpc_micros: row.metrics.average_cpc,
                conversions: row.metrics.conversions,
                conversions_value: row.metrics.conversions_value,
                all_conversions: row.metrics.all_conversions,
                all_conversions_value: row.metrics.all_conversions_value
            }));

            await saveAdGroups(customerId, formattedAdGroups, dateStr);

            // Audiencias por AdGroup
            for (const ag of formattedAdGroups) {
                await fetchAndSaveAudienceSegmentsForAdGroup(
                    customer,
                    customerId,
                    ag.campaign_id,
                    ag.ad_group_id,
                    dateStr
                );

                // TÃ©rminos de bÃºsqueda
                const searchTerms = await fetchSearchTerms(
                    customer,
                    customerId,
                    ag.campaign_id,
                    ag.ad_group_id,
                    dateStr
                );
                await saveSearchTerms(customerId, searchTerms, dateStr);
            }
        }

        // ===========================================
        // 4. ANUNCIOS (ADS)
        // ===========================================
        if (adGroups && adGroups.length > 0) {
            console.log(`ðŸ”Ž Buscando anuncios para ${adGroups.length} grupos...`);

            // Agrupar por campaÃ±a para optimizar
            const adGroupsByCampaign = {};
            adGroups.forEach(ag => {
                const cid = ag.campaign.id;
                if (!adGroupsByCampaign[cid]) adGroupsByCampaign[cid] = [];
                adGroupsByCampaign[cid].push(ag.ad_group.id);
            });

            for (const [campaignId, groupIds] of Object.entries(adGroupsByCampaign)) {
                // Traer todos los anuncios de la campaÃ±a (filtrar por fecha en mÃ©tricas si es posible, 
                // pero ad_group_ad no soporta segments.date en todas las vistas. 
                // Usaremos ad_group_ad_asset_view o similar si necesitamos assets).
                // AquÃ­ usamos ad_group_ad standard.

                const queryAds = `
                SELECT
                    current_date,
                    campaign.id,
                    ad_group.id,
                    ad_group_ad.ad.id,
                    ad_group_ad.ad.name,
                    ad_group_ad.ad.final_urls,
                    ad_group_ad.ad.final_mobile_urls,
                    ad_group_ad.ad.display_url,
                    ad_group_ad.ad.type,
                    ad_group_ad.status,
                    
                    -- Responsive Search Ad fields
                    ad_group_ad.ad.responsive_search_ad.headlines,
                    ad_group_ad.ad.responsive_search_ad.descriptions,
                    ad_group_ad.ad.responsive_search_ad.path1,
                    ad_group_ad.ad.responsive_search_ad.path2,
                    
                    -- Metrics
                    metrics.impressions,
                    metrics.clicks,
                    metrics.ctr,
                    metrics.average_cpc,
                    metrics.cost_micros,
                    metrics.conversions,
                    metrics.conversions_value,
                    metrics.all_conversions,
                    metrics.all_conversions_value
                FROM ad_group_ad
                WHERE segments.date = '${dateStr}'
                  AND campaign.id = ${campaignId}
                  AND ad_group_ad.status = 'ENABLED'
                `;

                const ads = await safeQuery(customer, queryAds, {
                    retries: 3,
                    baseDelay: 1000,
                    context: {
                        name: "fetchAds",
                        customer_id: customerId,
                        date: dateStr,
                    },
                });

                if (ads && ads.length > 0) {
                    // Procesar y guardar
                    // Agrupar por AdGroup para saveAds
                    const adsByGroup = {};
                    ads.forEach(row => {
                        const gid = row.ad_group.id;
                        if (!adsByGroup[gid]) adsByGroup[gid] = [];

                        // Mapear a formato esperado por saveAds
                        const adObj = {
                            ad_id: row.ad_group_ad.ad.id,
                            name: row.ad_group_ad.ad.name,
                            ad_type: row.ad_group_ad.ad.type,
                            status: row.ad_group_ad.status,
                            final_urls: row.ad_group_ad.ad.final_urls,
                            final_mobile_urls: row.ad_group_ad.ad.final_mobile_urls,
                            display_url: row.ad_group_ad.ad.display_url,
                            path1: row.ad_group_ad.ad.responsive_search_ad?.path1,
                            path2: row.ad_group_ad.ad.responsive_search_ad?.path2,

                            // Metrics
                            impressions: row.metrics.impressions,
                            clicks: row.metrics.clicks,
                            ctr: row.metrics.ctr,
                            average_cpc: row.metrics.average_cpc,
                            cost_micros: row.metrics.cost_micros,
                            conversions: row.metrics.conversions,
                            conversions_value: row.metrics.conversions_value,
                            all_conversions: row.metrics.all_conversions,
                            all_conversions_value: row.metrics.all_conversions_value,

                            // Assets (Headlines/Desc)
                            assets: []
                        };

                        // Helper para assets
                        if (row.ad_group_ad.ad.responsive_search_ad) {
                            const rsa = row.ad_group_ad.ad.responsive_search_ad;
                            if (rsa.headlines) {
                                rsa.headlines.forEach(h => {
                                    adObj.assets.push({ asset_type: 'HEADLINE', asset_value: h.text });
                                });
                            }
                            if (rsa.descriptions) {
                                rsa.descriptions.forEach(d => {
                                    adObj.assets.push({ asset_type: 'DESCRIPTION', asset_value: d.text });
                                });
                            }
                        }

                        adsByGroup[gid].push(adObj);
                    });

                    for (const [gid, groupAds] of Object.entries(adsByGroup)) {
                        await saveAds(customerId, campaignId, dateStr, gid, groupAds);

                        // Descargar imÃ¡genes de los anuncios (si las hay)
                        const imagesByAd = await fetchImagesByAdId(customer, customerId);
                        // Esto descarga para TODA la cuenta? optimize
                        // fetchImagesByAdId en googleAdsService hace query global. 
                        // DeberÃ­amos optimizarlo pero por ahora lo dejamos como estÃ¡.
                    }
                }
            }
        }

        // ===========================================
        // 5. KEYWORDS
        // ===========================================
        if (adGroups && adGroups.length > 0) {
            console.log(`ðŸ”Ž Buscando keywords...`);

            const queryKeywords = `
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
                metrics.average_cpc,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.all_conversions,
                metrics.all_conversions_value,
                ad_group_criterion.quality_info.quality_score
            FROM keyword_view
            WHERE segments.date = '${dateStr}'
              AND ad_group_criterion.status = 'ENABLED'
            `;

            const keywords = await safeQuery(customer, queryKeywords, {
                retries: 3,
                baseDelay: 1000,
                context: {
                    name: "fetchKeywords",
                    customer_id: customerId,
                    date: dateStr,
                },
            });

            if (keywords && keywords.length > 0) {
                const formattedKeywords = keywords.map(row => ({
                    campaign_id: row.campaign.id,
                    ad_group_id: row.ad_group.id,
                    criterion_id: row.ad_group_criterion.criterion_id,
                    keyword_text: row.ad_group_criterion.keyword.text,
                    match_type: row.ad_group_criterion.keyword.match_type,
                    is_negative: row.ad_group_criterion.negative,
                    status: row.ad_group_criterion.status,
                    impressions: row.metrics.impressions,
                    clicks: row.metrics.clicks,
                    ctr: row.metrics.ctr,
                    average_cpc_micros: row.metrics.average_cpc,
                    cost_micros: row.metrics.cost_micros,
                    conversions: row.metrics.conversions,
                    conversions_value: row.metrics.conversions_value,
                    all_conversions: row.metrics.all_conversions,
                    all_conversions_value: row.metrics.all_conversions_value,
                    quality_score: row.ad_group_criterion.quality_info?.quality_score
                }));

                await saveKeywords(customerId, formattedKeywords, dateStr);
            }
        }

        // ===========================================
        // 6. NEGATIVE KEYWORDS (CAMPAIGN LEVEL)
        // ===========================================
        // Se hace una vez, no por fecha, pero podemos actualizar status
        // Para simplificar, lo hacemos aquÃ­.
        const queryNegatives = `
        SELECT
            campaign.id,
            campaign_criterion.criterion_id,
            campaign_criterion.keyword.text,
            campaign_criterion.keyword.match_type,
            campaign_criterion.status
        FROM campaign_criterion
        WHERE campaign_criterion.type = 'KEYWORD'
          AND campaign_criterion.negative = TRUE
          AND campaign.status = 'ENABLED'
        `;

        const negatives = await safeQuery(customer, queryNegatives, {
            retries: 3,
            baseDelay: 1000,
            context: {
                name: "fetchNegativeKeywords",
                customer_id: customerId,
                date: dateStr,
            },
        });

        if (negatives && negatives.length > 0) {
            const formattedNegatives = negatives.map(row => ({
                campaign_id: row.campaign.id,
                criterion_id: row.campaign_criterion.criterion_id,
                keyword_text: row.campaign_criterion.keyword.text,
                match_type: row.campaign_criterion.keyword.match_type,
                status: row.campaign_criterion.status,
                is_negative: true,
                date: dateStr
            }));
            await saveNegativeCampaignKeywords(customerId, formattedNegatives, dateStr);
        }

        // ===========================================
        // 7. PERFORMANCE MAX
        // ===========================================
        // Procesamos PMAX con la funciÃ³n dedicada
        await processPMaxForDate(customer, customerId, dateStr, pool);

        console.log(`âœ… Fecha ${dateStr} procesada correctamente.`);
        return true;

    } catch (error) {
        console.error(`âŒ Error en processSingleDay para ${dateStr}:`, error);
        throw error;
    }
}
