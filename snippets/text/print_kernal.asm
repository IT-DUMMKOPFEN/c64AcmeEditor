;==============================================================================
;  SNIPPET: Print text with the KERNAL (CHROUT + PLOT)
;  Category: Text                        Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The KERNAL prints PETSCII text like BASIC's PRINT: control codes work
;  inside the text - colours, RVS ON, clear screen, cursor movement:
;      147 clear screen   13 RETURN     18 RVS on    146 RVS off
;      5 white  28 red  30 green  31 blue  129 orange  144 black  149 brown
;      150 light red  151 dark grey  152 grey  153 light green
;      154 light blue  155 light grey  156 purple  158 yellow  159 cyan
;
;  PLOT ($fff0) with carry clear sets the cursor: X = row, Y = column.
;  CHROUT ($ffd2) prints the character in A.
;
;  How to use:  ldx #5 : ldy #10 : jsr set_cursor
;               lda #<text : ldy #>text : jsr print_text
;  ... text !pet 158, "yellow text", 13, 0       (!pet = PETSCII)
;  Changes:     A, X, Y
;==============================================================================

CHROUT      = $ffd2
PLOT        = $fff0
pk_text     = $fb

        !zone print_kernal
set_cursor                      ; X = row, Y = column
        clc                     ; carry clear = set position
        jmp PLOT

print_text                      ; A/Y = address of a 0-terminated PETSCII text
        sta pk_text
        sty pk_text + 1
        ldy #0
-       lda (pk_text),y
        beq +
        jsr CHROUT              ; CHROUT keeps X and Y
        iny
        bne -
+       rts

        ; ---- example ----------------------------------------------------------------
kernal_example
        lda #<.hello
        ldy #>.hello
        jsr print_text
        ldx #12
        ldy #14
        jsr set_cursor
        lda #<.middle
        ldy #>.middle
        jmp print_text
.hello  !pet 147, 158, "hello from the kernal!", 13, 0
.middle !pet 18, 28, " in the middle ", 146, 0
