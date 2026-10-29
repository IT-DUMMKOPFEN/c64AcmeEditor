;==============================================================================
;  SNIPPET: Random numbers from the SID (noise of voice 3)
;  Category: Sound                       Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Voice 3 of the SID can be read: $d41b returns the upper 8 bits of its
;  oscillator. With the noise waveform and a high frequency this is a
;  good source of random numbers - and it costs no CPU time.
;  The gate stays off, so nothing is heard (and $d418 bit 7 = 1 would even
;  disconnect voice 3 from the output completely).
;
;  How to use:  jsr sid_random_init   (once)
;               lda $d41b             ; random byte, whenever you need one
;  Note: reading twice within a few cycles gives the same value.
;==============================================================================

        !zone sid_random_init
sid_random_init
        lda #$ff
        sta $d40e               ; voice 3 frequency: maximum
        sta $d40f
        lda #$80                ; noise waveform, gate off
        sta $d412
        rts

        ; ---- example: random number 0-39 (e.g. a screen column) -------------
random_column
-       lda $d41b
        and #63                 ; 0-63
        cmp #40
        bcs -                   ; >= 40: take another one
        rts
