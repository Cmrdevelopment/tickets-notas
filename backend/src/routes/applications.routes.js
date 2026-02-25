import express from 'express';
import Application from '../models/Application.js';
import Ticket from '../models/Ticket.js';

const router = express.Router();

async function collectDescendants(rootId) {
  const all = [String(rootId)];
  const queue = [String(rootId)];
  while (queue.length) {
    const cur = queue.shift();
    const kids = await Application.find({ parentId: cur }).select('_id');
    for (const k of kids) {
      const id = String(k._id);
      if (!all.includes(id)) {
        all.push(id);
        queue.push(id);
      }
    }
  }
  return all;
}

// Listar apps
router.get('/', async (_req, res) => {
  const apps = await Application.find().sort({ order: 1, createdAt: 1 });
  res.json(apps);
});

// Crear app
router.post('/', async (req, res) => {
  const { name, parentId } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ message: 'name requerido' });

  try {
    const last = await Application.findOne({ parentId: parentId || null }).sort({ order: -1 });
    const order = last ? (last.order ?? 0) + 1 : 0;
    const app = await Application.create({ name: name.trim(), parentId: parentId || null, order });
    res.status(201).json(app);
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: 'Ya existe una app con ese nombre' });
    res.status(500).json({ message: 'Error creando app' });
  }
});

// Renombrar app
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ message: 'name requerido' });

  try {
    const updated = await Application.findByIdAndUpdate(
      id,
      { $set: { name: name.trim() } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'App no encontrada' });
    res.json(updated);
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: 'Ya existe una app con ese nombre' });
    res.status(500).json({ message: 'Error renombrando app' });
  }
});

// Mover app (anidar / sacar a raíz)
router.patch('/:id/move', async (req, res) => {
  const { id } = req.params;
  const { parentId } = req.body || {};

  // evitar ciclo (no permitir poner como parent a un descendiente)
  if (parentId) {
    const descendants = await collectDescendants(id);
    if (descendants.includes(String(parentId))) {
      return res.status(400).json({ message: 'Movimiento inválido (ciclo)' });
    }
  }

  const updated = await Application.findByIdAndUpdate(
    id,
    { $set: { parentId: parentId || null } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: 'App no encontrada' });
  res.json(updated);
});

// Borrar app (borra también subapps y tickets)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const ids = await collectDescendants(id);
  await Ticket.deleteMany({ applicationId: { $in: ids } });
  await Application.deleteMany({ _id: { $in: ids } });
  res.json({ ok: true, deleted: ids.length });
});

export default router;
