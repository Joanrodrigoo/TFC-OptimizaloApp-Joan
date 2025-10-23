// syncUtils.js
// Utilidades para gestión de sincronización

/**
 * Crea tareas de sincronización para una cuenta nueva (4 semanas)
 * @param {Object} pool - Pool de conexiones MySQL
 * @param {string} customerId - ID del cliente de Google Ads
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function createSyncTasks(pool, customerId) {
  const conn = await pool.getConnection();
  
  try {
    // 0️⃣ Verificar si la cuenta es MCC
    const [accountInfo] = await conn.execute(
      `SELECT is_mcc, name FROM accounts WHERE customer_id = ?`,
      [customerId]
    );
    
    if (!accountInfo.length) {
      console.log(`  ⚠️ ${customerId} no encontrada en la tabla accounts`);
      return {
        created: false,
        reason: 'account_not_found',
        message: 'Cuenta no encontrada en la base de datos'
      };
    }
    
    const isMcc = accountInfo[0].is_mcc === 1;
    
    if (isMcc) {
      console.log(`  🚫 ${customerId} es una cuenta MCC, no se puede sincronizar directamente`);
      return {
        created: false,
        reason: 'is_mcc_account',
        message: 'Las cuentas MCC no se pueden sincronizar. Sincroniza sus cuentas hijas individualmente.',
        accountName: accountInfo[0].name
      };
    }
    
    // 1️⃣ Verificar si ya tiene datos históricos
    const [rows] = await conn.execute(
      `SELECT COUNT(*) AS total FROM campaign_metrics_history WHERE customer_id = ?`,
      [customerId]
    );
    
    const isNewCustomer = rows[0].total === 0;
    
    if (!isNewCustomer) {
      console.log(`  ℹ️ ${customerId} ya tiene datos históricos, saltando...`);
      return { 
        created: false, 
        reason: 'already_has_data',
        message: 'Cliente ya tiene datos históricos'
      };
    }

    // 2️⃣ Verificar si ya hay tareas pendientes
    const [existing] = await conn.execute(
      `SELECT COUNT(*) as count FROM sync_queue 
       WHERE customer_id = ? AND status IN ('pending', 'processing')`,
      [customerId]
    );

    if (existing[0].count > 0) {
      console.log(`  ⚠️ ${customerId} ya tiene ${existing[0].count} tareas programadas`);
      return {
        created: false,
        reason: 'tasks_already_exist',
        message: `Ya existen ${existing[0].count} tareas programadas`,
        existingTasks: existing[0].count
      };
    }

    // 3️⃣ Limpiar tareas fallidas anteriores
    await conn.execute(
      `DELETE FROM sync_queue WHERE customer_id = ? AND status = 'failed'`,
      [customerId]
    );
    
    // 4️⃣ Crear bloques de 7 días (4 semanas hacia atrás desde ayer)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const weeks = [];
    let currentEnd = new Date(yesterday);
    
    for (let week = 1; week <= 4; week++) {
      const currentStart = new Date(currentEnd);
      currentStart.setDate(currentEnd.getDate() - 6);
      
      weeks.push({
        week_number: week,
        start: currentStart.toISOString().split("T")[0],
        end: currentEnd.toISOString().split("T")[0]
      });
      
      // Retroceder una semana para la siguiente iteración
      currentEnd.setDate(currentEnd.getDate() - 7);
    }
    
    // 5️⃣ Insertar semanas en la cola
    for (const week of weeks) {
      await conn.execute(
        `INSERT INTO sync_queue (customer_id, start_date, end_date, week_number, task_type, status, max_attempts)
         VALUES (?, ?, ?, ?, 'weekly', 'pending', 3)`,
        [customerId, week.start, week.end, week.week_number]
      );
    }
    
    console.log(`  ✅ ${customerId} (${accountInfo[0].name}): ${weeks.length} semanas programadas`);
    
    return {
      created: true,
      customerId,
      accountName: accountInfo[0].name,
      taskType: 'weekly',
      weeksCreated: weeks.length,
      weeks: weeks.map(w => ({
        week: w.week_number,
        range: `${w.start} → ${w.end}`
      }))
    };
    
  } catch (error) {
    console.error(`❌ Error creando tareas para ${customerId}:`, error);
    throw error;
  } finally {
    conn.release();
  }
}


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


export async function getSyncStatus(pool, customerId) {
  const [tasks] = await pool.execute(
    `SELECT * FROM sync_queue 
     WHERE customer_id = ? 
     ORDER BY 
       CASE task_type 
         WHEN 'daily' THEN 0 
         WHEN 'weekly' THEN 1 
       END,
       start_date DESC`,
    [customerId]
  );
  
  if (tasks.length === 0) {
    return null;
  }
  
  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const dailyTasks = tasks.filter(t => t.task_type === 'daily');
  const weeklyTasks = tasks.filter(t => t.task_type === 'weekly');
  
  // 🔥 NUEVO: Calcular días totales y completados
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
  
  // 🔥 NUEVO: Obtener rango de fechas global
  const allStartDates = tasks.map(t => new Date(t.start_date)).filter(d => !isNaN(d));
  const allEndDates = tasks.map(t => new Date(t.end_date)).filter(d => !isNaN(d));
  
  const globalStartDate = allStartDates.length > 0 
    ? new Date(Math.min(...allStartDates))
    : null;
  
  const globalEndDate = allEndDates.length > 0 
    ? new Date(Math.max(...allEndDates))
    : null;
  
  return {
    customerId,
    totalTasks: total,
    completed,
    processing: tasks.filter(t => t.status === 'processing').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    progressPercentage: Math.round((completed / total) * 100),
    isCompleted: completed === total,
    
    // 🔥 NUEVO: Información de días
    totalDays,
    completedDays,
    startDate: globalStartDate ? globalStartDate.toISOString().split('T')[0] : null,
    endDate: globalEndDate ? globalEndDate.toISOString().split('T')[0] : null,
    
    dailyTasks: {
      total: dailyTasks.length,
      completed: dailyTasks.filter(t => t.status === 'completed').length,
      pending: dailyTasks.filter(t => t.status === 'pending').length
    },
    weeklyTasks: {
      total: weeklyTasks.length,
      completed: weeklyTasks.filter(t => t.status === 'completed').length,
      pending: weeklyTasks.filter(t => t.status === 'pending').length
    },
    tasks: tasks.map(t => ({
      id: t.id,
      type: t.task_type,
      week: t.week_number,
      dateRange: t.task_type === 'daily' 
        ? t.start_date 
        : `${t.start_date} → ${t.end_date}`,
      status: t.status,
      attempts: t.attempts,
      maxAttempts: t.max_attempts,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      errorMessage: t.error_message
    }))
  };
}


export async function cleanCompletedTasks(pool, customerId, taskType = null) {
  let query = `DELETE FROM sync_queue WHERE customer_id = ? AND status = 'completed'`;
  const params = [customerId];
  
  if (taskType) {
    query += ` AND task_type = ?`;
    params.push(taskType);
  }
  
  const [result] = await pool.execute(query, params);
  
  return {
    deleted: result.affectedRows,
    customerId,
    taskType: taskType || 'all'
  };
}


export async function retryFailedTasks(pool, customerId) {
  const [result] = await pool.execute(
    `UPDATE sync_queue 
     SET status = 'pending', error_message = NULL, attempts = 0
     WHERE customer_id = ? AND status = 'failed'`,
    [customerId]
  );
  
  return {
    retried: result.affectedRows,
    customerId
  };
}