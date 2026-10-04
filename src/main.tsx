import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { ErrorBoundary } from './app/ErrorBoundary'
import './styles/base.css'
import './styles/layout.css'
import './styles/cards.css'
import './styles/recommendation.css'
import './styles/side.css'

const container = document.getElementById('root')
if (!container) throw new Error('PromptRouter: Element #root fehlt in index.html.')

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
