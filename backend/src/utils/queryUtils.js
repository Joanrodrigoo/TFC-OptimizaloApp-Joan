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

export function classifyError(err, msg, code) {
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

function logQueryError(context, query, processError, customerObj) {
    console.error(`[Error in query: ${context?.name}]`, processError.message);
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
                // console.log(`🔎 [${contextName}] customer=${clientInfo} date=${context.date || "N/A"}`);
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
