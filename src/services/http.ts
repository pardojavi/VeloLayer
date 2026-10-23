import { AppError } from '../domain/errors'

export interface FetchJsonOptions {
  timeoutMs?: number
  retries?: number
}

const inflight = new Map<string, Promise<unknown>>()

/**
 * GET JSON con tiempo de espera, reintentos prudentes y deduplicación de
 * solicitudes en vuelo (la misma URL solo se pide una vez a la vez).
 */
export async function fetchJsonDeduped(url: string, opts: FetchJsonOptions = {}): Promise<unknown> {
  const existing = inflight.get(url)
  if (existing) return existing
  const promise = fetchJson(url, opts).finally(() => {
    inflight.delete(url)
  })
  inflight.set(url, promise)
  return promise
}

export async function fetchJson(url: string, opts: FetchJsonOptions = {}): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? 12_000
  const retries = opts.retries ?? 2
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) {
          // Error de petición: no tiene sentido reintentar.
          let reason: unknown = null
          try {
            reason = await res.json()
          } catch {
            /* cuerpo no JSON */
          }
          const text =
            reason && typeof reason === 'object' && 'reason' in reason
              ? String((reason as { reason: unknown }).reason)
              : `HTTP ${res.status}`
          throw new AppError('forecast-unavailable', `El servicio meteorológico ha rechazado la petición: ${text}`)
        }
        lastError = new Error(`HTTP ${res.status}`)
      } else {
        return await res.json()
      }
    } catch (e) {
      clearTimeout(timer)
      if (e instanceof AppError) throw e
      lastError = e
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
    }
  }

  if (lastError instanceof TypeError) {
    throw new AppError('network', 'Sin conexión a internet. Reintenta en unos segundos.')
  }
  throw lastError instanceof Error
    ? new AppError('network', `Fallo de red: ${lastError.message}`)
    : new AppError('network', 'Fallo de red al consultar el servicio.')
}
