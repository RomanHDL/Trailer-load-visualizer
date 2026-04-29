import { dbConnect } from '../../../lib/mongodb';
import Order from '../../../models/Order';
import { SIZE_TABLE } from '../../../data/sizeTable';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    const orders = await Order.find().sort({ createdAt: 1 }).lean();
    return res.status(200).json(orders);
  }

  if (req.method === 'POST') {
    try {
      const { orderNumber, inches } = req.body || {};
      if (!orderNumber || inches == null) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
      }
      const meters = SIZE_TABLE[inches];
      if (meters == null) {
        return res.status(400).json({ error: 'Medida fuera de la tabla' });
      }
      const created = await Order.create({
        orderNumber: String(orderNumber).trim(),
        inches: Number(inches),
        meters,
      });
      return res.status(201).json(created);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE all (reset)
  if (req.method === 'DELETE') {
    await Order.deleteMany({});
    return res.status(204).end();
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end();
}
