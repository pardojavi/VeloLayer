import { useCallback, useEffect, useRef, useState } from 'react'
import { AppError } from '../domain/errors'
import { createDefaultSettings } from '../domain/settings'
import type { Settings } from '../domain/types'
import { clearSettings, loadSettings, saveSettingsDebounced, storageError } from '../storage/settingsRepository'

export interface UseSettings {
  settings: Settings
  ready: boolean
  update: (patch: Partial<Settings>) => void
  reset: () => Promise<void>
  storageWarning: string | null
}

/**
 * Carga las preferencias guardadas antes de presentar el formulario como
 * listo y las guarda automáticamente con escritura controlada.
 */
export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<Settings>(() => createDefaultSettings())
  const [ready, setReady] = useState(false)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    loadSettings()
      .then((loaded) => {
        if (!mounted.current) return
        setSettings(loaded)
        setReady(true)
      })
      .catch((e) => {
        if (!mounted.current) return
        setStorageWarning(storageError(e).message)
        setReady(true)
      })
    return () => {
      mounted.current = false
    }
  }, [])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettingsDebounced(next, () =>
        setStorageWarning(
          'No se han podido guardar las preferencias: se mantendrán solo durante esta sesión.',
        ),
      )
      return next
    })
  }, [])

  const reset = useCallback(async () => {
    try {
      await clearSettings()
    } catch (e) {
      // Aunque falle el borrado, se restablecen los valores por defecto en memoria.
      setStorageWarning(storageError(e).message)
    }
    setSettings(createDefaultSettings())
    setStorageWarning(null)
  }, [])

  return { settings, ready, update, reset, storageWarning }
}

export function errorMessage(e: unknown): string {
  if (e instanceof AppError) return e.message
  if (e instanceof Error) return e.message
  return 'Se ha producido un error inesperado.'
}
