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

// Tarima ya "empacada" (carril + posición ya resueltos), tal como la mostró
// el simulador en el momento exacto de guardar la orden.
const SnapshotBoxSchema = new mongoose.Schema(
  {
    inches: { type: Number, required: true },
    meters: { type: Number, required: true },
    orderNumber: { type: String, required: true },
    lane: { type: Number, required: true }, // 0 = ancho completo, 1 o 2
    full: { type: Boolean, default: false },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    // Etiqueta informativa (no afecta el carril) — ver getPalletOrientation
    // en data/sizeTable.js. Opcional: snapshots guardados antes de esta
    // regla no la tienen.
    orientation: { type: String, enum: ['horizontal', 'vertical'] },
  },
  { _id: false }
);

// Snapshot del acomodo visual completo del trailer al momento de guardar
// esta orden (incluye tarimas de otras órdenes activas en ese instante).
// Opcional: las órdenes creadas antes de esta feature no lo tienen
// (queda null/undefined) y siguen funcionando con normalidad — el PDF y el
// historial simplemente no ofrecen "Ver simulación" para esas.
const SimulationSnapshotSchema = new mongoose.Schema(
  {
    placed: { type: [SnapshotBoxSchema], default: [] },
    totalUsed: { type: Number, required: true },
    lane1: { type: Number, required: true },
    lane2: { type: Number, required: true },
    trailerLength: { type: Number, required: true },
    capacityLimit: { type: Number, required: true },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, trim: true },
    boxes: { type: [BoxSchema], default: [] },
    totalMeters: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'saved'], default: 'draft' },
    // archivedAt: si está set, la orden ya no está en el trailer "activo" pero
    // se conserva en el historial para consulta / re-impresión de PDF.
    archivedAt: { type: Date, default: null },
    // Acomodo congelado del trailer al momento de guardar (ver arriba).
    // Retrocompatible: default null, órdenes viejas no lo tienen.
    simulationSnapshot: { type: SimulationSnapshotSchema, default: null },
  },
  { timestamps: true }
);

OrderSchema.pre('save', function (next) {
  this.totalMeters = this.boxes.reduce((s, b) => s + b.meters, 0);
  next();
});

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);
