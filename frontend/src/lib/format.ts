//function to make bytes readable (TB, GB, MB, KB & B)

export function formatBytes(bytes: number): string {
  const gb = bytes / 1_000_000_000
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`
  
  if (gb >= 1) return `${gb.toFixed(gb < 10 ? 2 : 1)} GB`
  
  const mb = bytes / 1_000_000
  
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  
  const kb = bytes / 1_000
  
  if (kb >= 1) return `${kb.toFixed(1)} KB`
  return `${bytes} B`
}

// function to convert computer type of date to normal date
export function formatTimestamp(iso: string):string 
{
      const d = new Date(iso)

  if (Number.isNaN(d.getTime())) 
    return iso

  return d.toLocaleString(undefined, 
    {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function shortHash(hash: string | null): string {
  if (!hash) return '—'
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}
