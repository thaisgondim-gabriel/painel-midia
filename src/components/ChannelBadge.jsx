const styles = {
  Meta:   { background: 'var(--green-80light)', color: 'var(--green-60dark)'  },
  Google: { background: 'var(--cinza)',          color: 'var(--grafite)' },
}

export function ChannelBadge({ channel }) {
  const s = styles[channel] || { background: 'var(--cinza)', color: 'var(--muted)' }
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