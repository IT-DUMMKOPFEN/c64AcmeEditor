;==============================================================================
;  SNIPPET: Fade the screen to black
;  Category: Effects                     Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Every colour has a darker partner (table fade_darker: two steps down in
;  the brightness order below). Calling fade_step makes all colours of the
;  colour RAM, border and background darker. After 8 calls everything is
;  black. For fading in, make a table in the other direction.
;
;  The colour order by brightness (dark -> bright):
;      0 black, 6 blue, 9 brown, 11 dark grey, 2 red, 4 purple, 8 orange,
;      12 grey, 14 light blue, 5 green, 10 light red, 3 cyan, 15 light grey,
;      7 yellow, 13 light green, 1 white
;
;  How to use (fade out with a delay of 4 frames per step):
;        ldx #8
;  -     jsr fade_step
;        (wait 4 frames)
;        dex : bne -
;  Changes: A, Y
;==============================================================================

        !zone fade
fade_step
        txa
        pha
        ldx #0
-       !for block, 0, 3 {
            lda $d800 + block * 250,x
            and #$0f            ; colour RAM: upper 4 bits are random
            tay
            lda fade_darker,y
            sta $d800 + block * 250,x
        }
        inx
        cpx #250
        bne -
        lda $d020
        and #$0f
        tay
        lda fade_darker,y
        sta $d020
        lda $d021
        and #$0f
        tay
        lda fade_darker,y
        sta $d021
        pla
        tax
        rts

;                     0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
fade_darker !byte     0, 7, 9, 5,11,12, 0, 3, 2, 0,14, 6, 4,15, 8,10
