/*
 * motion-director.js: signature motion moves as deterministic GSAP helpers.
 *
 * This is a classic script, not an ES module, on purpose. HyperFrames compositions load it with a
 * plain <script src> after gsap, and Node can require() the same file so the pure planners are
 * unit-testable.
 *
 * Contract (HyperFrames determinism rules):
 *   - Every applier adds tweens to a caller-owned `gsap.timeline({ paused: true })` at an absolute
 *     position, then returns the time its move settles, so beats chain without guesswork.
 *   - No clocks and no unseeded randomness. Only finite repeats. Never pass a `.clip` element; animate a
 *     child wrapper, because HyperFrames owns a clip's visibility.
 *   - DOM splitting happens at build time, so call the appliers after `document.fonts.ready`, then
 *     register `window.__timelines[id]` once the build finishes.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MotionDirector = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // Strong ease-out everywhere: fast departure, long settle ("dynamic out / extended in").
  const EASE = {
    enter: "expo.out",
    exit: "power3.in",
    move: "expo.inOut",
    pop: "back.out(2.2)",
    whipOut: "power4.in",
    whipIn: "power4.out",
    drift: "sine.inOut",
  };

  const TIMING = {
    wordStagger: 0.07,
    wordDuration: 0.6,
    keywordDelay: 0.12,
    exitStagger: 0.025,
    exitDuration: 0.35,
    typeCps: 24,
    highlight: 0.45,
    panel: 0.8,
    whip: 0.5,
    flash: 0.4,
    pop: 0.45,
  };

  // ---------------------------------------------------------------- pure planners (tested)

  function round(value) {
    return Math.round(value * 1000) / 1000;
  }

  function assertFiniteNumber(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(`MotionDirector: ${name} must be a finite number, got ${value}`);
    }
  }

  function tokenize(text) {
    return String(text ?? "").trim().split(/\s+/).filter(Boolean);
  }

  function normalizeWord(word) {
    return String(word).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  }

  function toPhrases(keyword) {
    const list = Array.isArray(keyword) ? keyword : keyword ? [keyword] : [];
    return list
      .map((phrase) => tokenize(phrase).map(normalizeWord).filter(Boolean))
      .filter((phrase) => phrase.length > 0);
  }

  /**
   * Plan a word-by-word build. Keyword tokens (a string, a phrase, or an array of them) are flagged,
   * and they plus every word after them land `keywordDelay` late, so the payoff word arrives on its
   * own micro-beat.
   * @returns {{word:string,index:number,isKeyword:boolean,at:number}[]}
   */
  function planWords(text, opts = {}) {
    const { keyword, stagger = TIMING.wordStagger, start = 0, keywordDelay = TIMING.keywordDelay, times } = opts;
    assertFiniteNumber(stagger, "stagger");
    assertFiniteNumber(start, "start");
    const words = tokenize(text);
    if (times && times.length !== words.length) {
      throw new RangeError(`MotionDirector: times has ${times.length} entries but the line has ${words.length} words`);
    }
    const normalized = words.map(normalizeWord);
    const isKeyword = new Array(words.length).fill(false);
    for (const phrase of toPhrases(keyword)) {
      for (let i = 0; i + phrase.length <= normalized.length; i += 1) {
        if (phrase.every((part, j) => normalized[i + j] === part)) {
          for (let j = 0; j < phrase.length; j += 1) isKeyword[i + j] = true;
        }
      }
    }
    let delay = 0;
    return words.map((word, index) => {
      // Voice-synced lines pass measured word times (seconds from the line start); they win over the stagger.
      if (times) return { word, index, isKeyword: isKeyword[index], at: round(start + times[index]) };
      if (isKeyword[index] && delay === 0) delay = keywordDelay;
      return { word, index, isKeyword: isKeyword[index], at: round(start + index * stagger + delay) };
    });
  }

  /**
   * Seeded PRNG (mulberry32). Use it for anything that should look random but must render
   * identically on every frame.
   */
  function seededRandom(seed = 1) {
    let state = seed >>> 0;
    return function next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Plan a typewriter reveal. A seeded jitter keeps the rhythm human without breaking determinism.
   * @returns {{chars:{char:string,at:number}[], end:number}}
   */
  function planType(text, opts = {}) {
    const { cps = TIMING.typeCps, start = 0, jitter = 0.25, seed = 7 } = opts;
    assertFiniteNumber(cps, "cps");
    if (cps <= 0) throw new RangeError("MotionDirector: cps must be greater than 0");
    const step = 1 / cps;
    const random = seededRandom(seed);
    let cursor = start;
    const chars = Array.from(String(text ?? "")).map((char) => {
      const at = round(cursor);
      cursor += step * (1 + (random() * 2 - 1) * jitter);
      return { char, at };
    });
    return { chars, end: round(cursor) };
  }

  /**
   * Minimum on-screen hold after a line finishes building, so every word can be read. The defaults
   * come from the references: a 4-word line holds about 1.2–1.3 s once built.
   */
  function readHold(wordCount, opts = {}) {
    const { base = 0.4, perWord = 0.2, min = 0.9, max = 3.5 } = opts;
    assertFiniteNumber(wordCount, "wordCount");
    return round(Math.min(max, Math.max(min, base + perWord * Math.max(0, wordCount))));
  }

  function beatLength(bpm) {
    assertFiniteNumber(bpm, "bpm");
    if (bpm <= 0) throw new RangeError("MotionDirector: bpm must be greater than 0");
    return 60 / bpm;
  }

  /** Snap a time to the nearest beat (or subdivision) so cuts and hits land on the music. */
  function snapToBeat(time, opts = {}) {
    const { bpm = 128, phase = 0, subdivision = 1 } = opts;
    assertFiniteNumber(time, "time");
    const step = beatLength(bpm) / subdivision;
    return round(phase + Math.round((time - phase) / step) * step);
  }

  function beatGrid(opts = {}) {
    const { bpm = 128, count = 16, phase = 0, subdivision = 1 } = opts;
    const step = beatLength(bpm) / subdivision;
    return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, i) => round(phase + i * step));
  }

  /** Finite repeat count for a looping tween. `floor` avoids overshooting the clip. */
  function repeatCount(totalSeconds, cycleSeconds) {
    assertFiniteNumber(totalSeconds, "totalSeconds");
    assertFiniteNumber(cycleSeconds, "cycleSeconds");
    if (cycleSeconds <= 0) return 0;
    return Math.max(0, Math.floor(totalSeconds / cycleSeconds) - 1);
  }

  /** Offsets and opacities for echo typography: ghosts stacked symmetrically above and below. */
  function planEcho(count = 2, opts = {}) {
    const { gap = 0.92, falloff = 0.42 } = opts;
    const ghosts = [];
    for (let k = 1; k <= count; k += 1) {
      const opacity = round(Math.pow(falloff, k));
      ghosts.push({ yPercent: round(-k * gap * 100), opacity, rank: k });
      ghosts.push({ yPercent: round(k * gap * 100), opacity, rank: k });
    }
    return ghosts;
  }

  // ---------------------------------------------------------------- DOM appliers (browser)

  function resolveOne(target) {
    if (typeof target !== "string") {
      if (!target) throw new Error("MotionDirector: missing target element");
      return target;
    }
    const element = root.document.querySelector(target);
    if (!element) throw new Error(`MotionDirector: no element matches "${target}"`);
    return element;
  }

  function resolveAll(targets) {
    if (typeof targets === "string") {
      const list = Array.from(root.document.querySelectorAll(targets));
      if (!list.length) throw new Error(`MotionDirector: no elements match "${targets}"`);
      return list;
    }
    return Array.isArray(targets) ? targets : Array.from(targets);
  }

  function cssToken(element, name, fallback) {
    const value = root.getComputedStyle(element).getPropertyValue(name).trim();
    return value || fallback;
  }

  function el(tag, className, text) {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /**
   * Split an element's text into word spans. Consecutive keyword words are grouped in one
   * `.md-key` span that carries the highlight layer. Idempotent.
   */
  function splitWords(target, opts = {}) {
    const element = resolveOne(target);
    if (element.__ajSplit) return element.__ajSplit;
    const plan = planWords(element.textContent, opts);
    element.textContent = "";
    const words = [];
    const keyGroups = [];
    let group = null;
    plan.forEach((item, i) => {
      const word = el("span", "md-word");
      word.appendChild(el("span", "md-word-in", item.word));
      if (item.isKeyword) {
        if (!group) {
          group = el("span", "md-key");
          group.appendChild(el("span", "md-key-bg"));
          element.appendChild(group);
          keyGroups.push(group);
        } else {
          group.appendChild(root.document.createTextNode(" "));
        }
        group.appendChild(word);
      } else {
        group = null;
        element.appendChild(word);
      }
      words.push(word.firstChild);
      const next = plan[i + 1];
      if (next && !(item.isKeyword && next.isKeyword)) element.appendChild(root.document.createTextNode(" "));
    });
    element.__ajSplit = { plan, words, keyGroups };
    return element.__ajSplit;
  }

  function addHighlight(tl, group, at, mode, element) {
    const accent = cssToken(element, "--md-accent", "#3df5b0");
    const onAccent = cssToken(element, "--md-on-accent", "#04120d");
    const inner = group.querySelectorAll(".md-word-in");
    const bg = group.querySelector(".md-key-bg");
    if (mode === "fill") {
      tl.fromTo(bg, { scaleX: 0 }, { scaleX: 1, duration: TIMING.highlight, ease: EASE.move }, at);
      tl.to(inner, { color: onAccent, duration: 0.2, ease: "none" }, at + 0.12);
    } else if (mode === "sweep") {
      group.classList.add("md-key--sweep");
      tl.fromTo(bg, { scaleX: 0 }, { scaleX: 1, duration: TIMING.highlight, ease: EASE.move }, at);
      tl.to(inner, { color: accent, duration: 0.25, ease: "none" }, at);
    } else if (mode === "bracket") {
      group.classList.add("md-key--bracket");
      const corners = ["tl", "tr", "bl", "br"].map((pos) => {
        const corner = el("span", `md-corner md-corner--${pos}`);
        group.appendChild(corner);
        return corner;
      });
      tl.fromTo(bg, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" }, at);
      tl.fromTo(corners, { scale: 0 }, { scale: 1, duration: 0.35, ease: EASE.pop, stagger: 0.04 }, at);
      tl.to(inner, { color: accent, duration: 0.25, ease: "none" }, at);
    } else {
      tl.to(inner, { color: accent, duration: 0.25, ease: "none" }, at);
    }
    return at + TIMING.highlight;
  }

  /**
   * Build a sentence word by word (rise and de-blur). Its keyword is highlighted with
   * `fill` | `sweep` | `bracket` | `color`.
   * @returns {number} time the line is fully built
   */
  function buildSentence(tl, target, at, opts = {}) {
    const element = resolveOne(target);
    const { highlight = "fill", duration = TIMING.wordDuration, rise = 60, blur = 10 } = opts;
    const { plan, words, keyGroups } = splitWords(element, opts);
    words.forEach((word, i) => {
      tl.fromTo(
        word,
        { yPercent: rise, opacity: 0, filter: `blur(${blur}px)` },
        { yPercent: 0, opacity: 1, filter: "blur(0px)", duration, ease: EASE.enter },
        at + plan[i].at,
      );
    });
    let end = at + (plan.length ? plan[plan.length - 1].at : 0) + duration;
    keyGroups.forEach((group) => {
      const firstIndex = words.indexOf(group.querySelector(".md-word-in"));
      const landed = at + plan[firstIndex].at + duration * 0.55;
      end = Math.max(end, addHighlight(tl, group, landed, highlight, element));
    });
    return round(end);
  }

  /** Exit a split sentence: words lift and blur away quickly. */
  function exitSentence(tl, target, at, opts = {}) {
    const element = resolveOne(target);
    const words = element.__ajSplit ? element.__ajSplit.words : [element];
    const { stagger = TIMING.exitStagger, duration = TIMING.exitDuration } = opts;
    tl.to(words, { yPercent: -50, opacity: 0, filter: "blur(10px)", duration, ease: EASE.exit, stagger }, at);
    // Highlight layers (pill, sweep, bracket corners) live outside the words, so they leave separately.
    const decor = element.querySelectorAll(".md-key-bg, .md-corner");
    if (decor.length) tl.to(decor, { opacity: 0, duration: duration * 0.8, ease: EASE.exit }, at);
    return round(at + duration + stagger * (words.length - 1));
  }

  /** Generic entrance for any element: rise, scale, and de-blur. */
  function arrive(tl, target, at, opts = {}) {
    const { y = 40, scale = 0.96, blur = 12, duration = 0.7, ease = EASE.enter } = opts;
    tl.fromTo(
      resolveAll(typeof target === "string" ? target : [target].flat()),
      { y, scale, opacity: 0, filter: `blur(${blur}px)` },
      { y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration, ease, stagger: opts.stagger || 0 },
      at,
    );
    return round(at + duration);
  }

  /** Generic exit: fall back, blur, and fade. */
  function leave(tl, target, at, opts = {}) {
    const { y = -30, scale = 1.02, blur = 12, duration = 0.4, ease = EASE.exit } = opts;
    tl.to(resolveAll(typeof target === "string" ? target : [target].flat()), {
      y, scale, opacity: 0, filter: `blur(${blur}px)`, duration, ease,
    }, at);
    return round(at + duration);
  }

  function splitChars(element, text, className) {
    element.textContent = "";
    return Array.from(text).map((char) => {
      const span = el("span", className, char);
      element.appendChild(span);
      return span;
    });
  }

  function addCaretBlink(tl, caret, from, until) {
    // Discrete sets instead of `repeat` so every frame is a pure function of time.
    for (let t = from; t + 0.5 <= until; t += 1.0) {
      tl.set(caret, { opacity: 0 }, round(t + 0.5));
      tl.set(caret, { opacity: 1 }, round(Math.min(until, t + 1.0)));
    }
  }

  /**
   * Typewriter reveal with an accent caret. Characters are hidden by `.md-typing` CSS and revealed
   * with `set`, so seeking backward restores them exactly.
   * @returns {number} time typing ends
   */
  function typeOn(tl, target, at, opts = {}) {
    const element = resolveOne(target);
    const { caret = true, blinkUntil } = opts;
    const text = element.textContent;
    element.classList.add("md-typing");
    const chars = splitChars(element, text, "md-ch");
    const plan = planType(text, { ...opts, start: at });
    chars.forEach((span, i) => tl.set(span, { display: "inline" }, plan.chars[i].at));
    if (caret) {
      const caretEl = el("span", "md-caret");
      element.appendChild(caretEl);
      tl.fromTo(caretEl, { opacity: 0 }, { opacity: 1, duration: 0.01 }, Math.max(0, at - 0.3));
      if (blinkUntil) addCaretBlink(tl, caretEl, plan.end, blinkUntil);
    }
    return plan.end;
  }

  /**
   * Cycle the last word of a line with type, hold, and backspace: "websites" → "campaigns" →
   * "brands". The final word stays.
   * @returns {number} time the final word is fully typed
   */
  function swapWord(tl, target, words, at, opts = {}) {
    const element = resolveOne(target);
    const { hold = 0.8, cps = 18, eraseCps = 40, caret = true, blinkUntil } = opts;
    element.classList.add("md-typing", "md-swap");
    element.textContent = "";
    let cursor = at;
    words.forEach((word, index) => {
      const holder = el("span", "md-swap-word");
      element.appendChild(holder);
      const chars = splitChars(holder, word, "md-ch");
      const plan = planType(word, { cps, start: cursor, seed: 11 + index });
      chars.forEach((span, i) => tl.set(span, { display: "inline" }, plan.chars[i].at));
      cursor = plan.end;
      if (index < words.length - 1) {
        cursor += hold;
        for (let i = chars.length - 1; i >= 0; i -= 1) {
          tl.set(chars[i], { display: "none" }, round(cursor));
          cursor += 1 / eraseCps;
        }
      }
    });
    if (caret) {
      const caretEl = el("span", "md-caret");
      element.appendChild(caretEl);
      tl.fromTo(caretEl, { opacity: 0 }, { opacity: 1, duration: 0.01 }, Math.max(0, at - 0.3));
      if (blinkUntil) addCaretBlink(tl, caretEl, cursor, blinkUntil);
    }
    return round(cursor);
  }

  /** Echo typography: ghost copies fan out above and below a word, then hold. */
  function echoStack(tl, target, at, opts = {}) {
    const element = resolveOne(target);
    const { count = 2, gap, falloff, duration = 0.8, outline = true } = opts;
    // Ghosts lose the source's id, so id-scoped styles would drop; carry the typography over explicitly.
    const computed = root.getComputedStyle(element);
    const typography = ["fontSize", "fontWeight", "fontFamily", "letterSpacing", "lineHeight", "textTransform", "color"]
      .map((prop) => [prop, computed[prop]])
      // Gradient text uses a transparent color; let the ghost's own CSS color win instead.
      .filter(([prop, value]) => !(prop === "color" && /rgba\(.*,\s*0\)$|transparent/.test(value)));
    const wrap = el("span", "md-echo");
    element.parentNode.insertBefore(wrap, element);
    wrap.appendChild(element);
    planEcho(count, { gap, falloff }).forEach((ghostPlan) => {
      const ghost = element.cloneNode(true);
      ghost.removeAttribute("id");
      // Earlier tweens may have written inline from-states (blur, offsets) onto the source; ghosts start clean.
      ghost.removeAttribute("style");
      typography.forEach(([prop, value]) => { ghost.style[prop] = value; });
      ghost.classList.add("md-echo-ghost");
      if (outline) ghost.classList.add("md-echo-ghost--outline");
      ghost.setAttribute("aria-hidden", "true");
      wrap.insertBefore(ghost, element);
      tl.fromTo(
        ghost,
        { yPercent: 0, opacity: 0 },
        { yPercent: ghostPlan.yPercent, opacity: ghostPlan.opacity, duration, ease: EASE.enter },
        at + (ghostPlan.rank - 1) * 0.06,
      );
    });
    return round(at + duration + (count - 1) * 0.06);
  }

  /** Full-bleed accent card wipes across, holds as punctuation, then wipes out the far side. */
  function flashCard(tl, target, at, opts = {}) {
    const element = resolveOne(target);
    const { hold = 0.6, duration = TIMING.flash } = opts;
    tl.fromTo(element, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration, ease: EASE.move }, at);
    const outAt = at + duration + hold;
    tl.to(element, { clipPath: "inset(0% 0% 0% 100%)", duration, ease: EASE.move }, outAt);
    return round(outAt + duration);
  }

  /** Split-panel push: the incoming panel shoves the outgoing one off-frame. */
  function panelPush(tl, outgoing, incoming, at, opts = {}) {
    const { dir = "left", duration = TIMING.panel } = opts;
    const axis = dir === "up" || dir === "down" ? "yPercent" : "xPercent";
    const sign = dir === "left" || dir === "up" ? -1 : 1;
    if (outgoing) tl.to(resolveOne(outgoing), { [axis]: sign * 100, duration, ease: EASE.move }, at);
    tl.fromTo(resolveOne(incoming), { [axis]: -sign * 100 }, { [axis]: 0, duration, ease: EASE.move }, at);
    return round(at + duration);
  }

  /** Whip transition: outgoing smears off with motion blur, incoming smears in and snaps sharp. */
  function whip(tl, outgoing, incoming, at, opts = {}) {
    const { dir = "left", distance = 60, blur = 28 } = opts;
    const sign = dir === "left" ? -1 : 1;
    if (outgoing) {
      tl.to(resolveOne(outgoing), {
        xPercent: sign * distance, opacity: 0, filter: `blur(${blur}px)`, duration: 0.28, ease: EASE.whipOut,
      }, at);
    }
    tl.fromTo(
      resolveOne(incoming),
      { xPercent: -sign * distance, opacity: 0, filter: `blur(${blur}px)` },
      { xPercent: 0, opacity: 1, filter: "blur(0px)", duration: TIMING.whip, ease: EASE.whipIn },
      at + 0.2,
    );
    return round(at + 0.2 + TIMING.whip);
  }

  /** Camera flies through an element: it scales past the lens and dissolves. */
  function zoomThrough(tl, target, at, opts = {}) {
    const { scale = 14, duration = 0.75 } = opts;
    const element = resolveOne(target);
    tl.to(element, { scale, duration, ease: "expo.in" }, at);
    tl.to(element, { opacity: 0, duration: duration * 0.35, ease: "none" }, at + duration * 0.65);
    return round(at + duration);
  }

  /** Option chips spring in staggered. Optionally one gets selected with a press and accent fill. */
  function chipPop(tl, targets, at, opts = {}) {
    const chips = resolveAll(targets);
    const { stagger = 0.07, select, selectDelay = 0.35 } = opts;
    tl.fromTo(chips, { scale: 0.4, opacity: 0, y: 14 }, { scale: 1, opacity: 1, y: 0, duration: TIMING.pop, ease: EASE.pop, stagger }, at);
    let end = at + TIMING.pop + stagger * (chips.length - 1);
    if (typeof select === "number" && chips[select]) {
      const chip = chips[select];
      const pressAt = end + selectDelay;
      tl.to(chip, { scale: 0.92, duration: 0.08, ease: "power2.in" }, pressAt);
      tl.to(chip, { scale: 1, duration: 0.4, ease: EASE.pop }, pressAt + 0.08);
      tl.to(chip, {
        backgroundColor: cssToken(chip, "--md-accent", "#3df5b0"),
        color: cssToken(chip, "--md-on-accent", "#04120d"),
        duration: 0.2,
        ease: "none",
      }, pressAt + 0.08);
      end = pressAt + 0.48;
    }
    return round(end);
  }

  /** Slot-list focus: the list scrolls so item `to` sits in the focus band, and the others dim. */
  function slotFocus(tl, list, at, opts = {}) {
    const listEl = resolveOne(list);
    const items = Array.from(listEl.children);
    const { from = 0, to = items.length - 1, duration = 0.9, dim = 0.22 } = opts;
    const itemHeight = opts.itemHeight || items[0].getBoundingClientRect().height;
    tl.fromTo(listEl, { y: -from * itemHeight }, { y: -to * itemHeight, duration, ease: EASE.move }, at);
    items.forEach((item, i) => {
      tl.fromTo(
        item,
        { opacity: i === from ? 1 : dim, scale: i === from ? 1.06 : 1 },
        { opacity: i === to ? 1 : dim, scale: i === to ? 1.06 : 1, duration, ease: EASE.move },
        at,
      );
    });
    return round(at + duration);
  }

  /** A UI card swings in from 3D depth to a resting tilt, then floats until `until`. */
  function tiltFloat(tl, target, at, opts = {}) {
    const element = resolveOne(target);
    const { rx = 10, ry = -14, depth = -260, entry = 1.1, until, amp = 10, cycle = 3.2 } = opts;
    tl.fromTo(
      element,
      { rotationX: rx + 24, rotationY: ry - 20, z: depth, opacity: 0, filter: "blur(8px)" },
      { rotationX: rx, rotationY: ry, z: 0, opacity: 1, filter: "blur(0px)", duration: entry, ease: EASE.enter },
      at,
    );
    const floatStart = at + entry;
    if (until && until > floatStart) {
      const half = cycle / 2;
      tl.to(element, {
        y: -amp, rotationY: ry + 3, duration: half, ease: EASE.drift, yoyo: true,
        repeat: repeatCount(until - floatStart, half),
      }, floatStart);
    }
    return round(floatStart);
  }

  /** Count a number up with seek-safe onUpdate, then punch it on landing. */
  function countUp(tl, target, to, at, opts = {}) {
    const element = resolveOne(target);
    const { from = 0, duration = 1.1, decimals = 0, prefix = "", suffix = "", punch = true } = opts;
    const state = { value: from };
    const render = () => {
      element.textContent = `${prefix}${state.value.toFixed(decimals)}${suffix}`;
    };
    tl.fromTo(state, { value: from }, { value: to, duration, ease: EASE.enter, onUpdate: render }, at);
    if (punch) {
      tl.to(element, { scale: 1.08, duration: 0.12, ease: "power2.out" }, at + duration * 0.7);
      tl.to(element, { scale: 1, duration: 0.5, ease: EASE.pop }, at + duration * 0.7 + 0.12);
    }
    return round(at + duration);
  }

  /**
   * Center of `selector` in the motif's positioning space (its offsetParent), with preview scaling
   * undone. Measured at build time, so call it after the layout is final (fonts ready, splits done).
   */
  function centerIn(motif, selector) {
    const space = motif.offsetParent || root.document.body;
    const spaceRect = space.getBoundingClientRect();
    const scale = space.offsetWidth ? spaceRect.width / space.offsetWidth : 1;
    const rect = resolveOne(selector).getBoundingClientRect();
    const size = motif.offsetWidth / 2;
    return {
      x: (rect.left + rect.width / 2 - spaceRect.left) / scale - size,
      y: (rect.top + rect.height / 2 - spaceRect.top) / scale - size,
    };
  }

  /**
   * Guide motif (spark, dot, orb) travels through points, leading the eye to the next reveal. A point
   * is `{ x, y, scale? }` in px, or `{ to: "#selector", dx?, dy?, scale? }` to land on (or beside) an
   * element's center. Only measure elements in a clip that is active at build time; otherwise pass x/y.
   */
  function motifPath(tl, target, points, at, opts = {}) {
    const element = resolveOne(target);
    const { duration = 1.2, ease = EASE.move } = opts;
    if (!Array.isArray(points) || points.length === 0) throw new Error("MotionDirector: motifPath needs at least one point");
    const segment = duration / points.length;
    const keyframes = points.map((point) => {
      const { x, y } = point.to ? centerIn(element, point.to) : point;
      return { x: x + (point.dx || 0), y: y + (point.dy || 0), scale: point.scale ?? 1, duration: segment };
    });
    tl.to(element, { keyframes, ease }, at);
    return round(at + duration);
  }

  /** Bounded ambient drift for background orbs. It gives the frame life without idle loops. */
  function ambientDrift(tl, targets, at, until, opts = {}) {
    const { amp = 60, cycle = 7, seed = 3 } = opts;
    const random = seededRandom(seed);
    resolveAll(targets).forEach((orb) => {
      const half = cycle * (0.8 + random() * 0.4) / 2;
      tl.to(orb, {
        x: (random() * 2 - 1) * amp,
        y: (random() * 2 - 1) * amp,
        scale: 1 + random() * 0.15,
        duration: half,
        ease: EASE.drift,
        yoyo: true,
        repeat: repeatCount(until - at, half),
      }, at);
    });
    return round(until);
  }

  /** SVG strokes draw themselves (connectors, logo outlines, arcs). Length is measured at build time. */
  function drawPath(tl, targets, at, opts = {}) {
    const { duration = 0.9, stagger = 0.12, ease = EASE.move } = opts;
    const paths = resolveAll(typeof targets === "string" ? targets : [targets].flat());
    paths.forEach((path, i) => {
      const length = path.getTotalLength();
      const start = at + i * stagger;
      path.style.strokeDasharray = `${length}`;
      // A zero-length dash still paints its round cap as a dot, so stay hidden until the draw begins.
      tl.fromTo(path, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: "none" }, start);
      tl.fromTo(path, { strokeDashoffset: length }, { strokeDashoffset: 0, duration, ease }, start);
    });
    return round(at + duration + stagger * Math.max(0, paths.length - 1));
  }

  /**
   * Virtual camera: move a world wrapper that holds the scene. Pushes, pans, and pull-backs are all
   * this one call with different values. Keep the wrapper full-frame with `transform-origin: 50% 50%`.
   */
  function camera(tl, target, at, opts = {}) {
    const { scale = 1, x = 0, y = 0, rotation = 0, rotationX = 0, rotationY = 0, duration = 1.2, ease = EASE.move } = opts;
    tl.to(resolveOne(target), { scale, x, y, rotation, rotationX, rotationY, duration, ease }, at);
    return round(at + duration);
  }

  /** Hard-cut slam: appears on the beat already big and settles, with no blur, no fade, no warning. */
  function slam(tl, target, at, opts = {}) {
    const { from = 1.16, duration = 0.45 } = opts;
    const element = resolveOne(target);
    tl.fromTo(element, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: "none" }, at);
    tl.fromTo(element, { scale: from }, { scale: 1, duration, ease: EASE.enter }, at);
    return round(at + duration);
  }

  /** Directional clip-path reveal (panels, images, color blocks) from `left` | `right` | `top` | `bottom`. */
  function wipeIn(tl, target, at, opts = {}) {
    const { from = "left", duration = 0.7, ease = EASE.move } = opts;
    const hidden = {
      left: "inset(0% 100% 0% 0%)",
      right: "inset(0% 0% 0% 100%)",
      top: "inset(0% 0% 100% 0%)",
      bottom: "inset(100% 0% 0% 0%)",
    }[from];
    if (!hidden) throw new Error(`MotionDirector: wipeIn from must be left|right|top|bottom, got "${from}"`);
    tl.fromTo(resolveAll(typeof target === "string" ? target : [target].flat()), { clipPath: hidden }, { clipPath: "inset(0% 0% 0% 0%)", duration, ease, stagger: opts.stagger || 0 }, at);
    return round(at + duration);
  }

  return {
    EASE,
    TIMING,
    // pure
    tokenize,
    normalizeWord,
    planWords,
    planType,
    planEcho,
    readHold,
    beatLength,
    snapToBeat,
    beatGrid,
    repeatCount,
    seededRandom,
    // DOM
    splitWords,
    buildSentence,
    exitSentence,
    arrive,
    leave,
    typeOn,
    swapWord,
    echoStack,
    flashCard,
    panelPush,
    whip,
    zoomThrough,
    chipPop,
    slotFocus,
    tiltFloat,
    countUp,
    motifPath,
    ambientDrift,
    drawPath,
    camera,
    slam,
    wipeIn,
  };
});
