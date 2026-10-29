;==============================================================================
;  SNIPPET: Switch off BASIC and KERNAL ROM (with NMI blocker)
;  Category: Basics                      Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The processor port $01 decides what the CPU sees at $a000-$bfff (BASIC),
;  $d000-$dfff (I/O or character ROM) and $e000-$ffff (KERNAL):
;
;      $01 = $37   BASIC + I/O + KERNAL       (normal)
;      $01 = $36   RAM   + I/O + KERNAL       (BASIC off: 8 KB more RAM)
;      $01 = $35   RAM   + I/O + RAM          (all ROMs off, I/O still on)
;      $01 = $34   RAM everywhere             (careful: no I/O!)
;
;  With the KERNAL off, its interrupt vectors are gone. The CPU then reads
;  the IRQ/NMI vectors from RAM at $fffa-$ffff - this routine sets them:
;    * IRQ  -> your routine (see the "Raster IRQ without KERNAL" snippet)
;    * NMI  -> an RTI. The NMI is never acknowledged, so the RESTORE key
;              cannot disturb the program any more ("NMI blocker").
;
;  How to use:  jsr rom_off     (after that: no KERNAL calls like $ffd2!)
;  Changes:     A
;==============================================================================

        !zone rom_off
rom_off
        sei
        lda #$35                ; RAM at $a000-$bfff and $e000-$ffff, I/O on
        sta $01
        lda #<.nmi
        sta $fffa               ; NMI vector (RAM, under the KERNAL ROM)
        lda #>.nmi
        sta $fffb
        lda #<.irq
        sta $fffe               ; IRQ vector - replace .irq by your handler
        lda #>.irq
        sta $ffff
        ; NMI blocker: let CIA 2 timer A run out once without acknowledging
        ; it. The NMI line stays active, so no further NMI (RESTORE) occurs.
        lda #0
        sta $dd0e               ; stop timer A of CIA 2
        sta $dd04
        sta $dd05               ; timer value 0
        lda #$81
        sta $dd0d               ; timer A NMI on
        lda #$01
        sta $dd0e               ; start: the timer fires one NMI at once
        cli
        rts

.nmi    rti                     ; the NMI is not acknowledged on purpose
.irq    pha                     ; placeholder IRQ: acknowledge and return
        lda #$ff
        sta $d019
        pla
        rti
