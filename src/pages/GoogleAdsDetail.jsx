import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'

const card = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  padding: '18px 20px',
}

const BRL = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
const NUM = (v) => (v ?? 0).toLocaleString('pt-BR')
const PCT = (v) => `${(v ?? 0).toFixed(2)}%`
const QS = (v) => (v === null || v === undefined ? '—' : v)

const MATCH_TYPE_LABELS = {
  EXACT: 'Exata',
  PHRASE: 'Frase',
  BROAD: 'Ampla',
}

// Colunas compartilhadas pelas visões de Anúncio e Palavra-chave (hierárquicas)
const BASE_COLS = [
  { key: 'impressions', label: 'Impr.', fmt: NUM, width: 85 },
  { key: 'clicks', label: 'Cliques', fmt: NUM, width: 75 },
  { key: 'ctr', label: 'CTR', fmt: PCT, width: 65 },
  { key: 'cpc', label: 'CPC', fmt: BRL, width: 85 },
  { key: 'spend', label: 'Gasto', fmt: BRL, width: 95, accent: true },
  { key: 'leads', label: 'Leads', fmt: NUM, width: 65 },
  { key: 'lav', label: 'LAV', fmt: NUM, width: 60 },
  { key: 'cpl', label: 'CPL', fmt: BRL, width: 85 },
  { key: 'cplav', label: 'CPLAV', fmt: BRL, width: 85 },
]

// Colunas extras da visão de Palavra-chave (inseridas antes das métricas)
const KEYWORD_EXTRA_COLS = [
  { key: 'matchType', label: 'Correspond.', fmt: (v) => MATCH_TYPE_LABELS[v] || v || '—', width: 90 },
  { key: 'qualityScore', label: 'Índice Qualid.', fmt: QS, width: 90 },
]

// Colunas da tabela plana de Termos de Busca
const TERM_COLS = [
  { key: 'campaign', label: 'Campanha', fmt: (v) => v || '—', width: 170, sortable: true },
  { key: 'adGroup', label: 'Grupo de Anúncios', fmt: (v) => v || '—', width: 160, sortable: true },
  { key: 'impressions', label: 'Impr.', fmt: NUM, width: 80, sortable: true },
  { key: 'clicks', label: 'Cliques', fmt: NUM, width: 75, sortable: true },
  { key: 'ctr', label: 'CTR', fmt: PCT, width: 65, sortable: true },
  { key: 'cpc', label: 'CPC', fmt: BRL, width: 85, sortable: true },
  { key: 'spend', label: 'Gasto', fmt: BRL, width: 95, sortable: true, accent: true },
  { key: 'leads', label: 'Leads', fmt: NUM, width: 65, sortable: true },
  { key: 'cpl', label: 'CPL', fmt: BRL, width: 85, sortable: true },
]

function fmtDay(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

// Agrega o `daily` de todas as campanhas filtradas em uma única série por
// dia (soma de impressões/cliques/gasto/leads), recalculando CTR e CPL sobre
// o agregado. Sempre cobre os últimos 15 dias (vem assim do backend).
// OBS: o backend do Google Ads só traz `daily` no nível de campanha (não por
// anúncio/keyword ainda), então os gráficos aqui são sempre o agregado —
// diferente do Meta, não há "foco" por anúncio individual por enquanto.
function buildAggregatedSeries(campaigns) {
  const byDate = {}
  campaigns.forEach(c => (c.daily || []).forEach(d => {
    if (!byDate[d.date]) byDate[d.date] = { date: d.date, impressions: 0, clicks: 0, spend: 0, leads: 0 }
    byDate[d.date].impressions += d.impressions
    byDate[d.date].clicks += d.clicks
    byDate[d.date].spend += d.spend
    byDate[d.date].leads += d.leads
  }))
  return Object.keys(byDate).sort().map(date => {
    const e = byDate[date]
    return {
      date: fmtDay(date),
      impressions: e.impressions,
      leads: e.leads,
      ctr: e.impressions > 0 ? (e.clicks / e.impressions) * 100 : 0,
      cpl: e.leads > 0 ? e.spend / e.leads : 0,
    }
  })
}

function PointLabel({ x, y, value, fmt }) {
  if (value === undefined || value === null) return null
  return (
    <text x={x} y={y - 10} textAnchor="middle" fill="var(--muted)" fontSize={9} fontWeight={600}>
      {fmt(value)}
    </text>
  )
}

function ComboChart({ title, data, barKey, barLabel, barFmt, lineKey, lineFmt }) {
  return (
    <div style={card}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--hint)' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--hint)' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--hint)' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--surface)' }}
            formatter={(value, _name, entry) => entry.dataKey === barKey ? [barFmt(value), barLabel] : [lineFmt(value), lineKey.toUpperCase()]}
          />
          <Bar yAxisId="left" dataKey={barKey} fill="#0afc33" radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey={lineKey} stroke="#1A6FE8" strokeWidth={2} dot={{ r: 3 }}>
            <LabelList dataKey={lineKey} content={(props) => <PointLabel {...props} fmt={lineFmt} />} />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0afc33', flexShrink: 0 }} />
          {barLabel} (esq.)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1A6FE8', flexShrink: 0 }} />
          {lineKey.toUpperCase()} (dir.)
        </div>
      </div>
    </div>
  )
}

const VIEW_TABS = [
  { key: 'ads', label: 'Por Anúncio' },
  { key: 'keywords', label: 'Por Palavra-chave' },
  { key: 'terms', label: 'Termos de Busca' },
]

function ViewToggle({ view, onChange }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bg)', padding: 4, borderRadius: 10, border: '0.5px solid var(--border)' }}>
      {VIEW_TABS.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            padding: '7px 14px', borderRadius: 7, border: 'none',
            background: view === t.key ? '#0afc33' : 'transparent',
            color: view === t.key ? '#0d3b1f' : 'var(--muted)',
            transition: 'all 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// Painel de revisão do cruzamento com HubSpot: leads sem gad_campaignid na
// URL (não deu pra saber nem a campanha) e utm_medium que não bateu com
// nenhum grupo de anúncios (ex: cliques em sitelink, que não têm grupo).
function CrossRefReview({ crossRef }) {
  const [open, setOpen] = useState(false)
  if (!crossRef) return null
  const { formLeadsTotal = 0, waLeadsTotal = 0, unmatchedUrls = [], unmatchedAdGroupLeads = [] } = crossRef
  const totalIssues = unmatchedUrls.length + unmatchedAdGroupLeads.length

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
          🔗 Cruzamento com HubSpot — {NUM(formLeadsTotal)} formulário + {NUM(waLeadsTotal)} WhatsApp
          {totalIssues > 0 && <span style={{ color: '#ff9f0a', fontWeight: 700 }}> · {totalIssues} para revisar</span>}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{open ? '▾ ocultar' : '▸ ver detalhes'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {unmatchedAdGroupLeads.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                utm_medium sem grupo de anúncios correspondente ({unmatchedAdGroupLeads.length})
              </p>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--hint)', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px', fontWeight: 600 }}>Campanha</th>
                    <th style={{ padding: '4px 8px', fontWeight: 600 }}>utm_medium</th>
                    <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedAdGroupLeads.map((u, i) => (
                    <tr key={i} style={{ borderTop: '0.5px solid var(--border)' }}>
                      <td style={{ padding: '4px 8px', color: 'var(--text)' }}>{u.campanha}</td>
                      <td style={{ padding: '4px 8px', color: 'var(--muted)' }}>{u.utm_medium}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--text)', fontWeight: 600 }}>{u.leads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {unmatchedUrls.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                Leads sem gad_campaignid na URL ({unmatchedUrls.length}) — não entraram em nenhuma campanha
              </p>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {unmatchedUrls.map((u, i) => (
                  <div key={i} style={{ fontSize: 10, color: 'var(--muted)', padding: '4px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{u.email}</span> — {u.url || '(sem URL)'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function matchesSearch(row, term, extraFields = []) {
  if (!term) return true
  if (row.name && row.name.toLowerCase().includes(term)) return true
  return extraFields.some(f => (row[f] || '').toLowerCase().includes(term))
}

// Mantém uma campanha/grupo se ele ou algum descendente casa com a busca.
// `childKey` é 'ads' ou 'keywords' dependendo da visão.
function filterTree(campaigns, term, childKey) {
  if (!term) return campaigns
  return campaigns
    .map(c => {
      const adGroups = (c.adGroups || [])
        .map(ag => {
          const children = (ag[childKey] || []).filter(x => matchesSearch(x, term, childKey === 'ads' ? ['headlines'] : []))
          if (children.length || matchesSearch(ag, term)) return { ...ag, [childKey]: children.length ? children : ag[childKey] }
          return null
        })
        .filter(Boolean)
      if (adGroups.length || matchesSearch(c, term)) return { ...c, adGroups: adGroups.length ? adGroups : c.adGroups }
      return null
    })
    .filter(Boolean)
}

function HierRow({ row, level, hasChildren, expanded, onToggle, cols, showHeadlines }) {
  const indent = level * 22
  const bg = level === 0 ? 'rgba(10,252,51,0.06)' : 'transparent'
  const weight = level === 0 ? 700 : level === 1 ? 600 : 400

  return (
    <tr style={{ background: bg, borderBottom: '0.5px solid var(--border)' }}>
      <td style={{ padding: '8px 10px', paddingLeft: 10 + indent, fontWeight: weight, color: 'var(--text)', verticalAlign: 'top' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
          {hasChildren ? (
            <button
              onClick={onToggle}
              aria-label={expanded ? 'Recolher' : 'Expandir'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2,
                color: 'var(--muted)', fontSize: 11, width: 14, flexShrink: 0,
                transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s',
              }}
            >
              ▾
            </button>
          ) : (
            <span style={{ width: 14, flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <span style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>{row.name}</span>
            {showHeadlines && row.headlines && row.headlines.length > 1 && (
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--hint)', lineHeight: 1.5 }}>
                {row.headlines.slice(1, 5).map((h, i) => <div key={i}>· {h}</div>)}
                {row.headlines.length > 5 && <div>+ {row.headlines.length - 5} headlines</div>}
              </div>
            )}
          </div>
        </div>
      </td>
      {cols.map(c => (
        <td key={c.key} style={{ padding: '8px 10px', textAlign: 'center', color: c.accent ? 'var(--green)' : 'var(--text)', fontWeight: c.accent ? 600 : 400, verticalAlign: 'top' }}>
          {c.fmt(row[c.key])}
          {c.key === 'leads' && row.googleConversions !== undefined && row.googleConversions !== row.leads && (
            <div style={{ fontSize: 9, color: 'var(--hint)', fontWeight: 400 }}>Google: {NUM(row.googleConversions)}</div>
          )}
        </td>
      ))}
    </tr>
  )
}

function HierTable({ campaigns, childKey, cols, title, periodLabel, showHeadlines }) {
  const [search, setSearch] = useState('')
  const [expandedCampaigns, setExpandedCampaigns] = useState({})
  const [expandedGroups, setExpandedGroups] = useState({})

  const filtered = useMemo(() => filterTree(campaigns, search.trim().toLowerCase(), childKey), [campaigns, search, childKey])

  const toggleCampaign = (id) => setExpandedCampaigns(s => ({ ...s, [id]: !s[id] }))
  const toggleGroup = (id) => setExpandedGroups(s => ({ ...s, [id]: !s[id] }))

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</p>
          <p style={{ fontSize: 11, color: 'var(--hint)' }}>{periodLabel}</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar campanha, grupo ou item"
          style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: 12, padding: '6px 12px',
            borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--bg)',
            color: 'var(--text)', width: 260,
          }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 300 }} />
            {cols.map(c => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', borderBottom: '0.5px solid var(--border)' }}>Nome</th>
              {cols.map(c => (
                <th key={c.key} style={{ padding: '10px', textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', borderBottom: '0.5px solid var(--border)' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const cExpanded = expandedCampaigns[c.id] !== false
              return (
                <Fragment key={c.id}>
                  <HierRow row={c} level={0} hasChildren onToggle={() => toggleCampaign(c.id)} expanded={cExpanded} cols={cols} />
                  {cExpanded && (c.adGroups || []).map(ag => {
                    const agExpanded = expandedGroups[ag.id] !== false
                    const children = ag[childKey] || []
                    return (
                      <Fragment key={ag.id}>
                        <HierRow row={ag} level={1} hasChildren onToggle={() => toggleGroup(ag.id)} expanded={agExpanded} cols={cols} />
                        {agExpanded && children.map(item => (
                          <HierRow key={item.id} row={item} level={2} hasChildren={false} onToggle={() => {}} expanded={false} cols={cols} showHeadlines={showHeadlines} />
                        ))}
                      </Fragment>
                    )
                  })}
                </Fragment>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={cols.length + 1} style={{ padding: '32px', textAlign: 'center', color: 'var(--hint)', fontSize: 12 }}>
                  Nenhum resultado para esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TermsTable({ searchTerms, periodLabel }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('spend')
  const [sortDir, setSortDir] = useState('desc')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    let rows = !term
      ? searchTerms
      : searchTerms.filter(t =>
        (t.term || '').toLowerCase().includes(term) ||
        (t.campaign || '').toLowerCase().includes(term) ||
        (t.adGroup || '').toLowerCase().includes(term)
      )
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [searchTerms, search, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const avgCpl = useMemo(() => {
    const withLeads = searchTerms.filter(t => t.leads > 0)
    if (!withLeads.length) return 0
    return withLeads.reduce((a, t) => a + t.cpl, 0) / withLeads.length
  }, [searchTerms])

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Termos de busca — Google Ads</p>
          <p style={{ fontSize: 11, color: 'var(--hint)' }}>{periodLabel} · {filtered.length} termos · sem hierarquia, ordenável por coluna</p>
          <p style={{ fontSize: 10, color: '#ff9f0a', marginTop: 2 }}>⚠ Cruzamento parcial: o rastreio identifica a keyword clicada, não necessariamente o termo de busca literal — nem todo termo terá lead atribuído mesmo tendo convertido</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar termo, campanha ou grupo"
          style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: 12, padding: '6px 12px',
            borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--bg)',
            color: 'var(--text)', width: 260,
          }}
        />
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 560, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 220 }} />
            {TERM_COLS.map(c => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th
                onClick={() => toggleSort('term')}
                style={{ padding: '10px', textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', position: 'sticky', top: 0, background: 'var(--bg)' }}
              >
                Termo {sortKey === 'term' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              {TERM_COLS.map(c => (
                <th
                  key={c.key}
                  onClick={() => c.sortable && toggleSort(c.key)}
                  style={{
                    padding: '10px', textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--muted)', borderBottom: '0.5px solid var(--border)',
                    cursor: c.sortable ? 'pointer' : 'default', position: 'sticky', top: 0, background: 'var(--bg)',
                  }}
                >
                  {c.label} {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => {
              const isWaste = t.leads === 0 && t.spend > 30
              const isExpensive = t.leads > 0 && avgCpl > 0 && t.cpl > avgCpl * 1.8
              const highlight = isWaste || isExpensive
              return (
                <tr
                  key={t.term + i}
                  style={{
                    borderBottom: '0.5px solid var(--border)',
                    background: isWaste ? 'rgba(220,53,69,0.07)' : isExpensive ? 'rgba(255,159,10,0.08)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text)' }}>
                    {t.term}
                    {highlight && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: isWaste ? '#dc3545' : '#ff9f0a' }}>
                        {isWaste ? '⚠ sem lead' : '⚠ CPL alto'}
                      </span>
                    )}
                  </td>
                  {TERM_COLS.map(c => (
                    <td key={c.key} style={{ padding: '8px 10px', textAlign: 'center', color: c.accent ? 'var(--green)' : 'var(--text)', fontWeight: c.accent ? 600 : 400 }}>
                      {c.fmt(t[c.key])}
                      {c.key === 'leads' && t.googleConversions !== undefined && t.googleConversions !== t.leads && (
                        <div style={{ fontSize: 9, color: 'var(--hint)', fontWeight: 400 }}>Google: {NUM(t.googleConversions)}</div>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={TERM_COLS.length + 1} style={{ padding: '32px', textAlign: 'center', color: 'var(--hint)', fontSize: 12 }}>
                  Nenhum resultado para esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const SEARCH_TERMS_URL = 'https://n8n.gabriel.com.br/webhook/painel-midia-ads-detail-google-termos'

export function GoogleAdsDetail({ detailData, loading, selectedState, periodLabel, dateRange }) {
  const [view, setView] = useState('ads')

  // Termos de busca é buscado sob demanda (endpoint próprio, mais pesado) só
  // na primeira vez que essa visão é aberta, ou quando o período muda depois
  // disso. Evita carregar ~8 mil linhas toda vez que a página abre.
  const [searchTermsData, setSearchTermsData] = useState(null)
  const [searchTermsLoading, setSearchTermsLoading] = useState(false)
  const fetchedRangeRef = useRef(null)

  useEffect(() => {
    if (view !== 'terms' || !dateRange) return
    const rangeKey = dateRange.startDate + '|' + dateRange.endDate
    if (fetchedRangeRef.current === rangeKey) return
    fetchedRangeRef.current = rangeKey
    setSearchTermsLoading(true)
    const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate })
    fetch(`${SEARCH_TERMS_URL}?${params}`)
      .then(r => r.json())
      .then(json => setSearchTermsData(json.searchTerms || []))
      .catch(() => setSearchTermsData([]))
      .finally(() => setSearchTermsLoading(false))
  }, [view, dateRange])

  const adCampaigns = useMemo(() => {
    if (!detailData) return []
    const list = detailData.campaigns || []
    return selectedState === 'ALL' ? list : list.filter(c => c.state === selectedState)
  }, [detailData, selectedState])

  const keywordCampaigns = useMemo(() => {
    if (!detailData) return []
    const list = detailData.keywordCampaigns || []
    return selectedState === 'ALL' ? list : list.filter(c => c.state === selectedState)
  }, [detailData, selectedState])

  const searchTerms = useMemo(() => {
    const list = searchTermsData || []
    if (selectedState === 'ALL') return list
    // Termos de busca não carregam estado próprio; filtra por campanhas do estado selecionado.
    const stateNames = new Set(adCampaigns.map(c => c.name))
    return list.filter(t => stateNames.has(t.campaign))
  }, [searchTermsData, selectedState, adCampaigns])

  // KPIs e gráficos sempre a partir da hierarquia de anúncios (visão macro,
  // igual pro Meta): soma de todas as campanhas Google Ads no período/estado.
  const totals = useMemo(() => {
    const sum = (field) => adCampaigns.reduce((a, c) => a + (c[field] || 0), 0)
    const impressions = sum('impressions'), clicks = sum('clicks'), spend = sum('spend'), leads = sum('leads'), lav = sum('lav')
    return {
      impressions, clicks, spend, leads, lav,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpl: leads > 0 ? spend / leads : 0,
      cplav: lav > 0 ? spend / lav : 0,
    }
  }, [adCampaigns])

  const trendData = useMemo(() => buildAggregatedSeries(adCampaigns), [adCampaigns])

  const kpis = [
    { label: 'Gasto', value: 'R$ ' + NUM(Math.round(totals.spend)) },
    { label: 'Impressões', value: NUM(totals.impressions) },
    { label: 'Cliques', value: NUM(totals.clicks) },
    { label: 'CTR', value: PCT(totals.ctr) },
    { label: 'Leads', value: NUM(totals.leads) },
    { label: 'LAV', value: NUM(totals.lav) },
    { label: 'CPL', value: BRL(totals.cpl) },
    { label: 'CPLAV', value: BRL(totals.cplav) },
  ]

  if (loading && !detailData) {
    return <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--hint)', fontSize: 13 }}>Buscando detalhamento do Google Ads…</div>
  }

  const keywordCols = [KEYWORD_EXTRA_COLS[0], KEYWORD_EXTRA_COLS[1], ...BASE_COLS]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, padding: '12px 14px' }}>
            <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Gráficos de tendência (últimos 15 dias, sempre agregado — sem foco por item) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ComboChart title="Leads x CPL — últimos 15 dias" data={trendData} barKey="leads" barLabel="Leads" barFmt={NUM} lineKey="cpl" lineFmt={BRL} />
        <ComboChart title="Impressões x CTR — últimos 15 dias" data={trendData} barKey="impressions" barLabel="Impressões" barFmt={NUM} lineKey="ctr" lineFmt={PCT} />
      </div>

      {/* Toggle de visão */}
      <ViewToggle view={view} onChange={setView} />

      {/* Cruzamento com HubSpot: leads reais (formulário + WhatsApp) e revisão de não-cruzados */}
      <CrossRefReview crossRef={detailData?.hubspotCrossRef} />

      {view === 'ads' && (
        <HierTable
          campaigns={adCampaigns}
          childKey="ads"
          cols={BASE_COLS}
          title="Detalhamento de anúncios — Google Ads"
          periodLabel={periodLabel}
          showHeadlines
        />
      )}

      {view === 'keywords' && (
        <HierTable
          campaigns={keywordCampaigns}
          childKey="keywords"
          cols={keywordCols}
          title="Detalhamento de palavras-chave — Google Ads"
          periodLabel={periodLabel}
        />
      )}

      {view === 'terms' && (
        searchTermsLoading && !searchTermsData ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--hint)', fontSize: 13 }}>Buscando termos de busca (pode levar alguns segundos)…</div>
        ) : (
          <TermsTable searchTerms={searchTerms} periodLabel={periodLabel} />
        )
      )}
    </div>
  )
}
