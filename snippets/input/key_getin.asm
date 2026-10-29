;==============================================================================
;  SNIPPET: Read keys with the KERNAL (GETIN)
;  Category: Input                       Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The KERNAL interrupt scans the keyboard 60 times per second and puts the
;  keys into a buffer (10 keys). GETIN ($ffe4) takes the next key out of the
;  buffer: A = PETSCII code, or 0 if no key was pressed.
;
;  Needs the KERNAL interrupt (normal setup, or your raster IRQ ends with
;  JMP $EA31).
;
;  get_key       returns at once: A = key or 0
;  wait_key      waits until a key is pressed: A = key
;  clear_keys    empties the keyboard buffer (old key presses)
;
;  Useful PETSCII codes: 13 RETURN, 32 SPACE, 3 RUN/STOP, 20 DEL,
;  17/145 cursor down/up, 29/157 cursor right/left, 133-140 F1-F8
;  (F1 133, F3 134, F5 135, F7 136, F2 137, F4 138, F6 139, F8 140)
;==============================================================================

GETIN       = $ffe4

        !zone keys
get_key
        jmp GETIN               ; A = key or 0

wait_key
-       jsr GETIN
        beq -                   ; 0 = no key yet
        rts

clear_keys
        lda #0
        sta $c6                 ; number of keys in the buffer
        rts

        ; ---- example: react to some keys ----------------------------------------
key_example
        jsr wait_key
        cmp #133                ; F1?
        beq .f1
        cmp #' '
        beq .space
        rts
.f1     inc $d020               ; F1: next border colour
        rts
.space  inc $d021               ; SPACE: next background colour
        rts
