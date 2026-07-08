const styles = {
  Meta:   { background: 'var(--blue-bg)',  color: 'var(--blue)'  },
  Google: { background: 'var(--coral-bg)', color: 'var(--coral)' },
}

export function ChannelBadge({ channel }) {
  const s = styles[channel] || { background: 'var(--bg)', color: 'var(--muted)' }
  return (
    <span style={{
      ...s,
      fontSize: 11,
      fontWeight: 500,
      padding: '2px 8px',
      borderRadius: 99,
      whiteSpace: 'nowrap',
    }}>
      {channel}
    </span>
  )
}
