const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  nombre:   { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  rol:      { type: String, enum: ['admin', 'user'], default: 'user' },
}, { timestamps: true });

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.compararPassword = function (candidato) {
  return bcrypt.compare(candidato, this.password);
};

module.exports = mongoose.model('User', UserSchema);