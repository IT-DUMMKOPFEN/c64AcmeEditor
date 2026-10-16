;==============================================================================
;  18 - KEY CODES: HEX, DECIMAL AND BINARY OUTPUT
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  Press any key: the program shows the PETSCII code of the key in
;  hexadecimal, decimal and binary, plus the screen code and the character.
;  A small tool you can use while programming - and three number
;  conversions every 6502 programmer needs.
;
;  What you can learn here:
;    * reading keys with KERNAL GETIN ($FFE4)
;    * byte -> 2 hex digits (shift the high nibble down, table look-up)
;    * byte -> 3 decimal digits with the DECIMAL MODE (SED): the binary
;      number is shifted out bit by bit and doubled in BCD
;    * byte -> 8 binary digits (ASL, carry -> "0" or "1")
;    * PETSCII code -> screen code (they are NOT the same!)
;
;  Further reading on Codebase64:
;    https://codebase64.net/doku.php?id=base:8_bit_to_hexadecimal_conversion
;    https://codebase64.net/doku.php?id=base:hexadecimal_to_decimal_conversion
;    https://codebase64.net/doku.php?id=base:reading_the_keyboard
;    https://codebase64.net/doku.php?id=base:petscii_to_screencode
;  and the character set tables on https://www.pagetable.com/c64ref/charset/
;
;  Press RUN/STOP to return to BASIC (all other keys are shown).
;==============================================================================

        !to "18_key_codes.prg", cbm

SCREEN      = $0400
COLORRAM    = $d800
GETIN       = $ffe4
LINE        = 8                 ; first screen row of the output
OUT         = SCREEN + LINE * 40 + 20   ; values start in column 20

value       = $fb               ; the byte we convert
bcd         = $fc               ; 2 bytes BCD result ($fc/$fd)

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
        lda #0
        sta $d020
        lda #11
        sta $d021
        jsr $e544               ; clear screen
        ldx #0                  ; print the labels (12 rows of 40 chars)
-       lda labels,x
        sta SCREEN + (LINE - 4) * 40,x
        lda labels + 240,x
        sta SCREEN + (LINE - 4) * 40 + 240,x
        lda #15
        sta COLORRAM + (LINE - 4) * 40,x
        sta COLORRAM + (LINE - 4) * 40 + 240,x
        inx
        cpx #240
        bne -
        ldx #39                 ; title in yellow
        lda #7
-       sta COLORRAM + (LINE - 4) * 40,x
        dex
        bpl -

wait
        jsr GETIN               ; 0 = no key in the buffer
        beq wait
        cmp #3                  ; RUN/STOP
        beq exit
        sta key
        jsr show
        jmp wait

exit    lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544

;------------------------------------------------------------------------------
; show: print all representations of "key"
;------------------------------------------------------------------------------
        !zone show
show
        ; ---- the character itself (as screen code) -----------------------------------
        lda key
        jsr petscii_to_screen   ; C = 1: not printable (control code)
        bcc +
        lda #'-'                ; control codes (RETURN, cursor, colours ...)
+       sta OUT
        lda #1
        sta COLORRAM + LINE * 40 + 20

        ; ---- hexadecimal: "$41" ------------------------------------------------------
        lda key
        ldx #40                 ; offset from OUT
        jsr print_hex

        ; ---- decimal: "065" -------------------------------------------------------------
        lda key
        jsr to_bcd              ; bcd+1 = hundreds, bcd = tens/ones
        lda bcd + 1
        ora #'0'                ; digit 0..9 -> screen code of "0".."9"
        sta OUT + 80
        lda bcd
        lsr
        lsr
        lsr
        lsr
        ora #'0'
        sta OUT + 81
        lda bcd
        and #$0f
        ora #'0'
        sta OUT + 82

        ; ---- binary: "01000001" ------------------------------------------------------
        lda key
        sta value
        ldx #0
-       lda #'0' >> 1           ; "0" = $30. $30 / 2 = $18 ...
        asl value               ; ... bit 7 -> carry ...
        rol                     ; ... A = $30 + carry = "0" or "1"
        sta OUT + 120,x
        inx
        cpx #8
        bne -

        ; ---- screen code (hex) ---------------------------------------------------------
        lda key
        jsr petscii_to_screen
        bcc +
        ldx #160                ; no screen code: show "--"
        lda #'-'
        sta OUT,x
        sta OUT + 1,x
        rts
+       ldx #160
        ; fall through to print_hex

;------------------------------------------------------------------------------
; print_hex: A as two hex digits at OUT + X
;------------------------------------------------------------------------------
print_hex
        pha
        lsr                     ; high nibble -> 0..15
        lsr
        lsr
        lsr
        tay
        lda hex_digits,y
        sta OUT,x
        pla
        and #$0f                ; low nibble
        tay
        lda hex_digits,y
        sta OUT + 1,x
        rts

;------------------------------------------------------------------------------
; to_bcd: A (0..255) -> BCD in bcd (tens/ones) and bcd+1 (hundreds)
; For every bit (from the top): result = result * 2 + bit, calculated in
; DECIMAL mode, so ADC carries at 10 instead of 16.
;------------------------------------------------------------------------------
        !zone to_bcd
to_bcd
        sta value
        lda #0
        sta bcd
        sta bcd + 1
        ldx #8
        sed                     ; decimal mode ON
-       asl value               ; next bit -> carry
        lda bcd                 ; bcd = bcd + bcd + carry
        adc bcd
        sta bcd
        lda bcd + 1
        adc bcd + 1
        sta bcd + 1
        dex
        bne -
        cld                     ; decimal mode OFF - never forget this!
        rts

;------------------------------------------------------------------------------
; petscii_to_screen: A = PETSCII -> A = screen code, C = 1 if not printable
;   $20-$3F -> same          $40-$5F -> minus $40      $60-$7F -> minus $20
;   $A0-$BF -> minus $40     $C0-$FE -> minus $80      $FF     -> $5E
;   $00-$1F, $80-$9F: control codes (no character)
;------------------------------------------------------------------------------
        !zone petscii_to_screen
petscii_to_screen
        cmp #$ff
        bne +
        lda #$5e
        clc
        rts
+       tax
        and #%01100000          ; bits 5+6 = 0: $00-$1F or $80-$9F
        bne +
        sec                     ; control code
        rts
+       txa
        cmp #$c0
        bcc +
        sbc #$80                ; $C0-$FE (carry is set here)
        clc
        rts
+       cmp #$a0
        bcc +
        sbc #$40                ; $A0-$BF
        clc
        rts
+       cmp #$60
        bcc +
        sbc #$20                ; $60-$7F
        clc
        rts
+       cmp #$40
        bcc +
        sbc #$40                ; $40-$5F
+       clc                     ; $20-$3F: unchanged
        rts

;------------------------------------------------------------------------------
; Data
;------------------------------------------------------------------------------
key         !byte 0
hex_digits  !scr "0123456789abcdef"

; 12 rows of 40 characters (rows 4..15)
labels  !scr "      key codes - press any key         "
        !scr "                                        "
        !scr "                                        "
        !scr "                                        "
        !scr "  character .......                     "
        !scr "  petscii (hex) ...$                    "
        !scr "  petscii (dec) ...                     "
        !scr "  petscii (bin) ...%                    "
        !scr "  screen code .....$                    "
        !scr "                                        "
        !scr "  run/stop = exit                       "
        !scr "                                        "
