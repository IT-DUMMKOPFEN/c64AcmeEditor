;==============================================================================
;  SNIPPET: Play SID music in a raster interrupt
;  Category: Sound                       Type: program (open as a new file)
;------------------------------------------------------------------------------
;  A .sid file contains a music program with two entry points:
;      init  ($1000 here)  call once, A = song number - 1
;      play  ($1003 here)  call 50 times per second (once per frame)
;  The file starts with a header (PSID, $7c bytes) and a 2-byte load
;  address. !bin skips both ($7e bytes) and puts the music at its load
;  address. The SID info dialog (Tools > SID Info) shows the addresses of
;  your tune - they are different for every tune!
;
;  The border shows how much time the player needs ("raster time").
;
;  Replace "data/demo_tune.sid" and the three addresses by your tune.
;==============================================================================

MUSIC_LOAD  = $1000             ; from the SID header
MUSIC_INIT  = $1000
MUSIC_PLAY  = $1003
SID_HEADER  = $7e               ; skip: PSID header ($7c) + load address (2)
SONG        = 0                 ; first song

        * = $0801
        !word +, 10
        !byte $9e
        !text "2061"
        !byte 0
+       !word 0

start
        lda #0
        sta $d020
        sta $d021
        jsr $e544
        lda #SONG
        jsr MUSIC_INIT          ; initialise the tune

        sei
        lda #$7f
        sta $dc0d               ; CIA timer interrupt off
        lda $dc0d
        lda #<irq
        sta $0314
        lda #>irq
        sta $0315
        lda #$f8                ; raster line below the text screen
        sta $d012
        lda $d011
        and #$7f
        sta $d011
        lda #1
        sta $d01a
        lda #$ff
        sta $d019
        cli

-       jsr $ffe4               ; main program: wait for SPACE
        cmp #' '
        bne -

        sei
        lda #0
        sta $d01a
        lda #$31
        sta $0314
        lda #$ea
        sta $0315
        lda #$81
        sta $dc0d
        lda #0                  ; SID silent
        sta $d418
        cli
        lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544

irq     lda #$ff
        sta $d019               ; acknowledge
        inc $d020               ; raster time meter on
        jsr MUSIC_PLAY
        dec $d020               ; ... and off
        jmp $ea31

        * = MUSIC_LOAD
        !bin "data/demo_tune.sid",, SID_HEADER
