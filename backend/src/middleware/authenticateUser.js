export const authenticateUser = (req, res, next) => {
  //console.log('Sesión en authenticateUser:', req.session);
  if (req.session && req.session.user) {
    req.user = req.session.user;
    next();
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
};



