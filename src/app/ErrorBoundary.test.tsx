import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Broken(): never {
  throw new Error('Kaputt beim Rendern')
}

it('shows a visible message instead of an empty page', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<ErrorBoundary><Broken /></ErrorBoundary>)
  expect(screen.getByRole('alert')).toHaveTextContent('Etwas ist schiefgelaufen.')
  expect(screen.getByText('Kaputt beim Rendern')).toBeInTheDocument()
  consoleError.mockRestore()
})
