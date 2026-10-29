;==============================================================================
;  SNIPPET: Moving raster bar
;  Category: Effects                     Type: program (open as a new file)
;------------------------------------------------------------------------------
;  A colour bar that goes up and down through border and background. The
;  colours are changed on every raster line: the program waits for the
;  start of the bar, then waits for each new line ($d012 changes) and
;  writes the next colour to $d020 and $d021.
;
;  The bar position comes from a sine table (calculated by ACME).
;
;  Simple version without interrupts and without stable timing: the colour
;  changes a few pixels after the start of each line, and on "bad lines"
;  (every 8th line of the text area) a bit later - you see small steps on
;  the left side. The snippet "Stable raster IRQ" shows how to avoid that.
;==============================================================================

PI          = 3.14159265
BAR_LINES   = 16

        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

start
        sei                     ; no KERNAL interrupt: it would disturb the timing
        lda #0
        sta $d020
        sta $d021

frame
        inc sine_pos
        ldx sine_pos
        lda sine,x
        sta bar_top

-       lda $d011               ; wait for raster line bar_top (bit 8 = 0)
        bmi -
        lda $d012
        cmp bar_top
        bne -

        ldx #0
.line   lda bar_colors,x
        ldy $d012
-       cpy $d012               ; wait until the next line starts
        beq -
        sta $d020
        sta $d021
        inx
        cpx #BAR_LINES
        bne .line

        lda #$7f                ; SPACE pressed? (keyboard matrix: no KERNAL)
        sta $dc00
        lda $dc01
        and #$10
        bne frame

        lda #14
        sta $d020
        lda #6
        sta $d021
        cli
        rts

sine_pos    !byte 0
bar_top     !byte 0
bar_colors  !byte 6, 4, 14, 3, 13, 1, 1, 13, 3, 14, 4, 6, 11, 0, 0, 0
sine        !for i, 0, 255 { !byte 60 + int(80 + 80 * sin(float(i) * 2 * PI / 256)) }
