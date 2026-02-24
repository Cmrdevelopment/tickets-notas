import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

import applicationsRoutes from "./routes/applications.routes.js";
import ticketsRoutes from "./routes/tickets.routes.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/applications", applicationsRoutes);
app.use("/api/tickets", ticketsRoutes);

const PORT = process.env.PORT || 4000;

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Mongo conectado");
  app.listen(PORT, () => console.log(`✅ API en http://localhost:${PORT}`));
}

start().catch((e) => {
  console.error("❌ Error arrancando:", e);
  process.exit(1);
});
