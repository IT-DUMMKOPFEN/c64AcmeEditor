;==============================================================================
;  SNIPPET: Plot a pixel (hires bitmap, 320 x 200)
;  Category: Graphics                    Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The bitmap is built like the text screen: 8 bytes on top of each other
;  form one 8x8 cell, 40 cells form a row of 320 bytes. Pixel (x, y) is in
;
;      byte = BITMAP + (y / 8) * 320 + (x / 8) * 8 + (y AND 7)
;      bit  = $80 >> (x AND 7)
;
;  The multiplication is replaced by tables (made by ACME at assembly
;  time), so a pixel takes only about 50 cycles.
;
;  How to use:  lda #<x : sta plot_x : lda #>x : sta plot_x + 1   (0-319)
;               ldy #y (0-199) : jsr plot          (unplot: jsr unplot)
;  Zero page: $fb/$fc        Changes: A, X, Y
;==============================================================================

PLOT_BITMAP = $2000
plot_ptr    = $fb

        !zone plot
plot
        jsr .address
        lda (plot_ptr),y
        ora plot_bits,x         ; set the bit
        sta (plot_ptr),y
        rts

unplot
        jsr .address
        lda plot_bits,x
        eor #$ff
        and (plot_ptr),y        ; clear the bit
        sta (plot_ptr),y
        rts

.address                        ; Y = y -> plot_ptr, X = bit number, Y = 0
        lda plot_x
        and #%11111000          ; (x / 8) * 8
        clc
        adc plot_row_lo,y       ; + start of the pixel row
        sta plot_ptr
        lda plot_row_hi,y
        adc plot_x + 1          ; x >= 256: + 256
        sta plot_ptr + 1
        lda plot_x
        and #7
        tax
        ldy #0
        rts

plot_x      !word 0
plot_bits   !byte $80, $40, $20, $10, $08, $04, $02, $01
plot_row_lo !for y, 0, 199 { !byte <(PLOT_BITMAP + (y >> 3) * 320 + (y & 7)) }
plot_row_hi !for y, 0, 199 { !byte >(PLOT_BITMAP + (y >> 3) * 320 + (y & 7)) }
