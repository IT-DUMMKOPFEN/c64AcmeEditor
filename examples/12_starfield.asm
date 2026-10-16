;==============================================================================
;  12 - PARALLAX STARFIELD
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  23 stars fly from right to left, each in its own screen row, at three
;  different speeds (and brightnesses) - the classic parallax starfield.
;  The stars move pixel by pixel although the screen is a character screen:
;  8 special characters contain a single dot at x = 0..7 inside the cell.
;
;  What you can learn here:
;    * copying the character ROM into RAM ($01 = $33 makes it readable)
;    * changing single characters of a charset ("redefining characters")
;    * 16-bit X positions (0..319) and the split into cell (x / 8) and
;      pixel inside the cell (x AND 7)
;    * look-up tables for the start address of every screen row
;
;  Further reading on Codebase64:
;    https://codebase64.net/doku.php?id=base:starfield
;    https://codebase64.net/doku.php?id=base:make_modified_character_sets
;
;  Press SPACE to return to BASIC.
;==============================================================================

        !to "12_starfield.prg", cbm

SCREEN      = $0400
COLORRAM    = $d800
CHARSET     = $3000             ; our copy of the character set
D018_VALUE  = %00011100         ; screen $0400, charset $3000
DOT_CHAR    = $40               ; characters $40-$47: dot at pixel 0-7
FIRST_ROW   = 2                 ; rows 2..24 get a star (row 0 = title)
STARS       = 23

row_ptr     = $fb               ; zero page pointer to a screen row

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
        jsr $e544               ; clear screen
        jsr copy_charset
        jsr make_dots
        lda #D018_VALUE
        sta $d018

        ldx #0                  ; title
-       lda title,x
        sta SCREEN + 9,x
        lda #7
        sta COLORRAM + 9,x
        inx
        cpx #22
        bne -

frame
-       lda $d012               ; once per frame (bottom of the screen)
        cmp #$fb
        bne -

        ldx #0                  ; X = star number
.star
        ; ---- pointer to the screen row of this star --------------------------
        lda row_lo,x
        sta row_ptr
        lda row_hi,x
        sta row_ptr + 1

        ; ---- erase the old dot --------------------------------------------------
        ldy old_cell,x
        lda #' '
        sta (row_ptr),y

        ; ---- x = x - speed (16 bit), wrap around below 0 -----------------------
        lda x_lo,x
        sec
        sbc speed,x
        sta x_lo,x
        lda x_hi,x
        sbc #0
        bpl +                   ; still >= 0
        lda x_lo,x              ; wrapped: add 320 = $0140
        clc
        adc #<320
        sta x_lo,x
        lda #>320
        adc #$ff                ; (high byte $ff + 1 + carry)
+       sta x_hi,x

        ; ---- cell = x / 8 (a 9-bit value shifted right 3 times) -----------------
        lda x_hi,x
        lsr                     ; bit 8 into the carry
        lda x_lo,x
        ror                     ; 9 bits -> divided by 2
        lsr                     ; / 4
        lsr                     ; / 8
        tay
        sta old_cell,x

        ; ---- character with the dot at pixel x AND 7 ----------------------------
        lda x_lo,x
        and #7
        ora #DOT_CHAR
        sta (row_ptr),y

        ; ---- colour by speed ------------------------------------------------------
        lda row_ptr + 1         ; colour RAM pointer = screen pointer + $d400
        clc
        adc #>(COLORRAM - SCREEN)
        sta row_ptr + 1
        lda speed,x
        stx .savex + 1
        tax
        lda star_colors - 1,x   ; speed 1..3 -> colour
.savex  ldx #0
        sta (row_ptr),y

        inx
        cpx #STARS
        bne .star

        jsr $ffe4               ; GETIN: SPACE = exit
        cmp #' '
        bne frame
        lda #$15
        sta $d018
        jmp $e544

;------------------------------------------------------------------------------
; copy_charset: ROM charset (upper case, 2 KB at $d000) -> CHARSET
;------------------------------------------------------------------------------
        !zone copy_charset
copy_charset
        sei                     ; no interrupts while I/O is switched off
        lda $01
        pha
        lda #$33                ; character ROM visible at $d000
        sta $01
        ldx #0
-       !for page, 0, 7 {
            lda $d000 + page * 256,x
            sta CHARSET + page * 256,x
        }
        inx
        bne -
        pla
        sta $01                 ; I/O back
        cli
        rts

;------------------------------------------------------------------------------
; make_dots: characters $40-$47 get one dot in pixel row 3 at x = 0..7
;------------------------------------------------------------------------------
        !zone make_dots
make_dots
        ldx #0                  ; X = character offset 0..63
-       lda #0
        sta CHARSET + DOT_CHAR * 8,x
        inx
        cpx #64
        bne -
        ldx #0                  ; X = dot position 0..7
        ldy #3                  ; Y = byte offset of pixel row 3
        lda #%10000000
-       sta CHARSET + DOT_CHAR * 8,y
        lsr                     ; next character: dot one pixel further right
        pha
        tya
        clc
        adc #8                  ; next character
        tay
        pla
        inx
        cpx #8
        bne -
        rts

;------------------------------------------------------------------------------
; Data
;------------------------------------------------------------------------------
title       !scr "parallax starfield    "   ; 22 characters
star_colors !byte 11, 15, 1                  ; slow = dark grey ... fast = white

; screen row addresses of the star rows
row_lo      !for r, FIRST_ROW, FIRST_ROW + STARS - 1 { !byte <(SCREEN + r * 40) }
row_hi      !for r, FIRST_ROW, FIRST_ROW + STARS - 1 { !byte >(SCREEN + r * 40) }

; start positions (spread over the screen) and speeds 1-3 (pseudo random)
x_lo        !for i, 0, STARS - 1 { !byte <((i * 137 + 50) % 320) }
x_hi        !for i, 0, STARS - 1 { !byte >((i * 137 + 50) % 320) }
speed       !for i, 0, STARS - 1 { !byte 1 + ((i * 7 + 3) % 3) }
old_cell    !fill STARS, 0
