import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

const mailersend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY,
});

/**
 * @param {Object} options
 * @param {string} options.to - Email del destinatario
 * @param {string} options.name - Nombre del usuario
 * @param {string} options.type - Tipo de email
 * @param {string} [options.token] - Token para verificación/reset (opcional)
 * @param {string} [options.invoiceUrl] - URL de la factura PDF de Stripe (opcional)
 * @param {number} [options.daysUntilExpiry] - Días hasta que expire el token (opcional)
 * @param {string} [options.customerIds] - IDs de clientes de Google Ads (opcional)
 */
export async function sendEmail({ to, name, type, token, invoiceUrl, daysUntilExpiry, customerIds }) {
  const linkBase = process.env.FRONTEND_URL;
  let subject = "";
  let html = "";
  let text = "";

  switch (type) {
    case "verify_email": {
      const linkVerify = `${linkBase}/register?token=${token}&email=${encodeURIComponent(to)}`;
      subject = "Verifica tu cuenta";
      html = `<p>Hola ${name}, haz clic para verificar tu cuenta: <a href="${linkVerify}">${linkVerify}</a></p>`;
      text = `Hola ${name}, verifica tu cuenta aquí: ${linkVerify}`;
      break;
    }
    case "reset_password": {
      const linkReset = `${linkBase}/reset-password?token=${token}&email=${encodeURIComponent(to)}`;
      subject = "Recupera tu contraseña";
      html = `<p>Hola ${name}, haz clic para restablecer tu contraseña: <a href="${linkReset}">${linkReset}</a></p>`;
      text = `Hola ${name}, recupera tu contraseña aquí: ${linkReset}`;
      break;
    }
    case "subscription_success": {
      subject = "🎉 ¡Gracias por suscribirte!";
      html = `
        <p>Hola ${name},</p>
        <p>¡Gracias por suscribirte a nuestro servicio! Tu cuenta ahora está activa.</p>
        ${invoiceUrl ? `<p>Puedes descargar tu factura aquí: <a href="${invoiceUrl}">${invoiceUrl}</a></p>` : ""}
        <p>Estamos encantados de tenerte a bordo 🚀</p>
      `;
      text = `Hola ${name}, gracias por suscribirte. ${invoiceUrl ? `Factura: ${invoiceUrl}` : ""}`;
      break;
    }
    case "subscription_cancelled": {
      subject = "Tu suscripción ha sido cancelada";
      html = `<p>Hola ${name},</p><p>Lamentamos que hayas cancelado tu suscripción. Puedes volver en cualquier momento.</p>`;
      text = `Hola ${name}, lamentamos que hayas cancelado tu suscripción. Puedes volver en cualquier momento.`;
      break;
    }
    
    // ===============================
    // NUEVOS TIPOS PARA TOKENS
    // ===============================
    case "token_renewal_reminder": {
      const reconnectLink = `${linkBase}/dashboard`; // URL donde pueden reconectar
      const dayText = daysUntilExpiry === 1 ? "día" : "días";
      const urgencyEmoji = daysUntilExpiry <= 1 ? "🚨" : "📅";
      
      subject = `${urgencyEmoji} Renovación programada de Google Ads en ${daysUntilExpiry} ${dayText}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a73e8;">${urgencyEmoji} Renovación de seguridad programada</h2>
          <p>Hola ${name},</p>
          <p>Como parte de nuestras <strong>medidas de seguridad proactivas</strong>, renovamos automáticamente las conexiones con Google Ads cada 5 días.</p>
          
          <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a73e8;">
            <p style="margin: 0; color: #1d4ed8;">
              <strong>🔒 ¿Por qué renovamos cada 5 días?</strong><br>
              Esto previene que Google revoque automáticamente los tokens y garantiza acceso continuo a tus datos.
            </p>
          </div>
          
          <p><strong>Tu renovación está programada para dentro de ${daysUntilExpiry} ${dayText}.</strong></p>
          
          ${customerIds ? `<p><strong>Cuentas a renovar:</strong><br>${customerIds}</p>` : ""}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reconnectLink}" style="background-color: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              🔄 Renovar ahora (recomendado)
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            <strong>Nota:</strong> Puedes renovar antes de tiempo para evitar cualquier interrupción. 
            El proceso es rápido y seguro.
          </p>
        </div>
      `;
      text = `Hola ${name}, renovación de Google Ads programada en ${daysUntilExpiry} ${dayText}. Renueva ahora: ${reconnectLink}`;
      break;
    }
    
    case "token_scheduled_renewal": {
      const reconnectLink = `${linkBase}/dashboard`;
      subject = "🔄 Renovación automática de seguridad activada";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">🔄 Renovación de seguridad activada</h2>
          <p>Hola ${name},</p>
          <p>Hemos activado la <strong>renovación automática de seguridad</strong> para tu conexión con Google Ads.</p>
          
          <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <p style="margin: 0; color: #047857;">
              <strong>✅ ¿Qué significa esto?</strong><br>
              Tu token actual ha cumplido 5 días de vida y será renovado para mantener la máxima seguridad.
              Esto previene revocaciones automáticas de Google.
            </p>
          </div>
          
          ${customerIds ? `<p><strong>Cuentas afectadas:</strong><br>${customerIds}</p>` : ""}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reconnectLink}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              🔗 Completar renovación
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Esta es una medida preventiva para garantizar acceso continuo a tus datos de Google Ads.
          </p>
        </div>
      `;
      text = `Hola ${name}, renovación de seguridad activada para Google Ads. Completa la renovación: ${reconnectLink}`;
      break;
    }
    
    case "token_reconnect_required": {
      const reconnectLink = `${linkBase}/dashboard`;
      subject = "🔄 Acción requerida: Completar renovación de Google Ads";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">🔄 Renovación pendiente</h2>
          <p>Hola ${name},</p>
          <p>Tu conexión con Google Ads está <strong>pendiente de renovación</strong> por motivos de seguridad.</p>
          
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #dc2626;">
              <strong>⚠️ Acción requerida:</strong><br>
              Para continuar recibiendo datos actualizados de tus campañas, necesitas completar la renovación.
            </p>
          </div>
          
          ${customerIds ? `<p><strong>Cuentas pendientes:</strong><br>${customerIds}</p>` : ""}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reconnectLink}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              🔗 Completar renovación ahora
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            <strong>Recordatorio:</strong> Renovamos cada 5 días para evitar revocaciones automáticas de Google.
          </p>
        </div>
      `;
      text = `Hola ${name}, renovación de Google Ads pendiente. Completa aquí: ${reconnectLink}`;
      break;
    }
    
    default:
      throw new Error(`Tipo de email no soportado: ${type}`);
  }

  const sentFrom = new Sender(process.env.EMAIL_FROM, "AdOps AI");
  const recipients = [new Recipient(to, name)];

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject(subject)
    .setHtml(html)
    .setText(text);

  try {
    await mailersend.email.send(emailParams);
    console.log(`📧 Email de tipo ${type} enviado a ${to}`);
  } catch (error) {
    console.error(`❌ Error al enviar email (${type}) a ${to}:`, error);
    throw error;
  }
}