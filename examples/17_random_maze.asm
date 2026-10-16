;==============================================================================
;  17 - RANDOM MAZE (10 PRINT in assembler) + pseudo random numbers
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  The famous BASIC one-liner   10 PRINT CHR$(205.5+RND(1)); : GOTO 10
;  in machine code. The characters 205 "\" and 206 "/" are printed at
;  random and form an endless maze.
;
;  The random numbers come from a "linear feedback shift register" (LFSR):
;  shift the number by one bit, and if a 1 falls out, EOR it with a magic
;  constant. Very small and very fast - but not truly random:
;
;    * 8-bit LFSR  (EOR #$1D): repeats after 255 numbers. You can SEE the
;      repetition in the maze - the same pattern comes back again and again.
;    * 16-bit LFSR (EOR #$B4 into the high byte): repeats after 65535
;      numbers - looks random.
;
;  Keys:  8 = use the 8-bit generator,  6 = use the 16-bit generator,
;         SPACE = return to BASIC
;
;  What you can learn here:
;    * a Galois LFSR, the most common pseudo random generator on the C64
;    * why the period (length until it repeats) matters
;    * KERNAL CHROUT, also for scrolling the screen
;
;  Further reading on Codebase64:
;    https://codebase64.net/doku.php?id=base:small_fast_8-bit_prng
;    https://codebase64.net/doku.php?id=base:16bit_xorshift_random_generator
;    https://codebase64.net/doku.php?id=base:comparison_of_6502_random_generators
;==============================================================================

        !to "17_random_maze.prg", cbm

CHROUT      = $ffd2
GETIN       = $ffe4
PER_FRAME   = 6                 ; characters per frame (speed of the maze)

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
        lda #6                  ; blue background, light blue maze
        sta $d020
        sta $d021
        lda #154                ; PETSCII 154 = light blue text colour
        jsr CHROUT
        lda #147                ; clear screen
        jsr CHROUT

frame
-       lda $d012               ; slow down: wait for the next frame
        cmp #$fa
        bne -

        ldx #PER_FRAME
.char   jsr random              ; A = random number
        and #1                  ; 0 or 1 ...
        clc
        adc #205                ; ... -> 205 "\" or 206 "/"
        jsr CHROUT              ; (CHROUT keeps X and Y)
        dex
        bne .char

        jsr GETIN
        cmp #'8'
        bne +
        lda #0                  ; switch to the 8-bit generator
        sta mode
+       cmp #'6'
        bne +
        lda #1                  ; switch to the 16-bit generator
        sta mode
+       cmp #' '
        bne frame
        lda #14
        sta $d020
        lda #154
        jsr CHROUT
        lda #147
        jmp CHROUT

;------------------------------------------------------------------------------
; random: returns a pseudo random number in A (8 or 16 bit LFSR)
;------------------------------------------------------------------------------
        !zone random
random
        lda mode
        bne .lfsr16

        ; ---- 8 bit: period 255 -----------------------------------------------------
        lda seed8
        asl                     ; shift left, bit 7 -> carry
        bcc +                   ; a 0 fell out: done
        eor #$1d                ; a 1 fell out: apply the "taps"
+       sta seed8
        rts

        ; ---- 16 bit: period 65535 ---------------------------------------------------
.lfsr16
        lsr seed16 + 1          ; shift the 16-bit value right,
        ror seed16              ;   bit 0 -> carry
        bcc +
        lda seed16 + 1          ; a 1 fell out: EOR the high byte with $B4
        eor #$b4                ; (taps $B400 = maximal length for 16 bits)
        sta seed16 + 1
+       lda seed16
        rts

mode        !byte 1             ; 0 = 8 bit, 1 = 16 bit
seed8       !byte $01           ; the seed must never be 0!
seed16      !word $ace1         ; (0 would stay 0 forever)
