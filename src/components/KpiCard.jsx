export function KpiCard({ label, value, delta, deltaUp, prefix = '', suffix = '' }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '16px 18px',
    }}>
      <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)' }}>
        {prefix}{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}{suffix}
      </p>
      {delta && (
        <p style={{ fontSize: 11, marginTop: 5, color: deltaUp ? 'var(--teal)' : 'var(--coral)' }}>
          {deltaUp ? '▲' : '▼'} {delta}
        </p>
      )}
    </div>
  )
}
