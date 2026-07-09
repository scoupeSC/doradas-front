'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { rifaApi } from '@/lib/rifaApi'
import { boletaApi } from '@/lib/boletaApi'
import { uploadApi } from '@/lib/uploadApi'
import { getStorageImageUrl } from '@/lib/storageImageUrl'
import { Rifa } from '@/types/rifa'
import { BoletaGenerateRequest } from '@/types/boleta'
import BoletaPreview from '@/components/BoletaPreview'

export default function CrearBoletasPage() {
  const [rifas, setRifas] = useState<Rifa[]>([])
  const [selectedRifa, setSelectedRifa] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [cachedImageFile, setCachedImageFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Form fields for the new parameters
  const [formData, setFormData] = useState<BoletaGenerateRequest>({
    qr_base_url: 'https://elgrancamion.com/verificar/',
    imagen_url: '',
    diseño_template: 'modern' // Keep default but remove from UI
  })

  const hasImage = Boolean(cachedImageFile || formData.imagen_url)
  
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/login')
      return
    }

    try {
      const user = JSON.parse(userData)
      setUserRole(user.rol)
      
      if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN' && user.rol !== 'VENDEDOR') {
        router.push('/dashboard')
        return
      }
      
      fetchRifas()
    } catch (error) {
      router.push('/login')
    }
  }, [router])

  const fetchRifas = async () => {
    try {
      const response = await rifaApi.getRifasOperativas('ACTIVA')
      setRifas(response.data.filter(rifa => rifa.estado === 'ACTIVA'))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar rifas')
    } finally {
      setLoading(false)
    }
  }

  const handleCrearBoletas = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedRifa) {
      setError('Por favor selecciona una rifa para generar boletas')
      return
    }

    if (!formData.qr_base_url || !hasImage || !formData.diseño_template) {
      setError('Por favor completa todos los campos de configuración')
      return
    }

    try {
      setCreating(true)
      setError(null)
      setSuccess(null)

      let imagenUrl = formData.imagen_url

      // Si hay imagen en caché (aún no subida), subirla ahora solo antes de generar
      if (cachedImageFile) {
        setUploadingImage(true)
        const uploadResponse = await uploadApi.uploadImagen(cachedImageFile)
        imagenUrl = uploadResponse.url
        setUploadingImage(false)
      }

      const response = await boletaApi.generarBoletas(selectedRifa, {
        ...formData,
        imagen_url: imagenUrl,
      })
      
      setSuccess(`Se han generado ${response.data.boletas_generadas} boletas exitosamente con la configuración proporcionada`)
      
      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push('/boletas/ver')
      }, 2000)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar boletas')
    } finally {
      setCreating(false)
      setUploadingImage(false)
    }
  }

  const handleInputChange = (field: keyof BoletaGenerateRequest, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Tipo de archivo no válido. Solo se permiten JPG, PNG o WEBP')
      return
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo es demasiado grande. Máximo 5MB')
      return
    }

    setError(null)

    // Revocar URL anterior si existía (para evitar fugas de memoria)
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }

    // Cachear en frontend: guardar el archivo y crear URL local para vista previa
    // La imagen solo se subirá a storage cuando se generen las boletas correctamente
    setCachedImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }
    setCachedImageFile(null)
    setImagePreview(null)
    setFormData(prev => ({
      ...prev,
      imagen_url: ''
    }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePreview = () => {
    if (!selectedRifa) {
      setError('Por favor selecciona una rifa para previsualizar')
      return
    }
    if (!hasImage) {
      setError('Por favor carga una imagen de plantilla antes de previsualizar')
      return
    }
    setShowPreview(true)
  }

  if (userRole && userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-lg max-w-md">
          <h2 className="text-lg font-medium mb-2">Acceso Restringido</h2>
          <p>Este módulo solo está disponible para usuarios con rol SUPER_ADMIN o ADMIN</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/boletas/ver')}
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Boletas
              </button>
              <h1 className="text-2xl font-light text-neutral-100">Crear Boletas</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-slate-900 mb-4">Información de la Rifa</h2>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              {success}
            </div>
          )}

          <form onSubmit={handleCrearBoletas} className="space-y-6">
            <div>
              <label htmlFor="rifa" className="block text-sm font-bold text-black mb-2">
                Seleccionar Rifa Activa
              </label>
              <select
                id="rifa"
                value={selectedRifa}
                onChange={(e) => setSelectedRifa(e.target.value)}
                className="w-full px-4 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-black bg-white"
                disabled={creating}
              >
                <option value="">Selecciona una rifa activa...</option>
                {rifas.map((rifa) => (
                  <option key={rifa.id} value={rifa.id}>
                    {rifa.nombre} - {rifa.premio || rifa.premio_principal} (Estado: {rifa.estado})
                  </option>
                ))}
              </select>
              {rifas.length === 0 && (
                <p className="mt-2 text-sm text-slate-500">
                  No hay rifas activas disponibles para generar boletas
                </p>
              )}
            </div>

            {/* Configuración de Boletas */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-medium text-slate-900 mb-4">Configuración de Boletas</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="qr_base_url" className="block text-sm font-bold text-black mb-2">
                    URL de Verificación (QR) *
                  </label>
                  <input
                    type="url"
                    id="qr_base_url"
                    value={formData.qr_base_url}
                    onChange={(e) => handleInputChange('qr_base_url', e.target.value)}
                    placeholder="https://elgrancamion.com/verificar/"
                    className="w-full px-4 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-black bg-white"
                    disabled={creating}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    URL donde el cliente verá el estado de su boleta al escanear el QR. Cada boleta genera un código único.
                  </p>
                </div>

                <div>
                  <label htmlFor="imagen_file" className="block text-sm font-bold text-black mb-2">
                    Imagen de Plantilla *
                  </label>
                  
                  {!hasImage ? (
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="imagen_file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleImageUpload}
                        className="w-full px-4 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-black bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        disabled={creating || uploadingImage}
                      />
                      <p className="text-xs text-slate-500">
                        Formatos permitidos: JPG, PNG, WEBP. Tamaño máximo: 5MB
                      </p>
                      <p className="text-xs text-slate-500">
                        La imagen se guardará en el servidor solo al generar las boletas correctamente
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative border border-slate-300 rounded-lg p-4 bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">Imagen cargada:</span>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                            disabled={creating || uploadingImage}
                          >
                            Eliminar
                          </button>
                        </div>
                        {(imagePreview || formData.imagen_url) && (
                          <div className="mt-2">
                            <img
                              src={imagePreview || (typeof formData.imagen_url === 'string' ? (getStorageImageUrl(formData.imagen_url) ?? formData.imagen_url) : formData.imagen_url)}
                              alt="Preview"
                              className="max-w-full max-h-48 rounded border border-slate-200"
                            />
                          </div>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          {cachedImageFile
                            ? `Imagen en caché (${cachedImageFile.name}). Se guardará al generar boletas.`
                            : formData.imagen_url}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        disabled={creating || uploadingImage}
                      >
                        Cambiar imagen
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={creating || uploadingImage}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Información de Generación</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Rifa seleccionada:</strong> {rifas.find(r => r.id === selectedRifa)?.nombre}</p>
                <p><strong>Premio:</strong> {rifas.find(r => r.id === selectedRifa)?.premio || rifas.find(r => r.id === selectedRifa)?.premio_principal}</p>
                <p><strong>Total de boletas:</strong> {rifas.find(r => r.id === selectedRifa)?.total_boletas || 'N/A'}</p>
                <p><strong>Estado:</strong> {rifas.find(r => r.id === selectedRifa)?.estado}</p>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>Nota:</strong> El sistema generará automáticamente todas las boletas para esta rifa según la configuración.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handlePreview}
                className="px-6 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                disabled={creating || uploadingImage || !selectedRifa || !hasImage}
              >
                Vista Previa
              </button>
              
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => router.push('/boletas')}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={creating || uploadingImage || !selectedRifa || !formData.qr_base_url || !hasImage || !formData.diseño_template}
                >
                  {creating ? 'Generando...' : 'Generar Boletas'}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="bg-slate-50 rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-3">Información Importante</h3>
          <div className="space-y-2 text-sm text-slate-600">
            <p>• Las boletas se generarán automáticamente según la configuración proporcionada</p>
            <p>• Todas las boletas nuevas tendrán estado "DISPONIBLE"</p>
            <p>• Cada boleta tendrá un código QR único que apuntará a la URL configurada</p>
            <p>• Cada boleta tendrá un código de barras único (formato: BOLETA-[rifa_id]-0001)</p>
            <p>• La imagen de plantilla se usará como fondo para todas las boletas</p>
            <p>• Solo puedes generar boletas una vez por rifa</p>
            <p>• La rifa debe estar en estado "ACTIVA" para generar boletas</p>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreview && selectedRifa && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
                <h2 className="text-xl font-medium text-slate-900">Vista Previa de Boleta</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-4">
                <BoletaPreview
                  qrBaseUrl={formData.qr_base_url}
                  imagenUrl={imagePreview || (formData.imagen_url ? (getStorageImageUrl(formData.imagen_url) ?? formData.imagen_url) : '')}
                  diseñoTemplate={formData.diseño_template}
                  rifaId={selectedRifa}
                  boletaNumero={1}
                  barcode={`BOLETA-${selectedRifa}-0001`}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
