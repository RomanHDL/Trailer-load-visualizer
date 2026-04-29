import mongoose from 'mongoose';
import { SIZE_TABLE } from '../data/sizeTable';

const BoxSchema = new mongoose.Schema(
  {
    inches: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => Object.prototype.hasOwnProperty.call(SIZE_TABLE, v),
        message: 'Medida no válida',
      },
    },
    meters: { type: Number, required: true },
  },
  { _id: true }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, trim: true },
    boxes: { type: [BoxSchema], default: [] },
    totalMeters: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'saved'], default: 'draft' },
  },
  { timestamps: true }
);

OrderSchema.pre('save', function (next) {
  this.totalMeters = this.boxes.reduce((s, b) => s + b.meters, 0);
  next();
});

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);
