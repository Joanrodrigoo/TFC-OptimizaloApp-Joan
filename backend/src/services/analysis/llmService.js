import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// ─── Gemini (demo alternativo) ───────────────────────────────────────────────
import { GoogleGenerativeAI } from "@google/generative-ai";
import { demoConfig } from "../../config/demoConfig.js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Inicializar Gemini solo si la API key está configurada
let geminiModel = null;
if (process.env.GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        console.log("✅ Gemini AI inicializado correctamente");
    } catch (e) {
        console.warn("⚠️ No se pudo inicializar Gemini:", e.message);
    }
}

/**
 * Strip fences from markdown strings
 */
export function stripFences(s = "") {
    return s
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
}

/**
 * Extract JSON from raw LLM response
 */
export function extractJson(raw) {
    if (!raw) throw new Error("Respuesta vacía");
    const trimmed = raw.trim();
    const fenceMatch =
        trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ||
        trimmed.match(/```\s*([\s\S]*?)\s*```/);
    return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Normalize recommendation object
 */
export function normalizeRec(r) {
    if (!r) return null;
    const requireCheck = [
        "titulo",
        "descripcion",
        "tipo_objeto",
    ];
    for (const k of requireCheck) {
        if (
            r[k] === undefined ||
            r[k] === null ||
            (typeof r[k] === "string" && r[k].trim() === "")
        ) {
            // We'll log a warning instead of throwing to prevent failing everything due to one bad rec
            console.warn(`Campo requerido faltante: ${k} en la recomendacion`, r);
            return null;
        }
    }
    return {
        titulo: String(r.titulo || "").slice(0, 255),
        descripcion: String(r.descripcion || "").slice(0, 65535),
        categoria: String(r.categoria || inferCategoria(r.tipo_objeto || r.tipo_entidad)).slice(0, 50),
        prioridad: String(r.prioridad || "media").toLowerCase().slice(0, 20),
        impacto_estimado: String(r.impacto_estimado || "").slice(0, 100),
        tipo_objeto: String(r.tipo_objeto || r.tipo_entidad || "").slice(0, 50),
        objeto_id: String(r.objeto_id || "").slice(0, 100),
    };
}

/**
 * Infer category if not provided by LLM
 */
export function inferCategoria(tipoObjeto) {
    const mapeo = {
        campaign: "estructura",
        adgroup: "estructura",
        ad_group: "estructura",
        ad: "anuncios",
        keyword: "keywords",
        audience_segment: "segmentacion",
        segmento_audiencia: "segmentacion",
        pmax_campaign: "estructura",
        pmax_asset_group: "estructura",
        pmax_asset: "anuncios",
        asset: "anuncios",
    };

    return mapeo[tipoObjeto] || "otros";
}

/**
 * Call OpenAI LLM
 */
export async function callLLM({
    name,
    system,
    payload,
    model = "gpt-4o-mini",
    temperature = 0.2,
}) {
    const messages = [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
    ];
    try {
        const cmp = await openai.chat.completions.create({
            model,
            temperature,
            messages,
        });
        const raw = cmp?.choices?.[0]?.message?.content?.trim() || "[]";
        let parsed = [];
        try {
            parsed = JSON.parse(stripFences(raw));
            if (!Array.isArray(parsed)) parsed = [];
        } catch (e) {
            console.error(`${name} JSON parse error`, e, raw.slice(0, 500));
            parsed = [];
        }
        return { arr: parsed, usage: cmp?.usage || {} };
    } catch (error) {
        console.error(`Error in callLLM for ${name}:`, error.message);
        throw error;
    }
}

/**
 * Call Gemini LLM (alternativa gratuita para demo/presentación)
 * Misma firma que callLLM para ser completamente intercambiable.
 */
export async function callGemini({ name, system, payload, temperature = 0.2 }) {
    if (!geminiModel) {
        console.error("❌ Gemini no está inicializado. Verifica GEMINI_API_KEY en .env");
        throw new Error("GEMINI_API_KEY no configurada o inválida");
    }

    // Gemini usa un prompt único combinando system + datos de usuario
    const prompt = `${system}\n\n--- DATOS A ANALIZAR ---\n${JSON.stringify(payload)}`;

    try {
        const result = await geminiModel.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature },
        });

        const raw = result.response.text()?.trim() || "[]";
        let parsed = [];
        try {
            parsed = JSON.parse(stripFences(raw));
            if (!Array.isArray(parsed)) parsed = [];
        } catch (e) {
            console.error(`${name} Gemini JSON parse error`, e.message, raw.slice(0, 300));
            parsed = [];
        }

        return {
            arr: parsed,
            usage: { provider: "gemini", model: "gemini-2.0-flash" },
        };
    } catch (error) {
        console.error(`Error in callGemini for ${name}:`, error.message);
        throw error;
    }
}

/**
 * Router de IA: usa OpenAI o Gemini según LLM_PROVIDER en .env
 * Este es el punto de entrada que deben usar todas las rutas de análisis.
 */
export async function callAI(params) {
    const provider = demoConfig.llmProvider;
    console.log(`🤖 Proveedor IA activo: ${provider.toUpperCase()}`);

    if (provider === "gemini") {
        return callGemini(params);
    }
    return callLLM(params);
}

/**
 * Reconstructed: Save recommendations to database
 */
export async function saveRecommendationsToDB({ pool, customerId, llmRawResponse }) {
    let recommendations = [];
    try {
        recommendations = JSON.parse(llmRawResponse);
    } catch (e) {
        console.error("Error parsing llmRawResponse inside saveRecommendationsToDB", e.message);
        return { inserted: 0, duplicates: 0 };
    }

    if (!recommendations || recommendations.length === 0) return { inserted: 0, duplicates: 0 };

    const conn = await pool.getConnection();
    let inserted = 0;
    let duplicates = 0;

    try {
        for (const rec of recommendations) {
            const normalized = normalizeRec(rec);
            if (!normalized) continue;

            const category = normalized.categoria || inferCategoria(normalized.tipo_objeto);

            // Check for duplicates
            const [existing] = await conn.execute(
                `SELECT id FROM recomendaciones 
         WHERE customer_id = ? AND tipo_objeto = ? AND objeto_id = ? AND titulo = ? AND estado IN ('activa', 'pendiente')`,
                [customerId, normalized.tipo_objeto, normalized.objeto_id, normalized.titulo]
            );

            if (existing.length > 0) {
                duplicates++;
                continue;
            }

            await conn.execute(
                `INSERT INTO recomendaciones (
          customer_id, titulo, descripcion, categoria, prioridad, impacto_estimado, tipo_objeto, objeto_id, estado, fecha_creacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', NOW())`,
                [
                    customerId,
                    normalized.titulo,
                    normalized.descripcion,
                    category,
                    normalized.prioridad,
                    normalized.impacto_estimado,
                    normalized.tipo_objeto,
                    normalized.objeto_id
                ]
            );
            inserted++;
        }
        return { inserted, duplicates };
    } catch (err) {
        console.error("Error inside saveRecommendationsToDB execution loop:", err);
        throw err;
    } finally {
        conn.release();
    }
}
