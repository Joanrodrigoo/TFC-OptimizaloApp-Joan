import express from "express";
import bodyParser from "body-parser";
import { stripe } from "../services/stripe/stripeClient.js";
import db from "../config/db.js";
import dotenv from "dotenv";
import { sendEmail } from "../services/mailer.js";

dotenv.config();

const router = express.Router();

router.post(
  "/",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("⚠️ Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const handleSubscriptionUpdate = async (subscription) => {
      const {
        id,
        customer,
        status,
        plan,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        canceled_at,
        items,
        latest_invoice,
      } = subscription;

      // Asegurar timestamps válidos para la query
      const startTimestamp = current_period_start || null;
      const endTimestamp = current_period_end || null;
      const canceledAtTimestamp = canceled_at || null;

      const priceId = items.data[0]?.price?.id || null;
      const planName = items.data[0]?.price?.nickname || null;

      // Obtener usuario por Stripe Customer ID
      const [result] = await db.query(
        "SELECT user_id FROM subscriptions WHERE stripe_customer_id = ?",
        [customer]
      );

      if (!result || result.length === 0) {
        console.warn(`⚠️ Usuario no encontrado con customerId: ${customer}`);
        return;
      }

      const userId = result[0].user_id;

      // Actualizar suscripción
      await db.query(
        `
INSERT INTO subscriptions (
  user_id,
  stripe_subscription_id,
  stripe_customer_id,
  status,
  plan_name,
  price_id,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  canceled_at
) VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, FROM_UNIXTIME(?))
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  plan_name = VALUES(plan_name),
  price_id = VALUES(price_id),
  current_period_start = VALUES(current_period_start),
  current_period_end = VALUES(current_period_end),
  cancel_at_period_end = VALUES(cancel_at_period_end),
  canceled_at = VALUES(canceled_at)
`,
        [
          userId,
          id,
          customer,
          status,
          planName,
          priceId,
          startTimestamp,
          endTimestamp,
          cancel_at_period_end,
          canceledAtTimestamp,
        ]
      );

      // Si la suscripción fue cancelada, desactivar usuario y enviar email
      if (
        status === "canceled" ||
        status === "unpaid" ||
        status === "incomplete_expired"
      ) {
        await db.query("UPDATE users SET is_active = 0 WHERE id = ?", [userId]);

        // Enviar email de cancelación si está cancelada
        if (status === "canceled") {
          try {
            // Obtener datos del usuario para el email
            const [userResult] = await db.query(
              "SELECT email, name FROM users WHERE id = ?",
              [userId]
            );

            if (userResult && userResult.length > 0) {
              const user = userResult[0];
              await sendEmail({
                to: user.email,
                name: user.name || "Usuario",
                type: "subscription_cancelled",
              });
            }
          } catch (emailError) {
            console.error(
              "❌ Error enviando email de cancelación:",
              emailError
            );
          }
        }
      }
    };

    // --- EVENTOS ---

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const email = session.customer_email;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        try {
          const [userResult] = await db.query(
            "SELECT id, name FROM users WHERE email = ?",
            [email]
          );
          if (!userResult || userResult.length === 0)
            throw new Error(`Usuario no encontrado: ${email}`);
          const user = userResult[0];
          const userId = user.id;
          console.log(user.id);
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId
          );
          const {
            id,
            customer,
            status,
            plan,
            current_period_start,
            current_period_end,
            cancel_at_period_end,
            canceled_at,
            items,
            latest_invoice,
          } = subscription;
          console.log(subscription);
          const priceId = items.data[0]?.price?.id || null;
          const planName = items.data[0]?.price?.nickname || null;

          await db.query("UPDATE users SET is_active = 1 WHERE id = ?", [
            userId,
          ]);

          await db.query(
            `
      INSERT INTO subscriptions (
        user_id,
        stripe_subscription_id,
        stripe_customer_id,
        status,
        plan_name,
        price_id,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        canceled_at
      ) VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, FROM_UNIXTIME(?))
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        plan_name = VALUES(plan_name),
        price_id = VALUES(price_id),
        current_period_start = VALUES(current_period_start),
        current_period_end = VALUES(current_period_end),
        cancel_at_period_end = VALUES(cancel_at_period_end),
        canceled_at = VALUES(canceled_at)
    `,
            [
              userId,
              id,
              customer,
              status,
              planName,
              priceId,
              current_period_start,
              current_period_end,
              cancel_at_period_end,
              canceled_at || null,
            ]
          );

          console.log(`✅ Suscripción registrada para ${email}`);

          // Obtener la factura si existe
          let invoiceUrl = null;
          if (latest_invoice) {
            const invoice = await stripe.invoices.retrieve(latest_invoice);
            invoiceUrl = invoice?.hosted_invoice_url || null;
          }

          // Enviar email de agradecimiento
          await sendEmail({
            to: email,
            name: user.name || "Usuario",
            type: "subscription_success",
            invoiceUrl,
          });
        } catch (err) {
          console.error("❌ Error en checkout.session.completed:", err);
        }

        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object;
        console.log(`✅ Nueva suscripción creada: ${subscription.id}`);

        try {
          await handleSubscriptionUpdate(subscription);
        } catch (err) {
          console.error("❌ Error en customer.subscription.created:", err);
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        console.log(`🔄 Suscripción actualizada: ${subscription.id}`);

        try {
          await handleSubscriptionUpdate(subscription);
        } catch (err) {
          console.error("❌ Error en customer.subscription.updated:", err);
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        console.log(`🗑️ Suscripción eliminada: ${subscription.id}`);

        try {
          await handleSubscriptionUpdate(subscription);
        } catch (err) {
          console.error("❌ Error en customer.subscription.deleted:", err);
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        try {
          await db.query(
            "UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?",
            ["payment_failed", subscriptionId]
          );

          console.log(`⚠️ Pago fallido para suscripción ${subscriptionId}`);
        } catch (err) {
          console.error("❌ Error actualizando fallo de pago:", err);
        }

        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        try {
          // Actualizar el estado de la suscripción cuando se paga la factura
          await db.query(
            "UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?",
            ["active", subscriptionId]
          );

          console.log(`✅ Factura pagada para suscripción ${subscriptionId}`);
        } catch (err) {
          console.error("❌ Error actualizando pago de factura:", err);
        }

        break;
      }

      default:
        console.log(`📬 Evento no manejado: ${event.type}`);
        break;
    }

    res.json({ received: true });
  }
);

export default router;
