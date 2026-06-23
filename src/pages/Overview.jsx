import { KpiCard } from '../components/KpiCard.jsx'
import { ChannelBadge } from '../components/ChannelBadge.jsx'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

const WEEKS = ['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6','Sem 7']
const PIE_COLORS = ['#0afc33','#0d3b1f','#9efead']

const card = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '18px 20px',
}

export function Overview({ data }) {
  const { meta, google, hubspot } = data

  const totalSpend = meta.spend + google.spend
  const totalLeads = meta.leads + google.leads
  const totalCpl   = totalSpend / totalLeads

  const weeklyData = WEEKS.map((w, i) => ({
    name: w,
    Meta:   meta.weekly[i]   ?? 0,
    Google: google.weekly[i] ?? 0,
  }))

  const pieData = [
    { name: 'Meta',     value: meta.leads },
    { name: 'Google',   value: google.leads },
    { name: 'Orgânico', value: hubspot.totalLeads - totalLeads },
  ]

  const allCampaigns = [
    ...meta.campaigns.map(c => ({ ...c, channel: 'Meta' })),
    ...google.campaigns.map(c => ({ ...c, channel: 'Google' })),
  ].sort((a, b) => a.cpl - b.cpl)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <KpiCard label="Investimento total" value={totalSpend}          prefix="R$ " deltaUp={true}  delta="+12% vs mês ant." />
        <KpiCard label="Leads gerados"      value={totalLeads}                         deltaUp={true}  delta="+8% vs mês ant."  />
        <KpiCard label="Custo por lead"     value={totalCpl.toFixed(2)} prefix="R$ " deltaUp={false} delta="-3% vs mês ant."  />
        <KpiCard label="Leads no pipeline"  value={hubspot.pipeline}                   deltaUp={true}  delta="+21% vs mês ant." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Leads por semana — Meta vs Google</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyData}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--hint)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--hint)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid var(--border)' }} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Meta"   stroke="#0afc33" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Google" stroke="#0d3b1f" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Leads por canal</p>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={2}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
            {pieData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i], flexShrink: 0 }} />
                {d.name}
                <span style={{ marginLeft: 'auto', fontWeight: 500, color: 'var(--text)' }}>
                  {Math.round(d.value / hubspot.totalLeads * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={card}>
        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Custo por lead por campanha</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={allCampaigns} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--hint)' }} axisLine={false} tickLine={false}
              tickFormatter={v => `R$${v}`} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={v => [`R$ ${v.toFixed(2)}`, 'CPL']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid var(--border)' }} />
            <Bar dataKey="cpl" radius={[0, 4, 4, 0]}>
              {allCampaigns.map((c, i) => (
                <Cell key={i} fill={c.channel === 'Meta' ? '#0afc33' : '#0d3b1f'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={card}>
        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Leads recentes — HubSpot</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Nome','Canal','Campanha','Etapa','Data'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '0.5px solid var(--border)',
                  color: 'var(--muted)', fontWeight: 400, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hubspot.recent.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: '9px 10px', borderBottom: '0.5px solid var(--border)', fontWeight: 500 }}>{r.name}</td>
                <td style={{ padding: '9px 10px', borderBottom: '0.5px solid var(--border)' }}><ChannelBadge channel={r.channel} /></td>
                <td style={{ padding: '9px 10px', borderBottom: '0.5px solid var(--border)', color: 'var(--muted)' }}>{r.campaign}</td>
                <td style={{ padding: '9px 10px', borderBottom: '0.5px solid var(--border)', color: 'var(--muted)' }}>{r.stage}</td>
                <td style={{ padding: '9px 10px', borderBottom: '0.5px solid var(--border)', color: 'var(--hint)' }}>{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}