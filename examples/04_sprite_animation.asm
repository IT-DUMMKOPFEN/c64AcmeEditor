;==============================================================================
;  04 - SPRITE ANIMATION
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  Eight spinning coins fly in a circle. Every coin is a sprite that cycles
;  through 8 animation frames.
;
;  What you can learn here:
;    * sprite registers: position, colour, enable, sprite pointers
;    * the 9th X bit ($D010) for X positions > 255
;    * animation by changing the sprite pointer ($07F8-$07FF)
;    * creating sprite graphics AT ASSEMBLY TIME with ACME loops: the coin
;      frames are calculated with sin/cos - no drawing program needed!
;    * sine tables for smooth movement
;    * syncing the main loop to the raster beam (one update per frame)
;
;  A sprite is 24 x 21 pixels = 3 bytes x 21 lines = 63 bytes (+1 padding).
;  Sprite data must be 64-byte aligned. The pointer value is address / 64.
;==============================================================================

        !to "04_sprite_animation.prg", cbm

SPRITE_DATA = $2000             ; 8 frames x 64 bytes = $2000-$21ff
FIRST_PTR   = SPRITE_DATA / 64  ; = 128, the sprite pointer of frame 0
SPRITE_PTRS = $07f8             ; sprite pointers live behind screen memory
PI          = 3.14159265

; VIC-II sprite registers
SPR_X       = $d000             ; $d000/$d001 = X/Y of sprite 0, $d002/$d003 ...
SPR_XMSB    = $d010             ; bit n = bit 8 of the X position of sprite n
SPR_ENABLE  = $d015
SPR_COLOR   = $d027             ; $d027-$d02e: colour of sprite 0-7

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
        lda #11                 ; dark grey border
        sta $d020
        lda #0                  ; black background
        sta $d021
        jsr $e544               ; KERNAL: clear the screen

        ldx #7
-       lda colors,x            ; give every coin its own colour
        sta SPR_COLOR,x
        lda #FIRST_PTR          ; show frame 0 for now
        sta SPRITE_PTRS,x
        dex
        bpl -
        lda #%11111111          ; switch on all 8 sprites
        sta SPR_ENABLE

; ---- main loop: once per frame ----------------------------------------------
frame
.wait   lda $d012               ; wait for raster line $ff, where no sprite
        cmp #$ff                ; is visible (avoids flicker while we move them)
        bne .wait

        inc angle               ; everything moves a little each frame
        lda angle
        and #%00000011          ; every 4th frame: next animation frame
        bne +
        inc anim
+
        ldx #0                  ; X = sprite number 0-7
        lda #0
        sta msb                 ; collect the 9th X bits here
.sprite
        txa                     ; register offset = sprite * 2
        asl
        tay

        lda angle               ; position on the circle:
        clc                     ;   angle + sprite * 32 (8 sprites = 256)
        adc offsets,x
        sta tmp
        stx tmp + 1             ; save X (the sprite number)
        tax

        lda sin_x_lo,x          ; X position (9 bit) from the sine table
        sta SPR_X,y
        lda sin_x_hi,x          ; 0 or 1 -> bit 8
        lsr                     ; move it into the carry ...
        ror msb                 ; ... and from there into the collected bits
        txa
        clc
        adc #64                 ; cosine = sine shifted by 90 degrees
        tax
        lda sin_y,x
        sta SPR_X + 1,y         ; Y position

        ldx tmp + 1             ; sprite number back
        lda anim                ; animation frame = (anim + sprite) AND 7
        clc
        adc offsets_frame,x
        and #7
        ora #FIRST_PTR          ; FIRST_PTR is 128 -> just set the bits
        sta SPRITE_PTRS,x

        inx
        cpx #8
        bne .sprite

        lda msb                 ; after 8 "ror" the bits are in the right place
        sta SPR_XMSB
        jmp frame

;------------------------------------------------------------------------------
; Variables and small tables
;------------------------------------------------------------------------------
angle           !byte 0
anim            !byte 0
msb             !byte 0
tmp             !byte 0, 0
colors          !byte 7, 8, 7, 8, 7, 8, 7, 8     ; yellow / orange coins
offsets         !for i, 0, 7 { !byte i * 32 }
offsets_frame   !for i, 0, 7 { !byte i }

;------------------------------------------------------------------------------
; Sine tables, calculated by ACME:
;   X = 172 + 130 * sin(a)   -> 42..302 (needs 9 bits)
;   Y = 150 +  75 * sin(a)   -> 75..225
;------------------------------------------------------------------------------
sin_x_lo
        !for i, 0, 255 { !byte <int(172.5 + 130 * sin(float(i) * 2 * PI / 256)) }
sin_x_hi
        !for i, 0, 255 { !byte >int(172.5 + 130 * sin(float(i) * 2 * PI / 256)) }
sin_y
        !for i, 0, 255 { !byte int(150.5 + 75 * sin(float(i) * 2 * PI / 256)) }

;------------------------------------------------------------------------------
; Sprite graphics: 8 frames of a spinning coin, generated with maths.
; For every pixel ACME checks if it lies inside the coin (an ellipse that gets
; narrower while the coin turns) and sets the bit.
;   frame f: the coin is turned by f * 22.5 degrees,
;            half width w = 11 * |cos(angle)|  (at least 1 pixel)
;   pixel (x,y) is set if  ((x - 11.5) / w)^2 + ((y - 10) / 10.5)^2 <= 1
;   and it is NOT inside a smaller ellipse (that gives the coin a rim),
;   except for a little "dot" in the middle.
;------------------------------------------------------------------------------
        * = SPRITE_DATA
sprites
        !for f, 0, 7 {
            !set w = 11.0 * cos(float(f) * PI / 8)
            !if w < 0 { !set w = -w }
            !if w < 1 { !set w = 1.0 }
            !for row, 0, 20 {
                !for col, 0, 2 {
                    !set bits = 0
                    !for bit, 0, 7 {
                        !set px = col * 8 + bit
                        !set dx = (float(px) - 11.5) / w
                        !set dy = (float(row) - 10.0) / 10.5
                        !set outer = dx * dx + dy * dy
                        !set dx = (float(px) - 11.5) / (w * 0.6)
                        !set dy = (float(row) - 10.0) / (10.5 * 0.6)
                        !set inner = dx * dx + dy * dy
                        !if outer <= 1.0 {
                            !if inner > 1.0 | inner < 0.08 {
                                !set bits = bits | (128 >> bit)
                            }
                        }
                    }
                    !byte bits
                }
            }
            !byte 0             ; 64th byte (unused padding)
        }
