;==============================================================================
;  SNIPPET: Print text at a screen position (direct, with colour)
;  Category: Text                        Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Writes a text directly into the screen memory and its colour into the
;  colour RAM - fast, and it works without the KERNAL.
;  The text is stored with !scr (screen codes, not PETSCII!) and ends with 0.
;
;  The macro +print_at hides the parameter passing:
;      +print_at 10, 5, 7, hello      ; row 10, column 5, yellow, text "hello"
;  ...
;  hello   !scr "hello world", 0
;
;  Address of a cell = $0400 + row * 40 + column. The routine gets it from
;  a small table instead of multiplying.
;
;  Zero page: $fb/$fc (text), $fd/$fe (screen)   Changes: A, X, Y
;==============================================================================

PA_SCREEN   = $0400
pa_text     = $fb
pa_dest     = $fd

!macro print_at .row, .col, .color, .text {
        lda #<.text
        sta pa_text
        lda #>.text
        sta pa_text + 1
        ldx #.row
        ldy #.col
        lda #.color
        jsr print_at
}

        !zone print_at
print_at                        ; X = row, Y = column, A = colour
        sta .color + 1
        tya
        clc
        adc pa_row_lo,x         ; screen address = row start + column
        sta pa_dest
        lda pa_row_hi,x
        adc #0
        sta pa_dest + 1
        ldy #0
.loop   lda (pa_text),y
        beq .done               ; 0 = end of text
        sta (pa_dest),y         ; character into the screen memory
        lda pa_dest + 1         ; switch the pointer to the colour RAM ...
        pha
        clc
        adc #>($d800 - PA_SCREEN)
        sta pa_dest + 1
.color  lda #1
        sta (pa_dest),y         ; ... write the colour ...
        pla
        sta pa_dest + 1         ; ... and back to the screen
        iny
        bne .loop
.done   rts

pa_row_lo   !for r, 0, 24 { !byte <(PA_SCREEN + r * 40) }
pa_row_hi   !for r, 0, 24 { !byte >(PA_SCREEN + r * 40) }
