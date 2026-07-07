/**
 * Deterministic math problem generator for lesson mechanics.
 * Produces guaranteed-correct round objects ready to use as examples.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRange(level) {
  if (level <= 2) return { min: 1, max: 10, mMax: 5 };
  if (level <= 4) return { min: 1, max: 30, mMax: 9 };
  if (level <= 6) return { min: 2, max: 50, mMax: 12 };
  if (level <= 8) return { min: 5, max: 100, mMax: 15 };
  return { min: 5, max: 200, mMax: 20 };
}

// Determine operations from topic string
function topicOps(topic) {
  const t = String(topic || '').toLowerCase();
  if (t.includes('add')) return ['+'];
  if (t.includes('subtract') || t.includes('minus')) return ['-'];
  if (t.includes('multipl')) return ['×'];
  if (t.includes('divis')) return ['÷'];
  return ['+', '-', '×'];
}

function pickOp(topic) {
  const ops = topicOps(topic);
  return ops[randInt(0, ops.length - 1)];
}

// ── Generators per mechanic ────────────────────────────────────────────────

function genFillBlank(topic, level) {
  const { min, max, mMax } = getRange(level);
  const op = pickOp(topic);
  const reverse = level >= 3 && Math.random() < 0.4;

  if (op === '+') {
    const a = randInt(min, max), b = randInt(min, max);
    const ans = a + b;
    if (reverse) return { prompt: `${a} + ___ = ${ans}`, answer: String(b) };
    return { prompt: `${a} + ${b} =`, answer: String(ans) };
  }
  if (op === '-') {
    const b = randInt(min, max - 1);
    const ans = randInt(b + 1, max);
    const a = ans + b;
    if (reverse) return { prompt: `${a} − ___ = ${ans}`, answer: String(b) };
    return { prompt: `${a} − ${b} =`, answer: String(ans) };
  }
  if (op === '×') {
    const a = randInt(2, mMax), b = randInt(2, mMax);
    const ans = a * b;
    if (reverse) return { prompt: `___ × ${b} = ${ans}`, answer: String(a) };
    return { prompt: `${a} × ${b} =`, answer: String(ans) };
  }
  if (op === '÷') {
    const b = randInt(2, mMax);
    const ans = randInt(2, mMax);
    const a = b * ans;
    if (reverse) return { prompt: `${a} ÷ ___ = ${ans}`, answer: String(b) };
    return { prompt: `${a} ÷ ${b} =`, answer: String(ans) };
  }
}

function genBalanceScale(topic, level) {
  const { min, max, mMax } = getRange(level);
  const op = pickOp(topic);

  if (op === '×') {
    const a = randInt(2, mMax), ans = randInt(2, mMax);
    return { leftExpression: `${a} × ?`, rightExpression: String(a * ans), answer: String(ans) };
  }
  if (op === '+') {
    const a = randInt(min, max), ans = randInt(min, max);
    return { leftExpression: `${a} + ?`, rightExpression: String(a + ans), answer: String(ans) };
  }
  if (op === '-') {
    const ans = randInt(min, max), right = randInt(min, ans - 1 < min ? min : ans - 1);
    const a = right + ans;
    return { leftExpression: `${a} − ?`, rightExpression: String(right), answer: String(ans) };
  }
  if (op === '÷') {
    const b = randInt(2, mMax), ans = randInt(2, mMax);
    return { leftExpression: `${b * ans} ÷ ?`, rightExpression: String(ans), answer: String(b) };
  }
  // fallback
  const a = randInt(2, 9), ans = randInt(2, 9);
  return { leftExpression: `${a} × ?`, rightExpression: String(a * ans), answer: String(ans) };
}

function genPatternInput(topic, level) {
  const { min, max, mMax } = getRange(level);
  const step = randInt(1, Math.min(mMax, 15));
  const start = randInt(min, Math.max(min, max - step * 5));
  const terms = Array.from({ length: 5 }, (_, i) => start + step * i);
  const hideIdx = randInt(1, 3); // never hide first or last
  const answer = terms[hideIdx];
  const shown = terms.map((v, i) => i === hideIdx ? '?' : String(v));
  return { prompt: shown.join(', '), answer: String(answer) };
}

function genCorridorChoice(topic, level) {
  const { min, max, mMax } = getRange(level);
  const op = pickOp(topic);
  let leftExpr, rightExpr, leftVal, rightVal;

  if (op === '×') {
    const a1 = randInt(2, mMax), b1 = randInt(2, mMax);
    const a2 = randInt(2, mMax), b2 = randInt(2, mMax);
    leftVal = a1 * b1; rightVal = a2 * b2;
    leftExpr = `${a1} × ${b1}`; rightExpr = `${a2} × ${b2}`;
  } else if (op === '÷') {
    const b1 = randInt(2, mMax), ans1 = randInt(2, mMax);
    const b2 = randInt(2, mMax), ans2 = randInt(2, mMax);
    leftVal = ans1; rightVal = ans2;
    leftExpr = `${b1 * ans1} ÷ ${b1}`; rightExpr = `${b2 * ans2} ÷ ${b2}`;
  } else {
    const a1 = randInt(min, max), b1 = randInt(min, max);
    const a2 = randInt(min, max), b2 = randInt(min, max);
    leftVal = a1 + b1; rightVal = a2 + b2;
    leftExpr = `${a1} + ${b1}`; rightExpr = `${a2} + ${b2}`;
  }

  if (leftVal === rightVal) return genCorridorChoice(topic, level); // retry on tie
  return {
    prompt: 'Which side is bigger?',
    leftExpression: leftExpr,
    rightExpression: rightExpr,
    correctSide: leftVal > rightVal ? 'left' : 'right',
  };
}

function genKeyLock(topic, level) {
  const { min, max, mMax } = getRange(level);
  const used = new Set();
  const locks = [];

  for (let i = 0; i < 3; i++) {
    let a, b;
    let tries = 0;
    do {
      a = randInt(min, mMax);
      b = randInt(min, mMax);
      tries++;
    } while ((used.has(a) || used.has(b) || a === b) && tries < 50);
    used.add(a); used.add(b);
    locks.push({ sum: a + b, keyA: a, keyB: b });
  }

  // Shuffle all 6 keys for the strip
  const allKeys = shuffle(locks.flatMap(l => [l.keyA, l.keyB]));

  return {
    keysSixText: allKeys.join(', '),
    lock1Sum: locks[0].sum, lock1KeyA: locks[0].keyA, lock1KeyB: locks[0].keyB,
    lock2Sum: locks[1].sum, lock2KeyA: locks[1].keyA, lock2KeyB: locks[1].keyB,
    lock3Sum: locks[2].sum, lock3KeyA: locks[2].keyA, lock3KeyB: locks[2].keyB,
  };
}

function genSymbolCalc(topic, level) {
  const { min, max, mMax } = getRange(level);
  const A = randInt(min, mMax), B = randInt(min, mMax), C = randInt(min, mMax);
  const templates = [
    { expr: 'A × B + C', val: A * B + C },
    { expr: 'A + B × C', val: A + B * C },
    { expr: 'A × B − C', val: A * B - C },
    { expr: '(A + B) × C', val: (A + B) * C },
  ].filter(t => Number.isInteger(t.val));
  if (!templates.length) return genSymbolCalc(topic, level);
  const t = templates[randInt(0, templates.length - 1)];
  return { symbolA: A, symbolB: B, symbolC: C, symbolExpression: t.expr, answer: String(t.val) };
}

function genTimerChallenge(topic, level) {
  const { min, max, mMax } = getRange(level);
  const op = pickOp(topic);

  function pair() {
    if (op === '×') {
      const a = randInt(2, mMax), b = randInt(2, mMax);
      return { expr: `${a} × ${b}`, ans: String(a * b) };
    }
    if (op === '÷') {
      const b = randInt(2, mMax), ans = randInt(2, mMax);
      return { expr: `${b * ans} ÷ ${b}`, ans: String(ans) };
    }
    const a = randInt(min, max), b = randInt(min, max);
    return op === '-'
      ? { expr: `${a + b} − ${b}`, ans: String(a) }
      : { expr: `${a} + ${b}`, ans: String(a + b) };
  }

  const [pA, pB, pC] = [pair(), pair(), pair()];
  return {
    timerExampleA: pA.expr, timerAnswerA: pA.ans,
    timerExampleB: pB.expr, timerAnswerB: pB.ans,
    timerExampleC: pC.expr, timerAnswerC: pC.ans,
    timerSeconds: 30,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

const GENERATORS = {
  fill_blank: genFillBlank,
  balance_scale: genBalanceScale,
  pattern_input: genPatternInput,
  corridor_choice: genCorridorChoice,
  key_lock: genKeyLock,
  symbol_calc: genSymbolCalc,
  timer_challenge: genTimerChallenge,
};

/**
 * Generate `count` problem objects for a given mechanic, topic, and difficulty level.
 * Each object has roundNumber + all mechanic-required fields (no titleText — left for context).
 */
export function generateProblems(mechanic, topic, level, count = 5) {
  const gen = GENERATORS[mechanic];
  if (!gen) return [];
  const results = [];
  for (let i = 0; i < count; i++) {
    try {
      const problem = gen(topic, level);
      if (problem) results.push({ roundNumber: i + 1, titleText: '', ...problem });
    } catch { /* skip failed */ }
  }
  return results;
}

export const SUPPORTED_MECHANICS = Object.keys(GENERATORS);
