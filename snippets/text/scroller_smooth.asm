;==============================================================================
;  SNIPPET: Smooth scroller (bottom row, pixel by pixel)
;  Category: Text                        Type: program (open as a new file)
;------------------------------------------------------------------------------
;  A text that moves smoothly through the bottom screen row, while the rest
;  of the screen stays still.
;
;  How it works:
;    * $d016 bits 0-2 move the whole screen 0-7 pixels to the right.
;      We count from 7 down to 0: the text moves to the left. At 0 the row
;      is moved by one whole character and the counter starts at 7 again.
;    * $d016 bit 3 = 0 switches to 38 columns: the left and right column are
;      hidden behind the border, so the characters appear and disappear
;      smoothly at the edges.
;    * A raster interrupt sets the scroll value just before the last row
;      (raster line 240) and resets it below the screen (line 252) - so
;      only the bottom row moves.
;
;  Change SPEED (pixels per frame: 1, 2 or 4), COLOR and the text.
;==============================================================================

SCREEN      = $0400
ROW         = 24
LINE        = SCREEN + ROW * 40
SPEED       = 1                 ; pixels per frame (1, 2, 4 or 8)
COLOR       = 13                ; light green
SPLIT_LINE  = 51 + ROW * 8 - 3  ; a few lines before the row starts (240)
RESET_LINE  = 252               ; below the text screen

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
        jsr $e544
        ldx #39
        lda #COLOR
-       sta $d800 + ROW * 40,x
        dex
        bpl -
        lda #<scroll_text
        sta text_ptr
        lda #>scroll_text
        sta text_ptr + 1

        sei
        lda #$7f
        sta $dc0d
        lda $dc0d
        lda #<irq_split
        sta $0314
        lda #>irq_split
        sta $0315
        lda #SPLIT_LINE
        sta $d012
        lda $d011
        and #%01111111
        sta $d011
        lda #1
        sta $d01a
        lda #$ff
        sta $d019
        cli

-       jsr $ffe4               ; main program: wait for SPACE
        cmp #' '
        bne -

        sei                     ; restore the KERNAL interrupt
        lda #0
        sta $d01a
        lda #$31
        sta $0314
        lda #$ea
        sta $0315
        lda #$81
        sta $dc0d
        lda #$c8
        sta $d016
        cli
        lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544

;------------------------------------------------------------------------------
; IRQ 1 (line 240): fine scroll for the bottom row
;------------------------------------------------------------------------------
irq_split
        lda #$ff
        sta $d019
        lda xscroll             ; bits 0-2 = scroll, bit 3 = 0: 38 columns
        sta $d016
        lda #<irq_reset
        sta $0314
        lda #>irq_reset
        sta $0315
        lda #RESET_LINE
        sta $d012
        jmp $ea81               ; end of interrupt (no KERNAL tasks)

;------------------------------------------------------------------------------
; IRQ 2 (line 252): normal screen again, move the text
;------------------------------------------------------------------------------
irq_reset
        lda #$ff
        sta $d019
        lda #%11001000          ; 40 columns, no scroll
        sta $d016

        lda xscroll
        sec
        sbc #SPEED
        and #7
        sta xscroll
        cmp #8 - SPEED          ; wrapped around (0 -> 7)? coarse step
        bne +
        jsr coarse_scroll
+
        lda #<irq_split
        sta $0314
        lda #>irq_split
        sta $0315
        lda #SPLIT_LINE
        sta $d012
        jmp $ea31               ; KERNAL tasks once per frame

coarse_scroll                   ; row one character to the left + new character
        ldx #0
-       lda LINE + 1,x
        sta LINE,x
        inx
        cpx #39
        bne -
        ldy #0
        lda (text_ptr),y
        cmp #$ff
        bne +
        lda #<scroll_text
        sta text_ptr
        lda #>scroll_text
        sta text_ptr + 1
        lda (text_ptr),y
+       sta LINE + 39
        inc text_ptr
        bne +
        inc text_ptr + 1
+       rts

xscroll     !byte 8 - SPEED     ; 7 for speed 1, 6 for speed 2 ...

scroll_text
        !scr "smooth scrolling with $d016 - only the bottom row moves, "
        !scr "thanks to two raster interrupts...      "
        !byte $ff
