const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protegerRuta } = require('../middleware/authMiddleware');

const generarToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { nombre, email, password, company, jobTitle } = req.body;

  try {
    if (await User.findOne({ email })) {
      return res.status(400).json({ msg: 'El email ya está registrado' });
    }

    const usuario = await User.create({
      nombre,
      email,
      password,
      company: company || '',
      jobTitle: jobTitle || ''
    });

    res.status(201).json({
      token: generarToken(usuario._id),
      user: usuario
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const usuario = await User.findOne({ email });
    if (!usuario || !(await usuario.compararPassword(password)))
      return res.status(401).json({ msg: 'Credenciales incorrectas' });

    res.json({ token: generarToken(usuario._id), user: usuario });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// GET /api/auth/me — verificar sesión activa
router.get('/me', protegerRuta, (req, res) => res.json(req.user));

// Agrega esta ruta junto a la de /me
router.get('/verify', protegerRuta, (req, res) => res.json(req.user));

// PUT /api/auth/profile — actualizar perfil
router.put('/profile', protegerRuta, async (req, res) => {
  try {
    const { nombre, company, jobTitle, phone, country } = req.body;

    const usuario = await User.findById(req.user._id);
    if (!usuario) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    usuario.nombre = nombre ?? usuario.nombre;
    usuario.company = company ?? usuario.company;
    usuario.jobTitle = jobTitle ?? usuario.jobTitle;
    usuario.phone = phone ?? usuario.phone;
    usuario.country = country ?? usuario.country;

    const actualizado = await usuario.save();
    res.json(actualizado);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// PUT /api/auth/password — cambiar contraseña
router.put('/password', protegerRuta, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const usuario = await User.findById(req.user._id);
    if (!usuario) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    const coincide = await usuario.compararPassword(oldPassword);
    if (!coincide) {
      return res.status(400).json({ msg: 'La contraseña actual es incorrecta' });
    }

    usuario.password = newPassword;
    await usuario.save();

    res.json({ msg: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

//Funciones para el reestablecimiento de contraseñas
// Solicitar reestablecimiento de contraseña
// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Por seguridad, se responde lo mismo aunque el usuario no exista
    if (!user) {
      return res.json({ message: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
    }

    // Clave secreta dinámica basada en la contraseña actual.
    // Si el usuario llega a cambiar la contraseña, este JWT quedará invalidado inmediatamente.
    const secret = process.env.JWT_SECRET + user.password;

    // Firmar el JWT con expiración de 15 minutos
    const resetToken = jwt.sign(
      { id: user._id, email: user.email },
      secret,
      { expiresIn: '15m' }
    );

    // Enlace temporal hacia tu frontend (React)
    const resetUrl = `http://localhost:5173/reset-password/${user._id}/${resetToken}`;

    // TODO: Enviar el correo usando Nodemailer o tu proveedor SMTP.
    // Por ahora lo imprimes en consola para pruebas:
    console.log(`[RECUPERACIÓN] Enlace generado para ${email}: ${resetUrl}`);

    res.json({ message: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

//Cambiar la contrasena con el token
//POST /api/auth/reset-password/:id/:token

router.post('/reset-password/:id/:token', async (req, res) => {
  try {
    const { id, token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(400).json({ error: 'El enlace es inválido o el usuario no existe.' });
    }

    // Reconstruir el secreto con el que se firmó el token
    const secret = process.env.JWT_SECRET + user.password;

    // Verificar si el token JWT es válido y no ha expirado
    try {
      jwt.verify(token, secret);
    } catch (err) {
      return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado.' });
    }

    // Hashear la nueva contraseña con bcrypt
    //const salt = await bcrypt.genSalt(10);
    user.password = newPassword;

    // Limpiar los campos del token de recuperación
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Guardar los cambios en MongoDB
    await user.save();

    res.json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
