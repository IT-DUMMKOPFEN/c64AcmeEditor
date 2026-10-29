;==============================================================================
;  SNIPPET: "Press SPACE to continue"
;  Category: Input                       Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Waits until SPACE is pressed and released again. Reads the keyboard
;  matrix directly, so it also works when the KERNAL is switched off or
;  interrupts are disabled. Waiting for the release prevents that the same
;  key press is seen again by the next part of your program.
;
;  How to use:  jsr wait_space
;  Changes:     A
;==============================================================================

        !zone wait_space
wait_space
-       lda #$7f                ; column 7 (SPACE is row 4) - set it in every
        sta $dc00               ;  pass, the KERNAL interrupt changes $dc00
        lda $dc01
        and #$10
        bne -                   ; wait for "pressed" (bit = 0)
-       lda #$7f
        sta $dc00
        lda $dc01
        and #$10
        beq -                   ; wait for "released"
        lda #$ff
        sta $dc00
        rts
