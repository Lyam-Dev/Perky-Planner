import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
// Theme + accent design tokens must be loaded before Tailwind's base layer so
// the CSS variables they define are available to every utility class.
import './themes.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)