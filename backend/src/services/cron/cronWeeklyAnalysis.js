import pool from './db.js'; // ✅ USAR EL POOL COMPARTIDO
import dotenv from "dotenv";
import fetch from 'node-fetch';
import { createWeeklyAnalysisTask, cleanOldAnalysisTasks } from '../analysisQueue/analysisUtils.js';

dotenv.config();

const API_BASE = 'http://localhost:3000';

// ❌ ELIMINADO: cronPool independiente
// ✅ AHORA USA EL POOL COMPARTIDO DE db.js

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🤖 INICIANDO CRON JOB - ANÁLISIS SEMANAL CON IA');
  console.log('='.repeat(80) + '\n');

  let connection; // ✅ Variable para manejar la conexión

  try {
    connection = await pool.getConnection(); // ✅ Obtener conexión del pool compartido

    // 1️⃣ Limpiar tareas antiguas (opcional)
    await cleanOldAnalysisTasks(pool, 30); // ✅ Pasar pool compartido

    // 2️⃣ Obtener todas las cuentas activas (NO MCC)
    const [rows] = await connection.execute(`
      SELECT DISTINCT 
        a.customer_id, 
        a.name,
        t.token_status
      FROM accounts a
      LEFT JOIN tokens t ON a.customer_id = t.customer_id
      WHERE a.customer_id IS NOT NULL
        AND a.is_mcc = 0
        AND t.refresh_token IS NOT NULL
        AND t.token_status = 'valid'
      ORDER BY a.customer_id
    `);

    if (rows.length === 0) {
      console.log('⚠️ No se encontraron cuentas para analizar.');
      return;
    }

    console.log(`📋 Cuentas encontradas: ${rows.length}`);

    // 3️⃣ Crear tareas de análisis para cada cuenta
    console.log(`\n${'='.repeat(80)}`);
    console.log('🔥 PROGRAMANDO TAREAS DE ANÁLISIS');
    console.log('='.repeat(80) + '\n');

    const results = {
      queued: [],
      alreadyQueued: [],
      errors: []
    };

    for (const row of rows) {
      const { customer_id, name } = row;
      
      try {
        const result = await createWeeklyAnalysisTask(pool, customer_id); // ✅ Pasar pool compartido
        
        if (result.created) {
          console.log(`✅ ${customer_id} (${name}): Análisis programado`);
          results.queued.push(customer_id);
        } else {
          console.log(`ℹ️ ${customer_id} (${name}): ${result.reason}`);
          results.alreadyQueued.push(customer_id);
        }
      } catch (error) {
        console.error(`❌ ${customer_id} (${name}): Error - ${error.message}`);
        results.errors.push({ customer_id, error: error.message });
      }

      // Pequeña pausa para no saturar
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 4️⃣ Iniciar la cola de análisis si hay tareas
    if (results.queued.length > 0) {
      console.log(`\n${'='.repeat(80)}`);
      console.log('🚀 INICIANDO PROCESAMIENTO DE ANÁLISIS');
      console.log('='.repeat(80) + '\n');

      try {
        const startResponse = await fetch(`${API_BASE}/api/start-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const startData = await startResponse.json();

        if (startResponse.ok) {
          console.log(`✅ Cola de análisis iniciada: ${startData.message}`);
        } else {
          console.error(`❌ Error iniciando cola: ${startData.error}`);
        }
      } catch (error) {
        console.error(`❌ Error al iniciar cola de análisis: ${error.message}`);
      }
    } else {
      console.log(`\nℹ️ No hay nuevas tareas de análisis (todas las cuentas ya tienen análisis en cola)`);
    }

    // 5️⃣ Resumen final
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(80));
    console.log(`  ✅ Análisis programados: ${results.queued.length}`);
    console.log(`  ℹ️ Ya en cola: ${results.alreadyQueued.length}`);
    console.log(`  ❌ Errores: ${results.errors.length}`);
    console.log('='.repeat(80) + '\n');

    if (results.errors.length > 0) {
      console.log('❌ Cuentas con errores:');
      results.errors.forEach(({ customer_id, error }) => {
        console.log(`  • ${customer_id}: ${error}`);
      });
    }

    console.log('🎉 Cron job de análisis finalizado.\n');

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