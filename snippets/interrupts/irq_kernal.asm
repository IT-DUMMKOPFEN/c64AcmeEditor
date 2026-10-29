;==============================================================================
;  SNIPPET: Raster IRQ initialisation (with KERNAL)
;  Category: Interrupts                  Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  A raster interrupt calls your routine every frame when the VIC-II reaches
;  a certain raster line - the base of music players, scrollers, raster bars.
;
;  irq_init      switches the KERNAL timer interrupt off and the raster
;                interrupt on. The KERNAL stays active (vector $0314), so
;                keyboard and KERNAL routines still work.
;  irq_handler   your code; it ends with JMP $EA31 (KERNAL: keyboard,
;                cursor, then returns). Use JMP $EA81 instead to skip the
;                KERNAL part (faster, but then no keyboard via GETIN).
;  irq_stop      switches back to the normal KERNAL interrupt.
;
;  Important: always acknowledge the VIC interrupt (write to $d019),
;  otherwise the interrupt fires again at once and the C64 hangs.
;
;  How to use:  jsr irq_init  ...  jsr irq_stop
;==============================================================================

IRQ_LINE    = $80               ; raster line of the interrupt (0-255 here)

        !zone irq_init
irq_init
        sei                     ; no interrupts while we change the vectors
        lda #$7f
        sta $dc0d               ; CIA 1: timer interrupts off
        lda $dc0d               ; read = acknowledge pending CIA interrupts
        lda #<irq_handler
        sta $0314               ; KERNAL IRQ vector (RAM)
        lda #>irq_handler
        sta $0315
        lda #IRQ_LINE
        sta $d012               ; raster line, bits 0-7
        lda $d011
        and #%01111111          ; raster line bit 8 = 0
        sta $d011
        lda #%00000001
        sta $d01a               ; VIC: raster interrupt on
        lda #$ff
        sta $d019               ; clear old VIC interrupt flags
        cli
        rts

        !zone irq_handler
irq_handler
        lda #$ff
        sta $d019               ; acknowledge the raster interrupt

        inc $d020               ; ---- your code here (example: a border line)
        ldx #8
-       dex
        bne -
        dec $d020

        jmp $ea31               ; KERNAL: keyboard, cursor, restore registers

        !zone irq_stop
irq_stop
        sei
        lda #0
        sta $d01a               ; raster interrupt off
        lda #$ff
        sta $d019
        lda #$31                ; KERNAL routine back
        sta $0314
        lda #$ea
        sta $0315
        lda #$81                ; CIA 1 timer A interrupt on
        sta $dc0d
        cli
        rts
