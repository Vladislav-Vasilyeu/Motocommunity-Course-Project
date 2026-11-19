import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './features/preferences/theme'
import './App.css'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
