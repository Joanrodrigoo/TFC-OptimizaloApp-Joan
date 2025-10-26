import pool from './db.js'; // ✅ USAR EL POOL COMPARTIDO
import dotenv from "dotenv";
import fetch from 'node-fetch';

dotenv.config();

const API_BASE = 'http://localhost:3000';

// ❌ ELIMINADO: cronPool independiente
// ✅ AHORA USA EL POOL COMPARTIDO DE db.js

const isTokenExpiring = (expiry) => {
  if (!expiry) return true;
  const now = new Date();
  const expiryTime = new Date(expiry);
  return (expiryTime - now) < 5 * 60 * 1000; // menos de 5 minutos
};

const renewAccessToken = async (refreshToken) => {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Token refresh failed: ${error.error}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  };
};

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🕐 INICIANDO CRON JOB - SINCRONIZACIÓN DIARIA');
  console.log('='.repeat(80) + '\n');

  let connection; // ✅ Variable para manejar la conexión

  try {
    connection = await pool.getConnection(); // ✅ Obtener conexión del pool compartido

    // 1️⃣ Obtener todas las cuentas activas (NO MCC)
    const [rows] = await connection.execute(`
      SELECT DISTINCT 
        a.customer_id, 
        a.name,
        a.is_mcc,
        t.refresh_token, 
        t.access_token_expiry, 
        t.token_status, 
        t.user_id
      FROM accounts a
      LEFT JOIN tokens t ON a.customer_id = t.customer_id
      WHERE a.customer_id IS NOT NULL
        AND a.is_mcc = 0
    `);

    if (rows.length === 0) {
      console.log('⚠️ No se encontraron cuentas para sincronizar.');
      return;
    }

    console.log(`📋 Cuentas encontradas: ${rows.length}`);
    
    const validAccounts = [];
    const skippedAccounts = [];

    // 2️⃣ Validar tokens y renovar si es necesario
    for (const row of rows) {
      const { customer_id, name, refresh_token, access_token_expiry, token_status, user_id } = row;

      if (!refresh_token || token_status === 'revoked') {
        console.log(`⛔ ${customer_id} (${name}): Token inválido o revocado`);
        skippedAccounts.push({ customer_id, reason: 'invalid_token' });
        continue;
      }

      try {
        if (isTokenExpiring(access_token_expiry)) {
          console.log(`🔄 ${customer_id} (${name}): Renovando token...`);

          const { access_token, expiry_date } = await renewAccessToken(refresh_token);

          await connection.execute(`
            UPDATE tokens 
            SET access_token = ?, access_token_expiry = ?, token_status = 'valid'
            WHERE customer_id = ? AND user_id = ?
          `, [access_token, new Date(expiry_date), customer_id, user_id]);

          console.log(`  ✅ Token renovado`);
        } else {
          console.log(`🟢 ${customer_id} (${name}): Token válido`);
        }

        validAccounts.push(customer_id);
      } catch (err) {
        console.error(`❌ ${customer_id} (${name}): Falló renovación - ${err.message}`);
        
        await connection.execute(`
          UPDATE tokens SET token_status = 'revoked'
          WHERE customer_id = ? AND user_id = ?
        `, [customer_id, user_id]);
        
        skippedAccounts.push({ customer_id, reason: 'token_renewal_failed' });
      }
    }

    console.log(`\n📊 Resumen de validación:`);
    console.log(`  ✅ Cuentas válidas: ${validAccounts.length}`);
    console.log(`  ⛔ Cuentas omitidas: ${skippedAccounts.length}`);

    if (validAccounts.length === 0) {
      console.log('\n⚠️ No hay cuentas válidas para sincronizar.');
      return;
    }

    // 3️⃣ Crear TAREAS DIARIAS en la cola para cada cuenta
    console.log(`\n${'='.repeat(80)}`);
    console.log('🔥 PROGRAMANDO TAREAS DIARIAS EN LA COLA');
    console.log('='.repeat(80) + '\n');

    const results = {
      queued: [],
      alreadyQueued: [],
      errors: []
    };

    for (const customerId of validAccounts) {
      try {
        const response = await fetch(`${API_BASE}/api/start-daily-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId })
        });

        const data = await response.json();

        if (response.ok) {
          if (data.taskResult?.created) {
            console.log(`✅ ${customerId}: Tarea diaria programada (${data.taskResult.date})`);
            results.queued.push(customerId);
          } else if (data.taskResult?.reason === 'task_already_exists') {
            console.log(`ℹ️ ${customerId}: Ya tiene tarea para ${data.taskResult.date}`);
            results.alreadyQueued.push(customerId);
          } else if (data.taskResult?.reason === 'is_mcc_account') {
            console.log(`🚫 ${customerId}: Es cuenta MCC, omitida`);
          } else {
            console.log(`⚠️ ${customerId}: ${data.taskResult?.message || 'Sin acción'}`);
          }
        } else {
          console.error(`❌ ${customerId}: Error - ${data.error || response.statusText}`);
          results.errors.push({ customerId, error: data.error });
        }
      } catch (error) {
        console.error(`❌ ${customerId}: Error al programar - ${error.message}`);
        results.errors.push({ customerId, error: error.message });
      }

      // Pequeña pausa para no saturar
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 4️⃣ Iniciar la cola si hay cuentas programadas
    if (results.queued.length > 0) {
      console.log(`\n${'='.repeat(80)}`);
      console.log('🚀 INICIANDO PROCESAMIENTO DE COLA');
      console.log('='.repeat(80) + '\n');

      try {
        const startResponse = await fetch(`${API_BASE}/api/start-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const startData = await startResponse.json();

        if (startResponse.ok) {
          console.log(`✅ Cola iniciada: ${startData.message}`);
          console.log(`📊 Estado: ${JSON.stringify(startData.status, null, 2)}`);
        } else {
          console.error(`❌ Error iniciando cola: ${startData.error}`);
        }
      } catch (error) {
        console.error(`❌ Error al iniciar cola: ${error.message}`);
      }
    } else {
      console.log(`\nℹ️ No hay nuevas tareas que procesar (todas las cuentas ya tienen tarea para hoy)`);
    }

    // 5️⃣ Resumen final
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(80));
    console.log(`  ✅ Tareas diarias programadas: ${results.queued.length}`);
    console.log(`  ℹ️ Ya programadas para hoy: ${results.alreadyQueued.length}`);
    console.log(`  ❌ Errores: ${results.errors.length}`);
    console.log('='.repeat(80) + '\n');

    if (results.errors.length > 0) {
      console.log('❌ Cuentas con errores:');
      results.errors.forEach(({ customerId, error }) => {
        console.log(`  • ${customerId}: ${error}`);
      });
    }

    console.log('🎉 Cron job finalizado.\n');

  } catch (error) {
    console.error('❌ Error general en cron job:', error.message);
    throw error;
  } finally {
    // ✅ LIBERAR LA CONEXIÓN AL POOL (NO CERRAR EL POOL)
    if (connection) {
      connection.release();
      console.log('🔓 Conexión liberada al pool');
    }
    // ❌ NO HACER: await pool.end();
  }
}

// Ejecutar
main().catch(error => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});