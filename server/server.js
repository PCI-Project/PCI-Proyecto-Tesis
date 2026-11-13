const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const Authroute = require('./routes/auth');
const Projectroute = require('./routes/projects');
const connectDB = require('./config/db');

// --- Variables de entorno obligatorias -----------------------------------
dotenv.config();

const requiredEnv = ['MONGODB_URI', 'JWT_SECRET'];
const missing = requiredEnv.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
  process.exit(1);
}

connectDB();

const app = express();

// --- Límites de cuerpo por ruta (no 10 MB en todo el servidor) -----------
const jsonLargo = express.json({ limit: '2mb' });   // consultas del agente / projects
const jsonEstricto = express.json({ limit: '100kb' }); // auth y rutas pequeñas

// --- Seguridad de cabeceras -----------------------------------------------
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

// --- CORS: solo orígenes de confianza, sin IPs privadas -------------------
const origenesPermitidos = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// En desarrollo se acepta localhost; en producción se definen por variable de entorno
if (process.env.NODE_ENV !== 'production') {
  origenesPermitidos.push('http://localhost:3500', 'http://localhost:5173');
}

app.use(cors({
  origin: origenesPermitidos.length ? origenesPermitidos : false,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

// --- Rate limiting global (protege contra fuerza bruta) --------------------
const limiterGlobal = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,                 // 100 requests por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
});
app.use(limiterGlobal);

// Límite más estricto solo para rutas de auth (login / registro / recuperación)
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación. Intenta de nuevo más tarde.' },
});

// --- Comprobación de estado (pública) -------------------------------------
app.get('/api', (req, res) => {
  res.json({ status: 'online', version: process.env.npm_package_version || '1.0.0' });
});

// Rutas de auth con límite estricto y cuerpo pequeño
app.use('/api/auth', limiterAuth, jsonEstricto, Authroute);
// Rutas de proyectos con cuerpo más grande (datos del agente)
app.use('/api/projects', jsonLargo, Projectroute);

// Puerto: fallar si no hay PORT en producción, valor por defecto solo en dev
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? process.exit(1) || 0 : 5000);
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

module.exports = app; // permite importar en pruebas sin arrancar el servidor
