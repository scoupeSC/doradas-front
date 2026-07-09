"use client";

import { useEffect, useState } from "react";
import { getReporteRifa } from "./services/analytics.service";
import FiltersBar from "./components/FiltersBar";
import KPISection from "./components/KPISection";
import MethodsChart from "./components/MethodsChart";
import TicketsChart from "./components/TicketsChart";
import { useRouter } from "next/navigation";

/* =======================
   TIPOS
======================= */
type Rifa = {
  id: string;
  nombre: string;
};

type Vendedor = {
  id: string;
  nombre: string;
  rol: string;
};

type Scope = 'global' | 'mis-ventas';

export type PersonFilter = {
  tipo: 'TODOS' | 'ADMINS' | 'VENDEDOR';
  vendedorId: string | null;
};

type Props = {
  rifas: Rifa[];
  scope?: Scope;
  title?: string;
  esSuperAdmin?: boolean;
  vendedores?: Vendedor[];
};

export default function AnalyticsDashboard({ rifas, scope = 'global', title, esSuperAdmin = false, vendedores = [] }: Props) {
  const router = useRouter();

  const onBack = () => {
    router.push('/dashboard');
  };

  const headerTitle = title ?? (scope === 'mis-ventas' ? 'Mis Reportes' : 'Análisis de Rifas');

  const [selectedRifa, setSelectedRifa] = useState<string | null>(
    rifas.length ? rifas[0].id : null
  );

  // Usar hora local (Colombia UTC-5) en vez de UTC para evitar fecha adelantada
  const hoy = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [personFilter, setPersonFilter] = useState<PersonFilter>({ tipo: 'TODOS', vendedorId: null });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Construir extraFilters para el backend (solo aplica a SUPER_ADMIN + scope global)
  const extraFilters = (() => {
    if (!esSuperAdmin || scope !== 'global') return {};
    if (personFilter.tipo === 'ADMINS') return { filtroRol: 'ADMINS' };
    if (personFilter.tipo === 'VENDEDOR' && personFilter.vendedorId) {
      return { vendedorId: personFilter.vendedorId };
    }
    return {};
  })();

  useEffect(() => {
    if (!selectedRifa) return;

    let cancelado = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getReporteRifa(
          selectedRifa,
          fechaInicio,
          fechaFin,
          scope,
          extraFilters
        );
        if (!cancelado) setData(result);
      } catch (err: any) {
        if (!cancelado) {
          const msg =
            err?.code === 'ECONNABORTED'
              ? 'El servidor tardó demasiado en responder. Intenta de nuevo.'
              : err?.response?.data?.message || err?.message || 'No se pudo cargar el reporte. Intenta de nuevo.';
          setError(msg);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRifa, fechaInicio, fechaFin, scope, personFilter.tipo, personFilter.vendedorId]);

  if (!rifas.length) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-500">No hay rifas disponibles</div>
    </div>
  );

  return (
    <div className="app-shell">
      <header className="app-header sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
                title="Volver al Dashboard"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-light text-neutral-100">{headerTitle}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FiltersBar
          rifas={rifas}
          selectedRifa={selectedRifa}
          setSelectedRifa={setSelectedRifa}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          setFechaInicio={setFechaInicio}
          setFechaFin={setFechaFin}
          esSuperAdmin={esSuperAdmin && scope === 'global'}
          vendedores={vendedores as any}
          personFilter={personFilter as any}
          setPersonFilter={setPersonFilter as any}
        />

        {error && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="text-red-600 font-medium text-center max-w-md">{error}</div>
            <button
              onClick={() => {
                setFechaInicio((v) => v);
                setSelectedRifa((v) => v);
                setError(null);
                setLoading(true);
                getReporteRifa(selectedRifa!, fechaInicio, fechaFin, scope, extraFilters)
                  .then((r) => setData(r))
                  .catch((err: any) =>
                    setError(err?.response?.data?.message || err?.message || 'No se pudo cargar el reporte.')
                  )
                  .finally(() => setLoading(false));
              }}
              className="px-5 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : loading && !data ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-slate-400 animate-pulse font-light text-lg">Procesando métricas...</div>
          </div>
        ) : data ? (
          <div className={`space-y-6 ${loading ? 'opacity-50 pointer-events-none' : 'transition-opacity duration-300'}`}>
            <KPISection data={data} fechaInicio={fechaInicio} fechaFin={fechaFin} scope={scope} extraFilters={extraFilters} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MethodsChart methods={data.metodos_pago} serieDiaria={data.serie_diaria} fechaInicio={fechaInicio} fechaFin={fechaFin} />
              <TicketsChart resumen={data.resumen_boletas} boletasPeriodo={data.boletas_periodo} hayFiltro={!!(fechaInicio && fechaFin)} />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}