;==============================================================================
;  SNIPPET: Fast clear screen (with a colour)
;  Category: Basics                      Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Fills the 1000 bytes of the screen with a character and the colour RAM
;  with a colour. Faster than the KERNAL ($e544) and you choose the colour.
;  Each loop pass writes 4 blocks of 250 bytes (4 x 250 = 1000).
;
;  How to use:  lda #' '           ; character (screen code)
;               ldx #1             ; colour (0-15)
;               jsr clear_screen
;  Changes:     A, X
;==============================================================================

CLS_SCREEN  = $0400
CLS_COLORS  = $d800

        !zone clear_screen
clear_screen
        sta .char + 1           ; self-modifying code: store the parameters
        stx .color + 1
        ldx #0
.char   lda #' '
        sta CLS_SCREEN,x
        sta CLS_SCREEN + 250,x
        sta CLS_SCREEN + 500,x
        sta CLS_SCREEN + 750,x
.color  lda #1
        sta CLS_COLORS,x
        sta CLS_COLORS + 250,x
        sta CLS_COLORS + 500,x
        sta CLS_COLORS + 750,x
        inx
        cpx #250
        bne .char
        rts
