import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// ---------------------------------------------------------------------------
// Stubs para APIs de navegador que jsdom no implementa.
// (uPlot consulta matchMedia en el momento de importarse, así que debe
// existir antes de cargar cualquier módulo de la app.)
// ---------------------------------------------------------------------------

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

if (typeof window.ResizeObserver !== 'function') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverStub,
  })
}
