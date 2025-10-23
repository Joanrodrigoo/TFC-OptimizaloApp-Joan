// stripe/createCheckoutSession.js
import express from 'express';
import { stripe } from './stripeClient.js';
import db from '../db.js';

const router = express.Router();

const pool = db;
 
// ID del producto en Stripe (por ahora fijo, se puede hacer dinámico luego)
const PRODUCT_ID = 'prod_Sg5m6q2Ox97iDX'; // ← Reemplaza con tu Product ID real

// Función para obtener el Price ID a partir del Product ID
async function getPriceIdFromProduct(productId) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 1,
  });

  if (!prices.data.length) {
    throw new Error('No se encontraron precios activos para este producto.');
  }

  return prices.data[0].id;
}

router.post('/create-checkout-session', async (req, res) => {
  const user = req.user;

  if (!user || !user.email || !user.id) {
    return res.status(401).json({ error: 'Usuario no autenticado correctamente' });
  }

  try {
    // Verifica si el usuario ya tiene una suscripción activa
    const [result] = await pool.query(
      'SELECT is_active FROM users WHERE id = ?',
      [user.id]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado en la base de datos' });
    }

    if (result[0].is_active === 1) {
      return res.status(400).json({ error: 'Ya tienes una suscripción activa' });
    }

    // Si no tiene suscripción activa, se crea el checkout
    const priceId = await getPriceIdFromProduct(PRODUCT_ID);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: 'https://pwi.es/subscription/success',
      cancel_url: 'https://pwi.es/subscription/canceled',
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Error en Stripe checkout:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;