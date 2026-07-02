import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import logo from '../../assets/logo.png'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const ensureClinic = useStore(s => s.ensureClinic)
  const fetchAll = useStore(s => s.fetchAll)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'register') {
        if (password.length < 6) { setError('Kata laluan minimum 6 aksara.'); setLoading(false); return }
        const { data, error: err } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        })
        if (err) throw err
        if (data.user) {
          await ensureClinic(data.user.id)
          await fetchAll()
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        if (data.user) {
          await ensureClinic(data.user.id)
          await fetchAll()
        }
      }
    } catch (err) {
      setError(err.message || 'Ralat berlaku. Cuba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="ClinicVault" className="w-40 h-40 mx-auto object-contain drop-shadow-2xl" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-1 mb-6">
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                  mode === m ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {m === 'login' ? 'Log Masuk' : 'Daftar Akaun'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Nama Penuh</label>
                <input className="input" type="text" placeholder="Dr. Ahmad bin Ali"
                  value={name} onChange={e => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">E-mel</label>
              <input className="input" type="email" placeholder="anda@klinik.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Kata Laluan</label>
              <input className="input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-base">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {mode === 'login' ? 'Masuk...' : 'Mendaftar...'}
                </span>
              ) : mode === 'login' ? 'Log Masuk' : 'Cipta Akaun'}
            </button>
          </form>
        </div>
        <p className="text-center text-blue-200 text-xs mt-6">© 2026 ClinicVault v2.0</p>
      </div>
    </div>
  )
}
