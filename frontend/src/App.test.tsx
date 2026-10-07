import { act, render, screen } from '@testing-library/react'
import App from './App'
import { markClientUpdateRequired, resetClientUpdateRequired } from './api/clientUpdate'

describe('App update-required gate (item78)', () => {
  afterEach(() => {
    resetClientUpdateRequired()
  })

  it('replaces the whole app with the reload screen on 426', async () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: /перезагрузить страницу/i })).not.toBeInTheDocument()

    act(() => markClientUpdateRequired())

    expect(await screen.findByRole('heading', { name: /обновите страницу/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /перезагрузить страницу/i })).toBeInTheDocument()
  })
})
