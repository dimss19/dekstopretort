; ==============================================================================
; Professional NSIS Setup Wizard Script for SCADA Retort Desktop
; PT Indah Mesin - Industrial Retort Control System
; ==============================================================================

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to the SCADA Retort Setup Wizard"
  !define MUI_WELCOMEPAGE_TEXT "The Setup Wizard will install SCADA Retort on your computer.$\r$\n$\r$\nThis installer bundles all necessary components including standalone PHP 8.3 Runtime, SQLite Database, Modbus RTU Bridge, and USB-to-RS485 CH340 Driver.$\r$\n$\r$\nNo external server or database configuration is required.$\r$\n$\r$\nClick Next to continue or Cancel to exit the Setup Wizard."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstall
  DetailPrint "Memeriksa dan memasang Driver USB-to-RS485 CH340..."
  ${If} ${FileExists} "$INSTDIR\resources\drivers\CH341SER.EXE"
    ExecWait '"$INSTDIR\resources\drivers\CH341SER.EXE" /S'
  ${ElseIf} ${FileExists} "$INSTDIR\drivers\CH341SER.EXE"
    ExecWait '"$INSTDIR\drivers\CH341SER.EXE" /S'
  ${EndIf}
!macroend
