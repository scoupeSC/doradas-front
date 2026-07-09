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
      if (!['SUPER_ADMIN', 'VENDEDOR'].includes(role)) {
        setAccesoDenegado(true);
        setLoading(false);
        return;
      }
      setEsSuperAdmin(role === 'SUPER_ADMIN');
    } catch {
      router.push('/login');
      return;
    }

    const fetchAll = async () => {
      try {
        const res = await rifaApi.getRifas();
        setRifas(res.data);
        if (role === 'SUPER_ADMIN') {
          try {
            const vRes = await vendedoresStatsApi.list();
            setVendedores(vRes.data || []);
          } catch (e) {
            console.error('Error cargando vendedores para filtro', e);
          }
        }
      } catch (error) {
        console.error("Error cargando rifas", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [router]);

  if (accesoDenegado) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-8 max-w-md text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
        <p className="text-slate-500 mb-6">Este módulo no está disponible para tu rol.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
        >
          Volver al Dashboard
        </button>
      </div>
    </div>
  );

  if (loading) return (
    <div className="app-shell flex items-center justify-center">
      <div className="text-neutral-500 font-light">Cargando módulo...</div>
    </div>
  );
  
  if (!rifas.length) return (
    <div className="app-shell flex items-center justify-center text-neutral-500">
      No hay rifas configuradas en el sistema.
    </div>
  );

  return <AnalyticsDashboard rifas={rifas} esSuperAdmin={esSuperAdmin} vendedores={vendedores} />;
}