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

; customInit removed: old NSIS inside electron-builder does not support SetBrandingText.

!macro customInstall
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
!macroend
