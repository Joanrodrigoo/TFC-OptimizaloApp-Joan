import mysql from 'mysql2/promise';

async function test() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'mi_saas'
  });

  try {
    const [queueTasks] = await pool.execute(`
      SELECT 
        COUNT(*) as totalTasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM sync_queue
      WHERE customer_id = ?
    `, ['non_existent_123']);
    
    console.log("Result:", queueTasks[0]);
    console.log("Pending:", queueTasks[0].pending);
    console.log("isCompleted:", queueTasks[0].pending === 0 && queueTasks[0].processing === 0 && queueTasks[0].failed === 0);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

test();
