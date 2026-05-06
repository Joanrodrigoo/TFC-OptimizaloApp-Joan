import express from "express";
import { OAuth2Client } from "google-auth-library";
import { GoogleAdsApi } from "google-ads-api";
import pool from "../config/db.js";
import { safeQuery, cleanCustomerId } from "../utils/googleAdsHelpers.js";
import { createSyncTasks } from "../services/syncAccounts/syncUtils.js";
import syncQueue from "../services/syncAccounts/syncQueueInstance.js";
import analysisQueue from "../services/analysisQueue/analysisQueueInstance.js";

const router = express.Router();

// Google OAuth
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


// Adaptado de app.get a router.get
router.get("/auth", (req, res) => {
  const scopes = ["https://www.googleapis.com/auth/adwords"];

  const state = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  req.session.oauth_state = state;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    redirect_uri: process.env.REDIRECT_URI || "https://optimizalo.app/oauth2callback",
    state,
  });

  res.redirect(authUrl);
});

// ==========================
// AUTENTICACIÓN GOOGLE ADS - CALLBACK MEJORADO
// ==========================

router.get("/oauth2callback", async (req, res) => {
  try {
    const oauthCode = req.query.code;
    const returnedState = req.query.state;
    const expectedState = req.session?.oauth_state;

    console.log("🔑 Código recibido en callback:", oauthCode);
    console.log("🛡️ Validando state:", returnedState, "vs", expectedState);

    if (!returnedState || returnedState !== expectedState) {
      return res
        .status(400)
        .send("❌ Estado inválido o caducado. Intenta conectar de nuevo.");
    }

    delete req.session.oauth_state;

    if (!req.session || !req.session.user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login`);
    }

    const userId = req.session.user.id;
    console.log("🧑‍💻 Usuario en sesión:", req.session.user);

    let tokens;
    try {
      const result = await oauth2Client.getToken({
        code: oauthCode,
        redirect_uri: process.env.REDIRECT_URI || "https://optimizalo.app/oauth2callback",
      });
      tokens = result.tokens;
      oauth2Client.setCredentials(tokens);
    } catch (error) {
      console.error(
        "❌ Error al intercambiar el code por token:",
        error.response?.data || error.message
      );
      return res
        .status(400)
        .send(
          "Error en el intercambio de token: " +
          (error.response?.data?.error_description || error.message)
        );
    }

    const refresh_token = tokens.refresh_token;
    if (!refresh_token) {
      return res.status(400).send("❌ No se recibió refresh_token");
    }

    const expiry_date = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : null;

    const apiClient = new GoogleAdsApi({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_DEVELOPER_TOKEN,
    });

    const accessible = await apiClient.listAccessibleCustomers(refresh_token);
    const customerIdList = accessible.resource_names.map((resource) =>
      resource.split("/").pop()
    );

    if (!customerIdList.length) {
      return res.status(400).send("❌ No se encontraron cuentas accesibles.");
    }

    // ✅ SIN CONEXIÓN PERSISTENTE - Usar pool.execute directamente
    const cuentasConectadas = [];
    const cuentasParaSincronizar = [];

    for (const customer_id of customerIdList) {
      const customerIdClean = cleanCustomerId(customer_id);

      try {
        const customer = apiClient.Customer({
          customer_id,
          refresh_token,
        });

        // ✅ CORREGIDO: Con contexto completo
        const infoResult = await safeQuery(
          customer,
          `
          SELECT customer.id, customer.descriptive_name, customer.manager
          FROM customer
          LIMIT 1
          `,
          {
            retries: 1,
            baseDelay: 300,
            throwOnError: false,
            context: {
              name: "oauth_customer_info",
              customer_id: customerIdClean,
              date: null,
            },
          }
        );

        // Si no se pudo obtener info, saltar esta cuenta
        if (!infoResult || infoResult.length === 0) {
          console.warn(
            `⚠️ No se pudo acceder a ${customerIdClean}: Sin datos disponibles`
          );
          continue;
        }

        const info = infoResult[0];
        const is_mcc = info.customer?.manager ? 1 : 0;
        const nombre =
          info.customer?.descriptive_name || `Account ${customerIdClean}`;

        // ✅ Guardar en tokens (usando pool.execute - conexión automática corta)
        await pool.execute(
          `INSERT INTO tokens (user_id, refresh_token, customer_id, is_mcc, access_token_expiry)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE refresh_token = ?, is_mcc = ?, access_token_expiry = ?`,
          [
            userId,
            refresh_token,
            customerIdClean,
            is_mcc,
            expiry_date,
            refresh_token,
            is_mcc,
            expiry_date,
          ]
        );

        // ✅ Guardar en accounts (usando pool.execute - conexión automática corta)
        await pool.execute(
          `INSERT INTO accounts (customer_id, name, is_mcc, parent_account_id)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = ?, is_mcc = ?`,
          [customerIdClean, nombre, is_mcc, null, nombre, is_mcc]
        );

        if (is_mcc) {
          cuentasConectadas.push(`${nombre} (MCC) - ${customerIdClean}`);
          console.log(
            `🏢 Consultando subcuentas de MCC ${customerIdClean} (${nombre})...`
          );

          // ✅ CORREGIDO: Con contexto completo
          const accounts = await safeQuery(
            customer,
            `
            SELECT
              customer_client.client_customer,
              customer_client.descriptive_name,
              customer_client.status,
              customer_client.level
            FROM customer_client
            `,
            {
              retries: 1,
              baseDelay: 300,
              throwOnError: false,
              context: {
                name: "oauth_mcc_subaccounts",
                customer_id: customerIdClean,
                mcc_id: customerIdClean,
                date: null,
              },
            }
          );

          console.log(`📊 Subcuentas encontradas: ${accounts.length}`);

          for (const account of accounts) {
            try {
              const subCustomerClean = cleanCustomerId(
                account.customer_client?.client_customer
              );
              const subName =
                account.customer_client?.descriptive_name ||
                `SubAccount ${subCustomerClean}`;

              cuentasConectadas.push(`  → ${subName} - ${subCustomerClean}`);

              // ✅ Guardar subcuenta (usando pool.execute - conexión automática corta)
              await pool.execute(
                `INSERT INTO accounts (customer_id, name, is_mcc, parent_account_id)
                 VALUES (?, ?, 0, ?)
                 ON DUPLICATE KEY UPDATE name = ?`,
                [subCustomerClean, subName, customerIdClean, subName]
              );

              cuentasParaSincronizar.push(subCustomerClean);
            } catch (err) {
              console.warn(
                `⚠️ No se pudo guardar subcuenta ${account.customer_client?.client_customer}:`,
                err.message
              );
            }
          }
        } else {
          cuentasConectadas.push(`${nombre} - ${customerIdClean}`);
          cuentasParaSincronizar.push(customerIdClean);
        }

        console.log(`✅ Cuenta conectada: ${customerIdClean}`);
      } catch (e) {
        console.warn(`⚠️ No se pudo acceder a ${customerIdClean}:`, e.message);
        continue; // ⚠️ Continuar con siguiente cuenta
      }
    }

    // ✅ Sin finally porque no hay conexión persistente que liberar

    if (!cuentasConectadas.length) {
      return res
        .status(400)
        .send("❌ No se pudo guardar ninguna cuenta accesible.");
    }

    // 🔥 Programar sincronización
    console.log(
      `\n🚀 Programando sincronización para ${cuentasParaSincronizar.length} cuentas...`
    );

    if (cuentasParaSincronizar.length > 0) {
      try {
        const results = [];
        for (const accountId of cuentasParaSincronizar) {
          const result = await createSyncTasks(pool, accountId);
          results.push(result);
        }

        const createdCount = results.filter((r) => r.created).length;
        console.log(
          `✅ Tareas de sincronización creadas para ${createdCount}/${cuentasParaSincronizar.length} cuentas`
        );

        if (createdCount > 0) {
          syncQueue.onComplete = async (result) => {
            console.log(
              `\n🎉 Sincronización completada para ${result.accountsReady} cuentas`
            );
            console.log("🚀 Iniciando cola de análisis...");

            try {
              if (!analysisQueue.isRunning) {
                analysisQueue.start().catch((err) => {
                  console.error("❌ Error en cola de análisis:", err);
                });
              }
            } catch (err) {
              console.error("❌ Error iniciando análisis:", err);
            }
          };

          syncQueue.start().catch((err) => {
            console.error("❌ Error en cola de sincronización:", err);
          });
        }
      } catch (queueError) {
        console.error("⚠️ Error programando sincronización:", queueError);
      }
    }

    console.log(
      `🎉 Proceso de conexión completado. Sincronización en curso.\n`
    );

    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?connected=true&queued=${cuentasParaSincronizar.length}`
    );
  } catch (error) {
    if (
      error.code === "RESOURCE_EXHAUSTED" ||
      (error.message && error.message.includes("RATE_EXCEEDED"))
    ) {
      console.error("⚠️ RATE LIMIT alcanzado en /oauth2callback:", {
        message: error.message,
        stack: error.stack,
        time: new Date().toISOString(),
      });
    }

    console.error("❌ Error en OAuth callback:", error);
    res.status(500).send("❌ Error durante la autenticación");
  }
  // ✅ Sin finally - no hay conexión persistente que liberar
});


export default router;
