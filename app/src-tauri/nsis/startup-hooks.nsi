; startup-hooks.nsi — Sprint 31.0
;
; Tauri v2 NSIS hooks file for GregLite startup registration.
; Referenced via tauri.conf.json: bundle.windows.nsis.hooks
;
; Tauri calls !macro customInstall after files are extracted and !macro
; customUnInstall before files are removed. Both operate on HKCU (no
; elevation required — matches the Rust runtime path exactly).
;
; ── Installer checkbox (interactive) ─────────────────────────────────────────
; Tauri v2's hooks system does not support injecting wizard pages — that
; requires a full customTemplate. The behavior below defaults to "write on
; install" (equivalent to the checkbox being pre-checked), which is the
; intended default per the sprint spec. The user can opt out via the
; Settings → Launch Behavior toggle at any time.
;
; If an interactive checkbox is required in the future, replace this file
; with a customTemplate that injects an nsDialogs page before the install
; section.  The registry key / value names below must remain identical so
; the Rust runtime can read/write the same entry.
; ─────────────────────────────────────────────────────────────────────────────

!define STARTUP_REG_KEY   "Software\Microsoft\Windows\CurrentVersion\Run"
!define STARTUP_REG_VALUE "GregLite"

; ── Install: write the startup registry entry ─────────────────────────────────
; $INSTDIR is the installation directory provided by Tauri's NSIS template.
; The value written here is the full path to the GregLite executable.
!macro customInstall
  WriteRegStr HKCU "${STARTUP_REG_KEY}" "${STARTUP_REG_VALUE}" "$INSTDIR\gregore.exe"
!macroend

; ── Uninstall: always remove the startup entry ────────────────────────────────
; Safe to call even if the value was removed via Settings — DeleteRegValue
; on a non-existent value is a no-op in NSIS.
!macro customUnInstall
  DeleteRegValue HKCU "${STARTUP_REG_KEY}" "${STARTUP_REG_VALUE}"
!macroend
