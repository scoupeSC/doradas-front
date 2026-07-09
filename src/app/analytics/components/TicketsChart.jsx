"use client";
import '@/lib/chartjs';
import React from 'react';
import { Doughnut } from 'react-chartjs-2';

export default function TicketsChart({ resumen, boletasPeriodo, hayFiltro }) {
  if (!resumen) return null;

  // Si hay filtro y datos de periodo, mostrar los del periodo
  const usePeriodo = hayFiltro && boletasPeriodo;

  const data = usePeriodo
    ? [
        boletasPeriodo.pagadas,
        boletasPeriodo.reservadas,
        boletasPeriodo.abonadas,
        boletasPeriodo.anuladas
      ]
    : [
        resumen.disponibles,
        resumen.reservadas,
        resumen.abonadas,
        resumen.pagadas,
        resumen.anuladas
      ];

  const labels = usePeriodo
    ? ['Pagadas', 'Reservadas', 'Abonadas', 'Anuladas']
    : ['Disponibles', 'Reservadas', 'Abonadas', 'Pagadas', 'Anuladas'];

  const colors = usePeriodo
    ? ['#34d399', '#fbbf24', '#818cf8', '#f87171']
    : ['#475569', '#fbbf24', '#818cf8', '#34d399', '#f87171'];

  const totalPeriodo = usePeriodo
    ? data.reduce((s, v) => s + Number(v), 0)
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-light text-slate-900">
          {usePeriodo ? 'Boletas del Periodo' : 'Distribución de Boletas'}
        </h2>
        {usePeriodo && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            {totalPeriodo} movidas
          </span>
        )}
      </div>
      {usePeriodo && totalPeriodo === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">Sin movimiento de boletas en este periodo</p>
        </div>
      ) : (
        <div className="relative h-64 w-full flex justify-center">
          <Doughnut
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: '75%',
              plugins: {
                legend: { 
                  position: 'right',
                  labels: { color: '#94a3b8', font: { family: 'inherit' }, usePointStyle: true }
                }
              }
            }}
            data={{
              labels,
              datasets: [{
                data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 4
              }]
            }}
          />
        </div>
      )}
    </div>
  );
}