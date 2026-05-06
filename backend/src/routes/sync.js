import express from "express";
import pool from "../config/db.js";
import syncQueue from "../services/syncAccounts/syncQueueInstance.js";
import {
    createSyncTasks,
    createDailyTask,
    getSyncStatus
} from "../services/syncAccounts/syncUtils.js";
import { demoConfig } from "../config/demoConfig.js";


const router = express.Router();

// ENDPOINT PARA VER ESTADO DE LA COLA GLOBAL
router.get("/queue-status", (req, res) => {
    try {
        const status = syncQueue.getStatus();
        res.status(200).json(status);
    } catch (error) {
        console.error("❌ Error obteniendo estado de cola:", error);
        res.status(500).json({ error: "Error interno", details: error.message });
    }
});

router.post("/start-daily-sync", async (req, res) => {
    try {
        const { customerId } = req.body;

        if (!customerId) {
            return res.status(400).json({ error: "Customer ID es requerido" });
        }

        // Crear tarea diaria
        const result = await createDailyTask(pool, customerId);

        // Si la cola no está corriendo y se creó la tarea, iniciarla
        if (!syncQueue.isRunning && result.created) {
            syncQueue.start().catch((err) => {
                console.error("❌ Error en cola de sincronización:", err);
            });
        }

        const status = syncQueue.getStatus();

        return res.status(200).json({
            message: result.created ? "Tarea diaria programada" : result.message,
            customerId,
            taskResult: result,
            queueStatus: status,
        });
    } catch (error) {
        console.error("❌ Error en start-daily-sync:", error);
        res.status(500).json({ error: "Error interno", details: error.message });
    }
});

router.post("/start-sync", async (req, res) => {
    try {
        if (syncQueue.isRunning) {
            return res.status(400).json({
                error: "La sincronización ya está en ejecución",
                status: syncQueue.getStatus(),
            });
        }

        // Iniciar procesamiento asíncrono
        syncQueue.start().catch((err) => {
            console.error("❌ Error en cola de sincronización:", err);
        });

        res.status(200).json({
            message: "Sincronización iniciada",
            status: syncQueue.getStatus(),
        });
    } catch (error) {
        console.error("❌ Error iniciando sincronización:", error);
        res.status(500).json({ error: "Error interno", details: error.message });
    }
});

router.post("/stop-sync", (req, res) => {
    try {
        syncQueue.stop();
        res.status(200).json({
            message: "Sincronización detenida",
            status: syncQueue.getStatus(),
        });
    } catch (error) {
        console.error("❌ Error deteniendo sincronización:", error);
        res.status(500).json({ error: "Error interno", details: error.message });
    }
});

router.post("/start-account-sync", async (req, res) => {
    try {
        const { customerId } = req.body;

        if (!customerId) {
            return res.status(400).json({ error: "Customer ID es requerido" });
        }

        // Crear tareas de sincronización
        const result = await createSyncTasks(pool, customerId);

        // Si la cola no está corriendo, iniciarla
        if (!syncQueue.isRunning && result.created) {
            syncQueue.start().catch((err) => {
                console.error("❌ Error en cola de sincronización:", err);
            });
        }

        const status = syncQueue.getStatus();

        return res.status(200).json({
            message: result.created
                ? "Cuenta programada para sincronización"
                : result.message,
            customerId,
            taskResult: result,
            queueStatus: status,
        });
    } catch (error) {
        console.error("❌ Error en start-account-sync:", error);
        res.status(500).json({ error: "Error interno", details: error.message });
    }
});

router.get("/sync-status/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;

        const [queueTasks] = await pool.execute(
            `
      SELECT 
        COUNT(*) as totalTasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM sync_queue
      WHERE customer_id = ?
      `,
            [customerId]
        );

        const queueInfo = queueTasks[0];

        const isCompleted =
            queueInfo.pending === 0 &&
            queueInfo.processing === 0 &&
            queueInfo.failed === 0;

        const queueStatus = syncQueue.getStatus();
        const isProcessing = queueStatus.processingAccounts.includes(customerId);

        res.status(200).json({
            customerId,

            // Información de tareas (1 tarea = 1 semana)
            totalTasks: queueInfo.totalTasks,
            completed: queueInfo.completed,
            processing: queueInfo.processing,
            pending: queueInfo.pending,
            failed: queueInfo.failed,

            isCompleted,
            isCurrentlyProcessing: isProcessing,

            queueStatus: {
                isRunning: queueStatus.isRunning,
                totalProcessing: queueStatus.processingCount,
                maxConcurrent: queueStatus.maxConcurrent,
            },
        });
    } catch (error) {
        console.error("❌ Error obteniendo estado:", error);
        res.status(500).json({ error: "Error interno", details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DEMO MODE: Sincronización Simulada
// Inserta tareas en sync_queue y las marca como completadas progresivamente
// para que el SyncProgressBar del frontend muestre la barra de progreso real.
// No llama a ninguna API externa.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/start-demo-sync", async (req, res) => {
    if (!demoConfig.enabled) {
        return res.status(403).json({ error: "Demo mode no está activado. Pon DEMO_MODE=true en .env" });
    }

    const { customerId } = req.body;
    if (!customerId) {
        return res.status(400).json({ error: "customerId es requerido" });
    }

    try {
        // 1. Limpiar tareas anteriores de este customer para evitar conflictos
        await pool.execute(
            "DELETE FROM sync_queue WHERE customer_id = ? AND status IN ('pending', 'failed')",
            [customerId]
        );

        // 2. Insertar N tareas semanales en estado 'pending'
        const weeks = demoConfig.syncWeeks;
        const now = new Date();
        const insertedIds = [];

        for (let i = 0; i < weeks; i++) {
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() - i * 7);
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6);

            const startStr = startDate.toISOString().slice(0, 10);
            const endStr = endDate.toISOString().slice(0, 10);

            try {
                const [result] = await pool.execute(
                    `INSERT IGNORE INTO sync_queue
                     (customer_id, start_date, end_date, week_number, task_type, status, attempts)
                     VALUES (?, ?, ?, ?, 'weekly', 'pending', 0)`,
                    [customerId, startStr, endStr, i + 1]
                );
                if (result.insertId) insertedIds.push(result.insertId);
            } catch (insertErr) {
                // Ignorar duplicados (UNIQUE constraint)
            }
        }

        // 3. Completar las tareas progresivamente en background
        //    Una cada stepMs milisegundos → simula el progreso en la barra
        const stepMs = Math.floor(demoConfig.syncDurationMs / Math.max(weeks, 1));

        (async () => {
            for (let i = 0; i < insertedIds.length; i++) {
                await new Promise(resolve => setTimeout(resolve, stepMs));
                try {
                    await pool.execute(
                        `UPDATE sync_queue
                         SET status = 'completed', completed_at = NOW(), started_at = DATE_SUB(NOW(), INTERVAL ? SECOND)
                         WHERE id = ?`,
                        [Math.floor(stepMs / 1000), insertedIds[i]]
                    );
                    console.log(`📊 [DEMO SYNC] Semana ${i + 1}/${insertedIds.length} completada`);
                } catch (updateErr) {
                    console.error(`❌ [DEMO SYNC] Error actualizando tarea ${insertedIds[i]}:`, updateErr.message);
                }
            }
            console.log("✅ [DEMO SYNC] Sincronización simulada completada");
        })();

        // 4. Responder inmediatamente para que el frontend empiece a pollear
        return res.status(200).json({
            message: "Sincronización demo iniciada",
            customerId,
            weeks,
            stepMs,
            totalDurationMs: demoConfig.syncDurationMs,
        });

    } catch (error) {
        console.error("❌ Error en start-demo-sync:", error);
        return res.status(500).json({ error: "Error interno", details: error.message });
    }
});

export default router;
