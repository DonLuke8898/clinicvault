#!/bin/bash
cd "/Users/luqman/Claude/Projects/ClinicVault"
echo "=== Git log ==="
git log --oneline -3
echo "=== Remote URL ==="
git remote -v
echo "=== SSH test ==="
ssh -T git@github.com 2>&1 || true
echo "=== Push ==="
git remote set-url origin git@github.com:DonLuke8898/clinicvault.git
git push origin main 2>&1
