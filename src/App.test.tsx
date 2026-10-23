import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('App (humo)', () => {
  it('arranca con las preferencias de IndexedDB y navega a ajustes', async () => {
    render(<App />)

    // Las preferencias se cargan de forma asíncrona desde IndexedDB.
    expect(
      await screen.findByRole('heading', { name: '¿Qué ropa me pongo?' }, { timeout: 5000 }),
    ).toBeInTheDocument()

    // Navegación y atribución visibles en la vista de planificación.
    expect(
      screen.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open-Meteo' })).toBeInTheDocument()

    // Ir a Ajustes: existe la acción que restablece preferencias sin borrar tracks.
    fireEvent.click(screen.getByRole('button', { name: /Ajustes/ }))
    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.getByText('Restablecer preferencias')).toBeInTheDocument()

    // El flujo de confirmación avisa explícitamente de que los tracks NO se borran.
    fireEvent.click(screen.getByText('Restablecer preferencias'))
    expect(screen.getByText(/Los tracks guardados NO se borran/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancelar'))
    expect(screen.getByText('Restablecer preferencias')).toBeInTheDocument()
  })
})
