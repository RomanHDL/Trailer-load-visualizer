import { dbConnect } from '../../../lib/mongodb';
import Order from '../../../models/Order';
import { SIZE_TABLE } from '../../../data/sizeTable';
import { isValidOrderNumber, normalizeOrderNumber } from '../../../lib/orderNumber';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    const filter = { status: 'saved' };
    // ?history=1 → trae todas (incluyendo archivadas). Por defecto: solo activas.
    if (!req.query.history) {
      filter.$or = [{ archivedAt: null }, { archivedAt: { $exists: false } }];
    }
    const orders = await Order.find(filter)
      .sort({ createdAt: req.query.history ? -1 : 1 })
      .lean();
    return res.status(200).json(orders);
  }

  if (req.method === 'POST') {
    try {
      const { orderNumber, boxes } = req.body || {};
      const trimmedOrderNumber = normalizeOrderNumber(orderNumber);

      if (!trimmedOrderNumber) {
        return res.status(400).json({ error: 'Número de orden vacío' });
      }
      if (!isValidOrderNumber(trimmedOrderNumber)) {
        return res.status(400).json({
          error:
            'Número de orden inválido: debe contener al menos una letra o dígito (no solo guiones o símbolos).',
        });
      }
      if (trimmedOrderNumber.length > 32) {
        return res
          .status(400)
          .json({ error: 'Número de orden muy largo (máx 32 caracteres)' });
      }
      if (!Array.isArray(boxes) || boxes.length === 0) {
        return res
          .status(400)
          .json({ error: 'La orden no tiene cajas' });
      }
      if (boxes.length > 500) {
        return res
          .status(400)
          .json({ error: 'Demasiadas cajas en una sola orden (>500)' });
      }

      // Validar todas las cajas contra la tabla. El meters se recomputa
      // desde SIZE_TABLE para garantizar consistencia (no se confía en input).
      const validatedBoxes = boxes.map((b, i) => {
        const inchesNum = Number(b.inches);
        const meters = SIZE_TABLE[inchesNum];
        if (meters == null) {
          throw new Error(
            `Caja ${i + 1}: medida "${b.inches}" no está en la tabla`
          );
        }
        return { inches: inchesNum, meters };
      });

      const totalMeters = validatedBoxes.reduce((s, b) => s + b.meters, 0);

      const created = await Order.create({
        orderNumber: trimmedOrderNumber,
        boxes: validatedBoxes,
        totalMeters,
        status: 'saved',
      });

      // Re-leer para confirmar persistencia y devolver el doc completo
      const persisted = await Order.findById(created._id).lean();
      if (!persisted) {
        throw new Error('La orden no quedó persistida en la base');
      }

      return res.status(201).json(persisted);
    } catch (err) {
      console.error('[POST /api/orders] error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    await Order.deleteMany({});
    return res.status(204).end();
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end();
}
