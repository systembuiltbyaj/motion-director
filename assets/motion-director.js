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
    // UI springs: settle with at most a tiny overshoot (bouncy easing reads as a template).
    spring: "back.out(1.15)",
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

  /** HH:MM:SS:FF for a HUD readout. Floors, so a frame never shows the next second early. */
  function formatTimecode(seconds, fps = 30) {
    assertFiniteNumber(seconds, "seconds");
    if (seconds < 0) throw new RangeError("MotionDirector: seconds must be 0 or more");
    const frames = Math.floor(seconds * fps + 1e-6);
    const pad = (value) => String(value).padStart(2, "0");
    const whole = Math.floor(frames / fps);
    return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor(whole / 60) % 60)}:${pad(whole % 60)}:${pad(frames % fps)}`;
  }

  /** A spinning list repeats its items `laps` times, then lands on `landIndex` of the last lap. */
  function planSpin(count, land, opts = {}) {
    const { laps = 3 } = opts;
    if (!Number.isInteger(count) || count < 1) throw new RangeError("MotionDirector: planSpin count must be a positive integer");
    if (!Number.isInteger(land) || land < 0 || land >= count) throw new RangeError(`MotionDirector: planSpin land must be 0..${count - 1}`);
    const landIndex = laps * count + land;
    return { total: landIndex + 1, landIndex };
  }

  /** SVG path of an easing function drawn in a width × height box (y up), for on-screen ease graphs. */
  function planEaseCurve(ease, opts = {}) {
    const { width = 400, height = 240, samples = 48 } = opts;
    const points = [];
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      points.push(`${i ? "L" : "M"}${round(width * t)},${round(height - height * ease(t))}`);
    }
    return points.join(" ");
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
    if (element.__mdSplit) return element.__mdSplit;
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
    element.__mdSplit = { plan, words, keyGroups };
    return element.__mdSplit;
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
    const words = element.__mdSplit ? element.__mdSplit.words : [element];
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

  // ---------------------------------------------------------------- UI morph, cursor, transitions

  /**
   * One container reshapes into the next UI state: pass any of width, height, borderRadius,
   * backgroundColor, color, x, y. A spring with at most a tiny overshoot; never cut between states.
   */
  function morphTo(tl, target, at, opts = {}) {
    const { duration = 0.55, ease = EASE.spring, ...props } = opts;
    tl.to(resolveOne(target), { ...props, duration, ease }, at);
    return round(at + duration);
  }

  /**
   * Content inside a morphing container swaps with a short blur. The exit and entry are timed
   * separately, so the new content lands while the old is still clearing. Stack both absolutely.
   */
  function contentSwap(tl, from, to, at, opts = {}) {
    const { duration = 0.3, blur = 8, overlap = 0.4 } = opts;
    if (from) tl.to(resolveOne(from), { opacity: 0, scale: 0.94, filter: `blur(${blur}px)`, duration, ease: EASE.exit }, at);
    const enter = at + (from ? duration * (1 - overlap) : 0);
    // No immediate render: slots start hidden in CSS, and a slot that is visible on frame 0 (a loop's
    // first state) must stay visible until its own swap comes round again.
    tl.fromTo(resolveOne(to), { opacity: 0, scale: 1.06, filter: `blur(${blur}px)` }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: duration * 1.4, ease: EASE.enter, immediateRender: false }, enter);
    return round(enter + duration * 1.4);
  }

  /**
   * A visible cursor moves to (x, y) in its positioning space. `click` presses at the end (returns the
   * press time, so the UI reaction can start on it); `drag` holds the press for the whole move.
   * An optional `.md-cursor-ripple` child flashes on each click.
   */
  function cursor(tl, target, at, opts = {}) {
    const { x, y, duration = 0.5, click = false, drag = false, ease = "power3.inOut" } = opts;
    assertFiniteNumber(x, "cursor x");
    assertFiniteNumber(y, "cursor y");
    const element = resolveOne(target);
    let time = at;
    if (drag) {
      tl.to(element, { scale: 0.86, duration: 0.08, ease: "power2.out" }, time);
      time += 0.08;
    }
    tl.to(element, { x, y, duration, ease }, time);
    time += duration;
    if (drag) {
      tl.to(element, { scale: 1, duration: 0.2, ease: EASE.pop }, time);
      return round(time);
    }
    if (click) {
      tl.to(element, { scale: 0.86, duration: 0.07, ease: "power2.in" }, time);
      tl.to(element, { scale: 1, duration: 0.25, ease: EASE.pop }, time + 0.07);
      const ripple = element.querySelector(".md-cursor-ripple");
      if (ripple) tl.fromTo(ripple, { scale: 0.2, opacity: 0.7 }, { scale: 2.4, opacity: 0, duration: 0.45, ease: "power2.out" }, time + 0.05);
      time += 0.07;
    }
    return round(time);
  }

  /**
   * Word portal: an overlay in the outgoing scene's color with the word cut out of it, so the next
   * scene already shows through the letters. The word then scales up about `origin` (an "x y" point
   * inside a letter's stroke, in SVG units) until the hole fills the frame. `target` is the SVG
   * <text> inside the overlay's <mask>; the overlay itself is hidden once the portal completes.
   */
  function textPortal(tl, target, at, opts = {}) {
    const { scale = 40, duration = 0.9, origin, overlay } = opts;
    const element = resolveOne(target);
    tl.fromTo(element, { scale: 1 }, { scale, duration, ease: "expo.in", svgOrigin: origin }, at);
    const end = round(at + duration);
    if (overlay) tl.set(resolveOne(overlay), { opacity: 0 }, end);
    return end;
  }

  /**
   * Too-fast-to-read list: repeats the list's items `laps` times, spins through them with motion blur,
   * and decelerates onto item `land`. Build-time DOM (clones), so call it with the rest of the build.
   * Pop the payoff (a "?", a highlight) about 0.2 s after the returned landing time.
   */
  function listSpin(tl, list, at, opts = {}) {
    const listEl = resolveOne(list);
    const originals = Array.from(listEl.children);
    const { land = originals.length - 1, laps = 3, duration = 1.8, dim = 0.25 } = opts;
    const plan = planSpin(originals.length, land, { laps });
    if (!listEl.__mdSpin) {
      for (let lap = 0; lap < laps; lap += 1) originals.forEach((item) => listEl.insertBefore(item.cloneNode(true), originals[0]));
      listEl.__mdSpin = true;
    }
    const items = Array.from(listEl.children);
    const itemHeight = opts.itemHeight || items[0].getBoundingClientRect().height;
    tl.fromTo(listEl, { y: 0, filter: "blur(6px)" }, { y: -plan.landIndex * itemHeight, duration, ease: "expo.out" }, at);
    tl.to(listEl, { filter: "blur(0px)", duration: duration * 0.45, ease: "power2.out" }, at + duration * 0.35);
    tl.fromTo(items, { opacity: dim }, { opacity: (i) => (i === plan.landIndex ? 1 : dim), duration: duration * 0.3, ease: "none" }, at + duration * 0.7);
    return round(at + duration);
  }

  /**
   * "Not X, but Y": a strike line draws through a word, holds, then drops to the baseline and turns
   * into the accent underline. `target` is the line element, absolutely placed across the word.
   */
  function strikeToUnderline(tl, target, at, opts = {}) {
    const { hold = 0.6, duration = 0.5, drop } = opts;
    const line = resolveOne(target);
    const distance = drop ?? line.parentElement.offsetHeight * 0.5;
    tl.fromTo(line, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.35, ease: EASE.enter }, at);
    const move = at + 0.35 + hold;
    tl.to(line, { y: distance, backgroundColor: cssToken(line, "--md-accent", "#3df5b0"), duration, ease: EASE.move }, move);
    return round(move + duration);
  }

  /** Micro-breath on the final hold (1.000 → 1.012 → 1.000), so an end card never reads as frozen. */
  function breathe(tl, target, at, opts = {}) {
    const { amount = 0.012, duration = 1.6 } = opts;
    const element = resolveOne(target);
    tl.to(element, { scale: 1 + amount, duration: duration / 2, ease: EASE.drift }, at);
    tl.to(element, { scale: 1, duration: duration / 2, ease: EASE.drift }, at + duration / 2);
    return round(at + duration);
  }

  // ---------------------------------------------------------------- HUD add-on (craft / capability reels)

  /**
   * Frame chrome for any layout: corner brackets, a running timecode, a BPM readout and a chapter
   * counter. Builds its DOM into `container` (a full-frame layer above the scene) and runs until `until`.
   * `chapters` is a list of start times; the counter reads "01/07" style.
   */
  function hudFrame(tl, container, at, until, opts = {}) {
    const { bpm, fps = 30, chapters = [], label = "" } = opts;
    const layer = resolveOne(container);
    layer.classList.add("md-hud");
    if (!layer.__mdHud) {
      ["tl", "tr", "bl", "br"].forEach((corner) => layer.appendChild(el("span", `md-hud-corner md-hud-corner--${corner}`)));
      layer.appendChild(el("span", "md-hud-tc", formatTimecode(at, fps)));
      layer.appendChild(el("span", "md-hud-meta", [label, bpm ? `${bpm} BPM` : ""].filter(Boolean).join("  ·  ")));
      layer.appendChild(el("span", "md-hud-chapter", chapters.length ? `01/${String(chapters.length).padStart(2, "0")}` : ""));
      layer.__mdHud = true;
    }
    const timecode = layer.querySelector(".md-hud-tc");
    const chapter = layer.querySelector(".md-hud-chapter");
    tl.fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none" }, at);
    const clock = { t: at };
    const total = String(chapters.length).padStart(2, "0");
    // Seek-safe: both readouts are recomputed from the tweened clock on every frame, never accumulated.
    const render = () => {
      timecode.textContent = formatTimecode(clock.t, fps);
      if (!chapters.length) return;
      const current = Math.max(1, chapters.filter((start) => start <= clock.t + 1e-6).length);
      chapter.textContent = `${String(current).padStart(2, "0")}/${total}`;
    };
    tl.fromTo(clock, { t: at }, { t: until, duration: until - at, ease: "none", onUpdate: render }, at);
    return round(until);
  }

  /**
   * Figma-style selection box around an element: frame, four handles and a W × H label, as if the film
   * is annotating its own design. Measures the element at build time (its clip must be active then).
   */
  function selectBox(tl, target, box, at, opts = {}) {
    const { pad = 12, duration = 0.35 } = opts;
    const element = resolveOne(target);
    const frame = resolveOne(box);
    frame.classList.add("md-select");
    if (!frame.__mdSelect) {
      ["tl", "tr", "bl", "br"].forEach((corner) => frame.appendChild(el("span", `md-select-handle md-select-handle--${corner}`)));
      frame.appendChild(el("span", "md-select-label"));
      frame.__mdSelect = true;
    }
    const space = frame.offsetParent || root.document.body;
    const spaceRect = space.getBoundingClientRect();
    const scale = space.offsetWidth ? spaceRect.width / space.offsetWidth : 1;
    const rect = element.getBoundingClientRect();
    const width = rect.width / scale;
    const height = rect.height / scale;
    frame.querySelector(".md-select-label").textContent = `${Math.round(width)} × ${Math.round(height)}`;
    tl.set(frame, { left: (rect.left - spaceRect.left) / scale - pad, top: (rect.top - spaceRect.top) / scale - pad, width: width + pad * 2, height: height + pad * 2 }, at);
    tl.fromTo(frame, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration, ease: EASE.enter }, at);
    return round(at + duration);
  }

  /**
   * On-screen easing graph: draws the curve of a GSAP ease inside an SVG and rides a dot along it,
   * labelled with the ease's name. `svg` needs a <path class="md-ease-path"> and a <circle class="md-ease-dot">.
   */
  function easeGraph(tl, svg, at, opts = {}) {
    const { ease = "expo.out", width = 400, height = 240, duration = 1.4 } = opts;
    const svgEl = resolveOne(svg);
    const path = svgEl.querySelector(".md-ease-path");
    const dot = svgEl.querySelector(".md-ease-dot");
    path.setAttribute("d", planEaseCurve(root.gsap.parseEase(ease), { width, height }));
    const drawn = drawPath(tl, path, at, { duration: duration * 0.6 });
    const length = path.getTotalLength();
    const state = { d: 0 };
    tl.fromTo(state, { d: 0 }, {
      d: length, duration, ease: "none",
      onUpdate: () => {
        const point = path.getPointAtLength(state.d);
        dot.setAttribute("cx", point.x);
        dot.setAttribute("cy", point.y);
      },
    }, drawn);
    return round(drawn + duration);
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
    formatTimecode,
    planSpin,
    planEaseCurve,
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
    morphTo,
    contentSwap,
    cursor,
    textPortal,
    listSpin,
    strikeToUnderline,
    breathe,
    hudFrame,
    selectBox,
    easeGraph,
  };
});
