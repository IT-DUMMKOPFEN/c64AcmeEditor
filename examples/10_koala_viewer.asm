;==============================================================================
;  10 - KOALA PICTURE VIEWER (.kla)
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  Shows a multicolour bitmap picture in the Koala Painter format.
;  Press SPACE to return to BASIC.
;
;  The Koala format (10003 bytes, loads to $6000):
;     $6000-$7f3f  bitmap      8000 bytes (40 x 25 cells of 8 bytes)
;     $7f40-$8327  screen RAM  1000 bytes (colours for bit pairs %01 / %10)
;     $8328-$870f  colour RAM  1000 bytes (colour for bit pair %11)
;     $8710        background  1 byte     (colour for bit pair %00)
;
;  What you can learn here:
;    * the VIC-II sees only 16 KB at a time: the "VIC bank" is chosen with
;      CIA 2 ($DD00, bits 0-1, inverted!)
;    * $D018 decides where screen RAM and bitmap are inside that bank
;    * multicolour bitmap mode: $D011 bit 5 (bitmap) + $D016 bit 4 (multicolour)
;    * copying 1000 bytes in 4 blocks of 250 with one loop
;
;  Here we use VIC bank 1 ($4000-$7fff): bitmap at $6000 (+$2000 in the bank),
;  screen RAM at $4400 (+$0400) - the screen colours are copied there.
;
;  Using your own picture: replace "gfx/picture.kla" with any .kla / .koa file.
;==============================================================================

        !to "10_koala_viewer.prg", cbm

PICTURE     = $6000
BITMAP      = PICTURE           ; 8000 bytes
SCREEN_DATA = PICTURE + 8000    ; $7f40
COLOR_DATA  = PICTURE + 9000    ; $8328
BG_DATA     = PICTURE + 10000   ; $8710

VIC_BANK    = $4000             ; bank 1
SCREEN      = VIC_BANK + $0400  ; screen RAM used while the picture is shown
COLORRAM    = $d800

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
        ; ---- copy screen colours and colour RAM (4 x 250 bytes) ---------------
        ldx #0
-       !for block, 0, 3 {
            lda SCREEN_DATA + block * 250,x
            sta SCREEN + block * 250,x
            lda COLOR_DATA + block * 250,x
            sta COLORRAM + block * 250,x
        }
        inx
        cpx #250
        bne -

        lda BG_DATA
        sta $d021               ; background colour (bit pair %00)
        lda #0
        sta $d020               ; black border

        ; ---- switch the VIC-II to bank 1 ($4000-$7fff) --------------------------
        lda $dd00
        and #%11111100
        ora #%00000010          ; %10 = bank 1 (the bits are inverted:
        sta $dd00               ;  %11 = bank 0, %10 = 1, %01 = 2, %00 = 3)

        ; ---- screen at +$0400, bitmap at +$2000 ---------------------------------
        lda #%00011000          ; bits 4-7: screen = 1 * $400
        sta $d018               ; bit 3:    bitmap = 1 * $2000

        ; ---- multicolour bitmap mode --------------------------------------------
        lda #%00111011          ; bit 5 = bitmap mode, screen on, 25 rows
        sta $d011
        lda #%00011000          ; bit 4 = multicolour, 40 columns
        sta $d016

        ; ---- wait for SPACE --------------------------------------------------------
-       jsr $ffe4               ; GETIN
        cmp #' '
        bne -

        ; ---- back to the normal text screen --------------------------------------
        lda $dd00
        ora #%00000011          ; bank 0
        sta $dd00
        lda #$15                ; screen $0400, upper case characters
        sta $d018
        lda #$1b                ; text mode
        sta $d011
        lda #$c8                ; single colour, 40 columns
        sta $d016
        lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544               ; clear screen (also resets colour RAM), RTS

;------------------------------------------------------------------------------
; The picture: skip the 2-byte load address of the .kla file
;------------------------------------------------------------------------------
        * = PICTURE
        !bin "gfx/picture.kla",, 2
