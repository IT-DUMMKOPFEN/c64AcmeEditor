;==============================================================================
;  SNIPPET: Useful ACME macros
;  Category: Maths & Tools               Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Macros save typing: the code inside is inserted wherever you call the
;  macro, with your parameters. Define them once at the top of your file.
;
;      +poke $d020, 0             store a constant
;      +poke16 $0314, irq         store a 16-bit constant (low, high)
;      +mov16 dest, src           copy a 16-bit variable
;      +inc16 counter             16-bit increment
;      +dec16 counter             16-bit decrement
;      +wait_line $fb             wait for a raster line (< 256)
;
;  Labels inside a macro (like "+" below) are local to each call.
;==============================================================================

!macro poke .addr, .value {
        lda #.value
        sta .addr
}

!macro poke16 .addr, .value {
        lda #<.value
        sta .addr
        lda #>.value
        sta .addr + 1
}

!macro mov16 .dest, .src {
        lda .src
        sta .dest
        lda .src + 1
        sta .dest + 1
}

!macro inc16 .addr {
        inc .addr
        bne +
        inc .addr + 1
+
}

!macro dec16 .addr {
        lda .addr
        bne +
        dec .addr + 1
+       dec .addr
}

!macro wait_line .line {
-       lda $d012
        cmp #.line
        bne -
}

        ; ---- examples ----------------------------------------------------------------
macro_example
        +poke $d020, 0
        +poke16 vector, $ea31
        +mov16 copy, vector
        +inc16 counter
        +dec16 counter
        +wait_line $fb
        rts

vector  !word 0
copy    !word 0
counter !word $00ff
