# Trailer Load Visualizer

Simulador de llenado de tráiler (vista superior) con medidas estándar de cajas/TVs.
Stack: **Next.js + MongoDB Atlas**, deploy en **Vercel**.

## Estructura

```
.
├── components/
│   ├── OrderForm.jsx       # Form con orden + selector de medida
│   ├── OrderList.jsx       # Lista de órdenes agregadas
│   └── TrailerView.jsx     # Vista superior del trailer (blueprint)
├── data/
│   └── sizeTable.js        # Tabla hardcodeada pulgadas → metros
├── lib/
│   └── mongodb.js          # Conexión cacheada a Mongo Atlas
├── models/
│   └── Order.js            # Schema mongoose de Order
├── pages/
│   ├── _app.js
│   ├── index.js            # UI principal
│   └── api/orders/
│       ├── index.js        # GET / POST / DELETE all
│       └── [id].js         # DELETE individual
├── styles/globals.css
├── .env.local.example
├── next.config.js
└── package.json
```

## Tabla de medidas (hardcodeada)

| Pulgadas | Metros |
|----------|--------|
| 50"  | 1.0  |
| 55"  | 1.45 |
| 58"  | 1.45 |
| 65"  | 1.58 |
| 75"  | 1.88 |
| 86"  | 2.13 |
| 100" | 2.5  |

Largo total del trailer por defecto: **15.9 m** (configurable con `NEXT_PUBLIC_TRAILER_LENGTH`).

## Setup local

```bash
npm install
cp .env.local.example .env.local
# editar .env.local con tu MONGODB_URI de Atlas
npm run dev
```
Abrir http://localhost:3000

### MongoDB Atlas

1. Crear cluster gratis en https://cloud.mongodb.com
2. Database Access → crear usuario con password
3. Network Access → permitir `0.0.0.0/0` (o las IPs de Vercel)
4. Cluster → **Connect** → **Drivers** → copiar URI
5. Pegar en `.env.local`:
   ```
   MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/trailer?retryWrites=true&w=majority
   ```

## Deploy a Vercel

1. Push del repo a GitHub
2. https://vercel.com → **New Project** → importar `Trailer-load-visualizer`
3. **Environment Variables**:
   - `MONGODB_URI` = la misma cadena de Atlas
   - `NEXT_PUBLIC_TRAILER_LENGTH` = `15.9` (opcional)
4. Deploy

## Lógica clave

- Las cajas se acomodan **en línea**, una tras otra (sin rotación).
- **Verde**: la carga total cabe dentro del largo del trailer.
- **Rojo**: alguna caja sobresale del límite. Se muestra cuántos metros se exceden.
- Una marca naranja indica el límite máximo del trailer.
- Cada metro tiene una guía visual.
