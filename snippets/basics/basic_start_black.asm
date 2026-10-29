;==============================================================================
;  SNIPPET: BASIC start line + black screen
;  Category: Basics                      Type: program (open as a new file)
;------------------------------------------------------------------------------
;  The usual start of every C64 program written in assembler:
;    * a BASIC line "10 SYS 2061", so the program starts with RUN
;    * border and background black, screen cleared, text colour set
;    * a main loop that waits for SPACE and then returns to BASIC
;
;  How the BASIC line works:
;    $0801 is where BASIC programs start. The bytes below are exactly what
;    BASIC would store for the line  10 SYS 2061 :
;      pointer to the next line, line number 10, token $9e (SYS), the text
;      "2061" and a 0 byte as end of line. Two 0 bytes end the program.
;    2061 = $080d is the address right after these bytes - our code.
;
;  Change BORDER, BACKGROUND and TEXTCOLOR below to your colours (0-15).
;==============================================================================

BORDER      = 0                 ; black
BACKGROUND  = 0                 ; black
TEXTCOLOR   = 1                 ; white

;------------------------------------------------------------------------------
; BASIC line: 10 SYS 2061
;------------------------------------------------------------------------------
        * = $0801
        !word +                 ; pointer to the next BASIC line
        !word 10                ; line number
        !byte $9e               ; BASIC token for SYS
        !text "2061"            ; the address as text (= $080d)
        !byte 0                 ; end of the line
+       !word 0                 ; end of the BASIC program

;------------------------------------------------------------------------------
; the program starts here ($080d)
;------------------------------------------------------------------------------
start
        lda #BORDER
        sta $d020               ; border colour
        lda #BACKGROUND
        sta $d021               ; background colour
        lda #TEXTCOLOR
        sta $0286               ; current text colour of the KERNAL
        jsr $e544               ; clear the screen (KERNAL)

        ; ---- your code here ------------------------------------------------------

main_loop
        jsr $ffe4               ; GETIN: A = key code, 0 = no key
        cmp #' '
        bne main_loop           ; wait for SPACE

        lda #14                 ; restore the usual colours
        sta $d020
        lda #6
        sta $d021
        lda #14
        sta $0286
        jmp $e544               ; clear the screen and return to BASIC
