;==============================================================================
;  SNIPPET: Sound effects: shot, explosion, beep
;  Category: Sound                       Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Simple effects on SID voice 1 (voice 3 for the explosion, so a shot
;  does not cut it off). Each effect:
;    1. sets frequency, envelope (ADSR) and waveform
;    2. switches the gate bit off and on: the envelope starts again
;  Attack 0 + decay + sustain 0 = the sound fades out by itself; nothing
;  has to be switched off later.
;
;  sfx_init        volume on (call once)
;  sfx_shot        short noise "peng"
;  sfx_explosion   long low noise
;  sfx_beep        short triangle tone (menus, pick-ups)
;
;  SID voice registers (voice 1 at $d400, voice 2 $d407, voice 3 $d40e):
;    +0/+1 frequency   +2/+3 pulse width   +4 control (waveform + gate)
;    +5 attack/decay   +6 sustain/release
;  Waveforms: $11 triangle, $21 sawtooth, $41 pulse, $81 noise (+1 = gate)
;
;  Changes: A
;==============================================================================

        !zone sfx
sfx_init
        lda #15                 ; volume 15
        sta $d418
        rts

sfx_shot
        lda #0
        sta $d404               ; gate off (restart)
        lda #$00
        sta $d400
        lda #$28                ; high noise
        sta $d401
        lda #$08                ; attack 0, decay 8 (~300 ms)
        sta $d405
        lda #$00                ; sustain 0, release 0
        sta $d406
        lda #$81                ; noise + gate on
        sta $d404
        rts

sfx_explosion
        lda #0
        sta $d412
        lda #$00
        sta $d40e
        lda #$05                ; low noise: rumbling
        sta $d40f
        lda #$0b                ; attack 0, decay 11 (~1.5 s)
        sta $d413
        lda #$00
        sta $d414
        lda #$81
        sta $d412
        rts

sfx_beep
        lda #0
        sta $d404
        lda #<17030             ; 1 kHz: SID value = Hz * 17.03 (PAL)
        sta $d400
        lda #>17030
        sta $d401
        lda #$06                ; attack 0, decay 6
        sta $d405
        lda #$00
        sta $d406
        lda #$11                ; triangle + gate
        sta $d404
        rts
