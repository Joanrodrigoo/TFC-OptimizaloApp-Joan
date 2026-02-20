// middlewares/auth.js

// Verifica si hay sesión activa
export const authenticateSession = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
};

// Verifica si el usuario es administrador
export const isAdmin = (req, res, next) => {
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
};
