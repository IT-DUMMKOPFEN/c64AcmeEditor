;==============================================================================
;  SNIPPET: Read and print the disk directory
;  Category: Disk                        Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  The directory is a file called "$". Opened like a BASIC program, it
;  contains one "line" per file: link (2 bytes), number of blocks
;  (2 bytes), the text with the name, and a 0 byte at the end.
;  This routine reads it byte by byte (OPEN / CHKIN / CHRIN) and prints
;  it with CHROUT - like LOAD "$",8 and LIST, without destroying your
;  program in memory.
;
;  Uses file number 2 and drive 8. Needs the KERNAL.
;==============================================================================

SETNAM      = $ffbd
SETLFS      = $ffba
OPEN        = $ffc0
CLOSE       = $ffc3
CHKIN       = $ffc6
CLRCHN      = $ffcc
CHRIN       = $ffcf
CHROUT      = $ffd2
READST      = $ffb7

        !zone directory
directory
        lda #1
        ldx #<.dollar
        ldy #>.dollar
        jsr SETNAM
        lda #2                  ; file 2
        ldx #8                  ; drive 8
        ldy #0                  ; secondary address 0 = read as "program"
        jsr SETLFS
        jsr OPEN
        bcs .close
        ldx #2
        jsr CHKIN               ; input from file 2
        jsr .get                ; skip the load address
        jsr .get
.line   jsr .get                ; link to the next line (2 bytes)
        jsr .get
        jsr READST              ; end of file?
        bne .close
        jsr .get                ; blocks: low byte
        sta .blocks
        jsr .get                ; high byte
        ldx .blocks
        jsr $bdcd               ; BASIC ROM: print the number X/A
        lda #' '
        jsr CHROUT
.text   jsr .get                ; the rest of the line up to the 0 byte
        beq .eol
        jsr CHROUT
        jmp .text
.eol    lda #13                 ; RETURN
        jsr CHROUT
        jsr READST
        beq .line
.close  jsr CLRCHN
        lda #2
        jmp CLOSE

.get    jsr CHRIN
        pha
        jsr READST
        bne +                   ; error/end: return 0
        pla
        rts
+       pla
        lda #0
        rts

.dollar !pet "$"
.blocks !byte 0
