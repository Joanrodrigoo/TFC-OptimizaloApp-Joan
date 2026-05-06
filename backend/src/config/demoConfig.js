// config/demoConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// Configuración central del modo demo.
// Controla qué funcionalidades se simulan durante la presentación del TFGS.
// Activar/desactivar desde el .env: DEMO_MODE=true | false
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_MODE = process.env.DEMO_MODE === "true";

export const demoConfig = {
    // ¿Está activo el modo demo?
    enabled: DEMO_MODE,

    // Proveedor de IA: 'openai' | 'gemini'
    // En demo usa Gemini (gratuito), en producción usa OpenAI
    llmProvider: process.env.LLM_PROVIDER || (DEMO_MODE ? "gemini" : "openai"),

    // Customer ID del seed de datos de demo
    // Debe coincidir con el customer_id del script SQL de seed
    demoCostumerId: "1234567890",

    // Duración en ms de la sincronización simulada (60 segundos por defecto)
    syncDurationMs: 60_000,

    // Intervalo en ms entre actualizaciones de progreso de la sync simulada
    syncStepMs: 10_000,

    // Número de tareas semanales que se crean en la sync simulada
    // (simula que se está descargando historial de N semanas)
    syncWeeks: 6,
};

export default demoConfig;
