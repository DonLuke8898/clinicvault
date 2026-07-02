#!/bin/bash
cd "/Users/luqman/Claude/Projects/ClinicVault"
rm -f .git/index.lock .git/HEAD.lock
git config user.email "bluqmanulhakim@gmail.com"
git config user.name "DonLuke"
git remote set-url origin git@github.com:DonLuke8898/clinicvault.git
git add src/store/useStore.js
git status
git commit -m "Fix: add owner_id to clinics insert to break RLS circular dependency"
git push origin main
