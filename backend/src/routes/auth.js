import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import db from '../config/db.js';
import dotenv from 'dotenv';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { loginLimiter } from '../middleware/rateLimiter.js';


import { sendEmail } from '../services/mailer.js';

dotenv.config();

const router = express.Router();


// Paso 1: Iniciar registro
router.post('/register-start', async (req, res) => {
  const { email } = req.body;

  try {

    await db.execute("DELETE FROM pending_users WHERE created_at < NOW() - INTERVAL 1 HOUR");


    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Este email ya está registrado' });
    }

    const token = crypto.randomBytes(20).toString('hex');

    await db.execute(
      'INSERT INTO pending_users (email, token, created_at) VALUES (?, ?, NOW())',
      [email, token]
    );

    const link = `${process.env.FRONTEND_URL}/register?token=${token}&email=${encodeURIComponent(email)}`;

    // Envía email con MailerSend
    await sendEmail({
      to: email,
      name: email,
      type: 'verify_email',
      token
    });


    res.json({ message: 'Se ha enviado un correo de verificación' });
  } catch (err) {
    console.error("Error en /register-start:", err);
    res.status(500).json({ error: 'Error al iniciar el registro' });
  }
});

// Paso 2: Completar registro
router.post('/register-complete', async (req, res) => {
  const { name, email, password, token } = req.body;

  try {
    // Verificar si el token es válido
    const [pending] = await db.execute(
      'SELECT * FROM pending_users WHERE email = ? AND token = ?',
      [email, token]
    );

    if (pending.length === 0) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario final
    await db.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    // Eliminar token usado
    await db.execute('DELETE FROM pending_users WHERE email = ?', [email]);

    res.status(201).json({ message: 'Usuario registrado con éxito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al completar el registro' });
  }
});
//

router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  res.status(200).json({ user: req.session.user });
});

router.get('/verify-token', async (req, res) => {
  const { email, token } = req.query;

  if (!email || !token) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  try {
    const [pending] = await db.execute(
      'SELECT * FROM pending_users WHERE email = ? AND token = ?',
      [email, token]
    );

    if (pending.length === 0) {
      return res.status(400).json({ valid: false, message: 'Token inválido o expirado' });
    }

    res.status(200).json({ valid: true });

  } catch (err) {
    console.error("Error en /verify-token:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// routes/auth.js
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Insertar sesión nueva en la tabla sessions
    const [result] = await db.execute(
      'INSERT INTO sessions (user_id, started_at) VALUES (?, NOW())',
      [user.id]
    );
    const sessionId = result.insertId;

    // Guardar info de usuario y sessionId en req.session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,

    };
    req.session.sessionId = sessionId;

    res.status(200).json({
      message: 'Login exitoso',
      user: req.session.user
    });

  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


router.post('/forgot-password', async (req, res) => {
  const rawEmail = req.body.email;
  if (!rawEmail) {
    return res.status(400).json({ error: 'El email es obligatorio' });
  }
  const email = rawEmail.toLowerCase().trim();

  try {
    // Verificar si el usuario existe
    const [users] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'No se encontró un usuario con ese correo' });
    }

    // Limpiar tokens expirados (opcional: 1 hora)
    await db.execute("DELETE FROM password_resets WHERE created_at < NOW() - INTERVAL 1 HOUR");

    // Generar y guardar el token
    const token = crypto.randomBytes(20).toString('hex');
    await db.execute(
      'INSERT INTO password_resets (email, token, created_at) VALUES (?, ?, NOW())',
      [email, token]
    );

    // Enviar email con el token para restablecer la contraseña
    await sendEmail({
      to: email,
      name: email,  // puedes cambiarlo por un nombre real si lo tienes
      type: 'reset_password',
      token
    });

    res.json({ message: 'Se ha enviado un enlace para restablecer tu contraseña' });
  } catch (err) {
    console.error("Error en /forgot-password:", err);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;

  try {
    // Verificar que el token exista y no esté expirado (válido 1 hora)
    const [reset] = await db.execute(
      'SELECT * FROM password_resets WHERE email = ? AND token = ? AND created_at >= NOW() - INTERVAL 1 HOUR',
      [email, token]
    );

    if (reset.length === 0) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    // Encriptar la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar la contraseña del usuario
    await db.execute(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashedPassword, email]
    );

    // Eliminar el token usado
    await db.execute(
      'DELETE FROM password_resets WHERE email = ?',
      [email]
    );

    res.json({ message: 'Contraseña restablecida correctamente' });
  } catch (err) {
    console.error("Error en /reset-password:", err);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});



router.put('/profile', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { name, email, phone } = req.body;

  try {
    await db.query(
      `UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?`,
      [name, email, phone, userId]
    );

    res.json({ success: true, message: 'Perfil actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar el perfil:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar el perfil' });
  }
});


router.get('/profile', authenticateUser, (req, res) => {
  const { name, email, phone } = req.user;
  res.json({ name, email, phone });
});



router.put("/change-password", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
  }

  try {
    // Obtener hash de la contraseña actual del usuario
    const [rows] = await db.query("SELECT password FROM users WHERE id = ?", [userId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const user = rows[0];

    // Verificar la contraseña actual
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Contraseña actual incorrecta" });
    }

    // Generar nuevo hash
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña en la base de datos
    await db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId]);

    res.json({ success: true, message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const sessionId = req.session.sessionId;
    if (!req.session || !req.session.sessionId) {
      return res.status(400).json({ error: 'No hay sesión activa' });
    }

    // Actualizar la sesión en la base de datos con ended_at y duración en minutos
    await db.execute(
      `UPDATE sessions
       SET ended_at = NOW(),
           duration = TIMESTAMPDIFF(MINUTE, started_at, NOW())
       WHERE id = ?`,
      [sessionId]
    );

    req.session.destroy((err) => {
      if (err) {
        console.error('Error al cerrar sesión:', err);
        return res.status(500).json({ error: 'Error al cerrar sesión' });
      }
      res.clearCookie('connect.sid'); // nombre por defecto cookie express-session
      res.status(200).json({ message: 'Sesión cerrada correctamente' });
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


router.get('/status', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// backend/routes/auth.js
router.get('/refresh-session', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const updatedUser = rows[0];

    // 🔄 Actualiza la sesión manualmente
    req.session.user = updatedUser;

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('❌ Error al refrescar sesión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});




export default router;
