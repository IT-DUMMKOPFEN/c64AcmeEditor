/*
 * C64 ACME EDITOR - ACME source model
 * (c) IT-Dummköpfe - MIT License
 *
 * A lightweight, ACME-compatible multi-pass "assembler model" written in
 * JavaScript. It does not produce the final binary (the real ACME does that),
 * but it understands enough of the language to:
 *   - check every line while you type (mnemonics, addressing modes, ranges,
 *     symbols, pseudo opcodes, blocks, macros, loops ...)
 *   - explain errors and suggest a fix
 *   - compute the memory layout (segments, !binary includes such as SIDs)
 *   - know the address of every line
 *
 * Works in the browser (window.C64Asm) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./opcodes.js'));
  else root.C64Asm = factory(root.C64Opcodes);
})(typeof self !== 'undefined' ? self : this, function (OPC) {
  'use strict';

  // ------------------------------------------------------------------ utils
  const hex2 = v => '$' + (v & 0xff).toString(16).padStart(2, '0');
  const hex4 = v => '$' + (v & 0xffff).toString(16).padStart(4, '0');
  function hexAuto(v) { return v < 256 && v >= 0 ? hex2(v) : hex4(v); }

  function levenshtein(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      [prev, cur] = [cur, prev];
    }
    return prev[n];
  }
  function closest(word, list, maxDist) {
    let best = null, bestD = 99;
    for (const w of list) {
      const d = levenshtein(word, w);
      if (d < bestD) { bestD = d; best = w; }
    }
    return bestD <= (maxDist == null ? 2 : maxDist) ? best : null;
  }

  // Code from other assemblers that people often paste
  const FOREIGN = {
    '.byte': '!byte', '.by': '!byte', '.db': '!byte', 'db': '!byte', '.dc.b': '!byte', 'dc.b': '!byte',
    '.word': '!word', '.dw': '!word', 'dw': '!word', '.wo': '!word',
    '.text': '!text', '.asciiz': '!text "...", 0', '.ascii': '!text', '.null': '!text "...", 0', '.enc': '!ct',
    '.org': '* = ADDRESS', 'org': '* = ADDRESS', '.pc': '* = ADDRESS', '.addr': '!word',
    '.include': '!source "file"', '.import': '!source "file" / !binary "file"', '.incbin': '!binary "file"', 'incbin': '!binary "file"',
    '.binary': '!binary "file"', '.source': '!source "file"', 'include': '!source "file"',
    '.macro': '!macro NAME .param { ... }', '.endm': '}', 'endm': '}', '.endmacro': '}',
    '.fill': '!fill COUNT, VALUE', '.res': '!fill COUNT', '.ds': '!fill COUNT', 'ds': '!fill COUNT', '.dsb': '!fill COUNT',
    '.if': '!if COND { ... }', '.endif': '}', '.else': '} else {', '.for': '!for i, START, END { ... }',
    '.align': '!align 255, 0', '.var': '!set NAME = VALUE', '.const': 'NAME = VALUE', '.label': 'NAME = VALUE',
    '.cpu': '!cpu 6510', '.encoding': '!ct scr', '.segment': '* = ADDRESS', '.pseudopc': '!pseudopc ADDRESS { ... }',
    'basicupstart2': 'a BASIC start line, e.g. "* = $0801 / !byte $0c,$08,$0a,$00,$9e,$32,$30,$36,$31,$00,$00,$00" (see Insert > BASIC upstart)',
    'basicupstart': 'a BASIC start line (see Insert > BASIC upstart)'
  };

  const FUNCS = ['sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan', 'address', 'addr', 'int', 'float', 'is_number', 'is_list', 'is_string', 'len'];

  // ------------------------------------------------------------------ lexer
  function isIdStart(c) { return /[A-Za-z_À-￿]/.test(c); }
  function isIdChar(c) { return /[A-Za-z0-9_À-￿]/.test(c); }

  function lex(text, file) {
    const toks = [];
    const diags = [];
    const lines = text.split(/\r?\n/);
    for (let ln = 0; ln < lines.length; ln++) {
      const s = lines[ln];
      let i = 0;
      let sp = true;
      const push = (t, v, raw, col, end, extra) => {
        const tok = { t, v, raw, line: ln, col, end, sp };
        if (extra) Object.assign(tok, extra);
        toks.push(tok); sp = false;
      };
      const prevIsValue = () => {
        for (let k = toks.length - 1; k >= 0; k--) {
          const p = toks[k];
          if (p.line !== ln) return false;
          return p.t === 'num' || p.t === 'id' || p.t === 'str' || (p.t === 'op' && (p.v === ')' || p.v === ']'));
        }
        return false;
      };
      while (i < s.length) {
        const c = s[i];
        if (c === ' ' || c === '\t' || c === ' ') { i++; sp = true; continue; }
        if (c === ';') break;
        const start = i;
        // strings
        if (c === '"' || c === "'") {
          let j = i + 1, val = '';
          let closed = false;
          while (j < s.length) {
            if (s[j] === '\\' && j + 1 < s.length && (s[j + 1] === c || s[j + 1] === '\\')) { val += s[j + 1]; j += 2; continue; }
            if (s[j] === c) { closed = true; break; }
            val += s[j]; j++;
          }
          if (!closed) {
            diags.push(mkDiag('error', file, ln, i, s.length, 'Quotes still open at end of line.',
              'Close the string with a matching ' + c + ' character.', 'quote'));
            push('str', val, s.slice(i), i, s.length, { q: c });
            i = s.length; continue;
          }
          push('str', val, s.slice(i, j + 1), i, j + 1, { q: c });
          i = j + 1; continue;
        }
        // numbers
        if (c === '$' || (c === '0' && (s[i + 1] === 'x' || s[i + 1] === 'X') && /[0-9a-fA-F]/.test(s[i + 2] || ''))) {
          let j = i + (c === '$' ? 1 : 2);
          const ds = j;
          while (j < s.length && /[0-9a-fA-F]/.test(s[j])) j++;
          const digits = s.slice(ds, j);
          if (!digits.length) {
            if (c === '$') {
              diags.push(mkDiag('error', file, ln, i, i + 1, "Hex digits expected after '$'.", 'Write hex numbers like $d020 or $0f.', 'number'));
              push('num', 0, '$', i, i + 1, { digits: 0, bad: true });
              i++; continue;
            }
          }
          let bad = false;
          if (j < s.length && isIdChar(s[j])) {
            let k = j; while (k < s.length && isIdChar(s[k])) k++;
            diags.push(mkDiag('error', file, ln, i, k, `Invalid hex number '${s.slice(i, k)}'.`,
              'Hex digits are 0-9 and a-f only.', 'number'));
            j = k; bad = true;
          }
          push('num', bad ? 0 : parseInt(digits, 16), s.slice(i, j), i, j, { digits: digits.length, radix: 16, bad });
          i = j; continue;
        }
        if ((c === '%' || (c === '0' && (s[i + 1] === 'b' || s[i + 1] === 'B') && /[01.#]/.test(s[i + 2] || ''))) && !prevIsValue()) {
          let j = i + (c === '%' ? 1 : 2);
          const ds = j;
          while (j < s.length && /[01.#]/.test(s[j])) j++;
          const digits = s.slice(ds, j);
          if (digits.length) {
            let bad = false;
            if (j < s.length && /[2-9A-Za-z_]/.test(s[j])) {
              let k = j; while (k < s.length && isIdChar(s[k])) k++;
              diags.push(mkDiag('error', file, ln, i, k, `Invalid binary number '${s.slice(i, k)}'.`,
                "Binary digits are 0 and 1 (ACME also accepts '.' for 0 and '#' for 1).", 'number'));
              j = k; bad = true;
            }
            const v = bad ? 0 : parseInt(digits.replace(/\./g, '0').replace(/#/g, '1'), 2);
            push('num', v, s.slice(i, j), i, j, { digits: Math.ceil(digits.length / 4), radix: 2, bad });
            i = j; continue;
          }
        }
        if (c === '&' && /[0-7]/.test(s[i + 1] || '') && !prevIsValue()) {
          let j = i + 1; while (j < s.length && /[0-7]/.test(s[j])) j++;
          push('num', parseInt(s.slice(i + 1, j), 8), s.slice(i, j), i, j, { digits: 0, radix: 8 });
          i = j; continue;
        }
        if (/[0-9]/.test(c)) {
          let j = i; while (j < s.length && /[0-9]/.test(s[j])) j++;
          let isFloat = false;
          if (s[j] === '.' && /[0-9]/.test(s[j + 1] || '')) { isFloat = true; j++; while (j < s.length && /[0-9]/.test(s[j])) j++; }
          let bad = false;
          if (j < s.length && isIdChar(s[j])) {
            let k = j; while (k < s.length && isIdChar(s[k])) k++;
            const word = s.slice(i, k);
            let hint = 'Numbers must not be followed directly by letters.';
            if (/^[0-9a-fA-F]+h$/i.test(word)) hint = `ACME writes hex numbers with a '$' prefix: use $${word.slice(0, -1)} instead of ${word}.`;
            diags.push(mkDiag('error', file, ln, i, k, `Invalid number '${word}'.`, hint, 'number'));
            j = k; bad = true;
          }
          const raw = s.slice(i, j);
          push('num', bad ? 0 : (isFloat ? parseFloat(raw) : parseInt(raw, 10)), raw, i, j, { digits: 0, radix: 10, float: isFloat, bad });
          i = j; continue;
        }
        // pseudo opcodes
        if (c === '!' && i + 1 < s.length && /[A-Za-z0-9]/.test(s[i + 1])) {
          let j = i + 1; while (j < s.length && isIdChar(s[j])) j++;
          push('po', s.slice(i, j).toLowerCase(), s.slice(i, j), i, j);
          i = j; continue;
        }
        // identifiers (global, .local, @cheap)
        if (isIdStart(c) || ((c === '.' || c === '@') && i + 1 < s.length && isIdChar(s[i + 1]))) {
          let j = i + 1; while (j < s.length && isIdChar(s[j])) j++;
          push('id', s.slice(i, j), s.slice(i, j), i, j);
          i = j; continue;
        }
        // operators
        const three = s.substr(i, 3), two = s.substr(i, 2);
        if (three === '>>>') { push('op', '>>>', three, i, i + 3); i += 3; continue; }
        if (['<<', '>>', '<=', '>=', '!=', '<>', '><', '=='].includes(two)) { push('op', two, two, i, i + 2); i += 2; continue; }
        if ('+-*/%&|^<>=!()[],#~'.includes(c)) { push('op', c, c, i, i + 1); i++; continue; }
        if (c === ':') { push('colon', ':', ':', i, i + 1); i++; continue; }
        if (c === '{') { push('lbrace', '{', '{', i, i + 1); i++; continue; }
        if (c === '}') { push('rbrace', '}', '}', i, i + 1); i++; continue; }
        diags.push(mkDiag('error', file, ln, i, i + 1, `Illegal character '${c}'.`, 'Remove this character or put it inside a comment (;) or string.', 'char'));
        i++;
      }
      toks.push({ t: 'nl', v: '\n', line: ln, col: s.length, end: s.length, sp: true });
    }
    toks.push({ t: 'eof', line: lines.length - 1, col: 0, end: 0, sp: true });
    return { toks, diags, lines };
  }

  function mkDiag(severity, file, line, col, endCol, message, hint, code) {
    return { severity, file, line, col, endCol: Math.max(endCol, col + 1), message, hint: hint || '', code: code || '' };
  }

  // ----------------------------------------------------------------- parser
  const BLOCK_POS = new Set(['!if', '!ifdef', '!ifndef', '!for', '!macro', '!zone', '!pseudopc', '!do', '!while', '!convtab', '!cpu', '!xor', '!address', '!al', '!as', '!rl', '!rs', '!subzone']);

  class Parser {
    constructor(lexed, file) {
      this.toks = lexed.toks; this.p = 0; this.file = file; this.diags = lexed.diags; this.lines = lexed.lines;
    }
    get cur() { return this.toks[this.p]; }
    peek(o) { return this.toks[Math.min(this.p + (o || 0), this.toks.length - 1)]; }
    next() { const t = this.toks[this.p]; if (this.p < this.toks.length - 1) this.p++; return t; }
    isEnd(t) { t = t || this.cur; return t.t === 'nl' || t.t === 'colon' || t.t === 'eof' || t.t === 'rbrace'; }
    loc(t, endTok) { return { file: this.file, line: t.line, col: t.col, endCol: (endTok || t).end }; }
    err(t, msg, hint, code, endTok, sev) {
      this.diags.push(mkDiag(sev || 'error', this.file, t.line, t.col, (endTok || t).end, msg, hint, code));
    }
    skipStatement() { while (!this.isEnd()) this.next(); }

    parseProgram() {
      const stmts = this.parseStatements(false);
      return stmts;
    }

    parseStatements(inBlock, openTok) {
      const out = [];
      for (;;) {
        const t = this.cur;
        if (t.t === 'eof') {
          if (inBlock) this.err(openTok, "Missing '}' - this block is never closed.", "Add a closing '}' at the end of the block.", 'brace');
          return out;
        }
        if (t.t === 'nl' || t.t === 'colon') { this.next(); continue; }
        if (t.t === 'rbrace') {
          if (inBlock) return out;
          this.err(t, "Found '}' without a matching '{'.", "Remove this '}' or add the missing block start (e.g. '!if ... {').", 'brace');
          this.next(); continue;
        }
        try {
          const s = this.parseStatement();
          if (s) { if (Array.isArray(s)) out.push(...s); else out.push(s); }
        } catch (e) {
          if (e && e.parseError) { this.skipStatement(); } else throw e;
        }
        if (!this.isEnd()) {
          const t2 = this.cur;
          let end = t2; let k = this.p;
          while (!this.isEnd(this.toks[k])) { end = this.toks[k]; k++; }
          this.err(t2, `Garbage data at end of statement: '${this.lines[t2.line].slice(t2.col, end.end).trim()}'.`,
            'Every line holds one statement (several can be separated with ":"). Comments start with ";".', 'garbage', end);
          this.skipStatement();
        }
      }
    }

    fail(t, msg, hint, code, endTok) { this.err(t, msg, hint, code, endTok); const e = new Error(msg); e.parseError = true; throw e; }

    // collects tokens until statement end (optionally stopping at '{')
    collect(stopAtBrace) {
      const out = [];
      while (!this.isEnd() && !(stopAtBrace && this.cur.t === 'lbrace')) out.push(this.next());
      return out;
    }

    parseStatement() {
      const t = this.cur;
      // * = expr
      if (t.t === 'op' && t.v === '*' && this.peek(1).t === 'op' && this.peek(1).v === '=') {
        this.next(); this.next();
        const toks = this.collect(false);
        const args = splitArgs(toks);
        if (!args.length || !args[0].length) this.fail(t, "Missing address after '* ='.", 'Example: * = $0801', 'syntax');
        return { k: 'setpc', expr: this.expr(args[0], t), loc: this.loc(t, toks[toks.length - 1] || t) };
      }
      // anonymous labels / macro calls
      if (t.t === 'op' && (t.v === '+' || t.v === '-')) {
        if (t.v === '+' && this.peek(1).t === 'id' && !this.peek(1).sp) return this.parseMacroCall();
        let name = t.v; this.next();
        while (this.cur.t === 'op' && this.cur.v === t.v && !this.cur.sp) { name += this.cur.v; this.next(); }
        const lab = { k: 'label', name, kind: 'anon', loc: this.loc(t) };
        if (this.isEnd()) return lab;
        const rest = this.parseAfterLabel(lab, t);
        return [lab, rest];
      }
      if (t.t === 'po') return this.parsePseudo();
      if (t.t === 'id') {
        const name = t.v;
        const nxt = this.peek(1);
        const isAssign = nxt.t === 'op' && (nxt.v === '=' || (nxt.v === '+' && this.peek(2).t === 'num' && this.peek(3).t === 'op' && this.peek(3).v === '='));
        if (OPC.isAnyMnemonic(name) && !isAssign) return this.parseInstruction();
        // foreign syntax?
        const fk = name.toLowerCase();
        if (FOREIGN[fk] && !isAssign && !this.isEnd(nxt) && nxt.t !== 'po' && !(nxt.t === 'id' && OPC.isAnyMnemonic(nxt.v))) {
          const toks = this.collect(false);
          this.err(t, `'${name}' is not ACME syntax.`, `ACME uses ${FOREIGN[fk]}.`, 'foreign', toks[toks.length - 1] || t);
          return null;
        }
        this.next();
        if (isAssign) {
          if (nxt.v === '+') { this.next(); this.next(); }
          this.next();
          const toks = this.collect(false);
          if (!toks.length) this.fail(t, `Missing value after '${name} ='.`, `Example: ${name} = $d020`, 'syntax');
          return { k: 'assign', name, expr: this.expr(toks, t), loc: this.loc(t), defLoc: this.loc(t) };
        }
        const lab = { k: 'label', name, kind: name[0] === '.' ? 'local' : name[0] === '@' ? 'cheap' : 'global', loc: this.loc(t) };
        if (this.isEnd()) {
          if (t.col > 0) {
            const guess = /^[a-z]{3}$/i.test(name) ? closest(name, OPC.mnemonicList(), 1) : null;
            if (guess) lab.warn = { msg: `'${name}' is not a 6502 mnemonic - ACME treats it as a label.`, hint: `Did you mean '${guess.toLowerCase()}'?`, code: 'mnemonic' };
            else lab.warn = { msg: `Label '${name}' is not in the leftmost column.`, hint: 'ACME expects labels in column 1. If this was meant to be an instruction, check its spelling.', code: 'indent' };
          }
          return lab;
        }
        const rest = this.parseAfterLabel(lab, t);
        return [lab, rest];
      }
      if (t.t === 'op' && t.v === '#') this.fail(t, "Unexpected '#' - an instruction is missing.", "'#' marks an immediate value, e.g. 'lda #$00'.", 'syntax');
      this.fail(t, `Syntax error: unexpected '${t.raw || t.v}'.`, 'A statement starts with a label, a mnemonic (lda, sta ...), a pseudo opcode (!byte ...), "* =" or a macro call (+name).', 'syntax');
    }

    parseAfterLabel(lab, labTok) {
      const t = this.cur;
      if (labTok.col > 0) lab.warn = { msg: `Label '${lab.name}' is not in the leftmost column.`, hint: 'ACME expects labels in column 1 (instructions are indented).', code: 'indent' };
      if (t.t === 'id' && OPC.isAnyMnemonic(t.v)) return this.parseInstruction();
      if (t.t === 'po') return this.parsePseudo();
      if (t.t === 'op' && t.v === '+' && this.peek(1).t === 'id' && !this.peek(1).sp) return this.parseMacroCall();
      if (t.t === 'id' && FOREIGN[t.v.toLowerCase()]) {
        const toks = this.collect(false);
        this.err(t, `'${t.v}' is not ACME syntax.`, `ACME uses ${FOREIGN[t.v.toLowerCase()]}.`, 'foreign', toks[toks.length - 1] || t);
        return null;
      }
      // "ldq #5" -> label 'ldq' followed by garbage
      const name = lab.name;
      if (lab.kind === 'global' && /^[a-z]{3}$/i.test(name)) {
        const guess = closest(name, OPC.mnemonicList(), 2);
        const toks = this.collect(false);
        lab.warn = null;
        lab.invalid = true;
        this.err(labTok, `Unknown mnemonic '${name}'.`, guess ? `Did you mean '${guess.toLowerCase()}'? (${OPC.get(guess).title})` : 'See Help > 6502 Instruction Set for all mnemonics.', 'mnemonic', labTok);
        void toks;
        return null;
      }
      if (t.t === 'id') {
        const guess = closest(t.v, OPC.mnemonicList(), 2);
        const toks = this.collect(false);
        this.err(t, `Unknown mnemonic '${t.v}'.`, guess ? `Did you mean '${guess.toLowerCase()}'?` : 'See Help > 6502 Instruction Set for all mnemonics.', 'mnemonic', t);
        void toks;
        return null;
      }
      this.fail(t, `Syntax error after label '${name}'.`, 'After a label you can write an instruction, a pseudo opcode or "= value".', 'syntax');
    }

    parseMacroCall() {
      const plus = this.next();
      const nameTok = this.next();
      const toks = this.collect(false);
      const args = toks.length ? splitArgs(toks).map(a => this.argExpr(a, nameTok)) : [];
      return { k: 'macrocall', name: nameTok.v, args, loc: this.loc(plus, nameTok) };
    }

    parseInstruction() {
      const mt = this.next();
      const mn = mt.v.toUpperCase();
      let postfix = 0;
      if (this.cur.t === 'op' && this.cur.v === '+' && !this.cur.sp && this.peek(1).t === 'num' && !this.peek(1).sp) {
        this.next(); postfix = this.next().v;
        if (![1, 2, 3].includes(postfix)) this.err(mt, 'Illegal postfix.', 'Use +1 (8 bit), +2 (16 bit) or +3 (24 bit).', 'postfix');
      }
      const toks = this.collect(false);
      const node = { k: 'instr', mn, postfix, loc: this.loc(mt), opLoc: toks.length ? this.loc(toks[0], toks[toks.length - 1]) : null, form: 'imp', expr: null };
      if (!toks.length) return node;
      if (toks[0].t === 'op' && toks[0].v === '#') {
        if (toks.length === 1) this.fail(toks[0], "Missing value after '#'.", 'Example: lda #$00', 'syntax');
        node.form = 'imm'; node.expr = this.expr(toks.slice(1), toks[0]); return node;
      }
      // trailing ,x / ,y
      const ci = lastTopComma(toks);
      if (ci >= 0) {
        const after = toks.slice(ci + 1);
        const before = toks.slice(0, ci);
        const reg = after.length === 1 && after[0].t === 'id' ? after[0].v.toLowerCase() : null;
        if (reg !== 'x' && reg !== 'y') {
          this.fail(toks[ci], 'Illegal index register.', "Only ',x' and ',y' are allowed after an address.", 'mode', toks[toks.length - 1]);
        }
        if (!before.length) this.fail(toks[0], 'Missing address before the index register.', 'Example: lda $0400,x', 'syntax');
        if (before[0].t === 'op' && before[0].v === '(' && matchParen(before, 0) === before.length - 1) {
          if (reg === 'y') { node.form = 'izy'; node.expr = this.expr(before.slice(1, -1), before[0]); return node; }
          node.form = 'badindx'; node.expr = this.expr(before.slice(1, -1), before[0]); return node;
        }
        node.form = reg; node.expr = this.expr(before, toks[0]); return node;
      }
      if (toks[0].t === 'op' && toks[0].v === '(' && matchParen(toks, 0) === toks.length - 1) {
        const inner = toks.slice(1, -1);
        const ic = lastTopComma(inner);
        if (ic >= 0) {
          const reg = inner.slice(ic + 1);
          const r = reg.length === 1 && reg[0].t === 'id' ? reg[0].v.toLowerCase() : null;
          if (r === 'x') { node.form = 'izx'; node.expr = this.expr(inner.slice(0, ic), toks[0]); return node; }
          if (r === 'y') { node.form = 'badiny'; node.expr = this.expr(inner.slice(0, ic), toks[0]); return node; }
          this.fail(toks[0], 'Illegal indirect addressing.', 'Valid forms are ($nn,x), ($nn),y and (for JMP) ($nnnn).', 'mode');
        }
        node.form = 'ind'; node.expr = this.expr(inner, toks[0]); return node;
      }
      if (toks.length === 1 && toks[0].t === 'id' && toks[0].v.toLowerCase() === 'a') node.accA = true;
      node.form = 'plain'; node.expr = this.expr(toks, toks[0]); return node;
    }

    parsePseudo() {
      const t = this.next();
      const raw = t.v;
      const canon = OPC.canonicalPseudo(raw);
      const loc = this.loc(t);
      if (!canon) {
        const toks = this.collect(true);
        if (this.cur.t === 'lbrace') { const ob = this.next(); this.parseStatements(true, ob); if (this.cur.t === 'rbrace') this.next(); }
        const guess = closest(raw, OPC.pseudoList(), 3);
        this.err(t, `Unknown pseudo opcode '${raw}'.`, guess ? `Did you mean '${guess}'?` : 'See Help > ACME Pseudo Opcodes.', 'pseudo');
        void toks;
        return null;
      }
      const node = { k: 'pseudo', name: canon, raw, loc, args: [], toks: [] };
      if (canon === '!macro') return this.parseMacroDef(t);
      if (canon === '!do') return this.parseDo(t, node);
      const toks = this.collect(BLOCK_POS.has(canon));
      node.toks = toks;
      if (canon === '!hex') {
        node.hexText = toks.map(x => x.raw != null ? String(x.raw) : '').join('');
        return node;
      }
      if (canon === '!zone' || canon === '!subzone' || canon === '!convtab' || canon === '!cpu') {
        node.word = toks.map(x => x.raw).join('');
        node.args = [];
      } else if (canon === '!set') {
        const eq = toks.findIndex(x => x.t === 'op' && x.v === '=');
        if (eq < 1) this.fail(t, '!set needs SYMBOL = VALUE.', 'Example: !set counter = counter + 1', 'syntax');
        node.symbol = toks[0].v; node.symLoc = this.loc(toks[0]);
        node.args = [this.expr(toks.slice(eq + 1), toks[eq])];
      } else if (canon === '!address') {
        const eq = toks.findIndex(x => x.t === 'op' && x.v === '=');
        if (eq >= 1 && toks[0].t === 'id') {
          return { k: 'assign', name: toks[0].v, expr: this.expr(toks.slice(eq + 1), toks[eq]), loc: this.loc(toks[0]), defLoc: this.loc(toks[0]) };
        }
      } else if (canon === '!ifdef' || canon === '!ifndef') {
        node.symbol = toks.length ? toks[0].v : '';
        if (!toks.length) this.fail(t, `${canon} needs a symbol name.`, `Example: ${canon} DEBUG { ... }`, 'syntax');
      } else if (toks.length) {
        node.args = splitArgs(toks).map(a => this.argExpr(a, t, canon));
      }
      if (BLOCK_POS.has(canon) && this.cur.t === 'lbrace') {
        const ob = this.next();
        node.block = this.parseStatements(true, ob);
        if (this.cur.t === 'rbrace') this.next();
        if ((canon === '!if' || canon === '!ifdef' || canon === '!ifndef') && this.cur.t === 'id' && this.cur.v.toLowerCase() === 'else') {
          const et = this.next();
          if (this.cur.t === 'lbrace') {
            const ob2 = this.next();
            node.elseBlock = this.parseStatements(true, ob2);
            if (this.cur.t === 'rbrace') this.next();
          } else if (this.cur.t === 'po' && this.cur.v === '!if') {
            node.elseBlock = [this.parsePseudo()];
          } else this.fail(et, "'else' must be followed by '{'.", 'Example: } else {', 'syntax');
        }
      } else if (['!if', '!ifdef', '!ifndef', '!for', '!pseudopc', '!while'].includes(canon)) {
        if (canon === '!ifdef' || canon === '!ifndef') {
          // old style: !ifdef SYMBOL STATEMENT  -> rest already collected
          node.inline = true;
        } else {
          this.fail(t, `Missing '{' after ${canon}.`, `${canon} needs a block: ${OPC.PSEUDO[canon].args}`, 'brace', toks[toks.length - 1] || t);
        }
      }
      return node;
    }

    parseMacroDef(t) {
      const nameTok = this.cur;
      if (nameTok.t !== 'id') this.fail(t, '!macro needs a name.', 'Example: !macro set_border .color { lda #.color : sta $d020 }', 'syntax');
      this.next();
      const params = [];
      while (!this.isEnd() && this.cur.t !== 'lbrace') {
        const pt = this.next();
        if (pt.t === 'op' && (pt.v === ',' || pt.v === '~')) continue;
        if (pt.t === 'id') params.push({ name: pt.v, loc: this.loc(pt) });
        else this.fail(pt, 'Invalid macro parameter.', 'Macro parameters are symbol names, usually local ones like .value', 'syntax');
      }
      if (this.cur.t !== 'lbrace') this.fail(t, "Missing '{' after !macro.", 'Example: !macro name .param {', 'brace');
      const ob = this.next();
      const body = this.parseStatements(true, ob);
      if (this.cur.t === 'rbrace') this.next();
      return { k: 'macrodef', name: nameTok.v, params, body, loc: this.loc(t, nameTok) };
    }

    parseDo(t, node) {
      const cond = () => {
        if (this.cur.t === 'id' && ['while', 'until'].includes(this.cur.v.toLowerCase())) {
          const kw = this.next().v.toLowerCase();
          const toks = this.collect(true);
          return { kw, expr: this.expr(toks, t) };
        }
        return null;
      };
      node.pre = cond();
      if (this.cur.t !== 'lbrace') this.fail(t, "Missing '{' after !do.", 'Example: !do while i < 10 { ... }', 'brace');
      const ob = this.next();
      node.block = this.parseStatements(true, ob);
      if (this.cur.t === 'rbrace') this.next();
      node.post = cond();
      return node;
    }

    argExpr(toks, anchor, canon) {
      if (toks.length === 1 && toks[0].t === 'str') {
        return { k: 'str', v: toks[0].v, q: toks[0].q, loc: this.loc(toks[0]) };
      }
      // library include <file>
      if ((canon === '!source' || canon === '!binary') && toks.length && toks[0].t === 'op' && toks[0].v === '<') {
        const name = toks.slice(1, toks.length - 1).map(x => x.raw).join('');
        return { k: 'str', v: name, lib: true, loc: this.loc(toks[0]) };
      }
      if (!toks.length) return { k: 'empty' };
      return this.expr(toks, anchor);
    }

    expr(toks, anchor) {
      if (!toks.length) this.fail(anchor, 'Value expected.', '', 'syntax');
      const ep = new ExprParser(toks, this, anchor);
      const e = ep.parse(1);
      if (ep.p < toks.length) {
        const bad = toks[ep.p];
        this.fail(bad, `Unexpected '${bad.raw || bad.v}' in expression.`, 'Check operators and parentheses.', 'expr', toks[toks.length - 1]);
      }
      e.loc = this.loc(toks[0], toks[toks.length - 1]);
      return e;
    }
  }

  function splitArgs(toks) {
    const out = []; let cur = []; let depth = 0;
    for (const t of toks) {
      if (t.t === 'op' && (t.v === '(' || t.v === '[')) depth++;
      if (t.t === 'op' && (t.v === ')' || t.v === ']')) depth--;
      if (t.t === 'op' && t.v === ',' && depth === 0) { out.push(cur); cur = []; continue; }
      cur.push(t);
    }
    out.push(cur);
    return out;
  }
  function lastTopComma(toks) {
    let depth = 0, idx = -1;
    toks.forEach((t, i) => {
      if (t.t === 'op' && t.v === '(') depth++;
      if (t.t === 'op' && t.v === ')') depth--;
      if (t.t === 'op' && t.v === ',' && depth === 0) idx = i;
    });
    return idx;
  }
  function matchParen(toks, i) {
    let depth = 0;
    for (let k = i; k < toks.length; k++) {
      if (toks[k].t === 'op' && toks[k].v === '(') depth++;
      if (toks[k].t === 'op' && toks[k].v === ')') { depth--; if (depth === 0) return k; }
    }
    return -1;
  }

  // ------------------------------------------------------- expression parser
  const BINOPS = {
    '^': [12, true], '*': [10], '/': [10], 'DIV': [10], '%': [10], 'MOD': [10],
    '+': [9], '-': [9], '<<': [8], 'ASL': [8], 'LSL': [8], '>>': [8], 'ASR': [8], '>>>': [8], 'LSR': [8],
    '<=': [6], '<': [6], '>=': [6], '>': [6], '!=': [5], '<>': [5], '><': [5], '=': [4], '==': [4],
    '&': [3], 'AND': [3], 'XOR': [2], 'EOR': [2], '|': [1], 'OR': [1]
  };

  class ExprParser {
    constructor(toks, parser, anchor) { this.toks = toks; this.p = 0; this.parser = parser; this.anchor = anchor; }
    get cur() { return this.toks[this.p]; }
    binop() {
      const t = this.cur; if (!t) return null;
      if (t.t === 'op' && BINOPS[t.v]) return t.v;
      if (t.t === 'id' && BINOPS[t.v] && t.v === t.v.toUpperCase() && /^[A-Z]+$/.test(t.v)) return t.v;
      return null;
    }
    parse(minPrec) {
      let left = this.prefix();
      for (;;) {
        const op = this.binop();
        if (!op) break;
        const [prec, right] = BINOPS[op];
        if (prec < minPrec) break;
        const opTok = this.cur;
        this.p++;
        if (!this.cur) this.parser.fail(opTok, `Value expected after '${op}'.`, '', 'expr');
        const rhs = this.parse(right ? prec : prec + 1);
        if (op === '==') rhs.warnEq = true;
        left = { k: 'bin', op, a: left, b: rhs, tok: opTok };
      }
      return left;
    }
    prefix() {
      const t = this.cur;
      if (!t) this.parser.fail(this.anchor, 'Value expected.', '', 'expr');
      if (t.t === 'num') { this.p++; return { k: 'num', v: t.v, f16: t.radix === 16 && t.digits > 2 || (t.radix === 2 && t.digits > 2), float: !!t.float, tok: t }; }
      if (t.t === 'str') {
        this.p++;
        if (t.v.length !== 1) {
          if (t.v.length === 0) this.parser.fail(t, 'Empty character value.', '', 'expr');
          return { k: 'str', v: t.v, tok: t, multi: true };
        }
        return { k: 'chr', v: t.v, tok: t };
      }
      if (t.t === 'op') {
        if (t.v === '(' || t.v === '[') {
          this.p++;
          const e = this.parse(1);
          const close = this.cur;
          if (!close || close.t !== 'op' || (close.v !== ')' && close.v !== ']')) this.parser.fail(t, "Missing ')'.", 'Every "(" needs a matching ")".', 'paren');
          this.p++;
          return e;
        }
        if (t.v === '*') { this.p++; return { k: 'pc', tok: t }; }
        if (t.v === '+') { // anonymous forward ref
          let name = '+'; this.p++;
          while (this.cur && this.cur.t === 'op' && this.cur.v === '+' && !this.cur.sp) { name += '+'; this.p++; }
          return { k: 'anon', name, tok: t };
        }
        if (t.v === '-') {
          let n = 0; let k = this.p;
          while (k < this.toks.length && this.toks[k].t === 'op' && this.toks[k].v === '-' && (k === this.p || !this.toks[k].sp)) { n++; k++; }
          const after = this.toks[k];
          if (!after || (after.t === 'op' && (after.v === ',' || after.v === ')'))) {
            this.p = k; return { k: 'anon', name: '-'.repeat(n), tok: t };
          }
          this.p++;
          return { k: 'un', op: 'neg', a: this.parse(11), tok: t };
        }
        if (t.v === '!') { this.p++; return { k: 'un', op: 'not', a: this.parse(13), tok: t }; }
        if (t.v === '<') { this.p++; return { k: 'un', op: 'lo', a: this.parse(8), tok: t }; }
        if (t.v === '>') { this.p++; return { k: 'un', op: 'hi', a: this.parse(8), tok: t }; }
        if (t.v === '^') { this.p++; return { k: 'un', op: 'bank', a: this.parse(8), tok: t }; }
        if (t.v === '#') this.parser.fail(t, "Unexpected '#'.", "'#' is only allowed directly after the mnemonic.", 'expr');
      }
      if (t.t === 'po') { // "!symbol" lexed as pseudo opcode -> NOT symbol
        this.p++;
        const inner = t.raw.slice(1);
        const fake = /^[0-9]/.test(inner) ? { k: 'num', v: parseInt(inner, 10), tok: t } : { k: 'sym', name: inner, tok: t };
        return { k: 'un', op: 'not', a: fake, tok: t };
      }
      if (t.t === 'id') {
        if (t.v === 'NOT') { this.p++; return { k: 'un', op: 'not', a: this.parse(13), tok: t }; }
        const nx = this.toks[this.p + 1];
        if (FUNCS.includes(t.v.toLowerCase()) && nx && nx.t === 'op' && nx.v === '(') {
          this.p += 2;
          const a = this.parse(1);
          if (!this.cur || this.cur.v !== ')') this.parser.fail(t, "Missing ')' after function argument.", '', 'paren');
          this.p++;
          return { k: 'fn', name: t.v.toLowerCase(), a, tok: t };
        }
        this.p++;
        return { k: 'sym', name: t.v, tok: t };
      }
      this.parser.fail(t, `Unexpected '${t.raw || t.v}' in expression.`, '', 'expr');
    }
  }

  // ------------------------------------------------------------- evaluation
  const UNDEF = { v: 0, def: false };

  // ASCII -> PETSCII / screen code (approximation of ACME's tables)
  function petscii(ch) {
    let c = ch.charCodeAt(0);
    if (c >= 0x61 && c <= 0x7a) return c - 0x20;
    if (c >= 0x41 && c <= 0x5a) return c + 0x20;
    return c & 0xff;
  }
  function screencode(ch) {
    let c = ch.charCodeAt(0);
    if (c >= 0x61 && c <= 0x7a) return c - 0x60;
    if (c >= 0x41 && c <= 0x5a) return c;
    if (c === 0x40) return 0;
    if (c >= 0x5b && c <= 0x5f) return c - 0x40;
    if (c === 0x60) return 0x40;
    return c & 0xff;
  }

  class Assembler {
    constructor(io) {
      this.io = io || {};
      this.astCache = new Map();
    }

    parseFile(path, text) {
      const cached = this.astCache.get(path);
      if (cached && cached.text === text) return cached;
      const lexed = lex(text, path);
      const parser = new Parser(lexed, path);
      const ast = parser.parseProgram();
      const entry = { text, ast, diags: parser.diags, lines: lexed.lines };
      this.astCache.set(path, entry);
      return entry;
    }

    // main entry
    analyze(text, path, opts) {
      opts = opts || {};
      path = path || 'untitled';
      this.mainPath = path;
      const main = this.parseFile(path, text);
      this.symbols = new Map();
      this.macros = new Map();
      this.firstUndef = new WeakSet();
      let res = null;
      const maxPasses = opts.maxPasses || 8;
      for (let pass = 1; pass <= maxPasses; pass++) {
        res = this.runPass(main, pass);
        if (res.serious) break;
        if (pass > 1 && !res.changed && res.undefCount === 0) break;
        if (pass > 2 && !res.changed && res.undefCount === res.prevUndef) break;
      }
      const parseDiags = [];
      const seenFiles = new Set([path]);
      parseDiags.push(...main.diags);
      for (const f of res.files) {
        if (!seenFiles.has(f)) { seenFiles.add(f); const e = this.astCache.get(f); if (e) parseDiags.push(...e.diags); }
      }
      const diags = dedupe(parseDiags.concat(res.diags));
      const segments = buildSegments(res.ranges);
      const globals = [];
      for (const [k, s] of this.symbols) {
        if (!k.includes(':')) globals.push({ name: k, value: s.v, loc: s.loc, refs: s.refs || 0, isLabel: !!s.isLabel, isSet: !!s.isSet });
      }
      return {
        diags, segments, ranges: res.ranges, symbols: globals, symbolMap: this.symbols,
        instrs: res.instrs, lineInfo: res.lineInfo, outputs: res.outputs, binaries: res.binaries,
        macros: [...this.macros.keys()], passes: res.pass, files: [...seenFiles],
        start: segments.length ? Math.min(...segments.map(s => s.start)) : null,
        end: segments.length ? Math.max(...segments.map(s => s.end)) : null,
        pcStatements: res.pcStatements, labelsAt: res.labelsAt, anonAddrs: res.anonAddrs
      };
    }

    runPass(main, pass) {
      const ctx = {
        pass, pc: null, delta: 0, zone: 0, zoneCounter: 0, cheap: 0,
        anonDefs: new Map(), anonPrev: this.prevAnon || new Map(), seq: 0,
        ranges: [], diags: [], instrs: [], lineInfo: new Map(), outputs: [], binaries: [],
        cpu: '6510ok', cpuName: '6502', illegalOk: false, changed: false, undefCount: 0,
        definedThisPass: new Set(), files: new Set([this.mainPath]), depth: 0,
        pcStatements: [], labelsAt: [], reportedUnset: false, serious: false, convtab: 'raw'
      };
      this.ctx = ctx;
      for (const s of this.symbols.values()) s.refs = 0;
      try {
        this.execList(main.ast, this.mainPath);
      } catch (e) {
        if (!(e && (e.eof || e.serious))) throw e;
        if (e.serious) ctx.serious = true;
      }
      ctx.prevUndef = this.lastUndef == null ? -1 : this.lastUndef;
      this.lastUndef = ctx.undefCount;
      this.prevAnon = ctx.anonDefs;
      return {
        pass, changed: ctx.changed, undefCount: ctx.undefCount, prevUndef: ctx.prevUndef, diags: ctx.diags, ranges: ctx.ranges,
        instrs: ctx.instrs, lineInfo: ctx.lineInfo, outputs: ctx.outputs, binaries: ctx.binaries, files: [...ctx.files],
        serious: ctx.serious, pcStatements: ctx.pcStatements, labelsAt: ctx.labelsAt,
        anonAddrs: [].concat(...[...ctx.anonDefs.values()].map(l => l.map(d => d.v)))
      };
    }

    diag(sev, loc, msg, hint, code) {
      if (!loc) return;
      this.ctx.diags.push(mkDiag(sev, loc.file, loc.line, loc.col, loc.endCol, msg, hint, code));
    }

    // ---------------------------------------------------------- symbols
    key(name) {
      const c = name[0];
      if (c === '.') return 'z' + this.ctx.zone + ':' + name;
      if (c === '@') return 'c' + this.ctx.cheap + ':' + name;
      return name;
    }
    define(name, val, loc, opts) {
      opts = opts || {};
      const ctx = this.ctx;
      const k = this.key(name);
      const old = this.symbols.get(k);
      if (!opts.isSet && ctx.definedThisPass.has(k) && old && old.def && val.def && old.v !== val.v && !old.isSet) {
        this.diag('error', loc, `Symbol '${name}' is already defined (value ${hexAuto(old.v)}).`,
          old.loc ? `First definition in line ${old.loc.line + 1}. Use a different name, or "!set" if the value is meant to change.` : 'Use a different name.', 'redefine');
        return;
      }
      if (!opts.isSet && old && old.def && val.def && old.v !== val.v && !ctx.definedThisPass.has(k)) ctx.changed = true;
      if (!opts.isSet && old && !old.def && val.def) ctx.changed = true;
      if (!opts.isSet && !old && val.def && ctx.pass > 1) ctx.changed = true;
      ctx.definedThisPass.add(k);
      const rec = old || { refs: 0 };
      rec.v = val.v; rec.def = val.def; rec.f16 = !!val.f16; rec.float = !!val.float;
      rec.isSet = !!opts.isSet || (old && old.isSet && ctx.definedThisPass.has(k) && false);
      if (opts.isSet) rec.isSet = true;
      rec.isLabel = !!opts.isLabel;
      if (!rec.loc || !opts.isSet) rec.loc = loc;
      rec.pass = ctx.pass;
      this.symbols.set(k, rec);
    }
    lookup(name, node) {
      const k = this.key(name);
      const s = this.symbols.get(k);
      if (s && s.def) {
        s.refs = (s.refs || 0) + 1;
        return { v: s.v, def: true, f16: s.f16, float: s.float, early: !this.ctx.definedThisPass.has(k) };
      }
      this.ctx.undefCount++;
      if (!this.ctx.missing) this.ctx.missing = [];
      this.ctx.missing.push({ name, node });
      return { v: 0, def: false, missing: name };
    }

    // ----------------------------------------------------------- eval
    eval(e) {
      const ctx = this.ctx;
      switch (e.k) {
        case 'num': return { v: e.v, def: true, f16: e.f16, float: e.float };
        case 'chr': {
          const ch = e.v;
          const v = ctx.convtab === 'pet' ? petscii(ch) : ctx.convtab === 'scr' ? screencode(ch) : ch.charCodeAt(0) & 0xff;
          return { v, def: true };
        }
        case 'str': return { v: e.v.length ? e.v.charCodeAt(0) : 0, def: true, isString: true };
        case 'pc':
          if (ctx.pc == null) return { v: 0, def: false, pcUnset: true };
          return { v: ctx.pc, def: true };
        case 'sym': {
          const r = this.lookup(e.name, e);
          if (!r.def) r.missing = e.name;
          return r;
        }
        case 'anon': return this.anonRef(e.name);
        case 'un': {
          const a = this.eval(e.a);
          if (!a.def) return { v: 0, def: false, missing: a.missing };
          let v = a.v;
          switch (e.op) {
            case 'neg': v = -v; break;
            case 'not': v = ~Math.trunc(v); break;
            case 'lo': v = Math.trunc(v) & 0xff; break;
            case 'hi': v = (Math.trunc(v) >> 8) & 0xff; break;
            case 'bank': v = (Math.trunc(v) >> 16) & 0xff; break;
          }
          return { v, def: true, float: e.op === 'neg' ? a.float : false };
        }
        case 'bin': {
          const a = this.eval(e.a), b = this.eval(e.b);
          if (!a.def || !b.def) return { v: 0, def: false, missing: a.missing || b.missing };
          const fl = a.float || b.float;
          const ia = Math.trunc(a.v), ib = Math.trunc(b.v);
          let v;
          switch (e.op) {
            case '^': v = Math.pow(a.v, b.v); if (!fl && b.v >= 0) v = Math.trunc(v); break;
            case '*': v = a.v * b.v; break;
            case '/':
              if (b.v === 0) { return { v: 0, def: true, divZero: true }; }
              v = fl ? a.v / b.v : Math.trunc(ia / ib); break;
            case 'DIV': if (ib === 0) return { v: 0, def: true, divZero: true }; v = Math.trunc(a.v / b.v); break;
            case '%': case 'MOD': if (ib === 0) return { v: 0, def: true, divZero: true }; v = ia % ib; break;
            case '+': v = a.v + b.v; break;
            case '-': v = a.v - b.v; break;
            case '<<': case 'ASL': case 'LSL': v = ia << ib; break;
            case '>>': case 'ASR': v = ia >> ib; break;
            case '>>>': case 'LSR': v = ia >>> ib; break;
            case '<=': v = a.v <= b.v ? 1 : 0; break;
            case '<': v = a.v < b.v ? 1 : 0; break;
            case '>=': v = a.v >= b.v ? 1 : 0; break;
            case '>': v = a.v > b.v ? 1 : 0; break;
            case '!=': case '<>': case '><': v = a.v !== b.v ? 1 : 0; break;
            case '=': case '==': v = a.v === b.v ? 1 : 0; break;
            case '&': case 'AND': v = ia & ib; break;
            case 'XOR': case 'EOR': v = ia ^ ib; break;
            case '|': case 'OR': v = ia | ib; break;
            default: v = 0;
          }
          const isFloat = fl && ['^', '*', '/', '+', '-'].includes(e.op);
          return { v, def: true, f16: a.f16 || b.f16, float: isFloat };
        }
        case 'fn': {
          const a = this.eval(e.a);
          if (!a.def) return a;
          const x = a.v; let v;
          switch (e.name) {
            case 'sin': v = Math.sin(x); break;
            case 'cos': v = Math.cos(x); break;
            case 'tan': v = Math.tan(x); break;
            case 'arcsin': v = Math.asin(x); break;
            case 'arccos': v = Math.acos(x); break;
            case 'arctan': v = Math.atan(x); break;
            case 'int': return { v: Math.trunc(x), def: true };
            case 'float': return { v: x, def: true, float: true };
            case 'address': case 'addr': return { v: x, def: true, f16: a.f16 };
            default: v = x;
          }
          return { v, def: true, float: true };
        }
        default: return { v: 0, def: false };
      }
    }

    anonRef(name) {
      const ctx = this.ctx;
      if (name[0] === '-') {
        const list = ctx.anonDefs.get(name);
        if (list && list.length) return { v: list[list.length - 1].v, def: true };
        ctx.undefCount++;
        return { v: 0, def: false, missing: name, anonBack: true };
      }
      const seq = ctx.seq;
      const prev = ctx.anonPrev.get(name);
      if (prev) for (const d of prev) if (d.seq > seq) return { v: d.v, def: true };
      ctx.undefCount++;
      return { v: 0, def: false, missing: name, anonFwd: true };
    }

    // reports value problems in the final pass only (caller decides)
    reportUndefined(val, loc) {
      if (val.def) return;
      if (val.pcUnset) return this.diag('error', loc, "Program counter is unset ('*' used before '* = address').", 'Set the start address first, e.g. "* = $0801" or "* = $c000".', 'pc');
      const name = val.missing;
      if (!name) return;
      if (name[0] === '+' || name[0] === '-') {
        return this.diag('error', loc, `Anonymous label '${name}' not found.`,
          name[0] === '+' ? `'${name}' refers to the NEXT line that starts with '${name}'. Add such a label below.` : `'${name}' refers to the PREVIOUS line that starts with '${name}'. Add such a label above.`, 'undef');
      }
      const names = [];
      for (const k of this.symbols.keys()) names.push(k.includes(':') ? k.split(':')[1] : k);
      const guess = closest(name, names.filter(n => n !== name), Math.min(3, Math.max(1, Math.floor(name.length / 3))));
      let hint = guess ? `Did you mean '${guess}'?` : `Define it, e.g. "${name} = $1000" or as a label in column 1.`;
      if (name[0] === '.') hint += ' Local symbols (".name") are only visible inside their !zone / macro.';
      if (name.toLowerCase() === 'a') hint = "ACME has no 'A' operand: write 'asl' / 'lsr' / 'rol' / 'ror' without an operand for accumulator mode.";
      if (name.toLowerCase() === 'x' || name.toLowerCase() === 'y') hint = `Index registers are written after a comma, e.g. "lda $0400,${name.toLowerCase()}".`;
      this.diag('error', loc, `Value not defined (${name}).`, hint, 'undef');
    }

    // ---------------------------------------------------------- emission
    emit(n, tag, loc, name) {
      const ctx = this.ctx;
      if (n <= 0) return;
      if (ctx.pc == null) {
        if (!ctx.reportedUnset) {
          ctx.reportedUnset = true;
          this.diag('error', loc, "Program counter is unset - where should this code go?",
            'Add a start address before the first instruction, e.g. "* = $0801" (BASIC start) or "* = $c000".', 'pc');
        }
        ctx.pc = 0; ctx.delta = 0; ctx.noRecord = true;
      }
      const real = ctx.pc - ctx.delta;
      if (!ctx.noRecord) {
        const last = ctx.ranges[ctx.ranges.length - 1];
        if (last && last.end === real && last.tag === tag && last.name === name && last.file === loc.file) last.end = real + n;
        else ctx.ranges.push({ start: real, end: real + n, tag, name: name || '', file: loc.file, line: loc.line });
      }
      if (real + n > 0x10000 && !ctx.overflowReported) {
        ctx.overflowReported = true;
        this.diag('error', loc, 'Program counter exceeds $FFFF.', 'The C64 has 64 KB of address space. Move code/data to lower addresses or make it smaller.', 'overflow');
      }
      ctx.pc += n;
    }

    recordLine(node) {
      const ctx = this.ctx;
      if (!node.loc) return;
      if (node.loc.file !== this.mainPath) return;
      if (!ctx.lineInfo.has(node.loc.line) && ctx.pc != null) ctx.lineInfo.set(node.loc.line, { addr: ctx.pc - ctx.delta, pc: ctx.pc });
    }

    // ------------------------------------------------------------ exec
    execList(list, file) {
      for (const node of list) {
        if (!node) continue;
        this.ctx.seq++;
        this.exec(node, file);
      }
    }

    exec(node, file) {
      const ctx = this.ctx;
      const loc = node.loc;
      this.recordLine(node);
      switch (node.k) {
        case 'label': {
          if (node.warn) this.diag('warning', loc, node.warn.msg, node.warn.hint, node.warn.code);
          if (node.invalid) return;
          if (node.kind === 'anon') {
            if (ctx.pc == null) return;
            let list = ctx.anonDefs.get(node.name);
            if (!list) { list = []; ctx.anonDefs.set(node.name, list); }
            list.push({ seq: ctx.seq, v: ctx.pc });
            return;
          }
          if (ctx.pc == null) {
            this.diag('error', loc, `Label '${node.name}' has no address - the program counter is unset.`, 'Set "* = $0801" (or another start address) before the first label.', 'pc');
            return;
          }
          if (node.kind === 'global') ctx.cheap++;
          this.define(node.name, { v: ctx.pc, def: true }, loc, { isLabel: true });
          if (node.loc.file === this.mainPath) ctx.labelsAt.push({ name: node.name, line: loc.line, addr: ctx.pc });
          return;
        }
        case 'assign': {
          const v = this.eval(node.expr);
          if (!v.def) this.reportUndefined(v, node.expr.loc || loc);
          this.define(node.name, v, loc, {});
          return;
        }
        case 'setpc': {
          const v = this.eval(node.expr);
          if (!v.def) { this.reportUndefined(v, node.expr.loc || loc); return; }
          if (v.v < 0 || v.v > 0xffff) {
            this.diag('error', loc, `Address ${v.v} is outside the C64 memory ($0000-$FFFF).`, 'Use a value between $0000 and $FFFF.', 'range');
            return;
          }
          ctx.pc = Math.trunc(v.v); ctx.delta = 0; ctx.noRecord = false;
          ctx.pcStatements.push({ addr: ctx.pc, loc });
          return;
        }
        case 'instr': return this.execInstr(node);
        case 'pseudo': return this.execPseudo(node, file);
        case 'macrodef': {
          const key = node.name + '/' + node.params.length;
          const existing = this.macros.get(key);
          if (existing && existing.node !== node && existing.pass === ctx.pass) {
            this.diag('error', loc, `Macro '${node.name}' is already defined.`, 'Rename one of the macros.', 'macro');
          }
          this.macros.set(key, { node, pass: ctx.pass });
          if (!this.macros.has(node.name)) this.macros.set(node.name, { node, pass: ctx.pass, any: true });
          else if (this.macros.get(node.name).any) this.macros.set(node.name, { node, pass: ctx.pass, any: true });
          return;
        }
        case 'macrocall': return this.execMacro(node);
      }
    }

    execInstr(node) {
      const ctx = this.ctx;
      const info = OPC.get(node.mn);
      const loc = node.loc;
      if (info.illegal && !ctx.illegalOk) {
        this.diag('error', loc, `'${node.mn.toLowerCase()}' is an undocumented (illegal) opcode.`,
          'Add "!cpu 6510" at the top of your source to allow illegal opcodes.', 'illegal');
      }
      if (ctx.cpuOther) { // 65c02/65816 etc: we only count bytes roughly
        this.emit(node.form === 'imp' ? 1 : node.form === 'imm' ? 2 : 3, 'code', loc);
        return;
      }
      const modes = info.modes;
      const has = m => !!modes[m];
      let val = node.expr ? this.eval(node.expr) : null;
      const opLoc = node.opLoc || loc;
      let mode = null;
      const mnl = node.mn.toLowerCase();
      const ORDER = ['imp', 'acc', 'imm', 'zp', 'zpx', 'zpy', 'abs', 'abx', 'aby', 'ind', 'izx', 'izy', 'rel'];
      const validForms = () => ORDER.filter(m => modes[m]).map(m => {
        if (m === 'imp' || m === 'acc') return mnl;
        if (m === 'rel') return mnl + ' label';
        return mnl + ' ' + OPC.MODES[m].syntax;
      }).join(', ');
      const modeError = (what, extraHint) => {
        this.diag('error', opLoc, `${node.mn} does not support ${what}.`,
          (extraHint ? extraHint + ' ' : '') + `Valid forms: ${validForms()}`, 'mode');
      };
      if (val && !val.def && ctx.pass === 1) this.firstUndef.add(node);
      const wasUndef1 = this.firstUndef.has(node);
      const fitsZp = v => v.def && v.v >= 0 && v.v <= 255 && !v.f16 && !v.float;
      const pick = (zpm, absm) => {
        const forceAbs = node.postfix === 2 || node.postfix === 3;
        const forceZp = node.postfix === 1;
        if (forceZp && has(zpm)) return zpm;
        if (!forceAbs && has(zpm) && fitsZp(val) && !(wasUndef1 && has(absm))) return zpm;
        if (has(absm)) {
          if (wasUndef1 && has(zpm) && fitsZp(val) && !forceAbs && ctx.pass > 1 && val && val.def && !val.f16) node.oversized = true;
          return absm;
        }
        if (has(zpm)) return zpm;
        return null;
      };
      switch (node.form) {
        case 'imp':
          if (has('imp')) mode = 'imp';
          else if (has('acc')) mode = 'acc';
          else { this.diag('error', loc, `${node.mn} needs an operand.`, `Valid forms: ${validForms()}`, 'mode'); mode = Object.keys(modes)[0]; }
          break;
        case 'imm':
          if (has('imm')) mode = 'imm';
          else {
            let extra = '';
            if (['STA', 'STX', 'STY'].includes(node.mn)) extra = 'Store instructions write to memory, so they need an address (no "#").';
            else if (['JMP', 'JSR'].includes(node.mn)) extra = 'Jump targets are written without "#".';
            else if (info.modes.rel) extra = 'Branch targets are labels, written without "#".';
            else if (['INC', 'DEC'].includes(node.mn)) extra = 'INC/DEC change memory; for registers use INX/INY/DEX/DEY.';
            modeError('immediate addressing (#)', extra);
            mode = 'abs';
          }
          break;
        case 'plain':
          if (node.accA && has('acc')) {
            const s = this.symbols.get('a') || this.symbols.get('A');
            if (!s || !s.def) {
              this.diag('error', opLoc, `ACME does not accept '${mnl} a'.`, `Write just '${mnl}' (without operand) for accumulator mode.`, 'acc');
              mode = 'acc'; val = null; break;
            }
          }
          if (has('rel')) { mode = 'rel'; break; }
          mode = pick('zp', 'abs');
          if (!mode) {
            if (has('imm')) modeError('this addressing mode', `Did you mean '${mnl} #...' (immediate)?`);
            else if (has('imp') || has('acc')) {
              this.diag('error', opLoc, `${node.mn} takes no operand.`, `Write just '${mnl}'. ${info.title}.`, 'mode');
              mode = has('imp') ? 'imp' : 'acc'; val = null; break;
            } else modeError('this addressing mode');
            mode = Object.keys(modes)[0];
          }
          break;
        case 'x':
          mode = pick('zpx', 'abx');
          if (!mode) {
            let extra = '';
            if (has('zpy') || has('aby')) extra = `${node.mn} can only be indexed with Y.`;
            modeError('indexing with X', extra); mode = 'abs';
          }
          break;
        case 'y':
          mode = pick('zpy', 'aby');
          if (!mode) {
            let extra = '';
            if (has('zpx') || has('abx')) extra = `${node.mn} with a zero page address can only be indexed with X.`;
            modeError('indexing with Y', extra); mode = 'abs';
          }
          break;
        case 'ind':
          if (has('ind')) mode = 'ind';
          else if (has('izy') || has('izx')) { modeError('indirect addressing without index', 'On the 6502 indirect access needs an index: use ($nn),y with Y = 0.'); mode = 'izy'; }
          else { modeError('indirect addressing'); mode = 'abs'; }
          break;
        case 'izx':
          if (has('izx')) mode = 'izx'; else { modeError('indexed indirect addressing ($nn,x)'); mode = 'abs'; }
          break;
        case 'izy':
          if (has('izy')) mode = 'izy'; else { modeError('indirect indexed addressing ($nn),y'); mode = 'abs'; }
          break;
        case 'badindx':
          this.diag('error', opLoc, '($nn),x does not exist on the 6502.', 'Use ($nn,x) (indexed indirect) or ($nn),y (indirect indexed).', 'mode');
          mode = 'izx'; break;
        case 'badiny':
          this.diag('error', opLoc, '($nn,y) does not exist on the 6502.', 'Use ($nn),y (indirect indexed) instead.', 'mode');
          mode = 'izy'; break;
      }
      const addr = ctx.pc;
      const size = OPC.sizeOf(mode);
      // value checks
      if (val) {
        if (!val.def) this.reportUndefined(val, opLoc);
        else if (val.divZero) this.diag('error', opLoc, 'Division by zero.', '', 'div');
        else {
          const v = Math.trunc(val.v);
          if (mode === 'imm' && (v < -128 || v > 255)) {
            this.diag('error', opLoc, `Number out of range: ${v} (${hexAuto(v)}) does not fit into 8 bits.`,
              'Immediate values must be -128..255. Use #<value for the low byte or #>value for the high byte.', 'range');
          } else if ((mode === 'zp' || mode === 'zpx' || mode === 'zpy') && (v < 0 || v > 255)) {
            this.diag('error', opLoc, `Zero page address out of range: ${hexAuto(v)}.`, 'Zero page addresses are $00-$FF.', 'range');
          } else if ((mode === 'izx' || mode === 'izy') && (v < 0 || v > 255)) {
            this.diag('error', opLoc, `Pointer ${hexAuto(v)} is not in the zero page.`,
              'Indirect addressing needs a 2-byte pointer in the zero page ($00-$FF), e.g. ($fb),y. Store your address there first.', 'range');
          } else if ((mode === 'abs' || mode === 'abx' || mode === 'aby' || mode === 'ind') && (v < 0 || v > 0xffff)) {
            this.diag('error', opLoc, `Address out of range: ${v}.`, 'Addresses must be between $0000 and $FFFF.', 'range');
          } else if (mode === 'rel' && addr != null) {
            const dist = v - (addr + 2);
            if (dist < -128 || dist > 127) {
              const inv = { BNE: 'beq', BEQ: 'bne', BCC: 'bcs', BCS: 'bcc', BMI: 'bpl', BPL: 'bmi', BVC: 'bvs', BVS: 'bvc' }[node.mn];
              this.diag('error', opLoc, `Branch target out of range: ${dist > 0 ? '+' : ''}${dist} bytes (allowed: -128..+127).`,
                `The target is ${dist > 0 ? dist - 127 : -128 - dist} bytes too far away. Fix: invert the branch and use JMP:  ${inv} +  /  jmp target  /  + (next line)`, 'branch');
            }
          } else if (mode === 'ind' && (v & 0xff) === 0xff) {
            this.diag('warning', opLoc, `JMP (${hex4(v)}) triggers the 6502 page bug.`,
              `The high byte is read from ${hex4(v & 0xff00)} instead of ${hex4(v + 1)}. Move the pointer so it does not start at $xxFF.`, 'jmpbug');
          }
          if ((node.mn === 'ANE' || node.mn === 'LXA') && v !== 0) {
            this.diag('warning', opLoc, `${node.mn} with a non-zero argument is unstable.`, `Only ${node.mn.toLowerCase()} #0 gives reliable results.`, 'unstable');
          }
          if (node.oversized) {
            this.diag('info', opLoc, 'Using oversized addressing mode (16 bit for a zero page value).',
              'The symbol is defined after its first use. Define zero page symbols before using them, or add "+1" to the mnemonic to force zero page.', 'oversized');
          }
        }
      }
      this.emit(size, 'code', loc);
      if (ctx.pc != null) {
        ctx.instrs.push({ addr, mn: node.mn, mode, size, value: val && val.def ? Math.trunc(val.v) : null, valueDef: !!(val && val.def), loc, form: node.form, expr: node.expr });
      }
    }

    execPseudo(node, file) {
      const ctx = this.ctx;
      const loc = node.loc;
      const n = node.name;
      const def = OPC.PSEUDO[n];
      if (def && def.obsolete) this.diag('warning', loc, `${node.raw} is obsolete.`, def.desc, 'obsolete');
      const evalArg = a => {
        if (!a || a.k === 'empty') return { v: 0, def: false };
        if (a.k === 'str') return { v: a.v.length ? a.v.charCodeAt(0) : 0, def: true, isString: true };
        return this.eval(a);
      };
      const dataOp = (bytes, lo, hi) => {
        if (!node.args.length) { this.diag('error', loc, `${node.raw} needs at least one value.`, `Example: ${def.example || n + ' 0'}`, 'syntax'); return; }
        for (const a of node.args) {
          if (a.k === 'empty') { this.diag('error', loc, `Empty value in ${node.raw}.`, 'Remove the extra comma.', 'syntax'); continue; }
          if (a.k === 'str' && a.v.length > 1) {
            this.diag('error', a.loc, `${node.raw} does not accept strings.`, 'Use !text, !pet or !scr for strings.', 'syntax'); continue;
          }
          const v = evalArg(a);
          if (!v.def) this.reportUndefined(v, a.loc || loc);
          else if (lo != null) {
            const iv = Math.trunc(v.v);
            if (iv < lo || iv > hi) this.diag('error', a.loc || loc, `Number out of range: ${iv} (${hexAuto(iv)}) does not fit into ${bytes * 8} bits.`,
              bytes === 1 ? 'Byte values must be -128..255. Use <value / >value to get low / high bytes.' : `Allowed range: ${lo}..${hi}.`, 'range');
          }
        }
        this.emit(node.args.length * bytes, 'data', loc);
      };
      const withBlock = (fn) => {
        if (!node.block) return;
        fn(); this.execList(node.block, file);
      };
      switch (n) {
        case '!byte': return dataOp(1, -128, 255);
        case '!word': case '!le16': case '!be16': return dataOp(2, -32768, 65535);
        case '!24': case '!le24': case '!be24': return dataOp(3, -8388608, 16777215);
        case '!32': case '!le32': case '!be32': return dataOp(4, null, null);
        case '!hex': {
          const txt = (node.hexText || '').replace(/\s+/g, '');
          if (!/^[0-9a-fA-F]*$/.test(txt)) { this.diag('error', loc, '!hex accepts only hex digits.', 'Example: !hex 01 02 a9 ff', 'syntax'); return; }
          if (txt.length % 2) this.diag('error', loc, 'Hex digits are not given in pairs.', 'Every byte needs two digits, e.g. "0f" instead of "f".', 'syntax');
          this.emit(txt.length >> 1, 'data', loc); return;
        }
        case '!fill': {
          if (!node.args.length) { this.diag('error', loc, '!fill needs an amount.', 'Example: !fill 64, 0', 'syntax'); return; }
          const a = evalArg(node.args[0]);
          if (!a.def) { this.reportUndefined(a, node.args[0].loc || loc); return; }
          if (a.v < 0) { this.diag('error', loc, 'Negative size argument.', '', 'range'); return; }
          if (node.args[1]) { const f = evalArg(node.args[1]); if (f.def && (f.v < -128 || f.v > 255)) this.diag('error', node.args[1].loc || loc, 'Fill value does not fit into a byte.', '', 'range'); }
          this.emit(Math.trunc(a.v), 'data', loc); return;
        }
        case '!skip': {
          const a = evalArg(node.args[0]);
          if (!a.def) { this.reportUndefined(a, loc); return; }
          if (ctx.pc == null) { this.emit(0, 'data', loc); return; }
          ctx.pc += Math.trunc(a.v); return;
        }
        case '!align': {
          if (node.args.length < 2) { this.diag('error', loc, '!align needs ANDVALUE, EQUALVALUE.', 'Example: !align 255, 0  (align to the next page)', 'syntax'); return; }
          const a = evalArg(node.args[0]), b = evalArg(node.args[1]);
          if (!a.def || !b.def) { this.reportUndefined(a.def ? b : a, loc); return; }
          if (ctx.pc == null) { this.emit(1, 'data', loc); return; }
          let k = 0;
          while (((ctx.pc + k) & a.v) !== b.v && k < 0x10000) k++;
          this.emit(k, 'data', loc); return;
        }
        case '!text': case '!pet': case '!raw': case '!scr': case '!scrxor': {
          let args = node.args;
          if (n === '!scrxor') {
            if (!args.length) { this.diag('error', loc, '!scrxor needs XOR, STRING.', 'Example: !scrxor $80, "text"', 'syntax'); return; }
            const x = evalArg(args[0]); if (!x.def) this.reportUndefined(x, loc);
            args = args.slice(1);
          }
          if (!args.length) { this.diag('error', loc, `${node.raw} needs a string.`, `Example: ${node.raw} "hello"`, 'syntax'); return; }
          let size = 0;
          for (const a of args) {
            if (a.k === 'str') size += a.v.length;
            else if (a.k === 'empty') this.diag('error', loc, `Empty value in ${node.raw}.`, '', 'syntax');
            else {
              const v = evalArg(a);
              if (!v.def) this.reportUndefined(v, a.loc || loc);
              else if (v.v < -128 || v.v > 255) this.diag('error', a.loc || loc, 'Number out of range (byte expected).', '', 'range');
              size += 1;
            }
          }
          this.emit(size, 'data', loc); return;
        }
        case '!to': {
          const a = node.args[0];
          if (!a || a.k !== 'str') { this.diag('error', loc, 'File name quotes not found.', 'Example: !to "demo.prg", cbm', 'syntax'); return; }
          let fmt = 'cbm';
          if (node.args[1]) {
            const f = node.args[1];
            fmt = f.k === 'sym' ? f.name.toLowerCase() : '?';
            if (!['cbm', 'plain', 'apple'].includes(fmt)) this.diag('error', f.loc || loc, 'Unknown output format.', 'Use cbm (C64 .prg with load address), plain or apple.', 'syntax');
          } else this.diag('warning', loc, 'Used "!to" without file format indicator. Defaulting to "cbm".', 'Write !to "' + a.v + '", cbm', 'to');
          ctx.outputs.push({ name: a.v, format: fmt, loc }); return;
        }
        case '!source': {
          const a = node.args[0];
          if (!a || a.k !== 'str') { this.diag('error', loc, 'File name quotes not found.', 'Example: !source "macros.a"', 'syntax'); return; }
          const src = this.io.readSource ? this.io.readSource(a.v, file, !!a.lib) : null;
          if (!src) { this.diag('error', loc, `Cannot open input file "${a.v}".`, 'Check the file name and that the file is in the same folder as this source (or in a library folder).', 'file'); return; }
          if (ctx.depth > 32) { this.diag('error', loc, 'Too deeply nested. Recursive "!source"?', '', 'file'); return; }
          const entry = this.parseFile(src.path, src.text);
          ctx.files.add(src.path);
          ctx.depth++;
          const savedZone = ctx.zone;
          try { this.execList(entry.ast, src.path); } catch (e) { if (!e.eof) throw e; }
          ctx.depth--;
          ctx.zone = savedZone;
          return;
        }
        case '!binary': {
          const a = node.args[0];
          if (!a || a.k !== 'str') { this.diag('error', loc, 'File name quotes not found.', 'Example: !bin "music.sid",, $7e', 'syntax'); return; }
          const info = this.io.binaryInfo ? this.io.binaryInfo(a.v, file, !!a.lib) : null;
          let size = null, skip = 0;
          const sArg = node.args[1], kArg = node.args[2];
          if (sArg && sArg.k !== 'empty') { const v = evalArg(sArg); if (v.def) size = Math.trunc(v.v); else this.reportUndefined(v, loc); }
          if (kArg && kArg.k !== 'empty') { const v = evalArg(kArg); if (v.def) skip = Math.trunc(v.v); else this.reportUndefined(v, loc); }
          if (!info) {
            this.diag('error', loc, `Cannot open input file "${a.v}".`, 'Check the file name and that the file is in the same folder as this source.', 'file');
            if (size != null) this.emit(size, 'bin', loc, a.v);
            return;
          }
          if (size == null) size = Math.max(0, info.size - skip);
          if (skip > info.size) this.diag('error', loc, `Skip value (${skip}) is larger than the file (${info.size} bytes).`, '', 'file');
          if (size + skip > info.size) this.diag('warning', loc, `Requested ${size} bytes but the file only has ${info.size - skip} bytes after skipping.`, '', 'file');
          const addr = ctx.pc == null ? null : ctx.pc - ctx.delta;
          ctx.binaries.push({ name: a.v, path: info.path, addr, size, skip, fileSize: info.size, explicitSize: !!(sArg && sArg.k !== 'empty'), sid: info.sid || null, kla: info.kla || false, loc });
          this.emit(Math.min(size, Math.max(0, info.size - skip)) || size, 'bin', loc, baseName(a.v));
          return;
        }
        case '!zone': case '!subzone': {
          const saved = ctx.zone;
          ctx.zone = ++ctx.zoneCounter;
          if (node.block) { this.execList(node.block, file); ctx.zone = saved; }
          return;
        }
        case '!symbollist': case '!initmem': case '!al': case '!as': case '!rl': case '!rs':
          if (node.block) this.execList(node.block, file);
          return;
        case '!convtab': {
          const w = (node.word || '').toLowerCase();
          const saved = ctx.convtab;
          if (['raw', 'pet', 'scr'].includes(w)) ctx.convtab = w;
          if (node.block) { this.execList(node.block, file); ctx.convtab = saved; }
          return;
        }
        case '!xor': case '!address':
          if (node.block) this.execList(node.block, file);
          return;
        case '!cpu': {
          const w = (node.word || '').toLowerCase();
          const known = ['6502', '6510', 'nmos6502', '65c02', 'r65c02', 'w65c02', '65816', '65ce02', '4502', 'm65', 'c64dtv2'];
          if (!known.includes(w)) this.diag('error', loc, `Unknown processor '${node.word}'.`, 'For the C64 use "!cpu 6510" (with illegal opcodes) or "!cpu 6502".', 'cpu');
          const saved = [ctx.illegalOk, ctx.cpuOther, ctx.cpuName];
          ctx.cpuName = w;
          ctx.illegalOk = ['6510', 'nmos6502', 'c64dtv2'].includes(w);
          ctx.cpuOther = !['6502', '6510', 'nmos6502', 'c64dtv2'].includes(w) && known.includes(w);
          if (node.block) { this.execList(node.block, file); [ctx.illegalOk, ctx.cpuOther, ctx.cpuName] = saved; }
          return;
        }
        case '!if': {
          const c = evalArg(node.args[0]);
          if (!node.args.length) { this.diag('error', loc, '!if needs a condition.', 'Example: !if DEBUG = 1 { ... }', 'syntax'); return; }
          this.checkEq(node.args[0]);
          if (!c.def) { this.reportUndefined(c, node.args[0].loc || loc); return; }
          if (c.v) { if (node.block) this.execList(node.block, file); }
          else if (node.elseBlock) this.execList(node.elseBlock, file);
          return;
        }
        case '!ifdef': case '!ifndef': {
          const k = this.key(node.symbol);
          const isDef = ctx.definedThisPass.has(k) || (this.symbols.has(k) && this.symbols.get(k).def && this.symbols.get(k).pass < ctx.pass && false);
          const cond = n === '!ifdef' ? isDef : !isDef;
          if (cond) { if (node.block) this.execList(node.block, file); }
          else if (node.elseBlock) this.execList(node.elseBlock, file);
          return;
        }
        case '!for': {
          const args = node.args;
          if (args.length < 2 || args[0].k !== 'sym') { this.diag('error', loc, '!for needs SYMBOL, START, END.', 'Example: !for i, 0, 7 { !byte i * 2 }', 'syntax'); return; }
          let start, end;
          if (args.length === 2) {
            const e = evalArg(args[1]);
            if (!e.def) { this.reportUndefined(e, loc); return; }
            start = 1; end = Math.trunc(e.v);
            this.diag('info', loc, 'Old "!for" syntax (counting from 1).', 'Newer ACME versions prefer "!for SYMBOL, START, END { }".', 'oldfor');
            if (end < 1) return;
          } else {
            const s = evalArg(args[1]), e = evalArg(args[2]);
            if (!s.def || !e.def) { this.reportUndefined(s.def ? e : s, loc); return; }
            start = Math.trunc(s.v); end = Math.trunc(e.v);
          }
          const step = end >= start ? 1 : -1;
          let guard = 0;
          for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
            this.define(args[0].name, { v: i, def: true }, loc, { isSet: true });
            if (node.block) this.execList(node.block, file);
            if (++guard > 70000) { this.diag('error', loc, 'Loop runs too often (> 70000 times).', '', 'loop'); break; }
          }
          return;
        }
        case '!set': {
          const v = evalArg(node.args[0]);
          if (!v.def) this.reportUndefined(v, node.args[0].loc || loc);
          this.define(node.symbol, v, node.symLoc || loc, { isSet: true });
          return;
        }
        case '!do': case '!while': {
          let guard = 0;
          const test = (c) => {
            if (!c) return true;
            const v = this.eval(c.expr);
            if (!v.def) { this.reportUndefined(v, loc); return false; }
            return c.kw === 'while' ? !!v.v : !v.v;
          };
          if (n === '!while') {
            const c = { kw: 'while', expr: node.args[0] };
            while (test(c)) { if (node.block) this.execList(node.block, file); if (++guard > 70000) { this.diag('error', loc, 'Endless loop?', '', 'loop'); break; } }
            return;
          }
          for (;;) {
            if (!test(node.pre)) break;
            if (node.block) this.execList(node.block, file);
            if (!test(node.post)) break;
            if (++guard > 70000) { this.diag('error', loc, 'Endless loop? !do ran more than 70000 times.', 'Check the while/until condition.', 'loop'); break; }
          }
          return;
        }
        case '!endoffile': { const e = new Error('eof'); e.eof = true; throw e; }
        case '!warn': case '!error': case '!serious': {
          const msg = node.args.map(a => a.k === 'str' ? a.v : (() => { const v = evalArg(a); return v.def ? String(v.v) : '?'; })()).join('');
          this.diag(n === '!warn' ? 'warning' : 'error', loc, `${node.raw}: ${msg}`, 'This message comes from your own source code.', 'user');
          if (n === '!serious') { const e = new Error('serious'); e.serious = true; throw e; }
          return;
        }
        case '!pseudopc': {
          const v = evalArg(node.args[0]);
          if (!v.def) { this.reportUndefined(v, loc); if (node.block) this.execList(node.block, file); return; }
          if (ctx.pc == null) { this.diag('error', loc, 'Program counter is unset.', 'Set "* = address" before !pseudopc.', 'pc'); return; }
          const real = ctx.pc - ctx.delta;
          const savedDelta = ctx.delta;
          ctx.delta = Math.trunc(v.v) - real;
          ctx.pc = Math.trunc(v.v);
          if (node.block) this.execList(node.block, file);
          const realAfter = ctx.pc - ctx.delta;
          ctx.delta = savedDelta;
          ctx.pc = realAfter + savedDelta;
          return;
        }
        case '!realpc': return;
        case '!cbm': ctx.convtab = 'pet'; return;
        default: return;
      }
    }

    checkEq(e) {
      if (!e || typeof e !== 'object') return;
      if (e.k === 'bin' && e.op === '==') this.diag('info', e.loc || this.ctx.lastLoc, 'C-style "==" comparison detected.', 'ACME uses a single "=" for comparisons.', 'eq');
    }

    execMacro(node) {
      const ctx = this.ctx;
      const loc = node.loc;
      const m = this.macros.get(node.name + '/' + node.args.length) || this.macros.get(node.name);
      if (!m) {
        const names = [...this.macros.keys()].filter(k => !k.includes('/'));
        const guess = closest(node.name, names, 2);
        this.diag('error', loc, `Macro '${node.name}' is not defined (or wrong number of arguments).`,
          guess ? `Did you mean '+${guess}'?` : 'Define it first: !macro ' + node.name + ' .param { ... }', 'macro');
        ctx.undefCount++;
        return;
      }
      const def = m.node;
      if (def.params.length !== node.args.length) {
        this.diag('error', loc, `Macro '${node.name}' expects ${def.params.length} argument(s), got ${node.args.length}.`,
          `Definition in line ${def.loc.line + 1}: !macro ${def.name} ${def.params.map(p => p.name).join(', ')}`, 'macro');
        return;
      }
      if (ctx.depth > 60) { this.diag('error', loc, 'Too deeply nested. Recursive macro calls?', '', 'macro'); return; }
      const vals = node.args.map(a => a.k === 'str' ? { v: a.v.length ? a.v.charCodeAt(0) : 0, def: true } : this.eval(a));
      vals.forEach((v, i) => { if (!v.def) this.reportUndefined(v, node.args[i].loc || loc); });
      const savedZone = ctx.zone;
      ctx.zone = ++ctx.zoneCounter;
      def.params.forEach((p, i) => this.define(p.name, vals[i], loc, { isSet: true }));
      ctx.depth++;
      this.execList(def.body, def.loc.file);
      ctx.depth--;
      ctx.zone = savedZone;
    }
  }

  function baseName(p) { return String(p).split(/[\\/]/).pop(); }

  function dedupe(diags) {
    const seen = new Set(); const out = [];
    for (const d of diags) {
      const k = d.file + '|' + d.line + '|' + d.col + '|' + d.message;
      if (seen.has(k)) continue;
      seen.add(k); out.push(d);
    }
    return out;
  }

  function buildSegments(ranges) {
    // merge adjacent ranges into segments (keep binaries separate)
    const out = [];
    const sorted = ranges.slice().sort((a, b) => a.start - b.start || a.end - b.end);
    for (const r of sorted) {
      const last = out[out.length - 1];
      const kind = r.tag === 'bin' ? 'bin' : 'code';
      if (last && last.kind === kind && kind !== 'bin' && r.start <= last.end && r.start >= last.start) {
        last.end = Math.max(last.end, r.end);
        last.parts.push(r);
      } else out.push({ start: r.start, end: r.end, kind, name: r.name || '', parts: [r], file: r.file, line: r.line });
    }
    return out;
  }

  // ----------------------------------------------------------- SID header
  function parseSidHeader(bytes) {
    if (!bytes || bytes.length < 0x76) return null;
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== 'PSID' && magic !== 'RSID') return null;
    const w = o => (bytes[o] << 8) | bytes[o + 1];
    const str = o => { let s = ''; for (let i = 0; i < 32; i++) { const c = bytes[o + i]; if (!c) break; s += String.fromCharCode(c); } return s; };
    const version = w(4), dataOffset = w(6);
    let load = w(8);
    if (load === 0 && bytes.length > dataOffset + 1) load = bytes[dataOffset] | (bytes[dataOffset + 1] << 8);
    const dataLen = bytes.length - dataOffset - (w(8) === 0 ? 2 : 0);
    return {
      type: magic, version, dataOffset, loadAddress: load, initAddress: w(0x0a) || load, playAddress: w(0x0c),
      songs: w(0x0e), startSong: w(0x10), speed: (bytes[0x12] << 24) | (bytes[0x13] << 16) | (bytes[0x14] << 8) | bytes[0x15],
      name: str(0x16), author: str(0x36), released: str(0x56),
      dataSize: dataLen, endAddress: load + dataLen - 1,
      skip: dataOffset + (w(8) === 0 ? 2 : 0)
    };
  }

  // ------------------------------------------------- standalone evaluation
  function evaluate(text, symbols, pc) {
    const lexed = lex(text, 'expr');
    const p = new Parser(lexed, 'expr');
    const toks = lexed.toks.filter(t => t.t !== 'nl' && t.t !== 'eof');
    if (!toks.length) return { ok: false, error: 'empty' };
    try {
      if (lexed.diags.length) return { ok: false, error: lexed.diags[0].message };
      const e = p.expr(toks, toks[0]);
      const asm = new Assembler({});
      asm.symbols = symbols instanceof Map ? symbols : new Map();
      asm.ctx = { pc: pc == null ? null : pc, delta: 0, zone: 0, cheap: 0, convtab: 'raw', definedThisPass: new Set(), anonDefs: new Map(), anonPrev: new Map(), seq: 0, undefCount: 0 };
      const v = asm.eval(e);
      if (!v.def) return { ok: false, error: v.missing ? `Unknown symbol '${v.missing}'` : 'undefined' };
      return { ok: true, value: v.v, float: !!v.float };
    } catch (err) {
      return { ok: false, error: p.diags.length ? p.diags[p.diags.length - 1].message : String(err.message || err) };
    }
  }

  return { lex, Parser, Assembler, parseSidHeader, evaluate, levenshtein, closest, hex2, hex4, hexAuto, petscii, screencode, FOREIGN };
});
