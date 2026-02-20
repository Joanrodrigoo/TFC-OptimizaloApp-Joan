import { logQueryError } from "./logger.js";
import pool from "../config/db.js";
import { googleAdsClient } from "../config/googleAds.js";

export const toNullIfUndefined = (value) => (value === undefined ? null : value);
export const toNumberOrNull = (value) => {
    if (value === undefined || value === null || isNaN(value)) return null;
    return Number(value);
};

// ✅ HELPER PARA STRINGIFY SEGURO (si no la tienes)
export function safeStringify(err) {
    if (!err) return "Error desconocido";
    if (typeof err === "string") return err;
    if (err.message) return err.message;

    try {
        return JSON.stringify(err, Object.getOwnPropertyNames(err));
    } catch (e) {
        return String(err);
    }
}

// ✅ FUNCIÓN AUXILIAR PARA CLASIFICAR ERRORES
export function classifyError(err, msg, code) {
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

export async function safeQuery(customerObj, query, opts = {}) {
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
                    `🔎 [${contextName}] customer=${clientInfo} date=${context.date || "N/A"
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

/**
 * Obtiene un cliente de Google Ads configurado para un customer_id específico
 * @param {string} customerId - El customer ID de Google Ads
 * @returns {Promise<Customer|null>} Cliente de Google Ads o null si no se encuentra
 */
export async function getGoogleAdsCustomer(customerId) {
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

        // console.log(`✅ Encontrado: ${accountname} (${customerid})`);

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
            // console.log(`   📝 Usando login_customer_id: ${parentaccountid}`);
        }

        // Usamos el cliente importado de la configuración
        const customer = googleAdsClient.Customer({
            customer_id: customerConfig.customer_id,
            refresh_token: customerConfig.refresh_token,
            login_customer_id: customerConfig.login_customer_id,
        });

        return customer;
    } catch (error) {
        console.error(`❌ Error obteniendo customer:`, error.message);
        return null;
    }
}

export function cleanCustomerId(id) {
    if (typeof id === "string" && id.startsWith("customers/")) {
        return id.split("/")[1];
    }
    return id;
}
