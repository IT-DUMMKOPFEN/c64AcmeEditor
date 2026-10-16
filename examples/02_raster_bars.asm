;==============================================================================
;  02 - RASTER BARS (border + background)
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  Colourful bars that move through the border and the background. The colour
;  registers are changed on every single raster line while the VIC-II draws
;  the picture ("raster time").
;
;  What you can learn here:
;    * the raster beam: $D012 (and bit 7 of $D011) tell you which of the
;      312 PAL lines is drawn right now
;    * polling the raster line instead of using interrupts
;    * "bad lines": every 8th line the VIC-II stops the CPU for ~40 cycles to
;      fetch the characters. That would make our colour changes jitter.
;      Trick used here: we keep changing the vertical scroll register so that
;      a bad line never happens (an effect called FLD - Flexible Line
;      Distance). The text area then simply shows the background colour.
;    * self-modifying code and tables prepared by ACME at assembly time
;    * reading the keyboard directly via CIA 1 (SPACE = exit)
;
;  Border and background get two different colour tables, the border bars
;  move up and the background bars move down.
;==============================================================================

        !to "02_raster_bars.prg", cbm

BORDER  = $d020
BGCOLOR = $d021
RASTER  = $d012                 ; current raster line (bits 0-7)
CTRL1   = $d011                 ; bit 7 = raster line bit 8, bits 0-2 = y scroll
CIA1_A  = $dc00                 ; keyboard matrix: column select (write)
CIA1_B  = $dc01                 ; keyboard matrix: row read

FIRST   = $1c                   ; first raster line with bars
LINES   = 226                   ; number of lines with bars ($1c..$fd)

offset_b = $fb                  ; zero page: animation offset for the border
offset_g = $fc                  ;            ... and for the background

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
        sei                     ; no interrupts - we need all the CPU time
        lda #0
        sta $3fff               ; the VIC shows this byte when no characters
                                ; are fetched (FLD) - 0 = plain background
        sta offset_b
        sta offset_g

frame
        ; ---- wait for raster line FIRST (with bit 8 = 0!) -------------------
.wait   lda RASTER
        cmp #FIRST
        bne .wait
        bit CTRL1               ; bit 7 of $d011 is bit 8 of the raster line:
        bmi .wait               ; line 256+FIRST also has $d012 = FIRST

        lda offset_g            ; patch the background table address once
        sta .bg + 1             ; per frame (self-modifying code)
        ldx #0                  ; X = line counter
        ldy offset_b            ; Y = position in the border colour table

.line   lda RASTER              ; wait until the next raster line begins
-       cmp RASTER
        beq -

        ; ---- this happens at the very start of a raster line ---------------
        ; (the whole loop takes ~40 of the 63 cycles a PAL line has)
        lda bar_colors,y        ; border colour for this line
        sta BORDER
.bg     lda bg_colors,x         ; background: "bg_colors + offset_g + X"
        sta BGCOLOR
        lda fld_values,x        ; FLD: y-scroll that avoids a bad line
        sta CTRL1
        iny
        inx
        cpx #LINES
        bne .line

        ; ---- below the bars: black, normal screen ---------------------------
        lda #0
        sta BORDER
        sta BGCOLOR
        lda #$1b                ; default value for $d011
        sta CTRL1

        inc offset_b            ; border bars move up ...
        dec offset_g            ; ... background bars move down,
        dec offset_g            ;     twice as fast

        ; ---- SPACE pressed? (keyboard matrix column 7, row 4) -----------------
        lda #%01111111          ; select column 7
        sta CIA1_A
        lda CIA1_B
        and #%00010000          ; row 4 = SPACE (0 = pressed)
        bne frame

        ; ---- exit: restore everything and return to BASIC --------------------
        lda #$ff
        sta CIA1_A              ; deselect all keyboard columns
        lda #14
        sta BORDER
        lda #6
        sta BGCOLOR
        cli
        rts

;------------------------------------------------------------------------------
; 256 bytes of colours: 8 bars of 32 lines each. The colours of a bar go
; from dark to bright and back, sorted by brightness (luminance):
;   black 0, blue 6, brown 9, dark grey 11, red 2, purple 4, orange 8,
;   grey 12, light blue 14, green 5, light red 10, light grey 15,
;   cyan 3, light green 13, yellow 7, white 1
;------------------------------------------------------------------------------
        !align 255, 0           ; start on a page boundary: "lda bar_colors,y"
                                ; then never crosses a page (constant timing)
bar_colors
        !byte 0,0,0,0,6,6,14,14,3,3,1,1,3,3,14,6,  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; blue
        !byte 0,0,0,0,9,9,2,2,8,8,10,7,1,7,10,8,   2,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; red
        !byte 0,0,0,0,11,11,5,5,13,13,1,1,13,5,11, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; green
        !byte 0,0,0,0,6,4,4,14,14,15,1,15,14,4,6,  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; purple
        !byte 0,0,0,0,9,8,8,10,15,7,1,7,15,10,8,9, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; orange
        !byte 0,0,0,0,11,12,12,15,15,1,1,15,12,11, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; grey
        !byte 0,0,0,0,6,14,3,13,7,1,7,13,3,14,6,   0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; rainbow
        !byte 0,0,0,0,2,10,7,1,1,7,10,2,           0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; fire
        !if * - bar_colors != 256 { !error "colour table must have 256 entries" }

;------------------------------------------------------------------------------
; Background colours: blue and purple bars, stored TWICE (512 bytes) so that
; "bg_colors + offset + X" never reads past the end of the table.
; Must start on a page boundary because we patch the low byte of its address.
;------------------------------------------------------------------------------
        !align 255, 0
bg_colors
        !for copy, 1, 2 {
            !for bar, 0, 7 {
                !byte 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0
                !if bar & 1 {
                    !byte 9,9,2,2,4,4,10,10, 7,7,10,4,2,9,0,0   ; red/purple bar
                } else {
                    !byte 6,6,6,14,14,3,3,13, 1,13,3,14,6,6,0,0 ; blue bar
                }
            }
        }

;------------------------------------------------------------------------------
; FLD values, one per line: (raster line + 5) AND 7, screen on, 25 rows.
; The first loop iteration runs on line FIRST+1.
;------------------------------------------------------------------------------
fld_values
        !for i, 0, LINES - 1 {
            !byte ((FIRST + 1 + i + 4) & 7) | %00011000
        }
