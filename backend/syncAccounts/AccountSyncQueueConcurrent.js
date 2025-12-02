// syncAccounts/AccountSyncQueueConcurrent.js

import { GoogleAdsApi } from "google-ads-api";
import fetch from 'node-fetch';

class AccountSyncQueueConcurrent {
  constructor(pool, config = {}) {
    this.pool = pool;
    this.maxConcurrent = config.maxConcurrent || 3;
    this.retryDelay = config.retryDelay || 2000;
    this.apiBase = config.apiBase || process.env.API_BASE_URL || 'http://localhost:3000';
    this.processingAccounts = new Set();
    this.abortControllers = new Map();
    this.isRunning = false;
    
    this.googleAdsClient = new GoogleAdsApi({
      client_id: config.clientId || process.env.GOOGLE_CLIENT_ID,
      client_secret: config.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
      developer_token: config.developerToken || process.env.GOOGLE_DEVELOPER_TOKEN,
    });

    console.log(`🚀 AccountSyncQueueConcurrent inicializado (max: ${this.maxConcurrent} cuentas)`);
    console.log(`🌐 API Base: ${this.apiBase}`);
  }

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
    } catch (error) {
      console.error("❌ Error crítico en el procesador:", error);
    } finally {
      this.isRunning = false;
      console.log("\n" + "=".repeat(80));
      console.log("🏁 PROCESAMIENTO FINALIZADO");
      console.log("=".repeat(80) + "\n");
    }
  }

  async processQueue() {
    while (true) {
      const pendingAccounts = await this.getPendingAccounts();
      
      if (pendingAccounts.length === 0) {
        if (this.processingAccounts.size > 0) {
          console.log(`⏳ No hay más pendientes, pero ${this.processingAccounts.size} cuentas aún están procesándose...`);
          await this.sleep(this.retryDelay);
          continue;
        }
        
        console.log("✅ No hay más cuentas pendientes para sincronización");
        break;
      }

      console.log(`📋 Cuentas pendientes: ${pendingAccounts.length}`);
      console.log(`🔄 Procesando actualmente: ${this.processingAccounts.size}/${this.maxConcurrent}`);

      const availableSlots = this.maxConcurrent - this.processingAccounts.size;
      
      if (availableSlots <= 0) {
        console.log(`⏸️  Todos los slots ocupados, esperando...`);
        await this.sleep(this.retryDelay);
        continue;
      }

      const accountsToProcess = pendingAccounts.slice(0, availableSlots);
      console.log(`🚀 Iniciando procesamiento de ${accountsToProcess.length} cuenta(s)...`);

      accountsToProcess.forEach(account => {
        const controller = new AbortController();
        this.abortControllers.set(account.customer_id, controller);
        
        this.processCustomerWithTimeout(account.customer_id, controller)
          .catch(err => {
            console.error(`❌ Error procesando ${account.customer_id}:`, err.message);
          });
      });

      await this.sleep(2000);
    }

    if (this.processingAccounts.size > 0) {
      console.log(`⏳ Esperando a que terminen las últimas ${this.processingAccounts.size} cuentas...`);
      
      let waitCount = 0;
      const maxWaitMinutes = 120;
      const maxWaitIterations = (maxWaitMinutes * 60);
      
      while (this.processingAccounts.size > 0 && waitCount < maxWaitIterations) {
        await this.sleep(1000);
        waitCount++;
        
        if (waitCount % 30 === 0) {
          console.log(`   ⏳ Aún esperando: ${this.processingAccounts.size} cuentas activas - ${Array.from(this.processingAccounts).join(', ')}`);
        }
      }
      
      if (this.processingAccounts.size > 0) {
        console.warn(`⚠️ Timeout esperando cuentas después de ${maxWaitMinutes} minutos: ${Array.from(this.processingAccounts).join(', ')}`);
        
        for (const customerId of this.processingAccounts) {
          const controller = this.abortControllers.get(customerId);
          if (controller) {
            console.log(`🛑 Abortando ${customerId} por timeout global`);
            controller.abort();
          }
        }
      }
    }
  }

  async processCustomerWithTimeout(customerId, controller) {
    const timeoutMs = 60 * 60 * 1000; // 1 hora
    
    const task = this.processCustomer(customerId, controller.signal);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => {
        console.error(`⏰ TIMEOUT (1h) alcanzado para ${customerId}`);
        controller.abort();
        reject(new Error(`Timeout para ${customerId}`));
      }, timeoutMs)
    );
    
    try {
      await Promise.race([task, timeout]);
    } catch (error) {
      console.error(`❌ Error en ${customerId}:`, error.message);
      throw error;
    } finally {
      this.abortControllers.delete(customerId);
      console.log(`🧹 AbortController limpiado para ${customerId}`);
    }
  }

  async getPendingAccounts() {
    try {
      let query;
      let params;
      
      if (this.processingAccounts.size > 0) {
        const placeholders = Array.from(this.processingAccounts).map(() => '?').join(',');
        query = `
          SELECT DISTINCT customer_id
          FROM sync_queue
          WHERE status = 'pending'
          AND customer_id NOT IN (${placeholders})
          ORDER BY id
          LIMIT 10
        `;
        params = Array.from(this.processingAccounts);
      } else {
        query = `
          SELECT DISTINCT customer_id
          FROM sync_queue
          WHERE status = 'pending'
          ORDER BY id
          LIMIT 10
        `;
        params = [];
      }

      const [tasks] = await this.pool.execute(query, params);
      
      if (tasks.length > 0) {
        console.log(`   📥 Obtenidas ${tasks.length} cuentas pendientes: ${tasks.map(t => t.customer_id).join(', ')}`);
      }
      
      return tasks;

    } catch (error) {
      console.error("❌ Error obteniendo cuentas pendientes:", error);
      return [];
    }
  }

  async processCustomer(customerId, signal) {
    if (this.processingAccounts.has(customerId)) {
      console.log(`⚠️ ${customerId} ya está siendo procesado`);
      return false;
    }

    this.processingAccounts.add(customerId);
    console.log(`🔒 ${customerId} agregado a processingAccounts (${this.processingAccounts.size} activas)`);

    try {
      const [tasks] = await this.pool.execute(`
        SELECT * FROM sync_queue
        WHERE customer_id = ? AND status = 'pending'
        ORDER BY week_number
      `, [customerId]);

      if (tasks.length === 0) {
        console.log(`⚠️ No hay tareas pendientes para ${customerId}`);
        return false;
      }

      console.log(`\n${"=".repeat(40)}`);
      console.log(`📊 [${customerId}] - ${tasks.length} SEMANAS PENDIENTES`);
      console.log(`${"=".repeat(40)}\n`);

      for (const task of tasks) {
        if (signal?.aborted) {
          console.log(`🛑 Procesamiento cancelado para ${customerId}`);
          break;
        }

        await this.processWeek(customerId, task, signal);
      }

      console.log(`\n${"✅".repeat(40)}`);
      console.log(`✅ CUENTA ${customerId} COMPLETADA (${tasks.length} semanas)`);
      console.log(`${"✅".repeat(40)}\n`);

      // Calcular total de días importados
      const totalDaysToImport = tasks.reduce((sum, task) => {
        const startDate = new Date(task.start_date);
        const endDate = new Date(task.end_date);
        const days = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        return sum + days;
      }, 0);

      console.log(`📊 Total de días a importar: ${totalDaysToImport}`);

      // Programar análisis solo si la importación es significativa
      if (totalDaysToImport >= 14) {
        console.log(`✅ Importación significativa (≥14 días) - programando análisis`);
        
        // Verificar si ya tiene análisis reciente
        const [recentAnalysis] = await this.pool.execute(`
          SELECT id FROM analysis_queue
          WHERE customer_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        `, [customerId]);

        if (recentAnalysis.length === 0) {
          try {
            const response = await fetch(`${this.apiBase}/api/schedule-analysis`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customerId })
            });

            if (response.ok) {
              console.log(`🤖 Análisis programado`);
            } else {
              console.warn(`⚠️  No se pudo programar análisis: ${response.status}`);
            }
          } catch (error) {
            console.error(`❌ Error programando análisis:`, error.message);
          }
        } else {
          console.log(`ℹ️  Ya tiene análisis reciente programado`);
        }
      } else {
        console.log(`ℹ️  Importación pequeña (${totalDaysToImport} días) - sin análisis`);
      }

      return true;

    } catch (error) {
      console.error(`❌ Error procesando cuenta ${customerId}:`, error);
      throw error;
    } finally {
      this.processingAccounts.delete(customerId);
      console.log(`🔓 ${customerId} liberado de processingAccounts (${this.processingAccounts.size} activas)`);
    }
  }

  async processWeek(customerId, task, signal) {
    const weekStartTime = Date.now();
    
    try {
      console.log(`\n┌${"─".repeat(78)}┐`);
      console.log(`│ 📅 [${customerId}] PROCESANDO SEMANA ${task.week_number} │`);
      console.log(`│    Período: ${task.start_date} → ${task.end_date}`.padEnd(79) + '│');
      console.log(`└${"─".repeat(78)}┘\n`);

      await this.pool.execute(`
        UPDATE sync_queue
        SET status = 'processing', 
            started_at = NOW(), 
            attempts = attempts + 1,
            error_message = NULL
        WHERE id = ?
      `, [task.id]);

      const { customer, finalCustomerId } = await this.getCustomerClient(customerId);
      
      const startDate = new Date(task.start_date);
      const endDate = new Date(task.end_date);
      let currentDate = new Date(endDate);
      
      const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      let daysProcessed = 0;
      const dayDurations = [];

      console.log(`📊 Total de días a procesar: ${totalDays}`);
      console.log(`⏰ Inicio: ${new Date().toLocaleTimeString()}\n`);

      while (currentDate >= startDate) {
        if (signal?.aborted) {
          console.error(`\n🛑 Procesamiento cancelado para ${customerId}`);
          
          if (dayDurations.length > 0) {
            const avgDuration = dayDurations.reduce((a,b) => a+b, 0) / dayDurations.length;
            console.error(`   📊 Duración promedio por día: ${(avgDuration / 1000).toFixed(1)}s`);
            console.error(`   📊 Día más lento: ${(Math.max(...dayDurations) / 1000).toFixed(1)}s`);
            console.error(`   📊 Día más rápido: ${(Math.min(...dayDurations) / 1000).toFixed(1)}s`);
          }
          
          throw new Error('Procesamiento cancelado por timeout');
        }

        const dateStr = currentDate.toISOString().split("T")[0];
        const dayStart = Date.now();
        
        try {
          await global.processSingleDay(customer, finalCustomerId, dateStr, task.end_date);
          
          const dayDuration = Date.now() - dayStart;
          dayDurations.push(dayDuration);
          daysProcessed++;
          
          const progress = Math.round((daysProcessed / totalDays) * 100);
          const avgDuration = dayDurations.reduce((a,b) => a+b, 0) / dayDurations.length;
          const estimatedRemaining = ((totalDays - daysProcessed) * avgDuration) / 1000 / 60;
          const elapsedTotal = (Date.now() - weekStartTime) / 1000 / 60;
          
          console.log(`    ✓ ${dateStr} (${daysProcessed}/${totalDays} - ${progress}%) - ${(dayDuration/1000).toFixed(1)}s - Total: ${elapsedTotal.toFixed(1)}min - ETA: ${estimatedRemaining.toFixed(1)}min`);

          if (daysProcessed % 3 === 0) {
            const elapsedTime = Date.now() - weekStartTime;
            console.log(`\n    💾 ========== CHECKPOINT ${daysProcessed}/${totalDays} días ==========`);
            console.log(`       ⏱️  Tiempo transcurrido: ${(elapsedTime / 1000 / 60).toFixed(1)} min`);
            console.log(`       📊 Promedio por día: ${(avgDuration / 1000).toFixed(1)}s`);
            console.log(`       📊 Día más lento: ${(Math.max(...dayDurations) / 1000).toFixed(1)}s`);
            console.log(`       📊 ETA restante: ${estimatedRemaining.toFixed(1)} min`);
            console.log(`    =============================================\n`);
            
            await this.sleep(1000);
          }
        } catch (dayError) {
          const dayDuration = Date.now() - dayStart;
          console.error(`    ✗ Error en ${dateStr} después de ${(dayDuration/1000).toFixed(1)}s:`, dayError.message);
          
          if (dayError.message.includes('RATE_LIMIT_EXCEEDED') || 
              dayError.message.includes('Query timeout')) {
            console.warn(`    ⚠️  Error recuperable, continuando con siguiente día...`);
          } else {
            throw dayError;
          }
        }
        
        currentDate.setDate(currentDate.getDate() - 1);
      }

      await this.pool.execute(`
        UPDATE sync_queue
        SET status = 'completed', completed_at = NOW()
        WHERE id = ?
      `, [task.id]);

      const weekDuration = Date.now() - weekStartTime;
      console.log(`\n✅ [${customerId}] ✅ SEMANA ${task.week_number} COMPLETADA`);
      console.log(`   ⏱️  Tiempo total: ${(weekDuration / 1000 / 60).toFixed(1)} min`);
      console.log(`   📊 Días procesados: ${daysProcessed}/${totalDays}`);
      
      if (dayDurations.length > 0) {
        const avgDuration = dayDurations.reduce((a,b) => a+b, 0) / dayDurations.length;
        console.log(`   📊 Promedio por día: ${(avgDuration / 1000).toFixed(1)}s`);
        console.log(`   📊 Día más lento: ${(Math.max(...dayDurations) / 1000).toFixed(1)}s`);
        console.log(`   📊 Día más rápido: ${(Math.min(...dayDurations) / 1000).toFixed(1)}s\n`);
      }

      return true;

    } catch (error) {
      const weekDuration = Date.now() - weekStartTime;
      console.error(`\n❌ [${customerId}] Error en semana después de ${(weekDuration / 1000 / 60).toFixed(1)} min:`, error.message);
      
      try {
        const [task] = await this.pool.execute(`
          SELECT * FROM sync_queue 
          WHERE customer_id = ? AND status = 'processing'
          ORDER BY id DESC LIMIT 1
        `, [customerId]);

        if (task.length > 0) {
          const status = task[0].attempts >= task[0].max_attempts ? 'failed' : 'pending';
          const errorMsg = error.message.substring(0, 500);
          
          await this.pool.execute(`
            UPDATE sync_queue
            SET status = ?, error_message = ?
            WHERE id = ?
          `, [status, errorMsg, task[0].id]);
          
          console.log(`   📝 Estado actualizado a '${status}' (intento ${task[0].attempts}/${task[0].max_attempts})`);
        }
      } catch (updateError) {
        console.error(`❌ Error actualizando estado:`, updateError.message);
      }

      throw error;
    }
  }

  async getCustomerClient(customerId) {
    try {
      console.log(`\n🔑 [getCustomerClient] Buscando credenciales para: ${customerId}`);
      
      const [accountInfo] = await this.pool.execute(`
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
      
      let tokenRow;
      const searchId = account.parent_account_id || customerId;
      
      if (account.parent_account_id) {
        console.log(`   🏢 Buscando token del MCC padre: ${account.parent_account_id}`);
      } else {
        console.log(`   👤 Buscando token propio de la cuenta`);
      }
      
      [tokenRow] = await this.pool.execute(`
        SELECT refresh_token, customer_id as token_owner, is_mcc
        FROM tokens
        WHERE customer_id = ?
        LIMIT 1
      `, [searchId]);
      
      if (!tokenRow.length) {
        throw new Error(`No se encontró token para ${searchId}`);
      }
      
      const { refresh_token, token_owner, is_mcc } = tokenRow[0];
      const tokenIsMcc = is_mcc === 1;
      
      console.log(`   ✅ Token encontrado: ${token_owner}`);
      console.log(`   ℹ️  Token es de MCC: ${tokenIsMcc ? 'Sí' : 'No'}`);
      
      if (account.is_mcc === 1) {
        throw new Error(`No se puede sincronizar ${customerId} porque es una cuenta MCC`);
      }
      
      const clientConfig = {
        customer_id: customerId,
        refresh_token,
      };
      
      if (tokenIsMcc) {
        clientConfig.login_customer_id = token_owner;
        console.log(`   🏢 Usando login_customer_id: ${token_owner}`);
      }
      
      console.log(`   🎯 Customer ID final: ${customerId}`);
      console.log(`   ✅ Configuración lista\n`);
      
      const customer = this.googleAdsClient.Customer(clientConfig);

      return { 
        customer, 
        finalCustomerId: customerId
      };
      
    } catch (error) {
      console.error(`❌ Error obteniendo cliente:`, error.message);
      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      processingCount: this.processingAccounts.size,
      maxConcurrent: this.maxConcurrent,
      processingAccounts: Array.from(this.processingAccounts),
      abortControllersActive: this.abortControllers.size
    };
  }

  stop() {
    console.log("🛑 Deteniendo procesador...");
    this.isRunning = false;
    
    for (const [customerId, controller] of this.abortControllers.entries()) {
      console.log(`🛑 Cancelando ${customerId}...`);
      controller.abort();
    }
  }
}

export default AccountSyncQueueConcurrent;
