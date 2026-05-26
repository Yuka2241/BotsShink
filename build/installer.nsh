; BotsShink custom NSIS hooks for electron-builder
; Safe uninstaller: only removes known BotsShink runtime folders inside $INSTDIR.

!macro customHeader
  ; Black Modern UI colors. Images are configured in package.json nsis settings.
  !ifndef MUI_BGCOLOR
    !define MUI_BGCOLOR "000000"
  !endif
  !ifndef MUI_TEXTCOLOR
    !define MUI_TEXTCOLOR "F2F2F2"
  !endif
!macroend

; Close the running BotsShink app before updating.
; This prevents Windows/NSIS from showing "Please close the application" during installation.
!macro customInit
  DetailPrint "Checking for running BotsShink.exe..."
  nsExec::ExecToLog 'taskkill /F /IM "BotsShink.exe"'
  Sleep 1200
!macroend


!macro customInstall
  ; Close the running app again right before files are written.
  nsExec::ExecToLog 'taskkill /F /IM "BotsShink.exe"'
  Sleep 800

  ; Marker proves this folder belongs to BotsShink install.
  FileOpen $0 "$INSTDIR\BotsShink.install.marker" w
  FileWrite $0 "BotsShink installer marker.$\r$\n"
  FileWrite $0 "AppId=com.botsshink.panel$\r$\n"
  FileWrite $0 "Only BotsShink uninstaller should delete known app folders here.$\r$\n"
  FileClose $0

  ; Runtime folders that the app may use next to the EXE.
  CreateDirectory "$INSTDIR\BotSkripts"
  CreateDirectory "$INSTDIR\logo"
  CreateDirectory "$INSTDIR\logs"

  ; Basic shortcuts without the electron-builder WinShell plugin.
  ; This avoids the Temp\WinShell.dll extraction issue on some Windows systems.
  CreateDirectory "$SMPROGRAMS\BotsShink"
  CreateShortCut "$SMPROGRAMS\BotsShink\BotsShink.lnk" "$INSTDIR\BotsShink.exe"
  CreateShortCut "$SMPROGRAMS\BotsShink\Uninstall BotsShink.lnk" "$INSTDIR\Uninstall BotsShink.exe"
  CreateShortCut "$DESKTOP\BotsShink.lnk" "$INSTDIR\BotsShink.exe"
!macroend

!macro customUnInstall
  ; Ask before deleting editable runtime folders. This never deletes parent folders.
  MessageBox MB_YESNO|MB_ICONQUESTION "Delete BotsShink runtime files from the install folder?\n\nOnly these BotsShink paths inside the install directory will be removed:\n- BotSkripts\n- logo\n- logs\n- config\n- cache\n- BotsShink.install.marker\n\nNo files outside this app folder will be touched." IDNO BotsShinkSkipRuntimeDelete

  IfFileExists "$INSTDIR\BotsShink.install.marker" 0 BotsShinkSkipRuntimeDelete
    RMDir /r "$INSTDIR\BotSkripts"
    RMDir /r "$INSTDIR\logo"
    RMDir /r "$INSTDIR\logs"
    RMDir /r "$INSTDIR\config"
    RMDir /r "$INSTDIR\cache"
    Delete "$INSTDIR\BotsShink.install.marker"
  BotsShinkSkipRuntimeDelete:

  ; Remove only BotsShink shortcuts created by this installer.
  Delete "$DESKTOP\BotsShink.lnk"
  Delete "$SMPROGRAMS\BotsShink\BotsShink.lnk"
  Delete "$SMPROGRAMS\BotsShink\Uninstall BotsShink.lnk"
  RMDir "$SMPROGRAMS\BotsShink"
!macroend
