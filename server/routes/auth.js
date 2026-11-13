const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protegerRuta } = require('../middleware/authMiddleware');

// JWT_SECRET validado al arrancar el servidor (server.js)
const generarToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// --- Validación básica de tipos para evitar inyección NoSQL ----------------
const esCadenaValida = (valor) => typeof valor === 'string' && valor.trim().length > 0;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { nombre, email, password, company, jobTitle } = req.body;

  // Validar que email y password sean cadenas (evita operadores de Mongo como $ne)
  if (!esCadenaValida(email) || !esCadenaValida(password)) {
    return res.status(400).json({ msg: 'Correo y contraseña son obligatorios.' });
  }

  try {
    const existe = await User.findOne({ email: email.toLowerCase().trim() });
    if (existe) {
      return res.status(400).json({ msg: 'El correo ya está registrado.' });
    }

    const usuario = await User.create({
      nombre: nombre || '',
      email: email.toLowerCase().trim(),
      password,
      company: company || '',
      jobTitle: jobTitle || '',
    });

    // toJSON del modelo oculta password y tokens: seguro devolverlo
    res.status(201).json({
      token: generarToken(usuario._id),
      user: usuario,
    });
  } catch (err) {
    // Nunca enviar detalles internos al cliente
    console.error('Error en registro:', err.message);
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!esCadenaValida(email) || !esCadenaValida(password)) {
    return res.status(400).json({ msg: 'Correo y contraseña son obligatorios.' });
  }

  try {
    // Siempre mismo mensaje genérico para no revelar si el correo existe
    const usuario = await User.findOne({ email: email.toLowerCase().trim() });
    if (!usuario || !(await usuario.compararPassword(password))) {
      return res.status(401).json({ msg: 'Credenciales incorrectas.' });
    }

    res.json({
      token: generarToken(usuario._id),
      user: usuario, // toJSON oculta el hash de contraseña
    });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
});

// GET /api/auth/me — verificar sesión activa
router.get('/me', protegerRuta, (req, res) => res.json(req.user));

// GET /api/auth/verify — alias para verificar sesión
router.get('/verify', protegerRuta, (req, res) => res.json(req.user));

// PUT /api/auth/profile — actualizar perfil (campos permitidos lista blanca)
router.put('/profile', protegerRuta, async (req, res) => {
  const camposPermitidos = ['nombre', 'company', 'jobTitle', 'phone', 'country'];
  const actualizaciones = {};
  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined) actualizaciones[campo] = req.body[campo];
  }

  try {
    const usuario = await User.findById(req.user._id);
    if (!usuario) {
      return res.status(404).json({ msg: 'Usuario no encontrado.' });
    }

    Object.assign(usuario, actualizaciones);
    const guardado = await usuario.save();
    res.json(guardado); // toJSON oculta password
  } catch (err) {
    console.error('Error actualizando perfil:', err.message);
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
});

// PUT /api/auth/password — cambiar contraseña
router.put('/password', protegerRuta, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!esCadenaValida(oldPassword) || !esCadenaValida(newPassword)) {
    return res.status(400).json({ msg: 'Contraseña actual y nueva son obligatorias.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ msg: 'La contraseña nueva debe tener al menos 6 caracteres.' });
  }

  try {
    const usuario = await User.findById(req.user._id);
    if (!usuario) {
      return res.status(404).json({ msg: 'Usuario no encontrado.' });
    }

    const coincide = await usuario.compararPassword(oldPassword);
    if (!coincide) {
      return res.status(400).json({ msg: 'La contraseña actual es incorrecta.' });
    }

    usuario.password = newPassword;
    await usuario.save();

    // Nota: cambiar la contraseña invalida los enlaces de recuperación pendientes
    // porque el secreto del token depende del hash actual.
    res.json({ msg: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error('Error cambiando contraseña:', err.message);
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
});

// --- Recuperación de contraseña -------------------------------------------
// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!esCadenaValida(email)) {
    return res.status(400).json({ msg: 'Correo obligatorio.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Respuesta idéntica si existe o no (evita enumerar usuarios)
    if (!user) {
      return res.json({ message: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
    }

    // Secreto dinámico: si el usuario cambia la contraseña, el token queda invalido
    const secret = process.env.JWT_SECRET + user.password;

    const resetToken = jwt.sign(
      { id: user._id, email: user.email },
      secret,
      { expiresIn: '15m' }
    );

    // URL base del frontend tomada de variable de entorno (nunca localhost en producción)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl}/reset-password/${user._id}/${resetToken}`;

    // TODO: Enviar el correo real mediante SMTP/Nodemailer usando resetUrl.
    // NUNCA escribir resetUrl en console.log ni en logs del servidor (fuga de enlace secreto).
    // Por ahora solo se confirma que se procesó la solicitud.

    res.json({ message: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
  } catch (error) {
    console.error('Error en forgot-password:', error.message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/auth/reset-password/:id/:token
router.post('/reset-password/:id/:token', async (req, res) => {
  const { id, token } = req.params;
  const { newPassword } = req.body;

  if (!esCadenaValida(newPassword) || newPassword.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(400).json({ error: 'El enlace es inválido o el usuario no existe.' });
    }

    const secret = process.env.JWT_SECRET + user.password;

    try {
      jwt.verify(token, secret);
    } catch (err) {
      return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado.' });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error en reset-password:', error.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;