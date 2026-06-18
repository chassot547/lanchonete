import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Produtos from './pages/Produtos'
import Estoque from './pages/Estoque'
import Financeiro from './pages/Financeiro'
import Mesas from './pages/Mesas'
import Clientes from './pages/Clientes'
import Caixa from './pages/Caixa'
import Usuarios from './pages/Usuarios'
import Relatorios from './pages/Relatorios'
import Fiscal from './pages/Fiscal'
import DRE from './pages/DRE'
import Inventario from './pages/Inventario'
import Fornecedores from './pages/Fornecedores'
import NotasFiscais from './pages/NotasFiscais'
import LoginPage from './pages/LoginPage'

const nav = [
  { to: '/',            label: '📊 Dashboard'  },
  { to: '/caixa',       label: '💵 Caixa'      },
  { to: '/mesas',       label: '🪑 Mesas'      },
  { to: '/produtos',    label: '🍔 Produtos'   },
  { to: '/estoque',     label: '📦 Estoque'    },
  { to: '/inventario',  label: '🔢 Inventário' },
  { to: '/clientes',    label: '👥 Clientes'   },
  { to: '/relatorios',  label: '📈 Relatórios' },
  { to: '/dre',         label: '📑 DRE'        },
  { to: '/fiscal',        label: '🧾 Fiscal'        },
  { to: '/financeiro',    label: '💰 Financeiro'    },
  { to: '/fornecedores',  label: '🏭 Fornecedores'  },
  { to: '/notas-fiscais', label: '📋 NF Entrada'    },
  { to: '/usuarios',      label: '🔐 Usuários'      },
]

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <h1 className="text-base font-bold text-orange-400">Lanchonete</h1>
          <p className="text-xs text-gray-500">Painel Gerencial</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition ${
                  isActive ? 'bg-orange-500/20 text-orange-400 font-semibold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full text-sm text-gray-500 hover:text-white py-2"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-950 p-6">{children}</main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(!!s)
      if (s?.access_token) localStorage.setItem('token', s.access_token)
      else localStorage.removeItem('token')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === null) return (
    <div className="flex h-screen items-center justify-center">
      <span className="text-gray-400">Carregando...</span>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/*" element={
          session
            ? <Layout>
                <Routes>
                  <Route path="/"           element={<Dashboard />}  />
                  <Route path="/caixa"      element={<Caixa />}      />
                  <Route path="/mesas"      element={<Mesas />}      />
                  <Route path="/produtos"   element={<Produtos />}   />
                  <Route path="/estoque"    element={<Estoque />}    />
                  <Route path="/clientes"   element={<Clientes />}   />
                  <Route path="/relatorios" element={<Relatorios />} />
                  <Route path="/dre"        element={<DRE />}        />
                  <Route path="/inventario" element={<Inventario />} />
                  <Route path="/fiscal"        element={<Fiscal />}        />
                  <Route path="/fornecedores"  element={<Fornecedores />}  />
                  <Route path="/notas-fiscais" element={<NotasFiscais />}  />
                  <Route path="/financeiro" element={<Financeiro />} />
                  <Route path="/usuarios"   element={<Usuarios />}   />
                </Routes>
              </Layout>
            : <Navigate to="/login" />
        } />
      </Routes>
    </BrowserRouter>
  )
}
