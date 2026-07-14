/** Estilos compartidos para HTML inline (descarga masiva en BoletaList). */
export const BOLETA_TICKET_STYLE =
  'display:flex;overflow:hidden;background:linear-gradient(180deg,#0c0c0c 0%,#121212 100%);border:1px solid #3a3220;box-shadow:inset 0 1px 0 rgba(212,175,55,0.12);'

export const BOLETA_LEFT_STYLE =
  'flex-shrink:0;padding:10px 8px;display:flex;flex-direction:column;justify-content:space-between;align-items:center;border-right:1px solid rgba(201,162,39,0.22);font-family:var(--font-geist-sans,system-ui,sans-serif);text-align:center;'

export const BOLETA_BODY_TEXT =
  'font-size:9px;color:#d4d4d4;line-height:1.45;text-align:center;width:100%;display:flex;flex-direction:column;align-items:center;'

export const BOLETA_BADGE_STYLES: Record<string, string> = {
  pagada:
    'width:100%;padding:5px 0;text-align:center;font-weight:700;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;background:rgba(16,185,129,0.14);color:#6ee7b7;border:1px solid rgba(52,211,153,0.35);border-radius:3px;',
  reservada:
    'width:100%;padding:5px 0;text-align:center;font-weight:700;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;background:rgba(59,130,246,0.14);color:#93c5fd;border:1px solid rgba(96,165,250,0.35);border-radius:3px;',
  bloqueada:
    'width:100%;padding:5px 0;text-align:center;font-weight:700;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;background:rgba(251,191,36,0.12);color:#fcd34d;border:1px solid rgba(251,191,36,0.3);border-radius:3px;',
  abonada:
    'width:100%;padding:5px 0;text-align:center;font-weight:700;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;background:rgba(201,162,39,0.14);color:#d4af37;border:1px solid rgba(212,175,55,0.35);border-radius:3px;',
  disponible:
    'width:100%;padding:5px 0;text-align:center;font-weight:700;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;background:rgba(163,163,163,0.1);color:#d4d4d4;border:1px solid rgba(163,163,163,0.25);border-radius:3px;',
  cancelada:
    'width:100%;padding:5px 0;text-align:center;font-weight:700;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;background:rgba(239,68,68,0.14);color:#fca5a5;border:1px solid rgba(248,113,113,0.35);border-radius:3px;',
}

export const BOLETA_NUMERO_STYLE =
  'text-align:center;font-size:17px;font-weight:700;color:#d4af37;letter-spacing:0.06em;font-variant-numeric:tabular-nums;line-height:1.2;display:flex;flex-direction:column;align-items:center;gap:2px;'

export const BOLETA_PRECIO_STYLE =
  'text-align:center;font-size:11px;font-weight:600;color:#c9a227;letter-spacing:0.04em;'
