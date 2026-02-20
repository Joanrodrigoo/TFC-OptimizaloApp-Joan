
// syncUtils.js
// Utilidades para gestión de sincronización

/**
 * Crea tareas de sincronización para una cuenta nueva (4 semanas)
 * @param {Object} pool - Pool de conexiones MySQL
 * @param {string} customerId - ID del cliente de Google Ads
 * @returns {Promise<Object>} Resultado de la operación
 */
/**
 * Crea tareas de sincronización para una cuenta nueva (15 días)
 * Excluye HOY y AYER para evitar datos incompletos
 */
export async function createSyncTasks(pool, customerId) {
  try {
    console.log(`\n📅 Creando tareas de sincronización para ${customerId}...`);

    // 🔥 DÍAS A SINCRONIZAR: 15 días
    const DAYS_TO_SYNC = 15;
    
    // 🔥 Calcular fechas excluyendo SOLO HOY
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 🔥 HASTA AYER (hace 1 día) - Excluir solo HOY
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1); // AYER ← ÚLTIMO DÍA INCLUIDO
    
    // Restar DAYS_TO_SYNC días
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (DAYS_TO_SYNC - 1)); // -14 días adicionales = 15 días total
    
    console.log(`📆 Rango de sincronización:`);
    console.log(`   Desde: ${startDate.toISOString().split('T')[0]} (hace ${DAYS_TO_SYNC} días)`);
    console.log(`   Hasta: ${endDate.toISOString().split('T')[0]} (AYER) ✅ INCLUIDO`);
    console.log(`   Total: ${DAYS_TO_SYNC} días`);
    console.log(`   ❌ Excluido: SOLO HOY (${today.toISOString().split('T')[0]})`);

    // Dividir en semanas (semanas de 7 días)
    const weeks = [];
    let currentStart = new Date(startDate);

    while (currentStart <= endDate) {
      let weekEnd = new Date(currentStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // 7 días por semana

      if (weekEnd > endDate) {
        weekEnd = new Date(endDate);
      }

      weeks.push({
        start: new Date(currentStart),
        end: new Date(weekEnd),
      });

      currentStart = new Date(weekEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    console.log(`📊 Dividido en ${weeks.length} semanas:`);
    weeks.forEach((week, index) => {
      const days = Math.ceil((week.end - week.start) / (1000 * 60 * 60 * 24)) + 1;
      console.log(`   Semana ${index + 1}: ${week.start.toISOString().split('T')[0]} → ${week.end.toISOString().split('T')[0]} (${days} días)`);
    });

    // Insertar tareas en la base de datos
    let createdCount = 0;
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      const startDateStr = week.start.toISOString().split("T")[0];
      const endDateStr = week.end.toISOString().split("T")[0];

      try {
        await pool.execute(
          `INSERT INTO sync_queue 
           (customer_id, week_number, start_date, end_date, status, created_at)
           VALUES (?, ?, ?, ?, 'pending', NOW())
           ON DUPLICATE KEY UPDATE status = 'pending', attempts = 0`,
          [customerId, i + 1, startDateStr, endDateStr]
        );
        createdCount++;
      } catch (error) {
        console.error(`❌ Error insertando semana ${i + 1}:`, error.message);
      }
    }

    console.log(`✅ ${createdCount}/${weeks.length} tareas creadas para ${customerId}\n`);

    return {
      customerId,
      weeks: weeks.length,
      created: createdCount,
      days: DAYS_TO_SYNC,
    };
  } catch (error) {
    console.error(`❌ Error creando tareas para ${customerId}:`, error);
    return {
      customerId,
      weeks: 0,
      created: 0,
      error: error.message,
    };
  }
}


/**
 * Crea tarea diaria para sincronizar el día de ayer
 * (Solo si ya existen datos históricos)
 */
export async function createDailyTask(pool, customerId) {
  const conn = await pool.getConnection();
  
  try {
    // 0️⃣ Verificar si la cuenta es MCC
    const [accountInfo] = await conn.execute(
      `SELECT is_mcc, name FROM accounts WHERE customer_id = ?`,
      [customerId]
    );
    
    if (!accountInfo.length) {
      return {
        created: false,
        reason: 'account_not_found',
        message: 'Cuenta no encontrada'
      };
    }
    
    if (accountInfo[0].is_mcc === 1) {
      return {
        created: false,
        reason: 'is_mcc_account',
        message: 'Las cuentas MCC no se pueden sincronizar'
      };
    }
    
    // 1️⃣ Calcular ayer
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    
    // 2️⃣ Verificar si ya existe tarea para ayer
    const [existing] = await conn.execute(
      `SELECT COUNT(*) as count FROM sync_queue 
       WHERE customer_id = ? 
         AND start_date = ? 
         AND end_date = ?
         AND status IN ('pending', 'processing', 'completed')`,
      [customerId, yesterdayStr, yesterdayStr]
    );

    if (existing[0].count > 0) {
      console.log(`  ℹ️ ${customerId}: Ya existe tarea para ${yesterdayStr}`);
      return {
        created: false,
        reason: 'task_already_exists',
        message: `Ya existe tarea para ${yesterdayStr}`,
        date: yesterdayStr
      };
    }

    // 3️⃣ Crear tarea diaria
    await conn.execute(
      `INSERT INTO sync_queue (customer_id, start_date, end_date, week_number, task_type, status, max_attempts)
       VALUES (?, ?, ?, NULL, 'daily', 'pending', 3)`,
      [customerId, yesterdayStr, yesterdayStr]
    );
    
    console.log(`  ✅ ${customerId} (${accountInfo[0].name}): Tarea diaria creada (${yesterdayStr})`);
    
    return {
      created: true,
      customerId,
      accountName: accountInfo[0].name,
      taskType: 'daily',
      date: yesterdayStr
    };
    
  } catch (error) {
    console.error(`❌ Error creando tarea diaria para ${customerId}:`, error);
    throw error;
  } finally {
    conn.release();
  }
}


/**
 * Obtiene el estado de sincronización de una cuenta
 * Incluye métricas detalladas y progreso por días
 */
export async function getSyncStatus(pool, customerId) {
  const [tasks] = await pool.execute(
    `SELECT * FROM sync_queue 
     WHERE customer_id = ? 
     ORDER BY start_date ASC, id ASC`,
    [customerId]
  );
  
  if (tasks.length === 0) {
    return null;
  }
  
  // 📊 Calcular estadísticas básicas
  const completed = tasks.filter(t => t.status === 'completed').length;
  const processing = tasks.filter(t => t.status === 'processing').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const total = tasks.length;
  
  const dailyTasks = tasks.filter(t => t.task_type === 'daily');
  const weeklyTasks = tasks.filter(t => t.task_type === 'weekly');
  
  // 📅 Calcular días totales y completados
  const calculateDays = (tasksList) => {
    return tasksList.reduce((sum, task) => {
      const start = new Date(task.start_date);
      const end = new Date(task.end_date);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      return sum + days;
    }, 0);
  };
  
  const totalDays = calculateDays(tasks);
  const completedDays = calculateDays(tasks.filter(t => t.status === 'completed'));
  const pendingDays = calculateDays(tasks.filter(t => t.status === 'pending'));
  const failedDays = calculateDays(tasks.filter(t => t.status === 'failed'));
  
  // 📆 Obtener rango de fechas global
  const allStartDates = tasks.map(t => new Date(t.start_date)).filter(d => !isNaN(d));
  const allEndDates = tasks.map(t => new Date(t.end_date)).filter(d => !isNaN(d));
  
  const globalStartDate = allStartDates.length > 0 
    ? new Date(Math.min(...allStartDates))
    : null;
  
  const globalEndDate = allEndDates.length > 0 
    ? new Date(Math.max(...allEndDates))
    : null;
  
  // ⏱️ Calcular tiempo estimado restante (basado en tareas completadas)
  const completedTasksWithTime = tasks.filter(t => 
    t.status === 'completed' && t.started_at && t.completed_at
  );
  
  let avgTimePerTask = null;
  let estimatedTimeRemaining = null;
  
  if (completedTasksWithTime.length > 0) {
    const totalTime = completedTasksWithTime.reduce((sum, t) => {
      const start = new Date(t.started_at);
      const end = new Date(t.completed_at);
      return sum + (end - start);
    }, 0);
    
    avgTimePerTask = Math.round(totalTime / completedTasksWithTime.length / 1000); // segundos
    const remainingTasks = pending + processing;
    estimatedTimeRemaining = avgTimePerTask * remainingTasks;
  }
  
  // 🎯 Determinar estado general
  const overallStatus = failed > 0 ? 'error' :
                       processing > 0 ? 'syncing' :
                       pending > 0 ? 'pending' :
                       completed === total ? 'completed' : 'unknown';
  
  return {
    customerId,
    overallStatus,
    
    // 📊 Estadísticas de tareas
    tasks: {
      total,
      completed,
      processing,
      pending,
      failed,
      progressPercentage: Math.round((completed / total) * 100)
    },
    
    // 📅 Estadísticas de días
    days: {
      total: totalDays,
      completed: completedDays,
      pending: pendingDays,
      failed: failedDays,
      progressPercentage: Math.round((completedDays / totalDays) * 100)
    },
    
    // 📆 Rango de fechas
    dateRange: {
      start: globalStartDate ? globalStartDate.toISOString().split('T')[0] : null,
      end: globalEndDate ? globalEndDate.toISOString().split('T')[0] : null,
      totalDays
    },
    
    // ⏱️ Tiempos
    timing: {
      avgSecondsPerTask: avgTimePerTask,
      estimatedSecondsRemaining: estimatedTimeRemaining,
      estimatedMinutesRemaining: estimatedTimeRemaining ? Math.round(estimatedTimeRemaining / 60) : null
    },
    
    // 📋 Desglose por tipo
    byType: {
      daily: {
        total: dailyTasks.length,
        completed: dailyTasks.filter(t => t.status === 'completed').length,
        pending: dailyTasks.filter(t => t.status === 'pending').length,
        failed: dailyTasks.filter(t => t.status === 'failed').length
      },
      weekly: {
        total: weeklyTasks.length,
        completed: weeklyTasks.filter(t => t.status === 'completed').length,
        pending: weeklyTasks.filter(t => t.status === 'pending').length,
        failed: weeklyTasks.filter(t => t.status === 'failed').length
      }
    },
    
    // 📝 Lista detallada de tareas
    taskList: tasks.map(t => {
      const start = new Date(t.start_date);
      const end = new Date(t.end_date);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      
      let duration = null;
      if (t.started_at && t.completed_at) {
        const startTime = new Date(t.started_at);
        const endTime = new Date(t.completed_at);
        duration = Math.round((endTime - startTime) / 1000); // segundos
      }
      
      return {
        id: t.id,
        type: t.task_type,
        week: t.week_number,
        dateRange: t.task_type === 'daily' 
          ? t.start_date 
          : `${t.start_date} → ${t.end_date}`,
        days,
        status: t.status,
        attempts: t.attempts,
        maxAttempts: t.max_attempts,
        durationSeconds: duration,
        startedAt: t.started_at,
        completedAt: t.completed_at,
        errorMessage: t.error_message
      };
    })
  };
}


/**
 * Limpia tareas completadas de la cola
 * Útil para mantener la tabla limpia después de sincronizaciones exitosas
 */
export async function cleanCompletedTasks(pool, customerId, options = {}) {
  const { taskType = null, olderThanDays = null } = options;
  
  let query = `DELETE FROM sync_queue WHERE customer_id = ? AND status = 'completed'`;
  const params = [customerId];
  
  // Filtrar por tipo de tarea
  if (taskType) {
    query += ` AND task_type = ?`;
    params.push(taskType);
  }
  
  // Filtrar por antigüedad
  if (olderThanDays) {
    query += ` AND completed_at < DATE_SUB(NOW(), INTERVAL ? DAY)`;
    params.push(olderThanDays);
  }
  
  const [result] = await pool.execute(query, params);
  
  console.log(`  🧹 ${customerId}: ${result.affectedRows} tareas completadas eliminadas`);
  
  return {
    deleted: result.affectedRows,
    customerId,
    filters: {
      taskType: taskType || 'all',
      olderThanDays: olderThanDays || null
    }
  };
}


/**
 * Reintenta tareas fallidas
 * Resetea el contador de intentos y el estado a 'pending'
 */
export async function retryFailedTasks(pool, customerId, options = {}) {
  const { taskType = null, maxAttempts = null } = options;
  
  let query = `UPDATE sync_queue 
               SET status = 'pending', 
                   error_message = NULL, 
                   attempts = 0,
                   started_at = NULL,
                   completed_at = NULL
               WHERE customer_id = ? AND status = 'failed'`;
  const params = [customerId];
  
  // Filtrar por tipo de tarea
  if (taskType) {
    query += ` AND task_type = ?`;
    params.push(taskType);
  }
  
  // Filtrar por número máximo de intentos previos
  if (maxAttempts !== null) {
    query += ` AND attempts <= ?`;
    params.push(maxAttempts);
  }
  
  const [result] = await pool.execute(query, params);
  
  console.log(`  🔄 ${customerId}: ${result.affectedRows} tareas fallidas reintentadas`);
  
  return {
    retried: result.affectedRows,
    customerId,
    filters: {
      taskType: taskType || 'all',
      maxAttempts
    }
  };
}


/**
 * Cancela tareas pendientes o en proceso
 * Útil para detener sincronizaciones en curso
 */
export async function cancelPendingTasks(pool, customerId, options = {}) {
  const { taskType = null, includeProcessing = false } = options;
  
  const statuses = includeProcessing 
    ? ['pending', 'processing'] 
    : ['pending'];
  
  let query = `DELETE FROM sync_queue 
               WHERE customer_id = ? 
               AND status IN (${statuses.map(() => '?').join(',')})`;
  const params = [customerId, ...statuses];
  
  if (taskType) {
    query += ` AND task_type = ?`;
    params.push(taskType);
  }
  
  const [result] = await pool.execute(query, params);
  
  console.log(`  ❌ ${customerId}: ${result.affectedRows} tareas canceladas`);
  
  return {
    cancelled: result.affectedRows,
    customerId,
    filters: {
      taskType: taskType || 'all',
      includeProcessing
    }
  };
}


/**
 * Obtiene resumen de todas las cuentas en sincronización
 * Útil para dashboards y monitoreo global
 */
export async function getAllSyncStatuses(pool) {
  const [tasks] = await pool.execute(
    `SELECT 
       customer_id,
       COUNT(*) as total_tasks,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
       MIN(start_date) as first_date,
       MAX(end_date) as last_date
     FROM sync_queue
     GROUP BY customer_id
     ORDER BY 
       CASE 
         WHEN SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) > 0 THEN 1
         WHEN SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) > 0 THEN 2
         WHEN SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) > 0 THEN 3
         ELSE 4
       END,
       customer_id`
  );
  
  return tasks.map(t => ({
    customerId: t.customer_id,
    tasks: {
      total: t.total_tasks,
      completed: t.completed,
      processing: t.processing,
      pending: t.pending,
      failed: t.failed,
      progressPercentage: Math.round((t.completed / t.total_tasks) * 100)
    },
    dateRange: {
      start: t.first_date,
      end: t.last_date
    },
    status: t.processing > 0 ? 'syncing' :
            t.pending > 0 ? 'pending' :
            t.failed > 0 ? 'error' :
            t.completed === t.total_tasks ? 'completed' : 'unknown'
  }));
}