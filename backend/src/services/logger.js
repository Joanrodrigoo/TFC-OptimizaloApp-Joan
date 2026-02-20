import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
// We go up two levels from src/services to root, then into logs
const logsDir = path.join(__dirname, "../../logs");

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function getLogFilename(type) {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return path.join(logsDir, `${type}-${today}.log`);
}

export function writeToLog(type, data) {
    try {
        const timestamp = new Date().toISOString();
        const logFile = getLogFilename(type);
        const logEntry = `
${"=".repeat(80)}
[${timestamp}]
${typeof data === "object" ? JSON.stringify(data, null, 2) : data}
${"=".repeat(80)}

`;
        fs.appendFileSync(logFile, logEntry, "utf8");
    } catch (error) {
        console.error("Error escribiendo log:", error);
    }
}

export function logQueryError(context, query, error, customerObj) {
    const errorData = {
        timestamp: new Date().toISOString(),
        context: {
            name: context.name || "unknown",
            customer_id:
                context.customer_id ||
                customerObj?.customer_id ||
                customerObj?.customerId ||
                "unknown",
            campaign_id: context.campaign_id || null,
            ad_group_id: context.ad_group_id || null,
            date: context.date || null,
        },
        query: query.substring(0, 500) + (query.length > 500 ? "..." : ""), // Limitar tamaño
        error: {
            message: error.message || String(error),
            code: error.code || null,
            type: error.constructor.name,
            stack: error.stack ? error.stack.substring(0, 1000) : null,
        },
    };

    writeToLog("google-ads-query-errors", errorData);
    return errorData;
}

export function logSyncError(customerId, phase, error, additionalData = {}) {
    const errorData = {
        timestamp: new Date().toISOString(),
        customer_id: customerId,
        phase,
        error: {
            message: error.message || String(error),
            code: error.code || null,
            type: error.constructor.name,
            stack: error.stack ? error.stack.substring(0, 1000) : null,
        },
        ...additionalData,
    };

    writeToLog("sync-errors", errorData);
}
