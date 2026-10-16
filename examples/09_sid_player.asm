;==============================================================================
;  09 - SID PLAYER (1x / 2x / 3x speed)
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  Plays a SID tune and shows its name, author and release info on the
;  screen. The play routine can be called 1, 2 or 3 times per frame -
;  press 1, 2 or 3 to switch. SPACE restarts the tune.
;
;  Many SID tunes are "multispeed" tunes that MUST be called 2x, 3x ... per
;  frame. A normal (1x) tune simply plays faster when you call it more often.
;
;  What you can learn here:
;    * including a .sid file with !binary and skipping its header
;    * the PSID header layout (name/author/released at $16/$36/$56)
;    * several raster interrupts per frame (a chain of IRQs)
;    * a "raster time meter": the border colour shows how much CPU time the
;      play routine needs
;    * converting ASCII text to C64 screen codes at runtime
;
;  Using your own tune: replace the file name below (3x) and check
;  MUSIC_LOAD / MUSIC_INIT / MUSIC_PLAY. The editor's memory map shows where
;  the SID ends up. If it collides with your code, move it with
;  Tools > Relocate SID (sidreloc).
;==============================================================================

        !to "09_sid_player.prg", cbm

MUSIC_LOAD  = $1000             ; load address of the tune (from its header)
MUSIC_INIT  = $1000             ; init routine (A = song number - 1)
MUSIC_PLAY  = $1003             ; play routine
SID_HEADER  = $7e               ; PSID header ($7c) + 2-byte load address

SCREEN      = $0400
COLORRAM    = $d800
IRQ_VECTOR  = $0314
GETIN       = $ffe4

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
        jsr setup_screen
        lda #1
        sta speed
        jsr init_music

        ; ---- install the interrupt ------------------------------------------
        sei
        lda #%01111111
        sta $dc0d               ; CIA 1 timer interrupt off
        lda $dc0d
        lda #<irq
        sta IRQ_VECTOR
        lda #>irq
        sta IRQ_VECTOR + 1
        lda #0
        sta irq_count
        jsr set_first_line
        lda $d011
        and #%01111111          ; bit 8 of the raster line = 0
        sta $d011
        lda #%00000001
        sta $d01a               ; raster interrupt on
        lda #$ff
        sta $d019
        cli

        ; ---- main loop: keyboard ---------------------------------------------
.loop   jsr GETIN
        beq .loop               ; no key
        cmp #'1'
        bcc .other
        cmp #'4'
        bcs .other
        sec
        sbc #'0'                ; "1".."3" -> 1..3
        sei                     ; change the IRQ chain safely
        sta speed
        lda #0
        sta irq_count
        jsr set_first_line
        cli
        jsr show_speed
        jmp .loop
.other  cmp #' '
        bne .loop
        sei
        jsr init_music          ; SPACE: restart the song
        cli
        jmp .loop

;------------------------------------------------------------------------------
; init_music: silence + start song 1
;------------------------------------------------------------------------------
init_music
        lda #0                  ; song number - 1
        jsr MUSIC_INIT
        rts

;------------------------------------------------------------------------------
; set_first_line: first IRQ line for the current speed
;------------------------------------------------------------------------------
set_first_line
        ldx speed
        lda line_offset - 1,x   ; where the lines of this speed start
        tax
        lda irq_lines,x
        sta $d012
        rts

;------------------------------------------------------------------------------
; The interrupt: play the music, then set the next raster line
;------------------------------------------------------------------------------
        !zone irq
irq
        lda #$ff
        sta $d019               ; acknowledge

        inc $d020               ; raster time meter: border colour on ...
        jsr MUSIC_PLAY
        dec $d020               ; ... and off again

        inc irq_count           ; next call of this frame
        lda irq_count
        cmp speed
        bcc +
        lda #0                  ; all calls of this frame done
        sta irq_count
+       ldx speed
        clc
        adc line_offset - 1,x
        tax
        lda irq_lines,x
        sta $d012

        lda irq_count
        bne +
        jmp $ea31               ; once per frame: KERNAL (keyboard, cursor)
+       jmp $ea81               ; otherwise just return from the interrupt

;------------------------------------------------------------------------------
; Raster lines for 1x, 2x and 3x - spread evenly over the 312 lines of a
; PAL frame (we stay below 256 to keep it simple)
;------------------------------------------------------------------------------
irq_lines
        !byte $80               ; 1x
        !byte $30, $c8          ; 2x  (156 lines apart)
        !byte $10, $78, $e0     ; 3x  (104 lines apart)
line_offset
        !byte 0, 1, 3           ; start of each group in irq_lines

speed       !byte 1
irq_count   !byte 0

;------------------------------------------------------------------------------
; setup_screen: title, SID info, help
;------------------------------------------------------------------------------
        !zone setup_screen
setup_screen
        lda #0
        sta $d020
        sta $d021
        jsr $e544               ; clear screen (also sets colour RAM)

        ldx #0
-       lda static_text,x       ; the static text block (5 rows of 40)
        sta SCREEN + 2 * 40,x
        lda static_text + 100,x
        sta SCREEN + 2 * 40 + 100,x
        inx
        cpx #100
        bne -

        ldx #0                  ; colours: title yellow, rest grey
-       lda #7
        sta COLORRAM + 2 * 40,x
        lda #15
        sta COLORRAM + 4 * 40,x
        sta COLORRAM + 5 * 40,x
        sta COLORRAM + 6 * 40,x
        sta COLORRAM + 18 * 40,x
        sta COLORRAM + 19 * 40,x
        sta COLORRAM + 20 * 40,x
        lda #1
        sta COLORRAM + 10 * 40,x
        sta COLORRAM + 12 * 40,x
        sta COLORRAM + 14 * 40,x
        inx
        cpx #40
        bne -

        ; ---- the three text fields of the PSID header --------------------------
        ldx #0
-       lda sid_name,x
        jsr ascii_to_screen
        sta SCREEN + 10 * 40 + 8,x
        lda sid_author,x
        jsr ascii_to_screen
        sta SCREEN + 12 * 40 + 8,x
        lda sid_released,x
        jsr ascii_to_screen
        sta SCREEN + 14 * 40 + 8,x
        inx
        cpx #32
        bne -

        ldx #0                  ; help text
-       lda help_text,x
        sta SCREEN + 18 * 40,x
        lda help_text + 40,x
        sta SCREEN + 19 * 40,x
        lda help_text + 80,x
        sta SCREEN + 20 * 40,x
        inx
        cpx #40
        bne -
        ; fall through
show_speed
        lda speed
        ora #$30                ; 1..3 -> screen code of "1".."3"
        sta SCREEN + 16 * 40 + 15
        lda #13
        sta COLORRAM + 16 * 40 + 15
        ldx #0
-       lda speed_text,x
        sta SCREEN + 16 * 40 + 1,x
        lda #15
        sta COLORRAM + 16 * 40 + 1,x
        inx
        cpx #14
        bne -
        rts

;------------------------------------------------------------------------------
; ascii_to_screen: convert one ASCII character (from the SID header) into a
; screen code.  'a'-'z' and 'A'-'Z' -> 1-26, '@' -> 0, 0 -> space
;------------------------------------------------------------------------------
ascii_to_screen
        cmp #0
        beq .space
        cmp #'a'
        bcc +
        cmp #'z' + 1
        bcs .space
        sec
        sbc #$60                ; 'a' ($61) -> 1
        rts
+       cmp #'@'
        bcc .keep               ; $20-$3f: same as screen codes
        cmp #'Z' + 1
        bcs .space
        sec
        sbc #$40                ; '@' -> 0, 'A' -> 1
        rts
.keep   cmp #$20
        bcc .space
        rts
.space  lda #' '
        rts

;------------------------------------------------------------------------------
; Texts (screen codes)
;------------------------------------------------------------------------------
static_text
        !scr "      *** c64 acme editor sid player ***"   ; row 2
        !scr "                                        "   ; row 3
        !scr "  a sid tune is a program: an init and a"   ; row 4
        !scr "  play routine. this player calls play  "   ; row 5
        !scr "  1, 2 or 3 times per frame via irq.    "   ; row 6
        !if * - static_text != 200 { !error "static_text must be 5 x 40 characters" }
help_text
        !scr "  keys: 1 / 2 / 3  = play speed         "
        !scr "        space      = restart tune       "
        !scr "  border colour    = cpu time of play   "
speed_text
        !scr "speed:        "

;------------------------------------------------------------------------------
; The header strings: !binary FILE, SIZE, SKIP  reads 32 bytes each
;------------------------------------------------------------------------------
sid_name     !bin "music/demo_tune.sid", 32, $16
sid_author   !bin "music/demo_tune.sid", 32, $36
sid_released !bin "music/demo_tune.sid", 32, $56

;------------------------------------------------------------------------------
; The music itself: skip the header + load address, put it at MUSIC_LOAD
;------------------------------------------------------------------------------
        * = MUSIC_LOAD
music
        !bin "music/demo_tune.sid",, SID_HEADER
