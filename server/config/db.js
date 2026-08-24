const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error('Falta MONGODB_URI en server/.env');
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB conectado ✅');
  } catch (err) {
    console.error('Error de conexión:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
