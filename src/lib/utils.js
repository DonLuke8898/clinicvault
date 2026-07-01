import { clsx } from 'clsx'

export function cn(...inputs) {
  return clsx(inputs)
}

export function formatRM(amount) {
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(amount || 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ms-MY', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function today() {
  return new Date().toISOString().split('T')[0]
}

export function monthLabel(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('ms-MY', { month: 'short', year: 'numeric' })
}

export function daysBetween(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
