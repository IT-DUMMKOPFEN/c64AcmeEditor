;==============================================================================
;  SNIPPET: Simple text scroller (bottom row, character by character)
;  Category: Text                        Type: program (open as a new file)
;------------------------------------------------------------------------------
;  The classic "Laufschrift": a text runs through the bottom screen row from
;  right to left. Every few frames all 39 characters move one position to
;  the left and the next character of the text appears at the right edge.
;
;  It moves in steps of 8 pixels - simple, but a bit jerky. The snippet
;  "Smooth scroller" moves pixel by pixel.
;
;  Change SPEED (frames per step), ROW, COLOR and the text at the end.
;  The text ends with $ff and then starts again.
;==============================================================================

SCREEN      = $0400
ROW         = 24                ; bottom row
LINE        = SCREEN + ROW * 40
SPEED       = 4                 ; frames per character step
COLOR       = 7                 ; yellow

text_ptr    = $fb

        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

start
        lda #0
        sta $d020
        sta $d021
        jsr $e544               ; clear screen
        ldx #39
        lda #COLOR              ; colour of the scroll row
-       sta $d800 + ROW * 40,x
        dex
        bpl -
        lda #<scroll_text
        sta text_ptr
        lda #>scroll_text
        sta text_ptr + 1

frame
        ldx #SPEED              ; wait SPEED frames
--      lda $d012               ; ("--" is a label of its own in ACME,
        cmp #$fb                ;  different from "-")
        bne --
-       lda $d012               ; (wait until the line is over)
        cmp #$fb
        beq -
        dex
        bne --

        ; ---- move the row one character to the left ----------------------------
        ldx #0
-       lda LINE + 1,x
        sta LINE,x
        inx
        cpx #39
        bne -

        ; ---- next character of the text into the right column -----------------
        ldy #0
        lda (text_ptr),y
        cmp #$ff                ; end of the text?
        bne +
        lda #<scroll_text       ; start again
        sta text_ptr
        lda #>scroll_text
        sta text_ptr + 1
        lda (text_ptr),y
+       sta LINE + 39
        inc text_ptr
        bne +
        inc text_ptr + 1
+
        jsr $ffe4               ; SPACE = exit
        cmp #' '
        bne frame
        lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544

scroll_text
        !scr "hello! this is a simple scroller in the bottom row of the "
        !scr "screen. it moves one character at a time...      "
        !byte $ff
