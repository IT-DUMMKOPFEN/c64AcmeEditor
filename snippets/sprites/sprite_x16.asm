;==============================================================================
;  SNIPPET: Sprite X position 0-511 (the 9th bit in $d010)
;  Category: Sprites                     Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The screen is 320 pixels wide (+ border), but a byte only goes to 255.
;  The 9th bit of all 8 sprite X positions is collected in $d010
;  (bit n = sprite n). This routine sets a 16-bit X position correctly.
;
;  How to use:  ldx #3              ; sprite number 0-7
;               lda #<300 : sta spr_x
;               lda #>300 : sta spr_x + 1
;               jsr set_sprite_x
;  Changes: A, X, Y
;==============================================================================

        !zone set_sprite_x
set_sprite_x
        txa
        asl                     ; register offset = sprite * 2
        tay
        lda spr_x
        sta $d000,y             ; bits 0-7
        lda spr_bit,x
        ldy spr_x + 1           ; X >= 256?
        bne .set
        eor #$ff                ; no: clear the bit
        and $d010
        sta $d010
        rts
.set    ora $d010               ; yes: set the bit
        sta $d010
        rts

spr_x       !word 0
spr_bit     !byte 1, 2, 4, 8, 16, 32, 64, 128
