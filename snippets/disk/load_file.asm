;==============================================================================
;  SNIPPET: Load a file from disk (KERNAL LOAD)
;  Category: Disk                        Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  Loads a file from drive 8 - like  LOAD "NAME",8,1  in BASIC.
;
;    SETNAM ($ffbd)  A = name length, X/Y = address of the name
;    SETLFS ($ffba)  A = file number, X = device (8), Y = secondary address
;                    Y = 1: load to the address stored in the file
;                    Y = 0: load to the address in X/Y of LOAD
;    LOAD   ($ffd5)  A = 0 (load, 1 = verify); carry set = error, A = code
;
;  Error codes: 4 file not found, 5 device not present, 8 missing file name
;  After loading, X/Y = end address + 1.
;
;  Needs the KERNAL (ROMs on) and normal interrupts (no raster IRQ that
;  takes too long). With VICE: "autostart" puts your program on a virtual
;  disk - copy other files to that disk with the VICE disk tools.
;==============================================================================

SETNAM      = $ffbd
SETLFS      = $ffba
LOAD        = $ffd5

        !zone load_file
load_file
        lda #.name_end - .name  ; length of the file name
        ldx #<.name
        ldy #>.name
        jsr SETNAM
        lda #1                  ; file number
        ldx $ba                 ; last used device (8 if not set: see below)
        bne +
        ldx #8
+       ldy #1                  ; 1 = use the load address of the file
        jsr SETLFS
        lda #0                  ; 0 = load
        jsr LOAD
        bcs .error
        rts                     ; ok: X/Y = end address
.error  sta load_error          ; A = error code
        lda #2
        sta $d020               ; red border = error
        rts

.name       !pet "picture"      ; the file name in PETSCII
.name_end
load_error  !byte 0
