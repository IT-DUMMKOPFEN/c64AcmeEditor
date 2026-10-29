;==============================================================================
;  SNIPPET: Check a key directly in the keyboard matrix (no KERNAL)
;  Category: Input                       Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The 64 keys are wired as an 8 x 8 matrix on CIA 1:
;      write a column mask to $dc00 (0 bit = this column is selected)
;      read the rows from $dc01   (0 bit = key pressed)
;  This works with the KERNAL switched off, finds several keys at the
;  same time (for games: fire + direction on the keyboard) and is fast.
;
;  check_key   X = column bit mask, A = row bit mask (both from the table)
;              returns Z = 0 / A <> 0 if the key IS pressed
;
;  Some keys (column mask / row mask):
;      SPACE   $7f / $10       RETURN  $fe / $02       Q      $7f / $40
;      A       $fd / $04       Z       $fd / $10       P      $df / $02
;      W       $fd / $02       S       $fd / $20       1      $7f / $01
;      F1      $fe / $10       F7      $fe / $08       RUN/STOP $7f / $80
;  (full table: help page "CIA registers and keyboard")
;
;  Note: joystick port 1 uses the same lines - a moved joystick in port 1
;  looks like pressed keys.
;==============================================================================

        !zone check_key
check_key                       ; X = column mask, A = row mask
        stx $dc00               ; select the column
        sta .mask + 1
        lda $dc01               ; read the rows (0 = pressed)
        eor #$ff                ; now 1 = pressed
.mask   and #0                  ; only our key
        ldx #$ff
        stx $dc00               ; deselect (lets the joystick port 2 work)
        cmp #0                  ; set Z flag from A
        rts

        ; ---- example: is SPACE pressed? ----------------------------------------
space_pressed
        ldx #$7f                ; column 7
        lda #$10                ; row 4
        jmp check_key           ; Z = 0 when pressed
