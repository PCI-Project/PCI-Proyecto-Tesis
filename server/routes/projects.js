const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Project = require('../models/Project');
const AgentRun = require('../models/AgentRun');
const { protegerRuta } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(protegerRuta);

// GET /api/projects — obtener proyectos del usuario
router.get('/', async (req, res) => {
  try {
    const proyectos = await Project.find({ propietario: req.user._id });
    res.json(proyectos);
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

// POST /api/projects — crear proyecto
router.post('/', async (req, res) => {
  try {
    console.log(`[POST /projects] Creando proyecto para usuario ${req.user._id}`, { nombre: req.body.name });
    const proyecto = await Project.create({ ...req.body, propietario: req.user._id });
    console.log(`[POST /projects] Proyecto creado con _id: ${proyecto._id}`);
    res.status(201).json(proyecto);
  } catch (err) { 
    console.error(`[POST /projects] Error:`, err.message);
    res.status(400).json({ msg: err.message }); 
  }
});

// PUT /api/projects/:id — actualizar proyecto
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.propietario; // evitar cambio de propietario desde el cliente

    const proyecto = await Project.findOneAndUpdate(
      { _id: req.params.id, propietario: req.user._id },
      updateData,
      { returnDocument: 'after', runValidators: true }
    );
    if (!proyecto) return res.status(404).json({ msg: 'Proyecto no encontrado' });
    res.json(proyecto);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

// --- Consultas (versiones) del agente de recomendaciones ---------------------------------------------
// Se guardan aparte del proyecto para poder consultarlas sin volver a generarlas.
const RUN_FIELDS = ['number', 'inputHash', 'config', 'contexts', 'input', 'analysis', 'narrative', 'narrativeSource', 'agentVersion', 'status', 'error'];
const toClientRun = doc => {
  const o = doc.toObject ? doc.toObject() : doc;
  const run = { id: o.runId, createdAt: o.ranAt };
  RUN_FIELDS.forEach(k => { if (o[k] !== undefined && o[k] !== null) run[k] = o[k]; });
  return run;
};
const ownsProject = async req => {
  if (!mongoose.isValidObjectId(req.params.id)) return false;
  return Boolean(await Project.exists({ _id: req.params.id, propietario: req.user._id }));
};

// GET /api/projects/:id/agent-runs — todas las consultas del proyecto, la más nueva primero
router.get('/:id/agent-runs', async (req, res) => {
  try {
    if (!(await ownsProject(req))) return res.status(404).json({ msg: 'Proyecto no encontrado' });
    const runs = await AgentRun.find({ project: req.params.id, propietario: req.user._id }).sort({ number: -1 });
    res.json(runs.map(toClientRun));
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

// PUT /api/projects/:id/agent-runs/:runId — guarda (o reemplaza) una consulta; repetirla no duplica
router.put('/:id/agent-runs/:runId', async (req, res) => {
  try {
    if (!(await ownsProject(req))) return res.status(404).json({ msg: 'Proyecto no encontrado' });
    const body = req.body || {};
    if (!body.analysis || !body.config || !body.createdAt || !body.inputHash || !Number.isFinite(Number(body.number))) {
      return res.status(400).json({ msg: 'Consulta incompleta' });
    }
    const data = { ranAt: String(body.createdAt) };
    RUN_FIELDS.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
    const saved = await AgentRun.findOneAndUpdate(
      { project: req.params.id, propietario: req.user._id, runId: req.params.runId },
      { $set: data }, // los campos del filtro (proyecto, dueño, runId) se insertan solos con el upsert
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
    res.json(toClientRun(saved));
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

// DELETE /api/projects/:id/agent-runs/:runId — borra una consulta
router.delete('/:id/agent-runs/:runId', async (req, res) => {
  try {
    if (!(await ownsProject(req))) return res.status(404).json({ msg: 'Proyecto no encontrado' });
    await AgentRun.deleteOne({ project: req.params.id, propietario: req.user._id, runId: req.params.runId });
    res.json({ msg: 'Consulta eliminada' });
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

// DELETE /api/projects/:id — eliminar proyecto
router.delete('/:id', async (req, res) => {
  try {
    const proyecto = await Project.findOneAndDelete({
      _id: req.params.id, propietario: req.user._id
    });
    if (!proyecto) return res.status(404).json({ msg: 'Proyecto no encontrado' });
    await AgentRun.deleteMany({ project: proyecto._id }); // sus consultas del agente se van con él
    res.json({ msg: 'Proyecto eliminado' });
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

// POST /api/projects/recommendations — generar recomendaciones de mantenimiento
router.post('/:id/recommendations', async (req, res) => {
  try {
    const { id } = req.params;
    const projectData = req.body;
    
    // Validación básica
    if (!projectData || !projectData.sections) {
      return res.status(400).json({ msg: 'Datos de proyecto inválidos' });
    }
    
    // Calcular recomendaciones usando el motor interno
    const { weightedPCI, recommendations } = calcularRecomendaciones(projectData);
    
    res.json({
      success: true,
      proyectoId: id,
      weightedPCI,
      recommendations
    });
  } catch (err) {
    console.error('[POST /projects/:id/recommendations] Error:', err.message);
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;

// Función auxiliar para generar recomendaciones basadas en los datos PCI
function calcularRecomendaciones(project) {
  const ratingMap = {
    'Excelente': { tratamiento: 'Mantenimiento rutinario', prioridad: 'baja' },
    'Muy Bueno': { tratamiento: 'Mantenimiento preventivo', prioridad: 'baja' },
    'Bueno': { tratamiento: 'Tratamiento superficial', prioridad: 'media' },
    'Regular': { tratamiento: 'Rehabilitación / recapeo', prioridad: 'alta' },
    'Malo': { tratamiento: 'Reconstrucción parcial', prioridad: 'alta' },
    'Muy Malo': { tratamiento: 'Reconstrucción total', prioridad: 'alta' }
  };
  
  const recommendations = [];
  
  project.sections.forEach(section => {
    const pci = section.pci ?? 100;
    
    // Determinar rating simplificado
    let rating = 'Excelente';
    if (pci >= 85) rating = 'Excelente';
    else if (pci >= 70) rating = 'Muy Bueno';
    else if (pci >= 55) rating = 'Bueno';
    else if (pci >= 40) rating = 'Regular';
    else if (pci >= 25) rating = 'Malo';
    else rating = 'Muy Malo';
    
    const info = ratingMap[rating] || ratingMap['Regular'];
    
    recommendations.push({
      sectionId: section.id,
      sectionName: section.name,
      pci: pci,
      ratingActual: rating,
      tratamientoRecomendado: info.tratamiento,
      prioridad: info.prioridad,
      costoEstimado: Math.round(Math.random() * 5000 + 500), // Costo ejemplo
      beneficioCosto: Math.round((Math.random() * 10 + 1) * 100) / 100, // B/C ejemplo
      alertaSuficienciaEstadistica: false,
      observaciones: 'Tratamiento según el rango de PCI del tramo. El costo y el B/C son valores de ejemplo, no un presupuesto.'
    });
  });
  
  return {
    weightedPCI: project.weightedPCI || project.sections.reduce((sum, s) => sum + (s.pci || 100), 0) / project.sections.length,
    recommendations
  };
}
