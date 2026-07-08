import { useState, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import { formatRM, formatDate, today, daysBetween } from '../../lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Plus, X, Trash2, AlertTriangle, CheckCircle2, Clock, ArrowRight } from 'lucide-react'

const STATUS = {
  submitted: { label: 'Submitted', cls: 'badge-blue',   next: 'approved'  },
  approved:  { label: 'Approved',  cls: 'badge-yellow', next: 'paid'      },
  paid:      { label: 'Paid',      cls: 'badge-green',  next: null        },
  disputed:  { label: 'Disputed',  cls: 'badge-red',    next: 'submitted' },
}

const EMPTY_FORM = {
  name: '', invoice_no: '', bill_date: today(),
  billed_amt: '', paid_amt: '0', paid_date: '',
  pay_term: '60', status: 'submitted', notes: ''
}

export default function PanelPage() {
  const { panel, clinicId, user, fetchAll, userRole, isSuperAdmin } = useStore()
  const canAmend = userRole === 'admin' || isSuperAdmin
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // Aging analysis
  const aging = useMemo(() => {
    const unpaid = panel.filter(p => p.status !== 'paid')
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    unpaid.forEach(p => {
      const days = daysBetween(p.bill_date) || 0
      if (days <= 30) buckets['0-30'] += +p.billed_amt - +p.paid_amt
      else if (days <= 60) buckets['31-60'] += +p.billed_amt - +p.paid_amt
      else if (days <= 90) buckets['61-90'] += +p.billed_amt - +p.paid_amt
      else buckets['90+'] += +p.billed_amt - +p.paid_amt
    })
    return Object.entries(buckets).map(([label, amt]) => ({ label, amt }))
  }, [panel])

  const summary = useMemo(() => {
    const total = panel.reduce((s, p) => s + +p.billed_amt, 0)
    const paid  = panel.reduce((s, p) => s + +p.paid_amt, 0)
    const overdue = panel.filter(p => {
      if (p.status === 'paid') return false
      return (daysBetween(p.bill_date) || 0) > +(p.pay_term || 60)
    }).length
    return { total, paid, outstanding: total - paid, overdue }
  }, [panel])

  const filtered = useMemo(() => {
    return filterStatus === 'all' ? panel : panel.filter(p => p.status === filterStatus)
  }, [panel, filterStatus])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('panel').insert({
        clinic_id: clinicId, created_by: user?.id,
        name: form.name, invoice_no: form.invoice_no,
        bill_date: form.bill_date, billed_amt: +form.billed_amt,
        paid_amt: +form.paid_amt || 0, paid_date: form.paid_date || null,
        pay_term: +form.pay_term || 60, status: form.status,
        notes: form.notes || null,
      })
      if (error) throw error
      await fetchAll()
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (err) { alert('Ralat: ' + err.message) }
    finally { setSaving(false) }
  }

  async function advanceStatus(p) {
    const next = STATUS[p.status]?.next
    if (!next) return
    const updates = { status: next }
    if (next === 'paid') updates.paid_date = today()
    await supabase.from('panel').update(updates).eq('id', p.id)
    await fetchAll()
  }

  async function markDisputed(p) {
    await supabase.from('panel').update({ status: 'disputed' }).eq('id', p.id)
    await fetchAll()
  }

  async function handleDelete(p) {
    if (!confirm(`Padam klaim "${p.name} - ${p.invoice_no}"?`)) return
    await supabase.from('panel').delete().eq('id', p.id)
    await fetchAll()
  }

  const AGING_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444']

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel & Klaim Insurans</h1>
          {summary.overdue > 0 && (
            <p className="text-red-500 text-sm flex items-center gap-1 mt-0.5">
              <AlertTriangle size={14} /> {summary.overdue} klaim melebihi tempoh bayar
            </p>
          )}
        </div>
        <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM) }} className="btn-primary">
          <Plus size={16} /> Tambah Klaim
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Jumlah Bil', value: formatRM(summary.total), icon: '📋', color: 'text-blue-600' },
          { label: 'Sudah Diterima', value: formatRM(summary.paid), icon: '✅', color: 'text-emerald-600' },
          { label: 'Tertunggak', value: formatRM(summary.outstanding), icon: '⏳', color: 'text-amber-600' },
          { label: 'Melebihi Tempoh', value: `${summary.overdue} klaim`, icon: '🚨', color: 'text-red-600' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="card p-4">
            <p className="text-2xl mb-1">{icon}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Aging Chart */}
      {panel.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-700 mb-4">Laporan Aging Tunggakan (RM)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={aging} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `RM${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={50} />
              <Tooltip formatter={v => formatRM(v)} />
              <Bar dataKey="amt" radius={[0,4,4,0]}>
                {aging.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 flex-wrap">
            {[['0-30 hari','#10b981'],['31-60 hari','#f59e0b'],['61-90 hari','#f97316'],['90+ hari','#ef4444']].map(([l,c]) => (
              <span key={l} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-3 h-3 rounded-full" style={{background:c}} />{l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {['all', ...Object.keys(STATUS)].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              filterStatus === s ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {s === 'all' ? 'Semua' : STATUS[s]?.label}
            {s !== 'all' && <span className="ml-1 text-slate-400">({panel.filter(p => p.status === s).length})</span>}
          </button>
        ))}
      </div>

      {/* Claim Cards */}
      {filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <Clock size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Tiada klaim ditemui</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const s = STATUS[p.status] || STATUS.submitted
            const daysOld = daysBetween(p.bill_date) || 0
            const isOverdue = p.status !== 'paid' && daysOld > +(p.pay_term || 60)
            const outstanding = +p.billed_amt - +p.paid_amt
            return (
              <div key={p.id} className={`card p-5 space-y-3 ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.invoice_no}</p>
                  </div>
                  {canAmend && (
                    <button onClick={() => handleDelete(p)} className="text-slate-200 hover:text-red-400">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className={s.cls}>{s.label}</span>
                  {isOverdue && <span className="badge-red">⚠ Overdue {daysOld}d</span>}
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Tarikh Bil:</span><span>{formatDate(p.bill_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amaun Bil:</span><span className="font-semibold text-slate-700">{formatRM(p.billed_amt)}</span>
                  </div>
                  {+p.paid_amt > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Diterima:</span><span className="font-semibold">{formatRM(p.paid_amt)}</span>
                    </div>
                  )}
                  {outstanding > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Baki:</span><span className="font-semibold">{formatRM(outstanding)}</span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {canAmend ? (
                  <div className="flex gap-2">
                    {s.next && (
                      <button onClick={() => advanceStatus(p)}
                        className="btn-primary text-xs py-1.5 flex-1 justify-center gap-1">
                        <ArrowRight size={12} /> {STATUS[s.next]?.label}
                      </button>
                    )}
                    {p.status !== 'disputed' && p.status !== 'paid' && (
                      <button onClick={() => markDisputed(p)}
                        className="btn-secondary text-xs py-1.5 flex-1 justify-center">
                        Dispute
                      </button>
                    )}
                    {p.status === 'paid' && (
                      <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                        <CheckCircle2 size={14} /> Selesai
                      </div>
                    )}
                  </div>
                ) : (
                  p.status === 'paid' && (
                    <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                      <CheckCircle2 size={14} /> Selesai
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Tambah Klaim Panel</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Nama Panel / Insurans *</label>
                <input type="text" className="input" placeholder="Cth: Great Eastern, PMCare, AIA"
                  value={form.name} onChange={e => setF('name', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">No. Invois *</label>
                  <input type="text" className="input" placeholder="INV-2026-001"
                    value={form.invoice_no} onChange={e => setF('invoice_no', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setF('status', e.target.value)}>
                    {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tarikh Bil *</label>
                  <input type="date" className="input" value={form.bill_date}
                    onChange={e => setF('bill_date', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Tempoh Bayar (hari)</label>
                  <input type="number" className="input" min="1" value={form.pay_term}
                    onChange={e => setF('pay_term', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Amaun Dibilkan (RM) *</label>
                  <input type="number" className="input" placeholder="0.00" min="0.01" step="0.01"
                    value={form.billed_amt} onChange={e => setF('billed_amt', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Amaun Diterima (RM)</label>
                  <input type="number" className="input" placeholder="0.00" min="0" step="0.01"
                    value={form.paid_amt} onChange={e => setF('paid_amt', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Nota</label>
                <textarea className="input resize-none" rows={2} value={form.notes}
                  onChange={e => setF('notes', e.target.value)} placeholder="Nota tambahan..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Batal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Menyimpan...' : 'Simpan Klaim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
