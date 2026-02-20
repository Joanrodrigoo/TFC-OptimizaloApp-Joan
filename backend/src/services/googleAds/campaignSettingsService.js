import pool from "../../config/db.js";
import { safeQuery } from "../../utils/googleAdsHelpers.js";

export async function getCampaignLanguages(customer, customerId, campaignId) {
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

export async function saveCampaignLanguages(customerId, campaignId, languages) {
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

export async function getCampaignLocations(customer, customerId, campaignId) {
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

export async function saveCampaignLocations(customerId, campaignId, locations) {
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
}

