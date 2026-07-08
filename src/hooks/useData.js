import { useState, useEffect, useCallback } from 'react'

const N8N_ENDPOINT = 'https://n8n.gabriel.com.br/webhook/painel-midia'

export const STATE_MAP = {
  SP: { label: 'São Paulo', abbr: 'SP' },
  RJ: { label: 'Rio de Janeiro', abbr: 'RJ' },
  BH: { label: 'Minas Gerais', abbr: 'MG' },
  ES: { label: 'Espírito Santo', abbr: 'ES' },
}

export function getCampaignState(name) {
  const upper = name.toUpperCase()
  if (!upper.includes('CRESCIMENTO')) return null
  if (upper.includes('SP')) return 'SP'
  if (upper.includes('RJ')) return 'RJ'
  if (upper.includes('BH')) return 'BH'
  if (upper.includes('ES')) return 'ES'
  return null
}

export function isCrescimento(name) {
  return name.toUpperCase().includes('CRESCIMENTO')
}

export const MONTHS = [
  { key: '2026-01', label: 'Jan' },
  { key: '2026-02', label: 'Fev' },
  { key: '2026-03', label: 'Mar' },
  { key: '2026-04', label: 'Abr' },
  { key: '2026-05', label: 'Mai' },
  { key: '2026-06', label: 'Jun' },
]

export const STATES = ['SP', 'RJ', 'BH', 'ES']

export function resolveMonths(selectorMode, selectedMonth, rangeStart, rangeEnd) {
  return [selectedMonth]
}

export function resolveDateRange(selectorMode, selectedMonth, rangeStart, rangeEnd) {
  const [y, m] = selectedMonth.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return {
    startDate: selectedMonth + '-01',
    endDate:   `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
  }
}

// Sempre retorna 01/01 do ano atual até hoje, em GMT-3, formato YYYY-MM-DD.
// Usado pelo useYearData — independente do período selecionado no topo do painel.
function resolveYearToDateRange() {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000) // GMT-3
  const year = now.getFullYear()
  const pad = (n) => String(n).padStart(2, '0')
  return {
    startDate: `${year}-01-01`,
    endDate:   `${year}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  }
}

const REFRESH_INTERVAL = 60 * 60 * 1000

export function useData(selectedMonths, dateRange) {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [lastFetch, setLastFetch] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const monthsKey = `${dateRange.startDate}|${dateRange.endDate}`

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const { startDate, endDate } = dateRange
        const params = new URLSearchParams({ startDate, endDate })
        const res = await fetch(`${N8N_ENDPOINT}?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) {
          setData(normalizeN8nData(json))
        }
      } catch (err) {
        console.warn('n8n indisponível:', err.message)
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLastFetch(new Date())
        }
      }
    }

    doFetch()
    const interval = setInterval(doFetch, REFRESH_INTERVAL)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [monthsKey, refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshTick(t => t + 1)
  }, [])

  return { data, loading, error, lastFetch, refresh }
}

// Busca independente do filtro de período do topo — sempre 01/01 até hoje.
// Alimenta gráficos que precisam do ano inteiro acumulado (ex: Performance
// Regional), mesmo quando o usuário filtra um mês/período específico nos KPIs.
export function useYearData(refreshTick = 0) {
  const [yearData, setYearData] = useState(null)
  const [yearLoading, setYearLoading] = useState(true)
  const [yearError, setYearError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      setYearLoading(true)
      setYearError(null)
      try {
        const { startDate, endDate } = resolveYearToDateRange()
        const params = new URLSearchParams({ startDate, endDate })
        const res = await fetch(`${N8N_ENDPOINT}?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) {
          setYearData(normalizeN8nData(json))
        }
      } catch (err) {
        console.warn('n8n indisponível (ano):', err.message)
        if (!cancelled) setYearError(err.message)
      } finally {
        if (!cancelled) setYearLoading(false)
      }
    }

    doFetch()
    const interval = setInterval(doFetch, REFRESH_INTERVAL)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

  return { yearData, yearLoading, yearError }
}

export function normalizeN8nData(raw) {
  if (!raw) return null

  const normCampaigns = (campaigns = []) =>
    campaigns
      .filter(c => isCrescimento(c.name))
      .map(c => ({
        ...c,
        lav:    c.lav    ?? 0,
        ganhos: c.ganhos ?? 0,
        state:  getCampaignState(c.name),
        cpl:    c.leads > 0 ? c.spend / c.leads : 0,
      }))

  const metaCamps = normCampaigns(raw.meta?.campaigns)
  const googCamps = normCampaigns(raw.google?.campaigns)

  const sumField = (camps, field) => camps.reduce((a, c) => a + (c[field] || 0), 0)

  return {
    ...raw,
    meta: {
      ...raw.meta,
      spend:       sumField(metaCamps, 'spend'),
      leads:       sumField(metaCamps, 'leads'),
      impressions: sumField(metaCamps, 'impressions'),
      clicks:      sumField(metaCamps, 'clicks'),
      lav:         sumField(metaCamps, 'lav'),
      ganhos:      sumField(metaCamps, 'ganhos'),
      cpl:         sumField(metaCamps, 'leads') > 0 ? sumField(metaCamps, 'spend') / sumField(metaCamps, 'leads') : 0,
      campaigns:   metaCamps,
      weekly:      raw.meta?.weekly ?? [0,0,0,0,0,0,0],
    },
    google: {
      ...raw.google,
      spend:       sumField(googCamps, 'spend'),
      leads:       sumField(googCamps, 'leads'),
      impressions: sumField(googCamps, 'impressions'),
      clicks:      sumField(googCamps, 'clicks'),
      lav:         sumField(googCamps, 'lav'),
      ganhos:      sumField(googCamps, 'ganhos'),
      cpl:         sumField(googCamps, 'leads') > 0 ? sumField(googCamps, 'spend') / sumField(googCamps, 'leads') : 0,
      campaigns:   googCamps,
      weekly:      raw.google?.weekly ?? [0,0,0,0,0,0,0],
    },
    hubspot: {
      ...raw.hubspot,
      perfil:      raw.hubspot?.perfil      ?? { sindico: 0, subsindico: 0, morador: 0 },
      tipo:        raw.hubspot?.tipo        ?? { condominio: 0, comercio: 0, casa: 0 },
      byState:     raw.hubspot?.byState     ?? { SP: { meta: 0, google: 0, total: 0 }, RJ: { meta: 0, google: 0, total: 0 }, BH: { meta: 0, google: 0, total: 0 } },
      metaLeads:   raw.hubspot?.metaLeads   ?? 0,
      googleLeads: raw.hubspot?.googleLeads ?? 0,
      recent:      raw.hubspot?.recent      ?? [],
    },
  }
}

// ---------------------------------------------------------------------------
// Detalhamento de anúncios (Meta Ads) — página de campanha > conjunto > anúncio
// ---------------------------------------------------------------------------
//
// Por enquanto usa dados mock, já no formato que a chamada real deve devolver
// (o token do Meta Ads está expirado desde 27/06 — ver notas do painel).
// Quando o token for renovado, troque o corpo de `useMetaAdsDetail` pela
// chamada real ao n8n, mantendo o mesmo formato de retorno:
//
//   { campaigns: [ { id, name, state, impressions, clicks, spend, leads, lav,
//       ctr, cpc, cpl, cplav, adsets: [ { ...mesmos campos, ads: [ { ...mesmos
//       campos, thumbnail_url } ] } ] } ] }
//
// No n8n, isso significa rodar o insights com level=ad (reaproveitando o node
// HTTP do "Relatório de Investimento - Meta + Google", só trocando o level),
// e uma segunda chamada em lote — GET /?ids=<ad_id1>,<ad_id2>,...&fields=
// creative{thumbnail_url} — pra trazer as miniaturas dos criativos, já que o
// endpoint de insights não devolve imagem.

const MOCK_AD_NAMES = [
  'Carrossel Fachada', 'Vídeo Depoimento', 'Estático Preço', 'Vídeo Tour Virtual',
  'Carrossel Unidades', 'Vídeo Marca', 'Estático Promoção', 'Reels Bastidores',
]

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function withRates(entry) {
  return {
    ...entry,
    ctr:   entry.impressions > 0 ? (entry.clicks / entry.impressions) * 100 : 0,
    cpc:   entry.clicks > 0 ? entry.spend / entry.clicks : 0,
    cpl:   entry.leads > 0 ? entry.spend / entry.leads : 0,
    cplav: entry.lav > 0 ? entry.spend / entry.lav : 0,
  }
}

function sumChildren(children, field) {
  return children.reduce((a, c) => a + (c[field] || 0), 0)
}

function buildMockAd(rnd, idx, parentKey) {
  const impressions = Math.round(20000 + rnd() * 100000)
  const clicks = Math.round(impressions * (0.012 + rnd() * 0.015))
  const spend = Math.round(clicks * (1.4 + rnd() * 1.2))
  const leads = Math.round(clicks * (0.015 + rnd() * 0.02))
  const lav = Math.round(leads * (0.35 + rnd() * 0.25))
  return withRates({
    id: `ad-${parentKey}-${idx}`,
    name: `Anúncio - ${MOCK_AD_NAMES[idx % MOCK_AD_NAMES.length]}`,
    thumbnail_url: null, // real: creative.thumbnail_url via Graph API
    impressions, clicks, spend, leads, lav,
  })
}

function buildMockAdset(rnd, idx, campaignKey) {
  const adsCount = 1 + Math.floor(rnd() * 2)
  const parentKey = `${campaignKey}-${idx}`
  const ads = Array.from({ length: adsCount }, (_, i) => buildMockAd(rnd, i, parentKey))
  return withRates({
    id: `as-${parentKey}`,
    name: idx === 0 ? 'Conjunto - Interesse Principal' : 'Conjunto - Lookalike / Retargeting',
    ads,
    impressions: sumChildren(ads, 'impressions'),
    clicks:      sumChildren(ads, 'clicks'),
    spend:       sumChildren(ads, 'spend'),
    leads:       sumChildren(ads, 'leads'),
    lav:         sumChildren(ads, 'lav'),
  })
}

function buildMockCampaign(rnd, state, idx) {
  const name = `CRESCIMENTO ${state} - Campanha ${idx + 1}`
  const adsetsCount = 1 + Math.floor(rnd() * 2)
  const adsets = Array.from({ length: adsetsCount }, (_, i) => buildMockAdset(rnd, i, `${state}-${idx}`))
  return withRates({
    id: `c-${state}-${idx}`,
    name,
    state,
    adsets,
    impressions: sumChildren(adsets, 'impressions'),
    clicks:      sumChildren(adsets, 'clicks'),
    spend:       sumChildren(adsets, 'spend'),
    leads:       sumChildren(adsets, 'leads'),
    lav:         sumChildren(adsets, 'lav'),
  })
}

function generateMockAdsDetail(dateRange) {
  const seed = (dateRange.startDate || '2026-01-01').split('-').reduce((a, n) => a + parseInt(n, 10), 0) || 1
  const rnd = seededRandom(seed)
  const campaigns = []
  STATES.forEach((state, si) => {
    const count = 1 + Math.floor(rnd() * 2)
    for (let i = 0; i < count; i++) campaigns.push(buildMockCampaign(rnd, state, i + si * 10))
  })
  return { campaigns }
}

const N8N_ADS_DETAIL_ENDPOINT = 'https://n8n.gabriel.com.br/webhook/painel-midia-ads-detail'

export function useMetaAdsDetail(dateRange) {
  const [detailData, setDetailData]       = useState(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [detailError, setDetailError]     = useState(null)

  const rangeKey = `${dateRange.startDate}|${dateRange.endDate}`

  useEffect(() => {
    let cancelled = false

    const doFetch = async () => {
      setDetailLoading(true)
      setDetailError(null)
      try {
        const { startDate, endDate } = dateRange
        const params = new URLSearchParams({ startDate, endDate })
        const res = await fetch(`${N8N_ADS_DETAIL_ENDPOINT}?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) setDetailData(json)
      } catch (err) {
        console.warn('n8n (detalhamento anúncios) indisponível, usando mock:', err.message)
        if (!cancelled) {
          setDetailError(err.message)
          setDetailData(generateMockAdsDetail(dateRange))
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }

    doFetch()
    return () => { cancelled = true }
  }, [rangeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { detailData, detailLoading, detailError }
}