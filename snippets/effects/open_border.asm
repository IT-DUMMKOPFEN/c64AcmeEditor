;==============================================================================
;  SNIPPET: Open the top and bottom border
;  Category: Effects                     Type: program (open as a new file)
;------------------------------------------------------------------------------
;  The VIC-II switches the border on at line 251 (25 rows) or 247 (24 rows).
;  Switching to 24 rows ($d011 bit 3 = 0) between these two lines - here
;  in line 249 - makes the VIC miss both: the border stays open, and
;  sprites are visible in the upper and lower border. Before line 247 of
;  the next frame the bit must be set back to 25 rows.
;
;  In the open border the VIC shows the last byte of the VIC bank ($3fff
;  in bank 0) as a pattern - set it to 0 for an empty border.
;
;  Here one sprite moves in the lower border.
;==============================================================================

SPRITE_DATA = $2000

        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

start
        lda #0
        sta $d020
        lda #6
        sta $d021
        jsr $e544
        lda #0
        sta $3fff               ; empty pattern in the open border
        ldx #62                 ; sprite: a filled block
        lda #$ff
-       sta SPRITE_DATA,x
        dex
        bpl -
        lda #SPRITE_DATA / 64
        sta $07f8
        lda #1
        sta $d015
        lda #7
        sta $d027
        lda #255                ; Y = 255: the sprite covers lines 256-276
        sta $d001

        sei
        lda #$7f
        sta $dc0d
        lda $dc0d
        lda #<irq_open
        sta $0314
        lda #>irq_open
        sta $0315
        lda #249
        sta $d012
        lda $d011
        and #$7f
        sta $d011
        lda #1
        sta $d01a
        lda #$ff
        sta $d019
        cli

-       jsr $ffe4
        cmp #' '
        bne -
        sei
        lda #0
        sta $d01a
        sta $d015
        lda #$31
        sta $0314
        lda #$ea
        sta $0315
        lda #$81
        sta $dc0d
        lda #$1b
        sta $d011
        cli
        lda #14
        sta $d020
        jmp $e544

irq_open                        ; line 249: 24 rows -> border stays open
        lda #$ff
        sta $d019
        lda $d011
        and #%01110111
        sta $d011
        lda #<irq_close
        sta $0314
        lda #>irq_close
        sta $0315
        lda #20
        sta $d012
        jmp $ea81

irq_close                       ; line 20: 25 rows again, move the sprite
        lda #$ff
        sta $d019
        lda $d011
        ora #%00001000
        and #%01111111
        sta $d011
        inc $d000               ; sprite moves right
        bne +
        lda $d010               ; X wrapped: toggle bit 8
        eor #1
        sta $d010
+       lda #<irq_open
        sta $0314
        lda #>irq_open
        sta $0315
        lda #249
        sta $d012
        jmp $ea31
