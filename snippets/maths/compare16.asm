;==============================================================================
;  SNIPPET: 16-bit comparison
;  Category: Maths & Tools               Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Compares two unsigned 16-bit values: the high bytes decide, only if they
;  are equal the low bytes are compared. After the macro the flags are set
;  like after CMP:
;      BCC  a < b          BCS  a >= b
;      BEQ  a = b          BNE  a <> b
;
;      +cmp16 a, b         (memory addresses)
;      +cmp16i a, 320      (a constant)
;==============================================================================

!macro cmp16 .a, .b {
        lda .a + 1
        cmp .b + 1              ; high bytes different? then they decide
        bne +
        lda .a
        cmp .b                  ; equal: the low bytes decide
+
}

!macro cmp16i .a, .value {
        lda .a + 1
        cmp #>.value
        bne +
        lda .a
        cmp #<.value
+
}

        ; ---- example: limit an X position to 320 -------------------------------
limit_example
        +cmp16i pos_x, 320
        bcc +                   ; pos_x < 320: fine
        lda #<319
        sta pos_x
        lda #>319
        sta pos_x + 1
+       rts

pos_x   !word 400
