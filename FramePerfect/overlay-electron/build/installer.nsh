!macro customInit
  SetShellVarContext all
!macroend

!macro _RunSilent _CMD
  nsExec::ExecToStack '${_CMD}'
  Pop $0
  Pop $1
!macroend

!macro _InstallMSI _MSI
  !insertmacro _RunSilent '"$SYSDIR\msiexec.exe" /i "${_MSI}" /qn /norestart'
!macroend

!macro _InstallEXE _EXE _ARGS
  !insertmacro _RunSilent '"${_EXE}" ${_ARGS}'
!macroend

!macro customInstall
  ; Drivers under $INSTDIR\resources\prereqs
  ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Services\ViGEmBus" "DisplayName"
  ${If} $0 == ""
    ${If} ${FileExists} "$INSTDIR\resources\prereqs\ViGEmBus.msi"
      !insertmacro _InstallMSI "$INSTDIR\resources\prereqs\ViGEmBus.msi"
    ${ElseIf} ${FileExists} "$INSTDIR\resources\prereqs\ViGEmBus.exe"
      !insertmacro _InstallEXE "$INSTDIR\resources\prereqs\ViGEmBus.exe" "/quiet /norestart"
    ${EndIf}
  ${EndIf}

  ReadRegStr $1 HKLM "SYSTEM\CurrentControlSet\Services\HidHide" "DisplayName"
  ${If} $1 == ""
    ${If} ${FileExists} "$INSTDIR\resources\prereqs\HidHide.msi"
      !insertmacro _InstallMSI "$INSTDIR\resources\prereqs\HidHide.msi"
    ${ElseIf} ${FileExists} "$INSTDIR\resources\prereqs\HidHide.exe"
      !insertmacro _InstallEXE "$INSTDIR\resources\prereqs\HidHide.exe" "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-"
    ${EndIf}
  ${EndIf}

  ; DS4Windows shortcut
  ${If} ${FileExists} "$INSTDIR\resources\thirdparty\DS4Windows\DS4Windows.exe"
    CreateDirectory "$SMPROGRAMS\FramePerfect HUD"
    CreateShortCut "$SMPROGRAMS\FramePerfect HUD\DS4Windows.lnk" "$INSTDIR\resources\thirdparty\DS4Windows\DS4Windows.exe"
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\FramePerfect HUD\DS4Windows.lnk"
!macroend
