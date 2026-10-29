;==============================================================================
;  SNIPPET: Sprite settings: multicolour, expand, priority
;  Category: Sprites                     Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  All these registers have one bit per sprite (bit 0 = sprite 0 ...):
;
;    $d015  sprite on
;    $d017  double height (Y expand)       $d01d  double width (X expand)
;    $d01b  priority: 1 = sprite BEHIND the foreground graphics
;           (text characters / bitmap pixels), 0 = in front
;    $d01c  multicolour: 12 x 21 double-wide pixels, 3 colours:
;             bit pair %01 = $d025 (shared multicolour 1)
;             bit pair %10 = $d027 + n (the sprite's own colour)
;             bit pair %11 = $d026 (shared multicolour 2)
;             bit pair %00 = transparent
;
;  Sprites with a lower number are drawn in front of higher numbers.
;
;  How to use:  jsr sprite_settings  (adjust the values to your sprites)
;==============================================================================

        !zone sprite_settings
sprite_settings
        lda #%00001111          ; sprites 0-3 multicolour
        sta $d01c
        lda #1                  ; shared multicolour 1: white
        sta $d025
        lda #11                 ; shared multicolour 2: dark grey
        sta $d026
        lda #%00000011          ; sprites 0+1 double width and height
        sta $d01d
        sta $d017
        lda #%10000000          ; sprite 7 behind the text
        sta $d01b
        rts

        ; ---- a multicolour sprite row: 4 double-wide pixels per byte ------------
        ;      %00 transparent, %01 = $d025, %10 = $d027+n, %11 = $d026
mc_row_example
        !byte %00010110, %10101010, %10010100
