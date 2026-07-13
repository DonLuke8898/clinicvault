import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { BookOpen, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today      = () => new Date().toISOString().slice(0, 10)
const todayMonth = () => new Date().toISOString().slice(0, 7)
const DAYS       = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu']
const dayName    = d => d ? DAYS[new Date(d).getDay()] : ''

function fmt(n) {
  if (!n || +n === 0) return ''
  return 'RM' + (+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
function fmtFull(n) {
  return 'RM' + (+n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// ─── Constants ───────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  date: today(), time_slot: '', subject: '',
  cash_collection: '', panel_collection: '', online_transfer: '', debit_credit: '',
  locum_cash: '', locum_transfer: '', locum_insentif: '',
  expenses: '', is_holiday: false, holiday_name: '', notes: '',
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function DailyAccountPage() {
  const { clinicId, user } = useStore()

  const [records,     setRecords]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filterMonth, setFilterMonth] = useState(todayMonth())
  const [showModal,   setShowModal]   = useState(false)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [editId,      setEditId]      = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      const from = filterMonth + '-01'
      const to   = filterMonth + '-31'
      const { data, error } = await supabase
        .from('daily_account')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('date', from)
        .lte('date', to)
        .order('date',       { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      setRecords(data || [])
    } catch (e) { console.error(e) }
    finally     { setLoading(false) }
  }, [clinicId, filterMonth])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // ── Running Balance (cumulative dalam bulan) ─────────────────────────────
  const rowsWithBal = useMemo(() => {
    let bal = 0
    return records.map(r => {
      if (!r.is_holiday) {
        const coll = (+r.cash_collection || 0) + (+r.panel_collection || 0)
                   + (+r.online_transfer || 0) + (+r.debit_credit || 0)
        const out  = (+r.locum_cash || 0) + (+r.locum_transfer || 0)
                   + (+r.locum_insentif || 0) + (+r.expenses || 0)
        bal += coll - out
      }
      return { ...r, _total: !r.is_holiday
        ? (+r.cash_collection||0)+( +r.panel_collection||0)+(+r.online_transfer||0)+(+r.debit_credit||0)
        : 0,
        _balance: bal }
    })
  }, [records])

  // ── Summary Totals ───────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const live = records.filter(r => !r.is_holiday)
    const s    = f => live.reduce((a, r) => a + (+r[f] || 0), 0)
    const cash  = s('cash_collection'), panel  = s('panel_collection')
    const onl   = s('online_transfer'),  deb    = s('debit_credit')
    const lc    = s('locum_cash'),       lt     = s('locum_transfer')
    const li    = s('locum_insentif'),   exp    = s('expenses')
    const total = cash + panel + onl + deb
    const out   = lc + lt + li + exp
    return { cash, panel, online: onl, debit: deb, total, locum: lc+lt+li, expenses: exp, balance: total - out }
  }, [records])

  // ── CRUD ─────────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM); setEditId(null); setErr(''); setShowModal(true)
  }
  function openEdit(r) {
    setForm({
      date: r.date, time_slot: r.time_slot || '', subject: r.subject || '',
      cash_collection: r.cash_collection || '', panel_collection: r.panel_collection || '',
      online_transfer: r.online_transfer || '', debit_credit: r.debit_credit || '',
      locum_cash: r.locum_cash || '', locum_transfer: r.locum_transfer || '',
      locum_insentif: r.locum_insentif || '', expenses: r.expenses || '',
      is_holiday: r.is_holiday || false, holiday_name: r.holiday_name || '',
      notes: r.notes || '',
    })
    setEditId(r.id); setErr(''); setShowModal(true)
  }

  async function handleSave() {
    setErr('')
    if (!form.date)                             { setErr('Tarikh diperlukan'); return }
    if (form.is_holiday && !form.holiday_name)  { setErr('Nama cuti diperlukan'); return }
    setSaving(true)
    try {
      const payload = {
        clinic_id: clinicId, created_by: user?.id,
        date: form.date, time_slot: form.time_slot || null, subject: form.subject || null,
        cash_collection:  +form.cash_collection  || 0,
        panel_collection: +form.panel_collection || 0,
        online_transfer:  +form.online_transfer  || 0,
        debit_credit:     +form.debit_credit     || 0,
        locum_cash:       +form.locum_cash       || 0,
        locum_transfer:   +form.locum_transfer   || 0,
        locum_insentif:   +form.locum_insentif   || 0,
        expenses:         +form.expenses         || 0,
        is_holiday:    form.is_holiday,
        holiday_name:  form.is_holiday ? form.holiday_name : null,
        notes:         form.notes || null,
      }
      const { error } = editId
        ? await supabase.from('daily_account').update(payload).eq('id', editId)
        : await supabase.from('daily_account').insert(payload)
      if (error) throw error
      setShowModal(false)
      fetchRecords()
    } catch (e) { setErr(e.message) }
    finally     { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Padam rekod ini?')) return
    await supabase.from('daily_account').delete().eq('id', id)
    fetchRecords()
  }

  const set      = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const formTotal = (+form.cash_collection||0)+(+form.panel_collection||0)
                  +(+form.online_transfer||0)+(+form.debit_credit||0)

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen size={20} className="text-blue-600" /> Daily Account
          </h1>
          <p className="text-sm text-slate-500">Rekod harian kutipan &amp; perbelanjaan klinik</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Plus size={16} /> Tambah Rekod
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Cash',         val: totals.cash,     cls: 'text-emerald-600' },
          { label: 'Panel',        val: totals.panel,    cls: 'text-blue-600' },
          { label: 'Online',       val: totals.online,   cls: 'text-violet-600' },
          { label: 'Debit / Card', val: totals.debit,    cls: 'text-cyan-600' },
          { label: 'Total Kutipan',val: totals.total,    cls: 'text-indigo-700 font-bold' },
          { label: 'Locum + Exp',  val: totals.locum + totals.expenses, cls: 'text-red-600' },
          { label: 'Balance',      val: totals.balance,  cls: totals.balance >= 0 ? 'text-slate-800 font-bold' : 'text-orange-600 font-bold' },
        ].map(({ label, val, cls }) => (
          <div key={label} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <p className="text-[11px] text-slate-400 mb-1">{label}</p>
            <p className={`text-sm ${cls}`}>{fmtFull(val)}</p>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wide">
                <th className="text-left   px-3 py-3 font-semibold text-slate-500 whitespace-nowrap">Tarikh</th>
                <th className="text-left   px-3 py-3 font-semibold text-slate-500 whitespace-nowrap">Masa</th>
                <th className="text-left   px-3 py-3 font-semibold text-slate-500 whitespace-nowrap">Subjek</th>
                <th className="text-right  px-3 py-3 font-semibold text-emerald-700 whitespace-nowrap">Cash</th>
                <th className="text-right  px-3 py-3 font-semibold text-blue-700   whitespace-nowrap">Panel</th>
                <th className="text-right  px-3 py-3 font-semibold text-violet-700 whitespace-nowrap">Online</th>
                <th className="text-right  px-3 py-3 font-semibold text-cyan-700   whitespace-nowrap">Debit/Card</th>
                <th className="text-right  px-3 py-3 font-semibold text-indigo-700 bg-indigo-50 whitespace-nowrap">Total Kutipan</th>
                <th className="text-right  px-3 py-3 font-semibold text-orange-600 whitespace-nowrap">Locum Cash</th>
                <th className="text-right  px-3 py-3 font-semibold text-orange-600 whitespace-nowrap hidden lg:table-cell">Locum Trans</th>
                <th className="text-right  px-3 py-3 font-semibold text-orange-600 whitespace-nowrap hidden lg:table-cell">L. Insentif</th>
                <th className="text-right  px-3 py-3 font-semibold text-red-600    whitespace-nowrap">Expenses</th>
                <th className="text-right  px-3 py-3 font-semibold text-slate-700  bg-slate-100 whitespace-nowrap">Balance</th>
                <th className="px-3 py-3 w-14"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={14} className="text-center py-12 text-slate-400">Memuatkan...</td></tr>
              ) : rowsWithBal.length === 0 ? (
                <tr><td colSpan={14} className="text-center py-12 text-slate-400">
                  Tiada rekod untuk bulan ini. Klik <strong>Tambah Rekod</strong> untuk mula.
                </td></tr>
              ) : rowsWithBal.map(r => {
                /* ── Holiday row ── */
                if (r.is_holiday) {
                  return (
                    <tr key={r.id} className="bg-amber-50 border-amber-200">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-semibold text-amber-800 block">{r.date}</span>
                        <span className="text-amber-600 text-[10px]">{dayName(r.date)}</span>
                      </td>
                      <td colSpan={11} className="px-3 py-2.5 text-center font-bold text-amber-700 uppercase tracking-widest">
                        🏖️ {r.holiday_name}
                      </td>
                      <td className="px-3 py-2.5 text-right bg-slate-50 font-bold text-slate-700">
                        {fmtFull(r._balance)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEdit(r)}     title="Edit"  className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><Pencil  size={13}/></button>
                          <button onClick={() => handleDelete(r.id)} title="Padam" className="p-1 text-slate-400 hover:text-red-600  transition-colors"><Trash2  size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                /* ── Normal row ── */
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-semibold text-slate-700 block">{r.date}</span>
                      <span className="text-slate-400 text-[10px]">{dayName(r.date)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.time_slot || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600 font-medium whitespace-nowrap">{r.subject || ''}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-700 font-medium">{fmt(r.cash_collection)}</td>
                    <td className="px-3 py-2.5 text-right text-blue-700   font-medium">{fmt(r.panel_collection)}</td>
                    <td className="px-3 py-2.5 text-right text-violet-700 font-medium">{fmt(r.online_transfer)}</td>
                    <td className="px-3 py-2.5 text-right text-cyan-700   font-medium">{fmt(r.debit_credit)}</td>
                    <td className="px-3 py-2.5 text-right bg-indigo-50/60 font-bold text-indigo-700">
                      {r._total > 0 ? fmtFull(r._total) : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right text-orange-600">{fmt(r.locum_cash)}</td>
                    <td className="px-3 py-2.5 text-right text-orange-600 hidden lg:table-cell">{fmt(r.locum_transfer)}</td>
                    <td className="px-3 py-2.5 text-right text-orange-600 hidden lg:table-cell">{fmt(r.locum_insentif)}</td>
                    <td className="px-3 py-2.5 text-right text-red-600">{fmt(r.expenses)}</td>
                    <td className="px-3 py-2.5 text-right bg-slate-50 font-bold text-slate-800">
                      {fmtFull(r._balance)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(r)}        title="Edit"  className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><Pencil  size={13}/></button>
                        <button onClick={() => handleDelete(r.id)} title="Padam" className="p-1 text-slate-400 hover:text-red-600  transition-colors"><Trash2  size={13}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-slate-800 text-base">
                {editId ? 'Edit Rekod Harian' : 'Tambah Rekod Harian'}
              </h2>
              <button onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {err && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={15}/> {err}
                </div>
              )}

              {/* Holiday Toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={() => set('is_holiday', !form.is_holiday)}
                  className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${form.is_holiday ? 'bg-amber-500' : 'bg-slate-200'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_holiday ? 'left-5' : 'left-1'}`}/>
                </div>
                <span className="text-sm font-semibold text-slate-700">🏖️ Cuti Umum / Public Holiday</span>
              </label>

              {form.is_holiday && (
                <div>
                  <label className="block text-xs font-semibold text-amber-700 mb-1">Nama Cuti *</label>
                  <input value={form.holiday_name} onChange={e => set('holiday_name', e.target.value)}
                    placeholder="Contoh: Hari Kebangsaan"
                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              )}

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tarikh *</label>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Masa Operasi</label>
                  <input value={form.time_slot} onChange={e => set('time_slot', e.target.value)}
                    placeholder="9AM-9PM"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subjek / Doktor</label>
                <input value={form.subject} onChange={e => set('subject', e.target.value)}
                  placeholder="Contoh: DR ARVEN"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {!form.is_holiday && (
                <>
                  {/* Collections */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">💰 Kutipan</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Cash Collection',    key: 'cash_collection',  cls: 'text-emerald-700 border-emerald-300 focus:ring-emerald-400' },
                        { label: 'Panel Collection',   key: 'panel_collection', cls: 'text-blue-700   border-blue-300   focus:ring-blue-400'    },
                        { label: 'Online Transfer',    key: 'online_transfer',  cls: 'text-violet-700 border-violet-300 focus:ring-violet-400'  },
                        { label: 'Debit / Credit Card',key: 'debit_credit',     cls: 'text-cyan-700   border-cyan-300   focus:ring-cyan-400'    },
                      ].map(({ label, key, cls }) => (
                        <div key={key}>
                          <label className={`block text-[11px] font-semibold mb-1 ${cls.split(' ')[0]}`}>{label}</label>
                          <input type="number" min="0" step="0.01" value={form[key]}
                            onChange={e => set(key, e.target.value)} placeholder="0.00"
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${cls}`} />
                        </div>
                      ))}
                    </div>
                    {formTotal > 0 && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Total Kutipan</span>
                        <span className="font-bold text-indigo-700 text-sm">{fmtFull(formTotal)}</span>
                      </div>
                    )}
                  </div>

                  {/* Locum */}
                  <div className="bg-orange-50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-widest">👨‍⚕️ Locum</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Locum Cash',     key: 'locum_cash' },
                        { label: 'Locum Transfer', key: 'locum_transfer' },
                        { label: 'Locum Insentif', key: 'locum_insentif' },
                      ].map(({ label, key }) => (
                        <div key={key}>
                          <label className="block text-[11px] font-semibold text-orange-700 mb-1">{label}</label>
                          <input type="number" min="0" step="0.01" value={form[key]}
                            onChange={e => set(key, e.target.value)} placeholder="0.00"
                            className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expenses */}
                  <div>
                    <label className="block text-xs font-semibold text-red-700 mb-1">💸 Expenses / Perbelanjaan</label>
                    <input type="number" min="0" step="0.01" value={form.expenses}
                      onChange={e => set('expenses', e.target.value)} placeholder="0.00"
                      className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nota (pilihan)</label>
                <input value={form.notes} onChange={e => set('notes', e.target.value)}
                  placeholder="Nota tambahan..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {saving ? 'Menyimpan...' : editId ? 'Kemaskini' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
