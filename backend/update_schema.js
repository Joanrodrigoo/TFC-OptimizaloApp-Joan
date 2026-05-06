import mysql from 'mysql2/promise';

async function updateSchema() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    database: 'mi_saas'
  });

  try {
    await connection.query(`
      ALTER TABLE recomendaciones 
      MODIFY COLUMN estado enum('activa','pendiente','resuelta','descartada','aplicada') DEFAULT 'pendiente',
      ADD COLUMN mejora_real varchar(255) DEFAULT NULL,
      ADD COLUMN periodo_comparacion varchar(255) DEFAULT NULL,
      ADD COLUMN variacion_kpi float DEFAULT NULL
    `);
    console.log("Tabla recomendaciones actualizada.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await connection.end();
  }
}

updateSchema();
