const mongoose = require('mongoose');

// Una consulta (versión) al agente de recomendaciones. Va en su propia colección y no dentro del proyecto:
// cada consulta guarda la entrada, el análisis y la narrativa completos y varias juntas pasarían el límite
// de 16 MB de un documento (además de hacer pesado cada guardado del proyecto).
const AgentRunSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  propietario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  runId: { type: String, required: true },          // id que genera el panel (run-xxxx-N)
  number: { type: Number, required: true },         // v1, v2, v3…
  ranAt: { type: String, required: true },          // ISO de la consulta (el `createdAt` del panel; `createdAt` de Mongo es otro)
  inputHash: { type: String, required: true },
  config: { type: mongoose.Schema.Types.Mixed, required: true },
  contexts: { type: mongoose.Schema.Types.Mixed, default: {} },
  input: { type: mongoose.Schema.Types.Mixed },
  analysis: { type: mongoose.Schema.Types.Mixed, required: true },
  narrative: { type: mongoose.Schema.Types.Mixed },
  narrativeSource: { type: String, enum: ['modelo', 'automatica', 'importado'], required: true },
  agentVersion: { type: String, default: '' },
  status: { type: String, enum: ['listo', 'error'], default: 'listo' },
  error: { type: String },
}, { timestamps: true });

AgentRunSchema.index({ project: 1, runId: 1 }, { unique: true });

module.exports = mongoose.model('AgentRun', AgentRunSchema);
