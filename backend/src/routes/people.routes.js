import express from 'express';
import Person from '../models/Person.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  const people = await Person.find().sort({ name: 1 });
  res.json(people);
});

router.post('/', async (req, res) => {
  const { name, color } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ message: 'name requerido' });

  try {
    const p = await Person.create({ name: name.trim(), color: (color || '').trim() });
    res.status(201).json(p);
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: 'Ya existe esa persona' });
    res.status(500).json({ message: 'Error creando persona' });
  }
});

export default router;
