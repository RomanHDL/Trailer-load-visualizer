import { dbConnect } from '../../../lib/mongodb';
import Order from '../../../models/Order';
import { SIZE_TABLE } from '../../../data/sizeTable';
import { isValidOrderNumber, normalizeOrderNumber } from '../../../lib/orderNumber';

// Valida el snapshot del acomodo (carril/posición ya resueltos) que manda el
// cliente al guardar. Nunca lanza: si algo no cuadra, se ignora (la orden se
// guarda igual, solo sin snapshot) — un snapshot roto no debe bloquear el
// guardado de la orden.
function sanitizeSnapshot(raw) {
  try {
    if (!raw || !Array.isArray(raw.placed) || raw.placed.length === 0) {
      return null;
    }
    const placed = raw.placed.map((b) => {
      const inchesNum = Number(b.inches);
      const meters = SIZE_TABLE[inchesNum];
      if (meters == null) throw new Error(`medida inválida en snapshot: ${b.inches}`);
      const lane = Number(b.lane);
      if (![0, 1, 2].includes(lane)) throw new Error(`carril inválido en snapshot: ${b.lane}`);
      const start = Number(b.start);
      const end = Number(b.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error('posición inválida en snapshot');
      }
      return {
        inches: inchesNum,
        meters,
        orderNumber: String(b.orderNumber ?? ''),
        lane,
        full: !!b.full,
        start,
        end,
      };
    });

    const totalUsed = Number(raw.totalUsed);
    const lane1 = Number(raw.lane1);
    const lane2 = Number(raw.lane2);
    const trailerLength = Number(raw.trailerLength);
    const capacityLimit = Number(raw.capacityLimit);
    if (
      ![totalUsed, lane1, lane2, trailerLength, capacityLimit].every(Number.isFinite)
    ) {
      throw new Error('métricas inválidas en snapshot');
    }

    return { placed, totalUsed, lane1, lane2, trailerLength, capacityLimit };
  } catch (e) {
    console.warn('[POST /api/orders] snapshot inválido, se ignora:', e.message);
    return null;
  }
}

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
      const { orderNumber, boxes, simulationSnapshot } = req.body || {};
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
      const validatedSnapshot = sanitizeSnapshot(simulationSnapshot);

      const created = await Order.create({
        orderNumber: trimmedOrderNumber,
        boxes: validatedBoxes,
        totalMeters,
        status: 'saved',
        simulationSnapshot: validatedSnapshot,
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
