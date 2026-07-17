import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

/**
 * scope:
 *   'global'      → /api/reportes/rifa/...        (todas las ventas - SUPER_ADMIN / ADMIN)
 *   'mis-ventas'  → /api/reportes/mis-ventas/...  (solo ventas del usuario autenticado)
 */
const buildBase = (scope) =>
  scope === 'mis-ventas'
    ? `${API_BASE_URL}/api/reportes/mis-ventas/rifa`
    : `${API_BASE_URL}/api/reportes/rifa`;

export const getReporteRifa = async (
  rifaId,
  fechaInicio,
  fechaFin,
  scope = 'global',
  extraFilters = {}
) => {
  const params = {};

  if (fechaInicio && fechaFin) {
    params.fechaInicio = fechaInicio;
    params.fechaFin = fechaFin;
  }

  if (scope === 'global') {
    if (extraFilters.vendedorId) params.vendedorId = extraFilters.vendedorId;
    if (extraFilters.filtroRol) params.filtroRol = extraFilters.filtroRol;
  }

  const token = localStorage.getItem('token');

  const response = await axios.get(`${buildBase(scope)}/${rifaId}`, {
    params,
    timeout: 30000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return response.data;
};

export const getVentasGeneral = async (
  rifaId,
  fechaInicio,
  fechaFin,
  page = 1,
  limit = 50,
  filtersOrScope = {},
  maybeScope,
  extraFilters = {}
) => {
  let scope = 'global';
  if (typeof filtersOrScope === 'string') {
    scope = filtersOrScope;
  } else if (typeof maybeScope === 'string') {
    scope = maybeScope;
  }

  const params = { page, limit };

  if (fechaInicio && fechaFin) {
    params.fechaInicio = fechaInicio;
    params.fechaFin = fechaFin;
  }

  if (scope === 'global') {
    if (extraFilters.vendedorId) params.vendedorId = extraFilters.vendedorId;
    if (extraFilters.filtroRol) params.filtroRol = extraFilters.filtroRol;
  }

  const token = localStorage.getItem('token');

  const response = await axios.get(`${buildBase(scope)}/${rifaId}/ventas`, {
    params,
    timeout: 30000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return response.data;
};
