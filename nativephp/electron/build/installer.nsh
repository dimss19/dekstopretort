; ==============================================================================
; Custom NSIS Installer Script for SCADA Retort Desktop
; PT Indah Mesin - Industrial Retort Control System
; ==============================================================================

!macro customInstall
  DetailPrint "Memeriksa dan memasang Driver USB-to-RS485 CH340..."
  ${If} ${FileExists} "$INSTDIR\resources\drivers\CH341SER.EXE"
    ExecWait '"$INSTDIR\resources\drivers\CH341SER.EXE" /S'
  ${EndIf}
!macroend
