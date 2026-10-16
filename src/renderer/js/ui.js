/*
 * C64 ACME EDITOR - small UI helpers (DOM, modals, toasts, tooltip)
 * (c) IT-Dummköpfe - MIT License
 */
(function () {
  'use strict';
  const UI = {};

  UI.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  UI.el = (tag, attrs, ...children) => {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (k === 'style') e.setAttribute('style', v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  };

  UI.toast = (text, kind, ms) => {
    const t = UI.el('div', { class: 'toast ' + (kind || '') }, text);
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.remove(), ms || 4200);
  };

  // modal({ title, subtitle, body: Node|string, buttons: [{label, primary, value, onClick}], wide })
  // returns a Promise with the value of the pressed button (or null on Escape)
  UI.modal = (opts) => new Promise((resolve) => {
    const root = document.getElementById('modalRoot');
    const prevFocus = document.activeElement;
    const back = UI.el('div', { class: 'modal-backdrop' });
    const box = UI.el('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title });
    const head = UI.el('header', null, UI.el('h2', { text: opts.title }), opts.subtitle ? UI.el('p', { text: opts.subtitle }) : null);
    const body = UI.el('div', { class: 'body' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    const foot = UI.el('footer');
    let done = false;
    const close = (val) => {
      if (done) return; done = true;
      back.remove();
      document.removeEventListener('keydown', onKey, true);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(val);
    };
    for (const b of (opts.buttons || [{ label: 'Close', value: null, primary: true }])) {
      const btn = UI.el('button', { class: 'btn' + (b.primary ? ' primary' : '') }, b.label);
      btn.addEventListener('click', async () => {
        if (b.onClick) {
          const r = await b.onClick(close, btn);
          if (r === false) return;
        }
        close(b.value === undefined ? b.label : b.value);
      });
      foot.appendChild(btn);
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
      if (e.key === 'Enter' && opts.enterValue !== undefined && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); close(opts.enterValue); }
    };
    document.addEventListener('keydown', onKey, true);
    box.append(head, body, foot);
    back.appendChild(box);
    back.addEventListener('mousedown', (e) => { if (e.target === back && !opts.sticky) close(null); });
    root.appendChild(back);
    UI.modalApi = { close, body, box };
    const first = body.querySelector('input,select,textarea,button') || foot.querySelector('.primary');
    if (first) setTimeout(() => first.focus(), 30);
    if (opts.onOpen) opts.onOpen({ body, close, box });
  });

  UI.confirm = async (title, text, okLabel) => {
    const r = await UI.modal({ title, body: UI.el('p', { text }), buttons: [{ label: 'Cancel', value: false }, { label: okLabel || 'OK', value: true, primary: true }] });
    return r === true;
  };

  UI.prompt = async (title, label, value, help) => {
    const input = UI.el('input', { type: 'text', value: value || '', style: 'width:100%' });
    const body = UI.el('div', null, UI.el('label', { text: label }), UI.el('div', { style: 'height:6px' }), input, help ? UI.el('p', { class: 'help', style: 'color:var(--muted);font-size:12px', text: help }) : null);
    const r = await UI.modal({ title, body, enterValue: 'ok', buttons: [{ label: 'Cancel', value: null }, { label: 'OK', value: 'ok', primary: true }] });
    return r === 'ok' ? input.value : null;
  };

  // ------------------------------------------------------------- tooltip
  const tip = () => document.getElementById('tooltip');
  UI.showTip = (html, x, y) => {
    const t = tip();
    t.innerHTML = html;
    t.classList.remove('hidden');
    const r = t.getBoundingClientRect();
    let left = x + 14, top = y + 18;
    if (left + r.width > window.innerWidth - 8) left = window.innerWidth - r.width - 8;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 10;
    t.style.left = left + 'px'; t.style.top = top + 'px';
  };
  UI.hideTip = () => tip().classList.add('hidden');

  // ------------------------------------------------------------- numbers
  UI.hex = (v, digits) => '$' + (v >>> 0).toString(16).padStart(digits || (v > 255 ? 4 : 2), '0');
  UI.bin = (v, bits) => '%' + (v >>> 0).toString(2).padStart(bits || 8, '0');
  UI.parseNum = (s) => {
    s = String(s).trim();
    if (!s) return NaN;
    if (/^\$[0-9a-f]+$/i.test(s)) return parseInt(s.slice(1), 16);
    if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s.slice(2), 16);
    if (/^%[01]+$/.test(s)) return parseInt(s.slice(1), 2);
    if (/^0b[01]+$/i.test(s)) return parseInt(s.slice(2), 2);
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    return NaN;
  };

  window.UI = UI;
})();
