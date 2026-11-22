import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/* ================== Анимация появления ================== */

startAnimation();

function startAnimation() {
  const appimg = document.getElementById("appimg");
  const mainpage = document.querySelectorAll(".main");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (appimg) appimg.classList.add("opacity2");
      mainpage.forEach((el) => el.classList.add("opacity1"));
    });
  });
}

/* ================== Уведомления ================== */

async function ensurePermission() {
  if (await isPermissionGranted()) {
    return true;
  }
  return (await requestPermission()) === "granted";
}

function notify(title, body) {
  try {
    sendNotification({ title, body });
  } catch (err) {
    console.error("Не удалось отправить уведомление:", err);
  }
}

/* ================== Таймер ================== */

const DEFAULT_WORK_MINUTES = 30;
const DEFAULT_BREAK_MINUTES = 5;
const LONG_BREAK_MINUTES = 15;
const POMODOROS_PER_CYCLE = 4;

const timerEl = document.getElementById("timer");
const phaseEl = document.getElementById("phase");
const countEl = document.getElementById("count");
const workOptionsEl = document.querySelector('[data-role="work-options"]');
const breakOptionsEl = document.querySelector('[data-role="break-options"]');

const state = {
  phase: "work",
  workSeconds: DEFAULT_WORK_MINUTES * 60,
  breakSeconds: DEFAULT_BREAK_MINUTES * 60,
  longBreak: false,
  remaining: DEFAULT_WORK_MINUTES * 60,
  deadline: 0,
  intervalId: null,
  completed: 0,
  started: false,
  pausedByUser: false,
  resumedAt: 0,
};

function format(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function currentDuration() {
  if (state.phase === "work") {
    return state.workSeconds;
  }
  return state.longBreak ? LONG_BREAK_MINUTES * 60 : state.breakSeconds;
}

function phaseTitle() {
  if (state.phase === "work") {
    return "Работа";
  }
  return state.longBreak ? "Длинный отдых" : "Отдых";
}

function render() {
  const timeStr = format(state.remaining);
  timerEl.textContent = timeStr;
  phaseEl.textContent = phaseTitle();
  document.body.dataset.phase = state.phase;
  countEl.textContent = state.completed
    ? `Помидоров завершено: ${state.completed}`
    : "";

  // aria-label меняется в зависимости от состояния:
  // «30:00, Запустить таймер» → «29:59, Пауза» → «29:58, Продолжить».
  let action;
  if (!state.started) {
    action = "Запустить таймер";
  } else if (state.intervalId === null) {
    action = "Продолжить";
  } else {
    action = "Пауза";
  }
  timerEl.setAttribute("aria-label", `${timeStr}, ${action}`);
}

function syncPickers() {
  workOptionsEl.value = String(state.workSeconds / 60);
  breakOptionsEl.value = String(state.breakSeconds / 60);
}

function stopTimer() {
  clearInterval(state.intervalId);
  state.intervalId = null;
}

function startTimer(seconds) {
  stopTimer();
  state.pausedByUser = false;
  state.remaining = seconds;
  state.deadline = Date.now() + seconds * 1000;
  state.intervalId = setInterval(tick, 250);
  render();
}

// Клик/Enter/Space по цифрам:
//  - первый раз — запуск;
//  - далее — пауза / продолжить.
function togglePause() {
  // Первый тап после выхода из фона не должен случайно ставить паузу.
  if (Date.now() - state.resumedAt < 800) {
    return;
  }

  if (!state.started) {
    state.started = true;
    startTimer(state.remaining);
    return;
  }

  if (state.intervalId === null) {
    // Продолжить
    state.pausedByUser = false;
    state.deadline = Date.now() + state.remaining * 1000;
    state.intervalId = setInterval(tick, 250);
    tick();
  } else {
    // Пауза
    state.pausedByUser = true;
    stopTimer();
    render();
  }
}

function resumeIfNeeded() {
  if (!state.started) {
    return;
  }
  if (document.visibilityState !== "visible" || state.pausedByUser) {
    return;
  }

  state.remaining = Math.max(
    0,
    Math.ceil((state.deadline - Date.now()) / 1000),
  );
  if (state.remaining === 0) {
    tick();
    return;
  }

  stopTimer();
  state.deadline = Date.now() + state.remaining * 1000;
  state.intervalId = setInterval(tick, 250);
  state.resumedAt = Date.now();
  tick();
}

function tick() {
  state.remaining = Math.max(
    0,
    Math.ceil((state.deadline - Date.now()) / 1000),
  );
  render();

  if (state.remaining === 0) {
    stopTimer();
    finishPhase();
  }
}

function finishPhase() {
  if (state.phase === "work") {
    state.completed += 1;
    state.longBreak = state.completed % POMODOROS_PER_CYCLE === 0;
    state.phase = "break";

    const breakMinutes = state.longBreak
      ? LONG_BREAK_MINUTES
      : state.breakSeconds / 60;

    notify(
      "Пора отдохнуть",
      state.longBreak
        ? `Помидор №${state.completed} завершён. Длинный отдых ${breakMinutes} мин.`
        : `Помидор №${state.completed} завершён. Отдых ${breakMinutes} мин.`,
    );
  } else {
    state.longBreak = false;
    state.phase = "work";

    notify(
      "Пора работать",
      `Отдых закончен. Работа ${state.workSeconds / 60} мин.`,
    );
  }

  startTimer(currentDuration());
}

function selectDuration(phase, minutes) {
  const seconds = minutes * 60;

  if (phase === "work") {
    state.workSeconds = seconds;
  } else {
    state.breakSeconds = seconds;
  }

  syncPickers();

  const affectsCurrent =
    (phase === "work" && state.phase === "work") ||
    (phase === "break" && state.phase === "break" && !state.longBreak);

  if (!affectsCurrent) {
    return;
  }

  if (state.started) {
    startTimer(currentDuration());
  } else {
    state.remaining = currentDuration();
    render();
  }
}

workOptionsEl.addEventListener("change", () => {
  selectDuration("work", Number(workOptionsEl.value));
});

breakOptionsEl.addEventListener("change", () => {
  selectDuration("break", Number(breakOptionsEl.value));
});

/* ---- #timer: клик мышью / тап + клавиатура ---- */

timerEl.addEventListener("click", togglePause);

timerEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
    event.preventDefault(); // Space иначе прокрутит страницу
    togglePause();
  }
});

// Android WebView не должен открывать меню выделения по долгому нажатию.
document.addEventListener("contextmenu", (event) => event.preventDefault());

document.addEventListener("visibilitychange", resumeIfNeeded);
window.addEventListener("focus", resumeIfNeeded);
window.addEventListener("pageshow", resumeIfNeeded);

async function init() {
  syncPickers();
  render(); // показываем 30:00 и aria-label «Запустить таймер», но не запускаем

  try {
    await ensurePermission();
  } catch (err) {
    console.error("Не удалось получить разрешение:", err);
  }
}

2init();