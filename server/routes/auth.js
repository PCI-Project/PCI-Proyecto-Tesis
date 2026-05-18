const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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

module.exports = router;
