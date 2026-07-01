#!/usr/bin/env python3
"""patch_sync_fix.py — Fix cloud sync issues"""

from pathlib import Path

SRC = Path('/sessions/peaceful-great-ride/mnt/ClinicVault/clinicvault.html')
content = SRC.read_text(encoding='utf-8')
print(f"Read: {len(content):,} chars")

# ── Verify key anchors exist first ──────────────────────────────
anchors = {
    'ensureClinic comment': '// ── Get or create Supabase clinic for this user ──────────',
    'doLogin Supabase':     '_sb.auth.signInWithPassword({ email, password })',
    'ensureClinic in setup':'await ensureClinic(sbUser.id, \'Klinik Saya\');\n\n  setSession',
    'pull banner close':    "if (banner) { banner.style.display = 'none'; }\n}",
}
for name, anchor in anchors.items():
    found = anchor in content
    print(f"  {'✅' if found else '❌'} {name}")
    if not found:
        raise SystemExit(f"Anchor not found: {name}")

# ─────────────────────────────────────────────────────────
# 1. Insert cloudPushAll() + showSyncToast() before ensureClinic
# ─────────────────────────────────────────────────────────
ANCHOR1 = '// ── Get or create Supabase clinic for this user ──────────'
NEW_FUNCS = """// ── Push ALL local data tables to Supabase ──────────────
async function cloudPushAll() {
  if (!_sbClinicId) return;
  for (const key of SB_TABLES) { await cloudPush(key); }
  console.log('[CV Cloud] push all done');
}

// ── Sync status toast ─────────────────────────────────────
function showSyncToast(msg, type='info') {
  let t = document.getElementById('cvSyncToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'cvSyncToast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:10px 18px;border-radius:10px;font-size:0.85rem;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.18);transition:opacity 0.4s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.style.background = type==='success'?'#16a34a':type==='error'?'#dc2626':'#1a56db';
  t.style.color = '#fff';
  t.style.opacity = '1';
  t.textContent = msg;
  clearTimeout(t._hide);
  if (type !== 'info') t._hide = setTimeout(()=>{ t.style.opacity='0'; }, 3000);
}

// ── Get or create Supabase clinic for this user ──────────"""

content = content.replace(ANCHOR1, NEW_FUNCS, 1)
print("[1] Added cloudPushAll() + showSyncToast() ✓")

# ─────────────────────────────────────────────────────────
# 2. Fix doLogin — push then pull, with status feedback
# ─────────────────────────────────────────────────────────
OLD_ENSURE_LOGIN = """    // Ensure clinic exists in Supabase
    const activeName = getActiveClinic()?.name || 'Klinik Saya';
    await ensureClinic(sbUser.id, activeName);
    // Pull latest data from cloud
    await cloudPull();
    showSyncToast('✅ Data berjaya disync!', 'success');"""

if OLD_ENSURE_LOGIN not in content:
    # First time patch — old version without showSyncToast
    OLD_ENSURE_LOGIN = """    // Ensure clinic exists in Supabase
    const activeName = getActiveClinic()?.name || 'Klinik Saya';
    await ensureClinic(sbUser.id, activeName);
    // Pull latest data from cloud
    await cloudPull();"""

NEW_ENSURE_LOGIN = """    // Ensure clinic exists in Supabase
    const activeName = getActiveClinic()?.name || 'Klinik Saya';
    showSyncToast('☁️ Menyambung ke cloud...');
    await ensureClinic(sbUser.id, activeName);
    // Push local data to cloud first (so this device's data goes up)
    await cloudPushAll();
    // Then pull from cloud (get data from other devices)
    await cloudPull();
    showSyncToast('✅ Data disync!', 'success');"""

assert OLD_ENSURE_LOGIN in content, f"❌ doLogin ensureClinic block not found"
content = content.replace(OLD_ENSURE_LOGIN, NEW_ENSURE_LOGIN, 1)
print("[2] doLogin() — push+pull+toast ✓")

# ─────────────────────────────────────────────────────────
# 3. Fix doSetup — push after creating clinic
# ─────────────────────────────────────────────────────────
OLD_SETUP_ENSURE = """  // Create clinic in Supabase
  await ensureClinic(sbUser.id, 'Klinik Saya');

  setSession(currentUser);"""

NEW_SETUP_ENSURE = """  // Create clinic in Supabase
  showSyncToast('☁️ Mencipta klinik di cloud...');
  await ensureClinic(sbUser.id, 'Klinik Saya');
  // Push any existing local data up to cloud
  await cloudPushAll();
  showSyncToast('✅ Akaun berjaya dicipta!', 'success');

  setSession(currentUser);"""

assert OLD_SETUP_ENSURE in content, "❌ doSetup ensureClinic block not found"
content = content.replace(OLD_SETUP_ENSURE, NEW_SETUP_ENSURE, 1)
print("[3] doSetup() — push after register ✓")

# ─────────────────────────────────────────────────────────
# 4. Fix cloudPull() — refresh page after pulling data
# ─────────────────────────────────────────────────────────
OLD_PULL_CLOSE = "  if (banner) { banner.style.display = 'none'; }\n}"
NEW_PULL_CLOSE = """  if (banner) { banner.style.display = 'none'; }
  // Refresh active page to show pulled data
  try {
    const ap = document.querySelector('.cv-page.active');
    if (ap) refreshPage(ap.id.replace('page-',''));
  } catch(e) {}
}"""

assert OLD_PULL_CLOSE in content, "❌ cloudPull close not found"
content = content.replace(OLD_PULL_CLOSE, NEW_PULL_CLOSE, 1)
print("[4] cloudPull() — page refresh after pull ✓")

# ─────────────────────────────────────────────────────────
# 5. Sync to index.html and save
# ─────────────────────────────────────────────────────────
SRC.write_text(content, encoding='utf-8')
idx_path = Path('/sessions/peaceful-great-ride/mnt/ClinicVault/index.html')
idx_path.write_text(content, encoding='utf-8')
print(f"\n✅ Patch done! {len(content):,} chars → clinicvault.html + index.html")
