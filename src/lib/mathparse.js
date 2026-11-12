// Small recursive-descent evaluator so we never have to touch eval().
// Juxtaposition counts as multiplication, so `2pi` and `3(4)` both work.
const FN = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  log: Math.log10,
  ln: Math.log,
  log2: Math.log2,
  exp: Math.exp,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  min: Math.min,
  max: Math.max,
};
const CONST = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };
function fact(n) {
  if (n < 0 || !Number.isInteger(n))
    throw new Error("factorials only play nice with whole numbers that aren't negative");
  // 171! overflows a double, so don't bother looping
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function evaluate(src) {
  const s = String(src).toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/\*\*/g, '^');
  let i = 0;
  const peek = () => {
    while (s[i] === ' ') i++;
    return s[i];
  };
  const eat = (c) => {
    if (peek() === c) {
      i++;
      return true;
    }
    return false;
  };
  function expr() {
    let v = term();
    for (;;) {
      if (eat('+')) v += term();
      else if (eat('-')) v -= term();
      else return v;
    }
  }
  function term() {
    let v = power();
    for (;;) {
      if (eat('*')) v *= power();
      else if (eat('/')) v /= power();
      else if (eat('%')) v %= power();
      else if (/[a-z(]/.test(peek() || '')) v *= power();
      else return v;
    }
  }
  function power() {
    let v = unary();
    // recursing on the right side makes ^ right-associative
    if (eat('^')) v = v ** power();
    return v;
  }
  function unary() {
    if (eat('-')) return -unary();
    if (eat('+')) return unary();
    return postfix();
  }
  function postfix() {
    let v = atom();
    while (eat('!')) v = fact(v);
    return v;
  }
  function atom() {
    const c = peek();
    if (c === '(') {
      i++;
      const v = expr();
      if (!eat(')')) throw new Error('a closing ) seems to have wandered off');
      return v;
    }
    if (/[0-9.]/.test(c || '')) {
      const m = s.slice(i).match(/^\d*\.?\d+(e[+-]?\d+)?/);
      if (!m) throw new Error('that number looks a bit off');
      i += m[0].length;
      return parseFloat(m[0]);
    }
    if (/[a-z]/.test(c || '')) {
      const m = s.slice(i).match(/^[a-z][a-z0-9]*/)[0];
      i += m.length;
      if (m in CONST) return CONST[m];
      if (m in FN) {
        if (!eat('(')) throw new Error(`${m} wants its arguments wrapped in parentheses`);
        const args = [expr()];
        while (eat(',')) args.push(expr());
        if (!eat(')')) throw new Error('a closing ) seems to have wandered off');
        return FN[m](...args);
      }
      throw new Error(`no idea what "${m}" is`);
    }
    throw new Error(
      c ? `wasn't expecting "${c}" there` : 'the expression ends too soon, something is missing',
    );
  }
  const v = expr();
  if (peek() !== undefined) throw new Error(`wasn't expecting "${peek()}" there`);
  return v;
}
module.exports = { evaluate, fact };
