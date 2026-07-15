import { useState, useMemo, Fragment } from 'react'
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
  { key: 'cpl', label: 'CPL', fmt: BRL, width: 90 },
  { key: 'cplav', label: 'CPLAV', fmt: BRL, width: 90 },
]

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
// carrossel, legendas mais longas etc.):
// - IFRAME_NATIVE_HEIGHT é a altura "típica" que usamos pra escalar o preview
//   em si — cobre a maioria dos casos sem sobrar espaço em branco visível.
// - BOX_NATIVE_HEIGHT é a altura da caixa (um pouco maior, com folga) onde
//   esse preview fica centralizado — conteúdos mais altos (vídeo/carrossel)
//   ficam com o excesso cortado igualmente em cima e embaixo, em vez de só
//   embaixo.
const PREVIEW_CARD_WIDTH = 320
const IFRAME_NATIVE_HEIGHT = 620
const THUMB_WIDTH = 220
const THUMB_HEIGHT = 450
const PREVIEW_SCALE = THUMB_WIDTH / PREVIEW_CARD_WIDTH

function Thumb({ url, previewSrc }) {
  if (previewSrc) {
    return (
      <div
        style={{
          width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: 12, overflow: 'hidden',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
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
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: 'center center',
            pointerEvents: 'none',
          }}
        />
      </div>
    )
  }
  if (url) {
    return <img src={url} alt="" style={{ width: THUMB_WIDTH, height: THUMB_WIDTH, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: THUMB_WIDTH, height: THUMB_WIDTH, borderRadius: 12, background: 'var(--bg)',
      border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0, fontSize: 32, color: 'var(--hint)',
    }}>
      🖼
    </div>
  )
}

function Row({ row, level, hasChildren, expanded, onToggle, showThumb, onFocus, isFocused }) {
  const indent = level * 22
  const bg = isFocused ? 'rgba(26,111,232,0.10)' : level === 0 ? 'rgba(10,252,51,0.06)' : 'transparent'
  const weight = level === 0 ? 700 : level === 1 ? 600 : 400

  return (
    <tr style={{ background: bg, borderBottom: '0.5px solid var(--border)' }}>
      <td style={{ padding: showThumb ? '12px 10px' : '8px 10px', paddingLeft: 10 + indent, fontWeight: weight, color: 'var(--text)', verticalAlign: 'middle' }}>
        {showThumb ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>{row.name}</span>
            <Thumb url={row.thumbnail_url} previewSrc={row.preview_src} />
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
        ) : (
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
        )}
      </td>
      {COLS.map(c => (
        <td key={c.key} style={{ padding: '8px 10px', textAlign: 'center', color: c.accent ? 'var(--green)' : 'var(--text)', fontWeight: c.accent ? 600 : 400, verticalAlign: 'middle' }}>
          {c.fmt(row[c.key])}
        </td>
      ))}
    </tr>
  )
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
  const [focusedAd, setFocusedAd] = useState(null) // { id, name } | null

  const campaigns = useMemo(() => {
    if (!detailData) return []
    const byState = selectedState === 'ALL'
      ? detailData.campaigns
      : detailData.campaigns.filter(c => (c.state || getCampaignState(c.name)) === selectedState)
    return filterTree(byState, search.trim().toLowerCase())
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

      {/* Tabela hierárquica */}
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
                const cExpanded = expandedCampaigns[c.id] !== false // expandido por padrão
                return (
                  <Fragment key={c.id}>
                    <Row row={c} level={0} hasChildren onToggle={() => toggleCampaign(c.id)} expanded={cExpanded} showThumb={false} />
                    {cExpanded && c.adsets.map(as => {
                      const asExpanded = expandedAdsets[as.id] !== false
                      return (
                        <Fragment key={as.id}>
                          <Row row={as} level={1} hasChildren onToggle={() => toggleAdset(as.id)} expanded={asExpanded} showThumb={false} />
                          {asExpanded && as.ads.map(ad => (
                            <Row key={ad.id} row={ad} level={2} hasChildren={false} onToggle={() => {}} expanded={false} showThumb onFocus={() => toggleFocus(ad)} isFocused={focusedAd?.id === ad.id} />
                          ))}
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
