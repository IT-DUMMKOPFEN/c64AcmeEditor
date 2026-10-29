;==============================================================================
;  SNIPPET: Raster IRQ without KERNAL ($fffe)
;  Category: Interrupts                  Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  With BASIC and KERNAL ROM switched off ($01 = $35), the CPU takes the
;  interrupt address directly from $fffe/$ffff (RAM). This is faster (no
;  KERNAL code in between) and gives you 16 KB more RAM - the usual setup in
;  demos and games.
;
;  Without the KERNAL your handler must save and restore the registers
;  itself and end with RTI. KERNAL routines (CHROUT, GETIN ...) are not
;  available any more.
;
;  The NMI vector points to an RTI, so RESTORE does nothing. 
;
;  How to use:  jsr irq_init_nokernal   (call it once, then run your main loop)
;==============================================================================

IRQ_LINE    = $80               ; raster line of the interrupt

        !zone irq_init_nokernal
irq_init_nokernal
        sei
        lda #$7f
        sta $dc0d               ; CIA 1 interrupts off
        sta $dd0d               ; CIA 2 interrupts (NMI) off
        lda $dc0d               ; acknowledge pending ones
        lda $dd0d
        lda #$35                ; BASIC + KERNAL ROM off, I/O on
        sta $01
        lda #<irq_nokernal
        sta $fffe
        lda #>irq_nokernal
        sta $ffff
        lda #<.nmi
        sta $fffa
        lda #>.nmi
        sta $fffb
        lda #IRQ_LINE
        sta $d012
        lda $d011
        and #%01111111
        sta $d011
        lda #1
        sta $d01a               ; raster interrupt on
        lda #$ff
        sta $d019
        cli
        rts
.nmi    rti

        !zone irq_nokernal
irq_nokernal
        pha                     ; save A, X, Y (the KERNAL did this before)
        txa
        pha
        tya
        pha

        lda #$ff
        sta $d019               ; acknowledge

        inc $d020               ; ---- your code here
        ldx #8
-       dex
        bne -
        dec $d020

        pla                     ; restore Y, X, A
        tay
        pla
        tax
        pla
        rti
