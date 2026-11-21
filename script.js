(function () {
  "use strict";

  var SYMBOL = { "+": "+", "-": "\u2212", "*": "\u00d7", "/": "\u00f7" };
  var MAX_DIGITS = 15;
  var MAX_HISTORY = 6;

  // Every key on the pad, in grid order. The pad is built from this list with a loop.
  var KEYS = [
    { label: "AC", kind: "clear", action: "clear", aria: "All clear", hot: "Escape" },
    { label: "\u232b", kind: "func", action: "back", aria: "Backspace", hot: "Backspace" },
    { label: "%", kind: "func", action: "percent", aria: "Percent", hot: "%" },
    { label: "\u00f7", kind: "op", action: "op", value: "/", aria: "Divide", hot: "/" },
    { label: "7", action: "digit", value: "7", hot: "7" },
    { label: "8", action: "digit", value: "8", hot: "8" },
    { label: "9", action: "digit", value: "9", hot: "9" },
    { label: "\u00d7", kind: "op", action: "op", value: "*", aria: "Multiply", hot: "*" },
    { label: "4", action: "digit", value: "4", hot: "4" },
    { label: "5", action: "digit", value: "5", hot: "5" },
    { label: "6", action: "digit", value: "6", hot: "6" },
    { label: "\u2212", kind: "op", action: "op", value: "-", aria: "Subtract", hot: "-" },
    { label: "1", action: "digit", value: "1", hot: "1" },
    { label: "2", action: "digit", value: "2", hot: "2" },
    { label: "3", action: "digit", value: "3", hot: "3" },
    { label: "+", kind: "op", action: "op", value: "+", aria: "Add", hot: "+" },
    { label: "0", kind: "zero", action: "digit", value: "0", hot: "0" },
    { label: ".", action: "decimal", aria: "Decimal point", hot: "." },
    { label: "=", kind: "eq", action: "equals", aria: "Equals", hot: "Enter" }
  ];

  var state = { current: "0", previous: null, operator: null, waiting: false, justEvaluated: false, error: false, exprText: "Ready" };
  var history = [];

  var pad = document.getElementById("pad");
  var valueEl = document.getElementById("value");
  var exprEl = document.getElementById("expr");
  var listEl = document.getElementById("history-list");
  var emptyEl = document.getElementById("history-empty");
  var clearHistoryBtn = document.getElementById("clear-history");

  // ---- build the keypad with a loop ----
  for (var i = 0; i < KEYS.length; i++) {
    var k = KEYS[i];
    var b = document.createElement("button");
    b.type = "button";
    b.className = "key" + (k.kind ? " " + k.kind : "");
    b.textContent = k.label;
    b.dataset.action = k.action;
    if (k.value) b.dataset.value = k.value;
    b.dataset.hot = k.hot;
    if (k.aria) b.setAttribute("aria-label", k.aria);
    if (k.kind === "zero") b.className = "key zero";
    pad.appendChild(b);
  }

  // ---- maths ----
  function calculate(a, b, op) {
    var result;
    if (op === "+") {
      result = a + b;
    } else if (op === "-") {
      result = a - b;
    } else if (op === "*") {
      result = a * b;
    } else if (op === "/") {
      if (b === 0) return null;
      result = a / b;
    } else {
      return b;
    }
    if (!isFinite(result)) return null;
    return Number(result.toPrecision(12));
  }

  // Adds thousands separators by walking the integer part from the right.
  function format(str) {
    if (str.indexOf("e") !== -1) return str;
    var sign = "";
    if (str.charAt(0) === "-") { sign = "-"; str = str.slice(1); }
    var parts = str.split(".");
    var whole = parts[0];
    var out = "";
    var count = 0;
    for (var n = whole.length - 1; n >= 0; n--) {
      out = whole.charAt(n) + out;
      count++;
      if (count % 3 === 0 && n > 0) out = "," + out;
    }
    if (parts.length > 1) out += "." + parts[1];
    return sign + out;
  }

  function fail() {
    state.error = true;
    state.current = "Can\u2019t divide by zero";
    state.previous = null;
    state.operator = null;
    state.waiting = false;
    state.exprText = "Press AC to start again";
  }

  function resetAll() {
    state.current = "0";
    state.previous = null;
    state.operator = null;
    state.waiting = false;
    state.justEvaluated = false;
    state.error = false;
    state.exprText = "Ready";
  }

  // ---- actions ----
  function inputDigit(d) {
    if (state.error) resetAll();
    if (state.waiting || state.justEvaluated) {
      state.current = d;
      state.waiting = false;
      state.justEvaluated = false;
    } else if (state.current === "0") {
      state.current = d;
    } else if (state.current.replace(/[-.]/g, "").length < MAX_DIGITS) {
      state.current += d;
    }
  }

  function inputDecimal() {
    if (state.error) resetAll();
    if (state.waiting || state.justEvaluated) {
      state.current = "0.";
      state.waiting = false;
      state.justEvaluated = false;
    } else if (state.current.indexOf(".") === -1) {
      state.current += ".";
    }
  }

  function chooseOperator(op) {
    if (state.error) return;
    if (state.operator && !state.waiting) {
      var result = calculate(state.previous, parseFloat(state.current), state.operator);
      if (result === null) { fail(); return; }
      state.current = String(result);
      state.previous = result;
    } else if (!state.operator) {
      state.previous = parseFloat(state.current);
    }
    state.operator = op;
    state.waiting = true;
    state.justEvaluated = false;
    state.exprText = format(String(state.previous)) + " " + SYMBOL[op];
  }

  function equals() {
    if (state.error || state.operator === null) return;
    var a = state.previous;
    var b = parseFloat(state.current);
    var result = calculate(a, b, state.operator);
    if (result === null) { fail(); return; }
    var line = format(String(a)) + " " + SYMBOL[state.operator] + " " + format(String(b));
    history.unshift({ expr: line, result: format(String(result)) });
    if (history.length > MAX_HISTORY) history.pop();
    state.exprText = line + " =";
    state.current = String(result);
    state.previous = null;
    state.operator = null;
    state.waiting = false;
    state.justEvaluated = true;
  }

  function percent() {
    if (state.error) return;
    var n = parseFloat(state.current) / 100;
    state.current = String(Number(n.toPrecision(12)));
    if (state.waiting) state.waiting = false;
  }

  function backspace() {
    if (state.error || state.waiting || state.justEvaluated) return;
    var c = state.current;
    if (c.length <= 1 || (c.length === 2 && c.charAt(0) === "-")) {
      state.current = "0";
    } else {
      state.current = c.slice(0, -1);
    }
  }

  function handle(action, value) {
    if (action === "digit") {
      inputDigit(value);
    } else if (action === "decimal") {
      inputDecimal();
    } else if (action === "op") {
      chooseOperator(value);
    } else if (action === "equals") {
      equals();
    } else if (action === "percent") {
      percent();
    } else if (action === "back") {
      backspace();
    } else if (action === "clear") {
      resetAll();
    }
    render();
  }

  // ---- drawing ----
  function render() {
    var text = state.error ? state.current : format(state.current);
    valueEl.textContent = text;
    valueEl.className = "value";
    if (state.error) {
      valueEl.className = "value err";
    } else if (text.length > 14) {
      valueEl.className = "value sm";
    } else if (text.length > 9) {
      valueEl.className = "value md";
    }
    exprEl.textContent = state.exprText;

    var ops = pad.querySelectorAll(".key.op");
    for (var i = 0; i < ops.length; i++) {
      var on = state.operator !== null && state.waiting && ops[i].dataset.value === state.operator;
      ops[i].classList.toggle("active", on);
      ops[i].setAttribute("aria-pressed", on ? "true" : "false");
    }

    listEl.textContent = "";
    for (var h = 0; h < history.length; h++) {
      var li = document.createElement("li");
      var left = document.createElement("span");
      var right = document.createElement("span");
      left.textContent = history[h].expr + " =";
      right.textContent = history[h].result;
      li.appendChild(left);
      li.appendChild(right);
      listEl.appendChild(li);
    }
    var has = history.length > 0;
    emptyEl.hidden = has;
    clearHistoryBtn.hidden = !has;
  }

  // ---- events ----
  pad.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    handle(btn.dataset.action, btn.dataset.value);
  });

  clearHistoryBtn.addEventListener("click", function () {
    history = [];
    render();
  });

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var key = e.key === "," ? "." : e.key === "=" ? "Enter" : e.key;
    var btn = pad.querySelector('[data-hot="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
    if (!btn) return;
    e.preventDefault();
    btn.classList.add("pressed");
    setTimeout(function () { btn.classList.remove("pressed"); }, 120);
    handle(btn.dataset.action, btn.dataset.value);
  });

  render();
})();