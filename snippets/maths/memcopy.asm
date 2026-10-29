;==============================================================================
;  SNIPPET: Copy and fill memory (any size)
;  Category: Maths & Tools               Type: routine (insert into your code)
;------------------------------------------------------------------------------
;  memcopy  copies mc_len bytes from (mc_src) to (mc_dst)
;  memfill  fills mc_len bytes at (mc_dst) with A
;
;  Both work with whole pages (256 bytes) first and then the rest - the
;  usual way to handle more than 256 bytes with 8-bit index registers.
;  memcopy copies upwards: source and destination must not overlap with
;  destination > source (then copy backwards).
;
;  Macro for constant addresses:  +memcopy $c000, $0400, 1000
;  Zero page: $fb-$fe         Changes: A, X, Y
;==============================================================================

mc_src      = $fb
mc_dst      = $fd

!macro memcopy .from, .to, .len {
        lda #<.from
        sta mc_src
        lda #>.from
        sta mc_src + 1
        lda #<.to
        sta mc_dst
        lda #>.to
        sta mc_dst + 1
        lda #<.len
        sta mc_len
        lda #>.len
        sta mc_len + 1
        jsr memcopy
}

        !zone memcopy
memcopy
        ldy #0
        ldx mc_len + 1          ; number of whole pages
        beq .rest
.page   lda (mc_src),y
        sta (mc_dst),y
        iny
        bne .page
        inc mc_src + 1          ; next page
        inc mc_dst + 1
        dex
        bne .page
.rest   ldx mc_len              ; remaining bytes
        beq .done
-       lda (mc_src),y
        sta (mc_dst),y
        iny
        dex
        bne -
.done   rts

        !zone memfill
memfill                         ; A = value
        ldy #0
        ldx mc_len + 1
        beq .rest
.page   sta (mc_dst),y
        iny
        bne .page
        inc mc_dst + 1
        dex
        bne .page
.rest   ldx mc_len
        beq .done
-       sta (mc_dst),y
        iny
        dex
        bne -
.done   rts

mc_len  !word 0
