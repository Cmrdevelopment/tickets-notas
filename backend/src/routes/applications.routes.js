import express from "express";
import Application from "../models/Application.js";
import Ticket from "../models/Ticket.js";

const router = express.Router();

// Listar apps
router.get("/", async (_req, res) => {
  const apps = await Application.find().sort({ createdAt: -1 });
  res.json(apps);
});

// Crear app
router.post("/", async (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ message: "name requerido" });

  try {
    const app = await Application.create({ name: name.trim() });
    res.status(201).json(app);
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: "Ya existe una app con ese nombre" });
    }
    res.status(500).json({ message: "Error creando app" });
  }
});

// Borrar app (borra también sus tickets)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await Ticket.deleteMany({ applicationId: id });
  await Application.findByIdAndDelete(id);
  res.json({ ok: true });
});

export default router;
