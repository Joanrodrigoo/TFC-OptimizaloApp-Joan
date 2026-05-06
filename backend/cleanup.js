import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

async function runCleanup() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'mi_saas',
    multipleStatements: true
  });

  try {
    console.log("Iniciando limpieza de la base de datos...");
    
    // Deshabilitar restricciones de foreign keys para borrar sin problemas
    await pool.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    const queries = [
      "DELETE FROM users WHERE id != 99;",
      "DELETE FROM subscriptions WHERE user_id != 99;",
      "DELETE FROM tokens WHERE user_id != 99;",
      "DELETE FROM accounts WHERE customer_id != '1234567890';",
      "DELETE FROM campaign_metrics_history WHERE customer_id != '1234567890';",
      "DELETE FROM ad_groups WHERE customer_id != '1234567890';",
      "DELETE FROM ads WHERE customer_id != '1234567890';",
      "DELETE FROM keywords WHERE customer_id != '1234567890';",
      "DELETE FROM search_terms WHERE customer_id != '1234567890';",
      "DELETE FROM recomendaciones WHERE customer_id != '1234567890';",
      "DELETE FROM asset_groups WHERE customer_id != '1234567890';",
      "DELETE FROM asset_group_assets WHERE customer_id != '1234567890';",
      "DELETE FROM audience_segments WHERE customer_id != '1234567890';",
      "DELETE FROM sync_queue WHERE customer_id != '1234567890';",
      "DELETE FROM analysis_queue WHERE customer_id != '1234567890';"
    ];

    for (const q of queries) {
      await pool.query(q);
      console.log("Ejecutado: " + q);
    }
    
    // Y actualizamos el nombre del usuario si estaba como 'Demo User'
    await pool.query("UPDATE users SET name = 'TechStore Pro' WHERE id = 99;");
    console.log("Actualizado nombre a TechStore Pro");

    await pool.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log("Limpieza completada correctamente. Solo queda el usuario 99 y la cuenta 1234567890.");
  } catch (error) {
    console.error("Error limpiando BD:", error);
  } finally {
    await pool.end();
  }
}

runCleanup();
