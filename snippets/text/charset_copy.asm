;==============================================================================
;  SNIPPET: Own character set (copy the ROM font and change characters)
;  Category: Text                        Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The VIC-II can read the character shapes from RAM. $d018 bits 1-3 select
;  the charset address inside the VIC bank (in steps of 2 KB):
;      $d018 = (screen / $400) * 16 + (charset / $800) * 2
;      screen $0400, charset $3000:  $d018 = $1c
;
;  copy_charset  copies the 2 KB upper case font from the character ROM
;                ($d000, only visible to the CPU with $01 = $33) to CHARSET
;  set_char      replaces character A with 8 bytes from (cc_src)
;
;  Your own font from a file instead:  * = $3000  !bin "myfont.bin"
;  (2048 bytes, no load address; use !bin "file",, 2 to skip one)
;
;  How to use:  jsr copy_charset         ; then e.g. turn "@" into a heart:
;               lda #<heart : sta cc_src : lda #>heart : sta cc_src + 1
;               lda #0 : jsr set_char
;==============================================================================

CHARSET     = $3000             ; must be a multiple of $800, not $1000/$1800
                                ; (there the VIC sees the ROM charset)
cc_src      = $fb
cc_dst      = $fd

        !zone copy_charset
copy_charset
        sei                     ; no interrupts: I/O is switched off now
        lda $01
        pha
        lda #$33                ; character ROM at $d000 visible
        sta $01
        ldx #0
-       !for page, 0, 7 {
            lda $d000 + page * 256,x
            sta CHARSET + page * 256,x
        }
        inx
        bne -
        pla
        sta $01                 ; I/O back
        cli
        lda #(($0400 / $400) << 4) | ((CHARSET & $3fff) / $800 << 1)
        sta $d018               ; screen $0400 + our charset
        rts

        !zone set_char
set_char                        ; A = screen code, (cc_src) = 8 bytes
        ldx #0
        stx cc_dst + 1
        asl                     ; address = CHARSET + A * 8
        rol cc_dst + 1
        asl
        rol cc_dst + 1
        asl
        rol cc_dst + 1
        sta cc_dst
        lda cc_dst + 1
        clc
        adc #>CHARSET
        sta cc_dst + 1
        ldy #7
-       lda (cc_src),y
        sta (cc_dst),y
        dey
        bpl -
        rts

heart   !byte %01101100
        !byte %11111110
        !byte %11111110
        !byte %11111110
        !byte %01111100
        !byte %00111000
        !byte %00010000
        !byte %00000000
