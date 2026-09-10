import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')!

// Build-time SEO snapshot (scripts/seo-prerender.mjs) — plain HTML that lets
// crawlers and link previews read the page without running JavaScript. It is
// discarded here so React mounts into a clean container and can never mismatch.
if (rootElement.firstChild) rootElement.innerHTML = ''

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
