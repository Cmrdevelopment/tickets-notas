import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ticketSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pendiente', 'en_curso', 'hecho'], default: 'pendiente', index: true },
    order: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', default: null },

    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Ticket', ticketSchema);
