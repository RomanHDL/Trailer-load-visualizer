import { dbConnect } from '../../../lib/mongodb';
import Order from '../../../models/Order';

// POST /api/orders/archive
// Marca todas las órdenes activas como archivadas (siguen en la base, pero
// salen del trailer "activo" para que se pueda iniciar otra carga).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  try {
    await dbConnect();
    const result = await Order.updateMany(
      {
        status: 'saved',
        $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }],
      },
      { $set: { archivedAt: new Date() } }
    );
    return res
      .status(200)
      .json({ archived: result.modifiedCount ?? result.nModified ?? 0 });
  } catch (err) {
    console.error('[POST /api/orders/archive] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
