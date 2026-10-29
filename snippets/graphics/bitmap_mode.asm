;==============================================================================
;  SNIPPET: Bitmap mode on / off and clear the bitmap
;  Category: Graphics                    Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  bitmap_on    hires bitmap at $2000, colours from the screen RAM $0400
;               (high nibble = pixel colour, low nibble = background)
;  bitmap_off   back to the text screen
;  bitmap_clear sets all 8000 bytes of the bitmap to 0 and the colours to
;               BM_COLORS
;
;  Registers:
;    $d011 bit 5 = bitmap mode      $d016 bit 4 = multicolour
;    $d018 bit 3 = bitmap at +$2000 (bits 4-7 = screen RAM / $400)
;
;  For multicolour (160 x 200, 4 colours per cell) also set $d016 bit 4
;  and fill the colour RAM ($d800) with the third colour.
;
;  Zero page: $fb/$fc        Changes: A, X, Y
;==============================================================================

BM_BITMAP   = $2000
BM_SCREEN   = $0400
BM_COLORS   = $10               ; white pixels on black
bm_ptr      = $fb

        !zone bitmap_mode
bitmap_on
        lda #%00111011          ; bitmap mode, screen on, 25 rows
        sta $d011
        lda #%00011000          ; screen $0400, bitmap $2000
        sta $d018
        lda #%11001000          ; hires, 40 columns
        sta $d016
        rts

bitmap_off
        lda #%00011011          ; text mode
        sta $d011
        lda #%00010101          ; screen $0400, charset ROM (upper case)
        sta $d018
        rts

bitmap_clear
        lda #<BM_BITMAP
        sta bm_ptr
        lda #>BM_BITMAP
        sta bm_ptr + 1
        lda #0
        tay
        ldx #32                 ; 32 pages = 8192 bytes (a bit more than 8000)
-       sta (bm_ptr),y
        iny
        bne -
        inc bm_ptr + 1
        dex
        bne -
        lda #BM_COLORS          ; colours of all 1000 cells
-       sta BM_SCREEN,x
        sta BM_SCREEN + 250,x
        sta BM_SCREEN + 500,x
        sta BM_SCREEN + 750,x
        inx
        cpx #250
        bne -
        rts
