/* ==========================================================================
   YARBIS - MOTOR MATEMÁTICO SEGURO
   Analizador por descenso recursivo. NO usa eval() ni Function().
   Soporta: + - * / ^ % ! paréntesis, multiplicación implícita, funciones
   (sqrt, cbrt, abs, sin, cos, tan, log, ln, exp, round, floor, ceil, min, max)
   y frases en español ("cuánto es 5 más 3", "15% de 200", "2 elevado a 10").
   ========================================================================== */

(function (root) {
  'use strict';

  const FUNCTIONS = {
    sqrt: Math.sqrt,
    raiz: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    sin: Math.sin,
    sen: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    log: Math.log10,
    ln: Math.log,
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
    round: (x, d = 0) => {
      const f = Math.pow(10, Math.round(d));
      return Math.round(x * f) / f;
    },
    min: Math.min,
    max: Math.max
  };

  const CONSTANTS = { pi: Math.PI, e: Math.E };

  class ParseError extends Error {}

  function tokenize(input) {
    const tokens = [];
    let i = 0;
    const s = input;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }

      const num = s.slice(i).match(/^(\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
      if (num && /[\d.]/.test(ch)) {
        // Evita confundir "2e" (2 * e) con notación científica incompleta
        tokens.push({ type: 'num', value: parseFloat(num[0]) });
        i += num[0].length;
        continue;
      }

      const ident = s.slice(i).match(/^[a-z]+/i);
      if (ident) {
        tokens.push({ type: 'id', value: ident[0].toLowerCase() });
        i += ident[0].length;
        continue;
      }

      if (s.startsWith('**', i)) { tokens.push({ type: 'op', value: '^' }); i += 2; continue; }
      if ('+-*/^%(),!'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i++; continue; }
      if (ch === '×' || ch === '·') { tokens.push({ type: 'op', value: '*' }); i++; continue; }
      if (ch === '÷') { tokens.push({ type: 'op', value: '/' }); i++; continue; }
      if (ch === '−') { tokens.push({ type: 'op', value: '-' }); i++; continue; }

      throw new ParseError(`Carácter no válido: ${ch}`);
    }
    return tokens;
  }

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n) || n > 170) throw new ParseError('Factorial inválido');
    let r = 1;
    for (let k = 2; k <= n; k++) r *= k;
    return r;
  }

  function parse(tokens) {
    let pos = 0;
    let operators = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const isOp = (v) => peek() && peek().type === 'op' && peek().value === v;

    // Cada nivel devuelve { v: número, pct: si es un porcentaje "suelto" }
    function expression() {
      let left = term();
      while (isOp('+') || isOp('-')) {
        const op = next().value;
        operators++;
        const right = term();
        // 200 + 10% => 220 (comportamiento de calculadora)
        const delta = right.pct ? left.v * right.v : right.v;
        left = { v: op === '+' ? left.v + delta : left.v - delta, pct: false };
      }
      return left;
    }

    function startsFactor() {
      const t = peek();
      if (!t) return false;
      if (t.type === 'num' || t.type === 'id') return true;
      return t.type === 'op' && t.value === '(';
    }

    function term() {
      let left = unary();
      while (true) {
        if (isOp('*') || isOp('/')) {
          const op = next().value;
          operators++;
          const right = unary();
          if (op === '/') {
            if (right.v === 0) throw new ParseError('División entre cero');
            left = { v: left.v / right.v, pct: false };
          } else {
            left = { v: left.v * right.v, pct: false };
          }
        } else if (startsFactor()) {
          // Multiplicación implícita: 2(3+1), 2pi
          operators++;
          const right = unary();
          left = { v: left.v * right.v, pct: false };
        } else {
          break;
        }
      }
      return left;
    }

    function unary() {
      if (isOp('-')) { next(); const r = unary(); return { v: -r.v, pct: r.pct }; }
      if (isOp('+')) { next(); return unary(); }
      return power();
    }

    function power() {
      const base = postfix();
      if (isOp('^')) {
        next();
        operators++;
        const exp = unary();
        return { v: Math.pow(base.v, exp.v), pct: false };
      }
      return base;
    }

    function postfix() {
      let r = primary();
      while (isOp('%') || isOp('!')) {
        const op = next().value;
        operators++;
        if (op === '%') r = { v: r.v / 100, pct: true };
        else r = { v: factorial(r.v), pct: false };
      }
      return r;
    }

    function primary() {
      const t = next();
      if (!t) throw new ParseError('Expresión incompleta');
      if (t.type === 'num') return { v: t.value, pct: false };
      if (t.type === 'id') {
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, t.value)) return { v: CONSTANTS[t.value], pct: false };
        if (Object.prototype.hasOwnProperty.call(FUNCTIONS, t.value)) {
          operators++;
          const fn = FUNCTIONS[t.value];
          if (!isOp('(')) {
            // sqrt 16 (sin paréntesis)
            const arg = unary();
            return { v: fn(arg.v), pct: false };
          }
          next();
          const args = [expression().v];
          while (isOp(',')) { next(); args.push(expression().v); }
          if (!isOp(')')) throw new ParseError('Falta ")"');
          next();
          return { v: fn(...args), pct: false };
        }
        throw new ParseError(`Desconocido: ${t.value}`);
      }
      if (t.type === 'op' && t.value === '(') {
        const r = expression();
        if (!isOp(')')) throw new ParseError('Falta ")"');
        next();
        return { v: r.v, pct: false };
      }
      throw new ParseError('Símbolo inesperado');
    }

    const result = expression();
    if (pos < tokens.length) throw new ParseError('Sobran símbolos');
    return { value: result.v, operators };
  }

  function format(value) {
    if (!isFinite(value)) return String(value);
    const abs = Math.abs(value);
    if (abs !== 0 && (abs >= 1e15 || abs < 1e-6)) return value.toExponential(6).replace(/\.?0+e/, 'e');
    return value.toLocaleString('es-VE', { maximumFractionDigits: 6 });
  }

  // Expresión simbólica: "(1500 * 1.16) / 62.40", "sqrt(144) + 15%"
  function evaluate(expr) {
    if (!expr || typeof expr !== 'string') return null;
    const clean = expr.trim();
    if (!clean || clean.length > 300) return null;
    try {
      const prepared = normalizeNumbers(clean.toLowerCase().replace(/[$€]/g, ''));
      const tokens = tokenize(prepared);
      if (!tokens.length) return null;
      const { value, operators } = parse(tokens);
      if (typeof value !== 'number' || !isFinite(value)) return null;
      return { expression: clean, value, operators, formatted: format(value) };
    } catch (e) {
      return null;
    }
  }

  // Coma decimal: 62,40 -> 62.40 ; separador de miles inglés: 2,500 -> 2500
  function normalizeNumbers(s) {
    return s
      .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
      .replace(/(\d),(\d)/g, '$1.$2');
  }

  const WORD_NUMBERS = {
    cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
    ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
    ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
    cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800,
    novecientos: 900, mil: 1000
  };

  // Frase en español (ya normalizada o no) -> expresión simbólica
  function fromSpanish(text) {
    let s = String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[¿?¡!]/g, ' ')
      .trim();

    s = s.replace(/^(oye|hey|ok)\s+\w+\s+/, '')
      .replace(/^(y\s+)?(cuanto|cuantos|cual)\s+(es|son|da|seria|serian|sale|resulta)\s+/, '')
      .replace(/^(calcula|calcular|calculame|resuelve|resolver|dime|cuanto\s+da|el\s+resultado\s+de|resultado\s+de)\s+(el\s+|la\s+|cuanto\s+es\s+)?/, '')
      .replace(/\s+(por\s+favor|porfa)$/, '');

    s = s.replace(/^(el|la|los|las)\s+/, '').replace(/\bpor\s*ciento\b/g, '%');
    const wordRe = new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join('|')})\\b`, 'g');
    s = s.replace(wordRe, (w) => String(WORD_NUMBERS[w]));

    s = s
      .replace(/\braiz\s+cuadrada\s+de\s+([\d.,]+)/g, 'sqrt($1)')
      .replace(/\braiz\s+cubica\s+de\s+([\d.,]+)/g, 'cbrt($1)')
      .replace(/([\d.,]+)\s*%\s*de(l)?\s+/g, '($1/100)*')
      .replace(/\bal\s+cuadrado\b/g, '^2')
      .replace(/\bal\s+cubo\b/g, '^3')
      .replace(/\belevado\s+(a\s+la|al|a)\b/g, '^')
      .replace(/\bmultiplicado\s+por\b/g, '*')
      .replace(/\bdividido\s+(entre|por)\b/g, '/')
      .replace(/\bdividido\b/g, '/')
      .replace(/\bentre\b/g, '/')
      .replace(/\bmas\b/g, '+')
      .replace(/\bmenos\b/g, '-')
      .replace(/\bpor\b/g, '*')
      .replace(/(\d)\s*x\s*(\d)/g, '$1*$2')
      .replace(/\b(dolares|dolar|usd|bolivares|bs|euros?)\b/g, '');


    return s.replace(/\s+/g, ' ').trim();
  }

  // Para el chat: sólo responde si hay al menos un operador o función real.
  function evaluateNatural(text) {
    const expr = fromSpanish(text);
    if (!/\d/.test(expr)) return null;
    const res = evaluate(expr);
    if (!res || res.operators < 1) return null;
    return { ...res, expression: expr };
  }

  /* ------------------------------------------
     FÓRMULAS FINANCIERAS
     ------------------------------------------ */
  const Finance = {
    compound(principal, annualRatePct, years, timesPerYear = 12, monthlyContribution = 0) {
      const P = Number(principal) || 0;
      const r = (Number(annualRatePct) || 0) / 100;
      const n = Math.max(1, Number(timesPerYear) || 12);
      const t = Math.max(0, Number(years) || 0);
      const growth = Math.pow(1 + r / n, n * t);
      let finalAmount = P * growth;
      const pmt = Number(monthlyContribution) || 0;
      if (pmt && r > 0) {
        const monthlyRate = Math.pow(1 + r / n, n / 12) - 1;
        finalAmount += pmt * ((Math.pow(1 + monthlyRate, 12 * t) - 1) / monthlyRate);
      } else if (pmt) {
        finalAmount += pmt * 12 * t;
      }
      const invested = P + pmt * 12 * t;
      return {
        finalAmount,
        invested,
        interest: finalAmount - invested,
        apy: (Math.pow(1 + r / n, n) - 1) * 100
      };
    },

    loan(principal, annualRatePct, months) {
      const p = Number(principal) || 0;
      const n = Math.round(Number(months) || 0);
      const r = (Number(annualRatePct) || 0) / 100 / 12;
      if (p <= 0 || n <= 0) return null;
      const payment = r === 0 ? p / n : (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      const total = payment * n;
      return { payment, total, interest: total - p };
    },

    dca(purchases) {
      let invested = 0;
      let units = 0;
      (purchases || []).forEach(({ amount, price }) => {
        const a = Number(amount) || 0;
        const p = Number(price) || 0;
        if (a > 0 && p > 0) {
          invested += a;
          units += a / p;
        }
      });
      if (!units) return null;
      return { invested, units, avgPrice: invested / units };
    },

    devaluation(amountVes, rateStart, rateEnd, interestPct = 0) {
      const v = Number(amountVes) || 0;
      const a = Number(rateStart) || 0;
      const b = Number(rateEnd) || 0;
      if (!v || !a || !b) return null;
      const usdStart = v / a;
      const vesEnd = v * (1 + (Number(interestPct) || 0) / 100);
      const usdEnd = vesEnd / b;
      return {
        devaluationPct: ((b - a) / a) * 100,
        usdStart,
        usdEnd,
        lossUsd: usdStart - usdEnd,
        realChangePct: ((usdEnd - usdStart) / usdStart) * 100
      };
    },

    spread(buyPrice, sellPrice, feePct = 0) {
      const a = Number(buyPrice) || 0;
      const b = Number(sellPrice) || 0;
      if (a <= 0 || b <= 0) return null;
      const gross = ((b - a) / a) * 100;
      const net = gross - 2 * (Number(feePct) || 0);
      return { gross, net, profitable: net > 0 };
    }
  };

  const MathEngine = { evaluate, evaluateNatural, fromSpanish, format, Finance };
  root.YarbisMath = MathEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = MathEngine;
})(typeof window !== 'undefined' ? window : globalThis);
