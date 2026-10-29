;==============================================================================
;  21 - INTRO TEMPLATE: picture, music, scroller in the open border
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  A complete intro to start your own: BASIC start line, a Koala picture,
;  SID music and a sprite scroller with the normal C64 font in the opened
;  lower border. Replace the picture, the tune and the text - done.
;
;  Memory map (the memory map below the editor shows it, too):
;      $0801-$0fff  BASIC line + program
;      $1000-$13ff  music (demo_tune.sid: load $1000, init $1000, play $1003)
;      $1400-       scroll text, tables
;      $2000-$27ff  copy of the character ROM (the font of the scroller)
;      ---- VIC bank 1 ($4000-$7fff) ----
;      $4000-$41ff  8 sprites (the scroller)
;      $4800-$4be8  colour RAM data of the picture (copied to $d800)
;      $5c00-$5fe7  screen RAM = colours of the picture (loaded there directly)
;      $5ff8-$5fff  sprite pointers
;      $6000-$7f3f  bitmap of the picture
;      $7fff        0 = empty pattern in the open border
;
;  Interrupts (two per frame, the KERNAL stays on):
;      line 249  switch to 24 rows: the VIC misses the start of the lower
;                border - it stays open and the sprites can be seen there
;      line 20   back to 25 rows, play the music, scroll the text,
;                KERNAL keyboard scan (SPACE = exit)
;
;  The scroller: 8 sprites, double width and height, side by side
;  (8 x 48 = 384 pixels, wider than the screen: the last sprite is hidden
;  behind the right border - the new letters appear there). Every frame
;  all sprite bytes are shifted one bit to the left (ROL from right to
;  left); after 8 bits the next letter is fetched from the font.
;
;  What you can learn here: combining the techniques of examples 05, 09,
;  10 and 19 - and how to plan the memory of a whole program.
;
;  Press SPACE to return to BASIC.
;==============================================================================

        !to "21_intro_template.prg", cbm

; ---- your files: the tune here, the picture at the end of the file ----------
MUSIC_LOAD  = $1000             ; see Tools > SID Info for your tune
MUSIC_INIT  = $1000
MUSIC_PLAY  = $1003
SID_HEADER  = $7e               ; PSID header + load address

; ---- memory ------------------------------------------------------------------
FONT        = $2000             ; copy of the character ROM
SPRITES     = $4000             ; 8 x 64 bytes
COLOR_DATA  = $4800
BG_DATA     = COLOR_DATA + 1000
SCREEN      = $5c00
BITMAP      = $6000
SPRITE_PTRS = SCREEN + $3f8

; ---- scroller ------------------------------------------------------------------
SCROLL_Y    = 254               ; sprite Y: lines 255-270 (in the lower border)
OPEN_LINE   = 249               ; between line 247 and 251
TOP_LINE    = 20

text_ptr    = $fb
font_ptr    = $fd

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
        sei
        lda #0
        sta $d020
        jsr copy_font
        jsr show_picture
        jsr init_sprites
        lda #0                  ; song 1
        jsr MUSIC_INIT

        lda #<scroll_text
        sta text_ptr
        lda #>scroll_text
        sta text_ptr + 1
        lda #0
        sta bits_left           ; fetch the first letter at once

        ; ---- raster interrupts ---------------------------------------------------
        lda #$7f
        sta $dc0d               ; CIA timer interrupt off
        lda $dc0d
        lda #<irq_open
        sta $0314
        lda #>irq_open
        sta $0315
        lda #OPEN_LINE
        sta $d012
        lda $d011
        and #%01111111
        sta $d011
        lda #1
        sta $d01a
        lda #$ff
        sta $d019
        cli

        ; ---- main program: nothing to do but wait for SPACE --------------------
-       jsr $ffe4
        cmp #' '
        bne -

        ; ---- clean exit ------------------------------------------------------------
        sei
        lda #0
        sta $d01a
        sta $d015
        lda #$ff
        sta $d019
        lda #$31
        sta $0314
        lda #$ea
        sta $0315
        lda #$81
        sta $dc0d
        ldx #$18                ; SID silent
        lda #0
-       sta $d400,x
        dex
        bpl -
        lda $dd00               ; VIC bank 0, text mode
        ora #%00000011
        sta $dd00
        lda #$15
        sta $d018
        lda #$1b
        sta $d011
        lda #$c8
        sta $d016
        lda #14
        sta $d020
        lda #6
        sta $d021
        cli
        jmp $e544

;------------------------------------------------------------------------------
; IRQ at line 249: open the lower border
;------------------------------------------------------------------------------
irq_open
        lda #$ff
        sta $d019
        lda $d011
        and #%01110111          ; 24 rows (bit 3 = 0), raster bit 8 = 0
        sta $d011
        lda #<irq_top
        sta $0314
        lda #>irq_top
        sta $0315
        lda #TOP_LINE
        sta $d012
        jmp $ea81               ; end of interrupt, no KERNAL tasks

;------------------------------------------------------------------------------
; IRQ at line 20: 25 rows again, music, scroller, keyboard
;------------------------------------------------------------------------------
irq_top
        lda #$ff
        sta $d019
        lda $d011
        ora #%00001000          ; 25 rows
        and #%01111111
        sta $d011

        jsr MUSIC_PLAY
        jsr scroll
        jsr cycle_colors

        lda #<irq_open
        sta $0314
        lda #>irq_open
        sta $0315
        lda #OPEN_LINE
        sta $d012
        jmp $ea31               ; KERNAL: keyboard (for GETIN), then return

;------------------------------------------------------------------------------
; scroll: one bit (= 2 pixels, the sprites are double width) per frame
;------------------------------------------------------------------------------
        !zone scroll
scroll
        lda bits_left
        bne +
        jsr next_letter
+       dec bits_left
        ; all 8 pixel rows: the letter's next bit enters sprite 7 on the right,
        ; every bit moves one place to the left, through all 24 bytes of a row
        !for row, 0, 7 {
            asl letter + row
            !for spr, 0, 7 {
                !for b, 0, 2 {
                    rol SPRITES + (7 - spr) * 64 + row * 3 + (2 - b)
                }
            }
        }
        rts

        !zone next_letter
next_letter
        ldy #0
        lda (text_ptr),y
        bpl +                   ; $ff = end of the text: start again
        lda #<scroll_text
        sta text_ptr
        lda #>scroll_text
        sta text_ptr + 1
        lda (text_ptr),y
+       sta font_ptr            ; font address = FONT + screen code * 8
        lda #0
        asl font_ptr
        rol
        asl font_ptr
        rol
        asl font_ptr
        rol
        adc #>FONT              ; (carry is 0: code < 128)
        sta font_ptr + 1
        ldy #7
-       lda (font_ptr),y
        sta letter,y
        dey
        bpl -
        inc text_ptr
        bne +
        inc text_ptr + 1
+       lda #8
        sta bits_left
        rts

;------------------------------------------------------------------------------
; cycle_colors: the 8 sprites get colours from a moving gradient
;------------------------------------------------------------------------------
        !zone cycle_colors
cycle_colors
        inc .delay
        lda .delay
        and #3                  ; every 4th frame
        bne .done
        inc .pos
        ldx #7
        ldy .pos
-       tya
        and #15
        tay
        lda gradient,y
        sta $d027,x
        iny
        dex
        bpl -
.done   rts
.delay  !byte 0
.pos    !byte 0

;------------------------------------------------------------------------------
; setup routines
;------------------------------------------------------------------------------
        !zone copy_font
copy_font                       ; character ROM -> FONT (interrupts are off)
        lda #$33
        sta $01                 ; character ROM visible at $d000
        ldx #0
-       !for page, 0, 7 {
            lda $d000 + page * 256,x
            sta FONT + page * 256,x
        }
        inx
        bne -
        lda #$37
        sta $01
        rts

        !zone show_picture
show_picture
        ldx #0                  ; colour RAM of the picture
-       !for block, 0, 3 {
            lda COLOR_DATA + block * 250,x
            sta $d800 + block * 250,x
        }
        inx
        cpx #250
        bne -
        lda BG_DATA
        sta $d021
        lda #0
        sta $7fff               ; empty open border
        lda $dd00
        and #%11111100
        ora #%00000010          ; VIC bank 1
        sta $dd00
        lda #$78                ; screen $5c00, bitmap $6000
        sta $d018
        lda #%00111011          ; bitmap mode, 25 rows
        sta $d011
        lda #%11011000          ; multicolour
        sta $d016
        rts

        !zone init_sprites
init_sprites
        lda #0                  ; clear the sprite graphics
        tax
-       sta SPRITES,x
        sta SPRITES + $100,x
        inx
        bne -
        ldx #7
-       txa                     ; pointers: blocks 0-7 of bank 1 = $4000-$41ff
        clc
        adc #(SPRITES & $3fff) / 64
        sta SPRITE_PTRS,x
        dex
        bpl -
        ldx #0
        ldy #0
-       lda sprite_x,x          ; X positions 24, 72, 120 ... 360
        sta $d000,y
        lda #SCROLL_Y
        sta $d001,y
        iny
        iny
        inx
        cpx #8
        bne -
        lda #%11100000          ; sprites 5-7 at X >= 256
        sta $d010
        lda #$ff
        sta $d01d               ; double width
        sta $d017               ; double height
        sta $d015               ; all on
        lda #0
        sta $d01c               ; single colour
        sta $d01b               ; in front of the graphics
        rts

;------------------------------------------------------------------------------
; the music
;------------------------------------------------------------------------------
        * = MUSIC_LOAD
        !bin "music/demo_tune.sid",, SID_HEADER

;------------------------------------------------------------------------------
; data
;------------------------------------------------------------------------------
        * = $1400
bits_left   !byte 0
letter      !fill 8, 0
sprite_x    !for i, 0, 7 { !byte <(24 + i * 48) }
gradient    !byte 9, 2, 8, 10, 15, 7, 1, 1, 7, 15, 10, 8, 2, 9, 0, 0

; the scroll text: screen codes (!scr), $ff = end
scroll_text
        !scr "hello and welcome to the c64 acme editor intro template!   "
        !scr "a koala picture, sid music and this scroller in the "
        !scr "open lower border...   change the picture, the tune and "
        !scr "this text and you have your own intro.   "
        !scr "greetings to all c64 coders!          "
        !byte $ff

;------------------------------------------------------------------------------
; the picture (Koala: 2 bytes load address, bitmap, screen, colours, bg)
;------------------------------------------------------------------------------
        * = COLOR_DATA
        !bin "gfx/picture.kla", 1000, 9002     ; colour RAM data
        !bin "gfx/picture.kla", 1, 10002       ; background colour (BG_DATA)
        * = SCREEN
        !bin "gfx/picture.kla", 1000, 8002     ; screen RAM, used directly
        * = BITMAP
        !bin "gfx/picture.kla", 8000, 2        ; bitmap, used directly
