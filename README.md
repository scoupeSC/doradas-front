# front-roblox

Frontend del sistema de rifas (Next.js). Desplegable en Vercel.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001).

Crea `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_PUBLIC_API_KEY=tu-api-key-publica
```

## Deploy en Vercel

Variables de entorno en el dashboard:

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL del backend, ej. `https://tu-api.com/api` |
| `NEXT_PUBLIC_WS_URL` | WebSocket del backend, ej. `wss://tu-api.com` |
| `NEXT_PUBLIC_PUBLIC_API_KEY` | API key pública del backend |

Build: `npm run build`
