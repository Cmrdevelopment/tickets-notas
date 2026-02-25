import mongoose from 'mongoose';

const personSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    color: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('Person', personSchema);
