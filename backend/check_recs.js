import mysql from 'mysql2/promise';

async function check() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    database: 'mi_saas'
  });

  try {
    const [rows] = await conn.query('SELECT id, titulo, categoria, tipo_objeto, estado, fecha_creacion FROM recomendaciones ORDER BY fecha_creacion DESC LIMIT 10');
    console.log(`Hay ${rows.length} recomendaciones recientes:`);
    console.table(rows);

    const [count] = await conn.query('SELECT COUNT(*) as total FROM recomendaciones');
    console.log(`Total absoluto de recomendaciones en BD: ${count[0].total}`);
    
    // Check analysis_queue as well to see if there are pending jobs
    const [jobs] = await conn.query('SELECT id, status, completed_at, error_message FROM analysis_queue ORDER BY id DESC LIMIT 5');
    console.log('\nÚltimos 5 trabajos de análisis:');
    console.table(jobs);

  } catch(e) {
    console.error(e);
  } finally {
    await conn.end();
  }
}
check();
