;==============================================================================
;  11 - RASTER SPLIT (three screen zones)
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  The screen is split into three horizontal zones. Each zone has its own
;  border colour, background colour and character set. One raster interrupt
;  per zone switches the VIC-II registers just before the beam reaches it.
;
;  What you can learn here:
;    * a "table driven" chain of raster interrupts: one handler, three lines
;    * $D018: switching between the upper case and the lower case charset
;    * why everything happens "a few lines early": the CPU needs some cycles
;      to react to an interrupt
;    * the KERNAL tasks (keyboard, cursor) run only once per frame ($EA31)
;
;  Further reading on Codebase64:
;    https://codebase64.net/doku.php?id=base:horizontal_raster_split
;    https://codebase64.net/doku.php?id=base:interrupts
;
;  Press SPACE to return to BASIC.
;==============================================================================

        !to "11_raster_split.prg", cbm

SCREEN      = $0400
COLORRAM    = $d800
ZONES       = 3

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
        jsr $e544               ; clear the screen
        jsr print_texts

        sei
        lda #$7f
        sta $dc0d               ; CIA 1 timer interrupt off
        lda $dc0d
        lda #<irq
        sta $0314
        lda #>irq
        sta $0315
        lda #0
        sta zone                ; the first interrupt handles zone 0
        lda zone_line
        sta $d012
        lda $d011
        and #%01111111          ; raster line bit 8 = 0
        sta $d011
        lda #1
        sta $d01a               ; raster interrupt on
        lda #$ff
        sta $d019
        cli

.wait   jsr $ffe4               ; GETIN
        cmp #' '
        bne .wait

        sei                     ; restore the normal interrupt
        lda #0
        sta $d01a
        lda #$ff
        sta $d019
        lda #<$ea31
        sta $0314
        lda #>$ea31
        sta $0315
        lda #$81
        sta $dc0d
        cli
        lda #14 : sta $d020
        lda #6  : sta $d021
        lda #$15 : sta $d018
        jmp $e544

;------------------------------------------------------------------------------
; The interrupt: set the registers of the current zone, then prepare the
; interrupt for the next zone.
;------------------------------------------------------------------------------
        !zone irq
irq
        lda #$ff
        sta $d019               ; acknowledge

        ldx zone
        lda zone_border,x
        sta $d020
        lda zone_bg,x
        sta $d021
        lda zone_d018,x
        sta $d018

        inx                     ; next zone (0, 1, 2, 0, 1 ...)
        cpx #ZONES
        bne +
        ldx #0
+       stx zone
        lda zone_line,x         ; raster line of the next interrupt
        sta $d012

        cpx #1                  ; zone 0 was just set up = start of a frame
        bne +
        jmp $ea31               ; once per frame: keyboard, cursor, clock
+       jmp $ea81               ; otherwise: just return

;------------------------------------------------------------------------------
; Zone table. Text row r starts at raster line $33 + r * 8, so
;   zone 1 starts at row 9  -> line $7b, zone 2 at row 17 -> line $bb.
; We trigger 2 lines earlier to give the CPU time to react.
;------------------------------------------------------------------------------
zone            !byte 0
zone_line       !byte $10,  $7b - 2, $bb - 2
zone_border     !byte 14,   2,       5
zone_bg         !byte 6,    0,       11
zone_d018       !byte $15,  $17,     $15      ; $15 = upper case, $17 = lower case

;------------------------------------------------------------------------------
; print_texts: copy the text blocks to the three zones
;------------------------------------------------------------------------------
        !zone print_texts
print_texts
        ldx #0
-       lda text_zone0,x
        sta SCREEN + 2 * 40,x
        lda text_zone1,x
        sta SCREEN + 11 * 40,x
        lda text_zone2,x
        sta SCREEN + 19 * 40,x
        lda #1                  ; white text everywhere
        sta COLORRAM + 2 * 40,x
        sta COLORRAM + 11 * 40,x
        sta COLORRAM + 19 * 40,x
        inx
        cpx #120                ; 3 lines of 40 characters per zone
        bne -
        rts

; !scr: lower case letters become screen codes 1-26, upper case letters
; become 65-90. In the lower case charset (zone 1) both show as letters.
text_zone0
        !scr "  zone 0: blue background, upper case   "
        !scr "  character set ($d018 = $15).          "
        !scr "  irq at raster line $10.               "
text_zone1
        !scr "  Zone 1: black background, red border, "
        !scr "  Lower Case character set ($d018=$17). "
        !scr "  IRQ at raster line $79.               "
text_zone2
        !scr "  zone 2: grey background, green border."
        !scr "  irq at raster line $b9.               "
        !scr "  press space to exit.                  "
