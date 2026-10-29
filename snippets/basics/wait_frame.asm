;==============================================================================
;  SNIPPET: Wait for the next frame (raster line)
;  Category: Basics                      Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The simplest way to time a program: wait until the VIC-II has drawn a
;  certain raster line. Called once per main loop, your code runs exactly
;  50 times per second (PAL) - smooth movement without interrupts.
;
;  The raster line has 9 bits: $d012 = bits 0-7, $d011 bit 7 = bit 8.
;  Lines 0-311 exist on PAL. The routine waits for line WAIT_LINE (< 256),
;  first waits until the line is NOT reached, so it never returns twice in
;  the same frame.
;
;  How to use:  jsr wait_frame
;  Changes:     A
;==============================================================================

WAIT_LINE   = $fb               ; below the visible text screen (lines 51-250)

        !zone wait_frame
wait_frame
-       lda $d012               ; still on the line of the last call?
        cmp #WAIT_LINE
        beq -
-       lda $d011               ; bit 7 = raster line bit 8: must be 0
        bmi -
        lda $d012
        cmp #WAIT_LINE
        bne -
        rts
