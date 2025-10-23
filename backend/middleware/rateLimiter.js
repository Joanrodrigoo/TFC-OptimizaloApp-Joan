import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 5, // máximo 5 intentos por IP
  message: {
    error: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo después de 5 minutos.',
  },
  standardHeaders: true, // Devuelve headers estándar RateLimit
  legacyHeaders: false,  // Desactiva los headers X-RateLimit obsoletos
});
