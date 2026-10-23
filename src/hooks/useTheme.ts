import { useEffect, useState } from 'react'
import type { ThemeMode } from '../domain/types'

/**
 * Lee el tema activo (claro/noche). App.tsx lo escribe en el atributo
 * `data-theme` del documento; el hook observa ese atributo para reaccionar
 * a los cambios (por ejemplo, para repintar gráficas en canvas).
 */
export function useTheme(): ThemeMode {
  const read = (): ThemeMode =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  const [theme, setTheme] = useState<ThemeMode>(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()))
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => obs.disconnect()
  }, [])
  return theme
}
