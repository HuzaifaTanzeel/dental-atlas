import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import './studio.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element #root was not found')
}

createRoot(root).render(
  <StrictMode>
    <TooltipProvider delay={300}>
      <App />
    </TooltipProvider>
  </StrictMode>,
)
