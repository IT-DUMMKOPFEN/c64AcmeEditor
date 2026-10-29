;==============================================================================
;  SNIPPET: 16-bit addition and subtraction
;  Category: Maths & Tools               Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The 6502 calculates with 8 bits. For bigger numbers the low bytes are
;  added first, the carry flag takes the overflow to the high bytes:
;
;      CLC before an addition    (no carry from before)
;      SEC before a subtraction  (no borrow from before)
;
;  16-bit values are stored low byte first ("little endian"): !word 1000
;  is $e8 $03.
;
;  As ACME macros (the code is inserted where you call them):
;      +add16 result, a, b        result = a + b        (memory addresses)
;      +sub16 result, a, b        result = a - b
;      +add16i result, a, 500     result = a + constant
;==============================================================================

!macro add16 .res, .a, .b {
        clc
        lda .a
        adc .b
        sta .res
        lda .a + 1
        adc .b + 1              ; + carry from the low bytes
        sta .res + 1
}

!macro sub16 .res, .a, .b {
        sec
        lda .a
        sbc .b
        sta .res
        lda .a + 1
        sbc .b + 1              ; - borrow from the low bytes
        sta .res + 1
}

!macro add16i .res, .a, .value {
        clc
        lda .a
        adc #<.value
        sta .res
        lda .a + 1
        adc #>.value
        sta .res + 1
}

        ; ---- example: score = score + points ------------------------------------
add16_example
        +add16 score, score, points     ; 1000 + 250 = 1250
        +add16i score, score, 500       ; + 500 = 1750
        +sub16 score, score, points     ; - 250 = 1500
        rts

score   !word 1000
points  !word 250
