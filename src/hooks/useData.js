import { useState, useEffect, useCallback } from 'react'

const N8N_ENDPOINT = 'https://n8n.gabriel.com.br/webhook/painel-midia'

const MOCK_DATA = {
  lastUpdated: new Date().toISOString(),
  meta: {
    spend: 28450,
    impressions: 842300,
    clicks: 12840,
    leads: 742,
    cpl: 38.34,
    campaigns: [
      { name: 'Brand awareness', spend: 9800,  leads: 320, cpl: 30.63 },
      { name: 'Conversão site',  spend: 11200, leads: 280, cpl: 40.00 },
      { name: 'Remarketing',     spend: 7450,  leads: 142, cpl: 52.46 },
    ],
    weekly: [62, 78, 71, 95, 103, 118, 115],
  },
  google: {
    spend: 19870,
    impressions: 634100,
    clicks: 9210,
    leads: 505,
    cpl: 39.35,
    campaigns: [
      { name: 'Search branded',  spend: 8200, leads: 240, cpl: 34.17 },
      { name: 'Search genérico', spend: 7100, leads: 165, cpl: 43.03 },
      { name: 'Display',         spend: 4570, leads: 100, cpl: 45.70 },
    ],
    weekly: [48, 55, 52, 68, 74, 82, 126],
  },
  hubspot: {
    totalLeads: 1247,
    pipeline: 342,
    converted: 87,
    conversionRate: 6.98,
    recent: [
      { name: 'Ana Souza',    channel: 'Meta',   campaign: 'Brand awareness', stage: 'Qualificado', date: '23/06' },
      { name: 'Bruno Lima',   channel: 'Google', campaign: 'Search branded',  stage: 'Proposta',    date: '22/06' },
      { name: 'Carla Maia',   channel: 'Meta',   campaign: 'Conversão site',  stage: 'Novo lead',   date: '22/06' },
      { name: 'Diego Pires',  channel: 'Google', campaign: 'Search genérico', stage: 'Novo lead',   date: '21/06' },
      { name: 'Elena Castro', channel: 'Meta',   campaign: 'Remarketing',     stage: 'Proposta',    date: '21/06' },
    ],
  },
}

const REFRESH_INTERVAL = 60 * 60 * 1000

export function useData() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(N8N_ENDPOINT)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.warn('n8n indisponível, usando dados de exemplo:', err.message)
      setData(MOCK_DATA)
    } finally {
      setLoading(false)
      setLastFetch(new Date())
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  useEffect(() => {
    const interval = setInterval(fetch_, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetch_])

  return { data, loading, error, lastFetch, refresh: fetch_ }
}