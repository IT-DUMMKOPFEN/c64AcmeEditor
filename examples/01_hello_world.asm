;==============================================================================
;  01 - HELLO WORLD
;------------------------------------------------------------------------------
;  C64 ACME EDITOR example  -  (c) 2026 IT-Dummköpfe  -  MIT License
;
;  The classic first program: clear the screen, set some colours and print a
;  few lines of text with the KERNAL routine CHROUT ($FFD2), then return to
;  BASIC.
;
;  What you can learn here:
;    * the BASIC start line ("10 SYS 2061") that makes a program start with RUN
;    * constants (symbols) for addresses
;    * a loop with the X register, zero-terminated strings
;    * calling KERNAL routines with JSR
;    * PETSCII control codes (clear screen, colours, return)
;
;  How to run it: press F5 (Build & Run in VICE). The program prints the text
;  and returns to the READY prompt.
;==============================================================================

        !to "01_hello_world.prg", cbm   ; output file and format (cbm = .prg)

;------------------------------------------------------------------------------
; Constants - giving addresses a name makes code much easier to read
;------------------------------------------------------------------------------
CHROUT  = $ffd2                 ; KERNAL: print the character in A
BORDER  = $d020                 ; VIC-II: border colour
BGCOLOR = $d021                 ; VIC-II: background colour

; PETSCII control codes (characters with a special meaning for CHROUT)
CLS     = 147                   ; clear screen + cursor home
RETURN  = 13                    ; new line
WHITE   = 5                     ; switch text colour to white
YELLOW  = 158                   ; ... to yellow
LBLUE   = 154                   ; ... to light blue

;------------------------------------------------------------------------------
; BASIC start line:  10 SYS 2061
; A .prg file is loaded to $0801, the start of BASIC memory. These bytes form
; a tiny BASIC program that jumps to our machine code with SYS.
;------------------------------------------------------------------------------
        * = $0801
        !word basic_end         ; pointer to the next BASIC line
        !word 10                ; line number 10
        !byte $9e               ; BASIC token for "SYS"
        !text "2061"            ; the address as text: 2061 = $080d
        !byte 0                 ; end of this BASIC line
basic_end
        !word 0                 ; $0000 = end of the BASIC program

;------------------------------------------------------------------------------
; Our program starts directly behind the BASIC line, at $080d = 2061.
;------------------------------------------------------------------------------
        !zone main
start
        !if start != 2061 { !error "the SYS address in the BASIC line is wrong" }

        lda #6                  ; colour 6 = blue
        sta BORDER
        lda #0                  ; colour 0 = black
        sta BGCOLOR

        ldx #0                  ; X = index into the text
.loop   lda message,x           ; get the next character
        beq .done               ; 0 = end of text -> finished
        jsr CHROUT              ; print it (CHROUT keeps X and Y intact)
        inx                     ; next character
        bne .loop               ; (texts up to 255 characters)
.done
        rts                     ; back to BASIC ("READY.")

;------------------------------------------------------------------------------
; The text. "!pet" converts it to PETSCII, the character set used by CHROUT.
; Lower case letters in the source appear as UPPER case on the C64 screen.
;------------------------------------------------------------------------------
message
        !byte CLS, WHITE
        !pet "hello world!", RETURN, RETURN
        !byte YELLOW
        !pet "greetings from the", RETURN
        !pet "c64 acme editor.", RETURN, RETURN
        !byte LBLUE
        !pet "now edit this text, press f5", RETURN
        !pet "and see what happens...", RETURN
        !byte 0                 ; end marker
