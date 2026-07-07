/**
 * Math answer verifier + auto-fixer for generated lessons.
 * Checks arithmetic correctness for all verifiable mechanics and patches wrong answers in-place.
 */
import { evaluate as mathEval } from 'mathjs';

// ── Helpers ────────────────────────────────────────────────────────────────

function norm(s) {
  return String(s ?? '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−|–|—/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function tryEval(expr) {
  try {
    const v = mathEval(norm(expr));
    return typeof v === 'number' && isFinite(v) ? v : null;
  } catch { return null; }
}

function near(a, b) { return Math.abs(a - b) < 0.001; }

// Find integer x in [-500, 500] such that eval(template_with_x) ≈ target
function solveInt(template, target) {
  const t = norm(template);
  for (let x = -500; x <= 500; x++) {
    const test = t.replace(/[?＿_]+/g, String(x));
    const v = tryEval(test);
    if (v !== null && near(v, target)) return x;
  }
  return null;
}

// ── Per-mechanic verifiers ─────────────────────────────────────────────────

function checkFillBlank(round) {
  const { prompt, answer } = round;
  if (!prompt || answer == null) return [];
  const p = norm(prompt);
  if (!p.includes('=')) return [];
  const [left, right] = p.split('=').map(s => s.trim());
  const blL = /[?_]/.test(left), blR = /[?_]/.test(right);

  if (!blL && !blR) {
    // "a op b =" — evaluate left, answer should be the result
    const val = tryEval(left);
    if (val === null) return [];
    const correct = Math.round(val * 100) / 100;
    return Number(answer) !== correct ? [{ field: 'answer', value: String(correct) }] : [];
  }
  if (blL && right && !blR) {
    // "? op b = c" — solve for blank
    const rv = tryEval(right);
    if (rv === null) return [];
    const correct = solveInt(left, rv);
    return correct !== null && Number(answer) !== correct
      ? [{ field: 'answer', value: String(correct) }] : [];
  }
  if (!blL && blR) {
    // "a op b = ?" — answer is evaluated left
    const lv = tryEval(left);
    if (lv === null) return [];
    const correct = Math.round(lv);
    return Number(answer) !== correct ? [{ field: 'answer', value: String(correct) }] : [];
  }
  return [];
}

function checkBalanceScale(round) {
  const { leftExpression, rightExpression, answer } = round;
  if (!leftExpression || !rightExpression || answer == null) return [];
  const rv = tryEval(rightExpression);
  if (rv === null) return [];
  const ln = norm(leftExpression);
  const testLeft = ln.replace(/[?＿_]+/g, String(answer));
  const lv = tryEval(testLeft);
  if (lv !== null && near(lv, rv)) return [];
  const correct = solveInt(ln, rv);
  return correct !== null && Number(answer) !== correct
    ? [{ field: 'answer', value: String(correct) }] : [];
}

function checkCorridorChoice(round) {
  const lv = tryEval(round.leftExpression);
  const rv = tryEval(round.rightExpression);
  if (lv === null || rv === null || near(lv, rv)) return [];
  const correct = lv > rv ? 'left' : 'right';
  return round.correctSide !== correct ? [{ field: 'correctSide', value: correct }] : [];
}

function checkKeyLock(round) {
  const patches = [];
  for (let i = 1; i <= 3; i++) {
    const sum = Number(round[`lock${i}Sum`]);
    const a = Number(round[`lock${i}KeyA`]);
    const b = Number(round[`lock${i}KeyB`]);
    if (isNaN(sum) || isNaN(a) || isNaN(b)) continue;
    if (a + b !== sum) patches.push({ field: `lock${i}Sum`, value: a + b });
  }
  return patches;
}

function checkSymbolCalc(round) {
  const { symbolA, symbolB, symbolC, symbolExpression, answer } = round;
  if (symbolA == null || symbolB == null || symbolC == null || !symbolExpression) return [];
  const expr = norm(symbolExpression)
    .replace(/\bA\b/g, String(symbolA))
    .replace(/\bB\b/g, String(symbolB))
    .replace(/\bC\b/g, String(symbolC));
  const computed = tryEval(expr);
  if (computed === null) return [];
  const correct = Math.round(computed * 100) / 100;
  return Number(answer) !== correct ? [{ field: 'answer', value: String(correct) }] : [];
}

function checkFindUnknown(round) {
  const { unknownA, unknownB, unknownEquation, answer } = round;
  if (unknownA == null || unknownB == null || !unknownEquation || answer == null) return [];
  const eq = norm(unknownEquation)
    .replace(/\bA\b/g, String(unknownA))
    .replace(/\bB\b/g, String(unknownB));
  const parts = eq.split('=');
  if (parts.length !== 2) return [];
  const rv = tryEval(parts[1]);
  if (rv === null) return [];
  const correct = solveInt(parts[0], rv);
  return correct !== null && Number(answer) !== correct
    ? [{ field: 'answer', value: String(correct) }] : [];
}

function checkTimerChallenge(round) {
  const patches = [];
  for (const l of ['A', 'B', 'C']) {
    const expr = round[`timerExample${l}`];
    const ans = round[`timerAnswer${l}`];
    if (!expr || ans == null) continue;
    const clean = norm(expr).replace(/=\s*\??\s*$/, '').replace(/=\s*$/, '');
    if (/[?_]/.test(clean)) continue;
    const val = tryEval(clean);
    if (val !== null && String(ans) !== String(Math.round(val)))
      patches.push({ field: `timerAnswer${l}`, value: String(Math.round(val)) });
  }
  return patches;
}

function checkFiveTasks(round) {
  const patches = [];
  for (let i = 1; i <= 5; i++) {
    const task = round[`task${i}`];
    const ans = round[`answer${i}`];
    if (!task || ans == null) continue;
    const clean = norm(task).replace(/=\s*\??\s*$/, '').replace(/=\s*$/, '');
    if (/[?_]/.test(clean)) continue;
    const val = tryEval(clean);
    if (val !== null && String(ans) !== String(Math.round(val)))
      patches.push({ field: `answer${i}`, value: String(Math.round(val)) });
  }
  return patches;
}

function checkTrueFalse(round) {
  const { statement, trueOrFalse } = round;
  if (!statement || !trueOrFalse) return [];
  const s = norm(statement);
  if (!s.includes('=')) return [];
  const parts = s.split('=');
  if (parts.length !== 2) return [];
  const [left, right] = parts;
  if (/[?_]/.test(left) || /[?_]/.test(right)) return [];
  const lv = tryEval(left), rv = tryEval(right);
  if (lv === null || rv === null) return [];
  const correct = near(lv, rv) ? 'true' : 'false';
  return trueOrFalse !== correct ? [{ field: 'trueOrFalse', value: correct }] : [];
}

function checkMultiChoice(round) {
  const { prompt, choiceA, choiceB, choiceC, correctOption } = round;
  if (!prompt || !correctOption) return [];
  const p = norm(prompt);
  const eqIdx = p.lastIndexOf('=');
  if (eqIdx < 0) return [];
  const leftPart = p.slice(0, eqIdx);
  if (/[?_]/.test(leftPart)) return [];
  const lv = tryEval(leftPart);
  if (lv === null) return [];
  const choices = { A: choiceA, B: choiceB, C: choiceC };
  for (const [k, v] of Object.entries(choices)) {
    if (v == null) continue;
    const cv = Number(v);
    if (!isNaN(cv) && near(cv, lv) && correctOption !== k)
      return [{ field: 'correctOption', value: k }];
  }
  return [];
}

function checkPatternInput(round) {
  const { prompt, answer } = round;
  if (!prompt || answer == null) return [];
  const tokens = String(prompt).split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
  const qIdx = tokens.findIndex(t => /^[?_]+$/.test(t));
  if (qIdx < 0) return [];
  const nums = tokens.map((t, i) => i === qIdx ? null : Number(t));
  const known = nums.filter(n => n !== null);
  if (known.length < 2) return [];
  // Detect arithmetic step
  const pairs = [];
  let prev = -1;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== null) { if (prev >= 0) pairs.push([prev, i, nums[i] - nums[prev]]); prev = i; }
  }
  const steps = pairs.map(p => p[2]);
  if (!steps.every(s => s === steps[0])) return [];
  const step = steps[0];
  let correct = null;
  for (let i = qIdx - 1; i >= 0; i--) {
    if (nums[i] !== null) { correct = nums[i] + step * (qIdx - i); break; }
  }
  if (correct === null) {
    for (let i = qIdx + 1; i < nums.length; i++) {
      if (nums[i] !== null) { correct = nums[i] - step * (i - qIdx); break; }
    }
  }
  return correct !== null && Number(answer) !== correct
    ? [{ field: 'answer', value: String(correct) }] : [];
}

// ── Dispatcher ─────────────────────────────────────────────────────────────

function verifyRound(mechanic, round) {
  switch (mechanic) {
    case 'fill_blank':      return checkFillBlank(round);
    case 'balance_scale':   return checkBalanceScale(round);
    case 'corridor_choice': return checkCorridorChoice(round);
    case 'key_lock':        return checkKeyLock(round);
    case 'symbol_calc':     return checkSymbolCalc(round);
    case 'find_unknown':    return checkFindUnknown(round);
    case 'timer_challenge': return checkTimerChallenge(round);
    case 'five_tasks':      return checkFiveTasks(round);
    case 'true_false':      return checkTrueFalse(round);
    case 'multi_choice':    return checkMultiChoice(round);
    case 'pattern_input':   return checkPatternInput(round);
    default: return [];
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Verifies all rounds in the lesson, auto-fixes math errors in-place.
 * Returns { fixedCount, log } where log is an array of human-readable fix descriptions.
 */
export function verifyAndFixLesson(lesson) {
  let fixedCount = 0;
  const log = [];

  for (const stage of (lesson.stages || [])) {
    const mechanic = stage.type;
    for (const round of (stage.rounds || [])) {
      const m = (mechanic === 'boss_mix' && round.bossMechanic) ? round.bossMechanic : mechanic;
      const patches = verifyRound(m, round);
      for (const { field, value } of patches) {
        log.push(`[S${stage.id} R${round.roundNumber}] ${m}: ${field} ${JSON.stringify(round[field])} → ${JSON.stringify(value)}`);
        round[field] = value;
        fixedCount++;
      }
    }
  }

  return { fixedCount, log };
}
