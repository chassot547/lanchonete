import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CardapioPage from './pages/CardapioPage'
import './index.css'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/:qrCode" element={<CardapioPage />} />
          <Route path="/" element={<CardapioPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
