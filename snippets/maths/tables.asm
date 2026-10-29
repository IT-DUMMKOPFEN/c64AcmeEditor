;==============================================================================
;  SNIPPET: Tables calculated by ACME (sine, row addresses, ...)
;  Category: Maths & Tools               Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Instead of calculating at run time (slow on a 1 MHz CPU), let ACME
;  calculate tables when the program is assembled. !for repeats a line,
;  sin(), cos(), float(), int() work with real numbers.
;
;  sine256      256 values 0-255, one full wave - for movements (sprites,
;               raster bars, scrollers): add a speed to an index each frame
;  row_lo/hi    start address of each of the 25 screen rows - replaces the
;               multiplication row * 40
;  mul40        row * 40 as 16-bit values (alternative)
;  bits         single bits for "set bit n"
;==============================================================================

PI          = 3.14159265
TBL_SCREEN  = $0400

        !align 255, 0           ; start on a page: index access never crosses
sine256     !for i, 0, 255 { !byte int(127.5 + 127.5 * sin(float(i) * 2 * PI / 256)) }

row_lo      !for r, 0, 24 { !byte <(TBL_SCREEN + r * 40) }
row_hi      !for r, 0, 24 { !byte >(TBL_SCREEN + r * 40) }
mul40       !for r, 0, 24 { !word r * 40 }
bits        !for b, 0, 7 { !byte 1 << b }

        ; ---- example: sprite 0 moves along the sine wave ------------------------
sine_example
        inc .pos
        ldx .pos
        lda sine256,x
        lsr                     ; 0-127
        clc
        adc #60                 ; Y 60-187
        sta $d001
        rts
.pos    !byte 0
