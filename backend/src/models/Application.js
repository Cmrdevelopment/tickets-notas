import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Application', applicationSchema);
