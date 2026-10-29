;==============================================================================
;  SNIPPET: Sprite collisions
;  Category: Sprites                     Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The VIC-II detects collisions pixel exactly:
;    $d01e  sprite - sprite:      bit n = 1 if sprite n touched another sprite
;    $d01f  sprite - background:  bit n = 1 if sprite n touched a set pixel
;           of the text / bitmap ("foreground" colours)
;  Reading the register clears it. The bits are set while the sprites are
;  drawn - read them once per frame, below the screen.
;
;  check_collisions reads both registers once per frame:
;    hit_sprite = sprites that touched another sprite
;    hit_bg     = sprites that touched the background
;
;  Example: did the player (sprite 0) hit an enemy?
;        jsr check_collisions
;        lda hit_sprite
;        and #%00000001
;        bne player_hit
;==============================================================================

        !zone check_collisions
check_collisions
        lda $d01e               ; read once: the register is cleared after it
        sta hit_sprite
        lda $d01f
        sta hit_bg
        rts

hit_sprite  !byte 0
hit_bg      !byte 0

        ; ---- example: border flashes red when sprite 0 touches anything -------
collision_example
        jsr check_collisions
        lda hit_sprite
        ora hit_bg
        and #%00000001
        beq +
        lda #2
        sta $d020
        rts
+       lda #0
        sta $d020
        rts
