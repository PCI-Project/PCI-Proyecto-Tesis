const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Authroute = require('./routes/auth');
const Projectroute = require('./routes/projects');
const connectDB = require('./config/db');

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);


dotenv.config();
connectDB();

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3500',
    'http://192.168.56.1:3000',
    'http://192.168.0.10:3000',
    'https://asphaltpcipro.company',
    'https://www.asphaltpcipro.company',
    'https://pci-project.github.io',
    'https://pci-687s.onrender.com',
    'https://pci-backend-mqoc.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
})); // URLs permitidas para el frontend (local, red y GitHub Pages)
app.use(express.json());

app.use('/api/auth', Authroute);
app.use('/api/projects', Projectroute);

app.listen(process.env.PORT || 5000, () =>
  console.log(`Servidor corriendo en puerto ${process.env.PORT}`)
);

