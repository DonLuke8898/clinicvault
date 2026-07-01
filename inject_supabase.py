#!/usr/bin/env python3
"""
inject_supabase.py — Fasa 2: Integrate Supabase into ClinicVault

Changes:
1. Add Supabase SDK in <head>
2. Update login HTML: username → email
3. Update setup HTML: username → email
4. Add Supabase init + cloudPush/cloudPull layer after DB definition
5. Modify DB.set to async-push to cloud
6. Replace doLogin() with Supabase Auth version
7. Replace doSetup() with Supabase Auth version
8. Replace doLogout() with Supabase signOut version
9. Fix showRegisterPane() to clear setupEmail
"""

from pathlib import Path
import shutil

SRC  = Path('/sessions/peaceful-great-ride/mnt/ClinicVault/clinicvault.html')
DEST = Path('/sessions/peaceful-great-ride/mnt/ClinicVault/clinicvault.html')

content = SRC.read_text(encoding='utf-8')
print(f"[1/9] Read file: {len(content):,} chars")

# ─────────────────────────────────────────────────────────
# 1. Supabase SDK before </head>
# ─────────────────────────────────────────────────────────
SDK_TAG = '  <!-- Supabase JS SDK -->\n  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>\n'
assert '</head>' in content
content = content.replace('</head>', SDK_TAG + '</head>', 1)
print("[1/9] Added Supabase SDK tag ✓")

# ─────────────────────────────────────────────────────────
# 2. Login HTML: username input → email input
# ─────────────────────────────────────────────────────────
OLD_LOGIN = (
    '<label class="form-label fw-semibold">Nama Pengguna</label>\n'
    '        <div class="login-input-wrap">\n'
    '          <i class="bi bi-at bi-left"></i>\n'
    '          <input class="form-control" id="loginUsername" placeholder="Username" '
    "onkeydown=\"if(event.key==='Enter')document.getElementById('loginPassword').focus()\">"
)
NEW_LOGIN = (
    '<label class="form-label fw-semibold">E-mel</label>\n'
    '        <div class="login-input-wrap">\n'
    '          <i class="bi bi-envelope bi-left"></i>\n'
    '          <input class="form-control" type="email" id="loginEmail" placeholder="email@klinik.com" '
    "onkeydown=\"if(event.key==='Enter')document.getElementById('loginPassword').focus()\">"
)
assert OLD_LOGIN in content, "❌ OLD_LOGIN not found"
content = content.replace(OLD_LOGIN, NEW_LOGIN, 1)
print("[2/9] Login: username → email ✓")

# ─────────────────────────────────────────────────────────
# 3. Setup HTML: username input → email input
# ─────────────────────────────────────────────────────────
OLD_SETUP = (
    '<label class="form-label fw-semibold">Nama Pengguna</label>\n'
    '        <div class="login-input-wrap">\n'
    '          <i class="bi bi-at bi-left"></i>\n'
    '          <input class="form-control" id="setupUsername" placeholder="username (huruf kecil)">'
)
NEW_SETUP = (
    '<label class="form-label fw-semibold">E-mel</label>\n'
    '        <div class="login-input-wrap">\n'
    '          <i class="bi bi-envelope bi-left"></i>\n'
    '          <input class="form-control" type="email" id="setupEmail" placeholder="email@klinik.com">'
)
assert OLD_SETUP in content, "❌ OLD_SETUP not found"
content = content.replace(OLD_SETUP, NEW_SETUP, 1)
print("[3/9] Setup: username → email ✓")

# ─────────────────────────────────────────────────────────
# 4. Add Supabase init + sync layer (after DB definition)
# ─────────────────────────────────────────────────────────
SUPABASE_LAYER = r"""

// ============================================================
// SUPABASE — Cloud Sync Layer (Fasa 2)
// ============================================================
const SUPABASE_URL  = 'https://nbfheimyypcyznxkkykv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZmhlaW15eXBjeXpueGtreWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDE0MzMsImV4cCI6MjA5ODMxNzQzM30.RZqtCUXqpKfJ81rOnOxvwKUKsZaauyGj10RNVsqOHtU';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Supabase clinic UUID for current session
let _sbClinicId = null;

// Tables that sync to cloud
const SB_TABLES = ['income', 'expense', 'panel', 'documents'];

// ── Map local record → Supabase row ──────────────────────
function _toCloud(key, r) {
  const base = { id: r.id, clinic_id: _sbClinicId, created_at: r.createdAt || new Date().toISOString() };
  if (key === 'income')    return { ...base, date: r.date, pay_type: r.payType, description: r.desc, amt: r.amt, cat: r.cat, ref: r.ref||null, notes: r.notes||null, file_name: r.file?.name||null, file_type: r.file?.type||null };
  if (key === 'expense')   return { ...base, date: r.date, cat: r.cat, description: r.desc, amt: r.amt, vendor: r.vendor||null, ref: r.ref||null, tax_deduct: r.taxDeduct||'no', pay_method: r.payMethod||null, notes: r.notes||null, file_name: r.file?.name||null, file_type: r.file?.type||null };
  if (key === 'panel')     return { ...base, name: r.name, invoice_no: r.invoiceNo, bill_date: r.billDate, billed_amt: r.billedAmt, paid_amt: r.paidAmt||0, paid_date: r.paidDate||null, pay_term: r.payTerm||60, notes: r.notes||null, file_name: r.file?.name||null, file_type: r.file?.type||null };
  if (key === 'documents') return { ...base, name: r.name, type: r.type||null, date: r.date||null, amt: r.amt||null, notes: r.notes||null, file_name: r.file?.name||null, file_type: r.file?.type||null };
  return base;
}

// ── Map Supabase row → local record ──────────────────────
function _fromCloud(key, row) {
  const file = row.file_name ? { name: row.file_name, type: row.file_type, data: null } : null;
  if (key === 'income')    return { id: row.id, date: row.date, payType: row.pay_type, desc: row.description, amt: +row.amt, cat: row.cat, ref: row.ref, notes: row.notes, file, createdAt: row.created_at };
  if (key === 'expense')   return { id: row.id, date: row.date, cat: row.cat, desc: row.description, amt: +row.amt, vendor: row.vendor, ref: row.ref, taxDeduct: row.tax_deduct, payMethod: row.pay_method, notes: row.notes, file, createdAt: row.created_at };
  if (key === 'panel')     return { id: row.id, name: row.name, invoiceNo: row.invoice_no, billDate: row.bill_date, billedAmt: +row.billed_amt, paidAmt: +row.paid_amt, paidDate: row.paid_date, payTerm: row.pay_term, notes: row.notes, file, createdAt: row.created_at };
  if (key === 'documents') return { id: row.id, name: row.name, type: row.type, date: row.date, amt: +(row.amt||0), notes: row.notes, file, createdAt: row.created_at };
  return row;
}

// ── Push one key's data array to Supabase ────────────────
async function cloudPush(key) {
  try {
    if (!_sbClinicId || !SB_TABLES.includes(key)) return;
    const records = DB.get(key, []);
    if (!records.length) return;
    const rows = records.map(r => _toCloud(key, r));
    const { error } = await _sb.from(key).upsert(rows, { onConflict: 'id' });
    if (error) console.warn('[CV Cloud] push', key, error.message);
  } catch(e) { console.warn('[CV Cloud] push exception:', e); }
}

// ── Pull all data from Supabase into localStorage ────────
async function cloudPull() {
  if (!_sbClinicId) return;
  const banner = document.getElementById('cloudSyncBanner');
  if (banner) { banner.textContent = '☁️ Memuat data dari cloud...'; banner.style.display = 'block'; }
  try {
    for (const key of SB_TABLES) {
      const { data, error } = await _sb.from(key).select('*').eq('clinic_id', _sbClinicId).order('created_at', { ascending: false });
      if (error) { console.warn('[CV Cloud] pull', key, error.message); continue; }
      if (data && data.length) {
        DB.set(key, data.map(r => _fromCloud(key, r)));
        console.log('[CV Cloud] pulled', data.length, key);
      }
    }
  } catch(e) { console.warn('[CV Cloud] pull exception:', e); }
  if (banner) { banner.style.display = 'none'; }
}

// ── Get or create Supabase clinic for this user ──────────
async function ensureClinic(sbUserId, clinicName) {
  try {
    const { data: memberships } = await _sb.from('clinic_members').select('clinic_id').eq('user_id', sbUserId).limit(1);
    if (memberships && memberships.length) { _sbClinicId = memberships[0].clinic_id; return; }
    const { data: clinic, error } = await _sb.from('clinics').insert({ name: clinicName || 'Klinik Saya', tax_rate: 24, sst_enabled: false }).select().single();
    if (error) { console.warn('[CV Cloud] ensureClinic:', error.message); return; }
    await _sb.from('clinic_members').insert({ clinic_id: clinic.id, user_id: sbUserId, role: 'admin' });
    _sbClinicId = clinic.id;
  } catch(e) { console.warn('[CV Cloud] ensureClinic exception:', e); }
}

"""

ANCHOR = """};

// ─── Clinic management helpers ─────────────────────────────────────────────"""
assert ANCHOR in content, "❌ DB closing anchor not found"
content = content.replace(ANCHOR, '};\n' + SUPABASE_LAYER + '\n// ─── Clinic management helpers ─────────────────────────────────────────────', 1)
print("[4/9] Added Supabase sync layer ✓")

# ─────────────────────────────────────────────────────────
# 5. Modify DB.set to push to cloud after localStorage set
# ─────────────────────────────────────────────────────────
OLD_DBSET = (
    "  set: (k, v) => {\n"
    "    if (!activeClinicId) return;\n"
    "    localStorage.setItem('cv_'+activeClinicId+'_'+k, JSON.stringify(v));\n"
    "  },"
)
NEW_DBSET = (
    "  set: (k, v) => {\n"
    "    if (!activeClinicId) return;\n"
    "    localStorage.setItem('cv_'+activeClinicId+'_'+k, JSON.stringify(v));\n"
    "    // Cloud sync (fire-and-forget)\n"
    "    setTimeout(() => { if (typeof cloudPush === 'function') cloudPush(k); }, 0);\n"
    "  },"
)
assert OLD_DBSET in content, "❌ OLD_DBSET not found"
content = content.replace(OLD_DBSET, NEW_DBSET, 1)
print("[5/9] DB.set: added cloud push ✓")

# ─────────────────────────────────────────────────────────
# 6. Replace doLogin()
# ─────────────────────────────────────────────────────────
OLD_DOLOGIN = """async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.remove('show');
  if (!username || !password) { errEl.textContent = 'Sila isi nama pengguna dan kata laluan.'; errEl.classList.add('show'); return; }
  const hash = await sha256(password);
  const users = getUsers();
  const user = users.find(u => u.username === username && u.passwordHash === hash);
  if (!user) { errEl.textContent = 'Nama pengguna atau kata laluan tidak sah.'; errEl.classList.add('show'); return; }
  currentUser = { id: user.id, username: user.username, name: user.name, role: user.role };
  setSession(currentUser);
  document.getElementById('loginOverlay').style.display = 'none';
  applyRoleUI();
  initAfterLogin();
}"""

NEW_DOLOGIN = """async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.remove('show');
  if (!email || !password) { errEl.textContent = 'Sila isi e-mel dan kata laluan.'; errEl.classList.add('show'); return; }

  // Try Supabase Auth
  const { data: authData, error: authError } = await _sb.auth.signInWithPassword({ email, password });

  if (authError) {
    // Fallback: check local users (for legacy accounts)
    const hash = await sha256(password);
    const users = getUsers();
    const localUser = users.find(u => (u.email === email || u.username === email) && u.passwordHash === hash);
    if (!localUser) { errEl.textContent = 'E-mel atau kata laluan tidak sah.'; errEl.classList.add('show'); return; }
    currentUser = { id: localUser.id, username: localUser.username||email, name: localUser.name, role: localUser.role };
  } else {
    const sbUser = authData.user;
    const name = sbUser.user_metadata?.full_name || email.split('@')[0];
    // Sync to local users list
    const users = getUsers();
    let lu = users.find(u => u.id === sbUser.id || u.email === email);
    if (!lu) {
      lu = { id: sbUser.id, username: email, email, name, role: 'admin', createdAt: sbUser.created_at };
      users.push(lu);
      saveUsers(users);
    }
    currentUser = { id: lu.id, username: email, name: lu.name||name, role: lu.role };
    // Ensure clinic exists in Supabase
    const activeName = getActiveClinic()?.name || 'Klinik Saya';
    await ensureClinic(sbUser.id, activeName);
    // Pull latest data from cloud
    await cloudPull();
  }

  setSession(currentUser);
  document.getElementById('loginOverlay').style.display = 'none';
  applyRoleUI();
  initAfterLogin();
}"""

assert OLD_DOLOGIN in content, "❌ OLD_DOLOGIN not found"
content = content.replace(OLD_DOLOGIN, NEW_DOLOGIN, 1)
print("[6/9] doLogin() replaced ✓")

# ─────────────────────────────────────────────────────────
# 7. Replace doSetup()
# ─────────────────────────────────────────────────────────
OLD_DOSETUP = """async function doSetup() {
  const name = document.getElementById('setupName').value.trim();
  const username = document.getElementById('setupUsername').value.trim().toLowerCase();
  const pw = document.getElementById('setupPassword').value;
  const pw2 = document.getElementById('setupPassword2').value;
  const errEl = document.getElementById('setupError');
  errEl.classList.remove('show');
  if (!name || !username || !pw) { errEl.textContent = 'Sila isi semua maklumat.'; errEl.classList.add('show'); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { errEl.textContent = 'Username hanya boleh mengandungi huruf kecil, nombor dan _.'; errEl.classList.add('show'); return; }
  if (pw.length < 6) { errEl.textContent = 'Kata laluan minimum 6 aksara.'; errEl.classList.add('show'); return; }
  if (pw !== pw2) { errEl.textContent = 'Kata laluan tidak sepadan.'; errEl.classList.add('show'); return; }
  const hash = await sha256(pw);
  const user = { id: uid(), username, name, role: 'superadmin', passwordHash: hash, createdAt: new Date().toISOString() };
  saveUsers([user]);
  currentUser = { id: user.id, username, name, role: 'superadmin' };
  setSession(currentUser);
  document.getElementById('loginOverlay').style.display = 'none';
  applyRoleUI();
  initAfterLogin();
}"""

NEW_DOSETUP = """async function doSetup() {
  const name     = document.getElementById('setupName').value.trim();
  const email    = document.getElementById('setupEmail').value.trim().toLowerCase();
  const pw       = document.getElementById('setupPassword').value;
  const pw2      = document.getElementById('setupPassword2').value;
  const errEl    = document.getElementById('setupError');
  errEl.classList.remove('show');
  if (!name || !email || !pw) { errEl.textContent = 'Sila isi semua maklumat.'; errEl.classList.add('show'); return; }
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { errEl.textContent = 'Format e-mel tidak sah.'; errEl.classList.add('show'); return; }
  if (pw.length < 6) { errEl.textContent = 'Kata laluan minimum 6 aksara.'; errEl.classList.add('show'); return; }
  if (pw !== pw2) { errEl.textContent = 'Kata laluan tidak sepadan.'; errEl.classList.add('show'); return; }

  // Register with Supabase Auth
  const setupBtn = document.querySelector('#loginSetupPane button[onclick*="doSetup"]');
  if (setupBtn) { setupBtn.disabled = true; setupBtn.textContent = 'Mendaftar...'; }
  const { data: authData, error: authError } = await _sb.auth.signUp({ email, password: pw, options: { data: { full_name: name } } });
  if (setupBtn) { setupBtn.disabled = false; setupBtn.textContent = 'Cipta Akaun'; }

  if (authError) { errEl.textContent = 'Ralat: ' + authError.message; errEl.classList.add('show'); return; }

  const sbUser = authData.user;
  const hash = await sha256(pw);
  const user = { id: sbUser.id, username: email, email, name, role: 'superadmin', passwordHash: hash, createdAt: new Date().toISOString() };
  saveUsers([user]);
  currentUser = { id: user.id, username: email, name, role: 'superadmin' };

  // Create clinic in Supabase
  await ensureClinic(sbUser.id, 'Klinik Saya');

  setSession(currentUser);
  document.getElementById('loginOverlay').style.display = 'none';
  applyRoleUI();
  initAfterLogin();
}"""

assert OLD_DOSETUP in content, "❌ OLD_DOSETUP not found"
content = content.replace(OLD_DOSETUP, NEW_DOSETUP, 1)
print("[7/9] doSetup() replaced ✓")

# ─────────────────────────────────────────────────────────
# 8. Replace doLogout()
# ─────────────────────────────────────────────────────────
OLD_DOLOGOUT = """function doLogout() {
  if (!confirm('Log keluar dari ClinicVault?')) return;
  clearSession();
  currentUser = null;
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').classList.remove('show');
  document.getElementById('topUserInfo')?.classList.add('d-none');
  document.getElementById('loginOverlay').style.display = 'flex';
}"""

NEW_DOLOGOUT = """function doLogout() {
  if (!confirm('Log keluar dari ClinicVault?')) return;
  _sb.auth.signOut().catch(() => {});
  clearSession();
  currentUser = null;
  _sbClinicId = null;
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').classList.remove('show');
  document.getElementById('topUserInfo')?.classList.add('d-none');
  document.getElementById('loginOverlay').style.display = 'flex';
}"""

assert OLD_DOLOGOUT in content, "❌ OLD_DOLOGOUT not found"
content = content.replace(OLD_DOLOGOUT, NEW_DOLOGOUT, 1)
print("[8/9] doLogout() replaced ✓")

# ─────────────────────────────────────────────────────────
# 9. Fix showRegisterPane(): setupUsername → setupEmail
# ─────────────────────────────────────────────────────────
OLD_SHOWREG = """function showRegisterPane() {
  document.getElementById('loginPane').style.display = 'none';
  document.getElementById('loginSetupPane').style.display = '';
  document.getElementById('setupName').value = '';
  document.getElementById('setupUsername').value = '';
  document.getElementById('setupPassword').value = '';
  document.getElementById('setupPassword2').value = '';
  document.getElementById('setupError').textContent = '';
}"""

NEW_SHOWREG = """function showRegisterPane() {
  document.getElementById('loginPane').style.display = 'none';
  document.getElementById('loginSetupPane').style.display = '';
  document.getElementById('setupName').value = '';
  document.getElementById('setupEmail').value = '';
  document.getElementById('setupPassword').value = '';
  document.getElementById('setupPassword2').value = '';
  document.getElementById('setupError').textContent = '';
}"""

assert OLD_SHOWREG in content, "❌ OLD_SHOWREG not found"
content = content.replace(OLD_SHOWREG, NEW_SHOWREG, 1)
print("[9/9] showRegisterPane() fixed ✓")

# ─────────────────────────────────────────────────────────
# Write output
# ─────────────────────────────────────────────────────────
DEST.write_text(content, encoding='utf-8')
print(f"\n✅ Done! Written {len(content):,} chars to {DEST}")
print(f"   Size change: {len(content) - len(SRC.read_text())//1:+,} chars")
