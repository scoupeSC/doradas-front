'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnalyticsDashboard from './AnalyticsDashboard';
import { rifaApi } from '@/lib/rifaApi';
import { vendedoresStatsApi, VendedorStats } from '@/lib/vendedoresStatsApi';

type Rifa = {
  id: string;
  nombre: string;
};

export default function Page() {
  const router = useRouter();
  const [rifas, setRifas] = useState<Rifa[]>([]);
  const [vendedores, setVendedores] = useState<VendedorStats[]>([]);
  const [esSuperAdmin, setEsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    let role = '';
    try {
      const user = JSON.parse(userData);
      role = (user?.rol || '').toUpperCase();
      if (role !== 'SUPER_ADMIN') {
        setAccesoDenegado(true);
        setLoading(false);
        return;
      }
      setEsSuperAdmin(true);
    } catch {
      router.push('/login');
      return;
    }

    const fetchAll = async () => {
      try {
        const [rifasRes, usuariosRes] = await Promise.all([
          rifaApi.getRifas(),
          role === 'SUPER_ADMIN'
            ? vendedoresStatsApi.list().catch((e) => {
                console.error('Error cargando usuarios para filtro', e);
                return { data: [] as VendedorStats[] };
              })
            : Promise.resolve({ data: [] as VendedorStats[] }),
        ]);
        setRifas(rifasRes.data || []);
        setVendedores(usuariosRes.data || []);
      } catch (error) {
        console.error("Error cargando proyectos", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
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

  return <AnalyticsDashboard rifas={rifas} esSuperAdmin={esSuperAdmin} vendedores={vendedores} />;
}