import express from "express";
import pool from "../config/db.js";
import syncQueue from "../services/syncAccounts/syncQueueInstance.js";
import {
    createSyncTasks,
    createDailyTask,
    getSyncStatus
} from "../services/syncAccounts/syncUtils.js";

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

export default router;
