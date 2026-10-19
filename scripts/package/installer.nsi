; C64 ACME EDITOR - Windows installer (NSIS 3)
; Built by scripts/package/build.py with makensis, for example:
;   makensis -DSRCDIR=... -DOUTFILE=... -DICON=... -DVERSION=0.2b -DVERSION4=0.2.0.0 installer.nsi
;
; Installs for the current user (no administrator rights needed) into
; %LOCALAPPDATA%\Programs\C64 ACME EDITOR - the folder can be changed.

Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!define APPNAME   "C64 ACME EDITOR"
!define EXENAME   "C64 ACME EDITOR.exe"
!define PUBLISHER "IT-Dummköpfe"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\de.it-dummkoepfe.c64acmeeditor"
!define PROGID    "C64AcmeEditor.Source"

Name "${APPNAME} ${VERSION}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
InstallDirRegKey HKCU "${UNINSTKEY}" "InstallLocation"
BrandingText "${APPNAME} ${VERSION} - ${PUBLISHER}"

VIProductVersion "${VERSION4}"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "FileDescription" "${APPNAME} Setup"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright (C) 2026 ${PUBLISHER}"

!include "MUI2.nsh"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "This will install ${APPNAME} ${VERSION} by ${PUBLISHER}.$\r$\n$\r$\nACME, Exomizer and sidreloc are included. VICE (the C64 emulator) is not included - please install it separately to run your programs.$\r$\n$\r$\nClick Next to continue."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Start ${APPNAME}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "German"

Section "Install"
  SetOutPath "$INSTDIR"
  ; remove files of an older version first (keeps the user's settings,
  ; they live in %APPDATA%\C64 ACME EDITOR)
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  File /r "${SRCDIR}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall ${APPNAME}.exe"

  CreateShortCut "$SMPROGRAMS\${APPNAME}.lnk" "$INSTDIR\${EXENAME}"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}"

  ; "Open with" for ACME sources (does not take over existing associations)
  WriteRegStr HKCU "Software\Classes\${PROGID}" "" "ACME source"
  WriteRegStr HKCU "Software\Classes\${PROGID}\DefaultIcon" "" "$INSTDIR\${EXENAME},0"
  WriteRegStr HKCU "Software\Classes\${PROGID}\shell\open\command" "" '"$INSTDIR\${EXENAME}" "%1"'
  WriteRegStr HKCU "Software\Classes\.asm\OpenWithProgids" "${PROGID}" ""
  WriteRegStr HKCU "Software\Classes\.acme\OpenWithProgids" "${PROGID}" ""

  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME} ${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXENAME},0"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Uninstall ${APPNAME}.exe"'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\${APPNAME}.lnk"
  Delete "$DESKTOP\${APPNAME}.lnk"
  DeleteRegKey HKCU "Software\Classes\${PROGID}"
  DeleteRegValue HKCU "Software\Classes\.asm\OpenWithProgids" "${PROGID}"
  DeleteRegValue HKCU "Software\Classes\.acme\OpenWithProgids" "${PROGID}"
  DeleteRegKey HKCU "${UNINSTKEY}"
  ; only remove the folder if it really is our installation
  IfFileExists "$INSTDIR\${EXENAME}" 0 +2
    RMDir /r "$INSTDIR"
SectionEnd
