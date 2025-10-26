// db.js - POOL MYSQL SINGLETON MEJORADO
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// 🔥 CONFIGURACIÓN ROBUSTA DEL POOL
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'adminuser',
  password: process.env.DB_PASSWORD || 'adminpassword',
  database: process.env.DB_NAME || 'mi_saas',
  
  // ✅ Configuración de conexiones
  waitForConnections: true,
  connectionLimit: 30, // Total de conexiones simultáneas
  queueLimit: 0, // Sin límite de cola
  
  // ✅ Mantener conexiones vivas
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // ✅ Timeouts para evitar conexiones colgadas
  connectTimeout: 60000, // 60 segundos para conectar
  acquireTimeout: 60000, // 60 segundos para obtener conexión del pool
  
  // ✅ Configuración de MySQL
  timezone: '+00:00',
  dateStrings: false,
  
  // ✅ Manejo de errores de conexión
  multipleStatements: false,
});

// 🔥 MANEJO DE ERRORES DEL POOL
pool.on('connection', (connection) => {
  console.log('✅ Nueva conexión MySQL establecida');
  
  // Configurar timeout de conexión
  connection.on('error', (err) => {
    console.error('❌ Error en conexión MySQL:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.log('🔄 Reconectando...');
    }
  });
});

pool.on('acquire', (connection) => {
  console.log('🔒 Conexión adquirida del pool (ID: %d)', connection.threadId);
});

pool.on('release', (connection) => {
  console.log('🔓 Conexión liberada al pool (ID: %d)', connection.threadId);
});

pool.on('enqueue', () => {
  console.log('⏳ Esperando conexión disponible en el pool');
});

// 🔥 TEST DE CONEXIÓN INICIAL
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Pool MySQL inicializado correctamente');
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

export default pool;