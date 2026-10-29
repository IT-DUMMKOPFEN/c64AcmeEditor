;==============================================================================
;  SNIPPET: Division 16 / 16 bit (with remainder)
;  Category: Maths & Tools               Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Long division in binary: the dividend is shifted bit by bit into the
;  remainder; whenever the divisor fits, it is subtracted and the result
;  bit is 1.
;
;  How to use:  dividend = 1000, divisor = 7
;               jsr divide16       ; dividend = 142 (result), div_rem = 6
;  Division by zero returns $ffff.        Changes: A, X, Y
;==============================================================================

        !zone divide16
divide16
        lda #0
        sta div_rem
        sta div_rem + 1
        ldx #16                 ; 16 bits
.loop   asl dividend            ; shift dividend left, top bit -> remainder
        rol dividend + 1
        rol div_rem
        rol div_rem + 1
        lda div_rem             ; does the divisor fit? (remainder - divisor)
        sec
        sbc divisor
        tay
        lda div_rem + 1
        sbc divisor + 1
        bcc +                   ; no: result bit 0
        sta div_rem + 1         ; yes: keep the difference ...
        sty div_rem
        inc dividend            ; ... and result bit 1
+       dex
        bne .loop
        rts

dividend    !word 0             ; in: dividend   out: result
divisor     !word 0
div_rem     !word 0             ; out: remainder
