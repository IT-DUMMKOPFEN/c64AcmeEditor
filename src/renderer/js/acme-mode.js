/*
 * C64 ACME EDITOR - Ace language mode for ACME + day/night themes
 * (c) IT-Dummköpfe - MIT License
 */
/* global ace, C64Opcodes */
(function () {
  'use strict';
  const legal = C64Opcodes.mnemonicList().map(m => m.toLowerCase());
  const illegal = C64Opcodes.illegalList().map(m => m.toLowerCase());
  const pseudo = C64Opcodes.pseudoList().map(p => p.slice(1));

  ace.define('ace/mode/acme_highlight_rules', ['require', 'exports', 'module', 'ace/lib/oop', 'ace/mode/text_highlight_rules'], function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextHighlightRules = require('ace/mode/text_highlight_rules').TextHighlightRules;

    const AcmeHighlightRules = function () {
      const mnemonicRe = '\\b(?:' + legal.join('|') + ')(?:\\+[123])?\\b';
      const illegalRe = '\\b(?:' + illegal.join('|') + ')(?:\\+[123])?\\b';
      const pseudoRe = '!(?:' + pseudo.sort((a, b) => b.length - a.length).join('|') + ')\\b';
      this.$rules = {
        start: [
          { token: 'comment', regex: ';.*$' },
          { token: 'string', regex: '"(?:[^"\\\\]|\\\\.)*"?' },
          { token: 'string.char', regex: "'(?:[^'\\\\]|\\\\.)'?" },
          { token: 'entity.name.label.anon', regex: '^[+-]+(?=\\s|$|;)' },
          { token: 'support.function.pseudo', regex: pseudoRe, caseInsensitive: true },
          { token: 'invalid.pseudo', regex: '![A-Za-z0-9]+' },
          { token: 'entity.name.label', regex: '^(?!(?:' + legal.concat(illegal).join('|') + ')(?:\\+[123])?(?=\\s|$|;))[A-Za-z_\\u00c0-\\uffff.@][A-Za-z0-9_\\u00c0-\\uffff]*(?=\\s|$|:|=|;)', caseInsensitive: true },
          { token: 'keyword.mnemonic', regex: mnemonicRe, caseInsensitive: true },
          { token: 'keyword.illegal', regex: illegalRe, caseInsensitive: true },
          { token: 'support.macro', regex: '\\+[A-Za-z_][A-Za-z0-9_]*' },
          { token: 'constant.numeric.hex', regex: '\\$[0-9a-fA-F]+\\b|\\b0x[0-9a-fA-F]+\\b' },
          { token: 'constant.numeric.bin', regex: '%[01.#]+|\\b0b[01.#]+\\b' },
          { token: 'constant.numeric.oct', regex: '&[0-7]+' },
          { token: 'constant.numeric.dec', regex: '\\b\\d+(?:\\.\\d+)?\\b' },
          { token: 'variable.language.register', regex: ',\\s*[xXyY]\\b' },
          { token: 'keyword.operator.immediate', regex: '#' },
          { token: 'keyword.operator.word', regex: '\\b(?:DIV|MOD|AND|OR|XOR|EOR|NOT|ASL|LSL|ASR|LSR)\\b' },
          { token: 'support.function.math', regex: '\\b(?:sin|cos|tan|arcsin|arccos|arctan|int|float|address|addr)(?=\\s*\\()' },
          { token: 'variable.local', regex: '[.@][A-Za-z0-9_]+' },
          { token: 'keyword.else', regex: '\\belse\\b' },
          { token: 'identifier', regex: '[A-Za-z_\\u00c0-\\uffff][A-Za-z0-9_\\u00c0-\\uffff]*' },
          { token: 'keyword.operator', regex: '<<|>>>|>>|<=|>=|!=|<>|==|[-+*/%&|^<>=!~]' },
          { token: 'paren.lparen', regex: '[({\\[]' },
          { token: 'paren.rparen', regex: '[)}\\]]' },
          { token: 'punctuation', regex: '[,:]' },
          { token: 'text', regex: '\\s+' }
        ]
      };
      this.normalizeRules();
    };
    oop.inherits(AcmeHighlightRules, TextHighlightRules);
    exports.AcmeHighlightRules = AcmeHighlightRules;
  });

  // folding of { ... } blocks (!if, !for, !macro, !zone ...)
  ace.define('ace/mode/folding/acme', ['require', 'exports', 'module', 'ace/lib/oop', 'ace/mode/folding/fold_mode'], function (require, exports) {
    const oop = require('ace/lib/oop');
    const BaseFoldMode = require('ace/mode/folding/fold_mode').FoldMode;
    const FoldMode = function () {};
    oop.inherits(FoldMode, BaseFoldMode);
    (function () {
      this.foldingStartMarker = /(\{)\s*(?:;.*)?$/;
      this.foldingStopMarker = /^\s*(\})/;
      this.getFoldWidgetRange = function (session, foldStyle, row) {
        const line = session.getLine(row);
        const m = line.match(this.foldingStartMarker);
        if (m) return this.openingBracketBlock(session, '{', row, m.index);
        return null;
      };
    }).call(FoldMode.prototype);
    exports.FoldMode = FoldMode;
  });

  ace.define('ace/mode/acme', ['require', 'exports', 'module', 'ace/lib/oop', 'ace/mode/text', 'ace/mode/acme_highlight_rules', 'ace/mode/folding/acme'], function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextMode = require('ace/mode/text').Mode;
    const Rules = require('ace/mode/acme_highlight_rules').AcmeHighlightRules;
    const FoldMode = require('ace/mode/folding/acme').FoldMode;
    const Mode = function () {
      this.HighlightRules = Rules;
      this.foldingRules = new FoldMode();
      this.$behaviour = this.$defaultBehaviour;
    };
    oop.inherits(Mode, TextMode);
    (function () {
      this.lineCommentStart = ';';
      this.$id = 'ace/mode/acme';
      // keep the indentation of the previous line (labels start in column 1)
      this.getNextLineIndent = function (state, line) {
        const m = line.match(/^(\s*)/);
        const indent = m ? m[1] : '';
        if (!indent && /^[A-Za-z_.@+-]/.test(line)) return '        ';
        if (/\{\s*(;.*)?$/.test(line)) return indent + '    ';
        return indent;
      };
    }).call(Mode.prototype);
    exports.Mode = Mode;
  });

  function defineTheme(name, isDark, css) {
    ace.define('ace/theme/' + name, ['require', 'exports', 'module', 'ace/lib/dom'], function (require, exports) {
      exports.isDark = isDark;
      exports.cssClass = 'ace-' + name;
      exports.cssText = css;
      require('ace/lib/dom').importCssString(exports.cssText, exports.cssClass, false);
    });
  }

  // Night: deep VIC-II blue with colours taken from the C64 palette
  defineTheme('c64-night', true, `
.ace-c64-night { background: var(--ed-bg); color: var(--ed-fg); }
.ace-c64-night .ace_gutter { background: var(--ed-gutter); color: var(--ed-gutter-fg); }
.ace-c64-night .ace_gutter-active-line { background: var(--ed-active); color: var(--ed-fg); }
.ace-c64-night .ace_marker-layer .ace_active-line { background: var(--ed-active); }
.ace-c64-night .ace_marker-layer .ace_selection { background: var(--ed-selection); }
.ace-c64-night .ace_marker-layer .ace_selected-word { border: 1px solid var(--ed-selection-border); }
.ace-c64-night .ace_marker-layer .ace_bracket { border: 1px solid var(--ed-gutter-fg); }
.ace-c64-night .ace_cursor { color: var(--ed-cursor); }
.ace-c64-night .ace_print-margin { background: var(--ed-gutter); }
.ace-c64-night .ace_indent-guide { box-shadow: inset -1px 0 0 0 rgba(255,255,255,.05); }
.ace-c64-night .ace_invisible { color: rgba(255,255,255,.15); }
.ace-c64-night .ace_comment { color: #7d78b8; font-style: italic; }
.ace-c64-night .ace_keyword.ace_mnemonic { color: #8ec5ff; font-weight: 600; }
.ace-c64-night .ace_keyword.ace_illegal { color: #ff9f6b; font-weight: 600; }
.ace-c64-night .ace_support.ace_function.ace_pseudo { color: #a9ff9f; }
.ace-c64-night .ace_support.ace_macro { color: #f0a6ff; }
.ace-c64-night .ace_entity.ace_name.ace_label { color: #edf171; font-weight: 600; }
.ace-c64-night .ace_constant.ace_numeric { color: #75cec8; }
.ace-c64-night .ace_constant.ace_numeric.ace_bin { color: #9fe6c0; }
.ace-c64-night .ace_string { color: #ffb38a; }
.ace-c64-night .ace_variable.ace_language.ace_register { color: #c9a0ff; }
.ace-c64-night .ace_variable.ace_local { color: #e6e0a0; }
.ace-c64-night .ace_keyword.ace_operator { color: #c4c0ef; }
.ace-c64-night .ace_support.ace_function.ace_math { color: #9fe6c0; }
.ace-c64-night .ace_invalid { color: #ff7a85; text-decoration: underline wavy #ff7a85; }
.ace-c64-night .ace_fold { background: #6c5eb5; border-color: #c4c0ef; }
`);

  // Day: the light grey of the C64C case, ink in the dark VIC-II blue
  defineTheme('c64-day', false, `
.ace-c64-day { background: var(--ed-bg); color: var(--ed-fg); }
.ace-c64-day .ace_gutter { background: var(--ed-gutter); color: var(--ed-gutter-fg); }
.ace-c64-day .ace_gutter-active-line { background: var(--ed-active); color: var(--ed-fg); }
.ace-c64-day .ace_marker-layer .ace_active-line { background: var(--ed-active); }
.ace-c64-day .ace_marker-layer .ace_selection { background: var(--ed-selection); }
.ace-c64-day .ace_marker-layer .ace_selected-word { border: 1px solid var(--ed-selection-border); }
.ace-c64-day .ace_marker-layer .ace_bracket { border: 1px solid var(--ed-gutter-fg); }
.ace-c64-day .ace_cursor { color: var(--ed-cursor); }
.ace-c64-day .ace_print-margin { background: var(--ed-gutter); }
.ace-c64-day .ace_invisible { color: rgba(0,0,0,.18); }
.ace-c64-day .ace_comment { color: #7a7690; font-style: italic; }
.ace-c64-day .ace_keyword.ace_mnemonic { color: #2b2299; font-weight: 600; }
.ace-c64-day .ace_keyword.ace_illegal { color: #b5470f; font-weight: 600; }
.ace-c64-day .ace_support.ace_function.ace_pseudo { color: #2f7a2a; }
.ace-c64-day .ace_support.ace_macro { color: #8a2a9c; }
.ace-c64-day .ace_entity.ace_name.ace_label { color: #8a5a00; font-weight: 600; }
.ace-c64-day .ace_constant.ace_numeric { color: #106f74; }
.ace-c64-day .ace_constant.ace_numeric.ace_bin { color: #19734d; }
.ace-c64-day .ace_string { color: #a33d22; }
.ace-c64-day .ace_variable.ace_language.ace_register { color: #6b2fb3; }
.ace-c64-day .ace_variable.ace_local { color: #6e5a00; }
.ace-c64-day .ace_keyword.ace_operator { color: #4a4660; }
.ace-c64-day .ace_support.ace_function.ace_math { color: #19734d; }
.ace-c64-day .ace_invalid { color: #c0182c; text-decoration: underline wavy #c0182c; }
.ace-c64-day .ace_fold { background: #c4c0ef; border-color: #2b2299; }
`);
})();
