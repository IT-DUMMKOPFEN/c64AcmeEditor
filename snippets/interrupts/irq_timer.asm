;==============================================================================
;  SNIPPET: Timer interrupt with any frequency (CIA 1)
;  Category: Interrupts                  Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The KERNAL already uses timer A of CIA 1 for its interrupt (60 times per
;  second). By changing the timer value you get interrupts at any rate -
;  independent of the raster beam. Typical use: music that needs 100 or 200
;  calls per second ("2x / 4x speed"), or the same speed on PAL and NTSC.
;
;      timer value = CPU clock / frequency - 1
;      PAL CPU clock = 985248 Hz, NTSC = 1022727 Hz
;
;  The KERNAL keyboard scan runs at the same rate (JMP $EA31) - harmless.
;
;  How to use:  jsr timer_init      ...      jsr timer_stop
;==============================================================================

CPU_CLOCK   = 985248            ; PAL
TIMER_HZ    = 100               ; interrupts per second
TIMER_VALUE = CPU_CLOCK / TIMER_HZ - 1

        !zone timer_init
timer_init
        sei
        lda #<timer_irq
        sta $0314
        lda #>timer_irq
        sta $0315
        lda #<TIMER_VALUE
        sta $dc04               ; timer A latch, low byte
        lda #>TIMER_VALUE
        sta $dc05               ; high byte
        lda #%00010001          ; load the latch (bit 4) and start (bit 0),
        sta $dc0e               ;  continuous mode
        lda #%10000001
        sta $dc0d               ; timer A interrupt on
        cli
        rts

        !zone timer_irq
timer_irq
        ; the KERNAL routine at $ea31 acknowledges the CIA interrupt
        ; (it reads $dc0d) - so we only do our work here:
        inc timer_count         ; ---- your code here (e.g. jsr MUSIC_PLAY)
        jmp $ea31

timer_count !byte 0

        !zone timer_stop
timer_stop
        sei
        lda #<$4025             ; KERNAL value: 60 Hz on PAL ($4025)
        sta $dc04
        lda #>$4025
        sta $dc05
        lda #%00010001
        sta $dc0e
        lda #$31
        sta $0314
        lda #$ea
        sta $0315
        cli
        rts
