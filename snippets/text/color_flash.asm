;==============================================================================
;  SNIPPET: Colour flashing / colour cycling of a text row
;  Category: Text                        Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Makes a text row shine: the colour RAM of the row is filled with colours
;  from a table, and the table position moves every frame. The characters
;  themselves never change - only $d800-$dbe7 is written.
;
;  The table is sorted by brightness (dark - bright - dark), so the
;  colours flow smoothly. Make your own gradients with the colour table
;  in the help (C64 colours), e.g. the "fire" gradient 2, 8, 7, 1, 7, 8, 2.
;
;  How to use:  call  jsr color_flash  once per frame (main loop or IRQ)
;  Changes:     A, X, Y
;==============================================================================

CF_ROW      = 12                ; the text row that flashes
CF_COLORS   = $d800 + CF_ROW * 40

        !zone color_flash
color_flash
        inc .pos                ; move the colours by one step per frame
        lda .pos
        sta .cur
        ldx #0                  ; X = column
-       lda .cur
        and #15                 ; table has 16 entries
        tay
        lda cf_table,y
        sta CF_COLORS,x
        inc .cur                ; next column: next colour
        inx
        cpx #40
        bne -
        rts
.pos    !byte 0
.cur    !byte 0

cf_table    !byte 0, 11, 12, 15, 1, 1, 15, 12, 11, 0, 6, 14, 3, 1, 3, 14
