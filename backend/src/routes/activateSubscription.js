import express from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import db from '../config/db.js'; // default export

const router = express.Router();

router.post('/auth/activate-subscription', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    await db.query('UPDATE users SET is_active = 1 WHERE id = ?', [userId]);
    res.json({ message: 'Suscripción activada' });
  } catch (error) {
    console.error('Error activando suscripción:', error);
    res.status(500).json({ error: 'Error al activar la suscripción' });
  }
});

export default router;
