;==============================================================================
;  SNIPPET: Stable raster IRQ (double IRQ)
;  Category: Interrupts                  Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  A normal raster interrupt starts with a "jitter" of up to 7 cycles: the
;  CPU first finishes its current instruction. For effects that change
;  colours in the middle of a line this jitter is visible as flickering
;  edges. The double IRQ removes it:
;
;    1. The first interrupt sets a second one for the next line and then
;       waits with NOPs (2 cycles each). The second interrupt therefore
;       arrives with only 0 or 1 cycle of jitter.
;    2. The second interrupt compares $d012 at the very end of a line: if
;       the line has already changed, one cycle less is spent (beq *+2).
;  After that the code runs at exactly the same cycle in every frame.
;
;  The demo effect: colour bars in the lower border, one colour per line,
;  each line takes exactly 63 cycles (PAL). There are no bad lines in the
;  border, so the timing is never disturbed.
;
;  Needs ROMs off ($fffe vector). How to use:  jsr stable_init
;  Further reading: https://codebase64.net/doku.php?id=base:double_irq_explained
;==============================================================================

STABLE_LINE = $f9               ; first interrupt (lower border, no bad lines)
BAR_LINES   = 16

        !zone stable_init
stable_init
        sei
        lda #$7f
        sta $dc0d
        sta $dd0d
        lda $dc0d
        lda $dd0d
        lda #$35                ; ROMs off, I/O on
        sta $01
        lda #<stable_irq1
        sta $fffe
        lda #>stable_irq1
        sta $ffff
        lda #<.nmi
        sta $fffa
        lda #>.nmi
        sta $fffb
        lda #STABLE_LINE
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
.nmi    rti

        !zone stable_irq
stable_irq1
        sta .save_a + 1         ; save registers (self-modifying, fast)
        stx .save_x + 1
        sty .save_y + 1
        lda #<stable_irq2       ; second interrupt on the next line
        sta $fffe
        lda #>stable_irq2
        sta $ffff
        inc $d012
        lda #$ff
        sta $d019               ; acknowledge the first interrupt
        tsx                     ; remember the stack pointer
        cli                     ; allow the second interrupt ...
        nop                     ; ... it hits one of these NOPs
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop

stable_irq2
        txs                     ; forget the return address of the 2nd IRQ
        ldx #$08                ; wait until the end of the line
-       dex
        bne -
        bit $00
        lda $d012               ; still the same line?
        cmp $d012
        beq +                   ; 3 cycles if yes, 2 if no: jitter removed
+
        ; ---- stable from here: one colour per raster line --------------------
        ldx #0
.line   lda bar_colors,x        ; 4 cycles
        sta $d020               ; 4
        nop                     ; 2
        ldy #9                  ; 2
-       dey                     ; 9 x 5 - 1 = 44
        bne -
        inx                     ; 2
        cpx #BAR_LINES          ; 2
        bne .line               ; 3   = 63 cycles = one PAL raster line
        lda #0
        sta $d020

        lda #<stable_irq1       ; back to the first interrupt
        sta $fffe
        lda #>stable_irq1
        sta $ffff
        lda #STABLE_LINE
        sta $d012
        lda #$ff
        sta $d019
.save_a lda #0
.save_x ldx #0
.save_y ldy #0
        rti

bar_colors  !byte 6, 14, 3, 1, 3, 14, 6, 0, 2, 8, 7, 1, 7, 8, 2, 0
