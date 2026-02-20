import db from '../config/db.js';
import { sendEmail } from './mailer.js';

export class TokenMonitoringService {
  constructor() {
    this.forceExpiryDays = 5; // Días para forzar expiración de tokens
    this.notificationDays = [2, 1]; // Notificar 2 y 1 día antes de la expiración forzada
  }

  /**
   * Revisa tokens y fuerza expiración cada 5 días
   */
  async checkExpiringTokens() {
    console.log('🔍 Iniciando gestión proactiva de tokens (renovación cada 5 días)...');

    try {
      // 1. Forzar expiración de tokens que llevan 5 días activos
      await this.forceTokenExpiration();

      // 2. Notificar tokens próximos a expiración forzada
      for (const days of this.notificationDays) {
        await this.processTokensForDay(days);
      }

      // 3. Notificar tokens ya expirados que no se han reconectado
      await this.processExpiredTokens();

      console.log('✅ Gestión de tokens completada');
    } catch (error) {
      console.error('❌ Error en gestión de tokens:', error);
      throw error;
    }
  }

  /**
   * Fuerza la expiración de tokens que llevan 5 días activos
   */
  async forceTokenExpiration() {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - this.forceExpiryDays);

    const query = `
      SELECT 
        t.id,
        t.user_id,
        t.created_at,
        t.customer_id,
        u.email,
        u.name,
        GROUP_CONCAT(t.customer_id) as customer_ids
      FROM tokens t
      INNER JOIN users u ON t.user_id = u.id
      WHERE t.token_status = 'active'
        AND t.created_at <= ?
      GROUP BY t.user_id
    `;

    const [tokensToExpire] = await db.execute(query, [fiveDaysAgo]);

    console.log(`🔄 Forzando expiración de tokens de ${tokensToExpire.length} usuarios (5+ días activos)`);

    for (const tokenGroup of tokensToExpire) {
      await this.forceExpireUserTokens(tokenGroup.user_id);
      await this.sendForcedExpirationNotification(tokenGroup);
    }
  }

  /**
   * Marca tokens de un usuario como expirados y programa su reconexión
   */
  async forceExpireUserTokens(userId) {
    const query = `
      UPDATE tokens 
      SET token_status = 'force_expired',
          access_token_expiry = NOW()
      WHERE user_id = ? AND token_status = 'active'
    `;

    await db.execute(query, [userId]);
    console.log(`🔄 Tokens del usuario ${userId} marcados para renovación`);
  }

  /**
   * Envía notificación de renovación programada
   */
  async sendForcedExpirationNotification(tokenGroup) {
    try {
      await sendEmail({
        to: tokenGroup.email,
        name: tokenGroup.name,
        type: 'token_scheduled_renewal',
        customerIds: tokenGroup.customer_ids
      });

      // Registrar notificación enviada
      await this.recordNotification(tokenGroup.id, 'scheduled_renewal');

    } catch (error) {
      console.error(`Error enviando notificación de renovación a ${tokenGroup.email}:`, error);
    }
  }

  /**
   * Procesa tokens que van a ser expirados forzadamente en X días
   */
  async processTokensForDay(days) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - (this.forceExpiryDays - days)); // 5-2=3 días desde creación, 5-1=4 días desde creación

    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 1);

    // Buscar tokens que serán expirados en X días
    const query = `
      SELECT 
        t.id,
        t.user_id,
        t.created_at,
        t.customer_id,
        t.is_mcc,
        u.email,
        u.name,
        GROUP_CONCAT(t.customer_id) as customer_ids
      FROM tokens t
      INNER JOIN users u ON t.user_id = u.id
      LEFT JOIN token_notifications tn ON (
        t.id = tn.token_id AND 
        tn.notification_type = ? AND 
        DATE(tn.sent_at) = CURDATE()
      )
      WHERE t.token_status = 'active'
        AND DATE(t.created_at) >= ?
        AND DATE(t.created_at) < ?
        AND tn.id IS NULL
      GROUP BY t.user_id
    `;

    const [tokens] = await db.execute(query, [`renewal_${days}d`, targetDate, endDate]);

    console.log(`📧 Encontrados ${tokens.length} usuarios con tokens programados para renovación en ${days} días`);

    for (const tokenGroup of tokens) {
      await this.sendRenewalNotification(tokenGroup, days);
    }
  }

  /**
   * Procesa tokens que ya han sido expirados forzadamente
   */
  async processExpiredTokens() {
    const query = `
      SELECT 
        t.id,
        t.user_id,
        t.access_token_expiry,
        t.customer_id,
        t.is_mcc,
        u.email,
        u.name,
        GROUP_CONCAT(t.customer_id) as customer_ids
      FROM tokens t
      INNER JOIN users u ON t.user_id = u.id
      LEFT JOIN token_notifications tn ON (
        t.id = tn.token_id AND 
        tn.notification_type = 'reconnect_reminder' AND 
        DATE(tn.sent_at) = CURDATE()
      )
      WHERE t.token_status IN ('force_expired', 'expired')
        AND tn.id IS NULL
      GROUP BY t.user_id
    `;

    const [expiredTokens] = await db.execute(query);

    console.log(`🔄 Encontrados ${expiredTokens.length} usuarios que necesitan reconectar`);

    for (const tokenGroup of expiredTokens) {
      await this.sendReconnectReminder(tokenGroup);
    }
  }

  /**
   * Envía notificación de renovación programada próxima
   */
  async sendRenewalNotification(tokenGroup, daysUntilRenewal) {
    try {
      await sendEmail({
        to: tokenGroup.email,
        name: tokenGroup.name,
        type: 'token_renewal_reminder',
        daysUntilExpiry: daysUntilRenewal,
        customerIds: tokenGroup.customer_ids
      });

      // Registrar notificación enviada
      await this.recordNotification(tokenGroup.id, `renewal_${daysUntilRenewal}d`);

    } catch (error) {
      console.error(`Error enviando recordatorio de renovación a ${tokenGroup.email}:`, error);
    }
  }

  /**
   * Envía recordatorio para reconectar tokens expirados
   */
  async sendReconnectReminder(tokenGroup) {
    try {
      await sendEmail({
        to: tokenGroup.email,
        name: tokenGroup.name,
        type: 'token_reconnect_required',
        customerIds: tokenGroup.customer_ids
      });

      // Registrar notificación enviada
      await this.recordNotification(tokenGroup.id, 'reconnect_reminder');

    } catch (error) {
      console.error(`Error enviando recordatorio de reconexión a ${tokenGroup.email}:`, error);
    }
  }

  /**
   * Marca tokens como expirados (método legacy para compatibilidad)
   */
  async markTokensAsExpired(userId) {
    const query = `
      UPDATE tokens 
      SET token_status = 'expired' 
      WHERE user_id = ? AND token_status = 'active' AND access_token_expiry < NOW()
    `;

    await db.execute(query, [userId]);
  }

  /**
   * Registra que se envió una notificación
   */
  async recordNotification(tokenId, notificationType) {
    const query = `
      INSERT INTO token_notifications (token_id, notification_type, sent_at)
      VALUES (?, ?, NOW())
    `;

    await db.execute(query, [tokenId, notificationType]);
  }

  /**
   * Renueva todos los tokens activos (para testing de la estrategia de 5 días)
   */
  async renewAllActiveTokens() {
    const query = `
      UPDATE tokens 
      SET token_status = 'force_expired',
          access_token_expiry = NOW()
      WHERE token_status = 'active'
    `;

    const [result] = await db.execute(query);
    console.log(`🔄 ${result.affectedRows} tokens marcados para renovación forzada`);
    return result.affectedRows;
  }

  /**
   * Obtiene estadísticas de tokens por edad
   */
  async getTokenStats() {
    const query = `
      SELECT 
        token_status,
        DATEDIFF(NOW(), created_at) as days_old,
        COUNT(*) as count
      FROM tokens 
      GROUP BY token_status, DATEDIFF(NOW(), created_at)
      ORDER BY days_old DESC
    `;

    const [stats] = await db.execute(query);
    console.table(stats);
    return stats;
  }
}