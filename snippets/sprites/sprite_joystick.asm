;==============================================================================
;  SNIPPET: Move a sprite with the joystick (port 2)
;  Category: Sprites                     Type: program (open as a new file)
;------------------------------------------------------------------------------
;  Combines "Read the joystick" and "Sprite X position 0-511":
;  the sprite moves with the joystick in port 2 and stays inside the
;  visible screen. The fire button changes its colour (once per press).
;
;  In VICE: Settings > Joystick: port 2 = keyset or numpad.
;==============================================================================

SPRITE_DATA = $2000
SPEED       = 2
MIN_X       = 24
MAX_X       = 320               ; 344 - 24 (sprite width)
MIN_Y       = 50
MAX_Y       = 229               ; 250 - 21

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
        jsr $e544
        lda #SPRITE_DATA / 64
        sta $07f8
        lda #1
        sta $d015
        lda #7
        sta $d027

frame
-       lda $d012
        cmp #$fb
        bne -
-       lda $d012
        cmp #$fb
        beq -

        ; ---- joystick: bit = 0 means pressed ----------------------------------
        lda $dc00
        sta joy
        lsr joy                 ; up
        bcs +
        lda ypos
        cmp #MIN_Y + SPEED
        bcc +
        sbc #SPEED
        sta ypos
+       lsr joy                 ; down
        bcs +
        lda ypos
        cmp #MAX_Y - SPEED + 1
        bcs +
        adc #SPEED
        sta ypos
+       lsr joy                 ; left (16 bit)
        bcs +
        lda xpos + 1
        bne .left               ; x >= 256: always possible
        lda xpos
        cmp #MIN_X + SPEED
        bcc +
.left   lda xpos
        sec
        sbc #SPEED
        sta xpos
        bcs +
        dec xpos + 1
+       lsr joy                 ; right
        bcs +
        lda xpos + 1
        beq .right              ; x < 256: always possible
        lda xpos
        cmp #<(MAX_X - SPEED + 1)
        bcs +
.right  lda xpos
        clc
        adc #SPEED
        sta xpos
        bcc +
        inc xpos + 1
+       lsr joy                 ; fire: carry = 0 if pressed
        lda #0
        rol                     ; A = 1: not pressed
        cmp fire_last
        sta fire_last
        bcs +                   ; not a new press
        inc $d027               ; new press: next colour
+
        ; ---- write the position -----------------------------------------------
        lda xpos
        sta $d000
        lda xpos + 1
        sta $d010
        lda ypos
        sta $d001

        jsr $ffe4
        cmp #' '
        beq +
        jmp frame               ; (too far for a branch: max. 127 bytes back)
+       lda #0
        sta $d015
        lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544

xpos        !word 172
ypos        !byte 140
joy         !byte 0
fire_last   !byte 1

        * = SPRITE_DATA
        !byte %........, %...##..., %........
        !byte %........, %..####.., %........
        !byte %........, %.######., %........
        !byte %........, %########, %........
        !byte %.......#, %########, %#.......
        !byte %......##, %##.##.##, %##......
        !byte %.....###, %########, %###.....
        !byte %....####, %########, %####....
        !byte %...#####, %########, %#####...
        !byte %..######, %########, %######..
        !byte %.#######, %########, %#######.
        !byte %########, %########, %########
        !byte %###...##, %#..##..#, %##...###
        !byte %##.....#, %#......#, %#.....##
        !byte %#......., %........, %.......#
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte 0
