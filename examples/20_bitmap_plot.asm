;==============================================================================
;  20 - HIRES BITMAP: PLOTTING A FUNCTION
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  Switches to the 320 x 200 high resolution bitmap mode, draws a
;  coordinate system and plots a sine and a "damped" sine curve pixel by
;  pixel - like a graphing calculator.
;
;  The bitmap is organised like the character screen: 8 bytes on top of
;  each other form one 8 x 8 cell, 40 cells form a row of 320 bytes.
;  So the byte of pixel (x, y) is
;
;     $2000 + (y / 8) * 320 + (x / 8) * 8 + (y AND 7)
;
;  and the bit inside the byte is  $80 >> (x AND 7).
;  The plot routine gets this with tables instead of multiplications.
;
;  What you can learn here:
;    * hires bitmap mode: $D011 bit 5, bitmap address in $D018
;    * colours in hires mode come from the SCREEN RAM (not the colour RAM):
;      high nibble = pixel colour, low nibble = background colour
;    * a fast plot routine with look-up tables (precalculated by ACME)
;    * 16-bit X coordinates
;    * "colour clash": only 2 colours per 8x8 cell - where the curves and
;      the axes meet, the colour of the last curve wins
;
;  Further reading on Codebase64:
;    https://codebase64.net/doku.php?id=base:dots_and_plots
;    https://codebase64.net/doku.php?id=base:built_in_screen_modes
;
;  Press SPACE to return to BASIC.
;==============================================================================

        !to "20_bitmap_plot.prg", cbm

PI          = 3.14159265
BITMAP      = $2000             ; 8000 bytes
SCREEN      = $0400             ; colours of the 8x8 cells
AXIS_Y      = 100               ; y of the x axis
AXIS_X      = 16                ; x of the y axis

ptr         = $fb               ; byte address of the pixel
xpos        = $fd               ; 16-bit x ($fd/$fe)
ypos        = $02               ; y 0..199
curve_x     = $03               ; 16-bit loop counter ($03/$04)

;------------------------------------------------------------------------------
; BASIC start line: 10 SYS 2061
;------------------------------------------------------------------------------
        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

;------------------------------------------------------------------------------
        !zone main
start
        lda #0
        sta $d020

        ; ---- clear the bitmap (8000 bytes = 32 pages - 192 bytes, we clear 32) ---
        lda #<BITMAP
        sta ptr
        lda #>BITMAP
        sta ptr + 1
        lda #0
        ldx #32                 ; 32 pages = $2000-$3FFF
        ldy #0
-       sta (ptr),y
        iny
        bne -
        inc ptr + 1
        dex
        bne -

        ; ---- colours: light grey pixels on dark blue ---------------------------
        ldx #0
        lda #$f6                ; high nibble 15 = pixel, low nibble 6 = background
-       sta SCREEN,x
        sta SCREEN + $100,x
        sta SCREEN + $200,x
        sta SCREEN + $2e8,x
        inx
        bne -

        ; ---- switch the VIC to bitmap mode -------------------------------------------
        lda #%00111011          ; bit 5 = bitmap mode, display on, 25 rows
        sta $d011
        lda #%00011000          ; screen at $0400, bitmap at $2000
        sta $d018

        jsr draw_axes

        ; ---- curve 1: sine, 1.5 waves --------------------------------------------------
        lda #$76                ; yellow pixels (where the curve is drawn)
        sta curve_color
        lda #<sine_y
        sta table
        lda #>sine_y
        sta table + 1
        jsr draw_curve

        ; ---- curve 2: damped oscillation -------------------------------------------------
        lda #$d6                ; light green
        sta curve_color
        lda #<damped_y
        sta table
        lda #>damped_y
        sta table + 1
        jsr draw_curve

wait    jsr $ffe4               ; SPACE = exit
        cmp #' '
        bne wait
        lda #$1b                ; text mode again
        sta $d011
        lda #$15
        sta $d018
        lda #14
        sta $d020
        jmp $e544

;------------------------------------------------------------------------------
; draw_curve: for x = AXIS_X .. 319: plot (x, table[x - AXIS_X])
; Two pixels per frame - so you can watch it being drawn.
;------------------------------------------------------------------------------
        !zone draw_curve
draw_curve
        lda #0
        sta curve_x
        sta curve_x + 1
.loop
        lda curve_x             ; frame delay: every 2nd pixel wait
        and #1
        bne +
-       lda $d012
        cmp #$f8
        bne -
+
        ; table address + counter (counter can be > 255: 16-bit add)
        lda table
        clc
        adc curve_x
        sta .read + 1           ; self-modifying code: patch the address
        lda table + 1
        adc curve_x + 1
        sta .read + 2
.read   lda $ffff               ; (address patched above) y of the curve
        sta ypos
        lda curve_x             ; x = counter + AXIS_X
        clc
        adc #AXIS_X
        sta xpos
        lda curve_x + 1
        adc #0
        sta xpos + 1
        jsr plot
        jsr set_color

        inc curve_x
        bne +
        inc curve_x + 1
+       lda curve_x + 1         ; until counter = 320 - AXIS_X
        cmp #>(320 - AXIS_X)
        bne .loop
        lda curve_x
        cmp #<(320 - AXIS_X)
        bne .loop
        rts

;------------------------------------------------------------------------------
; draw_axes: horizontal line at AXIS_Y, vertical line at AXIS_X, tick marks
;------------------------------------------------------------------------------
        !zone draw_axes
draw_axes
        lda #AXIS_Y             ; x axis
        sta ypos
        lda #0
        sta xpos
        sta xpos + 1
-       jsr plot
        inc xpos
        bne +
        inc xpos + 1
+       lda xpos + 1
        beq -
        lda xpos
        cmp #<320
        bne -

        lda #AXIS_X             ; y axis
        sta xpos
        lda #0
        sta xpos + 1
        sta ypos
-       jsr plot
        inc ypos
        lda ypos
        cmp #200
        bne -

        ; tick marks every 32 pixels on the x axis (5 pixels high)
        lda #AXIS_X
        sta xpos
.tick   ldx #AXIS_Y - 2
-       stx ypos
        jsr plot
        ldx ypos
        inx
        cpx #AXIS_Y + 3
        bne -
        lda xpos
        clc
        adc #32
        sta xpos
        lda xpos + 1
        adc #0
        sta xpos + 1
        beq .tick               ; x < 256
        lda xpos
        cmp #<320
        bcc .tick
        rts

;------------------------------------------------------------------------------
; plot: set the pixel (xpos, ypos). xpos 0..319, ypos 0..199
;------------------------------------------------------------------------------
        !zone plot
plot
        ldy ypos
        lda xpos                ; x AND $F8 = (x / 8) * 8: byte offset of the cell
        and #%11111000
        clc
        adc row_lo,y            ; + start of the cell row + (y AND 7)
        sta ptr
        lda row_hi,y
        adc xpos + 1            ; + x high byte (256 = 32 cells * 8)
        sta ptr + 1
        lda xpos
        and #7
        tax
        ldy #0
        lda (ptr),y
        ora bit_mask,x          ; set the bit
        sta (ptr),y
        rts

;------------------------------------------------------------------------------
; set_color: give the 8x8 cell of (xpos, ypos) the colour curve_color
;------------------------------------------------------------------------------
        !zone set_color
set_color
        lda ypos                ; cell row = y / 8
        lsr
        lsr
        lsr
        tay
        lda xpos + 1            ; cell column = x / 8 (9 bit value)
        lsr
        lda xpos
        ror
        lsr
        lsr
        clc
        adc scr_lo,y
        sta ptr
        lda scr_hi,y
        adc #0
        sta ptr + 1
        ldy #0
        lda curve_color
        sta (ptr),y
        rts

;------------------------------------------------------------------------------
; Tables (all calculated by ACME)
;------------------------------------------------------------------------------
curve_color !byte $f6
table       !word 0             ; address of the curve table
bit_mask    !byte $80, $40, $20, $10, $08, $04, $02, $01

; start address of every pixel row: BITMAP + (y / 8) * 320 + (y AND 7)
row_lo      !for y, 0, 199 { !byte <(BITMAP + (y >> 3) * 320 + (y & 7)) }
row_hi      !for y, 0, 199 { !byte >(BITMAP + (y >> 3) * 320 + (y & 7)) }

; start address of every screen row (for the cell colours)
scr_lo      !for r, 0, 24 { !byte <(SCREEN + r * 40) }
scr_hi      !for r, 0, 24 { !byte >(SCREEN + r * 40) }

; the curves: y for every x (304 values)
WIDTH = 320 - AXIS_X
sine_y      !for i, 0, WIDTH - 1 {
                !byte AXIS_Y - int(80 * sin(float(i) * 3 * PI / WIDTH) + 0.5)
            }
damped_y    !for i, 0, WIDTH - 1 {
                !byte AXIS_Y - int(90 * cos(float(i) * 8 * PI / WIDTH) * 2.71828 ^ (-float(i) * 3 / WIDTH) + 0.5)
            }
