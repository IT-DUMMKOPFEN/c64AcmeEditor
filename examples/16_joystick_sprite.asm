;==============================================================================
;  16 - JOYSTICK CONTROLLED SPRITE
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  Move a sprite with a joystick in port 2. The fire button changes the
;  colour and plays a short sound. The position is shown in hex on screen.
;
;  In VICE: Settings > Emulator > Joystick port 2 = "Numpad" (or a real
;  joystick). Numpad 8/2/4/6 = up/down/left/right, numpad 0 = fire.
;
;  What you can learn here:
;    * reading the joystick: $DC00 (port 2), bits 0-4, 0 = pressed
;    * 16-bit X coordinate + the 9th bit in $D010
;    * keeping a sprite inside the screen (minimum / maximum checks)
;    * detecting a NEW button press (compare with the previous state)
;    * printing a byte as two hex digits
;    * a simple SID sound effect
;
;  Further reading on Codebase64:
;    https://codebase64.net/doku.php?id=base:joystick_input_handling
;    https://codebase64.net/doku.php?id=base:8_bit_to_hexadecimal_conversion
;
;  Press SPACE to return to BASIC.
;==============================================================================

        !to "16_joystick_sprite.prg", cbm

SCREEN      = $0400
COLORRAM    = $d800
SPRITE_DATA = $2000
JOY2        = $dc00             ; bit 0 up, 1 down, 2 left, 3 right, 4 fire

MIN_X       = 24                ; sprite fully visible: x 24..320
MAX_X       = 320
MIN_Y       = 50                ; y 50..229
MAX_Y       = 229
SPEED       = 2

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
        lda #11
        sta $d021
        jsr $e544
        ldx #0                  ; info text
-       lda info,x
        sta SCREEN,x
        lda #1
        sta COLORRAM,x
        inx
        cpx #80
        bne -

        lda #SPRITE_DATA / 64
        sta $07f8               ; sprite 0 pointer
        lda #7
        sta $d027               ; yellow
        lda #1
        sta $d015               ; sprite 0 on

        lda #15                 ; SID: volume, voice 1 envelope
        sta $d418
        lda #$09
        sta $d405               ; attack 0, decay 9
        lda #$00
        sta $d406

frame
-       lda $d012               ; once per frame
        cmp #$f8
        bne -

        lda JOY2
        sta joy                 ; 0 bits = pressed

        ; ---- up / down -------------------------------------------------------------
        lsr joy                 ; bit 0 -> carry
        bcs +
        lda ypos                ; up: y - SPEED, not below MIN_Y
        sec
        sbc #SPEED
        cmp #MIN_Y
        bcs ++
        lda #MIN_Y
++      sta ypos
+       lsr joy                 ; bit 1 = down
        bcs +
        lda ypos
        clc
        adc #SPEED
        cmp #MAX_Y + 1
        bcc ++
        lda #MAX_Y
++      sta ypos
+
        ; ---- left / right (16 bit) ------------------------------------------------
        lsr joy                 ; bit 2 = left
        bcs +
        lda xpos
        sec
        sbc #SPEED
        sta xpos
        lda xpos + 1
        sbc #0
        sta xpos + 1
        bne +                   ; high byte 1 -> x >= 256, fine
        lda xpos
        cmp #MIN_X
        bcs +
        lda #MIN_X
        sta xpos
+       lsr joy                 ; bit 3 = right
        bcs +
        lda xpos
        clc
        adc #SPEED
        sta xpos
        lda xpos + 1
        adc #0
        sta xpos + 1
        beq +                   ; still < 256
        lda xpos                ; x >= 256: limit to MAX_X
        cmp #<MAX_X + 1
        bcc +
        lda #<MAX_X
        sta xpos
+
        ; ---- fire: only when it was not pressed in the last frame ----------------
        lsr joy                 ; bit 4 = fire, carry = 1: not pressed
        lda #0
        rol                     ; A = 1: not pressed, 0: pressed
        tax
        cmp fire_old
        beq +                   ; no change
        stx fire_old
        cpx #0
        bne +                   ; released - nothing to do
        jsr fire                ; just pressed
+
        ; ---- write the sprite registers ---------------------------------------------
        lda xpos
        sta $d000
        lda xpos + 1            ; 0 or 1 -> bit 0 of $d010
        sta $d010
        lda ypos
        sta $d001

        ; ---- show the position: "X=$0123 Y=$80" -----------------------------------
        lda xpos + 1
        ldx #3
        jsr print_hex
        lda xpos
        ldx #5
        jsr print_hex
        lda ypos
        ldx #11
        jsr print_hex

        jsr $ffe4               ; SPACE = exit
        cmp #' '
        beq +
        jmp frame
+       lda #0
        sta $d015
        sta $d418
        lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544

;------------------------------------------------------------------------------
; fire: next colour + a short "blip" on SID voice 1
;------------------------------------------------------------------------------
fire
        inc $d027
        lda #$00
        sta $d400
        lda #$30                ; frequency $3000
        sta $d401
        lda #$20                ; sawtooth, gate off ...
        sta $d404
        lda #$21                ; ... and on: the envelope restarts
        sta $d404
        rts

;------------------------------------------------------------------------------
; print_hex: print A as two hex digits at screen position SCREEN + 40 + X
;------------------------------------------------------------------------------
print_hex
        pha
        lsr                     ; high nibble
        lsr
        lsr
        lsr
        tay
        lda hex_digits,y
        sta SCREEN + 40,x
        pla
        and #$0f                ; low nibble
        tay
        lda hex_digits,y
        sta SCREEN + 41,x
        lda #1
        sta COLORRAM + 40,x
        sta COLORRAM + 41,x
        rts

;------------------------------------------------------------------------------
; Data
;------------------------------------------------------------------------------
xpos        !word 172           ; 16-bit X position
ypos        !byte 140
joy         !byte 0
fire_old    !byte 1             ; 1 = not pressed
hex_digits  !scr "0123456789abcdef"

info    !scr "joystick port 2: move, fire = colour.   "
        !scr "x=$     y=$             space = exit    "

;------------------------------------------------------------------------------
; Sprite: a little space ship (24 x 21), written in binary.
; "#" = pixel set, "." = empty (ACME allows these in binary numbers)
;------------------------------------------------------------------------------
        * = SPRITE_DATA
        !byte %........, %...##..., %........
        !byte %........, %..####.., %........
        !byte %........, %..####.., %........
        !byte %........, %.######., %........
        !byte %........, %.######., %........
        !byte %........, %########, %........
        !byte %.......#, %########, %#.......
        !byte %......##, %########, %##......
        !byte %.....###, %########, %###.....
        !byte %....###., %.######., %.###....
        !byte %...####., %.######., %.####...
        !byte %..######, %########, %######..
        !byte %.#######, %########, %#######.
        !byte %########, %########, %########
        !byte %########, %########, %########
        !byte %###...##, %########, %##...###
        !byte %##.....#, %########, %#.....##
        !byte %#......., %###..###, %.......#
        !byte %........, %.#....#., %........
        !byte %........, %.#....#., %........
        !byte %........, %##....##, %........
        !byte 0
