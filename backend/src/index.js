import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import applicationsRoutes from './routes/applications.routes.js';
import ticketsRoutes from './routes/tickets.routes.js';
import peopleRoutes from './routes/people.routes.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ Falta MONGO_URI en variables de entorno');
  process.exit(1);
}

const app = express();

// CORS
const rawOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const allowAll = rawOrigins.length === 0;

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Postman/curl
    if (allowAll) return cb(null, true);
    if (rawOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS bloqueado para ${origin}`));
  },
  credentials: false,
}));
app.options('*', cors());

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/applications', applicationsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/people', peopleRoutes);

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Mongo conectado');
    app.listen(PORT, () => console.log(`✅ API escuchando en :${PORT}`));
  } catch (e) {
    console.error('❌ Error arrancando:', e);
    process.exit(1);
  }
}

start();
