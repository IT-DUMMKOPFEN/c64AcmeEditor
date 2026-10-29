;==============================================================================
;  SNIPPET: Pseudo random numbers (8-bit and 16-bit LFSR)
;  Category: Maths & Tools               Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  A "linear feedback shift register": shift the number one bit, and if a
;  1 falls out, EOR it with a magic constant. Tiny and fast, but it repeats:
;
;      random8    period 255      (EOR #$1d)  - fine for small things
;      random16   period 65535    (EOR $b400) - looks really random
;
;  The seed must never be 0 (0 stays 0 forever). For different numbers in
;  every run, set the seed from something random at the start, e.g.
;  lda $d012 : ora #1 : sta seed8   (the raster line when the user pressed
;  a key), or use the SID noise (snippet "Random numbers from the SID").
;
;  How to use:  jsr random8 / jsr random16  -> A = random byte
;==============================================================================

        !zone random
random8
        lda seed8
        asl                     ; bit 7 -> carry
        bcc +
        eor #$1d                ; taps for a maximal length (255)
+       sta seed8
        rts

random16
        lsr seed16 + 1          ; shift right, bit 0 -> carry
        ror seed16
        bcc +
        lda seed16 + 1
        eor #$b4                ; taps $b400 (maximal length 65535)
        sta seed16 + 1
+       lda seed16
        rts

seed8   !byte $01
seed16  !word $ace1

        ; ---- example: random number 0 - 9 ---------------------------------------
random_0_9
-       jsr random16
        and #15                 ; 0-15 ...
        cmp #10
        bcs -                   ; ... retry if >= 10: every value equally likely
        rts
