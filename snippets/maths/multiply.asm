;==============================================================================
;  SNIPPET: Multiplication 8 x 8 = 16 bit
;  Category: Maths & Tools               Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The 6502 has no multiply instruction. Like written multiplication in
;  school, but in binary: for every 1 bit of the multiplier the
;  multiplicand is added; after each bit everything moves one place.
;
;  Multiplying by a constant power of 2 is simpler: ASL = x2, two ASL = x4 ...
;  (and LSR = /2).
;
;  How to use:  lda #25 : sta mul_a
;               lda #12 : sta mul_b
;               jsr multiply          ; mul_result = 300
;  Changes: A, X       (about 150-200 cycles)
;==============================================================================

        !zone multiply
multiply
        lda #0
        sta mul_result + 1      ; high byte of the result
        ldx #8                  ; 8 bits
.loop   lsr mul_b               ; next bit of the multiplier -> carry
        bcc +
        clc                     ; bit = 1: add the multiplicand to the high byte
        adc mul_a
+       ror                     ; shift the 16-bit result right
        ror mul_result
        dex
        bne .loop
        sta mul_result + 1
        rts

mul_a       !byte 0             ; multiplicand
mul_b       !byte 0             ; multiplier (destroyed)
mul_result  !word 0
