import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now } // fecha/hora de la nota
  },
  { _id: true }
);

const ticketSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true
    },
    title: { type: String, required: true, trim: true },

    // ✅ Estado simple
    status: {
      type: String,
      enum: ["pendiente", "en_curso", "hecho"],
      default: "pendiente",
      index: true
    },

    // ✅ Orden dentro de cada estado (menor = más arriba)
    order: { type: Number, default: 0, index: true },

    notes: { type: [noteSchema], default: [] }
  },
  { timestamps: true }
);

export default mongoose.model("Ticket", ticketSchema);
