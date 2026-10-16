;==============================================================================
;  DEMO TUNE - a tiny 3-voice SID music player + song, saved as a PSID file
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  Assemble this file to create "demo_tune.sid". The SID player example
;  (09_sid_player.asm) includes that file, and you can try the SID relocator
;  (Tools > Relocate SID) on it.
;
;  What you can learn here:
;    * how a PSID file header looks (124 bytes, big-endian values!)
;    * how "init" and "play" routines of a music player work
;    * how to drive the three SID voices (frequency, waveform, ADSR)
;    * generating a note frequency table at assembly time with ACME maths
;
;  Memory: the music is loaded to $1000. init = $1000, play = $1003
;  (the usual convention). Call "play" once per frame (50 times per second).
;
;  The tune: A minor, Am - F - C - G, 128 steps, bass + lead + drums.
;==============================================================================

        !to "demo_tune.sid", plain      ; "plain" = no C64 load address in front,
                                        ; the PSID header is written as-is

LOAD    = $1000                         ; where the music lives in C64 memory
SPEED   = 6                             ; frames per step (6 -> ~125 BPM)

;------------------------------------------------------------------------------
; PSID header (version 2). All 16/32 bit values are BIG endian here!
;------------------------------------------------------------------------------
        * = 0                           ; the header starts at file offset 0
        !text "PSID"                    ; magic id
        !be16 2                         ; version
        !be16 $7c                       ; offset of the C64 data (header size)
        !be16 0                         ; load address 0 = "read it from the
                                        ; first two bytes of the data"
        !be16 LOAD                      ; init address
        !be16 LOAD + 3                  ; play address
        !be16 1                         ; number of songs
        !be16 1                         ; default song
        !be32 0                         ; speed: 0 = use the VBI (50 Hz)
hdr_name
        !text "C64 ACME Editor Demo Tune"
        !fill 32 - (* - hdr_name), 0    ; pad every text field to 32 bytes
hdr_author
        !text "IT-Dummkoepfe"
        !fill 32 - (* - hdr_author), 0
hdr_released
        !text "2026 IT-Dummkoepfe"
        !fill 32 - (* - hdr_released), 0
        !be16 %00110100                 ; flags: PAL, works on 6581 and 8580
        !byte 0                         ; start page for relocation (0 = unknown)
        !byte 0                         ; page length
        !be16 0                         ; reserved
        !if * != $7c { !error "PSID header must be exactly $7c bytes" }

        !word LOAD                      ; C64 load address (little endian)

;------------------------------------------------------------------------------
; The player. "!pseudopc" assembles the code for address LOAD although it is
; stored right behind the header inside the file.
;------------------------------------------------------------------------------
        !pseudopc LOAD {

SID     = $d400                         ; SID base address
V1      = SID + 0                       ; voice 1 registers (bass)
V2      = SID + 7                       ; voice 2 registers (lead)
V3      = SID + 14                      ; voice 3 registers (drums)
;  +0 freq lo  +1 freq hi  +2 pulse lo  +3 pulse hi  +4 control
;  +5 attack/decay         +6 sustain/release

entry_init
        jmp init                        ; $1000: init routine
entry_play
        jmp play                        ; $1003: play routine (once per frame)

;------------------------------------------------------------------------------
; init: silence the SID and reset the song position
;------------------------------------------------------------------------------
        !zone init
init
        ldx #$18
        lda #0
-       sta SID,x                       ; clear all 25 SID registers
        dex
        bpl -
        lda #$0f
        sta SID + $18                   ; volume 15, no filter

        lda #$08 : sta V1 + 5           ; bass:  attack 0, decay 8
        lda #$40 : sta V1 + 6           ;        sustain 4, release 0
        lda #$19 : sta V2 + 5           ; lead:  attack 1, decay 9
        lda #$a6 : sta V2 + 6           ;        sustain 10, release 6
        lda #$07 : sta V3 + 5           ; drums: attack 0, decay 7
        lda #$00 : sta V3 + 6           ;        sustain 0, release 0
        lda #$08 : sta V3 + 3           ; drum pulse width $0800 (square)

        lda #0
        sta step
        sta pw_lo
        lda #$04
        sta pw_hi
        lda #1
        sta pw_dir
        sta tick                        ; first step after one frame
        lda #$ff
        sta drum_frame                  ; no drum playing
        rts

;------------------------------------------------------------------------------
; play: called once per frame
;------------------------------------------------------------------------------
        !zone play
play
        jsr pwm                         ; pulse width sweep for the lead
        jsr drum_tick                   ; run the current drum sound

        dec tick
        bmi .new_step                   ; tick < 0 -> play the next step
        bne .done                       ; tick > 0 -> nothing to do
        jsr gate_off_next               ; tick = 0 -> release voices that get
                                        ; a new note next frame ("hard restart")
.done   rts

.new_step
        lda #SPEED - 1
        sta tick

        ldy step
        ; ---- voice 1: bass ------------------------------------------------
        lda bass,y
        beq +                           ; 0 = keep playing the old note
        tax
        lda freq_lo - 1,x               ; note values start at 1
        sta V1 + 0
        lda freq_hi - 1,x
        sta V1 + 1
        lda #$21                        ; sawtooth + gate on
        sta V1 + 4
+
        ; ---- voice 2: lead ------------------------------------------------
        lda lead,y
        beq ++
        cmp #$ff                        ; $ff = rest (gate off)
        bne +
        lda #$40
        sta V2 + 4
        jmp ++
+       tax
        lda freq_lo - 1,x
        sta V2 + 0
        lda freq_hi - 1,x
        sta V2 + 1
        lda #$41                        ; pulse + gate on
        sta V2 + 4
++
        ; ---- voice 3: drums -----------------------------------------------
        lda drums,y
        beq +
        tax
        lda drum_start - 1,x            ; 1 = kick, 2 = snare, 3 = hihat
        sta drum_frame
+
        iny
        tya
        and #STEPS - 1                  ; loop the song
        sta step
        rts

;------------------------------------------------------------------------------
; gate_off_next: release bass/lead if the next step starts a new note.
; The SID needs at least one frame with gate off to restart the envelope.
;------------------------------------------------------------------------------
        !zone gate_off_next
gate_off_next
        ldy step
        lda bass,y
        beq +
        lda #$20                        ; sawtooth, gate off
        sta V1 + 4
+       lda lead,y
        beq +
        lda #$40                        ; pulse, gate off
        sta V2 + 4
+       rts

;------------------------------------------------------------------------------
; pwm: sweep the lead's pulse width between $0400 and $0c00
;------------------------------------------------------------------------------
        !zone pwm
pwm
        lda pw_dir
        beq .down
        lda pw_lo
        clc
        adc #$20
        sta pw_lo
        lda pw_hi
        adc #0
        sta pw_hi
        cmp #$0c
        bcc .set
        lda #0
        sta pw_dir
        beq .set                        ; (always)
.down   lda pw_lo
        sec
        sbc #$20
        sta pw_lo
        lda pw_hi
        sbc #0
        sta pw_hi
        cmp #$04
        bcs .set
        lda #1
        sta pw_dir
.set    lda pw_lo
        sta V2 + 2
        lda pw_hi
        sta V2 + 3
        rts

;------------------------------------------------------------------------------
; drum_tick: every drum is a tiny "program" of 5 frames (waveform + pitch)
;------------------------------------------------------------------------------
        !zone drum_tick
drum_tick
        ldx drum_frame
        bmi .off                        ; $ff = idle
        lda drum_wave,x
        beq .stop                       ; 0 = end of drum program
        sta V3 + 4
        lda drum_freq,x
        sta V3 + 1
        lda #0
        sta V3 + 0
        inc drum_frame
.off    rts
.stop   lda #$ff
        sta drum_frame
        rts

drum_start
        !byte 0, 6, 12                  ; offsets of kick, snare, hihat
;               kick ------------------  snare -----------------  hihat ----------------
drum_wave
        !byte $11,$11,$11,$11,$10,0,     $81,$41,$81,$81,$80,0,    $81,$80,$80,$80,$80,0
drum_freq
        !byte $18,$10,$0b,$07,$05,0,     $30,$0c,$28,$20,$18,0,    $70,$70,$70,$70,$70,0

;------------------------------------------------------------------------------
; variables
;------------------------------------------------------------------------------
step        !byte 0
tick        !byte 0
pw_lo       !byte 0
pw_hi       !byte 0
pw_dir      !byte 0
drum_frame  !byte $ff

;------------------------------------------------------------------------------
; Frequency table (PAL), calculated by ACME while assembling:
;   f(n) = 16.3516 Hz * 2^(n/12)       n = 0 is C-0, n = 57 is A-4 (440 Hz)
;   register = f * 2^24 / 985248      (985248 Hz = PAL CPU clock)
;------------------------------------------------------------------------------
freq_lo
        !for n, 0, 95 {
            !set r = int(16.351597831 * 2.0 ^ (float(n) / 12) * 16777216.0 / 985248.0 + 0.5)
            !if r > $ffff { !set r = $ffff }
            !byte <r
        }
freq_hi
        !for n, 0, 95 {
            !set r = int(16.351597831 * 2.0 ^ (float(n) / 12) * 16777216.0 / 985248.0 + 0.5)
            !if r > $ffff { !set r = $ffff }
            !byte >r
        }

;------------------------------------------------------------------------------
; Song data. One byte per step: 0 = nothing new, $ff = rest, otherwise
; note number + 1  (note = octave * 12 + semitone, C=0 ... B=11)
;------------------------------------------------------------------------------
STEPS = 128

; note names as symbols - this makes the song readable
C2 = 2*12+0+1 : D2 = 2*12+2+1 : E2 = 2*12+4+1 : F2 = 2*12+5+1 : G2 = 2*12+7+1 : A2 = 2*12+9+1 : B2 = 2*12+11+1
C3 = 3*12+0+1 : D3 = 3*12+2+1 : E3 = 3*12+4+1 : F3 = 3*12+5+1 : G3 = 3*12+7+1 : A3 = 3*12+9+1 : B3 = 3*12+11+1
C4 = 4*12+0+1 : D4 = 4*12+2+1 : E4 = 4*12+4+1 : F4 = 4*12+5+1 : G4 = 4*12+7+1 : A4 = 4*12+9+1 : B4 = 4*12+11+1
C5 = 5*12+0+1 : D5 = 5*12+2+1 : E5 = 5*12+4+1 : F5 = 5*12+5+1 : G5 = 5*12+7+1 : A5 = 5*12+9+1
___ = 0                                 ; "hold"
RST = $ff                               ; rest

; bass: octave jumps in 8th notes, played twice (2 x 64 steps)
bass
        !for rep, 1, 2 {
        !byte A2,___,A3,___, A2,___,A3,___, A2,___,A3,___, A2,___,G3,___   ; Am
        !byte F2,___,F3,___, F2,___,F3,___, F2,___,F3,___, F2,___,A3,___   ; F
        !byte C3,___,C4,___, C3,___,C4,___, C3,___,C4,___, C3,___,E3,___   ; C
        !byte G2,___,G3,___, G2,___,G3,___, G2,___,G3,___, G2,___,B2,___   ; G
        }

lead
        !byte E4,___,___,A4, ___,___,C5,___, B4,___,A4,___, E4,___,___,___ ; Am
        !byte F4,___,___,A4, ___,___,C5,___, D5,___,C5,___, A4,___,___,___ ; F
        !byte E5,___,___,D5, ___,___,C5,___, G4,___,___,___, E4,___,___,___; C
        !byte D5,___,___,B4, ___,___,G4,___, A4,___,B4,___, D5,___,RST,___ ; G
        !byte A4,___,C5,___, E5,___,D5,C5,   B4,___,A4,___, C5,___,___,___ ; Am
        !byte A4,___,C5,___, F5,___,E5,D5,   C5,___,A4,___, F4,___,___,___ ; F
        !byte G4,___,C5,___, E5,___,G5,___,  E5,___,D5,___, C5,___,___,___ ; C
        !byte B4,___,D5,___, G5,___,F5,___,  D5,___,B4,___, A4,___,RST,___ ; G

; drums: 1 = kick, 2 = snare, 3 = hihat (16 step groove, 8 times)
drums
        !for rep, 1, 8 {
        !byte 1,0,3,0, 2,0,3,0, 1,0,1,0, 2,0,3,3
        }

        !if * - bass != 3 * STEPS { !error "song data must be STEPS bytes per voice" }
        }  ; end of !pseudopc
