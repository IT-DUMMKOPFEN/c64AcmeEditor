;==============================================================================
;  SNIPPET: Several raster IRQs per frame (IRQ chain)
;  Category: Interrupts                  Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  One interrupt handler, several raster lines: after each interrupt the
;  next line from a table is written to $d012. Here every zone gets its own
;  border and background colour - change the tables to your needs (for
;  example: split screen text/bitmap, scroller only in the last rows,
;  music player in the last zone).
;
;  The KERNAL part (keyboard) runs only once per frame, in the last zone.
;
;  How to use:  jsr chain_init
;==============================================================================

ZONES       = 4

        !zone chain_init
chain_init
        sei
        lda #$7f
        sta $dc0d
        lda $dc0d
        lda #<chain_irq
        sta $0314
        lda #>chain_irq
        sta $0315
        lda #0
        sta chain_zone
        lda chain_lines
        sta $d012
        lda $d011
        and #%01111111
        sta $d011
        lda #1
        sta $d01a
        lda #$ff
        sta $d019
        cli
        rts

        !zone chain_irq
chain_irq
        lda #$ff
        sta $d019               ; acknowledge
        ldx chain_zone
        lda chain_border,x      ; ---- the work of this zone
        sta $d020
        lda chain_bg,x
        sta $d021

        inx                     ; next zone (wrap around)
        cpx #ZONES
        bne +
        ldx #0
+       stx chain_zone
        lda chain_lines,x
        sta $d012               ; raster line for the next interrupt
        cpx #0
        beq +                   ; X = 0: the last zone of the frame is done
        jmp $ea81               ; end of interrupt without KERNAL tasks
+       jmp $ea31               ; once per frame: keyboard etc.

chain_zone   !byte 0
chain_lines  !byte $10, $72, $a2, $d2   ; must be in ascending order
chain_border !byte 0, 2, 5, 6
chain_bg     !byte 0, 9, 13, 14
