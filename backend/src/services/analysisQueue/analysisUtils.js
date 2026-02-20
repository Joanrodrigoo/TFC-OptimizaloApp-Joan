// analysisQueue/analysisUtils.js

/**
 * Crea una tarea de análisis semanal para una cuenta
 */
export async function createWeeklyAnalysisTask(pool, customerId) {
  const conn = await pool.getConnection();
  try {
    // Verificar si ya existe una tarea de análisis pendiente o en proceso
    const [existing] = await conn.execute(
      `SELECT id, status FROM analysis_queue 
       WHERE customer_id = ? 
       AND status IN ('pending', 'processing')
       LIMIT 1`,
      [customerId]
    );

    if (existing.length > 0) {
      console.log(`ℹ️ ${customerId}: Ya tiene análisis en cola (${existing[0].status})`);
      return {
        created: false,
        reason: 'task_already_exists',
        taskId: existing[0].id,
        status: existing[0].status
      };
    }

    // Crear nueva tarea de análisis
    const [result] = await conn.execute(
      `INSERT INTO analysis_queue 
       (customer_id, status, created_at, max_attempts) 
       VALUES (?, 'pending', NOW(), 3)`,
      [customerId]
    );

    console.log(`✅ ${customerId}: Tarea de análisis creada (ID: ${result.insertId})`);

    return {
      created: true,
      taskId: result.insertId,
      customerId
    };

  } catch (error) {
    console.error(`❌ Error creando tarea de análisis para ${customerId}:`, error);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Obtiene el estado de análisis de una cuenta
 */
export async function getAnalysisStatus(pool, customerId) {
  const [tasks] = await pool.execute(
    `SELECT * FROM analysis_queue 
     WHERE customer_id = ? 
     ORDER BY created_at DESC 
     LIMIT 10`,
    [customerId]
  );

  if (tasks.length === 0) {
    return null;
  }

  const pending = tasks.filter(t => t.status === 'pending').length;
  const processing = tasks.filter(t => t.status === 'processing').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;

  return {
    customerId,
    totalTasks: tasks.length,
    pending,
    processing,
    completed,
    failed,
    lastTask: tasks[0] ? {
      id: tasks[0].id,
      status: tasks[0].status,
      createdAt: tasks[0].created_at,
      startedAt: tasks[0].started_at,
      completedAt: tasks[0].completed_at,
      errorMessage: tasks[0].error_message
    } : null,
    tasks: tasks.map(t => ({
      id: t.id,
      status: t.status,
      attempts: t.attempts,
      createdAt: t.created_at,
      completedAt: t.completed_at,
      errorMessage: t.error_message
    }))
  };
}

/**
 * Limpia tareas completadas antiguas
 */
export async function cleanOldAnalysisTasks(pool, daysOld = 30) {
  const [result] = await pool.execute(
    `DELETE FROM analysis_queue 
     WHERE status = 'completed' 
     AND completed_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [daysOld]
  );

  console.log(`🗑️ Eliminadas ${result.affectedRows} tareas de análisis antiguas`);
  return result.affectedRows;
}