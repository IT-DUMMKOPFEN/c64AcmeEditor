;==============================================================================
;  SNIPPET: Smooth vertical scroller (credits roll up)
;  Category: Effects                     Type: program (open as a new file)
;------------------------------------------------------------------------------
;  Text lines move up the screen pixel by pixel - like the end credits of a
;  film. $d011 bits 0-2 move the screen 0-7 pixels down. Counting from 7
;  down to 0 moves it up; at 0 all rows are copied one row up, a new text
;  line appears at the bottom and the counter starts at 7 again.
;
;  24-row mode ($d011 bit 3 = 0) hides the half rows at the top and the
;  bottom. The copy starts below the screen, at line 251, row by row from
;  the top: it is always ahead of the raster beam, so there is no flicker.
;
;  Change SPEED (frames per pixel) and the text (lines of 40 characters,
;  the end is marked with a line starting with $ff).
;==============================================================================

SCREEN      = $0400
SPEED       = 2
text_ptr    = $fb

        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

start
        lda #0
        sta $d020
        sta $d021
        lda #1                  ; white text
        sta $0286
        jsr $e544
        lda #<credits
        sta text_ptr
        lda #>credits
        sta text_ptr + 1
        sei                     ; no KERNAL interrupt during the copy

frame
        ldx #SPEED
.wait   lda $d011               ; wait for line 251 (below the screen)
        bmi .wait               ;  (raster bit 8 must be 0)
        lda $d012
        cmp #251
        bne .wait
-       lda $d012               ; wait until the line is over
        cmp #251
        beq -
        dex
        bne .wait

        dec yscroll             ; one pixel up
        bmi .coarse
        lda yscroll
        ora #%00010000          ; screen on, 24 rows, text mode
        sta $d011
        jmp .key
.coarse lda #7                  ; 8 pixels done: back to 7 ...
        sta yscroll
        ora #%00010000
        sta $d011               ; ... (set it first, then copy)
        jsr coarse              ; everything one row up + new line
.key

        lda #$7f                ; SPACE? (keyboard matrix)
        sta $dc00
        lda $dc01
        and #$10
        bne frame
        lda #$1b
        sta $d011
        lda #14
        sta $d020
        lda #6
        sta $d021
        cli
        jmp $e544

coarse                          ; rows 1-24 -> rows 0-23, top row first:
        !for row, 0, 23 {       ;  the copy stays ahead of the raster beam
            ldx #39
-           lda SCREEN + (row + 1) * 40,x
            sta SCREEN + row * 40,x
            dex
            bpl -
        }
        ldy #0                  ; new line into row 24 (end mark $ff?)
        lda (text_ptr),y
        cmp #$ff
        bne +
        lda #<credits
        sta text_ptr
        lda #>credits
        sta text_ptr + 1
+       ldy #39
-       lda (text_ptr),y
        sta SCREEN + 24 * 40,y
        dey
        bpl -
        lda text_ptr
        clc
        adc #40
        sta text_ptr
        bcc +
        inc text_ptr + 1
+       rts

yscroll     !byte 7

;              1234567890123456789012345678901234567890
credits !scr "                                        "
        !scr "           *** credits ***              "
        !scr "                                        "
        !scr "        code ........ you               "
        !scr "        graphics .... you               "
        !scr "        music ....... you               "
        !scr "                                        "
        !scr "      made with the c64 acme editor     "
        !scr "                                        "
        !scr "                                        "
        !scr "                                        "
        !byte $ff
