'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnalyticsDashboard from '../analytics/AnalyticsDashboard';
import { rifaApi } from '@/lib/rifaApi';

type Rifa = {
  id: string;
  nombre: string;
};

type Scope = 'global' | 'mis-ventas';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'];

export default function MisReportesPage() {
  const router = useRouter();
  const [rifas, setRifas] = useState<Rifa[]>([]);
  const [loading, setLoading] = useState(true);
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [role, setRole] = useState<string>('');
  const [scope, setScope] = useState<Scope>('mis-ventas');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    try {
      const user = JSON.parse(userData);
      const userRole = (user?.rol || '').toUpperCase();
      if (!ALLOWED_ROLES.includes(userRole)) {
        setAccesoDenegado(true);
        setLoading(false);
        return;
      }
      setRole(userRole);
      // ADMIN puede ver General; VENDEDOR y SUPER_ADMIN en esta ruta inician en propios
      setScope(userRole === 'ADMIN' ? 'global' : 'mis-ventas');
    } catch {
      router.push('/login');
      return;
    }

    const fetchRifas = async () => {
      try {
        // Usamos /api/rifas/operativas porque /api/rifas requiere SUPER_ADMIN
        // y este modulo es accesible para ADMIN y VENDEDOR.
        const res = await rifaApi.getRifasOperativas();
        setRifas(res.data);
      } catch (error) {
        console.error('Error cargando proyectos', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRifas();
  }, [router]);

  if (accesoDenegado) return (
    <div className="flex items-center justify-center p-8">
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 max-w-md text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
        <p className="text-slate-500 mb-6">Este módulo no está disponible para tu rol.</p>
        <button
          onClick={() => router.push('/mis-reportes')}
          className="w-full py-3 bg-sky-600 text-white rounded-xl font-semibold hover:bg-sky-700 transition-colors"
        >
          Ir a mis reportes
        </button>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-slate-500">Cargando reportes...</div>
    </div>
  );

  if (!rifas.length) return (
    <div className="flex items-center justify-center py-24 text-slate-500">
      No hay proyectos configuradas en el sistema.
    </div>
  );

  const esAdmin = role === 'ADMIN';
  const activeScope: Scope = esAdmin ? scope : 'mis-ventas';
  const title =
    activeScope === 'global' ? 'Reportes generales' : 'Mis Reportes';

  return (
    <div className="w-full min-w-0">
      {esAdmin && (
        <div className="px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
          <div className="inline-flex border-[1.5px] border-black bg-white shadow-[3px_3px_0_#101010] overflow-hidden">
            <button
              type="button"
              onClick={() => setScope('global')}
              className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wide min-h-[44px] transition-colors ${
                activeScope === 'global'
                  ? 'bg-[var(--primary)] text-black'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setScope('mis-ventas')}
              className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wide min-h-[44px] border-l-[1.5px] border-black transition-colors ${
                activeScope === 'mis-ventas'
                  ? 'bg-[var(--primary)] text-black'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Mis reportes
            </button>
          </div>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-xl">
            {activeScope === 'global'
              ? 'Vista de toda la rifa: estadísticas y ventas del proyecto.'
              : 'Solo tus ventas y recaudos registrados por ti.'}
          </p>
        </div>
      )}

      <AnalyticsDashboard
        key={activeScope}
        rifas={rifas}
        scope={activeScope}
        title={title}
        esSuperAdmin={false}
      />
    </div>
  );
}
