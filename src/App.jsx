import { useState, useMemo, useRef, useEffect } from 'react'
import { useData, useYearData, useMetaAdsDetail, useComunidadeData, useComunidadeYearData, MONTHS, resolveMonths, resolveDateRange } from './hooks/useData.js'
import { Overview } from './pages/Overview.jsx'
import { MetaAdsDetail } from './pages/MetaAdsDetail.jsx'
import { ComunidadeOverview } from './pages/ComunidadeOverview.jsx'

const STATES = [
  { key: 'ALL', label: 'Geral' },
  { key: 'SP',  label: 'SP' },
  { key: 'RJ',  label: 'RJ' },
  { key: 'BH',  label: 'MG' },
  { key: 'ES',  label: 'ES', disabled: true },
]

// Estados da view Comunidade usam a sigla real (vem direto da propriedade
// "estado" do HubSpot), diferente da mídia paga que usa "BH" internamente
// pro nome de campanha de Minas Gerais.
const STATES_COMUNIDADE = [
  { key: 'ALL', label: 'Geral' },
  { key: 'SP',  label: 'SP' },
  { key: 'RJ',  label: 'RJ' },
  { key: 'MG',  label: 'MG' },
  { key: 'ES',  label: 'ES' },
]

const NETWORKS = [
  { key: 'ALL',    label: 'Geral' },
  { key: 'Meta',   label: 'Meta' },
  { key: 'Google', label: 'Google' },
]

const SECTIONS = [
  { key: 'midiaPaga',   label: 'Mídia Paga', icon: '💰' },
  { key: 'comunidade',  label: 'Comunidade', icon: '🌱' },
]

const SUBVIEWS = [
  { key: 'overview', label: 'Visão geral' },
  { key: 'ads',      label: 'Detalhamento Meta Ads' },
]

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function fmt(date) {
  if (!date) return '—'
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function MonthCalendar({ year, month, startDate, endDate, hoverDate, onDayClick, onDayHover }) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells = []

  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return (
    <div style={{ width: 220 }}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text)' }}>
        {MONTH_NAMES[month]} de {year}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--hint)', fontWeight: 600, padding: '2px 0' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const dateStr = toDateStr(year, month, d)
          const isStart = dateStr === startDate
          const isEnd = dateStr === endDate
          const effectiveEnd = endDate || hoverDate
          const inRange = startDate && effectiveEnd && dateStr > startDate && dateStr < effectiveEnd
          const isToday = dateStr === today
          const isFuture = dateStr > today
          const isDisabled = dateStr < '2026-01-01' || dateStr > '2026-12-31' || isFuture

          let bg = 'transparent'
          let color = isDisabled ? 'var(--border)' : 'var(--text)'
          let fontWeight = isToday ? 700 : 400
          let borderRadius = '50%'

          if (isStart || isEnd) {
            bg = '#0afc33'
            color = '#0d3b1f'
            fontWeight = 700
          } else if (inRange) {
            bg = '#0afc3322'
            color = 'var(--text)'
            borderRadius = '4px'
          }

          return (
            <div
              key={i}
              onClick={() => !isDisabled && onDayClick(dateStr)}
              onMouseEnter={() => !isDisabled && onDayHover(dateStr)}
              style={{
                textAlign: 'center', fontSize: 11, padding: '5px 2px',
                borderRadius, background: bg, color, fontWeight,
                cursor: isDisabled ? 'default' : 'pointer',
                transition: 'all 0.1s',
                border: isToday && !isStart && !isEnd ? '1px solid #0afc33' : '1px solid transparent',
              }}
            >
              {d}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DateRangePicker({ startDate, endDate, onChange }) {
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState(null)
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)
  const [hoverDate, setHoverDate] = useState(null)

  const now = new Date()
  const initLeftMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const initLeftYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const [leftYear, setLeftYear]   = useState(initLeftYear)
  const [leftMonth, setLeftMonth] = useState(initLeftMonth)
  const ref = useRef(null)

  useEffect(() => {
    setTempStart(startDate)
    setTempEnd(endDate)
  }, [startDate, endDate])

  const handleOpen = () => {
    const n = new Date()
    const lm = n.getMonth() === 0 ? 11 : n.getMonth() - 1
    const ly = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear()
    setLeftMonth(lm)
    setLeftYear(ly)
    setSelecting(null)
    setOpen(v => !v)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1
  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear

  const handleDayClick = (dateStr) => {
    if (!selecting || selecting === null) {
      setTempStart(dateStr)
      setTempEnd(null)
      setSelecting('end')
    } else {
      if (dateStr < tempStart) {
        setTempStart(dateStr)
        setTempEnd(tempStart)
      } else {
        setTempEnd(dateStr)
      }
      setSelecting(null)
    }
  }

  const handleApply = () => {
    if (tempStart && tempEnd) {
      onChange(tempStart, tempEnd)
      setOpen(false)
      setSelecting(null)
    }
  }

  const handleCancel = () => {
    setTempStart(startDate)
    setTempEnd(endDate)
    setOpen(false)
    setSelecting(null)
  }

  const label = startDate && endDate
    ? `${fmtDate(startDate)} – ${fmtDate(endDate)}`
    : 'Selecionar período'

  const prevMonth = () => {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1) }
    else setLeftMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1) }
    else setLeftMonth(m => m + 1)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 8, cursor: 'pointer',
          fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600,
          background: open ? '#0afc33' : 'transparent',
          color: open ? '#0d3b1f' : 'var(--muted)',
          border: `0.5px solid ${open ? '#0afc33' : 'var(--border)'}`,
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 13 }}>📅</span>
        {label}
        <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderRadius: 12, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ fontSize: 11, color: 'var(--hint)', textAlign: 'center' }}>
            {selecting === 'end' ? 'Selecione a data de término' : 'Selecione a data de início'}
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: '4px', alignSelf: 'center' }}>‹</button>

            <MonthCalendar
              year={leftYear} month={leftMonth}
              startDate={tempStart} endDate={tempEnd}
              hoverDate={selecting === 'end' ? hoverDate : null}
              onDayClick={handleDayClick}
              onDayHover={setHoverDate}
            />

            <MonthCalendar
              year={rightYear} month={rightMonth}
              startDate={tempStart} endDate={tempEnd}
              hoverDate={selecting === 'end' ? hoverDate : null}
              onDayClick={handleDayClick}
              onDayHover={setHoverDate}
            />

            <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: '4px', alignSelf: 'center' }}>›</button>
          </div>

          {(tempStart || tempEnd) && (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
              {fmtDate(tempStart)} {tempEnd ? `→ ${fmtDate(tempEnd)}` : '→ …'}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={handleCancel} style={{ padding: '6px 14px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
              Cancelar
            </button>
            <button onClick={handleApply} disabled={!tempStart || !tempEnd} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: tempStart && tempEnd ? '#0afc33' : 'var(--border)', color: tempStart && tempEnd ? '#0d3b1f' : 'var(--hint)', cursor: tempStart && tempEnd ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700, fontFamily: 'DM Sans, sans-serif' }}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const SELECTED_BG    = '#0afc33'
const SELECTED_COLOR = '#0d3b1f'
const MAX_WIDTH      = 1200
const SIDEBAR_WIDTH  = 208

export default function App() {
  const today = new Date()
  // Usa componentes de data locais, não toISOString() — toISOString() converte
  // pra UTC, que à noite no Brasil (GMT-3) já é o dia seguinte, fazendo o
  // filtro "Hoje" pedir uma data futura (sem dados) pro Meta.
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const lastOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(getDaysInMonth(today.getFullYear(), today.getMonth())).padStart(2, '0')}`

  const [startDate, setStartDate]             = useState(firstOfMonth)
  const [endDate, setEndDate]                 = useState(lastOfMonth)
  const [selectedState, setSelectedState]     = useState('ALL')
  const [selectedStateComunidade, setSelectedStateComunidade] = useState('ALL')
  const [selectedNetwork, setSelectedNetwork] = useState('ALL')

  // Hierarquia de navegação: seção de topo (Mídia Paga / Comunidade) na
  // sidebar, e sub-aba (Visão geral / Detalhamento Meta Ads) só dentro de
  // Mídia Paga. `view` deriva os dois pra manter o resto da lógica igual.
  const [section, setSection] = useState('midiaPaga') // 'midiaPaga' | 'comunidade'
  const [subView, setSubView] = useState('overview')  // 'overview' | 'ads' (só usado dentro de midiaPaga)
  const view = section === 'comunidade' ? 'comunidade' : subView

  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])

  const selectedMonths = useMemo(() => {
    const months = []
    const cur = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
      if (!months.includes(key)) months.push(key)
      cur.setMonth(cur.getMonth() + 1)
    }
    return months
  }, [startDate, endDate])

  const periodLabel = useMemo(() => {
    if (startDate === endDate) return fmtDate(startDate)
    return `${fmtDate(startDate)} – ${fmtDate(endDate)}`
  }, [startDate, endDate])

  const isToday = startDate === todayStr && endDate === todayStr
  const isThisMonth = startDate === firstOfMonth && endDate === lastOfMonth

  const handleToday = () => {
    setStartDate(todayStr)
    setEndDate(todayStr)
  }

  const handleThisMonth = () => {
    setStartDate(firstOfMonth)
    setEndDate(lastOfMonth)
  }

  const handleReset = () => {
    setStartDate(firstOfMonth)
    setEndDate(lastOfMonth)
    setSelectedState('ALL')
    setSelectedStateComunidade('ALL')
    setSelectedNetwork('ALL')
  }

  const { data, loading, lastFetch, refresh } = useData(selectedMonths, dateRange)

  // Busca independente do filtro de período do topo — sempre 01/01 até hoje.
  // Alimenta as barras mensais da Performance Regional, que não devem
  // respeitar o filtro de data (só o de rede/estado).
  const { yearData } = useYearData(lastFetch)

  // Comunidade (leads orgânicos) — fetch próprio, mesmo padrão do painel de
  // mídia paga, mas via webhook dedicado (sem Meta/Google/planejamento).
  const { data: comunidadeData, loading: comunidadeLoading, lastFetch: comunidadeLastFetch, refresh: refreshComunidade } = useComunidadeData(dateRange)
  const { yearData: comunidadeYearData } = useComunidadeYearData(comunidadeLastFetch)

  // Detalhamento de anúncios (Meta Ads) — página separada, com seu próprio
  // fetch/mock. Chamado sempre (regra dos hooks), só é renderizado quando
  // `view === 'ads'`.
  const { detailData, detailLoading } = useMetaAdsDetail(dateRange)

  const btnBase = {
    border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    fontSize: 12, fontWeight: 600, borderRadius: 8, transition: 'all 0.15s',
  }
  const btnStyle = (active) => ({
    ...btnBase,
    padding: '4px 10px',
    background: active ? SELECTED_BG : 'transparent',
    color: active ? SELECTED_COLOR : 'var(--muted)',
    border: `0.5px solid ${active ? SELECTED_BG : 'var(--border)'}`,
  })

  const innerStyle = {
    maxWidth: MAX_WIDTH, margin: '0 auto', padding: '0 28px',
    display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'DM Sans, sans-serif', display: 'flex' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Sidebar */}
      <aside style={{
        width: SIDEBAR_WIDTH, flexShrink: 0, background: 'var(--surface)',
        borderRight: '0.5px solid var(--border)', position: 'sticky', top: 0,
        height: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 12px',
        boxSizing: 'border-box', gap: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1 }}>G</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', letterSpacing: '-0.01em' }}>Painel de Leads</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SECTIONS.map(s => {
            const active = section === s.key
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, textAlign: 'left',
                  background: active ? SELECTED_BG : 'transparent',
                  color: active ? SELECTED_COLOR : 'var(--muted)',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 15 }}>{s.icon}</span>
                {s.label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Coluna principal */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Header */}
        <header style={{ background: 'var(--surface)', borderBottom: '0.5px solid var(--border)', height: 56, position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ ...innerStyle, justifyContent: 'space-between', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {section === 'midiaPaga' && SUBVIEWS.map(v => (
                <button key={v.key} onClick={() => setSubView(v.key)} style={btnStyle(subView === v.key)}>
                  {v.label}
                </button>
              ))}
              {section === 'comunidade' && (
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Comunidade</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {(view === 'comunidade' ? comunidadeLastFetch : lastFetch) && (
                <span style={{ fontSize: 11, color: 'var(--hint)' }}>Atualizado às {fmt(view === 'comunidade' ? comunidadeLastFetch : lastFetch)}</span>
              )}
              <button onClick={handleReset} disabled={loading || comunidadeLoading} style={{ ...btnBase, padding: '5px 12px', background: 'transparent', border: '0.5px solid var(--border)', color: 'var(--muted)', opacity: (loading || comunidadeLoading) ? 0.5 : 1 }}>
                Redefinir
              </button>
              <button onClick={view === 'comunidade' ? refreshComunidade : refresh} disabled={view === 'comunidade' ? comunidadeLoading : loading} style={{ ...btnBase, padding: '5px 12px', background: 'transparent', border: '0.5px solid var(--border)', color: 'var(--muted)', opacity: (view === 'comunidade' ? comunidadeLoading : loading) ? 0.5 : 1 }}>
                {(view === 'comunidade' ? comunidadeLoading : loading) ? 'Atualizando…' : '↻ Atualizar'}
              </button>
            </div>
          </div>
        </header>

      {/* Barra de filtros */}
      <div style={{ background: 'var(--surface)', borderBottom: '0.5px solid var(--border)', position: 'sticky', top: 56, zIndex: 15 }}>
        <div style={{ ...innerStyle, gap: 20, flexWrap: 'wrap', padding: '10px 28px' }}>

          {/* Período */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--hint)', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Período</span>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e) }}
            />
            <button
              onClick={handleToday}
              style={{
                ...btnBase,
                padding: '4px 10px',
                background: isToday ? SELECTED_BG : 'transparent',
                color: isToday ? SELECTED_COLOR : 'var(--muted)',
                border: `0.5px solid ${isToday ? SELECTED_BG : 'var(--border)'}`,
              }}
            >
              Hoje
            </button>
            <button
              onClick={handleThisMonth}
              style={{
                ...btnBase,
                padding: '4px 10px',
                background: isThisMonth ? SELECTED_BG : 'transparent',
                color: isThisMonth ? SELECTED_COLOR : 'var(--muted)',
                border: `0.5px solid ${isThisMonth ? SELECTED_BG : 'var(--border)'}`,
              }}
            >
              Este mês
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          {/* Estado */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--hint)', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</span>
            {(view === 'comunidade' ? STATES_COMUNIDADE : STATES).map(s => {
              const current = view === 'comunidade' ? selectedStateComunidade : selectedState
              const setCurrent = view === 'comunidade' ? setSelectedStateComunidade : setSelectedState
              return (
                <button key={s.key} onClick={() => !s.disabled && setCurrent(s.key)} disabled={s.disabled}
                  title={s.disabled ? 'Em breve' : undefined}
                  style={{ ...btnStyle(current === s.key && !s.disabled), opacity: s.disabled ? 0.4 : 1, cursor: s.disabled ? 'not-allowed' : 'pointer', color: s.disabled ? 'var(--border)' : current === s.key ? SELECTED_COLOR : 'var(--muted)' }}>
                  {s.label}
                </button>
              )
            })}
          </div>

          {/* Rede — só faz sentido na Visão geral, já que Detalhamento é Meta-only e Comunidade não tem rede paga */}
          {view === 'overview' && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--hint)', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rede</span>
                {NETWORKS.map(n => (
                  <button key={n.key} onClick={() => setSelectedNetwork(n.key)} style={btnStyle(selectedNetwork === n.key)}>
                    {n.label}
                  </button>
                ))}
              </div>
            </>
          )}

        </div>
      </div>

      {/* Body */}
      <main style={{ maxWidth: MAX_WIDTH, margin: '0 auto', padding: '24px 28px', position: 'relative' }}>
        {view === 'overview' && (
          <>
            {loading && data && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,0,0,0.18)', borderRadius: 12, backdropFilter: 'blur(1.5px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}>
                <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid var(--border)', borderTopColor: '#0afc33', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Atualizando dados…</span>
                </div>
              </div>
            )}
            {loading && !data && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--hint)', fontSize: 13 }}>Buscando dados…</div>
            )}
            {data && (
              <Overview
                data={data}
                yearData={yearData}
                periodLabel={periodLabel}
                selectedState={selectedState}
                selectedNetwork={selectedNetwork}
              />
            )}
          </>
        )}

        {view === 'comunidade' && (
          <>
            {comunidadeLoading && comunidadeData && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,0,0,0.18)', borderRadius: 12, backdropFilter: 'blur(1.5px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}>
                <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid var(--border)', borderTopColor: '#0afc33', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Atualizando dados…</span>
                </div>
              </div>
            )}
            {comunidadeLoading && !comunidadeData && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--hint)', fontSize: 13 }}>Buscando dados…</div>
            )}
            {comunidadeData && (
              <ComunidadeOverview
                data={comunidadeData}
                yearData={comunidadeYearData}
                periodLabel={periodLabel}
                selectedState={selectedStateComunidade}
              />
            )}
          </>
        )}

        {view === 'ads' && (
          <MetaAdsDetail
            detailData={detailData}
            loading={detailLoading}
            selectedState={selectedState}
            periodLabel={periodLabel}
          />
        )}
      </main>
      </div>
    </div>
  )
}
