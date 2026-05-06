// db.js - POOL MYSQL OPTIMIZADO PARA OPERACIONES LARGAS (IA)
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// 🔥 CONFIGURACIÓN ROBUSTA DEL POOL PARA ANÁLISIS DE IA
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER ?? 'adminuser',
  password: process.env.DB_PASSWORD ?? 'adminpassword',
  database: process.env.DB_NAME || 'mi_saas',
  
  // ✅ Configuración de conexiones
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 0,
  
  // ⚡ Timeouts válidos en mysql2
  connectTimeout: 60000, // 60 segundos para conectar
  
  // ⚡ Keep-alive para mantener conexiones vivas
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // Ping cada 10 segundos
  
  // ✅ Configuración de MySQL
  timezone: '+00:00',
  dateStrings: false,
  multipleStatements: false,
});

// 🔥 CONFIGURAR TIMEOUTS AL OBTENER CADA CONEXIÓN
pool.on('connection', (connection) => {
  console.log('✅ Nueva conexión MySQL establecida');
  
  // 🔧 Configurar timeouts de sesión usando callbacks (no promesas)
  // El evento 'connection' proporciona una conexión raw sin promise wrapper
  connection.query("SET SESSION wait_timeout = 28800", (err) => {
    if (err) console.error('Error setting wait_timeout:', err);
  });
  connection.query("SET SESSION interactive_timeout = 28800", (err) => {
    if (err) console.error('Error setting interactive_timeout:', err);
  });
  connection.query("SET SESSION net_read_timeout = 600", (err) => {
    if (err) console.error('Error setting net_read_timeout:', err);
  });
  connection.query("SET SESSION net_write_timeout = 600", (err) => {
    if (err) console.error('Error setting net_write_timeout:', err);
  });
});

// 🔥 MANEJO DE ERRORES DEL POOL
pool.on('error', (err) => {
  console.error('❌ Error en pool MySQL:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
    console.log('🔄 MySQL cerró la conexión, el pool creará una nueva automáticamente');
  }
});

pool.on('enqueue', () => {
  console.log('⏳ Esperando conexión disponible en el pool');
});

// 🔥 TEST DE CONEXIÓN INICIAL
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Pool MySQL inicializado correctamente');
    console.log('⚙️  Configuración:');
    console.log('   - Conexiones máximas: 30');
    console.log('   - Timeout de sesión: 8 horas');
    console.log('   - Keep-alive: 10 segundos');
    console.log('   - Optimizado para operaciones largas de IA ✨');
    connection.release();
  } catch (error) {
    console.error('❌ Error al inicializar pool MySQL:', error);
    process.exit(1);
  }
})();

// 🔥 MANEJO DE CIERRE GRACEFUL
const gracefulShutdown = async () => {
  console.log('\n🛑 Cerrando pool MySQL...');
  try {
    await pool.end();
    console.log('✅ Pool MySQL cerrado correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al cerrar pool:', error);
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// 🔥 FUNCIONES HELPER CON RETRY AUTOMÁTICO

/**
 * Obtener conexión con retry automático
 * Usar solo cuando necesites control explícito (transacciones, operaciones multi-query)
 * 
 * @example
 * const conn = await getConnection();
 * try {
 *   await conn.beginTransaction();
 *   await conn.execute('UPDATE ...');
 *   await conn.execute('INSERT ...');
 *   await conn.commit();
 * } finally {
 *   conn.release();
 * }
 */
export async function getConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.getConnection();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`⚠️ Error obteniendo conexión, reintento ${i + 1}/${retries}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Ejecutar query con retry automático
 * Para la mayoría de queries usa esto (manejo automático de conexión)
 */
export async function query(sql, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.query(sql, params);
    } catch (error) {
      if (error.code === 'ECONNRESET' && i < retries - 1) {
        console.log(`⚠️ ECONNRESET detectado, reintento ${i + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}

/**
 * Ejecutar query preparada con retry automático
 * Para la mayoría de queries usa esto (manejo automático de conexión)
 */
export async function execute(sql, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.execute(sql, params);
    } catch (error) {
      if (error.code === 'ECONNRESET' && i < retries - 1) {
        console.log(`⚠️ ECONNRESET detectado, reintento ${i + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}

/**
 * Monitorear estado del pool (útil para debugging)
 */
export function getPoolStats() {
  return {
    totalConnections: pool.pool._allConnections?.length || 0,
    freeConnections: pool.pool._freeConnections?.length || 0,
    activeConnections: (pool.pool._allConnections?.length || 0) - (pool.pool._freeConnections?.length || 0)
  };
}

/**
 * Iniciar monitoreo periódico del pool (opcional)
 */
export function startPoolMonitoring(intervalMs = 30000) {
  return setInterval(() => {
    const stats = getPoolStats();
    console.log(`📊 Pool stats: ${stats.activeConnections}/${stats.totalConnections} activas, ${stats.freeConnections} libres`);
  }, intervalMs);
}

export default pool;