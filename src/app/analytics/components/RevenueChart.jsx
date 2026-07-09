"use client";
import '@/lib/chartjs';
import React from 'react';
import { Line } from 'react-chartjs-2';

export default function RevenueChart({ serie }) {
  if (!serie?.length) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <h2 className="text-xl font-light text-slate-900 mb-6">Evolución del Recaudo</h2>
      <div className="relative h-80 w-full">
        <Line
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: '#94a3b8' },
              },
              y: {
                border: { dash: [4, 4], color: '#2d3a52' },
                grid: { color: '#212d45' },
                ticks: { color: '#94a3b8' },
              }
            }
          }}
          data={{
            labels: serie.map(s => new Date(s.fecha).toLocaleDateString()),
            datasets: [{
              label: 'Recaudo',
              data: serie.map(s => Number(s.total)),
              borderColor: '#60a5fa',
              backgroundColor: 'rgba(96,165,250,0.12)',
              borderWidth: 2,
              pointBackgroundColor: '#111827',
              pointBorderColor: '#60a5fa',
              pointBorderWidth: 2,
              fill: true,
              tension: 0.4
            }]
          }}
        />
      </div>
    </div>
  );
}