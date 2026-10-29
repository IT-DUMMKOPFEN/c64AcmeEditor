;==============================================================================
;  SNIPPET: Print numbers: hex, decimal (8 + 16 bit), binary
;  Category: Text                        Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Writes a number directly into the screen memory at a pointer.
;      num_ptr  ($fb/$fc) = where the digits go (screen address)
;
;  print_hex8    A          -> "3f"          (2 digits)
;  print_hex16   A/X = lo/hi -> "c000"       (4 digits)
;  print_dec8    A          -> "063"          (3 digits, 0-255)
;  print_dec16   A/X = lo/hi -> "49152"      (5 digits, 0-65535)
;  print_bin8    A          -> "00111111"     (8 digits)
;
;  Decimal uses the 6502 DECIMAL MODE: the number is shifted out bit by
;  bit and doubled in BCD ("binary coded decimal": each nibble one digit).
;
;  Example:  lda #<($0400 + 40 * 2) : sta num_ptr
;            lda #>($0400 + 40 * 2) : sta num_ptr + 1
;            lda #200 : jsr print_dec8          -> "200" in row 2
;  Changes: A, X, Y
;==============================================================================

num_ptr     = $fb

        !zone print_numbers
print_hex8
        ldy #0
.hex8   pha
        lsr
        lsr
        lsr
        lsr
        tax
        lda .digits,x           ; high nibble
        sta (num_ptr),y
        iny
        pla
        and #$0f
        tax
        lda .digits,x           ; low nibble
        sta (num_ptr),y
        rts

print_hex16                     ; A = low byte, X = high byte
        pha
        txa
        ldy #0
        jsr .hex8               ; high byte first
        pla
        ldy #2
        jmp .hex8

print_bin8
        ldy #0
        sta .value
-       lda #'0' >> 1           ; $18: shifted left with the bit -> "0"/"1"
        asl .value
        rol
        sta (num_ptr),y
        iny
        cpy #8
        bne -
        rts

print_dec8
        ldx #0                  ; high byte 0
        ldy #1                  ; 1 = print 3 digits
        bne .dec                ; (always jumps)
print_dec16                     ; A = low byte, X = high byte
        ldy #0                  ; 0 = print 5 digits
.dec    sty .digits8
        sta .value
        stx .value + 1
        lda #0
        sta .bcd
        sta .bcd + 1
        sta .bcd + 2
        ldx #16                 ; 16 bits
        sed                     ; decimal mode on
-       asl .value              ; next bit -> carry
        rol .value + 1
        lda .bcd                ; bcd = bcd * 2 + carry (in decimal!)
        adc .bcd
        sta .bcd
        lda .bcd + 1
        adc .bcd + 1
        sta .bcd + 1
        lda .bcd + 2
        adc .bcd + 2
        sta .bcd + 2
        dex
        bne -
        cld                     ; decimal mode off - never forget!
        ldy #0
        ldx .digits8            ; 8-bit entry: only 3 digits
        bne .three
        lda .bcd + 2            ; 5 digits: ten thousands ...
        jsr .one
        lda .bcd + 1
        jsr .two
        lda .bcd
        jmp .two
.three  lda .bcd + 1            ; 3 digits: hundreds, tens, ones
        jsr .one
        lda .bcd
        jmp .two
.two    pha                     ; two BCD digits
        lsr
        lsr
        lsr
        lsr
        jsr .one
        pla
.one    and #$0f                ; one BCD digit
        ora #'0'                ; screen code of "0" is $30
        sta (num_ptr),y
        iny
        rts

.value      !word 0
.bcd        !byte 0, 0, 0
.digits8    !byte 0
.digits     !scr "0123456789abcdef"
