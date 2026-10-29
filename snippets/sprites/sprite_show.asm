;==============================================================================
;  SNIPPET: Show a sprite (position, colour, pointer)
;  Category: Sprites                     Type: program (open as a new file)
;------------------------------------------------------------------------------
;  A sprite is a 24 x 21 pixel image (63 bytes, 3 bytes per row) that the
;  VIC-II draws over the screen at any position. 8 sprites exist (0-7).
;
;  What a sprite needs:
;    * graphics data in a 64-byte block inside the VIC bank
;    * the sprite pointer = block number (address / 64) at screen + $3f8 + n
;      (screen $0400 -> pointers at $07f8-$07ff)
;    * position: $d000 + 2n = X (bits 0-7), $d001 + 2n = Y,
;                $d010 bit n = X bit 8 (X >= 256)
;    * colour $d027 + n, and switch it on: $d015 bit n
;
;  Visible area: X 24-343, Y 50-249 (the top left corner of the sprite).
;==============================================================================

SPRITE_DATA = $2000             ; 64-byte aligned, block $2000 / 64 = 128
SPR_X       = 172
SPR_Y       = 139
SPR_COLOR   = 7                 ; yellow

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
        sta $07f8               ; pointer of sprite 0
        lda #<SPR_X
        sta $d000               ; X position bits 0-7
        lda #SPR_Y
        sta $d001               ; Y position
        lda #>SPR_X             ; X bit 8 -> $d010 bit 0
        sta $d010
        lda #SPR_COLOR
        sta $d027               ; colour of sprite 0
        lda #%00000001
        sta $d015               ; sprite 0 on

-       jsr $ffe4
        cmp #' '
        bne -
        lda #0
        sta $d015
        lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544

;------------------------------------------------------------------------------
; Sprite graphics: "#" = pixel, "." = transparent (ACME binary format)
;------------------------------------------------------------------------------
        * = SPRITE_DATA
        !byte %........, %..####.., %........
        !byte %........, %.######., %........
        !byte %.......#, %########, %#.......
        !byte %......##, %########, %##......
        !byte %.....###, %#..##..#, %###.....
        !byte %.....###, %#..##..#, %###.....
        !byte %....####, %########, %####....
        !byte %....####, %########, %####....
        !byte %....####, %#.####.#, %####....
        !byte %.....###, %##....##, %###.....
        !byte %......##, %########, %##......
        !byte %.......#, %########, %#.......
        !byte %........, %.######., %........
        !byte %........, %..####.., %........
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte %........, %........, %........
        !byte 0                 ; 64th byte (unused)
