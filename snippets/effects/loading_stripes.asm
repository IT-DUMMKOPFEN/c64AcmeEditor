;==============================================================================
;  SNIPPET: Loading stripes in the border
;  Category: Effects                     Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The flickering colour stripes known from tape loaders and decrunchers:
;  the border colour is changed as fast as possible with random values -
;  the raster beam draws a new colour wherever it is at that moment.
;
;  stripes_frame  shows the effect for about one frame (19656 cycles).
;  Call it in a loop while your program "works" (decrunching, waiting ...).
;  The colours come from the SID noise generator (voice 3).
;
;  Changes: A, X, Y
;==============================================================================

        !zone stripes
stripes_init
        lda #$ff                ; SID voice 3: noise, highest frequency
        sta $d40e
        sta $d40f
        lda #$80
        sta $d412
        rts

stripes_frame
        ldy #20                 ; 20 x 256 x ~4 loops ~ 1 frame
        ldx #0
-       lda $d41b               ; random value
        sta $d020               ; only bits 0-3 count: colour 0-15
        dex
        bne -
        dey
        bne -
        rts
