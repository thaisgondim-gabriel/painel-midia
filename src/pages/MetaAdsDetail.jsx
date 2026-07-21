import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { getCampaignState } from '../hooks/useData.js'

const card = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  padding: '18px 20px',
}

const BRL = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
const NUM = (v) => (v ?? 0).toLocaleString('pt-BR')
const PCT = (v) => `${(v ?? 0).toFixed(2)}%`

const COLS = [
  { key: 'impressions', label: 'Impr.', fmt: NUM, width: 90 },
  { key: 'clicks', label: 'Cliques', fmt: NUM, width: 80 },
  { key: 'ctr', label: 'CTR', fmt: PCT, width: 70 },
  { key: 'cpc', label: 'CPC', fmt: BRL, width: 90 },
  { key: 'spend', label: 'Gasto', fmt: BRL, width: 100, accent: true },
  { key: 'leads', label: 'Leads', fmt: NUM, width: 70 },
  { key: 'lav', label: 'LAV', fmt: NUM, width: 70 },
  { key: 'lavPct', label: 'LAV %', fmt: PCT, width: 75 },
  { key: 'cpl', label: 'CPL', fmt: BRL, width: 90 },
  { key: 'cplav', label: 'CPLAV', fmt: BRL, width: 90 },
]

const COLS_BY_KEY = Object.fromEntries(COLS.map(c => [c.key, c]))

// As 4 métricas que ficam sempre visíveis no card do anúncio; o resto só
// aparece quando o card é expandido (clique em "Mostrar tudo").
const CARD_PRIMARY_KEYS = ['spend', 'leads', 'cpl', 'ctr']
// lavPct fica de fora daqui de propósito: ela é mostrada embutida ao lado
// do valor de LAV (ver MetricCell), não como uma célula própria no grid.
const CARD_EXTRA_KEYS = COLS.map(c => c.key).filter(k => !CARD_PRIMARY_KEYS.includes(k) && k !== 'lavPct')

function fmtDay(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

// Agrega o `daily` de todas as campanhas filtradas em uma única série por
// dia (soma de impressões/cliques/gasto/leads), recalculando CTR e CPL sobre
// o agregado. Sempre cobre os últimos 15 dias (vem assim do backend).
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

// Valor da linha (eixo direito) escrito acima do ponto, mesmo padrão do CPL
// já usado na Visão Geral.
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

// Medidas nativas do preview_iframe.php (formato INSTAGRAM_STANDARD).
// O card inteiro (cabeçalho + imagem/vídeo + texto + botões) tem ~320px de
// largura nativa. A altura do conteúdo varia por anúncio (foto x vídeo x
// carrossel, legendas mais longas etc.) — IFRAME_NATIVE_HEIGHT é a altura
// "típica" usada pra escalar o preview em si.
// THUMB_WIDTH/THUMB_HEIGHT definem a proporção (retrato, ~220:450) do box
// da miniatura; como agora o card de anúncio é responsivo (grid de 4
// colunas), a largura real é medida via ResizeObserver e a escala do
// iframe é recalculada a partir dela — ver useCardWidth/Thumb abaixo.
const PREVIEW_CARD_WIDTH = 320
const IFRAME_NATIVE_HEIGHT = 620
const THUMB_WIDTH = 220
const THUMB_HEIGHT = 450
const THUMB_ASPECT = THUMB_HEIGHT / THUMB_WIDTH

// Mede a largura real (em px) do elemento pra escalar o preview do
// iframe proporcionalmente — necessário porque a largura do card agora
// depende do grid responsivo, não é mais um valor fixo.
function useMeasuredWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.offsetWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

function Thumb({ url, previewSrc }) {
  const [wrapRef, width] = useMeasuredWidth()
  const boxWidth = width || THUMB_WIDTH
  const boxHeight = boxWidth * THUMB_ASPECT
  const scale = boxWidth / PREVIEW_CARD_WIDTH

  if (previewSrc) {
    return (
      <div
        ref={wrapRef}
        style={{
          width: '100%', height: boxHeight, borderRadius: '12px 12px 0 0', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)',
        }}
      >
        {width > 0 && (
          <iframe
            src={previewSrc}
            title="Preview do anúncio"
            scrolling="no"
            sandbox="allow-scripts allow-same-origin"
            style={{
              flexShrink: 0,
              width: PREVIEW_CARD_WIDTH,
              height: IFRAME_NATIVE_HEIGHT,
              border: 'none',
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    )
  }
  if (url) {
    return (
      <div ref={wrapRef} style={{ width: '100%', height: boxHeight, borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%', height: boxHeight, borderRadius: '12px 12px 0 0', background: 'var(--bg)',
        border: '0.5px solid var(--border)', borderBottom: 'none', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 32, color: 'var(--hint)',
      }}
    >
      🖼
    </div>
  )
}

// Linha de tabela colapsável, usada só pra campanha (nível 0) e conjunto
// (nível 1). Anúncios não usam mais Row — viram cards no grid (ver AdCard).
function Row({ row, level, hasChildren, expanded, onToggle }) {
  const indent = level * 22
  const bg = level === 0 ? 'rgba(10,252,51,0.06)' : 'transparent'
  const weight = level === 0 ? 700 : 600

  return (
    <tr style={{ background: bg, borderBottom: '0.5px solid var(--border)' }}>
      <td style={{ padding: '8px 10px', paddingLeft: 10 + indent, fontWeight: weight, color: 'var(--text)', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {hasChildren ? (
            <button
              onClick={onToggle}
              aria-label={expanded ? 'Recolher' : 'Expandir'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: 'var(--muted)', fontSize: 11, width: 14, flexShrink: 0,
                transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s',
              }}
            >
              ▾
            </button>
          ) : (
            <span style={{ width: 14, flexShrink: 0 }} />
          )}
          <span style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>{row.name}</span>
        </div>
      </td>
      {COLS.map(c => (
        <td key={c.key} style={{ padding: '8px 10px', textAlign: 'center', color: c.accent ? 'var(--green)' : 'var(--text)', fontWeight: c.accent ? 600 : 400, verticalAlign: 'middle' }}>
          {c.fmt(row[c.key])}
        </td>
      ))}
    </tr>
  )
}

// Comparação de tendência: últimos 7 dias vs 7 dias anteriores (dentro dos
// 15 dias de `daily` disponíveis por anúncio). Só nos KPIs de entrega —
// Gasto não leva seta.
const TREND_WINDOW = 7
const TREND_METRIC_KEYS = ['leads', 'cpl', 'ctr']

// CPL é a única métrica de custo entre as que mostram seta: quando ele cai,
// é uma melhora, então a seta boa (verde) aponta pra baixo.
const COST_METRIC_KEYS = ['cpl']

function sumWindow(daily, start, end) {
  return daily.slice(start, end).reduce((acc, d) => {
    acc.impressions += d.impressions || 0
    acc.clicks += d.clicks || 0
    acc.spend += d.spend || 0
    acc.leads += d.leads || 0
    return acc
  }, { impressions: 0, clicks: 0, spend: 0, leads: 0 })
}

// Deriva CTR/CPL a partir dos totais agregados de cada janela (mais
// correto do que fazer média das taxas diárias).
function deriveMetrics(sums) {
  return {
    leads: sums.leads,
    ctr: sums.impressions > 0 ? (sums.clicks / sums.impressions) * 100 : 0,
    cpl: sums.leads > 0 ? sums.spend / sums.leads : 0,
  }
}

// Retorna { [metricKey]: { direction: 'up' | 'down', diff } } comparando os
// últimos TREND_WINDOW dias com os TREND_WINDOW dias anteriores, só pra
// leads/cpl/ctr. `diff` é a diferença absoluta (não percentual): leads a
// mais/a menos, R$ a mais/a menos de CPL, pontos percentuais de CTR.
// Ausente quando não há 14 dias de histórico, os dois períodos são zero,
// ou a variação relativa é desprezível (<1%, só pra decidir se mostra a
// seta — o valor exibido continua sendo a diferença absoluta).
function computeTrends(daily) {
  if (!daily || daily.length < TREND_WINDOW * 2) return {}
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  const recent = deriveMetrics(sumWindow(sorted, sorted.length - TREND_WINDOW, sorted.length))
  const prior = deriveMetrics(sumWindow(sorted, sorted.length - TREND_WINDOW * 2, sorted.length - TREND_WINDOW))

  const trends = {}
  for (const key of TREND_METRIC_KEYS) {
    const cur = recent[key], prev = prior[key]
    if (prev === 0 && cur === 0) continue
    const relChange = prev === 0 ? 1 : (cur - prev) / prev
    if (Math.abs(relChange) < 0.01) continue
    trends[key] = { direction: cur > prev ? 'up' : 'down', diff: cur - prev }
  }
  return trends
}

// Formata a diferença absoluta de cada métrica no seu próprio padrão.
const DIFF_FMT = {
  leads: (d) => NUM(Math.round(Math.abs(d))),
  cpl: (d) => BRL(Math.abs(d)),
  ctr: (d) => `${Math.abs(d).toFixed(1)} p.p.`,
}

function TrendArrow({ trend, colKey, costMetric }) {
  if (!trend) return null
  const isGood = costMetric ? trend.direction === 'down' : trend.direction === 'up'
  const color = isGood ? '#159947' : '#ff4538'
  const arrow = trend.direction === 'up' ? '▲' : '▼'
  const sign = trend.diff > 0 ? '+' : '-'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 700, color, whiteSpace: 'nowrap' }}>
      {arrow} {sign}{DIFF_FMT[colKey](trend.diff)}
    </span>
  )
}

function MetricCell({ colKey, row, trend }) {
  const col = COLS_BY_KEY[colKey]
  const value = row[colKey]
  return (
    <div>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', fontWeight: 600 }}>{col.label}</span>
      <p style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontSize: 12, fontWeight: 600, color: col.accent ? 'var(--green)' : 'var(--text)', margin: '2px 0 0' }}>
        {col.fmt(value)}
        {colKey === 'lav' ? (
          // Percentual de LAV sobre o total de contatos (leads) do mesmo
          // recorte — embutido ao lado do número, no mesmo estilo visual
          // das setas de tendência das outras métricas.
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {PCT(row.lavPct)} dos leads
          </span>
        ) : (
          <TrendArrow trend={trend} colKey={colKey} costMetric={COST_METRIC_KEYS.includes(colKey)} />
        )}
      </p>
    </div>
  )
}

// Card de anúncio no grid: preview em cima, nome, 4 métricas principais
// sempre visíveis (Gasto/Leads/CPL/CTR) e o resto expandível por clique.
function AdCard({ ad, isFocused, onFocus, expanded, onToggleExpand }) {
  const trends = useMemo(() => computeTrends(ad.daily), [ad.daily])

  return (
    <div
      style={{
        border: isFocused ? '2px solid #1A6FE8' : '0.5px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Thumb url={ad.thumbnail_url} previewSrc={ad.preview_src} />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <p
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0, lineHeight: 1.3,
            ...(expanded ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
          }}
          title={ad.name}
        >
          {ad.name}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
          {CARD_PRIMARY_KEYS.map(k => <MetricCell key={k} colKey={k} row={ad} trend={trends[k]} />)}
        </div>

        {expanded && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', paddingTop: 8, borderTop: '0.5px solid var(--border)' }}>
            {CARD_EXTRA_KEYS.map(k => <MetricCell key={k} colKey={k} row={ad} trend={trends[k]} />)}
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
          <button
            onClick={onToggleExpand}
            style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 10, cursor: 'pointer', padding: 0,
              border: 'none', background: 'none', color: 'var(--hint)', textDecoration: 'underline',
            }}
          >
            {expanded ? 'Mostrar menos' : 'Mostrar tudo'}
          </button>
          <button
            onClick={onFocus}
            style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: 600, cursor: 'pointer',
              padding: '3px 8px', borderRadius: 5,
              border: `0.5px solid ${isFocused ? '#1A6FE8' : 'var(--border)'}`,
              background: isFocused ? '#1A6FE8' : 'transparent',
              color: isFocused ? '#fff' : 'var(--muted)',
            }}
          >
            {isFocused ? '✓ Nos gráficos' : 'Ver nos gráficos'}
          </button>
        </div>
      </div>
    </div>
  )
}

// LAV como percentual dos leads do mesmo recorte (campanha, conjunto ou
// anúncio) — usado tanto na coluna nova da tabela quanto no badge embutido
// no card. Cada nível já traz `lav`/`leads` agregados vindos do backend.
function addLavPct(row) {
  return { ...row, lavPct: row.leads > 0 ? ((row.lav || 0) / row.leads) * 100 : 0 }
}

function matchesSearch(row, term) {
  if (!term) return true
  return row.name.toLowerCase().includes(term)
}

// Mantém uma campanha/conjunto se ele ou algum descendente casa com a busca.
function filterTree(campaigns, term) {
  if (!term) return campaigns
  return campaigns
    .map(c => {
      const adsets = c.adsets
        .map(as => {
          const ads = as.ads.filter(ad => matchesSearch(ad, term))
          if (ads.length || matchesSearch(as, term)) return { ...as, ads: ads.length ? ads : as.ads }
          return null
        })
        .filter(Boolean)
      if (adsets.length || matchesSearch(c, term)) return { ...c, adsets: adsets.length ? adsets : c.adsets }
      return null
    })
    .filter(Boolean)
}

export function MetaAdsDetail({ detailData, loading, selectedState, periodLabel }) {
  const [search, setSearch] = useState('')
  const [expandedCampaigns, setExpandedCampaigns] = useState({})
  const [expandedAdsets, setExpandedAdsets] = useState({})
  const [expandedCards, setExpandedCards] = useState({})
  const [focusedAd, setFocusedAd] = useState(null) // { id, name } | null

  const campaigns = useMemo(() => {
    if (!detailData) return []
    const byState = selectedState === 'ALL'
      ? detailData.campaigns
      : detailData.campaigns.filter(c => (c.state || getCampaignState(c.name)) === selectedState)
    const filtered = filterTree(byState, search.trim().toLowerCase())
    // Campanhas e conjuntos ordenados por nome; cards de anúncio continuam
    // ordenados por leads (maior pra menor) dentro de cada conjunto.
    return filtered
      .map(c => addLavPct({
        ...c,
        adsets: [...c.adsets]
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          .map(as => addLavPct({
            ...as,
            ads: [...as.ads].sort((a, b) => (b.leads || 0) - (a.leads || 0)).map(addLavPct),
          })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [detailData, selectedState, search])

  const totals = useMemo(() => {
    const sum = (field) => campaigns.reduce((a, c) => a + (c[field] || 0), 0)
    const impressions = sum('impressions'), clicks = sum('clicks'), spend = sum('spend'), leads = sum('leads'), lav = sum('lav')
    return {
      impressions, clicks, spend, leads, lav,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpl: leads > 0 ? spend / leads : 0,
      cplav: lav > 0 ? spend / lav : 0,
    }
  }, [campaigns])

  const focusedAdDaily = useMemo(() => {
    if (!focusedAd) return null
    for (const c of campaigns) {
      for (const as of c.adsets) {
        const ad = as.ads.find(a => a.id === focusedAd.id)
        if (ad) return ad.daily || []
      }
    }
    return []
  }, [campaigns, focusedAd])

  const trendData = useMemo(
    () => focusedAd ? buildAggregatedSeries([{ daily: focusedAdDaily }]) : buildAggregatedSeries(campaigns),
    [campaigns, focusedAd, focusedAdDaily]
  )

  const toggleCampaign = (id) => setExpandedCampaigns(s => ({ ...s, [id]: !s[id] }))
  const toggleAdset = (id) => setExpandedAdsets(s => ({ ...s, [id]: !s[id] }))
  const toggleCardExpand = (id) => setExpandedCards(s => ({ ...s, [id]: !s[id] }))
  const toggleFocus = (ad) => setFocusedAd(f => (f && f.id === ad.id) ? null : { id: ad.id, name: ad.name })

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
    return <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--hint)', fontSize: 13 }}>Buscando detalhamento de anúncios…</div>
  }

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

      {/* Gráficos de tendência (últimos 15 dias, independente do filtro de período) */}
      {focusedAd && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
          <span>Gráficos mostrando: <strong style={{ color: 'var(--text)' }}>{focusedAd.name}</strong></span>
          <button
            onClick={() => setFocusedAd(null)}
            style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '2px 8px', borderRadius: 5, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--muted)' }}
          >
            ✕ Voltar ao agregado
          </button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ComboChart title={`Leads x CPL — últimos 15 dias${focusedAd ? ' (anúncio)' : ''}`} data={trendData} barKey="leads" barLabel="Leads" barFmt={NUM} lineKey="cpl" lineFmt={BRL} />
        <ComboChart title={`Impressões x CTR — últimos 15 dias${focusedAd ? ' (anúncio)' : ''}`} data={trendData} barKey="impressions" barLabel="Impressões" barFmt={NUM} lineKey="ctr" lineFmt={PCT} />
      </div>

      {/* Tabela hierárquica: campanha e conjunto ficam como linhas colapsáveis; anúncios viram um grid de cards */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Detalhamento de anúncios — Meta Ads</p>
            <p style={{ fontSize: 11, color: 'var(--hint)' }}>{periodLabel}</p>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar campanha, conjunto ou anúncio"
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
              <col style={{ width: 260 }} />
              {COLS.map(c => <col key={c.key} style={{ width: c.width }} />)}
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th style={{ padding: '10px', textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', borderBottom: '0.5px solid var(--border)' }}>Nome</th>
                {COLS.map(c => (
                  <th key={c.key} style={{ padding: '10px', textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', borderBottom: '0.5px solid var(--border)' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const cExpanded = expandedCampaigns[c.id] === true // fechado por padrão
                return (
                  <Fragment key={c.id}>
                    <Row row={c} level={0} hasChildren onToggle={() => toggleCampaign(c.id)} expanded={cExpanded} />
                    {cExpanded && c.adsets.map(as => {
                      const asExpanded = expandedAdsets[as.id] === true // fechado por padrão
                      return (
                        <Fragment key={as.id}>
                          <Row row={as} level={1} hasChildren onToggle={() => toggleAdset(as.id)} expanded={asExpanded} />
                          {asExpanded && (
                            <tr>
                              <td colSpan={COLS.length + 1} style={{ padding: '4px 20px 20px 52px', background: 'var(--bg)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                                  {as.ads.map(ad => (
                                    <AdCard
                                      key={ad.id}
                                      ad={ad}
                                      isFocused={focusedAd?.id === ad.id}
                                      onFocus={() => toggleFocus(ad)}
                                      expanded={!!expandedCards[ad.id]}
                                      onToggleExpand={() => toggleCardExpand(ad.id)}
                                    />
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </Fragment>
                )
              })}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={COLS.length + 1} style={{ padding: '32px', textAlign: 'center', color: 'var(--hint)', fontSize: 12 }}>
                    Nenhum resultado para esse filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
