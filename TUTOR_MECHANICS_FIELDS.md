# Tutor Mechanics: What To Fill

This file describes all mechanics available in tutor manual mode and the exact fields tutor fills for each round.

## General Rules

- Lesson has 6 stages.
- Each stage has exactly 5 examples (rounds).
- For every example in every mechanic, tutor always fills:
  - `Title text`
- Tutor also chooses a mechanic for each stage from the stage `Mechanic` dropdown.

---

## drag_drop

Fill per example:
- `Title text`
- `How many items on screen`
- `How many targets`
- `Zone N: correct item count` (one field per target zone)

---

## drag_sort

Fill per example:
- `Title text`
- `Numbers in correct order`
- `Rule`

---

## drag_group

Fill per example:
- `Title text`
- `All numbers that appear`
- `Group 1 name`
- `Group 1 correct numbers`
- `Group 2 name`
- `Group 2 correct numbers`

---

## pattern_input

Fill per example:
- `Title text`
- `Pattern with ?`
- `What goes instead of ?`

---

## fill_blank

Fill per example:
- `Title text`
- `Example`
- `Answer`

---

## multi_choice

Fill per example:
- `Title text`
- `Task text inside the interactive zone`
- `Answer A`
- `Answer B`
- `Answer C`
- `Correct option` (`A` / `B` / `C`)

---

## corridor_choice

Fill per example:
- `Title text`
- `Task text inside the interactive zone`
- `Left example`
- `Right example`
- `Correct side` (`left` / `right`)

---

## match_pairs

Fill per example:
- `Title text`
- `Example A`
- `Example B`
- `Example C`
- `Example D`
- `Correct pair #1` (`A` / `B` / `C` / `D`)
- `Correct pair #2` (`A` / `B` / `C` / `D`)

---

## tap_count

Fill per example:
- `Title text`
- `Task text inside the interactive zone`
- `How many taps`

---

## key_lock

Fill per example:
- `Title text`
- `Card 1 — sum on card`
- `Card 1 — key A`
- `Card 1 — key B`
- `Card 2 — sum on card`
- `Card 2 — key A`
- `Card 2 — key B`
- `Card 3 — sum on card`
- `Card 3 — key A`
- `Card 3 — key B`

Note:
- Sums and key values should be numeric.
- Keys are derived from these card pairs in current implementation.

---

## balance_scale

Fill per example:
- `Title text`
- `Left bowl expression (with ?)`
- `Right bowl expression/value`
- `Answer instead of ?`

---

## build_number

Fill per example:
- `Title text`
- `Base number`
- `How many parts should be used`
- `Mark as ready` toggle (optional helper flag)

---

## timer_challenge

Fill per example:
- `Title text`
- `A: example`
- `A: answer`
- `B: example`
- `B: answer`
- `C: example`
- `C: answer`
- `Time limit (seconds)`

---

## symbol_calc

Fill per example:
- `Title text`
- `A value`
- `B value`
- `C value`
- `Expression with symbols`
- `Answer`

---

## find_unknown

Fill per example:
- `Title text`
- `A value`
- `B value`
- `Equation (contains C)`
- `Answer for C`

