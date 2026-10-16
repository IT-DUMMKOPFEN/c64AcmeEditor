;==============================================================================
;  08 - ROTATING 3D SQUARE
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  A square that tumbles in 3D space, drawn with real lines (Bresenham's
;  algorithm) into a 128 x 128 pixel area, double buffered so it never
;  flickers.
;
;  How it works:
;    * The drawing area is made of 16 x 16 = 256 characters. Every character
;      of the set is used exactly once, so the character set itself becomes a
;      small bitmap ("charset canvas"). Two character sets ($2000 and $2800)
;      are used in turn: we draw into the hidden one, then switch $D018.
;    * The characters are arranged column by column, so the byte for pixel
;      (x, y) is at  base + (x / 8) * 128 + y  - very fast to calculate.
;    * The 3D maths (rotation around three axes + perspective) is done by
;      ACME while assembling! For 128 animation steps the screen positions
;      of the 4 corners are stored in tables. The C64 only draws lines.
;
;  What you can learn here:
;    * charset canvas + double buffering via $D018
;    * Bresenham line drawing in 8 bit
;    * ACME macros (+edge, +clear_canvas) and assembly-time 3D maths
;==============================================================================

        !to "08_rotating_square.prg", cbm

PI          = 3.14159265
FRAMES      = 128               ; animation steps for one full turn
SCALE       = 26.0              ; size of the square
DIST        = 4.0               ; distance of the camera (perspective)

SCREEN      = $0400
COLORRAM    = $d800
CANVAS_A    = $2000             ; character set 1 (2 KB)
CANVAS_B    = $2800             ; character set 2 (2 KB)
D018_A      = %00011000         ; screen $0400, characters at $2000
D018_B      = %00011010         ; screen $0400, characters at $2800
LEFT        = 12                ; position of the canvas on the screen
TOP         = 4
LINE_COLOR  = 13                ; light green

; zero page variables
lx0     = $02                   ; line start / current point
ly0     = $03
lx1     = $04                   ; line end
ly1     = $05
ldx_    = $06                   ; |dx|, |dy| (the "_" avoids confusion
ldy_    = $07                   ;  with the LDX/LDY mnemonics)
lsx     = $08                   ; step x: +1 or -1 ($ff)
lsy     = $09                   ; step y
lerr    = $0a                   ; error term
lcount  = $0b                   ; pixels left
pptr    = $fb                   ; plot pointer ($fb/$fc)
sptr    = $fb                   ; (setup only) screen pointer
cptr    = $fd                   ; (setup only) colour pointer

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
        jsr setup_screen
        jsr clear_a
        jsr clear_b
        lda #0
        sta showing             ; 0 = canvas A is visible
        sta frame_nr
        lda #D018_A
        sta $d018

frame
        lda showing             ; draw into the canvas that is NOT visible
        bne .into_a
        jsr clear_b
        lda #>CANVAS_B
        jmp +
.into_a jsr clear_a
        lda #>CANVAS_A
+       sta buf_hi

        jsr draw_square

-       lda $d012               ; wait until the beam is below the canvas
        cmp #$f0
        bne -

        lda showing             ; show the canvas we just finished
        eor #1
        sta showing
        beq +
        lda #D018_B
        bne ++                  ; (always)
+       lda #D018_A
++      sta $d018

        inc frame_nr
        lda frame_nr
        and #FRAMES - 1
        sta frame_nr

        jsr $ffe4               ; GETIN: SPACE = exit
        cmp #' '
        bne frame
        lda #$15
        sta $d018
        jmp $e544               ; clear screen, back to BASIC

showing     !byte 0
frame_nr    !byte 0
buf_hi      !byte >CANVAS_A

;------------------------------------------------------------------------------
; draw_square: 4 lines between the corners of the current animation step
;------------------------------------------------------------------------------
!macro edge .a, .b {
        ldx frame_nr
        lda verts_x + .a * FRAMES, x
        sta lx0
        lda verts_y + .a * FRAMES, x
        sta ly0
        lda verts_x + .b * FRAMES, x
        sta lx1
        lda verts_y + .b * FRAMES, x
        sta ly1
        jsr draw_line
}

        !zone draw_square
draw_square
        +edge 0, 1
        +edge 1, 2
        +edge 2, 3
        +edge 3, 0
        rts

;------------------------------------------------------------------------------
; draw_line: Bresenham from (lx0, ly0) to (lx1, ly1), coordinates 0..127
;------------------------------------------------------------------------------
        !zone draw_line
draw_line
        ; ---- dx = |x1 - x0| and step direction sx -------------------------------
        lda lx1
        sec
        sbc lx0
        bcs +                   ; x1 >= x0 -> positive
        eor #$ff                ; negative: two's complement -> positive
        adc #1                  ; (carry is clear here)
        ldx #$ff                ; step -1
        bne ++
+       ldx #1                  ; step +1
++      sta ldx_
        stx lsx
        ; ---- dy = |y1 - y0| and sy ---------------------------------------------
        lda ly1
        sec
        sbc ly0
        bcs +
        eor #$ff
        adc #1
        ldx #$ff
        bne ++
+       ldx #1
++      sta ldy_
        stx lsy

        lda ldx_
        cmp ldy_
        bcc .y_major            ; |dx| < |dy| -> y is the main direction

        ; ---- mostly horizontal: one pixel per x step ----------------------------
        sta lcount              ; A = |dx| pixels to go
        lsr
        sta lerr                ; error = |dx| / 2
.x_loop jsr plot
        lda lcount
        beq .done
        dec lcount
        lda lx0                 ; x += sx
        clc
        adc lsx
        sta lx0
        lda lerr                ; error -= |dy|
        sec
        sbc ldy_
        sta lerr
        bpl .x_loop             ; still >= 0 -> same y
        clc
        adc ldx_                ; error += |dx|
        sta lerr
        lda ly0                 ; y += sy
        clc
        adc lsy
        sta ly0
        jmp .x_loop

        ; ---- mostly vertical: one pixel per y step ------------------------------
.y_major
        lda ldy_
        sta lcount
        lsr
        sta lerr
.y_loop jsr plot
        lda lcount
        beq .done
        dec lcount
        lda ly0
        clc
        adc lsy
        sta ly0
        lda lerr
        sec
        sbc ldx_
        sta lerr
        bpl .y_loop
        clc
        adc ldy_
        sta lerr
        lda lx0
        clc
        adc lsx
        sta lx0
        jmp .y_loop
.done   rts

;------------------------------------------------------------------------------
; plot: set pixel (lx0, ly0) in the canvas at buf_hi
;   address = base + (x / 16) * 256 + ((x / 8) AND 1) * 128 + y
;------------------------------------------------------------------------------
        !zone plot
plot
        ldx lx0
        ldy ly0
        lda plot_lo,x
        sta pptr
        lda plot_hi,x
        ora buf_hi              ; $20 or $28 plus 0..7
        sta pptr + 1
        lda (pptr),y
        ora plot_bit,x          ; set the bit of this pixel
        sta (pptr),y
        rts

plot_lo     !for x, 0, 127 { !byte ((x >> 3) & 1) * 128 }
plot_hi     !for x, 0, 127 { !byte x >> 4 }
plot_bit    !for x, 0, 127 { !byte 128 >> (x & 7) }

;------------------------------------------------------------------------------
; clear_a / clear_b: erase a canvas (2048 bytes) - generated by a macro
;------------------------------------------------------------------------------
!macro clear_canvas .base {
        lda #0
        tax
-       !for page, 0, 7 {
            sta .base + page * 256, x
        }
        inx
        bne -
        rts
}
clear_a +clear_canvas CANVAS_A
clear_b +clear_canvas CANVAS_B

;------------------------------------------------------------------------------
; setup_screen: everything black, the 16 x 16 canvas shows chars 0..255
;------------------------------------------------------------------------------
        !zone setup_screen
setup_screen
        lda #0
        sta $d020
        sta $d021
        tax
-       sta SCREEN,x            ; char 0 everywhere ...
        sta SCREEN + $100,x
        sta SCREEN + $200,x
        sta SCREEN + $2e8,x
        sta COLORRAM,x          ; ... in black (invisible)
        sta COLORRAM + $100,x
        sta COLORRAM + $200,x
        sta COLORRAM + $2e8,x
        inx
        bne -

        lda #<(SCREEN + TOP * 40 + LEFT)
        sta sptr
        lda #>(SCREEN + TOP * 40 + LEFT)
        sta sptr + 1
        lda #<(COLORRAM + TOP * 40 + LEFT)
        sta cptr
        lda #>(COLORRAM + TOP * 40 + LEFT)
        sta cptr + 1
        ldx #0                  ; X = canvas row 0..15
.row    txa                     ; character = column * 16 + row
        ldy #0                  ; Y = canvas column 0..15
.col    sta (sptr),y
        pha
        lda #LINE_COLOR
        sta (cptr),y
        pla
        clc
        adc #16
        iny
        cpy #16
        bne .col
        lda sptr                ; next screen row: +40
        clc
        adc #40
        sta sptr
        sta cptr
        bcc +
        inc sptr + 1
        inc cptr + 1
+       inx
        cpx #16
        bne .row
        rts

;------------------------------------------------------------------------------
; The 3D maths - executed by ACME, not by the C64!
; Corner v of the square (ux, uy, 0) is rotated around Z, Y and X, then
; projected:  screen = 64 + coordinate * DIST / (z + DIST) * SCALE
;------------------------------------------------------------------------------
!macro project .v, .f {
        !if .v = 0 { !set ux = -1.0 : !set uy = -1.0 }
        !if .v = 1 { !set ux =  1.0 : !set uy = -1.0 }
        !if .v = 2 { !set ux =  1.0 : !set uy =  1.0 }
        !if .v = 3 { !set ux = -1.0 : !set uy =  1.0 }
        !set a1 = float(.f) * 2 * PI / FRAMES   ; Y axis: one turn
        !set a2 = float(.f) * 4 * PI / FRAMES   ; X axis: two turns
        !set a3 = float(.f) * 2 * PI / FRAMES   ; Z axis: one turn
        !set x1 = ux * cos(a3) - uy * sin(a3)   ; rotate around Z
        !set y1 = ux * sin(a3) + uy * cos(a3)
        !set x2 = x1 * cos(a1)                  ; rotate around Y (z was 0)
        !set z2 = -x1 * sin(a1)
        !set y3 = y1 * cos(a2) - z2 * sin(a2)   ; rotate around X
        !set z3 = y1 * sin(a2) + z2 * cos(a2)
        !set p = DIST / (z3 + DIST)             ; perspective
        !set screen_x = int(64.5 + x2 * p * SCALE)
        !set screen_y = int(64.5 + y3 * p * SCALE)
}

verts_x
        !for v, 0, 3 {
            !for f, 0, FRAMES - 1 {
                +project v, f
                !byte screen_x
            }
        }
verts_y
        !for v, 0, 3 {
            !for f, 0, FRAMES - 1 {
                +project v, f
                !byte screen_y
            }
        }
