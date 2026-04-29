import mongoose from 'mongoose';
import { SIZE_TABLE } from '../data/sizeTable';

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, trim: true },
    inches: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => Object.prototype.hasOwnProperty.call(SIZE_TABLE, v),
        message: 'Medida no válida (no está en la tabla estándar)',
      },
    },
    meters: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);
