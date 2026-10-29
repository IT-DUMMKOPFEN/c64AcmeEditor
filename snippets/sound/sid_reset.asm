;==============================================================================
;  SNIPPET: Reset / silence the SID
;  Category: Sound                       Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Writes 0 to all 25 SID registers ($d400-$d418): all voices off, filter
;  off, volume 0. Use it after music or sound effects, before returning to
;  BASIC, or before starting a new tune.
;
;  Note: the SID registers can only be written, not read back (except
;  $d419-$d41c), so always set all values you need.
;
;  How to use:  jsr sid_reset          Changes: A, X
;==============================================================================

        !zone sid_reset
sid_reset
        ldx #$18
        lda #0
-       sta $d400,x
        dex
        bpl -
        rts
