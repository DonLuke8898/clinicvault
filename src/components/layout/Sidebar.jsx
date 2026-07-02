import { NavLink } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard, ArrowLeftRight, FileText, CreditCard, Settings, LogOut, ShieldAlert
} from 'lucide-react'
import logo from '../../assets/logo.png'

const NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'Transaksi' },
  { to: '/documents',    icon: FileText,         label: 'Invois & Resit' },
  { to: '/panel',        icon: CreditCard,       label: 'Panel & Klaim' },
  { to: '/settings',     icon: Settings,         label: 'Tetapan' },
]

const ROLE_LABEL = { admin: 'Admin', doctor: 'Doktor', staff: 'Staff' }
const ROLE_COLOR = {
  admin:       'bg-purple-500/20 text-purple-300',
  doctor:      'bg-blue-500/20 text-blue-300',
  staff:       'bg-slate-500/20 text-slate-300',
  super_admin: 'bg-amber-500/20 text-amber-300',
}

export default function Sidebar({ onClose }) {
  const { user, clinicName, userRole, isSuperAdmin, allClinics, activeClinicId, setActiveClinic } = useStore()

  async function handleLogout() {
    await supabase.auth.signOut()
    useStore.setState({
      user: null, clinicId: null, userRole: null,
      isSuperAdmin: false, allClinics: [], activeClinicId: null,
      income: [], expense: [], panel: [], documents: [],
    })
  }

  return (
    <aside className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white w-64">
      {/* Clinic Header */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <img src={logo} alt="ClinicVault" className="w-10 h-10 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm truncate text-white">
              {isSuperAdmin && !activeClinicId ? 'ClinicVault' : clinicName}
            </p>
            <p className="text-slate-400 text-xs truncate">{user?.email}</p>
            {userRole && (
              <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[userRole] || ROLE_COLOR.staff}`}>
                {isSuperAdmin && <ShieldAlert size={9} />}
                {isSuperAdmin ? 'Super Admin' : (ROLE_LABEL[userRole] || userRole)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SA Clinic Switcher */}
      {isSuperAdmin && (
        <div className="px-3 pt-3 pb-2 border-b border-slate-700">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold px-1 mb-1 block">
            Paparan Klinik
          </label>
          <select
            value={activeClinicId || ''}
            onChange={e => { setActiveClinic(e.target.value || null); onClose?.() }}
            className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            <option value="">Semua Klinik</option>
            {allClinics.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`
            }>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-slate-700 pt-3">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-red-600/20 transition-all">
          <LogOut size={18} />
          Log Keluar
        </button>
      </div>
    </aside>
  )
}
