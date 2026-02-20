// stripe/testPayment.js
import express from 'express';
import { stripe } from './stripeClient.js';

const router = express.Router();

router.post('/test-payment', async (req, res) => {
  try {
    if (!stripe) {
      throw new Error('Stripe no está configurado correctamente.');
    }

    const client = await stripe.customers.create({
      name: 'Brais Moure',
      email: 'mouredev@gmail.com',
    });

    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: { token: 'tok_visa' }
    });

    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: client.id
    });

    const products = await stripe.products.list({ limit: 1 });
    if (!products.data.length) throw new Error('No se encontró ningún producto en Stripe.');

    const product = products.data[0];

    const prices = await stripe.prices.list({ product: product.id, limit: 1 });
    if (!prices.data.length) throw new Error('No se encontró ningún precio para el producto.');

    const price = prices.data[0];

    const payment = await stripe.paymentIntents.create({
      amount: price.unit_amount,
      currency: price.currency,
      customer: client.id,
      payment_method: paymentMethod.id,
      payment_method_types: ['card'],
      confirm: true,
      metadata: {
        product_id: product.id
      }
    });

    res.json({
      message: '✅ Proceso completado exitosamente',
      paymentId: payment.id
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
