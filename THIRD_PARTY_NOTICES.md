# Third party components

The C64 ACME EDITOR (MIT license) is distributed together with the following
programs and components. They are separate programs with their own licenses;
the editor starts them as external processes.

| Component | Author | License | Source |
|---|---|---|---|
| ACME crossassembler | Marco Baye | GNU GPL v2 or later | https://sourceforge.net/projects/acme-crossass/ |
| Exomizer | Magnus Lind | zlib-style license (see its readme) | https://bitbucket.org/magli143/exomizer/wiki/Home |
| sidreloc | Linus Åkesson | MIT | https://www.linusakesson.net/software/sidreloc/index.php |
| Ace editor | Ajax.org B.V. | BSD 3-Clause | https://github.com/ajaxorg/ace-builds |
| JetBrains Mono | JetBrains | SIL Open Font License 1.1 | https://github.com/JetBrains/JetBrainsMono |
| Electron | OpenJS Foundation and contributors | MIT | https://www.electronjs.org/ |

The source code of the GPL programs is available at the addresses above. The
build scripts in `scripts/` show exactly which versions are downloaded and how
they are built.

The example music (`examples/music/demo_tune.sid`) and the example picture
(`examples/gfx/picture.kla`) were made for this project (see
`scripts/music/demo_tune_src.asm` and `scripts/make_koala.py`) and are MIT
licensed like the editor.
The sample pictures in `snippets/data/` are converted from that picture
(`scripts/make_snippet_data.py`) and are MIT licensed as well.
