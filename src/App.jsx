import { useState } from 'react'
import { useData } from './hooks/useData.js'
import { Overview } from './pages/Overview.jsx'

const NAV = ['Visão geral', 'Meta Ads', 'Google Ads', 'HubSpot']

function fmt(date) {
  if (!date) return '—'
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const [tab, setTab]     = useState('Visão geral')
  const { data, loading, lastFetch, refresh } = useData()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      <header style={{
        background: 'var(--surface)',
        borderBottom: '0.5px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Painel de mídia paga</span>
          <nav style={{ display: 'flex', gap: 2 }}>
            {NAV.map(n => (
              <button
                key={n}
                onClick={() => setTab(n)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: tab === n ? 'var(--bg)' : 'transparent',
                  color: tab === n ? 'var(--text)' : 'var(--muted)',
                  fontWeight: tab === n ? 500 : 400,
                  fontSize: 13,
                }}
              >
                {n}
              </button>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastFetch && (
            <span style={{ fontSize: 11, color: 'var(--hint)' }}>
              Atualizado às {fmt(lastFetch)}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: '0.5px solid var(--border)',
              background: 'transparent',
              fontSize: 12,
              color: 'var(--muted)',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Atualizando…' : '↻ Atualizar'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
        {loading && !data && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--hint)', fontSize: 13 }}>
            Buscando dados…
          </div>
        )}
        {data && tab === 'Visão geral' && <Overview data={data} />}
        {data && tab !== 'Visão geral' && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--hint)', fontSize: 13 }}>
            Aba "{tab}" em construção.
          </div>
        )}
      </main>
    </div>
  )
}