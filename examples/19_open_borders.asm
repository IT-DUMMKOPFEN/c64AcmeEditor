;==============================================================================
;  19 - OPENING THE TOP AND BOTTOM BORDER (sprites in the border)
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  Normally nothing can be shown in the upper and lower border. With a
;  famous trick the VIC-II "forgets" to switch the border on - and sprites
;  become visible there. Eight balls fly through the opened borders.
;
;  How the trick works:
;    The VIC switches the border on when the raster reaches line 251 (in
;    25 row mode) or line 247 (in 24 row mode). If we switch to 24 rows
;    ($D011 bit 3 = 0) while the beam is BETWEEN these lines (e.g. line 249),
;    the VIC has already missed line 247 and does not compare with 251 any
;    more: the border stays open for the bottom and top area. Later in the
;    frame (before line 247) we switch back to 25 rows.
;
;  In the open border the VIC shows the last byte of the VIC bank ($3FFF in
;  bank 0) as a pattern in the background colour. We set it to 0, so the
;  open border is empty.
;
;  What you can learn here:
;    * $D011 bit 3 (RSEL: 24/25 rows) and the border unit of the VIC-II
;    * two raster interrupts with exact line numbers
;    * sprite Y coordinates outside the normal screen (top < 50, bottom > 250)
;
;  Further reading on Codebase64:
;    https://codebase64.net/doku.php?id=vic:opening_the_top_bottom_borders
;    https://codebase64.net/doku.php?id=base:displaying_graphics_using_3fff
;    https://codebase64.net/doku.php?id=base:introduction_to_raster_irqs
;
;  Press SPACE to return to BASIC.
;==============================================================================

        !to "19_open_borders.prg", cbm

PI          = 3.14159265
SCREEN      = $0400
COLORRAM    = $d800
SPRITE_DATA = $2000
IRQ_OPEN    = 249               ; between line 247 and 251
IRQ_CLOSE   = 20                ; somewhere in the top border: back to 25 rows
TOP_Y       = 22                ; sprites 0-3: in the upper border
BOTTOM_Y    = 254               ; sprites 4-7: in the lower border

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
        lda #6
        sta $d021
        jsr $e544
        ldx #0                  ; text in the middle of the screen
-       lda info,x
        sta SCREEN + 10 * 40,x
        lda #1
        sta COLORRAM + 10 * 40,x
        inx
        cpx #120
        bne -

        lda #0
        sta $3fff               ; empty pattern in the open border

        ; ---- sprites ------------------------------------------------------------------
        ldx #7
-       lda #SPRITE_DATA / 64
        sta SCREEN + $3f8,x     ; all 8 sprites show the ball
        lda ball_colors,x
        sta $d027,x
        dex
        bpl -
        lda #%11111111
        sta $d015               ; all on
        sta $d01c               ; all multicolour
        lda #1
        sta $d025               ; multicolour 1: white (highlight)
        lda #11
        sta $d026               ; multicolour 2: dark grey (shadow)
        ldx #0
-       lda #TOP_Y
        sta $d001,x             ; Y of sprites 0-3
        lda #BOTTOM_Y
        sta $d009,x             ; Y of sprites 4-7
        inx
        inx
        cpx #8
        bne -

        ; ---- raster interrupt ---------------------------------------------------------
        sei
        lda #$7f
        sta $dc0d               ; CIA 1 timer interrupt off
        lda $dc0d
        lda #<irq_open
        sta $0314
        lda #>irq_open
        sta $0315
        lda #IRQ_OPEN
        sta $d012
        lda $d011
        and #%01111111          ; raster line bit 8 = 0
        sta $d011
        lda #1
        sta $d01a               ; raster interrupt on
        cli

wait    jsr $ffe4               ; SPACE = exit
        cmp #' '
        bne wait

        sei
        lda #0
        sta $d01a
        sta $d015
        lda #$ff
        sta $d019               ; clear pending VIC interrupts
        lda #$31                ; KERNAL interrupt back
        sta $0314
        lda #$ea
        sta $0315
        lda #$81
        sta $dc0d
        lda #$1b                ; 25 rows
        sta $d011
        cli
        lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544

;------------------------------------------------------------------------------
; irq_open (line 249): 24 rows - the VIC misses the border start
;------------------------------------------------------------------------------
irq_open
        lda $d011
        and #%01110111          ; bit 3 = 0: 24 rows (bit 7 = 0: line < 256)
        sta $d011

        lda #<irq_close         ; next interrupt: back to 25 rows
        sta $0314
        lda #>irq_close
        sta $0315
        lda #IRQ_CLOSE
        sta $d012
        lda #1
        sta $d019               ; acknowledge (write 1 to clear the raster flag)
        jmp $ea81               ; end of interrupt (restore registers)

;------------------------------------------------------------------------------
; irq_close (line 20): 25 rows again, move the sprites, keyboard
;------------------------------------------------------------------------------
irq_close
        lda $d011
        ora #%00001000          ; bit 3 = 1: 25 rows
        and #%01111111
        sta $d011

        jsr move_sprites

        lda #<irq_open
        sta $0314
        lda #>irq_open
        sta $0315
        lda #IRQ_OPEN
        sta $d012
        lda #1
        sta $d019               ; acknowledge
        jmp $ea31               ; KERNAL: keyboard etc. (once per frame)

;------------------------------------------------------------------------------
; move_sprites: X = sine curves, every ball with another phase
;------------------------------------------------------------------------------
        !zone move_sprites
move_sprites
        inc phase
        lda #0
        sta msb                 ; collects the 9th X bits
        ldx #0                  ; X = sprite number
.loop   txa
        asl
        asl
        asl
        asl
        asl                     ; sprite * 32 = phase offset
        clc
        adc phase
        cpx #4                  ; sprites 4-7 fly in the other direction
        bcc +
        eor #$ff
+       tay
        stx .savex + 1
        txa
        asl
        tax                     ; X = sprite * 2 (register offset)
        lda xsine_lo,y
        sta $d000,x
        lda xsine_hi,y          ; 0 or 1
        lsr                     ; -> carry
        ror msb                 ; -> into the collected bits (from the left)
.savex  ldx #0
        inx
        cpx #8
        bne .loop
        lda msb                 ; after 8 RORs the bit of sprite 0 is bit 0
        sta $d010
        rts

phase       !byte 0
msb         !byte 0
ball_colors !byte 2, 7, 5, 14, 4, 10, 3, 8

; X positions 24..320 (visible screen area for a 24 pixel sprite)
xsine_lo    !for i, 0, 255 { !byte <int(172 + 148 * sin(float(i) * 2 * PI / 256)) }
xsine_hi    !for i, 0, 255 { !byte >int(172 + 148 * sin(float(i) * 2 * PI / 256)) }

;              1234567890123456789012345678901234567890
info    !scr "  the upper and lower borders are open! "
        !scr "  sprites can fly where normally only   "
        !scr "  the border colour is shown.           "

;------------------------------------------------------------------------------
; Sprite: a multicolour ball (12 x 21 double wide pixels).
; Pixel pairs: 00 transparent, 01 white ($D025), 10 sprite colour,
; 11 dark grey ($D026). Generated by ACME: a circle with a highlight.
;------------------------------------------------------------------------------
        * = SPRITE_DATA
        !for y, 0, 20 {
            !for b, 0, 2 {
                !set bits = 0
                !for p, 0, 3 {
                    !set px = b * 4 + p             ; 0..11 (double wide pixels)
                    !set dx = float(px) - 5.5
                    !set dy = (float(y) - 10) / 2   ; pixels are twice as wide
                    !set d = dx * dx + dy * dy
                    !set col = 0
                    !if d < 30 { !set col = 2 }     ; ball
                    !if d < 30 & d >= 20 & dx + dy > 2 { !set col = 3 }   ; shadow
                    !set hx = dx + 2
                    !set hy = dy + 2
                    !if hx * hx + hy * hy < 2.5 { !set col = 1 }          ; highlight
                    !set bits = bits | (col << (6 - p * 2))
                }
                !byte bits
            }
        }
        !byte 0
