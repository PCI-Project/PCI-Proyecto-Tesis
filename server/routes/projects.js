const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Project = require('../models/Project');
const AgentRun = require('../models/AgentRun');
const { protegerRuta } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(protegerRuta);

// --- Campos permitidos al crear/actualizar un proyecto (lista blanca) -----
const PROYECTO_CAMPOS_PERMITIDOS = [
  'name', 'nombre', 'descripcion', 'inspector', 'inspectionDate',
  'lastView', 'weightedPCI', 'sections', 'agentConfig',
];

const filtrarCamposProyecto = (body) => {
  const datos = {};
  for (const campo of PROYECTO_CAMPOS_PERMITIDOS) {
    if (body[campo] !== undefined) datos[campo] = body[campo];
  }
  // Nunca permitir que el cliente establezca propietario ni _id
  delete datos.propietario;
  delete datos._id;
  return datos;
};

// GET /api/projects — obtener proyectos del usuario (sin paginación todavía)
router.get('/', async (req, res) => {
  try {
    const proyectos = await Project.find({ propietario: req.user._id }).select('-__v');
    res.json(proyectos);
  } catch (err) {
    console.error('Error listando proyectos:', err.message);
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
});

// POST /api/projects — crear proyecto
router.post('/', async (req, res) => {
  try {
    const datos = filtrarCamposProyecto(req.body);
    datos.propietario = req.user._id;

    const proyecto = await Project.create(datos);
    res.status(201).json(proyecto);
  } catch (err) {
    console.error('Error creando proyecto:', err.message);
    res.status(400).json({ msg: 'Error interno del servidor.' });
  }
});

// PUT /api/projects/:id — actualizar proyecto (solo campos conocidos)
router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ msg: 'ID de proyecto inválido.' });
    }

    const updateData = filtrarCamposProyecto(req.body);

    const proyecto = await Project.findOneAndUpdate(
      { _id: req.params.id, propietario: req.user._id },
      { $set: updateData }, // $set explícito: evita operadores como $rename o $unset
      { returnDocument: 'after', runValidators: true }
    );

    if (!proyecto) return res.status(404).json({ msg: 'Proyecto no encontrado.' });
    res.json(proyecto);
  } catch (err) {
    console.error('Error actualizando proyecto:', err.message);
    res.status(400).json({ msg: 'Error interno del servidor.' });
  }
});

// --- Consultas (versiones) del agente de recomendaciones ------------------
const RUN_FIELDS = ['number', 'inputHash', 'config', 'contexts', 'input', 'analysis', 'narrative', 'narrativeSource', 'agentVersion', 'status', 'error'];

const toClientRun = (doc) => {
  const o = doc.toObject ? doc.toObject() : doc;
  const run = { id: o.runId, createdAt: o.ranAt };
  RUN_FIELDS.forEach((k) => { if (o[k] !== undefined && o[k] !== null) run[k] = o[k]; });
  return run;
};

const ownsProject = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) return false;
  return Boolean(await Project.exists({ _id: req.params.id, propietario: req.user._id }));
};

// GET /api/projects/:id/agent-runs — consultas del proyecto, la más nueva primero
router.get('/:id/agent-runs', async (req, res) => {
  try {
    if (!(await ownsProject(req))) return res.status(404).json({ msg: 'Proyecto no encontrado.' });
    const runs = await AgentRun.find({ project: req.params.id, propietario: req.user._id }).sort({ number: -1 });
    res.json(runs.map(toClientRun));
  } catch (err) {
    console.error('Error listando agent-runs:', err.message);
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
});

// PUT /api/projects/:id/agent-runs/:runId — guarda o reemplaza una consulta
router.put('/:id/agent-runs/:runId', async (req, res) => {
  try {
    if (!(await ownsProject(req))) return res.status(404).json({ msg: 'Proyecto no encontrado.' });

    const body = req.body || {};
    if (!body.analysis || !body.config || !body.createdAt || !body.inputHash || !Number.isFinite(Number(body.number))) {
      return res.status(400).json({ msg: 'Consulta incompleta.' });
    }

    const data = { ranAt: String(body.createdAt) };
    RUN_FIELDS.forEach((k) => { if (body[k] !== undefined) data[k] = body[k]; });

    const saved = await AgentRun.findOneAndUpdate(
      { project: req.params.id, propietario: req.user._id, runId: req.params.runId },
      { $set: data },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
    res.json(toClientRun(saved));
  } catch (err) {
    console.error('Error guardando agent-run:', err.message);
    res.status(400).json({ msg: 'Error interno del servidor.' });
  }
});

// DELETE /api/projects/:id/agent-runs/:runId — borra una consulta
router.delete('/:id/agent-runs/:runId', async (req, res) => {
  try {
    if (!(await ownsProject(req))) return res.status(404).json({ msg: 'Proyecto no encontrado.' });
    await AgentRun.deleteOne({ project: req.params.id, propietario: req.user._id, runId: req.params.runId });
    res.json({ msg: 'Consulta eliminada.' });
  } catch (err) {
    console.error('Error eliminando agent-run:', err.message);
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
});

// DELETE /api/projects/:id — eliminar proyecto y sus consultas del agente
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ msg: 'ID de proyecto inválido.' });
    }

    const proyecto = await Project.findOneAndDelete({
      _id: req.params.id, propietario: req.user._id,
    });
    if (!proyecto) return res.status(404).json({ msg: 'Proyecto no encontrado.' });

    await AgentRun.deleteMany({ project: proyecto._id });
    res.json({ msg: 'Proyecto eliminado.' });
  } catch (err) {
    console.error('Error eliminando proyecto:', err.message);
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
});

// POST /api/projects/:id/recommendations — generar recomendaciones de mantenimiento
router.post('/:id/recommendations', async (req, res) => {
  try {
    const { id } = req.params;
    const projectData = req.body;

    if (!projectData || !projectData.sections) {
      return res.status(400).json({ msg: 'Datos de proyecto inválidos.' });
    }

    const { weightedPCI, recommendations } = calcularRecomendaciones(projectData);

    res.json({
      success: true,
      proyectoId: id,
      weightedPCI,
      recommendations,
    });
  } catch (err) {
    console.error('[POST /projects/:id/recommendations] Error:', err.message);
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
});

module.exports = router;

// --- Cálculo interno de recomendaciones (soportes del agente) -----------
// NOTA: costoEstimado y beneficioCosto son valores de referencia, no presupuestos reales.
function calcularRecomendaciones(project) {
  const ratingMap = {
    'Excelente': { tratamiento: 'Mantenimiento rutinario', prioridad: 'baja' },
    'Muy Bueno': { tratamiento: 'Mantenimiento preventivo', prioridad: 'baja' },
    'Bueno': { tratamiento: 'Tratamiento superficial', prioridad: 'media' },
    'Regular': { tratamiento: 'Rehabilitación / recapeo', prioridad: 'alta' },
    'Malo': { tratamiento: 'Reconstrucción parcial', prioridad: 'alta' },
    'Muy Malo': { tratamiento: 'Reconstrucción total', prioridad: 'alta' },
  };

  const recommendations = [];

  project.sections.forEach((section) => {
    const pci = section.pci ?? 100;

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
      costoEstimado: Math.round(Math.random() * 5000 + 500), // Valor de referencia, reemplazar por catálogo real
      beneficioCosto: Math.round((Math.random() * 10 + 1) * 100) / 100, // Valor de referencia
      alertaSuficienciaEstadistica: false,
      observaciones: 'Tratamiento según el rango de PCI del tramo. El costo y el B/C son valores de referencia, no un presupuesto.',
    });
  });

  return {
    weightedPCI: project.weightedPCI || project.sections.reduce((sum, s) => sum + (s.pci || 100), 0) / project.sections.length,
    recommendations,
  };
}