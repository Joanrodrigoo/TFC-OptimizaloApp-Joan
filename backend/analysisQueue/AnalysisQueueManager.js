// analysisQueue/AnalysisQueueManager.js
// OPTIMIZADO: Gestión eficiente de conexiones MySQL para operaciones largas con IA

import fetch from 'node-fetch';

export default class AnalysisQueueManager {
  constructor(pool, options = {}) {
    this.pool = pool;
    this.maxConcurrent = options.maxConcurrent || 2; // Solo 2 análisis simultáneos (IA es costosa)
    this.retryDelay = options.retryDelay || 5000;
    this.apiBase = options.apiBase || 'http://localhost:3000';
    
    this.isRunning = false;
    this.processingAccounts = [];
    this.processedCount = 0;
    this.failedCount = 0;
    this.startTime = null;
  }

  /**
   * Inicia el procesamiento de la cola
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ La cola de análisis ya está en ejecución');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('🤖 INICIANDO COLA DE ANÁLISIS CON IA');
    console.log('='.repeat(80));
    console.log(`⚙️ Concurrencia máxima: ${this.maxConcurrent}`);
    console.log(`🔗 API Base: ${this.apiBase}`);
    console.log('='.repeat(80) + '\n');

    this.isRunning = true;
    this.startTime = Date.now();
    this.processedCount = 0;
    this.failedCount = 0;

    try {
      await this.processQueue();
    } finally {
      this.isRunning = false;
      this.logSummary();
    }
  }

  /**
   * Detiene el procesamiento
   */
  stop() {
    console.log('🛑 Deteniendo cola de análisis...');
    this.isRunning = false;
  }

  /**
   * Procesa la cola de análisis
   */
  async processQueue() {
    while (this.isRunning) {
      // ✅ Obtener tareas pendientes (usa pool.execute directamente)
      const [pendingTasks] = await this.pool.execute(
        `SELECT * FROM analysis_queue 
         WHERE status = 'pending' 
         ORDER BY created_at ASC 
         LIMIT ?`,
        [this.maxConcurrent]
      );

      if (pendingTasks.length === 0) {
        console.log('✅ No hay más tareas de análisis pendientes');
        break;
      }

      console.log(`📋 Procesando ${pendingTasks.length} tareas de análisis...`);

      // Procesar tareas en paralelo (limitado por maxConcurrent)
      const promises = pendingTasks.map(task => this.processTask(task));
      await Promise.allSettled(promises);

      // Pequeña pausa entre lotes
      if (this.isRunning && pendingTasks.length === this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Procesa una tarea individual
   * CRÍTICO: Libera conexión MySQL durante operaciones largas de IA
   */
  async processTask(task) {
    const customerId = task.customer_id;
    this.processingAccounts.push(customerId);

    console.log(`\n🔍 [${task.id}] Analizando cuenta: ${customerId}`);
    console.log(`   📊 Intento: ${task.attempts + 1}/${task.max_attempts}`);

    try {
      // ✅ PASO 1: Marcar como procesando (usa pool.execute directamente)
      await this.pool.execute(
        `UPDATE analysis_queue 
         SET status = 'processing', 
             started_at = NOW(), 
             attempts = attempts + 1 
         WHERE id = ?`,
        [task.id]
      );
      
      // ⚡ CRÍTICO: La conexión se libera automáticamente aquí
      // Ahora podemos hacer la operación larga sin bloquear el pool

      // ✅ PASO 2: Llamar al endpoint de análisis (operación larga, sin conexión MySQL)
      const startTime = Date.now();
      
      // Timeout de seguridad por si el endpoint se cuelga
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutos

      const response = await fetch(
        `${this.apiBase}/api/analyze?customerId=${encodeURIComponent(customerId)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        }
      );
      clearTimeout(timeout);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      // Parsear respuesta
      let recommendations = [];
      try {
        recommendations = JSON.parse(result.respuesta || '[]');
      } catch (e) {
        console.warn(`⚠️ Error parseando recomendaciones:`, e.message);
      }

      console.log(`✅ [${task.id}] Análisis completado en ${duration}s`);
      console.log(`   💡 Recomendaciones generadas: ${recommendations.length}`);

      // ✅ PASO 3: Actualizar resultado (nueva conexión automática del pool)
      await this.pool.execute(
        `UPDATE analysis_queue 
         SET status = 'completed', 
             completed_at = NOW(),
             recommendations_count = ?,
             processing_time_seconds = ?
         WHERE id = ?`,
        [recommendations.length, parseFloat(duration), task.id]
      );

      this.processedCount++;

    } catch (error) {
      console.error(`❌ [${task.id}] Error procesando análisis:`, error.message);

      // ✅ Actualizar error (usa pool.execute directamente)
      try {
        // Verificar si debe reintentar
        if (task.attempts + 1 < task.max_attempts) {
          console.log(`   🔄 Reintentará automáticamente (${task.attempts + 2}/${task.max_attempts})`);
          
          await this.pool.execute(
            `UPDATE analysis_queue 
             SET status = 'pending',
                 error_message = ?,
                 last_error_at = NOW()
             WHERE id = ?`,
            [error.message.substring(0, 500), task.id]
          );
        } else {
          console.log(`   ⛔ Máximo de intentos alcanzado, marcando como fallida`);
          
          await this.pool.execute(
            `UPDATE analysis_queue 
             SET status = 'failed',
                 error_message = ?,
                 completed_at = NOW()
             WHERE id = ?`,
            [error.message.substring(0, 500), task.id]
          );

          this.failedCount++;
        }
      } catch (updateError) {
        console.error(`❌ Error actualizando estado en BD:`, updateError.message);
      }
    } finally {
      // Remover de procesando
      this.processingAccounts = this.processingAccounts.filter(id => id !== customerId);
    }
  }

  /**
   * Obtiene el estado actual de la cola
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      processingAccounts: this.processingAccounts,
      processingCount: this.processingAccounts.length,
      maxConcurrent: this.maxConcurrent,
      processedCount: this.processedCount,
      failedCount: this.failedCount,
      successRate: this.processedCount + this.failedCount > 0 
        ? Math.round((this.processedCount / (this.processedCount + this.failedCount)) * 100) 
        : 0
    };
  }

  /**
   * Muestra resumen final
   */
  logSummary() {
    const duration = this.startTime 
      ? ((Date.now() - this.startTime) / 1000 / 60).toFixed(2) 
      : 0;

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN DE ANÁLISIS CON IA');
    console.log('='.repeat(80));
    console.log(`⏱️  Tiempo total: ${duration} minutos`);
    console.log(`✅ Análisis exitosos: ${this.processedCount}`);
    console.log(`❌ Análisis fallidos: ${this.failedCount}`);
    console.log(`📈 Tasa de éxito: ${this.getStatus().successRate}%`);
    console.log('='.repeat(80) + '\n');
  }
}