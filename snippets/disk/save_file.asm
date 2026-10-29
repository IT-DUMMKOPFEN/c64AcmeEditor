;==============================================================================
;  SNIPPET: Save memory to disk (KERNAL SAVE)
;  Category: Disk                        Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Saves a memory range as a PRG file - like a high score table or a level.
;  The first two bytes of the file are the start address, so it can be
;  loaded back with  LOAD "NAME",8,1  or the "Load a file" snippet.
;
;    SETNAM ($ffbd)  name; "@0:name" overwrites an existing file
;    SETLFS ($ffba)  A = file number, X = device, Y = 0
;    SAVE   ($ffd8)  A = zero page address of a pointer to the start,
;                    X/Y = end address + 1; carry set = error
;==============================================================================

SETNAM      = $ffbd
SETLFS      = $ffba
SAVE        = $ffd8
SAVE_START  = $c000
SAVE_END    = $c100             ; first byte NOT saved
sv_ptr      = $fb

        !zone save_file
save_file
        lda #.name_end - .name
        ldx #<.name
        ldy #>.name
        jsr SETNAM
        lda #1
        ldx #8                  ; drive 8
        ldy #0
        jsr SETLFS
        lda #<SAVE_START        ; start address into a zero page pointer
        sta sv_ptr
        lda #>SAVE_START
        sta sv_ptr + 1
        lda #sv_ptr             ; A = the zero page ADDRESS of the pointer
        ldx #<SAVE_END
        ldy #>SAVE_END
        jsr SAVE
        bcc +
        lda #2                  ; error: red border
        sta $d020
+       rts

.name   !pet "@0:highscore"     ; "@0:" = replace if it exists
.name_end
