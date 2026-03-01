import express from 'express';
import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';

const router = express.Router();

// Listar tickets por app
router.get('/', async (req, res) => {
  const { applicationId } = req.query;
  if (!applicationId) return res.status(400).json({ message: 'applicationId requerido' });
  const tickets = await Ticket.find({ applicationId }).sort({ status: 1, order: 1, updatedAt: -1 });
  res.json(tickets);
});

// Crear ticket
router.post('/', async (req, res) => {
  const { applicationId, title, createdBy, assignedTo } = req.body || {};
  if (!applicationId) return res.status(400).json({ message: 'applicationId requerido' });
  if (!title?.trim()) return res.status(400).json({ message: 'title requerido' });
  if (!createdBy) return res.status(400).json({ message: 'createdBy requerido' });

  // ✅ Nuevo ticket arriba del todo: order = 0 y desplazamos el resto
await Ticket.updateMany(
  { applicationId, status: 'pendiente' },
  { $inc: { order: 1 } }
);

const order = 0;

  const ticket = await Ticket.create({
    applicationId,
    title: title.trim(),
    status: 'pendiente',
    order,
    createdBy,
    assignedTo: assignedTo || null,
  });

  res.status(201).json(ticket);
});

// Borrar ticket
router.delete('/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  await Ticket.findByIdAndDelete(ticketId);
  res.json({ ok: true });
});

// Cambiar estado
router.patch('/:ticketId/status', async (req, res) => {
  const { ticketId } = req.params;
  const { status } = req.body || {};
  if (!['pendiente', 'en_curso', 'hecho'].includes(status)) {
    return res.status(400).json({ message: 'status inválido' });
  }

  // al cambiar de estado, poner order al final de la nueva columna
  const t = await Ticket.findById(ticketId);
  if (!t) return res.status(404).json({ message: 'Ticket no encontrado' });

  const last = await Ticket.findOne({ applicationId: t.applicationId, status }).sort({ order: -1 });
  const order = last ? (last.order ?? 0) + 1 : 0;

  t.status = status;
  t.order = order;
  await t.save();

  res.json(t);
});

// Reordenar dentro de un estado
router.patch('/reorder', async (req, res) => {
  const { applicationId, status, orderedIds } = req.body || {};
  if (!applicationId) return res.status(400).json({ message: 'applicationId requerido' });
  if (!['pendiente', 'en_curso', 'hecho'].includes(status)) return res.status(400).json({ message: 'status inválido' });
  if (!Array.isArray(orderedIds)) return res.status(400).json({ message: 'orderedIds requerido' });

  const bulk = orderedIds.map((id, idx) => ({
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(id), applicationId: new mongoose.Types.ObjectId(applicationId), status },
      update: { $set: { order: idx } },
    }
  }));

  if (bulk.length) await Ticket.bulkWrite(bulk);
  res.json({ ok: true });
});

// Actualizar título
router.patch('/:ticketId/title', async (req, res) => {
  const { ticketId } = req.params;
  const { title } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ message: 'title requerido' });

  const updated = await Ticket.findByIdAndUpdate(ticketId, { $set: { title: title.trim() } }, { new: true });
  if (!updated) return res.status(404).json({ message: 'Ticket no encontrado' });
  res.json(updated);
});

// Actualizar personas
router.patch('/:ticketId/people', async (req, res) => {
  const { ticketId } = req.params;
  const { createdBy, assignedTo } = req.body || {};
  if (!createdBy) return res.status(400).json({ message: 'createdBy requerido' });

  const updated = await Ticket.findByIdAndUpdate(
    ticketId,
    { $set: { createdBy, assignedTo: assignedTo || null } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: 'Ticket no encontrado' });
  res.json(updated);
});

// Añadir nota
router.post('/:ticketId/notes', async (req, res) => {
  const { ticketId } = req.params;
  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ message: 'text requerido' });

  const updated = await Ticket.findByIdAndUpdate(
    ticketId,
    { $push: { notes: { text: text.trim(), at: new Date() } } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: 'Ticket no encontrado' });
  res.json(updated);
});

// Editar nota
router.patch('/:ticketId/notes/:noteId', async (req, res) => {
  const { ticketId, noteId } = req.params;
  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ message: 'text requerido' });

  const t = await Ticket.findById(ticketId);
  if (!t) return res.status(404).json({ message: 'Ticket no encontrado' });

  const n = t.notes.id(noteId);
  if (!n) return res.status(404).json({ message: 'Nota no encontrada' });

  n.text = text.trim();
  n.at = new Date();
  await t.save();

  res.json(t);
});

// Borrar nota
router.delete('/:ticketId/notes/:noteId', async (req, res) => {
  const { ticketId, noteId } = req.params;
  const t = await Ticket.findById(ticketId);
  if (!t) return res.status(404).json({ message: 'Ticket no encontrado' });

  const n = t.notes.id(noteId);
  if (!n) return res.status(404).json({ message: 'Nota no encontrada' });

  n.deleteOne();
  await t.save();

  res.json(t);
});

export default router;
