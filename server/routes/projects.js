const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
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

// DELETE /api/projects/:id — eliminar proyecto
router.delete('/:id', async (req, res) => {
  try {
    const proyecto = await Project.findOneAndDelete({
      _id: req.params.id, propietario: req.user._id
    });
    if (!proyecto) return res.status(404).json({ msg: 'Proyecto no encontrado' });
    res.json({ msg: 'Proyecto eliminado' });
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

module.exports = router;
