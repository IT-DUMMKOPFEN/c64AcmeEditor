;==============================================================================
;  03 - SOFT SCROLLER
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  A smooth text scroller in one screen row - the "hello world" of demos.
;
;  What you can learn here:
;    * raster interrupts: two IRQs per frame, at fixed raster lines
;    * $D016 bits 0-2: horizontal fine scroll (0-7 pixels)
;    * $D016 bit 3: 38 column mode hides the characters that enter/leave
;    * moving the row one character left after 8 pixels ("coarse scroll")
;    * reading the scroll text with a zero page pointer: lda (ptr),y
;    * colour RAM ($D800) for a colour cycling effect
;    * clean exit: SPACE restores the KERNAL interrupt and returns to BASIC
;
;  Only the scroll row is shifted - the IRQ at LINE_TOP sets the fine scroll
;  value, the IRQ at LINE_BOTTOM sets it back to 0 for the rest of the screen.
;==============================================================================

        !to "03_soft_scroller.prg", cbm

;------------------------------------------------------------------------------
; Constants
;------------------------------------------------------------------------------
SCREEN      = $0400             ; default screen memory
COLORRAM    = $d800             ; colour RAM (one colour per character)
ROW         = 20                ; screen row of the scroller (0-24)
SCROLL_ROW  = SCREEN + ROW * 40
SCROLL_COL  = COLORRAM + ROW * 40
SPEED       = 2                 ; pixels per frame (1, 2, 4 or 8)

; The first text line is raster line $33 (with the default y-scroll of 3).
; Every row is 8 lines high, so row 20 covers lines $d3-$da.
LINE_TOP    = $33 + ROW * 8 - 5 ; a few lines before the row starts
LINE_BOTTOM = $33 + ROW * 8 + 9 ; just after the row ended

VIC_CTRL2   = $d016             ; bits 0-2: x-scroll, bit 3: 40/38 columns
VIC_RASTER  = $d012
VIC_IRQFLAG = $d019
VIC_IRQMASK = $d01a
CIA1_ICR    = $dc0d             ; CIA 1 interrupt control
IRQ_VECTOR  = $0314             ; KERNAL jumps here on every IRQ
GETIN       = $ffe4             ; KERNAL: read a key from the keyboard buffer

text_ptr    = $fb               ; zero page pointer into the scroll text ($fb/$fc)

;------------------------------------------------------------------------------
; BASIC start line: 10 SYS 2061
;------------------------------------------------------------------------------
        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

;------------------------------------------------------------------------------
        !zone main
start
        jsr setup_screen

        lda #<scroll_text       ; text pointer = start of the text
        sta text_ptr
        lda #>scroll_text
        sta text_ptr + 1
        lda #7
        sta xscroll

        ; ---- install the raster interrupt -----------------------------------
        sei                     ; no interrupts while we change the vectors
        lda #%01111111
        sta CIA1_ICR            ; switch off the CIA 1 timer interrupt
        lda CIA1_ICR            ; (reading acknowledges pending interrupts)
        lda #<irq_top
        sta IRQ_VECTOR
        lda #>irq_top
        sta IRQ_VECTOR + 1
        lda #LINE_TOP
        sta VIC_RASTER          ; raster line for the first IRQ ...
        lda $d011
        and #%01111111          ; ... bit 8 of the line number = 0
        sta $d011
        lda #%00000001
        sta VIC_IRQMASK         ; enable the raster interrupt
        lda #$ff
        sta VIC_IRQFLAG         ; clear old interrupt flags
        cli

        ; ---- main loop: everything else happens in the interrupts -----------
.wait   jsr GETIN               ; key pressed?
        cmp #' '                ; SPACE -> exit
        bne .wait

        ; ---- restore the normal KERNAL interrupt ------------------------------
        sei
        lda #0
        sta VIC_IRQMASK         ; raster interrupt off
        lda #$ff
        sta VIC_IRQFLAG
        lda #<$ea31             ; default KERNAL IRQ handler
        sta IRQ_VECTOR
        lda #>$ea31
        sta IRQ_VECTOR + 1
        lda #%10000001
        sta CIA1_ICR            ; CIA 1 timer interrupt on again
        lda #%11001000
        sta VIC_CTRL2           ; default $d016
        cli
        rts

;------------------------------------------------------------------------------
; IRQ 1 (above the scroll row): set the fine scroll value + 38 columns
;------------------------------------------------------------------------------
        !zone irq_top
irq_top
        lda #$ff
        sta VIC_IRQFLAG         ; acknowledge the raster interrupt

        lda xscroll             ; 0-7, bit 3 = 0 -> 38 column mode
        sta VIC_CTRL2

        lda #<irq_bottom        ; next interrupt: below the scroll row
        sta IRQ_VECTOR
        lda #>irq_bottom
        sta IRQ_VECTOR + 1
        lda #LINE_BOTTOM
        sta VIC_RASTER
        jmp $ea81               ; KERNAL: restore registers and RTI

;------------------------------------------------------------------------------
; IRQ 2 (below the scroll row): reset $d016 and move the scroller
;------------------------------------------------------------------------------
        !zone irq_bottom
irq_bottom
        lda #$ff
        sta VIC_IRQFLAG

        lda #%11001000          ; x-scroll 0, 40 columns for the rest
        sta VIC_CTRL2

        ; ---- fine scroll -------------------------------------------------------
        lda xscroll
        sec
        sbc #SPEED              ; move SPEED pixels to the left
        bcs .no_coarse          ; still >= 0 -> done
        adc #8                  ; wrapped below 0: back to 7 (or 6 ...)
        sta xscroll
        jsr coarse_scroll       ; ... and move all characters left by one
        jmp .colors
.no_coarse
        sta xscroll

.colors ; ---- colour cycling --------------------------------------------------
        inc color_pos
        lda color_pos
        lsr                     ; slow it down a bit
        tay
        ldx #0
-       tya
        and #15
        tay
        lda color_cycle,y
        sta SCROLL_COL,x
        iny
        inx
        cpx #40
        bne -

        lda #<irq_top           ; next interrupt: above the scroll row
        sta IRQ_VECTOR
        lda #>irq_top
        sta IRQ_VECTOR + 1
        lda #LINE_TOP
        sta VIC_RASTER
        jmp $ea31               ; once per frame: KERNAL handler (keyboard!)

;------------------------------------------------------------------------------
; coarse_scroll: move the row one character to the left, append a new one
;------------------------------------------------------------------------------
        !zone coarse_scroll
coarse_scroll
        ldx #0
-       lda SCROLL_ROW + 1,x
        sta SCROLL_ROW,x
        inx
        cpx #39
        bne -

        ldy #0
        lda (text_ptr),y        ; next character of the text
        cmp #$ff                ; end marker?
        bne +
        lda #<scroll_text       ; yes: start again
        sta text_ptr
        lda #>scroll_text
        sta text_ptr + 1
        lda (text_ptr),y
+       sta SCROLL_ROW + 39     ; put it into the rightmost column

        inc text_ptr            ; 16-bit increment of the pointer
        bne +
        inc text_ptr + 1
+       rts

;------------------------------------------------------------------------------
; setup_screen: clear the screen and print the title
;------------------------------------------------------------------------------
        !zone setup_screen
setup_screen
        lda #0
        sta $d020               ; black border
        sta $d021               ; black background
        ldx #0
-       lda #' '                ; screen code 32 = space
        sta SCREEN,x
        sta SCREEN + $100,x
        sta SCREEN + $200,x
        sta SCREEN + $2e8,x     ; ($2e8 + $100 = $3e8 = 1000 bytes)
        lda #1                  ; white
        sta COLORRAM,x
        sta COLORRAM + $100,x
        sta COLORRAM + $200,x
        sta COLORRAM + $2e8,x
        inx
        bne -

        ldx #0
-       lda title,x
        sta SCREEN + 5 * 40 + 9,x
        lda #7                  ; yellow
        sta COLORRAM + 5 * 40 + 9,x
        lda subtitle,x
        sta SCREEN + 8 * 40 + 6,x
        lda #15                 ; light grey
        sta COLORRAM + 8 * 40 + 6,x
        inx
        cpx #28
        bne -
        rts

;------------------------------------------------------------------------------
; Data
;------------------------------------------------------------------------------
xscroll     !byte 7             ; current fine scroll value (0-7)
color_pos   !byte 0

title       !scr "c64 acme editor - scroller  "     ; 28 characters each
subtitle    !scr "  press space to exit...    "

color_cycle !byte 2,8,10,15,7,1,1,7,15,10,8,2,4,14,3,14

; "!scr" converts to screen codes (the values that are written into $0400).
; $ff marks the end of the text.
scroll_text
        !scr "hello c64 friends!   this is a smooth soft scroller, written "
        !scr "with the c64 acme editor.   the vic-ii can shift the screen "
        !scr "by 0-7 pixels ($d016), after 8 pixels all characters move one "
        !scr "position to the left...   greetings from it-dummkoepfe!        "
        !byte $ff
