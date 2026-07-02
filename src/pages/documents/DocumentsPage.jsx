import { useState, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import { formatRM, formatDate, today } from '../../lib/utils'
import { Plus, FileText, Trash2, X, AlertTriangle, Clock, CheckCircle } from 'lucide-react'

const CAT_OPTIONS = [
  { value: 'supplier',    label: 'Supplier / Pharmacy' },
  { value: 'lab',         label: 'Laboratory' },
  { value: 'utilities',   label: 'Utilities' },
  { value: 'marketing',   label: 'Marketing' },
  { value: 'maintenance', label: 'Maintenance / Services' },
  { value: 'online',      label: 'Online Shop' },
  { value: 'disposables', label: 'Disposables' },
  { value: 'rental',      label: 'Shop Rental' },
  { value: 'other',       label: 'Others' },
]

const PAY_TERMS = [
  { value: 'cod', label: 'COD',     days: 0  },
  { value: '1m',  label: '1 Bulan', days: 30 },
  { value: '2m',  label: '2 Bulan', days: 60 },
  { value: '3m',  label: '3 Bulan', days: 90 },
]

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function daysDiff(dateStr) {
  // positive = days remaining, negative = overdue
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  return Math.round((due - now) / 86400000)
}

function inferTermLabel(dateStr, dueDateStr) {
  if (!dateStr || !dueDateStr) return null
  const diff = Math.round((new Date(dueDateStr) - new Date(dateStr)) / 86400000)
  if (diff <= 0)  return 'COD'
  if (diff <= 35) return '1 Bulan'
  if (diff <= 65) return '2 Bulan'
  return '3 Bulan'
}

function getDocStatus(doc) {
  if (doc.status === 'paid') return 'paid'
  if (!doc.due_date) return 'unpaid'
  const diff = daysDiff(doc.due_date)
  if (diff < 0)   return 'overdue'
  if (diff <= 7)  return 'near'
  return 'unpaid'
}

const STATUS_CFG = {
  paid:    { label: 'Dibayar',      cls: 'badge-green',  border: 'border-slate-100' },
  unpaid:  { label: 'Belum Bayar',  cls: 'badge-red',    border: 'border-slate-100' },
  overdue: { label: 'Tertunggak',   cls: 'badge-red',    border: 'border-red-200 bg-red-50' },
  near:    { label: 'Hampir Tamat', cls: 'badge-yellow', border: 'border-amber-200 bg-amber-50' },
}

const EMPTY_FORM = {
  name: '', cat: 'supplier', date: today(), amt: '',
  pay_term: 'cod', status: 'unpaid', notes: '',
}

export default function DocumentsPage() {
  const { documents, clinicId, user, fetchAll } = useStore()
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [filterStatus, setFilter] = useState('all')
  const [search, setSearch]       = useState('')

  function setF(field, val) { setForm(f => ({ ...f, [field]: val })) }

  const filtered = useMemo(() => {
    return documents.filter(d => {
      const s = getDocStatus(d)
      if (filterStatus !== 'all' && s !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        const cat = CAT_OPTIONS.find(c => c.value === d.type)?.label || ''
        if (!d.name?.toLowerCase().includes(q) && !cat.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [documents, filterStatus, search])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.amt) return alert('Sila masukkan harga.')
    setSaving(true)
    try {
      const term     = PAY_TERMS.find(t => t.value === form.pay_term)
      const due_date = addDays(form.date, term?.days ?? 0)
      const row = {
        clinic_id: clinicId, created_by: user?.id,
        name:      form.name || null,
        type:      form.cat,
        date:      form.date || null,
        amt:       +form.amt,
        due_date,
        status:    form.status,
        notes:     form.notes || null,
        file_name: null, file_type: null, file_data: null,
      }
      const { error } = await supabase.from('documents').insert(row)
      if (error) throw error
      await fetchAll()
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (err) {
      alert('Ralat: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function togglePaid(doc) {
    const newStatus = doc.status === 'paid' ? 'unpaid' : 'paid'
    await supabase.from('documents').update({ status: newStatus }).eq('id', doc.id)
    await fetchAll()
  }

  async function handleDelete(doc) {
    if (!confirm('Padam rekod ini?')) return
    await supabase.from('documents').delete().eq('id', doc.id)
    await fetchAll()
  }

  const overdueCount = documents.filter(d => getDocStatus(d) === 'overdue').length
  const nearCount    = documents.filter(d => getDocStatus(d) === 'near').length

  const dueDatePreview = form.date
    ? formatDate(addDays(form.date, PAY_TERMS.find(t => t.value === form.pay_term)?.days ?? 0))
    : null

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invois & Resit</h1>
          <div className="flex gap-4 mt-0.5">
            {overdueCount > 0 && (
              <p className="text-red-500 text-sm flex items-center gap-1">
                <AlertTriangle size={14} /> {overdueCount} tertunggak
              </p>
            )}
            {nearCount > 0 && (
              <p className="text-amber-500 text-sm flex items-center gap-1">
                <Clock size={14} /> {nearCount} hampir tamat
              </p>
            )}
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM) }} className="btn-primary">
          <Plus size={16} /> Tambah Invois/Resit
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <FileText size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Cari nama / kategori..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {[
            { key: 'all',     label: 'Semua' },
            { key: 'unpaid',  label: 'Belum Bayar' },
            { key: 'near',    label: 'Hampir Tamat' },
            { key: 'overdue', label: 'Tertunggak' },
            { key: 'paid',    label: 'Dibayar' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filterStatus === key
                  ? 'bg-white shadow text-blue-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <FileText size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Tiada rekod ditemui</p>
          <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM) }}
            className="btn-primary mt-4 inline-flex">
            <Plus size={15} /> Tambah Invois/Resit
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => {
            const status    = getDocStatus(doc)
            const { label, cls, border } = STATUS_CFG[status] || STATUS_CFG.unpaid
            const catLabel  = CAT_OPTIONS.find(c => c.value === doc.type)?.label || doc.type || '—'
            const termLabel = inferTermLabel(doc.date, doc.due_date)
            const diff      = doc.due_date ? daysDiff(doc.due_date) : null

            return (
              <div key={doc.id} className={`card p-5 space-y-3 border ${border}`}>

                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      status === 'overdue' ? 'bg-red-50'
                      : status === 'near'  ? 'bg-amber-50'
                      : 'bg-blue-50'
                    }`}>
                      {status === 'overdue' || status === 'near'
                        ? <AlertTriangle size={18} className={status === 'overdue' ? 'text-red-500' : 'text-amber-500'} />
                        : <FileText size={18} className="text-blue-600" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm leading-tight line-clamp-1">
                        {doc.name || catLabel}
                      </p>
                      {doc.name && <p className="text-xs text-slate-400">{catLabel}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(doc)}
                    className="text-slate-200 hover:text-red-400 flex-shrink-0 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Status + Amount */}
                <div className="flex items-center justify-between">
                  <span className={cls}>{label}</span>
                  <span className="font-bold text-slate-700 text-base">{formatRM(doc.amt)}</span>
                </div>

                {/* Details */}
                <div className="text-xs text-slate-400 space-y-1 border-t border-slate-50 pt-2">
                  <div className="flex justify-between">
                    <span>Tarikh Invois</span>
                    <span className="text-slate-600 font-medium">{formatDate(doc.date)}</span>
                  </div>
                  {termLabel && (
                    <div className="flex justify-between">
                      <span>Terma Bayar</span>
                      <span className="text-slate-600 font-medium">{termLabel}</span>
                    </div>
                  )}
                  {doc.due_date && (
                    <div className="flex justify-between">
                      <span>Tarikh Akhir</span>
                      <span className={`font-medium ${
                        diff < 0     ? 'text-red-500'
                        : diff <= 7  ? 'text-amber-500'
                        : 'text-slate-600'
                      }`}>
                        {formatDate(doc.due_date)}
                        {diff !== null && diff < 0  && ` (${Math.abs(diff)}h)`}
                        {diff !== null && diff >= 0 && diff <= 7 && ` (${diff}h lagi)`}
                      </span>
                    </div>
                  )}
                </div>

                {doc.notes && (
                  <p className="text-xs text-slate-400 line-clamp-1 italic">{doc.notes}</p>
                )}

                {/* Action */}
                <button onClick={() => togglePaid(doc)}
                  className={`w-full text-xs py-1.5 justify-center ${
                    status === 'paid' ? 'btn-secondary' : 'btn-primary'
                  }`}>
                  {status === 'paid'
                    ? 'Tandakan Belum Bayar'
                    : <><CheckCircle size={13} /> Tandakan Dibayar</>
                  }
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Tambah Invois / Resit</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">

              {/* Date */}
              <div>
                <label className="label">Tarikh Invois / Resit *</label>
                <input type="date" className="input" value={form.date}
                  onChange={e => setF('date', e.target.value)} required />
              </div>

              {/* Category */}
              <div>
                <label className="label">Kategori Invois / Resit *</label>
                <select className="input" value={form.cat}
                  onChange={e => setF('cat', e.target.value)} required>
                  {CAT_OPTIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="label">Harga (RM) *</label>
                <input type="number" className="input" placeholder="0.00" min="0" step="0.01"
                  value={form.amt} onChange={e => setF('amt', e.target.value)} required />
              </div>

              {/* Payment Term + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Terma Bayaran</label>
                  <select className="input" value={form.pay_term}
                    onChange={e => setF('pay_term', e.target.value)}>
                    {PAY_TERMS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Status Bayaran</label>
                  <select className="input" value={form.status}
                    onChange={e => setF('status', e.target.value)}>
                    <option value="unpaid">Belum Bayar</option>
                    <option value="paid">Dibayar</option>
                  </select>
                </div>
              </div>

              {/* Due date preview */}
              {dueDatePreview && (
                <div className={`rounded-lg px-4 py-2.5 text-xs flex items-center gap-2 ${
                  form.pay_term === 'cod'
                    ? 'bg-slate-50 text-slate-600'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  <Clock size={13} />
                  <span>
                    <span className="font-semibold">Tarikh akhir bayar: </span>
                    {dueDatePreview}
                    {form.pay_term !== 'cod' && ' — alert akan muncul 7 hari sebelum tarikh ini'}
                  </span>
                </div>
              )}

              {/* Reference / Name */}
              <div>
                <label className="label">No. Invois / Nama Pembekal</label>
                <input type="text" className="input"
                  placeholder="Cth: INV-2026-001 / Apex Medical Supply"
                  value={form.name} onChange={e => setF('name', e.target.value)} />
              </div>

              {/* Notes */}
              <div>
                <label className="label">Nota</label>
                <textarea className="input resize-none" rows={2} value={form.notes}
                  onChange={e => setF('notes', e.target.value)}
                  placeholder="Nota tambahan..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1 justify-center">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="btn-primary flex-1 justify-center">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
