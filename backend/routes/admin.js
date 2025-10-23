import express from 'express';
import db from '../db.js';
import { authenticateSession, isAdmin } from '../middleware/authAdmin.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
// Importar el servicio de tokens
import { TokenMonitoringService } from '../services/tokenMonitoringService.js';

dotenv.config();

const router = express.Router();

// Middleware
router.use(authenticateSession);
router.use(isAdmin);

// GET /users
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.execute(`
      SELECT 
        id, 
        email, 
        name, 
        role, 
        phone,
        created_at,
        is_active   
      FROM users 
      ORDER BY created_at DESC
    `);

    const processedUsers = users.map(user => ({
      ...user,
      active: user.is_active === 1 ? 'active' : 'inactive'
    }));

    res.json(processedUsers);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
});

// POST /users - Crear nuevo usuario
router.post('/users', async (req, res) => {
  const { name, email, phone, password, role = 'user' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    // Comprobamos si el usuario ya existe
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'El usuario ya existe con este correo' });
    }

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute(
      `INSERT INTO users (name, email, phone, password, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [name, email, phone, hashedPassword, role, 1]
    );

    return res.status(201).json({ message: 'Usuario creado correctamente' });
  } catch (error) {
    console.error('Error creando usuario:', error);
    return res.status(500).json({ error: 'Error creando usuario' });
  }
});

// GET /metrics
router.get('/metrics', async (req, res) => {
  try {
    // Datos de usuarios
    const [totalUsers] = await db.execute('SELECT COUNT(*) as total FROM users');
    const [activeUsers] = await db.execute(`
       SELECT COUNT(*) as active 
  FROM users 
  WHERE is_active = 1
    `);
    const [newUsers] = await db.execute(`
      SELECT COUNT(*) as new_users 
      FROM users 
      WHERE YEAR(created_at) = YEAR(NOW()) 
      AND MONTH(created_at) = MONTH(NOW())
    `);
    const [roleStats] = await db.execute(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `);

    const [totalSessionsResult] = await db.execute('SELECT COUNT(*) as total FROM sessions');
    const totalSessions = totalSessionsResult[0].total;

   const [avgSessionTimeResult] = await db.execute(`
  SELECT AVG(duration) as avgDuration
  FROM sessions
  WHERE duration IS NOT NULL
`);
const avgSessionTime = avgSessionTimeResult[0].avgDuration
  ? parseFloat(avgSessionTimeResult[0].avgDuration).toFixed(1)
  : '0';

    const [dailyActiveUsersResult] = await db.execute(`
      SELECT COUNT(DISTINCT user_id) as activeUsers
      FROM sessions
      WHERE started_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);
    const dailyActiveUsers = dailyActiveUsersResult[0].activeUsers;

    // Construimos el objeto de métricas combinadas
    const metrics = {
      totalUsers: totalUsers[0].total,
      activeUsers: activeUsers[0].active,
      newUsersThisMonth: newUsers[0].new_users,
      roleDistribution: roleStats.reduce((acc, stat) => {
        acc[stat.role] = stat.count;
        return acc;
      }, {}),
      avgSessionTime: `${avgSessionTime} min`,
      totalSessions,
      dailyActiveUsers
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error obteniendo métricas:', error);
    res.status(500).json({ error: 'Error obteniendo métricas' });
  }
});

// PUT /users/:id/role
router.put('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  try {
    await db.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );

    res.json({ message: 'Rol actualizado correctamente' });
  } catch (error) {
    console.error('Error actualizando rol:', error);
    res.status(500).json({ error: 'Error actualizando rol' });
  }
});

// PUT /users/:id/status
router.put('/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
        const isActive = status ? 1 : 0;

    await db.execute(
      'UPDATE users SET is_active = ? WHERE id = ?',
      [isActive, id]
    );

    res.json({ message: 'Estado actualizado correctamente' });
  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.status(500).json({ error: 'Error actualizando estado' });
  }
});

// DELETE /users/:id
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.execute(
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error eliminando usuario' });
  }
});

// ===============================
// RUTAS PARA GESTIÓN DE TOKENS
// ===============================

// GET /tokens - Ver todos los tokens con información del usuario
router.get('/tokens', async (req, res) => {
  try {
    const [tokens] = await db.execute(`
      SELECT 
        t.id,
        t.user_id,
        t.customer_id,
        t.token_status,
        t.is_mcc,
        t.access_token_expiry,
        t.created_at,
        u.email,
        u.name,
        DATEDIFF(NOW(), t.created_at) as days_old,
        CASE 
          WHEN t.token_status = 'active' AND DATEDIFF(NOW(), t.created_at) >= 5 THEN 'DEBE RENOVARSE'
          WHEN t.token_status = 'active' AND DATEDIFF(NOW(), t.created_at) >= 3 THEN 'RENOVACIÓN PRÓXIMA'
          WHEN t.token_status = 'active' THEN 'OK'
          ELSE 'INACTIVO'
        END as status_renovacion
      FROM tokens t
      INNER JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
    `);

    res.json(tokens);
  } catch (error) {
    console.error('Error obteniendo tokens:', error);
    res.status(500).json({ error: 'Error obteniendo tokens' });
  }
});

// GET /tokens/stats - Estadísticas de tokens
router.get('/tokens/stats', async (req, res) => {
  try {
    const tokenService = new TokenMonitoringService();
    const stats = await tokenService.getTokenStats();
    
    // Estadísticas adicionales
    const [totalTokens] = await db.execute('SELECT COUNT(*) as total FROM tokens');
    const [activeTokens] = await db.execute('SELECT COUNT(*) as active FROM tokens WHERE token_status = "active"');
    const [tokensToRenew] = await db.execute(`
      SELECT COUNT(*) as to_renew 
      FROM tokens 
      WHERE token_status = 'active' 
      AND DATEDIFF(NOW(), created_at) >= 5
    `);
    const [recentNotifications] = await db.execute(`
      SELECT COUNT(*) as recent_notifications
      FROM token_notifications 
      WHERE DATE(sent_at) = CURDATE()
    `);
    
    res.json({ 
      success: true,
      summary: {
        totalTokens: totalTokens[0].total,
        activeTokens: activeTokens[0].active,
        tokensToRenew: tokensToRenew[0].to_renew,
        notificationsToday: recentNotifications[0].recent_notifications
      },
      detailedStats: stats 
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /tokens/manage - Ejecutar gestión de tokens manualmente
router.post('/tokens/manage', async (req, res) => {
  try {
    const tokenService = new TokenMonitoringService();
    await tokenService.checkExpiringTokens();
    
    res.json({ 
      success: true, 
      message: 'Gestión proactiva de tokens ejecutada correctamente (renovación cada 5 días)' 
    });
  } catch (error) {
    console.error('Error en gestión de tokens:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /tokens/force-renewal - Forzar renovación de todos los tokens activos
router.post('/tokens/force-renewal', async (req, res) => {
  try {
    const tokenService = new TokenMonitoringService();
    await tokenService.renewAllActiveTokens();
    
    res.json({ 
      success: true, 
      message: 'Todos los tokens activos marcados para renovación forzada' 
    });
  } catch (error) {
    console.error('Error forzando renovación:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// PUT /tokens/:id/force-expire - Marcar un token específico como expirado
router.put('/tokens/:id/force-expire', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.execute(
      `UPDATE tokens 
       SET token_status = 'force_expired', 
           access_token_expiry = NOW() 
       WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Token no encontrado' });
    }

    res.json({ 
      success: true,
      message: `Token ${id} marcado para renovación` 
    });
  } catch (error) {
    console.error('Error marcando token como expirado:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error marcando token como expirado' 
    });
  }
});

// GET /tokens/notifications - Ver notificaciones enviadas
router.get('/tokens/notifications', async (req, res) => {
  try {
    const [notifications] = await db.execute(`
      SELECT 
        tn.id,
        tn.notification_type,
        tn.sent_at,
        u.email,
        u.name,
        t.customer_id,
        DATEDIFF(NOW(), t.created_at) as token_age_days
      FROM token_notifications tn
      INNER JOIN tokens t ON tn.token_id = t.id
      INNER JOIN users u ON t.user_id = u.id
      ORDER BY tn.sent_at DESC
      LIMIT 100
    `);

    res.json(notifications);
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
});

// GET /tokens/users-to-reconnect - Usuarios que necesitan reconectar
router.get('/tokens/users-to-reconnect', async (req, res) => {
  try {
    const [usersToReconnect] = await db.execute(`
      SELECT 
        u.id,
        u.email,
        u.name,
        COUNT(t.id) as tokens_pendientes,
        MAX(t.access_token_expiry) as ultima_expiracion,
        GROUP_CONCAT(t.customer_id) as customer_ids
      FROM users u
      INNER JOIN tokens t ON u.id = t.user_id
      WHERE t.token_status IN ('force_expired', 'expired')
      GROUP BY u.id
      ORDER BY ultima_expiracion ASC
    `);

    res.json(usersToReconnect);
  } catch (error) {
    console.error('Error obteniendo usuarios para reconectar:', error);
    res.status(500).json({ error: 'Error obteniendo usuarios para reconectar' });
  }
});

// Test route
router.get('/admin-test', (req, res) => {
  res.json({ message: `Bienvenido, admin ${req.session.user.name}` });
});

export default router;