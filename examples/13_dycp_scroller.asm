;==============================================================================
;  13 - DYCP SCROLLER (Different Y Character Position)
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  A text scroller where every character bounces on its own sine curve.
;  The characters are not printed as characters - they are drawn into a
;  small "canvas" made of 40 x 3 characters at any pixel height.
;
;  How it works:
;    * Screen column c shows the characters c*3, c*3+1, c*3+2 (one above the
;      other). In memory these 3 characters are 24 continuous bytes, so a
;      glyph drawn at height y simply goes to  canvas + c * 24 + y.
;    * Every frame the 8 bytes of each visible letter are copied (from a copy
;      of the character ROM) to the new height - together with one empty byte
;      above and one below. The height changes by at most 1 pixel per frame,
;      so these two empty bytes erase the old position. No need to clear the
;      whole canvas every frame - that would be too slow.
;    * The whole screen scrolls smoothly with $D016, after 8 pixels the text
;      moves on by one letter.
;
;  What you can learn here:
;    * a charset used as a small bitmap
;    * indirect indexed addressing for copying glyphs
;    * smooth scrolling with $D016 + coarse scrolling of a text pointer
;
;  Further reading on Codebase64:
;    https://codebase64.net/doku.php?id=magazines:chacking6  (DYCP article, "The demo corner")
;    https://codebase64.net/doku.php?id=base:text_scroll
;
;  Press SPACE to return to BASIC.
;==============================================================================

        !to "13_dycp_scroller.prg", cbm

PI          = 3.14159265
SCREEN      = $0400
COLORRAM    = $d800
CANVAS      = $3000             ; 120 characters (40 columns x 3) = 960 bytes
FONT        = $3800             ; copy of the ROM font (not shown by the VIC)
D018_VALUE  = %00011100         ; screen $0400, characters $3000
ROW         = 11                ; screen row of the canvas (rows 11-13)
BLANK       = 255               ; an empty character for the rest of the screen

src         = $fb               ; glyph pointer
dst         = $fd               ; canvas pointer

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
        sta $d021
        jsr copy_font
        jsr clear_canvas        ; once at the start
        jsr setup_screen
        lda #D018_VALUE
        sta $d018

frame
-       lda $d012               ; wait for a line below the canvas
        cmp #$c0
        bne -

        lda xscroll             ; set the fine scroll (38 columns)
        sta $d016
        jsr draw_letters

        ; ---- scrolling -------------------------------------------------------------
        dec xscroll
        dec xscroll
        bpl +
        lda #6                  ; 8 pixels done: next letter
        sta xscroll
        inc text_pos
+       inc wave                ; the wave moves too
        inc wave
        inc wave

        jsr $ffe4               ; GETIN: SPACE = exit
        cmp #' '
        bne frame
        lda #$15
        sta $d018
        lda #$c8
        sta $d016
        jmp $e544

;------------------------------------------------------------------------------
; draw_letters: copy the 8 bytes of 40 letters to their sine height
;------------------------------------------------------------------------------
        !zone draw_letters
draw_letters
        ldx #0                  ; X = screen column
.col
        ; ---- letter for this column: text[text_pos + column] -----------------------
        txa
        clc
        adc text_pos
        tay
        lda text,y              ; screen code 0..63 (the text is 256 bytes long)
        tay
        lda glyph_lo,y          ; src = FONT + code * 8 - 1 (from a table: fast)
        sta src
        lda glyph_hi,y
        sta src + 1

        ; ---- height: 1..15 pixels from the sine table ------------------------------
        txa
        asl
        asl
        asl                     ; column * 8 = phase difference
        clc
        adc wave
        tay
        lda sine,y
        ; dst = CANVAS + column * 24 + height - 1   (the empty byte above)
        clc
        adc col_lo,x
        sta dst
        lda col_hi,x
        adc #0
        sta dst + 1

        ; ---- 10 bytes: empty, 8 glyph bytes, empty (unrolled loop) ---------------
        ldy #0
        lda #0
        sta (dst),y
        !for i, 1, 8 {
            ldy #i
            lda (src),y
            sta (dst),y
        }
        ldy #9
        lda #0
        sta (dst),y

        inx
        cpx #40
        bne .col
        rts

;------------------------------------------------------------------------------
; clear_canvas: 960 bytes = 3 x 256 + 192
;------------------------------------------------------------------------------
        !zone clear_canvas
clear_canvas
        lda #0
        ldx #0
-       sta CANVAS,x
        sta CANVAS + $100,x
        sta CANVAS + $200,x
        inx
        bne -
        ldx #192
-       sta CANVAS + $300 - 1,x
        dex
        bne -
        rts

;------------------------------------------------------------------------------
; copy_font: copy the upper case ROM font to FONT (read with $01 = $33)
;------------------------------------------------------------------------------
        !zone copy_font
copy_font
        sei
        lda $01
        pha
        lda #$33
        sta $01
        ldx #0
-       !for page, 0, 7 {
            lda $d000 + page * 256,x
            sta FONT + page * 256,x
        }
        inx
        bne -
        pla
        sta $01
        cli
        rts

;------------------------------------------------------------------------------
; setup_screen: rows ROW..ROW+2 show canvas characters, everything else is the
; empty character BLANK. Rainbow colours per column.
;------------------------------------------------------------------------------
        !zone setup_screen
setup_screen
        ldx #7                  ; make character BLANK empty
        lda #0
-       sta CANVAS + BLANK * 8,x
        dex
        bpl -
        ldx #0
        lda #BLANK
-       sta SCREEN,x
        sta SCREEN + $100,x
        sta SCREEN + $200,x
        sta SCREEN + $2e8,x
        inx
        bne -

        ldx #0                  ; X = column
-       txa                     ; character = column * 3 + row
        sta .tmp
        asl
        adc .tmp                ; * 3
        sta SCREEN + ROW * 40,x
        clc
        adc #1
        sta SCREEN + (ROW + 1) * 40,x
        clc
        adc #1
        sta SCREEN + (ROW + 2) * 40,x
        txa
        and #15
        tay
        lda rainbow,y
        sta COLORRAM + ROW * 40,x
        sta COLORRAM + (ROW + 1) * 40,x
        sta COLORRAM + (ROW + 2) * 40,x
        inx
        cpx #40
        bne -
        rts
.tmp    !byte 0

;------------------------------------------------------------------------------
; Data
;------------------------------------------------------------------------------
xscroll     !byte 6             ; bit 3 = 0: 38 column mode hides the edges
text_pos    !byte 0
wave        !byte 0
rainbow     !byte 2, 8, 7, 13, 5, 3, 14, 4, 10, 15, 1, 15, 10, 4, 14, 3

; canvas column start minus 1 (height 1 -> the empty byte goes to offset 0)
col_lo      !for c, 0, 39 { !byte <(CANVAS + c * 24 - 1) }
col_hi      !for c, 0, 39 { !byte >(CANVAS + c * 24 - 1) }

; glyph address minus 1 for screen codes 0..63 (so Y = 1..8 reads the glyph)
glyph_lo    !for c, 0, 63 { !byte <(FONT + c * 8 - 1) }
glyph_hi    !for c, 0, 63 { !byte >(FONT + c * 8 - 1) }

; heights 1..15: 10 bytes (1 + 8 + 1) must fit into the 24 bytes of a column
        !align 255, 0
sine        !for i, 0, 255 { !byte int(8.5 + 7 * sin(float(i) * 2 * PI / 256)) }

; exactly 256 characters, so "text_pos + column" wraps around by itself
text
        !scr "dycp - different y character position...   every letter "
        !scr "moves on its own sine wave. the letters are drawn into a "
        !scr "charset canvas of 40 x 3 characters.   made with the c64 "
        !scr "acme editor by it-dummkoepfe.   press space to exit.     "
        !fill 256 - (* - text), ' '
