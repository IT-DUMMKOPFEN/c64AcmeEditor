;==============================================================================
;  SNIPPET: VIC bank and memory setup (macro)
;  Category: Graphics                    Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The VIC-II sees only 16 KB at a time ("bank"):
;      bank 0 $0000-$3fff   $dd00 bits 0-1 = %11
;      bank 1 $4000-$7fff                 = %10
;      bank 2 $8000-$bfff                 = %01
;      bank 3 $c000-$ffff                 = %00
;  In banks 0 and 2 the VIC sees the character ROM at +$1000-$1fff
;  (so no graphics there). Banks 1 and 3 are completely free RAM.
;
;  Inside the bank, $d018 selects:
;      bits 4-7  screen RAM   (offset / $400)
;      bits 1-3  charset      (offset / $800)   text mode
;      bit  3    bitmap       (offset / $2000)  bitmap mode
;  Sprite pointers are always at screen RAM + $3f8.
;
;  The macro calculates everything from real addresses:
;      +vic_setup $4400, $6000        ; screen $4400, charset/bitmap $6000
;  ACME stops with an error if the addresses are not in the same bank.
;==============================================================================

!macro vic_setup .screen, .gfx {
        !if (.screen >> 14) != (.gfx >> 14) {
            !error "screen and charset/bitmap must be in the same 16 KB bank"
        }
        lda $dd00
        and #%11111100
        ora #3 - (.screen >> 14)        ; bank number, inverted
        sta $dd00
        lda #((.screen & $3fff) / $400) << 4 | ((.gfx & $3fff) / $800) << 1
        sta $d018
}

        ; ---- examples ------------------------------------------------------------
vic_example
        +vic_setup $0400, $3000         ; normal screen, charset at $3000
        rts
vic_example_bitmap
        +vic_setup $4400, $6000         ; bank 1: bitmap $6000, colours $4400
        rts
