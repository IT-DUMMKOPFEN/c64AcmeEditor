;==============================================================================
;  SNIPPET: Show an Advanced Art Studio picture (.ocp / .mpic, multicolour)
;  Category: Graphics                    Type: program (open as a new file)
;------------------------------------------------------------------------------
;  OCP Advanced Art Studio saves multicolour pictures like Koala Painter,
;  but in a different order (10018 bytes with load address):
;
;      address $2000  8000 bytes  bitmap
;      address $3f40  1000 bytes  screen RAM
;      address $4328     1 byte   border colour
;      address $4329     1 byte   background colour
;      address $4338  1000 bytes  colour RAM
;
;  Loaded to its own address $2000 (VIC bank 0); screen and colour data
;  are copied to $0400 and $d800.
;
;  Replace "data/picture.ocp" by your own picture. Press SPACE to return.
;==============================================================================

PICTURE     = $2000
SCREEN_DATA = $3f40
BORDER_DATA = $4328
BG_DATA     = $4329
COLOR_DATA  = $4338
SCREEN      = $0400

        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

start
        ldx #0
-       !for block, 0, 3 {
            lda SCREEN_DATA + block * 250,x
            sta SCREEN + block * 250,x
            lda COLOR_DATA + block * 250,x
            sta $d800 + block * 250,x
        }
        inx
        cpx #250
        bne -
        lda BORDER_DATA
        sta $d020
        lda BG_DATA
        sta $d021

        lda #%00011000          ; screen $0400, bitmap $2000
        sta $d018
        lda #%00111011          ; bitmap mode
        sta $d011
        lda #%11011000          ; multicolour
        sta $d016

-       jsr $ffe4
        cmp #' '
        bne -

        lda #$15
        sta $d018
        lda #$1b
        sta $d011
        lda #$c8
        sta $d016
        lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544

        * = PICTURE
        !bin "data/picture.ocp",, 2
