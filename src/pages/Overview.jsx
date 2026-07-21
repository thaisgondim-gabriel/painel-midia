import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LabelList,
} from 'recharts'
import { getCampaignState } from '../hooks/useData.js'

const STATES_DISPLAY = [
  { key: 'SP',  label: 'São Paulo (SP)',      color: '#0afc33' },
  { key: 'RJ',  label: 'Rio de Janeiro (RJ)', color: '#1A6FE8' },
  { key: 'BH',  label: 'Minas Gerais (MG)',   color: '#f59e0b' },
  { key: 'ES',  label: 'Espírito Santo (ES)', color: '#8b5cf6', disabled: true },
]

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const card = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  padding: '18px 20px',
}

const BRL = (v) => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const NUM = (v) => (v ?? 0).toLocaleString('pt-BR')
const fmtMil = (v) => {
  const n = v ?? 0
  if (n >= 1000) return (n / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mil'
  return BRL(n)
}

function fmtDay(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function filterByStateAndNetwork(data, selectedState, selectedNetwork) {
  const filterCampaigns = (campaigns) => {
    let result = campaigns
    if (selectedState !== 'ALL') result = result.filter(c => getCampaignState(c.name) === selectedState)
    return result
  }
  const metaCamps = selectedNetwork === 'Google' ? [] : filterCampaigns(data.meta.campaigns)
  const googCamps = selectedNetwork === 'Meta'   ? [] : filterCampaigns(data.google.campaigns)
  const sum = (arr, key) => arr.reduce((a, c) => a + (c[key] || 0), 0)
  return {
    ...data,
    meta: { ...data.meta, spend: sum(metaCamps, 'spend'), leads: sum(metaCamps, 'leads'), lav: sum(metaCamps, 'lav'), ganhos: sum(metaCamps, 'ganhos'), cpl: sum(metaCamps, 'leads') > 0 ? sum(metaCamps, 'spend') / sum(metaCamps, 'leads') : 0, campaigns: metaCamps },
    google: { ...data.google, spend: sum(googCamps, 'spend'), leads: sum(googCamps, 'leads'), lav: sum(googCamps, 'lav'), ganhos: sum(googCamps, 'ganhos'), cpl: sum(googCamps, 'leads') > 0 ? sum(googCamps, 'spend') / sum(googCamps, 'leads') : 0, campaigns: googCamps },
  }
}

function buildStateData(data, selectedNetwork) {
  return STATES_DISPLAY.map(s => {
    if (s.disabled) return { ...s, spend: 0, leads: 0, lav: 0, ganhos: 0, cpl: 0 }
    const metaCamps = selectedNetwork === 'Google' ? [] : data.meta.campaigns.filter(c => getCampaignState(c.name) === s.key)
    const googCamps = selectedNetwork === 'Meta'   ? [] : data.google.campaigns.filter(c => getCampaignState(c.name) === s.key)
    const all = [...metaCamps, ...googCamps]
    const spend = all.reduce((a, c) => a + c.spend, 0)
    const leads = all.reduce((a, c) => a + c.leads, 0)
    const lav   = all.reduce((a, c) => a + (c.lav || 0), 0)
    const ganhos = all.reduce((a, c) => a + (c.ganhos || 0), 0)
    return { ...s, spend, leads, lav, ganhos, cpl: leads > 0 ? spend / leads : 0 }
  })
}

// Agrupa data.daily por mês (YYYY-MM) e por estado, somando leads e spend
// de acordo com a rede selecionada (ALL / Meta / Google).
function buildMonthlyStateData(data, selectedNetwork) {
  const daily = data.daily || []
  const monthMap = {} // { 'YYYY-MM': { [stateKey]: { leads, spend } } }

  daily.forEach(d => {
    if (!d.date) return
    const monthKey = d.date.slice(0, 7)
    if (!monthMap[monthKey]) monthMap[monthKey] = {}
    STATES_DISPLAY.forEach(s => {
      if (s.disabled) return
      const source = d.byState?.[s.key] || {}
      let leads = 0, spend = 0
      if (selectedNetwork !== 'Google') { leads += source.metaLeads || 0; spend += source.metaSpend || 0 }
      if (selectedNetwork !== 'Meta')   { leads += source.googleLeads || 0; spend += source.googleSpend || 0 }
      if (!monthMap[monthKey][s.key]) monthMap[monthKey][s.key] = { leads: 0, spend: 0 }
      monthMap[monthKey][s.key].leads += leads
      monthMap[monthKey][s.key].spend += spend
    })
  })

  const monthKeys = Object.keys(monthMap).sort()
  const perState = {}
  STATES_DISPLAY.forEach(s => {
    perState[s.key] = monthKeys.map(mk => {
      const entry = monthMap[mk][s.key] || { leads: 0, spend: 0 }
      const mm = mk.split('-')[1]
      return {
        month: MONTH_LABELS[parseInt(mm, 10) - 1] || mk,
        leads: entry.leads,
        spend: entry.spend,
        cpl: entry.leads > 0 ? entry.spend / entry.leads : 0,
      }
    })
  })

  return { monthKeys, perState }
}

// Barras mensais acumuladas do ano — volume de leads acima da barra, CPL abaixo.
// Por padrão o mês mais recente fica na cor cheia; ao passar o mouse sobre
// qualquer barra, ela assume a cor cheia e as demais ficam esmaecidas.
function MonthlyBars({ monthlyData, color }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  if (!monthlyData.length) return <div style={{ height: 66 }} />
  const max = Math.max(...monthlyData.map(m => m.leads), 1)
  const lastIdx = monthlyData.length - 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 66 }}>
      {monthlyData.map((m, i) => {
        const isActive = hoverIdx === null ? i === lastIdx : i === hoverIdx
        const barHeight = Math.max(Math.round((m.leads / max) * 30), 2)
        return (
          <div
            key={i}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'default' }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? 'var(--text)' : 'var(--muted)', lineHeight: 1, transition: 'color 0.15s' }}>{m.leads}</span>
            <div style={{ width: '100%', height: barHeight, borderRadius: '2px 2px 0 0', background: isActive ? color : `${color}55`, transition: 'background 0.15s' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? 'var(--text)' : 'var(--muted)', lineHeight: 1.3, whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
              {m.cpl > 0 ? `R$${Math.round(m.cpl)}` : ''}
            </span>
            <span style={{ fontSize: 8, color: isActive ? 'var(--muted)' : 'var(--hint)', lineHeight: 1, transition: 'color 0.15s' }}>{m.month}</span>
          </div>
        )
      })}
    </div>
  )
}


function MiniDonut({ data: pieData, colors, size = 80 }) {
  const total = pieData.reduce((a, d) => a + d.value, 0)
  if (total === 0) return <div style={{ fontSize: 11, color: 'var(--hint)' }}>Sem dados</div>
  return (
    <PieChart width={size} height={size}>
      <Pie data={pieData} cx="50%" cy="50%" innerRadius={size * 0.28} outerRadius={size * 0.45} dataKey="value" paddingAngle={2}>
        {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
      </Pie>
      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v) => [NUM(v), '']} />
    </PieChart>
  )
}

// Label customizado que mostra CPL acima da barra
function CplLabel({ x, y, width, value }) {
  if (!value || value === 0) return null
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="var(--muted)" fontSize={9} fontWeight={600}>
      {`R$${Math.round(value)}`}
    </text>
  )
}

export function Overview({ data, yearData, periodLabel, selectedState, selectedNetwork = 'ALL' }) {
  const [segTab, setSegTab] = useState('perfil')
  const [dailyView, setDailyView] = useState('dia')

  // Sempre que o período mudar (Hoje, Este mês, seleção manual, Redefinir),
  // volta o gráfico de leads pra visão padrão "Dias".
  useEffect(() => {
    setDailyView('dia')
  }, [periodLabel])

  const filtered = filterByStateAndNetwork(data, selectedState, selectedNetwork)
  const { meta, google, hubspot } = filtered

  const totalSpend = meta.spend + google.spend

  const totalLeads = (() => {
    const byState = hubspot.byState || {}
    if (selectedState === 'ALL' && selectedNetwork === 'ALL') return hubspot.totalLeads || 0
    if (selectedState === 'ALL') {
      if (selectedNetwork === 'Meta')   return hubspot.metaLeads   || 0
      if (selectedNetwork === 'Google') return hubspot.googleLeads || 0
    }
    const s = byState[selectedState]
    if (!s) return 0
    if (selectedNetwork === 'Meta')   return s.meta   || 0
    if (selectedNetwork === 'Google') return s.google || 0
    return s.total || 0
  })()

  const totalLav    = (meta.lav || 0) + (google.lav || 0)
  const totalGanhos = (meta.ganhos || 0) + (google.ganhos || 0)
  const totalCpl    = totalLeads > 0 ? totalSpend / totalLeads : 0
  const lavPct      = totalLeads > 0 ? Math.round((totalLav / totalLeads) * 100) : 0

  // --- Planejado (respeita filtro de estado; não é quebrado por rede) ---
  const planned = (() => {
    const p = data.planned
    if (!p) return null
    if (selectedState !== 'ALL' && selectedNetwork !== 'ALL') {
      return p.byStateNetwork?.[selectedState]?.[selectedNetwork] || null
    }
    if (selectedState !== 'ALL') return p.byState?.[selectedState] || null
    if (selectedNetwork !== 'ALL') return p.byNetwork?.[selectedNetwork] || null
    return p.total || null
  })()

  // --- Gráfico de leads por período (dia ou mês, respeita filtros de estado e rede) ---
  const dailyRaw = (data.daily || []).map(d => {
    // Se há estado selecionado, usa o breakdown por estado do dia; senão usa os totais do dia
    const source = selectedState !== 'ALL' ? (d.byState?.[selectedState] || {}) : d
    return {
      date: d.date,
      metaLeads:   selectedNetwork !== 'Google' ? (source.metaLeads || 0)   : 0,
      googleLeads: selectedNetwork !== 'Meta'   ? (source.googleLeads || 0) : 0,
      metaSpend:   selectedNetwork !== 'Google' ? (source.metaSpend || 0)   : 0,
      googleSpend: selectedNetwork !== 'Meta'   ? (source.googleSpend || 0) : 0,
    }
  })

  const dailyChartData = dailyRaw.map(d => {
    const leads = d.metaLeads + d.googleLeads
    const spend = d.metaSpend + d.googleSpend
    const cpl = leads > 0 ? Math.round(spend / leads) : 0
    return { date: fmtDay(d.date), Meta: d.metaLeads, Google: d.googleLeads, leads, cpl }
  })

  const monthlyChartData = (() => {
    const map = {}
    dailyRaw.forEach(d => {
      if (!d.date) return
      const mk = d.date.slice(0, 7)
      if (!map[mk]) map[mk] = { metaLeads: 0, googleLeads: 0, metaSpend: 0, googleSpend: 0 }
      map[mk].metaLeads   += d.metaLeads
      map[mk].googleLeads += d.googleLeads
      map[mk].metaSpend   += d.metaSpend
      map[mk].googleSpend += d.googleSpend
    })
    return Object.keys(map).sort().map(mk => {
      const e = map[mk]
      const leads = e.metaLeads + e.googleLeads
      const spend = e.metaSpend + e.googleSpend
      const cpl = leads > 0 ? Math.round(spend / leads) : 0
      const mm = parseInt(mk.split('-')[1], 10)
      return { date: MONTH_LABELS[mm - 1] || mk, Meta: e.metaLeads, Google: e.googleLeads, leads, cpl }
    })
  })()

  const chartData = dailyView === 'mes' ? monthlyChartData : dailyChartData

  // Barras mensais acumuladas do ano por estado — usa yearData (sempre 01/01
  // até hoje, independente do filtro de período do topo). Respeita apenas o
  // filtro de rede (Meta/Google/ALL). Fallback para `data` só evita crash
  // antes do fetch do ano terminar; nesse caso os meses ficam incompletos
  // até o yearData chegar.
  const monthlyByState = buildMonthlyStateData(yearData || data, selectedNetwork)
  const stateData = buildStateData(data, selectedNetwork).map(s => {
    const months = monthlyByState.perState[s.key] || []
    const yearLeads = months.reduce((a, m) => a + m.leads, 0)
    const yearSpend = months.reduce((a, m) => a + m.spend, 0)
    return {
      ...s,
      monthlyData: months,
      yearLeads,
      yearSpend,
      yearCpl: yearLeads > 0 ? yearSpend / yearLeads : 0,
    }
  })

  const resolveSegData = (type) => {
    const h = hubspot || {}
    if (selectedState !== 'ALL' && selectedNetwork === 'Meta')   return (type === 'perfil' ? h.byPerfilStateMeta   : h.byTipoStateMeta)?.[selectedState]   || {}
    if (selectedState !== 'ALL' && selectedNetwork === 'Google') return (type === 'perfil' ? h.byPerfilStateGoogle : h.byTipoStateGoogle)?.[selectedState] || {}
    if (selectedState !== 'ALL') return (type === 'perfil' ? h.byPerfilState : h.byTipoState)?.[selectedState] || {}
    if (selectedNetwork === 'Meta')   return type === 'perfil' ? (h.byPerfilMeta || {}) : (h.byTipoMeta || {})
    if (selectedNetwork === 'Google') return type === 'perfil' ? (h.byPerfilGoogle || {}) : (h.byTipoGoogle || {})
    return type === 'perfil' ? (h.byPerfil || {}) : (h.byTipo || {})
  }

  const byPerfil = resolveSegData('perfil')
  const byTipo   = resolveSegData('tipo')

  const perfilData = [
    { name: 'Síndico',           value: byPerfil['Síndico']           || 0 },
    { name: 'Subsíndico',        value: byPerfil['Subsíndico']        || 0 },
    { name: 'Morador',           value: byPerfil['Morador']           || 0 },
    { name: 'Administrador(a)',  value: byPerfil['Administrador(a)']  || 0 },
    { name: 'Conselheiro',       value: byPerfil['Conselheiro']       || 0 },
    { name: 'Zelador',           value: byPerfil['Zelador']           || 0 },
    { name: 'Líder Comunitário', value: byPerfil['Líder Comunitário'] || 0 },
    { name: 'Outros',            value: byPerfil['Outros']            || 0 },
  ].sort((a, b) => b.value - a.value).filter(d => d.value > 0)

  const tipoData = [
    { name: 'Condomínio', value: byTipo['Condomínio'] || 0 },
    { name: 'Casa',       value: byTipo['Casa']       || 0 },
    { name: 'Comércio',   value: byTipo['Comércio']   || 0 },
  ].sort((a, b) => b.value - a.value).filter(d => d.value > 0)

  const segColors  = ['#0afc33','#1A6FE8','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16','#6b7280']
  const segCurrent = segTab === 'perfil' ? perfilData : tipoData
  const segTotal   = segCurrent.reduce((a, d) => a + d.value, 0)

  const btnToggle = (active) => ({
    padding: '2px 8px', borderRadius: 5, border: `0.5px solid ${active ? '#0afc33' : 'var(--border)'}`, cursor: 'pointer',
    fontSize: 10, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
    background: active ? '#0afc33' : 'transparent',
    color: active ? '#0d3b1f' : 'var(--muted)',
    transition: 'all 0.15s',
  })

  const channelRows = []
  if (selectedNetwork !== 'Google') {
    const leads = selectedState === 'ALL' ? (hubspot.metaLeads || 0) : (hubspot.byState?.[selectedState]?.meta || 0)
    channelRows.push({ name: 'Meta Ads', ...meta, leads, color: '#1877F2' })
  }
  if (selectedNetwork !== 'Meta') {
    const leads = selectedState === 'ALL' ? (hubspot.googleLeads || 0) : (hubspot.byState?.[selectedState]?.google || 0)
    channelRows.push({ name: 'Google Ads', ...google, leads, color: '#EA4335' })
  }

  // Segmento Google Ads - WhatsApp: já somado dentro de "Google Ads" acima (macro),
  // mas exibido como sub-linha segmentável separadamente (não soma de novo nos totais).
  // Investimento e CPL usam o gasto REAL do recurso "Mensagem" (Google Ads Assets report),
  // não a métrica de "conversão" do próprio Google (que conta cliques, não conversas reais).
  const googleWhatsAppLeads = selectedNetwork !== 'Meta'
    ? (selectedState === 'ALL' ? (hubspot.googleWhatsAppLeads || 0) : (hubspot.byStateGoogleWhatsApp?.[selectedState] || 0))
    : 0
  const googleWhatsAppSpend = selectedNetwork !== 'Meta'
    ? (selectedState === 'ALL' ? (hubspot.googleWhatsAppSpend || 0) : (hubspot.byStateGoogleWhatsAppSpend?.[selectedState] || 0))
    : 0
  const googleWhatsAppCpl = googleWhatsAppLeads > 0 ? googleWhatsAppSpend / googleWhatsAppLeads : 0

  const channelTotals = channelRows.reduce((acc, r) => ({
    spend: acc.spend + (r.spend || 0),
    leads: acc.leads + (r.leads || 0),
    lav: acc.lav + (r.lav || 0),
    ganhos: acc.ganhos + (r.ganhos || 0),
  }), { spend: 0, leads: 0, lav: 0, ganhos: 0 })
  const channelTotalsCpl       = channelTotals.leads > 0 ? channelTotals.spend / channelTotals.leads : 0
  const channelTotalsLavPct    = channelTotals.leads > 0 ? Math.round((channelTotals.lav / channelTotals.leads) * 100) : 0
  const channelTotalsGanhosPct = channelTotals.lav > 0 ? Math.round((channelTotals.ganhos / channelTotals.lav) * 100) : 0
  const channelTotalsCac       = channelTotals.ganhos > 0 ? channelTotals.spend / channelTotals.ganhos : 0

  const showMeta   = selectedNetwork !== 'Google'
  const showGoogle = selectedNetwork !== 'Meta'
  const isSingle   = chartData.length === 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) 1.6fr', gap: 10, height: 175 }}>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>Investimento</span>
            <span style={{ fontSize: 16 }}>💳</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>R$ {fmtMil(totalSpend)}</div>
          <div style={{ marginTop: 'auto' }}>
            {planned ? (() => {
              const spendPct = planned.invest > 0 ? (totalSpend / planned.invest) * 100 : 0
              const leadsPct = planned.leads > 0 ? (totalLeads / planned.leads) * 100 : 0
              // Saudável: % de leads conquistados >= % de orçamento consumido
              const onTrack = leadsPct >= spendPct
              return (
                <>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
                    Planejado: R$ {fmtMil(planned.invest)}
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(spendPct, 100)}%`, background: spendPct > 100 ? 'var(--red)' : 'var(--green)', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: onTrack ? 'var(--green)' : 'var(--red)' }}>
                    {Math.round(spendPct)}% consumido {onTrack ? '✓' : '⚠'}
                  </div>
                </>
              )
            })() : (
              <div style={{ fontSize: 10, color: 'var(--hint)' }}>R$ {BRL(totalSpend)} total</div>
            )}
          </div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>Leads</span>
            <span style={{ fontSize: 16 }}>🎯</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{NUM(totalLeads)}</div>
          <div style={{ marginTop: 'auto' }}>
            {planned ? (() => {
              const spendPct = planned.invest > 0 ? (totalSpend / planned.invest) * 100 : 0
              const leadsPct = planned.leads > 0 ? (totalLeads / planned.leads) * 100 : 0
              const onTrack = leadsPct >= spendPct
              return (
                <>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
                    Planejado: {NUM(planned.leads)}
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(leadsPct, 100)}%`, background: 'var(--green)', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: onTrack ? 'var(--green)' : 'var(--red)' }}>
                    {Math.round(leadsPct)}% conquistado {onTrack ? '✓' : '⚠'}
                  </div>
                </>
              )
            })() : (
              <div style={{ fontSize: 10, color: 'var(--hint)' }}>Sem planejamento</div>
            )}
          </div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>LAV</span>
            <span style={{ fontSize: 16 }}>✅</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{NUM(totalLav)}</div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{lavPct}% sobre leads</div>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(lavPct, 100)}%`, background: 'var(--muted)', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: 'transparent' }}>—</div>
          </div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>CPL Médio</span>
            <span style={{ fontSize: 16 }}>💰</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>R$ {BRL(totalCpl)}</div>
          <div style={{ marginTop: 'auto' }}>
            {planned ? (() => {
              const diff = totalCpl - planned.cpl
              const isAbove = diff > 0
              return (
                <>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
                    Planejado: R$ {BRL(planned.cpl)}
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '100%', background: isAbove ? 'var(--red)' : 'var(--green)', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: isAbove ? 'var(--red)' : 'var(--green)' }}>
                    {isAbove ? '+' : '-'}R$ {BRL(Math.abs(diff))} {isAbove ? '⚠' : '✓'}
                  </div>
                </>
              )
            })() : (
              <div style={{ fontSize: 10, color: 'var(--hint)' }}>Sem planejamento</div>
            )}
          </div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>Ganhos</span>
            <span style={{ fontSize: 16 }}>🏆</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{NUM(totalGanhos)}</div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
              CAC: {totalGanhos > 0 ? `R$ ${BRL(totalSpend / totalGanhos)}` : '—'}
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '100%', background: 'var(--green)', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: 'var(--green)' }}>
              {totalLav > 0 ? Math.round((totalGanhos / totalLav) * 100) : 0}% Ganhos / LAV
            </div>
          </div>
        </div>

        {/* Segmentação */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>Segmentação</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={() => setSegTab('perfil')} style={btnToggle(segTab === 'perfil')}>Perfil</button>
              <button onClick={() => setSegTab('tipo')}   style={btnToggle(segTab === 'tipo')}>Tipo</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <MiniDonut data={segCurrent} colors={segColors} size={72} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflowY: 'auto' }}>
              {segCurrent.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: segColors[i % segColors.length], flexShrink: 0 }} />
                  <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{segTotal > 0 ? Math.round((d.value / segTotal) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico diário */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>
              Leads por {dailyView === 'mes' ? 'mês' : 'dia'} — {selectedNetwork === 'ALL' ? 'Meta vs Google' : selectedNetwork}
            </p>
            <p style={{ fontSize: 11, color: 'var(--hint)' }}>
              CPL total {dailyView === 'mes' ? 'do mês' : 'do dia'} indicado no topo de cada barra
            </p>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => setDailyView('dia')} style={btnToggle(dailyView === 'dia')}>Dias</button>
            <button onClick={() => setDailyView('mes')} style={btnToggle(dailyView === 'mes')}>Mês</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap={isSingle ? '60%' : '25%'}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--hint)' }} axisLine={false} tickLine={false} interval={dailyView === 'mes' ? 0 : (chartData.length > 20 ? 1 : 0)} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--hint)' }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--surface)' }}
              formatter={(value, name, props) => {
                if (name === 'Meta' || name === 'Google') return [value + ' leads', name]
                return [value, name]
              }}
            />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
            {showMeta && (
              <Bar dataKey="Meta" stackId="a" fill="#1A6FE8" radius={showGoogle ? [0,0,0,0] : [3,3,0,0]}>
                {!showGoogle && <LabelList dataKey="cpl" content={<CplLabel />} />}
              </Bar>
            )}
            {showGoogle && (
              <Bar dataKey="Google" stackId="a" fill="#ff4538" radius={[3,3,0,0]}>
                <LabelList dataKey="cpl" content={<CplLabel />} />
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Canais de Aquisição */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Canais de Aquisição</p>
          <span style={{ fontSize: 11, color: 'var(--hint)' }}>{periodLabel}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Canal','Investimento','Leads','CPL','LAV','% LAV / Leads','Ganhos','% Ganhos / LAV','CAC'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channelRows.map((row, i) => {
                const cpl       = row.leads > 0 ? row.spend / row.leads : 0
                const lavPctRow = row.leads > 0 ? Math.round(((row.lav || 0) / row.leads) * 100) : 0
                const ganhosPct = (row.lav || 0) > 0 ? Math.round(((row.ganhos || 0) / row.lav) * 100) : 0
                const cac       = (row.ganhos || 0) > 0 ? row.spend / row.ganhos : 0
                return (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                        {row.name}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>R$ {BRL(row.spend)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{NUM(row.leads)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: cpl > 40 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>R$ {BRL(cpl)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{NUM(row.lav || 0)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>{lavPctRow}%</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{NUM(row.ganhos || 0)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>{ganhosPct}%</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{cac > 0 ? `R$ ${BRL(cac)}` : '—'}</td>
                  </tr>
                )
              })}
              {googleWhatsAppLeads > 0 && (
                <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <td style={{ padding: '8px 16px 8px 32px', fontWeight: 500, color: 'var(--muted)', fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#25D366', flexShrink: 0 }} />
                      ↳ WhatsApp (incluso no total acima)
                    </div>
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--muted)' }}>R$ {BRL(googleWhatsAppSpend)}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--muted)' }}>{NUM(googleWhatsAppLeads)}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'center', color: googleWhatsAppCpl > 40 ? 'var(--red)' : 'var(--muted)', fontWeight: 600 }}>R$ {BRL(googleWhatsAppCpl)}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--hint)' }}>—</td>
                  <td style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--hint)' }}>—</td>
                  <td style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--hint)' }}>—</td>
                  <td style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--hint)' }}>—</td>
                  <td style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--hint)' }}>—</td>
                </tr>
              )}
              {channelRows.length > 0 && (
                <tr style={{ background: 'var(--bg)' }}>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>Total</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>R$ {BRL(channelTotals.spend)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>{NUM(channelTotals.leads)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: channelTotalsCpl > 40 ? 'var(--red)' : 'var(--green)' }}>R$ {BRL(channelTotalsCpl)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>{NUM(channelTotals.lav)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--green)' }}>{channelTotalsLavPct}%</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>{NUM(channelTotals.ganhos)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--green)' }}>{channelTotalsGanhosPct}%</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>{channelTotalsCac > 0 ? `R$ ${BRL(channelTotalsCac)}` : '—'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Regional */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Performance Regional</p>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {stateData.map(s => (
            <div key={s.key} style={{ ...card, padding: 0, overflow: 'hidden', opacity: s.disabled ? 0.45 : 1 }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.disabled ? 'var(--border)' : s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.label}</span>
                {s.disabled && <span style={{ marginLeft: 'auto', fontSize: 9, background: 'var(--border)', color: 'var(--muted)', padding: '2px 6px', borderRadius: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Em breve</span>}
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  {[
                    { label: 'Investimento', value: 'R$ ' + fmtMil(s.yearSpend), flex: 1.6 },
                    { label: 'Leads',        value: NUM(s.yearLeads),            flex: 1 },
                    { label: 'CPL',          value: 'R$ ' + BRL(s.yearCpl),      flex: 1.2 },
                  ].map(m => (
                    <div key={m.label} style={{ flex: m.flex, textAlign: 'center', minWidth: 0 }}>
                      <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>{m.label}</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{s.disabled ? '—' : m.value}</p>
                    </div>
                  ))}
                </div>
                <MonthlyBars monthlyData={s.disabled ? [] : s.monthlyData} color={s.color} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', fontWeight: 600 }}>Últimos meses</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: s.disabled ? 'var(--muted)' : s.color }}>{s.disabled ? '—' : `${NUM(s.yearLeads)} leads`}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
