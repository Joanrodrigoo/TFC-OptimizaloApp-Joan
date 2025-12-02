// ========================================
// CRON JOB FINAL - SINCRONIZACIÓN DIARIA
// Versión 3.0 - Con soporte para cuentas hijas usando token del MCC padre
// ========================================

import pool from '../db.js';
import dotenv from "dotenv";
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const LOG_DIR = path.join(__dirname, 'logs');

// ========================================
// CONFIGURACIÓN
// ========================================
const CONFIG = {
  FETCH_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  SERVER_CHECK_TIMEOUT: 10000,
};

// ========================================
// UTILIDADES
// ========================================

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  
  const logFile = path.join(LOG_DIR, `cron-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage + '\n', 'utf8');
}

async function fetchWithTimeout(url, options = {}, timeout = CONFIG.FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

async function retryWithBackoff(fn, maxRetries = CONFIG.MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
      log(`Intento ${attempt}/${maxRetries} falló, reintentando en ${delay}ms...`, 'WARN');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function checkServerHealth() {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/api/health`,
      { method: 'GET' },
      CONFIG.SERVER_CHECK_TIMEOUT
    );
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    return true;
  } catch (error) {
    throw new Error(`Servidor no disponible en ${API_BASE}: ${error.message}`);
  }
}

// ========================================
// VALIDACIÓN DE CREDENCIALES
// ========================================

function validateOAuthCredentials() {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  
  const issues = [];
  
  if (!CLIENT_ID) {
    issues.push('GOOGLE_CLIENT_ID no está configurado');
  } else if (!CLIENT_ID.includes('.apps.googleusercontent.com')) {
    issues.push('GOOGLE_CLIENT_ID tiene formato incorrecto');
  }
  
  if (!CLIENT_SECRET) {
    issues.push('GOOGLE_CLIENT_SECRET no está configurado');
  } else if (CLIENT_SECRET.length < 20) {
    issues.push('GOOGLE_CLIENT_SECRET parece incorrecto (muy corto)');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    clientId: CLIENT_ID ? `${CLIENT_ID.substring(0, 20)}...` : 'NO CONFIGURADO',
  };
}

// ========================================
// FUNCIONES PRINCIPALES
// ========================================

const isTokenExpiring = (expiry) => {
  if (!expiry) return true;
  const now = new Date();
  const expiryTime = new Date(expiry);
  return (expiryTime - now) < 5 * 60 * 1000;
};

const renewAccessToken = async (refreshToken) => {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  
  const res = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Token refresh failed: ${error.error}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  };
};

async function scheduleTaskForAccount(customerId) {
  return retryWithBackoff(async () => {
    const response = await fetchWithTimeout(`${API_BASE}/api/start-daily-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || response.statusText);
    }

    return data;
  });
}

async function startSyncQueue() {
  return retryWithBackoff(async () => {
    const response = await fetchWithTimeout(`${API_BASE}/api/start-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || response.statusText);
    }

    return data;
  });
}

// ========================================
// FUNCIÓN PRINCIPAL
// ========================================

async function main() {
  const startTime = Date.now();
  
  log('='.repeat(80));
  log('🕐 INICIANDO CRON JOB - SINCRONIZACIÓN DIARIA');
  log('   Versión 3.0 - Con soporte para cuentas hijas de MCC');
  log('='.repeat(80));

  let connection;

  try {
    // 0️⃣ VALIDAR CREDENCIALES
    log('🔑 Validando credenciales de Google OAuth...');
    const credValidation = validateOAuthCredentials();
    
    if (!credValidation.valid) {
      log('❌ CREDENCIALES INCORRECTAS:', 'ERROR');
      credValidation.issues.forEach(issue => log(`   ⚠️  ${issue}`, 'ERROR'));
      throw new Error('Credenciales de OAuth incorrectas');
    }
    
    log(`✅ Credenciales válidas (Client ID: ${credValidation.clientId})`, 'SUCCESS');

    // 1️⃣ VERIFICAR SERVIDOR
    log('🔍 Verificando disponibilidad del servidor...');
    await checkServerHealth();
    log('✅ Servidor disponible y funcionando', 'SUCCESS');

    // 2️⃣ OBTENER CONEXIÓN
    log('🔌 Obteniendo conexión de la base de datos...');
    connection = await pool.getConnection();
    log('✅ Conexión obtenida', 'SUCCESS');

    // 3️⃣ OBTENER CUENTAS SINCRONIZABLES
    log('📋 Consultando cuentas sincronizables...');
    
    // 🔥 QUERY CRÍTICA: Incluye cuentas hijas que usan token del MCC padre
    const [rows] = await connection.execute(`
      SELECT DISTINCT 
        a.customer_id, 
        a.name,
        a.is_mcc,
        a.parent_account_id,
        -- Token propio o del MCC padre
        COALESCE(t.refresh_token, tp.refresh_token) as refresh_token,
        COALESCE(t.access_token_expiry, tp.access_token_expiry) as access_token_expiry,
        COALESCE(t.token_status, tp.token_status) as token_status,
        COALESCE(t.user_id, tp.user_id) as user_id,
        -- Indicador de origen del token
        CASE 
          WHEN t.customer_id IS NOT NULL THEN 'propio'
          WHEN tp.customer_id IS NOT NULL THEN 'heredado_mcc'
          ELSE 'sin_token'
        END as origen_token
      FROM accounts a
      -- Token propio de la cuenta
      LEFT JOIN tokens t ON a.customer_id = t.customer_id
      -- Token del MCC padre (si aplica)
      LEFT JOIN tokens tp ON a.parent_account_id = tp.customer_id
      WHERE a.customer_id IS NOT NULL
        AND a.is_mcc = 0
        AND (
          -- Tiene token propio válido
          (t.token_status = 'valid' AND t.refresh_token IS NOT NULL)
          OR
          -- O el MCC padre tiene token válido
          (tp.token_status = 'valid' AND tp.refresh_token IS NOT NULL)
        )
      ORDER BY a.parent_account_id, a.customer_id
    `);

    if (rows.length === 0) {
      log('⚠️ No se encontraron cuentas sincronizables.', 'WARN');
      
      // Mostrar estadísticas
      const [stats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_cuentas,
          SUM(CASE WHEN a.is_mcc = 1 THEN 1 ELSE 0 END) as cuentas_mcc,
          SUM(CASE WHEN a.is_mcc = 0 THEN 1 ELSE 0 END) as cuentas_normales,
          COUNT(DISTINCT t.customer_id) as con_token
        FROM accounts a
        LEFT JOIN tokens t ON a.customer_id = t.customer_id
      `);
      
      log('', 'INFO');
      log('📊 Estadísticas:', 'INFO');
      log(`   Total cuentas: ${stats[0].total_cuentas}`, 'INFO');
      log(`   Cuentas MCC: ${stats[0].cuentas_mcc}`, 'INFO');
      log(`   Cuentas normales: ${stats[0].cuentas_normales}`, 'INFO');
      log(`   Con token: ${stats[0].con_token}`, 'INFO');
      
      return;
    }

    log(`📊 Cuentas sincronizables encontradas: ${rows.length}`, 'INFO');
    
    // Estadísticas por origen de token
    const propios = rows.filter(r => r.origen_token === 'propio').length;
    const heredados = rows.filter(r => r.origen_token === 'heredado_mcc').length;
    
    log(`   ✅ Con token propio: ${propios}`, 'INFO');
    log(`   🔑 Con token heredado de MCC: ${heredados}`, 'INFO');
    
    const validAccounts = [];
    const skippedAccounts = [];
    const tokenRenewalNeeded = new Map(); // customer_id del token -> lista de cuentas

    // 4️⃣ AGRUPAR CUENTAS POR TOKEN (para renovar tokens solo una vez)
    log('🔑 Agrupando cuentas por token...');
    for (const row of rows) {
      const tokenOwnerId = row.origen_token === 'propio' 
        ? row.customer_id 
        : row.parent_account_id;
      
      if (!tokenRenewalNeeded.has(tokenOwnerId)) {
        tokenRenewalNeeded.set(tokenOwnerId, {
          refresh_token: row.refresh_token,
          access_token_expiry: row.access_token_expiry,
          user_id: row.user_id,
          accounts: []
        });
      }
      
      tokenRenewalNeeded.get(tokenOwnerId).accounts.push({
        customer_id: row.customer_id,
        name: row.name,
        origen_token: row.origen_token
      });
    }

    log(`📊 Tokens únicos a procesar: ${tokenRenewalNeeded.size}`, 'INFO');

    // 5️⃣ RENOVAR TOKENS SI ES NECESARIO
    log('🔄 Validando y renovando tokens...');
    
    for (const [tokenOwnerId, tokenData] of tokenRenewalNeeded) {
      const accountsList = tokenData.accounts.map(a => a.customer_id).join(', ');
      const isMCC = tokenData.accounts[0].origen_token === 'heredado_mcc';
      
      log(`\n🔑 Token de ${tokenOwnerId} ${isMCC ? '(MCC padre)' : '(cuenta propia)'}`, 'INFO');
      log(`   Usado por ${tokenData.accounts.length} cuenta(s): ${accountsList}`, 'INFO');
      
      try {
        if (isTokenExpiring(tokenData.access_token_expiry)) {
          log(`   🔄 Token expirando, renovando...`, 'INFO');

          const { access_token, expiry_date } = await renewAccessToken(tokenData.refresh_token);

          // Actualizar token en BD
          await connection.execute(`
            UPDATE tokens 
            SET access_token = ?, access_token_expiry = ?, token_status = 'valid'
            WHERE customer_id = ? AND user_id = ?
          `, [access_token, new Date(expiry_date), tokenOwnerId, tokenData.user_id]);

          log(`   ✅ Token renovado exitosamente`, 'SUCCESS');
        } else {
          log(`   ✅ Token válido y vigente`, 'SUCCESS');
        }

        // Todas las cuentas que usan este token son válidas
        tokenData.accounts.forEach(acc => validAccounts.push(acc.customer_id));

      } catch (err) {
        log(`   ❌ Error renovando token: ${err.message}`, 'ERROR');
        
        if (err.message.includes('invalid_client')) {
          log(`   ⚠️  Las credenciales OAuth están incorrectas`, 'ERROR');
        }
        
        // Marcar token como revoked
        await connection.execute(`
          UPDATE tokens SET token_status = 'revoked'
          WHERE customer_id = ? AND user_id = ?
        `, [tokenOwnerId, tokenData.user_id]);
        
        // Todas las cuentas que usan este token fallan
        tokenData.accounts.forEach(acc => {
          skippedAccounts.push({ 
            customer_id: acc.customer_id, 
            reason: 'token_renewal_failed',
            error: err.message 
          });
        });
      }
    }

    log(`\n📊 Resumen de validación:`);
    log(`  ✅ Cuentas con token válido: ${validAccounts.length}`);
    log(`  ⛔ Cuentas omitidas: ${skippedAccounts.length}`);

    if (validAccounts.length === 0) {
      log('⚠️ No hay cuentas válidas para sincronizar.', 'WARN');
      return;
    }

    // 6️⃣ CREAR TAREAS DIARIAS
    log('='.repeat(80));
    log('🔥 PROGRAMANDO TAREAS DIARIAS EN LA COLA');
    log('='.repeat(80));

    const results = {
      queued: [],
      alreadyQueued: [],
      errors: []
    };

    for (const customerId of validAccounts) {
      try {
        const data = await scheduleTaskForAccount(customerId);

        if (data.taskResult?.created) {
          log(`✅ ${customerId}: Tarea diaria programada (${data.taskResult.date})`, 'SUCCESS');
          results.queued.push(customerId);
        } else if (data.taskResult?.reason === 'task_already_exists') {
          log(`ℹ️  ${customerId}: Ya tiene tarea para ${data.taskResult.date}`, 'INFO');
          results.alreadyQueued.push(customerId);
        } else {
          log(`⚠️  ${customerId}: ${data.taskResult?.message || 'Sin acción'}`, 'WARN');
        }
      } catch (error) {
        log(`❌ ${customerId}: Error al programar - ${error.message}`, 'ERROR');
        results.errors.push({ customerId, error: error.message });
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 7️⃣ INICIAR LA COLA
    if (results.queued.length > 0) {
      log('='.repeat(80));
      log('🚀 INICIANDO PROCESAMIENTO DE COLA');
      log('='.repeat(80));

      try {
        const startData = await startSyncQueue();
        log(`✅ Cola iniciada: ${startData.message}`, 'SUCCESS');
      } catch (error) {
        log(`❌ Error al iniciar cola: ${error.message}`, 'ERROR');
      }
    } else {
      log('ℹ️  No hay nuevas tareas que procesar', 'INFO');
    }

    // 8️⃣ RESUMEN FINAL
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log('='.repeat(80));
    log('📊 RESUMEN FINAL');
    log('='.repeat(80));
    log(`  ✅ Tareas programadas: ${results.queued.length}`);
    log(`  ℹ️  Ya en cola: ${results.alreadyQueued.length}`);
    log(`  ❌ Errores: ${results.errors.length}`);
    log(`  ⏱️  Duración: ${duration}s`);
    log('='.repeat(80));

    if (results.errors.length > 0) {
      log('❌ Cuentas con errores:', 'ERROR');
      results.errors.forEach(({ customerId, error }) => {
        log(`  • ${customerId}: ${error}`, 'ERROR');
      });
    }

    log('🎉 Cron job finalizado exitosamente', 'SUCCESS');

  } catch (error) {
    log(`❌ Error crítico: ${error.message}`, 'ERROR');
    if (error.stack) {
      log(error.stack, 'ERROR');
    }
    throw error;
  } finally {
    if (connection) {
      connection.release();
      log('🔓 Conexión liberada al pool', 'INFO');
    }
    
    try {
      await pool.end();
      log('✅ Pool MySQL cerrado correctamente', 'SUCCESS');
    } catch (error) {
      log(`⚠️  Error al cerrar pool: ${error.message}`, 'WARN');
    }
  }
}

// ========================================
// EJECUCIÓN
// ========================================

main()
  .then(() => {
    log('✅ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch(error => {
    log(`💥 Error fatal: ${error.message}`, 'ERROR');
    process.exit(1);
  });