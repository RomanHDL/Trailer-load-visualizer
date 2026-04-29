import { dbConnect } from '../../../lib/mongodb';
import Order from '../../../models/Order';
import { SIZE_TABLE } from '../../../data/sizeTable';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    // Solo órdenes guardadas (no drafts)
    const orders = await Order.find({ status: 'saved' })
      .sort({ createdAt: 1 })
      .lean();
    return res.status(200).json(orders);
  }

  if (req.method === 'POST') {
    try {
      const { orderNumber, boxes } = req.body || {};
      if (!orderNumber || !Array.isArray(boxes) || boxes.length === 0) {
        return res
          .status(400)
          .json({ error: 'Falta # orden o no hay cajas en la orden' });
      }

      // Validar todas las cajas contra la tabla
      const validatedBoxes = boxes.map((b) => {
        const meters = SIZE_TABLE[b.inches];
        if (meters == null) {
          throw new Error(`Medida ${b.inches}" fuera de tabla`);
        }
        return { inches: Number(b.inches), meters };
      });

      const totalMeters = validatedBoxes.reduce((s, b) => s + b.meters, 0);

      const created = await Order.create({
        orderNumber: String(orderNumber).trim(),
        boxes: validatedBoxes,
        totalMeters,
        status: 'saved',
      });

      return res.status(201).json(created);
    } catch (err) {
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
