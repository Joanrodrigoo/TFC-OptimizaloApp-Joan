// syncAccounts/AccountSyncQueueConcurrent.js

import { GoogleAdsApi } from "google-ads-api";
import fetch from 'node-fetch';

class AccountSyncQueueConcurrent {
  constructor(pool, config = {}) {
    this.pool = pool;
    this.maxConcurrent = config.maxConcurrent || 3;
    this.retryDelay = config.retryDelay || 2000;
    this.apiBase = config.apiBase || 'http://localhost:3000';
    this.processingAccounts = new Set();
    this.isRunning = false;
    
    // Cliente de Google Ads
    this.googleAdsClient = new GoogleAdsApi({
      client_id: config.clientId || process.env.GOOGLE_CLIENT_ID,
      client_secret: config.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
      developer_token: config.developerToken || process.env.GOOGLE_DEVELOPER_TOKEN,
    });

    console.log(`🚀 AccountSyncQueueConcurrent inicializado (max: ${this.maxConcurrent} cuentas)`);
  }

  // ========================================
  // MÉTODO PRINCIPAL: Iniciar procesamiento
  // ========================================
  async start() {
    if (this.isRunning) {
      console.log("⚠️ El procesador ya está en ejecución");
      return;
    }

    this.isRunning = true;
    console.log("\n" + "=".repeat(80));
    console.log("🎬 INICIANDO PROCESAMIENTO CONCURRENTE DE CUENTAS");
    console.log("=".repeat(80) + "\n");

    try {
      await this.processQueue();
      
      // 🔥 Después de procesar toda la cola, verificar análisis
      await this.triggerAnalysisForReadyAccounts();
      
    } catch (error) {
      console.error("❌ Error crítico en el procesador:", error);
    } finally {
      this.isRunning = false;
      console.log("\n" + "=".repeat(80));
      console.log("🏁 PROCESAMIENTO FINALIZADO");
      console.log("=".repeat(80) + "\n");
    }
  }

  // ========================================
  // CICLO PRINCIPAL DE PROCESAMIENTO
  // ========================================
  async processQueue() {
    while (true) {
      // 1️⃣ Obtener cuentas pendientes
      const pendingAccounts = await this.getPendingAccounts();
      
      if (pendingAccounts.length === 0) {
        console.log("✅ No hay más cuentas pendientes para sincronización");
        break;
      }

      console.log(`📋 Cuentas pendientes: ${pendingAccounts.length}`);
      console.log(`🔄 Procesando actualmente: ${this.processingAccounts.size}/${this.maxConcurrent}`);

      // 2️⃣ Procesar cuentas hasta el límite de concurrencia
      const availableSlots = this.maxConcurrent - this.processingAccounts.size;
      const accountsToProcess = pendingAccounts.slice(0, availableSlots);

      if (accountsToProcess.length === 0) {
        // Esperar a que se libere algún slot
        await this.sleep(this.retryDelay);
        continue;
      }

// 3️⃣ Lanzar procesamiento concurrente con control de timeout
const promises = accountsToProcess.map(account => {
  const task = this.processCustomer(account.customer_id);
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`⏰ Timeout global (15 min) para ${account.customer_id}`)), 15 * 60 * 1000)
  );
  return Promise.race([task, timeout])
    .catch(err => console.error(`❌ Error o timeout en ${account.customer_id}:`, err.message))
    .finally(() => this.processingAccounts.delete(account.customer_id)); // 🔥 Asegura liberar slot
});

// Esperar a que termine al menos una
await Promise.race(promises);

      
      // Pequeña pausa para evitar sobrecarga
      await this.sleep(500);
    }

    // Esperar a que terminen las últimas cuentas
    if (this.processingAccounts.size > 0) {
      console.log(`⏳ Esperando a que terminen las últimas ${this.processingAccounts.size} cuentas...`);
      while (this.processingAccounts.size > 0) {
        await this.sleep(1000);
      }
    }
  }

  // ========================================
  // 🔥 TRIGGER DE ANÁLISIS (COMPLETAMENTE MEJORADO)
  // ========================================
  async triggerAnalysisForReadyAccounts() {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('🔍 VERIFICANDO CUENTAS LISTAS PARA ANÁLISIS');
      console.log('='.repeat(80) + '\n');

      // Obtener cuentas que:
      // 1. Completaron TODAS sus tareas de sincronización
      // 2. Tienen al menos 7 días de datos
      // 3. NO tienen análisis reciente (últimas 24h)
      const [readyAccounts] = await this.pool.execute(`
        SELECT DISTINCT 
          cmh.customer_id, 
          a.name,
          COUNT(DISTINCT cmh.date) as days_count
        FROM campaign_metrics_history cmh
        LEFT JOIN accounts a ON a.customer_id = cmh.customer_id
        WHERE NOT EXISTS (
          -- No tienen tareas pendientes o en proceso
          SELECT 1 FROM sync_queue sq 
          WHERE sq.customer_id = cmh.customer_id 
          AND sq.status IN ('pending', 'processing')
        )
        AND NOT EXISTS (
          -- NO tienen análisis reciente (últimas 24h)
          SELECT 1 FROM analysis_queue aq
          WHERE aq.customer_id = cmh.customer_id
          AND aq.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        )
        GROUP BY cmh.customer_id, a.name
        HAVING days_count >= 7
      `);

      if (readyAccounts.length === 0) {
        console.log('ℹ️  No hay cuentas listas para análisis (o ya fueron analizadas recientemente)');
        return;
      }

      console.log(`📊 Cuentas listas para análisis: ${readyAccounts.length}\n`);

      // Programar análisis para cada cuenta
      let queued = 0;
      let alreadyQueued = 0;
      let errors = 0;

      for (const { customer_id, name, days_count } of readyAccounts) {
        try {
          console.log(`📋 ${customer_id} (${name || 'Sin nombre'}): ${days_count} días de datos`);

          const response = await fetch(`${this.apiBase}/api/schedule-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId: customer_id })
          });

          if (response.ok) {
            const data = await response.json();
            
            if (data.taskResult?.created) {
              console.log(`   ✅ Análisis programado`);
              queued++;
            } else if (data.taskResult?.reason === 'task_already_exists') {
              console.log(`   ℹ️  Ya tiene análisis en cola`);
              alreadyQueued++;
            } else {
              console.log(`   ⚠️  ${data.message || 'Sin acción'}`);
            }
          } else {
            const error = await response.text();
            console.warn(`   ⚠️  Error HTTP ${response.status}: ${error}`);
            errors++;
          }
        } catch (error) {
          console.error(`   ❌ Error: ${error.message}`);
          errors++;
        }

        // Pausa pequeña entre programaciones
        await this.sleep(100);
      }

      console.log('\n' + '─'.repeat(80));
      console.log(`📊 Resumen de programación:`);
      console.log(`   ✅ Análisis programados: ${queued}`);
      console.log(`   ℹ️  Ya en cola: ${alreadyQueued}`);
      console.log(`   ❌ Errores: ${errors}`);
      console.log('─'.repeat(80) + '\n');

      // 🔥 CORREGIDO: Verificar si la cola YA está corriendo antes de iniciar
      if (queued > 0) {
        console.log(`🚀 Verificando estado de cola de análisis...\n`);
        
        try {
          // Primero verificar el estado
          const statusResponse = await fetch(`${this.apiBase}/api/analysis-queue-status`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            if (statusData.isRunning) {
              console.log(`ℹ️  Cola de análisis YA está corriendo (${statusData.processingCount}/${statusData.maxConcurrent} activos)`);
              console.log(`   Las ${queued} nuevas tareas se procesarán automáticamente`);
            } else {
              // Solo iniciar si NO está corriendo
              console.log(`🚀 Iniciando cola de análisis para ${queued} cuentas...\n`);
              
              const response = await fetch(`${this.apiBase}/api/start-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });

              if (response.ok) {
                const data = await response.json();
                
                // 🔥 NUEVO: Manejar correctamente ambos casos
                if (data.alreadyRunning) {
                  console.log(`ℹ️  ${data.message}`);
                  console.log(`   Las ${queued} nuevas tareas se procesarán automáticamente`);
                } else {
                  console.log(`✅ ${data.message}`);
                  if (data.status) {
                    console.log(`📊 Estado inicial:`);
                    console.log(`   - Procesando: ${data.status.processingCount}/${data.status.maxConcurrent}`);
                    console.log(`   - Cuentas: ${data.status.processingAccounts.join(', ') || 'Ninguna aún'}`);
                  }
                }
              } else {
                const errorText = await response.text();
                console.error(`❌ Error HTTP ${response.status} al iniciar cola: ${errorText}`);
              }
            }
          } else {
            console.warn(`⚠️  No se pudo verificar estado de cola de análisis (HTTP ${statusResponse.status})`);
            // Intentar iniciar de todas formas
            console.log(`   Intentando iniciar cola de todas formas...`);
            
            try {
              const response = await fetch(`${this.apiBase}/api/start-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });

              if (response.ok) {
                const data = await response.json();
                console.log(`✅ ${data.message}`);
              } else {
                const errorText = await response.text();
                console.error(`❌ Error al iniciar: ${errorText}`);
              }
            } catch (startError) {
              console.error(`❌ Error al intentar iniciar: ${startError.message}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error en verificación/inicio de cola: ${error.message}`);
          console.error(`   Stack:`, error.stack);
        }
      } else {
        console.log('ℹ️  No se programaron nuevos análisis');
      }

      console.log('\n' + '='.repeat(80));
      console.log('✅ VERIFICACIÓN DE ANÁLISIS COMPLETADA');
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      console.error('❌ Error en triggerAnalysisForReadyAccounts:', error);
      console.error('Stack:', error.stack);
      // No lanzar error para no romper el flujo
    }
  }

  // ========================================
  // OBTENER CUENTAS PENDIENTES
  // ========================================
  async getPendingAccounts() {
    const [rows] = await this.pool.execute(`
      SELECT 
        customer_id,
        COUNT(*) AS pending_weeks,
        MIN(week_number) AS next_week,
        MAX(attempts) AS max_attempts_used
      FROM sync_queue
      WHERE status IN ('pending', 'failed') 
        AND attempts < max_attempts
      GROUP BY customer_id
      ORDER BY 
        MAX(attempts) ASC,
        MIN(created_at) ASC
    `);
    
    return rows;
  }

  // ========================================
  // PROCESAR UNA CUENTA COMPLETA
  // ========================================
  async processCustomer(customerId) {
    // Evitar duplicados
    if (this.processingAccounts.has(customerId)) {
      console.log(`⚠️ ${customerId} ya está en proceso`);
      return;
    }

    this.processingAccounts.add(customerId);
    console.log(`\n${"─".repeat(80)}`);
    console.log(`🏁 INICIANDO CUENTA: ${customerId}`);
    console.log(`📊 Cuentas activas: ${this.processingAccounts.size}/${this.maxConcurrent}`);
    console.log("─".repeat(80));

    try {
      let hasMoreWeeks = true;
      let weekCount = 0;

      while (hasMoreWeeks) {
        hasMoreWeeks = await this.processNextWeek(customerId);
        if (hasMoreWeeks) {
          weekCount++;
          console.log(`  ✅ Semana ${weekCount} completada para ${customerId}`);
        }
      }

      console.log(`\n${"✅".repeat(40)}`);
      console.log(`✅ CUENTA ${customerId} COMPLETADA (${weekCount} semanas)`);
      console.log("✅".repeat(40) + "\n");

    } catch (error) {
      console.error(`\n${"❌".repeat(40)}`);
      console.error(`❌ ERROR EN CUENTA ${customerId}: ${error.message}`);
      console.error("❌".repeat(40) + "\n");
    } finally {
      this.processingAccounts.delete(customerId);
    }
  }

  // ========================================
  // PROCESAR LA SIGUIENTE SEMANA DE UNA CUENTA
  // ========================================
  async processNextWeek(customerId) {
    const conn = await this.pool.getConnection();
    
    try {
      // 1️⃣ Obtener la siguiente tarea pendiente
      const [tasks] = await conn.execute(`
        SELECT * FROM sync_queue
        WHERE customer_id = ? 
          AND status IN ('pending', 'failed') 
          AND attempts < max_attempts
        ORDER BY week_number ASC
        LIMIT 1
      `, [customerId]);

      if (!tasks.length) {
        return false; // No hay más semanas
      }

      const task = tasks[0];
      console.log(`  📅 Procesando ${customerId} - Semana ${task.week_number} (${task.start_date} → ${task.end_date})`);

      // 2️⃣ Marcar como 'processing'
      await conn.execute(`
        UPDATE sync_queue
        SET status = 'processing', 
            started_at = NOW(), 
            attempts = attempts + 1
        WHERE id = ?
      `, [task.id]);

      conn.release();

      // 3️⃣ Obtener token y configuración
const { customer, finalCustomerId } = await this.getCustomerClient(customerId);

// 🔥 VALIDACIÓN CRÍTICA DE SEGURIDAD
if (finalCustomerId !== customerId) {
  throw new Error(
    `❌ CRITICAL MISMATCH: Solicitada ${customerId} pero se obtuvo ${finalCustomerId}. Abortando por seguridad.`
  );
}

console.log(`   ✅ Validación OK - Procesando cuenta: ${customerId}`);

      // 4️⃣ Procesar cada día de la semana (de más reciente a más antiguo)
      const startDate = new Date(task.start_date);
      const endDate = new Date(task.end_date);
      const currentDate = new Date(endDate);
      
      let daysProcessed = 0;
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      while (currentDate >= startDate) {
        const dateStr = currentDate.toISOString().split("T")[0];
        
        try {
          // Aquí llamamos a tu función existente processSingleDay
          await global.processSingleDay(customer, finalCustomerId, dateStr, task.end_date);
          daysProcessed++;
          
          const progress = Math.round((daysProcessed / totalDays) * 100);
          console.log(`    ✓ ${dateStr} (${daysProcessed}/${totalDays} días - ${progress}%)`);
        } catch (dayError) {
          console.error(`    ✗ Error en ${dateStr}:`, dayError.message);
          // Continuar con el siguiente día
        }
        
        currentDate.setDate(currentDate.getDate() - 1);
      }

      // 5️⃣ Marcar como completada
      await this.pool.execute(`
        UPDATE sync_queue
        SET status = 'completed', completed_at = NOW()
        WHERE id = ?
      `, [task.id]);

      console.log(`  ✅ Semana ${task.week_number} completada (${daysProcessed}/${totalDays} días)`);
      return true; // Hay más semanas por procesar

    } catch (error) {
      // 6️⃣ Manejar error
      console.error(`  ❌ Error en semana: ${error.message}`);
      
      const conn2 = await this.pool.getConnection();
      try {
        const [task] = await conn2.execute(`
          SELECT * FROM sync_queue 
          WHERE customer_id = ? AND status = 'processing'
          ORDER BY id DESC LIMIT 1
        `, [customerId]);

        if (task.length > 0) {
          const status = task[0].attempts >= task[0].max_attempts ? 'failed' : 'pending';
          await conn2.execute(`
            UPDATE sync_queue
            SET status = ?, error_message = ?
            WHERE id = ?
          `, [status, error.message.substring(0, 500), task[0].id]);
        }
      } finally {
        conn2.release();
      }

      throw error;
    } finally {
      if (conn) {
        try { conn.release(); } catch {}
      }
    }
  }

  // ========================================
  // OBTENER CLIENTE DE GOOGLE ADS
  // ========================================
  async getCustomerClient(customerId) {
  const conn = await this.pool.getConnection();
  
  try {
    console.log(`\n🔑 [getCustomerClient] Buscando credenciales para: ${customerId}`);
    
    // 🔥 PASO 1: Verificar si la cuenta existe y obtener su parent
    const [accountInfo] = await conn.execute(`
      SELECT customer_id, name, is_mcc, parent_account_id
      FROM accounts
      WHERE customer_id = ?
      LIMIT 1
    `, [customerId]);
    
    if (!accountInfo.length) {
      throw new Error(`Cuenta ${customerId} no existe en la base de datos`);
    }
    
    const account = accountInfo[0];
    console.log(`   📋 Cuenta encontrada: ${account.name}`);
    console.log(`   ℹ️  Es MCC: ${account.is_mcc === 1 ? 'Sí' : 'No'}`);
    console.log(`   ℹ️  Parent MCC: ${account.parent_account_id || 'Ninguno'}`);
    
    // 🔥 PASO 2: Buscar el token (de la cuenta misma o de su MCC padre)
    let tokenRow;
    
    if (account.parent_account_id) {
      // Si tiene parent, usar el token del MCC padre
      console.log(`   🏢 Buscando token del MCC padre: ${account.parent_account_id}`);
      
      [tokenRow] = await conn.execute(`
        SELECT refresh_token, customer_id as token_owner, is_mcc
        FROM tokens
        WHERE customer_id = ?
        LIMIT 1
      `, [account.parent_account_id]);
      
    } else {
      // Si no tiene parent, usar su propio token
      console.log(`   👤 Buscando token propio de la cuenta`);
      
      [tokenRow] = await conn.execute(`
        SELECT refresh_token, customer_id as token_owner, is_mcc
        FROM tokens
        WHERE customer_id = ?
        LIMIT 1
      `, [customerId]);
    }
    
    if (!tokenRow.length) {
      const searchedId = account.parent_account_id || customerId;
      throw new Error(`No se encontró token para ${searchedId}`);
    }
    
    const { refresh_token, token_owner, is_mcc } = tokenRow[0];
    const tokenIsMcc = is_mcc === 1;
    
    console.log(`   ✅ Token encontrado: ${token_owner}`);
    console.log(`   ℹ️  Token es de MCC: ${tokenIsMcc ? 'Sí' : 'No'}`);
    
    // 🔥 PASO 3: Validación de seguridad
    if (account.is_mcc === 1) {
      throw new Error(`No se puede sincronizar ${customerId} porque es una cuenta MCC`);
    }
    
    // 🔥 PASO 4: Configurar cliente de Google Ads
    const clientConfig = {
      customer_id: customerId, // ⚠️ SIEMPRE usar el customerId solicitado
      refresh_token,
    };
    
    // Solo añadir login_customer_id si el token es de un MCC
    if (tokenIsMcc) {
      clientConfig.login_customer_id = token_owner;
      console.log(`   🏢 Usando login_customer_id: ${token_owner}`);
    }
    
    console.log(`   🎯 Customer ID final: ${customerId}`);
    console.log(`   ✅ Configuración lista\n`);
    
    const customer = this.googleAdsClient.Customer(clientConfig);

    return { 
      customer, 
      finalCustomerId: customerId // ⚠️ SIEMPRE devolver el customerId solicitado
    };
    
  } finally {
    conn.release();
  }

  }

  // ========================================
  // UTILIDADES
  // ========================================
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Obtener estado actual
  getStatus() {
    return {
      isRunning: this.isRunning,
      processingCount: this.processingAccounts.size,
      maxConcurrent: this.maxConcurrent,
      processingAccounts: Array.from(this.processingAccounts)
    };
  }

  // Detener procesamiento
  stop() {
    console.log("🛑 Deteniendo procesador...");
    this.isRunning = false;
  }
}

export default AccountSyncQueueConcurrent;
