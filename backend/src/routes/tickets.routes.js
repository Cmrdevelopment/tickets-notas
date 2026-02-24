import express from "express";
import Ticket from "../models/Ticket.js";

const router = express.Router();

// Listar tickets de una app (opcional: por status)
router.get("/", async (req, res) => {
  const { applicationId, status } = req.query;
  if (!applicationId) return res.status(400).json({ message: "applicationId requerido" });

  const filter = { applicationId };
  if (status) filter.status = status;

  const tickets = await Ticket.find(filter).sort({ order: 1, updatedAt: -1 });
  res.json(tickets);
});

// Crear ticket en una app
router.post("/", async (req, res) => {
  const { applicationId, title } = req.body || {};
  if (!applicationId) return res.status(400).json({ message: "applicationId requerido" });
  if (!title?.trim()) return res.status(400).json({ message: "title requerido" });

  const status = "pendiente";
const last = await Ticket.findOne({ applicationId, status })
  .sort({ order: -1 })
  .select("order");
const maxOrder = last?.order ?? -1;

const ticket = await Ticket.create({
  applicationId,
  title: title.trim(),
  status,
  order: maxOrder + 1
});
  res.status(201).json(ticket);
});

// Cambiar estado (sin botones: en UI se hace click en la tarjeta y cicla)
router.patch("/:ticketId/status", async (req, res) => {
  // moveToBottom: al cambiar estado lo colocamos abajo del nuevo estado

  const { ticketId } = req.params;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ message: "status requerido" });

  const ticket = await Ticket.findById(ticketId);
if (!ticket) return res.status(404).json({ message: "Ticket no encontrado" });

const last = await Ticket.findOne({ applicationId: ticket.applicationId, status })
  .sort({ order: -1 })
  .select("order");
const maxOrder = last?.order ?? -1;

const updated = await Ticket.findByIdAndUpdate(
  ticketId,
  { $set: { status, order: maxOrder + 1, updatedAt: new Date() } },
  { new: true }
);

  res.json(updated);
});

// Añadir nota a un ticket
router.post("/:ticketId/notes", async (req, res) => {
  const { ticketId } = req.params;
  const { text, at } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ message: "text requerido" });

  const note = { text: text.trim(), at: at ? new Date(at) : new Date() };

  const updated = await Ticket.findByIdAndUpdate(
    ticketId,
    { $push: { notes: note }, $set: { updatedAt: new Date() } },
    { new: true }
  );

  res.json(updated);
});
// Editar una nota (actualiza texto y fecha)
router.patch("/:ticketId/notes/:noteId", async (req, res) => {
  const { ticketId, noteId } = req.params;
  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ message: "text requerido" });

  const updated = await Ticket.findOneAndUpdate(
    { _id: ticketId, "notes._id": noteId },
    { $set: { "notes.$.text": text.trim(), "notes.$.at": new Date(), updatedAt: new Date() } },
    { new: true }
  );

  if (!updated) return res.status(404).json({ message: "Nota o ticket no encontrado" });
  res.json(updated);
});

// Borrar una nota
router.delete("/:ticketId/notes/:noteId", async (req, res) => {
  const { ticketId, noteId } = req.params;

  const updated = await Ticket.findByIdAndUpdate(
    ticketId,
    { $pull: { notes: { _id: noteId } }, $set: { updatedAt: new Date() } },
    { new: true }
  );

  if (!updated) return res.status(404).json({ message: "Ticket no encontrado" });
  res.json(updated);
});


// Borrar ticket
router.delete("/:ticketId", async (req, res) => {
  const { ticketId } = req.params;
  await Ticket.findByIdAndDelete(ticketId);
  res.json({ ok: true });
});

// Reordenar tickets dentro de un estado (por app)
// body: { applicationId, status, orderedIds: [id1,id2,...] }  -> asigna order=0..n
router.patch("/reorder", async (req, res) => {
  const { applicationId, status, orderedIds } = req.body || {};
  if (!applicationId) return res.status(400).json({ message: "applicationId requerido" });
  if (!status) return res.status(400).json({ message: "status requerido" });
  if (!Array.isArray(orderedIds)) return res.status(400).json({ message: "orderedIds requerido" });

  const ops = orderedIds.map((id, idx) => ({
    updateOne: {
      filter: { _id: id, applicationId, status },
      update: { $set: { order: idx, updatedAt: new Date() } }
    }
  }));

  if (ops.length) await Ticket.bulkWrite(ops);
  res.json({ ok: true });
});

// Editar título del ticket (simple)
router.patch("/:ticketId/title", async (req, res) => {
  const { ticketId } = req.params;
  const { title } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ message: "title requerido" });

  const updated = await Ticket.findByIdAndUpdate(
    ticketId,
    { $set: { title: title.trim(), updatedAt: new Date() } },
    { new: true }
  );

  if (!updated) return res.status(404).json({ message: "Ticket no encontrado" });
  res.json(updated);
});

export default router;


