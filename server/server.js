const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);


dotenv.config();
connectDB();

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://192.168.56.1:3000'] })); // URL de tu frontend Vite
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));

app.listen(process.env.PORT || 5000, () =>
  console.log(`Servidor corriendo en puerto ${process.env.PORT}`)
);

