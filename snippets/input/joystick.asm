;==============================================================================
;  SNIPPET: Read the joystick (port 2 and port 1)
;  Category: Input                       Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The joystick ports are read from CIA 1:
;      port 2 = $dc00,  port 1 = $dc01
;      bit 0 = up, 1 = down, 2 = left, 3 = right, 4 = fire
;  A bit is 0 when the direction / button is PRESSED (inverted logic).
;
;  read_joy2 returns easy-to-use values:
;      joy_dx     = $ff (left), 0, 1 (right)      - add it to your X position
;      joy_dy     = $ff (up),   0, 1 (down)
;      joy_fire   = 1 while the button is held
;      joy_press  = 1 only in the call where the button was NEWLY pressed
;                   (for shooting: one shot per press, not 50 per second)
;
;  Port 1 shares its lines with the keyboard: pressing keys can look like
;  joystick movement and the joystick in port 1 types characters. That is
;  why most games use port 2. read_joy1 is the same for port 1.
;
;  How to use:  jsr read_joy2      then check joy_dx, joy_dy, joy_press
;  Changes:     A, X
;==============================================================================

        !zone read_joy
read_joy2
        lda $dc00               ; port 2
        jmp .decode
read_joy1
        lda $dc01               ; port 1
.decode
        sta joy_raw
        lda #0
        sta joy_dx
        sta joy_dy
        lda joy_raw
        lsr                     ; bit 0: up
        bcs +
        dec joy_dy              ; -> $ff
+       lsr                     ; bit 1: down
        bcs +
        inc joy_dy
+       lsr                     ; bit 2: left
        bcs +
        dec joy_dx
+       lsr                     ; bit 3: right
        bcs +
        inc joy_dx
+       lsr                     ; bit 4: fire -> carry (0 = pressed)
        lda #0
        bcs +
        lda #1
+       sta joy_fire
        ; new press = pressed now AND not pressed in the last call
        tax                     ; X = fire now (1 = pressed)
        and joy_last            ; joy_last = 1 means: was NOT pressed
        sta joy_press
        txa
        eor #1                  ; remember for the next call: 1 = not pressed
        sta joy_last
        rts

joy_raw     !byte 0
joy_dx      !byte 0             ; $ff, 0 or 1
joy_dy      !byte 0
joy_fire    !byte 0             ; 1 = button held
joy_press   !byte 0             ; 1 = button newly pressed
joy_last    !byte 1             ; internal: 1 = not pressed last time
