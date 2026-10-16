;==============================================================================
;  15 - COLOUR CYCLING TEXT ("notewriter" style)
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  A page of text whose colours flow like a wave from the top left to the
;  bottom right. The characters never change - only the colour RAM.
;
;  What you can learn here:
;    * colour RAM ($D800): one colour per character cell, independent of the
;      character itself
;    * colour gradients sorted by brightness
;    * printing a text page with KERNAL CHROUT (PETSCII, RETURN codes)
;    * a delay of one frame by waiting for a raster line
;
;  Further reading on Codebase64:
;    https://codebase64.net/doku.php?id=base:colour_flashing_notewriter_style
;
;  Press SPACE to return to BASIC.
;==============================================================================

        !to "15_color_cycling_text.prg", cbm

COLORRAM    = $d800
CHROUT      = $ffd2
GETIN       = $ffe4

col_ptr     = $fb               ; zero page pointer into the colour RAM

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

        ldx #0                  ; print the page (0-terminated, max 255 bytes
-       lda page_text,x         ;  per block - there are 3 blocks)
        beq +
        jsr CHROUT
        inx
        bne -
+       ldx #0
-       lda page_text2,x
        beq +
        jsr CHROUT
        inx
        bne -
+       ldx #0
-       lda page_text3,x
        beq frame
        jsr CHROUT
        inx
        bne -

frame
-       lda $d012               ; wait for the bottom of the screen
        cmp #$fa
        bne -

        ; colour of cell (column, row) = wave[(column + row * 2 - phase) AND 63]
        lda #<COLORRAM
        sta col_ptr
        lda #>COLORRAM
        sta col_ptr + 1
        lda phase
        sta row_start
        ldx #25                 ; 25 rows
.row    lda row_start
        sta .start + 1          ; start index of this row (self-modifying)
        ldy #0
.start  lda #0                  ; A = wave index of column 0
.col    pha
        and #63
        stx .savex + 1
        tax
        lda wave,x
.savex  ldx #0
        sta (col_ptr),y
        pla
        clc
        adc #1                  ; next column: next colour in the wave
        iny
        cpy #40
        bne .col

        lda col_ptr             ; next row: pointer + 40
        clc
        adc #40
        sta col_ptr
        bcc +
        inc col_ptr + 1
+       lda row_start
        clc
        adc #2                  ; each row starts 2 colours further
        sta row_start
        dex
        bne .row

        dec phase               ; the wave moves to the right / down

        jsr GETIN               ; SPACE = exit
        cmp #' '
        bne frame
        lda #14
        sta $d020
        lda #6
        sta $d021
        lda #147
        jmp CHROUT

phase       !byte 0
row_start   !byte 0

; 64 colours: two soft gradients through the brightness steps
wave    !byte 11,11,12,12,15,15,1,1,1,1,15,15,12,12,11,11
        !byte 6,6,14,14,3,3,13,13,1,1,13,13,3,3,14,14
        !byte 9,9,2,2,8,8,10,10,7,7,1,1,7,7,10,10
        !byte 8,8,2,2,9,9,4,4,10,10,15,15,10,10,4,4

;------------------------------------------------------------------------------
; The text (PETSCII). 147 = clear screen, 13 = RETURN
;------------------------------------------------------------------------------
page_text
        !byte 147, 13
        !pet "        c64 acme editor presents", 13, 13
        !pet "      ***  colour cycling text  ***", 13, 13, 13
        !pet "  every character on this screen keeps", 13
        !pet "  its shape. only the colour ram at", 13
        !byte 0
page_text2
        !pet "  $d800-$dbe7 is rewritten 50 times per", 13
        !pet "  second. the colours come from a table", 13
        !pet "  of 64 entries, sorted by brightness,", 13
        !pet "  so the wave looks smooth.", 13, 13
        !byte 0
page_text3
        !pet "  notewriters in old demos used this to", 13
        !pet "  make long texts look alive.", 13, 13, 13
        !pet "        press space to exit", 13
        !byte 0
