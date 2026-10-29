;==============================================================================
;  SNIPPET: Clean return to BASIC
;  Category: Basics                      Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Ends a program and brings the C64 back into a normal state:
;    * raster interrupts off, KERNAL interrupt and CIA timer back on
;    * ROMs on ($01 = $37), VIC bank 0, text mode, default charset
;    * sprites off, SID silent, colours as after power-on
;    * screen cleared, then back to BASIC (READY.)
;
;  How to use:  jmp return_to_basic   (from anywhere, also from inside your
;               own interrupt setup - the stack is not needed)
;==============================================================================

        !zone return_to_basic
return_to_basic
        sei
        lda #$37                ; BASIC, KERNAL and I/O visible
        sta $01
        lda #0
        sta $d01a               ; no raster interrupts
        sta $d015               ; sprites off
        lda #$ff
        sta $d019               ; clear pending VIC interrupts
        lda #$31                ; KERNAL interrupt routine $ea31
        sta $0314
        lda #$ea
        sta $0315
        lda #$81                ; CIA 1 timer A interrupt on again
        sta $dc0d
        lda $dc0d

        lda $dd00               ; VIC bank 0 ($0000-$3fff)
        ora #%00000011
        sta $dd00
        lda #$1b                ; text mode, 25 rows, screen on
        sta $d011
        lda #$c8                ; 40 columns, no multicolour
        sta $d016
        lda #$15                ; screen $0400, upper case charset
        sta $d018

        ldx #$18                ; SID: all registers 0 = silent
        lda #0
-       sta $d400,x
        dex
        bpl -

        lda #14                 ; light blue border and text
        sta $d020
        sta $0286
        lda #6                  ; blue background
        sta $d021
        cli
        jsr $e544               ; clear the screen
        ldx #$fa                ; fresh stack
        txs
        jmp ($a002)             ; BASIC warm start: prints READY.
