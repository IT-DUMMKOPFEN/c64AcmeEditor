;==============================================================================
;  SNIPPET: Show a Koala Painter picture (.kla / .koa)
;  Category: Graphics                    Type: program (open as a new file)
;------------------------------------------------------------------------------
;  Koala Painter is the most common C64 multicolour picture format
;  (160 x 200 pixels, 4 colours per 8x8 cell). The file (10003 bytes):
;
;      offset  0     2 bytes  load address ($6000)
;      offset  2  8000 bytes  bitmap
;      offset 8002 1000 bytes screen RAM  (colours 1 and 2 of each cell)
;      offset 9002 1000 bytes colour RAM  (colour 3 of each cell)
;      offset 10002   1 byte  background colour (colour 0)
;
;  Here the picture is loaded to $6000 (VIC bank 1, $4000-$7fff). The
;  bitmap stays where it is, screen and colour data are copied into the
;  screen RAM ($4400) and the colour RAM ($d800).
;
;  Replace "data/picture.kla" by your own picture (path relative to this
;  file). Press SPACE to return.
;==============================================================================

PICTURE     = $6000
BITMAP      = PICTURE           ; $6000
SCREEN_DATA = PICTURE + 8000    ; $7f40
COLOR_DATA  = PICTURE + 9000    ; $8328
BG_DATA     = PICTURE + 10000   ; $8710
SCREEN      = $4400             ; screen RAM in bank 1

        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

start
        ldx #0                  ; copy 4 x 250 bytes
-       !for block, 0, 3 {
            lda SCREEN_DATA + block * 250,x
            sta SCREEN + block * 250,x
            lda COLOR_DATA + block * 250,x
            sta $d800 + block * 250,x
        }
        inx
        cpx #250
        bne -
        lda BG_DATA
        sta $d021               ; colour 0 of the picture
        lda #0
        sta $d020

        lda $dd00               ; VIC bank 1: $dd00 bits 0-1 = %10
        and #%11111100
        ora #%00000010
        sta $dd00
        lda #%00011000          ; screen at bank + $0400, bitmap at bank + $2000
        sta $d018
        lda #%00111011          ; bitmap mode on
        sta $d011
        lda #%11011000          ; multicolour on
        sta $d016

-       jsr $ffe4               ; wait for SPACE
        cmp #' '
        bne -

        lda $dd00               ; back: bank 0, text mode
        ora #%00000011
        sta $dd00
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
        !bin "data/picture.kla",, 2     ; skip the 2-byte load address
