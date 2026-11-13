const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  nombre:   { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  rol:      { type: String, enum: ['admin', 'user'], default: 'user' },
  company:  { type: String, default: '', trim: true },
  jobTitle: { type: String, default: '', trim: true },
  phone: { type: String, default: '' },
  country: { type: String, default: '' },
  // Recuperación de contraseñas
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
}, { timestamps: true });

// --- Ocultar campos sensibles al serializar a JSON -----------------------
// Al hacer res.json(usuario) o usuario.toObject(), el hash de contraseña
// y los tokens de recuperación nunca salen al cliente.
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

// Middleware pre-save: hashea la contraseña solo si cambió
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.compararPassword = async function (candidato) {
  return bcrypt.compare(candidato, this.password);
};

module.exports = mongoose.model('User', UserSchema);
