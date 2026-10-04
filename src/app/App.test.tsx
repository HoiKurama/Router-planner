import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import * as services from './services'
import { STORAGE_KEY } from './storage'

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
const enter = (text: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Originalprompt' }), { target: { value: text } })
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
const history = () => within(screen.getByRole('region', { name: /Verlauf/ }))

describe('PromptRouter interactions', () => {
  it('analyzes, changes priority, and resets', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('button', { name: 'Analysieren' })).toBeDisabled()
    enter('2 + 2')
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    expect(await screen.findByRole('heading', { name: 'Claude Haiku 4.5' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Claude Haiku 4.5' })).toHaveTextContent('Extended an · Claude Pro · claude.ai')
    await user.click(screen.getByRole('button', { name: 'Beste Qualität' }))
    expect(screen.getByRole('heading', { name: 'Claude Opus 5.5' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zurücksetzen' }))
    expect(screen.getByRole('textbox', { name: 'Originalprompt' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Ausgewogen' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: 'Claude Opus 5.5' })).not.toBeInTheDocument()
  })

  it('loads examples and clears results when the original changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByLabelText('Oder starte mit einem Beispiel'), 'file')
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    expect(await screen.findByRole('heading', { name: 'GPT-6 Luna' })).toBeInTheDocument()
    expect(screen.getByText(/OpenAI schätzt für GPT-6 Luna 350–3\.000 Nachrichten pro 5 Stunden/)).toBeInTheDocument()
    enter('Neue Eingabe')
    expect(screen.queryByRole('textbox', { name: 'Optimierter Prompt' })).not.toBeInTheDocument()
  })

  it('shows three labelled variants and highlights the one for the recommended provider', async () => {
    const user = userEvent.setup()
    render(<App />)
    const text = 'Schreibe ein Gedicht über den Herbst in einem ruhigen Ton.'
    enter(text)
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Variante 1 · Claudepasst zur Empfehlung', 'Variante 2 · Neutral', 'Variante 3 · ChatGPT'])
    await user.click(tabs[0])
    expect(screen.getByRole('textbox', { name: 'Optimierter Prompt' })).toHaveValue(`<aufgabe>\n${text}\n</aufgabe>\n\n<ausgabe>\n- Antworte auf Deutsch.\n- Wenn wichtige Angaben fehlen, frage nach, statt sie anzunehmen.\n- Gib zuerst den fertigen Text aus.\n</ausgabe>`)
    await user.click(tabs[2])
    expect((screen.getByRole('textbox', { name: 'Optimierter Prompt' }) as HTMLTextAreaElement).value).toBe(`# Aufgabe

${text}

# Ausgabeformat
- Antworte auf Deutsch.
- Wenn wichtige Angaben fehlen, frage nach, statt sie anzunehmen.
- Gib zuerst den fertigen Text aus.`)
    expect(stored().lastVariant).toBe('chatgpt')
  })

  it('invalidates and reevaluates a manually edited prompt', async () => {
    const user = userEvent.setup()
    render(<App />)
    enter('2 + 2')
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Optimierter Prompt' }), { target: { value: 'Recherchiere aktuelle Informationen mit verlässlichen Quellen.' } })
    expect(screen.queryByRole('heading', { name: 'Claude Haiku 4.5' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Übernehmen und neu bewerten/ }))
    expect(screen.getByRole('heading', { name: 'Claude Sonnet 5.5' })).toBeInTheDocument()
    expect(screen.getByText('Basis: bearbeiteter Prompt')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Originalprompt' })).toHaveValue('2 + 2')
  })

  it('copies the visible text and honestly handles clipboard refusal', async () => {
    const user = userEvent.setup()
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<App />)
    enter('2 + 2')
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    await user.click(screen.getByRole('button', { name: 'Prompt kopieren' }))
    expect(write).toHaveBeenCalledWith('2 + 2')
    expect(screen.getByText('Prompt kopiert.')).toBeInTheDocument()
    write.mockRejectedValueOnce(new Error('denied'))
    await user.click(screen.getByRole('button', { name: 'Prompt kopieren' }))
    expect(screen.getByText(/Kopieren nicht erlaubt/)).toBeInTheDocument()
  })

  it('never truncates oversized input', () => {
    render(<App />)
    const text = 'x'.repeat(20_001)
    enter(text)
    expect(screen.getByRole('textbox', { name: 'Originalprompt' })).toHaveValue(text)
    expect(screen.getByRole('button', { name: 'Analysieren' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('20.000')
  })

  it('discards a late result after the input changes', async () => {
    const user = userEvent.setup()
    const oldResult = await services.processPrompt({ text: '2 + 2', revision: 1 })
    let resolve!: (value: typeof oldResult) => void
    vi.spyOn(services, 'processPrompt').mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    render(<App />)
    enter('2 + 2')
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    enter('Build a React project.')
    await act(async () => { resolve(oldResult) })
    expect(screen.queryByRole('heading', { name: 'Claude Haiku 4.5' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Optimierter Prompt' })).not.toBeInTheDocument()
  })

  it('analyzes with Ctrl+Enter and explains the category', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('textbox', { name: 'Originalprompt' }))
    await user.keyboard('Berechne 17 * 24.{Control>}{Enter}{/Control}')
    expect(await screen.findByText('Warum diese Kategorie?')).toBeInTheDocument()
    expect(screen.getByText(/Rechenausdruck · Mathematik \+3/)).toBeInTheDocument()
    expect(screen.getByText(/^Analyse fertig: Mathematik\. Empfehlung: Claude Haiku 4\.5 · Extended an\.$/)).toBeInTheDocument()
  })

  it('labels a fallback route instead of giving no recommendation', async () => {
    const user = userEvent.setup()
    render(<App />)
    enter('What is the capital of France?')
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    expect(await screen.findByRole('heading', { name: 'Claude Sonnet 5.5' })).toBeInTheDocument()
    expect(screen.getByText('Allgemein · Fallback')).toBeInTheDocument()
    expect(screen.getByText('Fallback-Empfehlung')).toBeInTheDocument()
  })
})

describe('history, usage and settings', () => {
  it('saves each analysis under the versioned key and shows it after a reload', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    enter('Mein privater Prompt: 2 + 2')
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    await user.click(screen.getByRole('button', { name: 'Dark Mode aktivieren' }))
    expect(Object.keys(localStorage).sort()).toEqual(['promptrouter-theme', STORAGE_KEY])
    expect(stored().history[0]).toMatchObject({ prompt: 'Mein privater Prompt: 2 + 2', provider: 'anthropic', optionId: expect.stringMatching(/^claude-/) })
    unmount()
    render(<App />)
    expect(history().getByText('Mein privater Prompt: 2 + 2')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Empfehlungen im Überblick' })).toHaveTextContent(/Claude1 100 %.*\(1 Eintrag\)/)
  })

  it('updates the same history entry when the priority changes instead of adding one', async () => {
    const user = userEvent.setup()
    render(<App />)
    enter('Ich brauche ein Gedicht über den Herbst.')
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    await user.click(await screen.findByRole('button', { name: 'Beste Qualität' }))
    expect(stored().history).toHaveLength(1)
    expect(stored().history[0]).toMatchObject({ mode: 'best', optionId: 'claude-opus-5-5/max' })
    expect(stored().settings.defaultMode).toBe('best')
  })

  it('searches, filters and reuses history entries', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, lastVariant: 'neutral', settings: {}, history: [
      { id: 'a', createdAt: '2026-10-03T09:00:00.000Z', prompt: 'Ich brauche ein Gedicht über den Herbst.', category: 'writing', mode: 'balanced', status: 'recommended', provider: 'anthropic', poolId: 'claude-pro', modelName: 'Claude Sonnet 5.5', settingLabel: 'Effort Low' },
      { id: 'b', createdAt: '2026-10-03T08:00:00.000Z', prompt: 'Analysiere meine CSV-Datei.', category: 'dataAnalysis', mode: 'balanced', status: 'provisional', provider: 'openai', poolId: 'chatgpt-plus-work', modelName: 'GPT-6 Luna', settingLabel: 'Reasoning Medium' },
    ] }))
    render(<App />)
    await user.type(history().getByRole('searchbox'), 'herbst')
    expect(history().getAllByRole('listitem')).toHaveLength(1)
    await user.clear(history().getByRole('searchbox'))
    await user.selectOptions(history().getByLabelText('Nach Anbieter filtern'), 'openai')
    expect(history().getAllByRole('listitem')).toHaveLength(1)
    await user.click(history().getByRole('button', { name: /Analysiere meine CSV-Datei/ }))
    expect(screen.getByRole('textbox', { name: 'Originalprompt' })).toHaveValue('Analysiere meine CSV-Datei.')
    expect(await screen.findByRole('heading', { name: 'GPT-6 Luna' })).toBeInTheDocument()
  })

  it('clears the history only after confirmation', async () => {
    const user = userEvent.setup()
    render(<App />)
    enter('2 + 2')
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Verlauf löschen' }))
    expect(stored().history).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Verlauf löschen' }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(stored().history).toHaveLength(0)
  })

  it('routes only to enabled subscriptions and remembers the choice', async () => {
    const user = userEvent.setup()
    render(<App />)
    enter('Ich brauche ein Gedicht über den Herbst.')
    await user.click(screen.getByRole('button', { name: 'Analysieren' }))
    expect(await screen.findByRole('heading', { name: 'Claude Sonnet 5.5' })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Claude Pro · claude\.ai/ }))
    expect(screen.queryByRole('heading', { name: 'Claude Sonnet 5.5' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /GPT/ })).toBeInTheDocument()
    expect(stored().settings.enabledPools).toEqual(['chatgpt-plus-chat', 'chatgpt-plus-work'])
  })

  it('exports and imports the stored data as JSON', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:export')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Export als JSON/ }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    const file = new File([JSON.stringify({ version: 1, history: [{ id: 'x', createdAt: '2026-10-01T10:00:00.000Z', prompt: 'Importierter Prompt', mode: 'fast', status: 'recommended' }], settings: { preferredProvider: 'openai' } })], 'export.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('JSON-Datei importieren'), file)
    expect(await screen.findByText(/Import fertig: 1 neuer Verlaufseintrag/)).toBeInTheDocument()
    expect(history().getByText('Importierter Prompt')).toBeInTheDocument()
    expect(screen.getByLabelText('Bevorzugter Anbieter')).toHaveValue('openai')
  })

  it('recovers from corrupt stored data with a visible notice', () => {
    localStorage.setItem(STORAGE_KEY, '{broken')
    render(<App />)
    expect(screen.getByText(/beschädigt und wurden durch Standardwerte ersetzt/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analysieren' })).toBeInTheDocument()
  })
})
