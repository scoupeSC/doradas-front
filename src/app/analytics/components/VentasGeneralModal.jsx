"use client";
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getVentasGeneral } from '../services/analytics.service';
import { normalizarTelefono } from '@/utils/telefono';
import {
  formatPacha,
  formatPachasDesdeNumerosPlanos,
  mensajeComprobanteAbono,
  mensajeComprobanteVenta,
} from '@/utils/whatsappMensajes';

// ─── Helpers ───────────────────────────────────────────
const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`;

/** Etiquetas pacha por boleta: ["Pacha #0004 · #1234"] */
function labelsBoletasVenta(ventaOrAbono) {
  let boletas = ventaOrAbono?.boletas;
  // Algunos drivers devuelven json_agg como string
  if (typeof boletas === 'string') {
    try {
      boletas = JSON.parse(boletas);
    } catch {
      boletas = null;
    }
  }
  if (Array.isArray(boletas) && boletas.length > 0) {
    return boletas.map((b) => formatPacha(b.numeros, b.numero));
  }
  // Fallback: numeros_boletas puede venir plano con todos los números de la pacha
  const flat = ventaOrAbono?.numeros_boletas || [];
  if (flat.length > 1 && !ventaOrAbono?.cantidad_boletas) {
    return [formatPachasDesdeNumerosPlanos(flat.map(Number))];
  }
  // Si hay N boletas y 2N números, agrupar de a 2 (orden pacha)
  const cantidad = Number(ventaOrAbono?.cantidad_boletas) || 0;
  if (cantidad > 0 && flat.length === cantidad * 2) {
    return formatPachasDesdeNumerosPlanos(flat.map(Number), cantidad).split(', ');
  }
  if (flat.length > 0) {
    return [formatPachasDesdeNumerosPlanos(flat.map(Number))];
  }
  return [];
}
const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const estadoColors = {
  PAGADA: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  ABONADA: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  PENDIENTE: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  SIN_REVISAR: { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  CANCELADA: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
  EXPIRADA: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
};

const estadoLabel = {
  PAGADA: 'Pagada',
  ABONADA: 'Abonada',
  PENDIENTE: 'Pendiente',
  SIN_REVISAR: 'Sin Revisar',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirada',
};

const origenLabel = {
  ONLINE: 'Página Online',
  PUNTO_FISICO: 'Punto Físico',
};

const tipoTransLabel = {
  PAGO_TOTAL: 'Pago Total',
  ABONO: 'Abono Parcial',
  RESERVA: 'Reserva',
  SIN_PAGO: 'Sin Pago',
};

const tipoTransColors = {
  PAGO_TOTAL: 'text-emerald-600 bg-emerald-50',
  ABONO: 'text-purple-600 bg-purple-50',
  RESERVA: 'text-amber-600 bg-amber-50',
  SIN_PAGO: 'text-slate-500 bg-slate-50',
};

// ─── Detalle expandido de una venta ────────────────────
function VentaDetalleExpandido({ venta }) {
  // ─── Generar recibo imprimible ───
  const handleImprimirRecibo = () => {
    const tipoLabel = {
      PAGO_TOTAL: 'Pago Total',
      ABONO: 'Abono Parcial',
      RESERVA: 'Reserva',
      SIN_PAGO: 'Sin Pago',
    };
    const boletas = labelsBoletasVenta(venta).join(', ');
    const fecha = fmtDate(venta.created_at);
    const win = window.open('', '_blank', 'width=420,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Recibo - Venta</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; color: #111; padding: 24px; max-width: 380px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 16px; margin-bottom: 16px; }
        .header h1 { font-size: 20px; font-weight: 800; }
        .header p { font-size: 12px; color: #666; margin-top: 4px; }
        .section { margin-bottom: 14px; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 6px; }
        .row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
        .row .label { color: #555; }
        .row .value { font-weight: 600; }
        .total-row { border-top: 2px solid #111; padding-top: 8px; margin-top: 8px; font-size: 16px; font-weight: 800; }
        .boletas { font-size: 12px; color: #333; word-break: break-all; }
        .footer { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 2px dashed #ccc; font-size: 11px; color: #888; }
        .estado { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
        .estado-PAGADA { background: #dcfce7; color: #166534; }
        .estado-ABONADA { background: #ede9fe; color: #5b21b6; }
        .estado-PENDIENTE { background: #fef3c7; color: #92400e; }
        .estado-default { background: #f1f5f9; color: #475569; }
        @media print { body { padding: 8px; } }
      </style></head><body>
      <div class="header">
        <h1>🧾 Comprobante de Venta</h1>
        <p>${fecha}</p>
      </div>
      <div class="section">
        <div class="section-title">Información del Cliente</div>
        <div class="row"><span class="label">Nombre</span><span class="value">${venta.cliente_nombre || '—'}</span></div>
        <div class="row"><span class="label">Teléfono</span><span class="value">${venta.cliente_telefono || '—'}</span></div>
        ${venta.cliente_identificacion ? `<div class="row"><span class="label">Cédula</span><span class="value">${venta.cliente_identificacion}</span></div>` : ''}
        ${venta.cliente_email ? `<div class="row"><span class="label">Email</span><span class="value">${venta.cliente_email}</span></div>` : ''}
      </div>
      <div class="section">
        <div class="section-title">Detalle de la Venta</div>
        <div class="row"><span class="label">Tipo</span><span class="value">${tipoLabel[venta.tipo_transaccion] || venta.tipo_transaccion}</span></div>
        <div class="row"><span class="label">Origen</span><span class="value">${venta.origen_venta === 'ONLINE' ? '🌐 Online' : '🏪 Punto Físico'}</span></div>
        <div class="row"><span class="label">Cantidad Boletas</span><span class="value">${venta.cantidad_boletas}</span></div>
        <div class="row"><span class="label">Precio por Boleta</span><span class="value">${fmt(venta.precio_boleta)}</span></div>
        <div class="row"><span class="label">Monto Total</span><span class="value">${fmt(venta.monto_total)}</span></div>
        <div class="row"><span class="label">Total Pagado</span><span class="value" style="color:#16a34a">${fmt(venta.total_pagado_real)}</span></div>
        ${venta.saldo_pendiente > 0 ? `<div class="row"><span class="label">Saldo Pendiente</span><span class="value" style="color:#dc2626">${fmt(venta.saldo_pendiente)}</span></div>` : ''}
        <div class="row"><span class="label">Estado</span><span class="estado estado-${venta.estado_venta || 'default'}">${venta.estado_venta}</span></div>
        ${venta.vendedor_nombre ? `<div class="row"><span class="label">Vendedor</span><span class="value">${venta.vendedor_nombre}</span></div>` : ''}
      </div>
      <div class="section">
        <div class="section-title">Boletas</div>
        <div class="boletas">${boletas || 'N/A'}</div>
      </div>
      ${venta.notas_admin ? `<div class="section"><div class="section-title">Notas</div><p style="font-size:12px;color:#555">${venta.notas_admin}</p></div>` : ''}
      <div class="footer">
        <p>Gracias por su compra 🎉</p>
        <p style="margin-top:4px">Este documento es un comprobante válido</p>
      </div>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // ─── Generar link de WhatsApp con resumen ───
  const generarWhatsAppLink = () => {
    const telCompleto = normalizarTelefono(venta.cliente_telefono);
    if (!telCompleto || telCompleto.length < 7) return null;
    const pachas = labelsBoletasVenta(venta).join(', ');
    const tipoLabel = { PAGO_TOTAL: 'Pago Total', ABONO: 'Abono Parcial', RESERVA: 'Reserva', SIN_PAGO: 'Sin Pago' };

    const msg = mensajeComprobanteVenta({
      nombre: venta.cliente_nombre,
      tipoLabel: tipoLabel[venta.tipo_transaccion] || venta.tipo_transaccion,
      pachas,
      montoTotal: venta.monto_total,
      totalPagado: venta.total_pagado_real,
      saldoPendiente: venta.saldo_pendiente,
    });

    return `https://wa.me/${telCompleto}?text=${encodeURIComponent(msg)}`;
  };

  const whatsappLink = generarWhatsAppLink();

  return (
    <tr>
      <td colSpan={9} className="px-0 py-0">
        <div className="bg-slate-50 border-t border-b border-slate-200 px-6 py-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Info del comprador */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-base">👤</span> Información del Comprador
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Nombre</span>
                  <span className="text-sm font-medium text-slate-900">{venta.cliente_nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Teléfono</span>
                  <span className="text-sm font-medium text-slate-900">{venta.cliente_telefono || '—'}</span>
                </div>
                {venta.cliente_email && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Email</span>
                    <span className="text-sm font-medium text-slate-900 truncate ml-2">{venta.cliente_email}</span>
                  </div>
                )}
                {venta.cliente_identificacion && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Cédula</span>
                    <span className="text-sm font-medium text-slate-900">{venta.cliente_identificacion}</span>
                  </div>
                )}
                {venta.cliente_direccion && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Dirección</span>
                    <span className="text-sm font-medium text-slate-900 truncate ml-2">{venta.cliente_direccion}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info de la venta */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-base">🛒</span> Detalle de la Venta
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Monto Total</span>
                  <span className="text-sm font-bold text-slate-900">{fmt(venta.monto_total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Total Pagado</span>
                  <span className="text-sm font-bold text-emerald-600">{fmt(venta.total_pagado_real)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Saldo Pendiente</span>
                  <span className={`text-sm font-bold ${venta.saldo_pendiente > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {fmt(venta.saldo_pendiente)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Precio Boleta</span>
                  <span className="text-sm font-medium text-slate-900">{fmt(venta.precio_boleta)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Tipo</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tipoTransColors[venta.tipo_transaccion] || 'text-slate-500 bg-slate-50'}`}>
                    {tipoTransLabel[venta.tipo_transaccion] || venta.tipo_transaccion}
                  </span>
                </div>
                {venta.vendedor_nombre && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Vendedor</span>
                    <span className="text-sm font-medium text-slate-900">{venta.vendedor_nombre}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Boletas */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-base">🎟️</span> Boletas ({venta.cantidad_boletas})
              </h4>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {labelsBoletasVenta(venta).map((label, i) => (
                  <span 
                    key={i} 
                    className="inline-flex items-center justify-center px-2 py-1 text-xs font-mono font-bold bg-blue-50 text-blue-700 rounded-md border border-blue-200"
                  >
                    {label}
                  </span>
                ))}
              </div>
              {venta.notas_admin && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">Notas:</span>
                  <p className="text-xs text-slate-600 mt-0.5">{venta.notas_admin}</p>
                </div>
              )}
            </div>
          </div>

          {/* ─── Botones: Imprimir Recibo + WhatsApp ─── */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-200">
            <button
              onClick={handleImprimirRecibo}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg shadow transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              🧾 Imprimir Recibo
            </button>
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                📩 Enviar por WhatsApp
              </a>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Detalle expandido de un ABONO/RECAUDO ─────────────
function AbonoDetalleExpandido({ abono }) {
  const generarWhatsAppLink = () => {
    const telCompleto = normalizarTelefono(abono.cliente_telefono);
    if (!telCompleto || telCompleto.length < 7) return null;
    const pachas = labelsBoletasVenta(abono).join(', ');
    const msg = mensajeComprobanteAbono({
      nombre: abono.cliente_nombre,
      monto: abono.monto,
      pachas,
      montoTotal: abono.monto_total,
      abonoTotal: abono.abono_total,
      saldoPendiente: abono.saldo_pendiente,
    });
    return `https://wa.me/${telCompleto}?text=${encodeURIComponent(msg)}`;
  };
  const whatsappLink = generarWhatsAppLink();
  const ecVenta = estadoColors[abono.estado_venta] || estadoColors.EXPIRADA;

  return (
    <tr>
      <td colSpan={9} className="px-0 py-0">
        <div className="bg-teal-50/50 border-t border-b border-teal-200 px-6 py-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Info del cliente */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-base">👤</span> Cliente
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Nombre</span>
                  <span className="text-sm font-medium text-slate-900">{abono.cliente_nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Teléfono</span>
                  <span className="text-sm font-medium text-slate-900">{abono.cliente_telefono || '—'}</span>
                </div>
                {abono.cliente_identificacion && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Cédula</span>
                    <span className="text-sm font-medium text-slate-900">{abono.cliente_identificacion}</span>
                  </div>
                )}
                {abono.cliente_email && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Email</span>
                    <span className="text-sm font-medium text-slate-900 truncate ml-2">{abono.cliente_email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Detalle del abono */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-base">💰</span> Detalle del Abono
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Monto Abonado</span>
                  <span className="text-sm font-bold text-teal-600">{fmt(abono.monto)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Medio de Pago</span>
                  <span className="text-sm font-medium text-slate-900">{abono.medio_pago}</span>
                </div>
                {abono.referencia && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Referencia</span>
                    <span className="text-sm font-mono text-slate-900">{abono.referencia}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Fecha Abono</span>
                  <span className="text-sm font-medium text-teal-700">{fmtDate(abono.fecha_abono)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Fecha Venta Original</span>
                  <span className="text-sm font-medium text-slate-600">{fmtDate(abono.fecha_venta)}</span>
                </div>
                {abono.abono_notas && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Notas</span>
                    <span className="text-sm text-slate-700">{abono.abono_notas}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info de la venta */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-base">🛒</span> Venta Asociada
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Monto Total Venta</span>
                  <span className="text-sm font-bold text-slate-900">{fmt(abono.monto_total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Total Pagado</span>
                  <span className="text-sm font-bold text-emerald-600">{fmt(abono.abono_total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Saldo Pendiente</span>
                  <span className={`text-sm font-bold ${abono.saldo_pendiente > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {fmt(abono.saldo_pendiente)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Estado Venta</span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${ecVenta.bg} ${ecVenta.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ecVenta.dot}`} />
                    {estadoLabel[abono.estado_venta] || abono.estado_venta}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-400">Boletas ({abono.cantidad_boletas}):</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {labelsBoletasVenta(abono).map((label, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botón WhatsApp */}
          {whatsappLink && (
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-teal-200">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                📩 Enviar comprobante por WhatsApp
              </a>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Componente Principal ──────────────────────────────
export default function VentasGeneralModal({ 
  isOpen, 
  onClose, 
  rifaId, 
  fechaInicio, 
  fechaFin,
  rifaNombre,
  scope = 'global',
  extraFilters = {}
}) {
  const [ventas, setVentas] = useState([]);
  const [abonosPeriodo, setAbonosPeriodo] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [paginacion, setPaginacion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [tabActiva, setTabActiva] = useState('ventas'); // 'ventas' | 'recaudos'

  // Filtros locales
  const [filtroOrigen, setFiltroOrigen] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!isOpen || !rifaId) return;
    fetchVentas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, rifaId, fechaInicio, fechaFin, page, scope, extraFilters.vendedorId, extraFilters.filtroRol]);

  const fetchVentas = async () => {
    setLoading(true);
    try {
      const data = await getVentasGeneral(rifaId, fechaInicio, fechaFin, page, 100, scope, undefined, extraFilters);
      setVentas(data.ventas || []);
      setAbonosPeriodo(data.abonos_periodo || []);
      setResumen(data.resumen || null);
      setPaginacion(data.paginacion || null);
    } catch (error) {
      console.error('Error cargando ventas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar localmente
  const ventasFiltradas = useMemo(() => {
    return ventas.filter(v => {
      if (filtroOrigen !== 'TODOS' && v.origen_venta !== filtroOrigen) return false;
      if (filtroEstado !== 'TODOS' && v.estado_venta !== filtroEstado) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const matchNombre = v.cliente_nombre?.toLowerCase().includes(q);
        const matchTel = v.cliente_telefono?.includes(q);
        const matchCedula = v.cliente_identificacion?.includes(q);
        const matchBoleta = v.numeros_boletas?.some(n => String(n).includes(q));
        if (!matchNombre && !matchTel && !matchCedula && !matchBoleta) return false;
      }
      return true;
    });
  }, [ventas, filtroOrigen, filtroEstado, busqueda]);

  // Filtrar abonos localmente por búsqueda
  const abonosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return abonosPeriodo;
    const q = busqueda.toLowerCase();
    return abonosPeriodo.filter(a => {
      const matchNombre = a.cliente_nombre?.toLowerCase().includes(q);
      const matchTel = a.cliente_telefono?.includes(q);
      const matchCedula = a.cliente_identificacion?.includes(q);
      const matchBoleta = a.numeros_boletas?.some(n => String(n).includes(q));
      return matchNombre || matchTel || matchCedula || matchBoleta;
    });
  }, [abonosPeriodo, busqueda]);

  // Periodo label
  const periodoLabel = useMemo(() => {
    if (!fechaInicio && !fechaFin) return 'Todo el historial';
    if (fechaInicio === fechaFin) return `${fechaInicio}`;
    return `${fechaInicio} → ${fechaFin}`;
  }, [fechaInicio, fechaFin]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-7xl mx-4 my-8 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
              <span className="text-2xl">🛒</span>
              Ventas Realizadas
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {rifaNombre} — {periodoLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Resumen Cards */}
        {resumen && (
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                <p className="text-xs text-slate-400 font-medium">Total Ventas</p>
                <p className="text-xl font-bold text-slate-900">{resumen.total_ventas}</p>
              </div>
              <div className="bg-white rounded-xl border border-emerald-200 p-3 text-center">
                <p className="text-xs text-emerald-500 font-medium">Pagadas</p>
                <p className="text-xl font-bold text-emerald-600">{resumen.ventas_pagadas}</p>
              </div>
              <div className="bg-white rounded-xl border border-purple-200 p-3 text-center">
                <p className="text-xs text-purple-500 font-medium">Abonadas</p>
                <p className="text-xl font-bold text-purple-600">{resumen.ventas_abonadas}</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-3 text-center">
                <p className="text-xs text-amber-500 font-medium">Pendientes</p>
                <p className="text-xl font-bold text-amber-600">{resumen.ventas_pendientes}</p>
              </div>
              <div className="bg-white rounded-xl border border-blue-200 p-3 text-center">
                <p className="text-xs text-blue-500 font-medium">🌐 Online</p>
                <p className="text-xl font-bold text-blue-600">{resumen.ventas_online}</p>
              </div>
              <div className="bg-white rounded-xl border border-orange-200 p-3 text-center">
                <p className="text-xs text-orange-500 font-medium">🏪 P. Físico</p>
                <p className="text-xl font-bold text-orange-600">{resumen.ventas_punto_fisico}</p>
              </div>
            </div>

            {/* Montos totales */}
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                <p className="text-xs text-slate-400 font-medium">Monto Total</p>
                <p className="text-lg font-bold text-slate-900">{fmt(resumen.monto_total)}</p>
              </div>
              <div className="bg-white rounded-xl border border-emerald-200 p-3 text-center">
                <p className="text-xs text-emerald-500 font-medium">Total Abonado</p>
                <p className="text-lg font-bold text-emerald-600">{fmt(resumen.total_abonado)}</p>
              </div>
              <div className="bg-white rounded-xl border border-rose-200 p-3 text-center">
                <p className="text-xs text-rose-500 font-medium">Saldo Pendiente</p>
                <p className="text-lg font-bold text-rose-600">{fmt(resumen.saldo_pendiente_total)}</p>
              </div>
            </div>

            {/* Recaudo del Día - Dinero real que entró */}
            <div className="mt-3">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-4 text-center shadow-sm">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-xl">💰</span>
                  <p className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Recaudo del Período</p>
                  {resumen.cantidad_abonos_dia > 0 && (
                    <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {resumen.cantidad_abonos_dia} abono{resumen.cantidad_abonos_dia !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-extrabold text-white">{fmt(resumen.recaudo_dia || 0)}</p>
                <p className="text-[10px] text-emerald-200 mt-1">Dinero real recibido (incluye abonos a ventas anteriores)</p>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono, cédula o # boleta..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-slate-50"
            />
          </div>

          {/* Filtro Origen */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            {['TODOS', 'ONLINE', 'PUNTO_FISICO'].map(opt => (
              <button
                key={opt}
                onClick={() => setFiltroOrigen(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filtroOrigen === opt 
                    ? 'bg-white shadow-sm text-slate-900' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt === 'TODOS' ? 'Todos' : opt === 'ONLINE' ? '🌐 Online' : '🏪 Físico'}
              </button>
            ))}
          </div>

          {/* Filtro Estado */}
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="PAGADA">✅ Pagada</option>
            <option value="ABONADA">💳 Abonada</option>
            <option value="PENDIENTE">⏳ Pendiente</option>
            <option value="SIN_REVISAR">🔍 Sin Revisar</option>
            <option value="CANCELADA">❌ Cancelada</option>
            <option value="EXPIRADA">⏰ Expirada</option>
          </select>

          <span className="text-xs text-slate-400 ml-auto">
            {tabActiva === 'ventas'
              ? `${ventasFiltradas.length} de ${ventas.length} ventas`
              : `${abonosFiltrados.length} de ${abonosPeriodo.length} recaudos`
            }
          </span>
        </div>

        {/* Tabs: Ventas | Recaudos */}
        <div className="px-6 bg-white border-b border-slate-200 flex gap-0">
          <button
            onClick={() => { setTabActiva('ventas'); setExpandedId(null); }}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tabActiva === 'ventas'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            🛒 Ventas ({ventas.length})
          </button>
          <button
            onClick={() => { setTabActiva('recaudos'); setExpandedId(null); }}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tabActiva === 'recaudos'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            💰 Recaudos del Período ({abonosPeriodo.length})
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-slate-500">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Cargando...
              </div>
            </div>

          ) : tabActiva === 'recaudos' ? (
            /* ─── TABLA DE RECAUDOS/ABONOS ─── */
            abonosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <span className="text-4xl mb-3">📭</span>
                <p className="font-medium">No hay recaudos en este período</p>
                <p className="text-sm mt-1">No se registraron abonos confirmados en el rango seleccionado</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-teal-50 border-b border-teal-200 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-teal-700 uppercase tracking-wider">Fecha Abono</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-teal-700 uppercase tracking-wider">Cliente</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-teal-700 uppercase tracking-wider">Origen</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-teal-700 uppercase tracking-wider">Boletas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-teal-700 uppercase tracking-wider">Monto Abono</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-teal-700 uppercase tracking-wider">Saldo Pend.</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-teal-700 uppercase tracking-wider">Estado Venta</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-teal-700 uppercase tracking-wider">Tipo</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-teal-700 uppercase tracking-wider">Método Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-50">
                  {abonosFiltrados.map((abono) => {
                    const ecVenta = estadoColors[abono.estado_venta] || estadoColors.EXPIRADA;
                    const isExpanded = expandedId === abono.abono_id;

                    return (
                      <React.Fragment key={abono.abono_id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : abono.abono_id)}
                          className={`cursor-pointer transition-colors ${
                            isExpanded ? 'bg-teal-50/50' : 'hover:bg-teal-50/30'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <span className="text-slate-900 font-medium text-xs">{fmtDate(abono.fecha_abono)}</span>
                              <p className="text-[10px] text-slate-400 mt-0.5">Venta: {fmtDate(abono.fecha_venta)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-slate-900 font-medium">{abono.cliente_nombre}</p>
                              <p className="text-xs text-slate-400">{abono.cliente_telefono}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                              abono.es_venta_online
                                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                : 'bg-orange-50 text-orange-600 border border-orange-200'
                            }`}>
                              {abono.es_venta_online ? '🌐 Online' : '🏪 Punto Físico'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-sm font-bold text-blue-600">{abono.cantidad_boletas}</span>
                              <span className="text-xs text-slate-400">bol.</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-teal-700">{fmt(abono.monto)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold ${abono.saldo_pendiente > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                              {fmt(abono.saldo_pendiente)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${ecVenta.bg} ${ecVenta.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${ecVenta.dot}`} />
                              {estadoLabel[abono.estado_venta] || abono.estado_venta}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-teal-50 text-teal-700">
                              Recaudo
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-medium text-slate-700">
                              {abono.medio_pago}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && <AbonoDetalleExpandido abono={abono} />}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )

          ) : ventasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="text-4xl mb-3">📭</span>
              <p className="font-medium">No se encontraron ventas</p>
              <p className="text-sm mt-1">Ajusta los filtros o el periodo de búsqueda</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Comprador</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Origen</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Boletas</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pagado</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Método Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ventasFiltradas.map((venta) => {
                  const ec = estadoColors[venta.estado_venta] || estadoColors.EXPIRADA;
                  const isExpanded = expandedId === venta.id;

                  return (
                    <React.Fragment key={venta.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : venta.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="text-slate-900 font-medium text-xs">{fmtDate(venta.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-slate-900 font-medium">{venta.cliente_nombre}</p>
                            <p className="text-xs text-slate-400">{venta.cliente_telefono}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                            venta.origen_venta === 'ONLINE' 
                              ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                              : 'bg-orange-50 text-orange-600 border border-orange-200'
                          }`}>
                            {venta.origen_venta === 'ONLINE' ? '🌐' : '🏪'} {origenLabel[venta.origen_venta]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-sm font-bold text-blue-600">{venta.cantidad_boletas}</span>
                            <span className="text-xs text-slate-400">bol.</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-slate-900">{fmt(venta.monto_total)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-emerald-600">{fmt(venta.total_pagado_real)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${ec.bg} ${ec.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ec.dot}`} />
                            {estadoLabel[venta.estado_venta] || venta.estado_venta}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${tipoTransColors[venta.tipo_transaccion] || 'text-slate-500 bg-slate-50'}`}>
                            {tipoTransLabel[venta.tipo_transaccion] || venta.tipo_transaccion}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-medium text-slate-700">
                            {venta.metodo_pago || (venta.tipo_transaccion === 'RESERVA' ? '—' : 'Sin registro')}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && <VentaDetalleExpandido venta={venta} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {paginacion && paginacion.total_pages > 1 && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Página {paginacion.page} de {paginacion.total_pages} ({paginacion.total} ventas total)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(paginacion.total_pages, p + 1))}
                disabled={page >= paginacion.total_pages}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
