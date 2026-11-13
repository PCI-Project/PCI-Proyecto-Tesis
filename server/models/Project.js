const mongoose = require('mongoose');

const DistressSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  severity: { type: String, required: true },
  quantity: { type: Number, required: true },
}, { _id: false });

const SampleSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  area: { type: Number, required: true },
  pavementType: { type: String, required: true },
  distresses: { type: [DistressSchema], default: [] },
  isAdditional: { type: Boolean, default: false },
  evaluated: { type: Boolean },                     // unidad confirmada como evaluada aunque no tenga fallas
  calculationDetails: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const SectionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  length: { type: Number, required: true },
  width: { type: Number, required: true },
  startStation: { type: Number, required: true },
  pavementType: { type: String, required: true },
  sampleUnitArea: { type: Number, required: true },
  stdDev: { type: Number, required: true },
  allowableError: { type: Number, required: true },
  evaluateAllSamples: { type: Boolean, required: true },
  startSampleUnit: { type: Number },
  location: { type: String },
  routeLocation: { type: mongoose.Schema.Types.Mixed },   // ruta del tramo en el mapa (coordenadas, datum, UTM)
  area: { type: Number, required: true },
  sampleUnitLength: { type: Number, required: true },
  totalSampleUnits: { type: Number, required: true },
  minSampleUnits: { type: Number, required: true },
  samplingInterval: { type: Number, required: true },
  samples: { type: [SampleSchema], default: [] },
  pci: Number,
  samplesSufficient: { type: Boolean },
  context: { type: mongoose.Schema.Types.Mixed },   // datos del tramo para el agente (tipo de vía, bordillo, tránsito…)
}, { _id: false });

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  inspector: { type: String, required: true },
  inspectionDate: { type: String, required: true },
  lastView: { type: String },
  weightedPCI: { type: Number },
  nombre: { type: String, required: true },
  descripcion: String,
  propietario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sections: { type: [SectionSchema], default: [] },
  agentConfig: { type: mongoose.Schema.Types.Mixed }, // calibración del agente (costos, presupuesto, umbrales…)
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);