const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protegerRuta = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>
  if (!token) return res.status(401).json({ msg: 'No autorizado, falta token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch {
    res.status(401).json({ msg: 'Token inválido o expirado' });
  }
};

module.exports = { protegerRuta };
