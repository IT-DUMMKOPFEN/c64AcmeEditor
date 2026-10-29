;==============================================================================
;  SNIPPET: Show an Art Studio picture (.art / .aas, hires)
;  Category: Graphics                    Type: program (open as a new file)
;------------------------------------------------------------------------------
;  OCP Art Studio saves hires pictures (320 x 200 pixels, 2 colours per
;  8x8 cell). The file (9009 bytes + load address):
;
;      offset  0     2 bytes  load address ($2000)
;      offset  2  8000 bytes  bitmap
;      offset 8002 1000 bytes screen RAM: high nibble = colour of a 1 bit,
;                             low nibble = colour of a 0 bit
;      offset 9002    7 bytes rest (often the border colour first)
;
;  Hires mode needs no colour RAM. The picture is loaded to $2000 (VIC
;  bank 0); the colours are copied to the screen RAM at $0400.
;
;  Replace "data/picture.art" by your own picture. Press SPACE to return.
;==============================================================================

PICTURE     = $2000
SCREEN_DATA = PICTURE + 8000    ; $3f40
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
        }
        inx
        cpx #250
        bne -
        lda #0
        sta $d020               ; black border

        lda #%00011000          ; screen $0400, bitmap $2000 (bank 0)
        sta $d018
        lda #%00111011          ; bitmap mode
        sta $d011
        lda #%11001000          ; hires: multicolour OFF
        sta $d016

-       jsr $ffe4
        cmp #' '
        bne -

        lda #$15
        sta $d018
        lda #$1b
        sta $d011
        lda #14
        sta $d020
        jmp $e544               ; clear screen (overwrites our colours)

        * = PICTURE
        !bin "data/picture.art",, 2
