'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clienteApi } from '@/lib/clienteApi'
import { Cliente, ClienteListResponse, ClienteFiltroEstado, ClienteResumenFiltros } from '@/types/cliente'
import ClienteList from '@/components/ClienteList'
import ClienteForm from '@/components/ClienteForm'
import ClienteDetalle from '@/components/ClienteDetalle'

type ViewMode = 'list' | 'form' | 'detail'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [viewingClienteId, setViewingClienteId] = useState<string | null>(null)
  const [filtroActivo, setFiltroActivo] = useState<ClienteFiltroEstado>('todos')
  const [currentSearch, setCurrentSearch] = useState('')
  const [rifaActual, setRifaActual] = useState<{ id: string; nombre: string; estado: string } | null>(null)
  const [resumenFiltros, setResumenFiltros] = useState<ClienteResumenFiltros>({
    todos: 0,
    con_boletas: 0,
    pagadas: 0,
    reservadas: 0,
    abonadas: 0
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    fetchClientes()
  }, [router])

  const fetchClientes = async (
    page: number = 1,
    search: string = '',
    filtro: ClienteFiltroEstado = filtroActivo
  ) => {
    try {
      setLoading(true)
      const response: ClienteListResponse = await clienteApi.getClientes(page, pagination.limit, search, filtro)
      setClientes(response.data)
      setRifaActual(response.rifa_actual || null)
      if (response.resumen_filtros) {
        setResumenFiltros(response.resumen_filtros)
      }
      setPagination(response.pagination)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCliente = () => {
    setEditingCliente(null)
    setViewMode('form')
  }

  const handleEditCliente = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setViewMode('form')
  }

  const handleViewCliente = (cliente: Cliente) => {
    setViewingClienteId(cliente.id)
    setViewMode('detail')
  }

  const handleBackToList = () => {
    setViewMode('list')
    setViewingClienteId(null)
    setEditingCliente(null)
    // Refresh list to get updated data
    fetchClientes(pagination.page, currentSearch, filtroActivo)
  }

  const handleDeleteCliente = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente?')) {
      return
    }

    try {
      await clienteApi.deleteCliente(id)
      fetchClientes(pagination.page, currentSearch, filtroActivo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar cliente')
    }
  }

  const handleFormSubmit = async (clienteData: any) => {
    try {
      if (editingCliente) {
        await clienteApi.updateCliente(editingCliente.id, clienteData)
      } else {
        await clienteApi.createCliente(clienteData)
      }
      setViewMode('list')
      setEditingCliente(null)
      fetchClientes(pagination.page, currentSearch, filtroActivo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar cliente')
    }
  }

  const handleSearch = (search: string) => {
    setCurrentSearch(search)
    setFiltroActivo('todos')
    fetchClientes(1, search, 'todos')
  }

  const handlePageChange = (page: number) => {
    fetchClientes(page, currentSearch, filtroActivo)
  }

  const handleFilterEstado = (estado: ClienteFiltroEstado) => {
    setFiltroActivo(estado)
    fetchClientes(1, currentSearch, estado)
  }

  if (loading && clientes.length === 0 && viewMode === 'list') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Cargando clientes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-slate-600 hover:text-slate-900 transition-colors font-medium"
              >
                ← Dashboard
              </button>
              <h1 className="text-2xl font-bold text-black">
                {viewMode === 'detail' ? '👤 Detalle de Cliente' : viewMode === 'form' ? (editingCliente ? '✏️ Editar Cliente' : '➕ Nuevo Cliente') : '👥 Clientes'}
              </h1>
            </div>
            {viewMode === 'list' && (
              <button
                onClick={handleCreateCliente}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors font-semibold"
              >
                + Nuevo Cliente
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
          </div>
        )}

        {viewMode === 'form' && (
          <ClienteForm
            cliente={editingCliente}
            onSubmit={handleFormSubmit}
            onCancel={handleBackToList}
          />
        )}

        {viewMode === 'detail' && viewingClienteId && (
          <ClienteDetalle
            clienteId={viewingClienteId}
            onBack={handleBackToList}
          />
        )}

        {viewMode === 'list' && (
          <ClienteList
            clientes={clientes}
            rifaActual={rifaActual}
            resumenFiltros={resumenFiltros}
            pagination={pagination}
            onEdit={handleEditCliente}
            onDelete={handleDeleteCliente}
            onView={handleViewCliente}
            onSearch={handleSearch}
            onPageChange={handlePageChange}
            onFilterEstado={handleFilterEstado}
            filtroActivo={filtroActivo}
            loading={loading}
          />
        )}
      </main>
    </div>
  )
}
