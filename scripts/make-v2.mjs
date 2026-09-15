// Собирает v2.html из index.html: вариант 2 = вариант 1 плюс пять панелей
// после «Экран — под вас» и блок «Чего нет ни у кого» у инвесторов.
// Запускается автоматически перед сборкой (npm run build → prebuild).
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("index.html", "utf8");

const anchor = `              Ваши инициалы, логотип компании или просто зрачок. Для первых ста заказов — любая
              гравировка бесплатно.
            </p>
          </div>
        </section>
`;
if (!src.includes(anchor)) throw new Error("make-v2: не нашёл панель «Экран — под вас»");

const extra = `
        <section class="panel" data-eye="dots">
          <div class="panel__text">
            <h2>Ваши слова — ваш актив.</h2>
            <p class="muted">
              Каждая встреча, каждое обещание, каждое решение складываются в один файл, который
              принадлежит вам. Это ваш личный контекст: кто вы, с кем работаете, что для вас
              важно. Загрузите его в любую нейросеть — и она будет знать вас, а не отвечать
              вслепую. Первая версия Левина ведёт к одному: чтобы через месяц у вас был контекст
              о себе, а не пачка записей.
            </p>
          </div>
        </section>

        <section class="panel" data-eye="flash">
          <div class="panel__text">
            <h2>Отметьте момент одной кнопкой.</h2>
            <p class="muted">
              Короткое нажатие во время встречи — и в итогах это место выделено. Вы сами говорите
              машине, что важно, и получаете не пересказ, а то, что вам нужно.
            </p>
          </div>
        </section>

        <section class="panel" data-eye="lines">
          <div class="panel__text">
            <h2>Знает, как говорят юристы.</h2>
            <p class="muted">
              Словарь под вашу профессию: договоры, счета, судебные термины распознаются как надо.
              Для первых ста заказов словарь собираем вместе с вами.
            </p>
          </div>
        </section>

        <section class="panel" data-eye="pause">
          <div class="panel__text">
            <h2>Собеседник видит. И&nbsp;соглашается.</h2>
            <p class="muted">
              Красный глаз — идёт запись, это видят все. Во второй версии Левин услышит новый голос
              и поставит запись на паузу, пока человек не скажет «да». Честная запись —
              единственная, которой доверяют.
            </p>
          </div>
        </section>

        <section class="panel" data-eye="initials">
          <div class="panel__text">
            <h2>Подарок, который не уберут в ящик.</h2>
            <p class="muted">
              Левин для команды или для партнёра: логотип компании на корпусе, имя на экране,
              и при включении — личное приветствие: «Доброе утро, Марина. Сегодня четыре встречи.»
              От десяти штук — свой цвет корпуса и словарь под вашу отрасль.
            </p>
            <!-- TODO: адрес для корпоративных заказов владелец даст отдельно -->
            <a class="btn btn--inline" href="mailto:?subject=%D0%9A%D0%BE%D1%80%D0%BF%D0%BE%D1%80%D0%B0%D1%82%D0%B8%D0%B2%D0%BD%D1%8B%D0%B9%20%D0%B7%D0%B0%D0%BA%D0%B0%D0%B7%20%D0%9B%D0%B5%D0%B2%D0%B8%D0%BD">Запросить корпоративный заказ</a>
          </div>
        </section>
`;

const statsEnd = `              <div class="stat"><b>0</b><span>российских производителей</span></div>
            </div>
`;
if (!src.includes(statsEnd)) throw new Error("make-v2: не нашёл цифры у инвесторов");

const unique = statsEnd + `            <div class="unique">
              <p class="eyebrow">Чего нет ни у кого</p>
              <p>Работает из России и платится рублями.</p>
              <p>Честная запись с согласием собеседника.</p>
              <p>Личный контекст, который забираешь с собой.</p>
            </div>
`;

const out = src.replace(anchor, anchor + extra).replace(statsEnd, unique);
writeFileSync("v2.html", out);
console.log("v2.html собран из index.html");
