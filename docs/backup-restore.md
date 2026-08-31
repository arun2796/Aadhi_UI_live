# Database Backup, Disaster Recovery & Retention

## 1. Hot Backup Procedure (SQLite WAL Mode)
Because SQLite is configured in Write-Ahead Logging (`WAL`) mode, creating a snapshot during live operations requires the SQLite `VACUUM INTO` command or `.backup` API to prevent partial transaction corruptions:

```bash
# Automated Hot-Backup Script (PowerShell)
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backups/aadhicrackers_$timestamp.db"
sqlite3 aadhi_enterprise.db "VACUUM INTO '$backupFile'"
```

## 2. Restoration & Integrity Verification
1. **Verification Test:**
   ```bash
   sqlite3 backups/aadhicrackers_snapshot.db "PRAGMA integrity_check;"
   ```
2. **Restoration:**
   - Stop API application process.
   - Replace `aadhi_enterprise.db` with verified snapshot.
   - Restart API application and verify `/health` endpoint.
