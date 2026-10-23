export type AppErrorCode =
  | 'geolocation-unavailable'
  | 'geolocation-denied'
  | 'gpx-invalid'
  | 'network'
  | 'forecast-unavailable'
  | 'no-start-point'
  | 'storage'

/** Error de aplicación con código traducible y mensaje ya redactado en español. */
export class AppError extends Error {
  readonly code: AppErrorCode

  constructor(code: AppErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  if (e instanceof TypeError) {
    return new AppError('network', 'Sin conexión con el servidor meteorológico. Reintenta en unos segundos.')
  }
  const message = e instanceof Error ? e.message : 'Se ha producido un error inesperado.'
  return new AppError('network', message)
}
