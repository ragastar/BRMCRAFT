// Лист ожидания. Заявка уходит POST-ом на серверлесс-функцию (worker/), которая
// пересылает её в Telegram. Адрес функции — VITE_WAITLIST_ENDPOINT на этапе сборки.
//
// TODO: пока VITE_WAITLIST_ENDPOINT не задан (см. .env.example и worker/README.md),
// форма работает в режиме «записали»: показывает подтверждение, но никуда
// не отправляет и пишет заявку в консоль.

const ENDPOINT = (import.meta.env.VITE_WAITLIST_ENDPOINT || "").trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function initWaitlistForm(form) {
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const done = form.querySelector(".form__done");
  const error = form.querySelector(".form__error");
  const fields = [...form.querySelectorAll("input")];
  const label = button.textContent;

  const showError = (text) => {
    error.textContent = text;
    error.hidden = false;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    if (!name) return showError("Напишите, как вас зовут.");
    if (!EMAIL_RE.test(email)) return showError("Проверьте адрес почты.");

    button.disabled = true;
    button.textContent = "Отправляем…";
    try {
      if (ENDPOINT) {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, email, company: form.elements.company?.value || "", page: location.href }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        // TODO: подключить воркер — см. worker/README.md
        console.warn("[waitlist] VITE_WAITLIST_ENDPOINT не задан — заявка не отправлена:", { name, email });
      }
      fields.forEach((f) => (f.hidden = true));
      button.hidden = true;
      done.hidden = false;
    } catch (err) {
      console.error("[waitlist]", err);
      button.disabled = false;
      button.textContent = label;
      showError("Не получилось отправить. Попробуйте ещё раз через минуту.");
    }
  });
}
