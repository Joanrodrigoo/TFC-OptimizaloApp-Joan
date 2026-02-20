import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// Endpoint para obtener días disponibles
router.get("/fechas-con-datos/:customerId", async (req, res) => {
    const { customerId } = req.params;

    try {
        const [rows] = await pool.execute(
            `
      SELECT date
      FROM campaign_metrics_history
      WHERE customer_id = ?
        AND date <= CURDATE()
      GROUP BY date
      ORDER BY date
      `,
            [customerId]
        );

        const fechas = rows.map((r) => r.date); // Array de strings "YYYY-MM-DD"
        res.json({ fechas });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al obtener fechas" });
    }
});

router.get("/google-accounts", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "No autenticado" });
    }

    const userId = req.session.user.id;

    try {
        const [rows] = await pool.execute(
            `SELECT DISTINCT a.customer_id, a.name, a.is_mcc,parent_account_id
       FROM accounts a
        JOIN tokens t
        ON t.user_id = ?
       WHERE a.customer_id = t.customer_id
          OR a.parent_account_id = t.customer_id`,
            [userId]
        );

        const transformedAccounts = rows.map((row) => ({
            id: row.customer_id,
            accountId: row.customer_id,
            accountName: row.name,
            accountType: row.is_mcc ? "MCC" : "STANDARD",
            connected: true, // Asume conectada para probar
            lastSyncedAt: null,
            parentAccountId: row.parent_account_id,
        }));

        res.json({ accounts: transformedAccounts });
    } catch (err) {
        console.error("Error al obtener cuentas:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

export default router;
