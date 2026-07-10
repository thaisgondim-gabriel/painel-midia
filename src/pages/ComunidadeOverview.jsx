import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LabelList,
} from 'recharts'
import { CHANNELS, CHANNEL_COLORS } from '../hooks/useData.js'

const STATES_DISPLAY = [
  { key: 'SP', label: 'São Paulo (SP)',      color: '#0afc33' },
  { key: 'RJ', label: 'Rio de Janeiro (RJ)', color: '#1A6FE8' },
  { key: 'MG', label: 'Minas Gerais (MG)',   color: '#f59e0b' },
  { key: 'ES', label: 'Espírito Santo (ES)', color: '#8b5cf6' },
]

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const card = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  padding: '18px 20px',
}

const NUM = (v) => (v ?? 0).toLocaleString('pt-BR')

function fmtDay(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function emptyTotals() { return { leads: 0, lav: 0, ganhos: 0 } }

function resolveTotals(data, selectedState) {
  if (selectedState === 'ALL') return data.totals || emptyTotals()
  return data.byState?.[selectedState] || emptyTotals()
}

function resolveChannelRows(data, selectedState) {
  const source = selectedState === 'ALL' ? (data.byChannel || {}) : (data.byChannelState?.[selectedState] || {})
  return CHANNELS.map(c => ({ name: c, color: CHANNEL_COLORS[c], ...(source[c] || emptyTotals()) }))
}

function resolveSegData(data, selectedState, type) {
  const seg = data.segmentacao || {}
  if (selectedState === 'ALL') return (type === 'perfil' ? seg.byPerfil : seg.byTipo) || {}
  const stateSeg = type === 'perfil' ? seg.byPerfilState : seg.byTipoState
  return stateSeg?.[selectedState] || {}
}

function buildChartData(data, selectedState, granularity) {
  const daily = data.daily || []
  if (granularity === 'dia') {
    return daily.map(d => {
      const source = selectedState === 'ALL' ? d.channels : (d.states?.[selectedState]?.channels || {})
      const entry = { date: fmtDay(d.date) }
      let total = 0
      CHANNELS.forEach(c => { entry[c] = source?.[c] || 0; total += entry[c] })
      entry.total = total
      // Fatia de valor 0 empilhada no topo — com minPointSize no <Bar>, o
      // Recharts é forçado a sempre renderizar (e portanto sempre desenhar o
      // label), na posição exata do topo real da pilha.
      entry._labelAnchor = 0
      return entry
    })
  }
  const map = {}
  daily.forEach(d => {
    if (!d.date) return
    const mk = d.date.slice(0, 7)
    if (!map[mk]) { map[mk] = {}; CHANNELS.forEach(c => map[mk][c] = 0) }
    const source = selectedState === 'ALL' ? d.channels : (d.states?.[selectedState]?.channels || {})
    CHANNELS.forEach(c => map[mk][c] += (source?.[c] || 0))
  })
  return Object.keys(map).sort().map(mk => {
    const mm = parseInt(mk.split('-')[1], 10)
    const entry = { date: MONTH_LABELS[mm - 1] || mk }
    let total = 0
    CHANNELS.forEach(c => { entry[c] = map[mk][c]; total += entry[c] })
    entry.total = total
    entry._labelAnchor = 0
    return entry
  })
}

// Soma de leads por estado, por mês, a partir do yearData (sempre 01/01 até hoje)
function buildMonthlyStateData(yearData) {
  const daily = yearData?.daily || []
  const monthMap = {}
  daily.forEach(d => {
    if (!d.date) return
    const mk = d.date.slice(0, 7)
    if (!monthMap[mk]) monthMap[mk] = {}
    STATES_DISPLAY.forEach(s => {
      monthMap[mk][s.key] = (monthMap[mk][s.key] || 0) + (d.states?.[s.key]?.total || 0)
    })
  })
  const monthKeys = Object.keys(monthMap).sort()
  const perState = {}
  STATES_DISPLAY.forEach(s => {
    perState[s.key] = monthKeys.map(mk => {
      const mm = parseInt(mk.split('-')[1], 10)
      return { month: MONTH_LABELS[mm - 1] || mk, leads: monthMap[mk][s.key] || 0 }
    })
  })
  return perState
}

// Barras mensais acumuladas do ano — só volume de leads (sem CPL, sem investimento)
function MonthlyBars({ monthlyData, color }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  if (!monthlyData.length) return <div style={{ height: 56 }} />
  const max = Math.max(...monthlyData.map(m => m.leads), 1)
  const lastIdx = monthlyData.length - 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56 }}>
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

// Label customizado que mostra o total de leads do dia/mês acima da barra
// empilhada — mesmo padrão do CplLabel usado na mídia paga. Dias sem leads
// mostram um traço, pra deixar claro que o dado existe e é zero.
function TotalLabel({ x, y, width, index, chartData }) {
  const entry = chartData[index]
  const total = entry?.total || 0
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="var(--muted)" fontSize={10} fontWeight={700}>
      {total > 0 ? total : '—'}
    </text>
  )
}

export function ComunidadeOverview({ data, yearData, periodLabel, selectedState }) {
  const [dailyView, setDailyView] = useState('dia')

  useEffect(() => {
    setDailyView('dia')
  }, [periodLabel])

  if (!data) return null

  const totals = resolveTotals(data, selectedState)
  const lavPct    = totals.leads > 0 ? Math.round((totals.lav / totals.leads) * 100) : 0
  const ganhosPct = totals.lav   > 0 ? Math.round((totals.ganhos / totals.lav) * 100) : 0

  const channelRows = resolveChannelRows(data, selectedState)
  const channelTotals = channelRows.reduce((acc, r) => ({
    leads: acc.leads + (r.leads || 0),
    lav: acc.lav + (r.lav || 0),
    ganhos: acc.ganhos + (r.ganhos || 0),
  }), emptyTotals())
  const channelTotalsLavPct    = channelTotals.leads > 0 ? Math.round((channelTotals.lav / channelTotals.leads) * 100) : 0
  const channelTotalsGanhosPct = channelTotals.lav   > 0 ? Math.round((channelTotals.ganhos / channelTotals.lav) * 100) : 0

  const byPerfil = resolveSegData(data, selectedState, 'perfil')
  const byTipo   = resolveSegData(data, selectedState, 'tipo')

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
  const perfilTotal = perfilData.reduce((a, d) => a + d.value, 0)
  const tipoTotal   = tipoData.reduce((a, d) => a + d.value, 0)

  const btnToggle = (active) => ({
    padding: '2px 8px', borderRadius: 5, border: `0.5px solid ${active ? '#0afc33' : 'var(--border)'}`, cursor: 'pointer',
    fontSize: 10, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
    background: active ? '#0afc33' : 'transparent',
    color: active ? '#0d3b1f' : 'var(--muted)',
    transition: 'all 0.15s',
  })

  const chartData = buildChartData(data, selectedState, dailyView)
  const isSingle  = chartData.length === 1

  const monthlyByState = buildMonthlyStateData(yearData)
  const stateData = STATES_DISPLAY.map(s => {
    const months = monthlyByState[s.key] || []
    const yearLeads = months.reduce((a, m) => a + m.leads, 0)
    return { ...s, monthlyData: months, yearLeads }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 1.3fr 1.3fr', gap: 10, height: 175 }}>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>Leads</span>
            <span style={{ fontSize: 16 }}>🎯</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{NUM(totals.leads)}</div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 10, color: 'var(--hint)' }}>Leads orgânicos no período</div>
          </div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>LAV</span>
            <span style={{ fontSize: 16 }}>✅</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{NUM(totals.lav)}</div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{lavPct}% sobre leads</div>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(lavPct, 100)}%`, background: 'var(--muted)', borderRadius: 2 }} />
            </div>
          </div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>Ganhos</span>
            <span style={{ fontSize: 16 }}>🏆</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{NUM(totals.ganhos)}</div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{ganhosPct}% sobre LAV</div>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(ganhosPct, 100)}%`, background: 'var(--green)', borderRadius: 2 }} />
            </div>
          </div>
        </div>

        {/* Perfil */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>Perfil</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <MiniDonut data={perfilData} colors={segColors} size={72} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflowY: 'auto' }}>
              {perfilData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: segColors[i % segColors.length], flexShrink: 0 }} />
                  <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{perfilTotal > 0 ? Math.round((d.value / perfilTotal) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tipo */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600 }}>Tipo</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <MiniDonut data={tipoData} colors={segColors} size={72} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflowY: 'auto' }}>
              {tipoData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: segColors[i % segColors.length], flexShrink: 0 }} />
                  <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{tipoTotal > 0 ? Math.round((d.value / tipoTotal) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico diário — por Canal */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>
              Leads por {dailyView === 'mes' ? 'mês' : 'dia'} — por Canal
            </p>
            <p style={{ fontSize: 11, color: 'var(--hint)' }}>{periodLabel}</p>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => setDailyView('dia')} style={btnToggle(dailyView === 'dia')}>Dias</button>
            <button onClick={() => setDailyView('mes')} style={btnToggle(dailyView === 'mes')}>Mês</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap={isSingle ? '60%' : '25%'}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--hint)' }} axisLine={false} tickLine={false} interval={dailyView === 'mes' ? 0 : (chartData.length > 20 ? 1 : 0)} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--hint)' }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--surface)' }}
              formatter={(value, name) => name === '_labelAnchor' ? null : [value + ' leads', name]}
            />
            <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
            {CHANNELS.map((c, i) => (
              <Bar key={c} dataKey={c} stackId="a" fill={CHANNEL_COLORS[c]} radius={i === CHANNELS.length - 1 ? [3,3,0,0] : [0,0,0,0]} />
            ))}
            {/* Fatia mínima e invisível empilhada no topo real da barra (mesmo
                stackId), só pra ancorar o label do total no lugar certo — evita
                tanto o bug do Recharts de não renderizar quando o último canal
                é 0 quanto o desalinhamento de uma barra fora da pilha */}
            <Bar dataKey="_labelAnchor" stackId="a" fill="transparent" legendType="none" isAnimationActive={false} minPointSize={1}>
              <LabelList dataKey="_labelAnchor" content={(props) => <TotalLabel {...props} chartData={chartData} />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Canais Orgânicos */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Canais Orgânicos</p>
          <span style={{ fontSize: 11, color: 'var(--hint)' }}>{periodLabel}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Canal','Leads','LAV','% LAV / Leads','Ganhos','% Ganhos / LAV'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channelRows.map((row, i) => {
                const lavPctRow = row.leads > 0 ? Math.round(((row.lav || 0) / row.leads) * 100) : 0
                const ganhosPct = (row.lav || 0) > 0 ? Math.round(((row.ganhos || 0) / row.lav) * 100) : 0
                return (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                        {row.name}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{NUM(row.leads)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{NUM(row.lav || 0)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>{lavPctRow}%</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{NUM(row.ganhos || 0)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>{ganhosPct}%</td>
                  </tr>
                )
              })}
              {channelRows.length > 0 && (
                <tr style={{ background: 'var(--bg)' }}>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>Total</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>{NUM(channelTotals.leads)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>{NUM(channelTotals.lav)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--green)' }}>{channelTotalsLavPct}%</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>{NUM(channelTotals.ganhos)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--green)' }}>{channelTotalsGanhosPct}%</td>
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
            <div key={s.key} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.label}</span>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>Leads (ano)</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{NUM(s.yearLeads)}</p>
                </div>
                <MonthlyBars monthlyData={s.monthlyData} color={s.color} />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
