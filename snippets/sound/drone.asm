;==============================================================================
;  SNIPPET: Intro drone ("Brummen" instead of music)
;  Category: Sound                       Type: program (open as a new file)
;------------------------------------------------------------------------------
;  Many crack intros had no music, just a deep, wobbling hum: two low
;  sawtooth tones that are slightly out of tune (they "beat" against each
;  other) and the SID filter that slowly opens and closes - with high
;  resonance it sounds like a vacuum cleaner from outer space.
;
;  drone_init    sets the voices and the filter (call once)
;  drone_update  moves the filter cutoff and the pulse width along sine
;                tables (call once per frame, e.g. in the raster IRQ)
;
;  Things to play with:
;    NOTE_FREQ   base tone (55 Hz = A1). SID value = Hz * 17.03 (PAL)
;    DETUNE      difference of voice 2: small = slow beating
;    RESONANCE   0-15, high = whistling filter
;    SWEEP       speed of the filter movement
;    CUT_MIN/MAX range of the filter sweep (0-255)
;==============================================================================

NOTE_FREQ   = 937               ; 55 Hz
DETUNE      = 3                 ; voice 2 = NOTE_FREQ + DETUNE
FIFTH_FREQ  = 1404              ; voice 3: a fifth above (82.4 Hz), pulse
RESONANCE   = 13
SWEEP       = 1                 ; table steps per frame
CUT_MIN     = $08
CUT_MAX     = $60
PI          = 3.14159265

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
        ldx #0                  ; a short info text
-       lda info,x
        beq +
        sta $0400 + 12 * 40 + 5,x
        lda #15
        sta $d800 + 12 * 40 + 5,x
        inx
        bne -
+       jsr drone_init

        sei
        lda #$7f
        sta $dc0d
        lda $dc0d
        lda #<irq
        sta $0314
        lda #>irq
        sta $0315
        lda #$f8
        sta $d012
        lda $d011
        and #$7f
        sta $d011
        lda #1
        sta $d01a
        lda #$ff
        sta $d019
        cli

-       jsr $ffe4
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
        ldx #$18                ; SID silent
        lda #0
-       sta $d400,x
        dex
        bpl -
        cli
        lda #14
        sta $d020
        lda #6
        sta $d021
        jmp $e544

irq     lda #$ff
        sta $d019
        jsr drone_update
        jmp $ea31

;------------------------------------------------------------------------------
; drone_init: three voices, filter, volume
;------------------------------------------------------------------------------
        !zone drone
drone_init
        lda #<NOTE_FREQ         ; voice 1: sawtooth
        sta $d400
        lda #>NOTE_FREQ
        sta $d401
        lda #<(NOTE_FREQ + DETUNE)      ; voice 2: sawtooth, a bit higher
        sta $d407
        lda #>(NOTE_FREQ + DETUNE)
        sta $d408
        lda #<FIFTH_FREQ        ; voice 3: pulse, a fifth above
        sta $d40e
        lda #>FIFTH_FREQ
        sta $d40f
        lda #$00                ; envelopes: attack 0 ...
        sta $d405
        sta $d40c
        sta $d413
        lda #$f0                ; ... sustain 15 = full volume while gated
        sta $d406
        sta $d40d
        lda #$a0                ; voice 3 a bit quieter (sustain 10)
        sta $d414
        lda #$21                ; sawtooth + gate on
        sta $d404
        sta $d40b
        lda #$41                ; pulse + gate on
        sta $d412
        lda #RESONANCE << 4 | %0111     ; resonance + filter voices 1, 2, 3
        sta $d417
        lda #%00011111          ; low pass filter + volume 15
        sta $d418
        rts

drone_update
        lda .pos
        clc
        adc #SWEEP
        sta .pos
        tax
        lda cutoff_table,x      ; filter cutoff (upper 8 of 11 bits)
        sta $d416
        lda pulse_table,x       ; pulse width of voice 3 (high nibble)
        sta $d411
        rts
.pos    !byte 0

cutoff_table
        !for i, 0, 255 {
            !byte CUT_MIN + int((CUT_MAX - CUT_MIN) * (0.5 - 0.5 * cos(float(i) * 2 * PI / 256)))
        }
pulse_table
        !for i, 0, 255 {
            !byte 2 + int(5.5 + 5.5 * sin(float(i) * 4 * PI / 256))   ; $02-$0d
        }

info    !scr "the intro drone - space to exit", 0
