;==============================================================================
;  SNIPPET: Show a picture from separate raw files (bitmap, screen, colours)
;  Category: Graphics                    Type: program (open as a new file)
;------------------------------------------------------------------------------
;  Many converters (PC tools like "SPOT", "Retropixels", "png2prg" or your
;  own scripts) save the parts of a picture as separate files without a
;  load address. With !bin they are placed directly where the VIC-II reads
;  them - here in VIC bank 1:
;
;      bitmap.bin   8000 bytes   ->  $6000  (bitmap, bank + $2000)
;      screen.bin   1000 bytes   ->  $4400  (screen RAM, bank + $0400)
;      colors.bin   1000 bytes   ->  copied to $d800 (colour RAM is fixed
;                   + 1 byte bg      at $d800, it cannot be loaded there)
;
;  This is multicolour; for hires leave out the colour RAM and set
;  $d016 to $c8.
;==============================================================================

BITMAP      = $6000
SCREEN      = $4400
COLORS      = $4800             ; temporary place for the colour RAM data

        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

start
        ldx #0
-       !for block, 0, 3 {
            lda COLORS + block * 250,x
            sta $d800 + block * 250,x
        }
        inx
        cpx #250
        bne -
        lda COLORS + 1000       ; background colour (last byte)
        sta $d021
        lda #0
        sta $d020
        lda $dd00
        and #%11111100
        ora #%00000010          ; bank 1
        sta $dd00
        lda #%00011000          ; screen +$0400, bitmap +$2000
        sta $d018
        lda #%00111011
        sta $d011
        lda #%11011000          ; multicolour
        sta $d016

-       jsr $ffe4
        cmp #' '
        bne -

        lda $dd00
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

        * = SCREEN
        !bin "data/screen.bin"
        * = COLORS
        !bin "data/colors.bin"
        * = BITMAP
        !bin "data/bitmap.bin"
