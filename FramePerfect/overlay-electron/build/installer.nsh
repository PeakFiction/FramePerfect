!macro customInit
  SetShellVarContext all
!macroend

!macro _RunSilent _CMD
  ; Run silently and capture exit code
  nsExec::ExecToStack '${_CMD}'
  Pop $0 ; exit code
  Pop $1 ; output (unused)
!macroend

!macro _InstallMSI _MSI
  !insertmacro _RunSilent '"$SYSDIR\msiexec.exe" /i "${_MSI}" /qn /norestart'
!macroend

!macro _InstallEXE _EXE _ARGS
  !insertmacro _RunSilent '"${_EXE}" ${_ARGS}'
!macroend

!macro customInstall
  ; Resources live under $INSTDIR\resources
  ; Detect first; only install if missing.

  ; ---------- ViGEmBus ----------
  ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Services\ViGEmBus" "DisplayName"
  ${If} $0 == ""
    ${If} ${FileExists} "$INSTDIR\resources\prereqs\ViGEmBus.msi"
      !insertmacro _InstallMSI "$INSTDIR\resources\prereqs\ViGEmBus.msi"
    ${ElseIf} ${FileExists} "$INSTDIR\resources\prereqs\ViGEmBus.exe"
      ; ViGEmBus EXE is a bootstrapper; quiet flags:
      ; prefer MSI-style bootstrapper flags
      !insertmacro _InstallEXE "$INSTDIR\resources\prereqs\ViGEmBus.exe" "/quiet /norestart"
      ; fallback (some builds are NSIS): uncomment if needed
      ; !insertmacro _InstallEXE "$INSTDIR\resources\prereqs\ViGEmBus.exe" "/S"
    ${EndIf}
  ${EndIf}

  ; ---------- HidHide ----------
  ReadRegStr $1 HKLM "SYSTEM\CurrentControlSet\Services\HidHide" "DisplayName"
  ${If} $1 == ""
    ${If} ${FileExists} "$INSTDIR\resources\prereqs\HidHide.msi"
      !insertmacro _InstallMSI "$INSTDIR\resources\prereqs\HidHide.msi"
    ${ElseIf} ${FileExists} "$INSTDIR\resources\prereqs\HidHide.exe"
      ; HidHide uses Inno Setup; quiet flags:
      !insertmacro _InstallEXE "$INSTDIR\resources\prereqs\HidHide.exe" "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-"
    ${EndIf}
  ${EndIf}

  ; ---------- DS4Windows shortcut ----------
  ${If} ${FileExists} "$INSTDIR\resources\thirdparty\DS4Windows\DS4Windows.exe"
    CreateDirectory "$SMPROGRAMS\FramePerfect HUD"
    CreateShortCut "$SMPROGRAMS\FramePerfect HUD\DS4Windows.lnk" "$INSTDIR\resources\thirdparty\DS4Windows\DS4Windows.exe"
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\FramePerfect HUD\DS4Windows.lnk"
!macroend
