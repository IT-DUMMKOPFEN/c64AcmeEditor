;==============================================================================
;  SNIPPET: Show a Doodle picture (.dd, hires)
;  Category: Graphics                    Type: program (open as a new file)
;------------------------------------------------------------------------------
;  Doodle saves hires pictures exactly as they are in memory (9218 bytes):
;
;      offset 0      2 bytes  load address ($5c00)
;      $5c00      1024 bytes  screen RAM (colours; 1000 used)
;      $6000      8000 bytes  bitmap (+ 192 unused bytes)
;
;  Both parts are already at the right place for VIC bank 1: screen RAM
;  at $5c00 (bank + $1c00) and bitmap at $6000 (bank + $2000). Nothing has
;  to be copied - only $dd00, $d018, $d011 and $d016 are set.
;
;      $d018 = (screen offset / $400) * 16 + (bitmap offset / $2000) * 8
;            = 7 * 16 + 1 * 8 = $78
;
;  Replace "data/picture.dd" by your own picture. Press SPACE to return.
;==============================================================================

        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

start
        lda #0
        sta $d020
        lda $dd00               ; VIC bank 1 ($4000-$7fff)
        and #%11111100
        ora #%00000010
        sta $dd00
        lda #$78                ; screen $5c00, bitmap $6000
        sta $d018
        lda #%00111011          ; bitmap mode
        sta $d011
        lda #%11001000          ; hires
        sta $d016

-       jsr $ffe4
        cmp #' '
        bne -

        lda $dd00
        ora #%00000011
        sta $dd00
        lda #$15
        sta $d018
        lda #$1b
        sta $d011
        lda #14
        sta $d020
        jmp $e544

        * = $5c00
        !bin "data/picture.dd",, 2
