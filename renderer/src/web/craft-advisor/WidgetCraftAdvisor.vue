<template>
  <Widget
    :config="{ ...config, anchor }"
    move-handles="none"
    :removable="false"
    :inline-edit="false"
  >
    <div :class="$style.panel">
      <div :class="$style.header">
        <span :class="$style.brand">BRM</span> Craft Advisor
      </div>
      <template v-if="item && analysis">
        <!-- 1. Твой предмет -->
        <div :class="$style.itemName">
          {{ item.info.name || item.info.refName }}
        </div>
        <div :class="$style.base">
          {{ item.info.refName }} · iLvl {{ item.itemLevel ?? "—" }} ·
          П {{ analysis.prefixes.occupied.length }}/{{ analysis.prefixes.max }} ·
          С {{ analysis.suffixes.occupied.length }}/{{ analysis.suffixes.max }}
        </div>

        <!-- 2. Свойства (реальные значения, не названия) -->
        <div :class="$style.subhead">Свойства</div>
        <ul :class="$style.mods">
          <li
            v-for="(m, i) in itemMods"
            :key="i"
            :class="$style.mod"
          >
            <span :class="m.affix === 'prefix' ? $style.pfx : $style.sfx">
              {{ m.affix === "prefix" ? "P" : "S" }}<template v-if="m.tier">·T{{ m.tier }}</template>
            </span>
            <span :class="$style.modLines">
              <span v-for="(l, j) in m.lines" :key="j" :class="$style.modLine">{{ l }}</span>
            </span>
          </li>
          <li v-if="!itemMods.length" :class="$style.note">
            Нет explicit-модов (или буфер без advanced-описаний).
          </li>
        </ul>

        <!-- 3. Шаблон базы (что носят сравнимые кольца) -->
        <div :class="$style.subhead">Шаблон базы</div>
        <button
          :class="$style.btn"
          :disabled="refLoading"
          @click="findReference"
        >
          {{ refLoading ? "Считаю по trade2…" : "🔎 Собрать шаблон (trade2)" }}
        </button>
        <div v-if="refError" :class="$style.error">{{ refError }}</div>
        <table v-if="recs" :class="$style.tpl">
          <tr :class="$style.tplHead"><td>мод</td><td>носят</td><td>тир</td></tr>
          <tr v-for="(e, i) in recs.template.slice(0, 8)" :key="i">
            <td :class="e.mine ? $style.tplMine : ''">
              <span v-if="e.mine" :class="$style.fill">✓</span> {{ e.shape }}
            </td>
            <td :class="$style.tplNum">{{ e.pct }}%</td>
            <td :class="$style.tplNum">{{ e.bestTier != null ? "T" + e.bestTier : "—" }}</td>
          </tr>
        </table>

        <!-- 4. Рекомендации -->
        <template v-if="recs">
          <div :class="$style.subhead">Рекомендации</div>
          <div :class="$style.craftLabel">Поднять тир (у тебя ниже достижимого):</div>
          <ul :class="$style.mods">
            <li v-for="(d, i) in recs.improve" :key="'i' + i" :class="$style.modLine">
              <span :class="$style.improve">↑</span> {{ d.shape }}: T{{ d.myTier }} → T{{ d.bestTier }}
              <span :class="$style.k">(носят {{ d.pct }}%)</span>
            </li>
            <li v-if="!recs.improve.length" :class="$style.note">— твои моды уже на максимуме</li>
          </ul>
          <div :class="$style.craftLabel">Добавить (частые, у тебя нет):</div>
          <ul :class="$style.mods">
            <li v-for="(d, i) in recs.add.slice(0, 6)" :key="'a' + i" :class="$style.modLine">
              <span :class="$style.fill">+</span> {{ d.shape }}
              <span :class="$style.k">(носят {{ d.pct }}%{{ d.bestTier != null ? ", до T" + d.bestTier : "" }})</span>
            </li>
            <li v-if="!recs.add.length" :class="$style.note">— нечего добавить из частого</li>
          </ul>
          <div :class="$style.note">
            Слоты: префиксы {{ analysis.prefixes.free }} своб., суффиксы {{ analysis.suffixes.free }} своб.
          </div>
          <button
            :class="$style.btn"
            :disabled="strategyLoading"
            @click="getStrategy"
          >
            {{ strategyLoading ? "Думаю…" : "🛠 Подробнее от Claude (опционально)" }}
          </button>
          <div v-if="strategyError" :class="$style.error">
            {{ strategyError }}
          </div>
          <div v-if="strategy" :class="$style.strategy">{{ strategy }}</div>
        </template>
        <div v-if="!analysis.modifiable" :class="$style.note">
          Предмет не крафтится (не rare/magic).
        </div>
      </template>
      <div v-else :class="$style.empty">
        Наведись на предмет и нажми хоткей.
      </div>
    </div>
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from "../overlay/interfaces";
import type { CraftAdvisorWidget } from "./widget.js";

export default {
  widget: {
    type: "craft-advisor",
    instances: "single",
    trNameKey: "craft_advisor.name",
    initInstance: (): CraftAdvisorWidget => {
      return {
        wmId: 0,
        wmType: "craft-advisor",
        wmTitle: "",
        wmWants: "hide",
        wmZorder: "exclusive",
        wmFlags: ["hide-on-blur", "menu::skip"],
        hotkey: "Ctrl + E",
        openRouterKey: "",
        strategyModel: "sonnet",
      };
    },
  } satisfies WidgetSpec,
};
</script>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { MainProcess } from "@/web/background/IPC";
import { parseClipboard, ParsedItem } from "@/parser";
import type { WidgetManager } from "../overlay/interfaces";
import { analyzeAffixSlots } from "./layer0";
import { narrowCandidates } from "./layer1";
import { describeItemMods } from "./item-mods";
import { normalizeStatLine } from "./diff";
import {
  buildTemplate,
  recommend,
  type RefItem,
  type MyMod,
} from "./base-template";
import { fetchComparables } from "./trade-reference";
import { buildStrategyPrompt } from "./strategy-prompt";
import { requestStrategy } from "./strategy-client";

import Widget from "../overlay/Widget.vue";

const props = defineProps<{
  config: CraftAdvisorWidget;
}>();

const wm = inject<WidgetManager>("wm")!;

const checkPosition = ref({ x: 1, y: 1 });
const item = ref<ParsedItem | null>(null);

MainProcess.onEvent("MAIN->CLIENT::item-text", (e) => {
  if (e.target !== "craft-advisor") return;

  checkPosition.value = e.position;
  item.value = parseClipboard(e.clipboard).unwrapOr(null);
  if (item.value) {
    wm.show(props.config.wmId);
  }
});

props.config.wmWants = "hide";

const analysis = computed(() =>
  item.value ? analyzeAffixSlots(item.value) : null,
);
const itemMods = computed(() =>
  item.value ? describeItemMods(item.value.rawText) : [],
);
const candidates = computed(() =>
  analysis.value ? narrowCandidates(analysis.value) : [],
);

// твои моды как {shape, tier, affix} — из текста игры (надёжно)
const myMods = computed<MyMod[]>(() =>
  itemMods.value.flatMap((m) =>
    m.lines.map((l) => ({
      shape: normalizeStatLine(l),
      tier: m.tier ?? null,
      affix: m.affix,
    })),
  ),
);

// Слой 2–3: шаблон базы из сравнимых колец (частота модов + лучший тир)
const comparables = ref<RefItem[]>([]);
const refLoading = ref(false);
const refError = ref<string | null>(null);

const recs = computed(() =>
  comparables.value.length
    ? recommend(buildTemplate(comparables.value), myMods.value)
    : null,
);

async function findReference() {
  if (!item.value) return;
  refLoading.value = true;
  refError.value = null;
  comparables.value = [];
  try {
    comparables.value = await fetchComparables(item.value);
    if (!comparables.value.length) refError.value = "Сравнимых колец не найдено.";
  } catch (e) {
    refError.value = (e as Error).message;
  } finally {
    refLoading.value = false;
  }
}

const strategy = ref<string | null>(null);
const strategyLoading = ref(false);
const strategyError = ref<string | null>(null);

async function getStrategy() {
  if (!analysis.value) return;
  strategyLoading.value = true;
  strategyError.value = null;
  strategy.value = null;
  try {
    const prompt = buildStrategyPrompt({
      analysis: analysis.value,
      candidates: candidates.value,
    });
    strategy.value = await requestStrategy(prompt, {
      model: props.config.strategyModel,
    });
  } catch (e) {
    strategyError.value = (e as Error).message;
  } finally {
    strategyLoading.value = false;
  }
}

// Сбрасываем стратегию при новом предмете
MainProcess.onEvent("MAIN->CLIENT::item-text", (e) => {
  if (e.target !== "craft-advisor") return;
  strategy.value = null;
  strategyError.value = null;
  comparables.value = [];
  refError.value = null;
});

const anchor = computed(() => {
  const width = wm.size.value.width;
  const poePanelWidth = wm.poePanelWidth.value;

  const side =
    checkPosition.value.x > window.screenX + width / 2 ? "inventory" : "stash";

  return {
    pos: side === "stash" ? "cl" : "cr",
    y: 50,
    x:
      side === "stash"
        ? (poePanelWidth / width) * 100
        : ((width - poePanelWidth) / width) * 100,
  };
});
</script>

<style lang="postcss" module>
.panel {
  @apply bg-gray-800 text-gray-200 rounded p-3;
  min-width: 16rem;
  box-shadow: 0px 0px 1px 2px rgb(255 255 255 / 15%);
}
.header {
  @apply font-bold mb-2 text-yellow-300;
}
.brand {
  @apply text-yellow-400;
  letter-spacing: 1px;
}
.itemName {
  @apply text-base;
}
.base {
  @apply text-xs text-gray-400 mb-2;
}
.rows {
  @apply flex flex-col gap-1 mb-2;
}
.row {
  @apply flex justify-between text-sm;
}
.k {
  @apply text-gray-400;
}
.note {
  @apply text-xs text-gray-500 mt-2;
}
.empty {
  @apply text-xs text-gray-500;
}
.subhead {
  @apply text-xs font-semibold text-gray-300 mt-3 mb-1;
  border-top: 1px solid theme("colors.gray.700");
  @apply pt-2;
}
.mods {
  @apply flex flex-col gap-1;
}
.mod {
  @apply flex gap-2 items-start text-sm;
}
.pfx {
  @apply text-blue-300 font-mono text-xs whitespace-nowrap;
}
.sfx {
  @apply text-orange-300 font-mono text-xs whitespace-nowrap;
}
.modLines {
  @apply flex flex-col;
}
.modLine {
  @apply text-gray-100;
}
.refs {
  @apply flex flex-col gap-1 mt-1;
}
.refItem {
  @apply flex flex-col text-sm border-l-2 pl-2;
  border-color: theme("colors.yellow.600");
}
.refPrice {
  @apply text-yellow-300 font-semibold;
}
.refMods {
  @apply text-xs text-gray-300;
}
.craftLabel {
  @apply text-xs text-gray-400 mt-2 mb-1;
}
.tpl {
  @apply w-full mt-1 text-sm;
  border-collapse: collapse;
}
.tplHead td {
  @apply text-xs text-gray-500 pb-1;
}
.tpl td:nth-child(2),
.tpl td:nth-child(3) {
  @apply text-right whitespace-nowrap pl-2;
}
.tplNum {
  @apply text-gray-300;
}
.tplMine {
  @apply text-green-300;
}
.candidates {
  @apply flex flex-col gap-1;
}
.candidate {
  @apply text-sm text-gray-200 flex gap-2 items-start;
}
.fill {
  @apply text-green-400 font-bold;
}
.improve {
  @apply text-yellow-400 font-bold;
}
.btn {
  @apply mt-3 w-full px-2 py-1 rounded bg-gray-700 text-gray-100 text-sm;
}
.btn:hover:not(:disabled) {
  @apply bg-gray-600;
}
.btn:disabled {
  @apply opacity-60;
}
.error {
  @apply mt-2 text-xs text-red-400 whitespace-pre-wrap break-all select-text;
  max-height: 12rem;
  overflow-y: auto;
  user-select: text;
}
.strategy {
  @apply mt-2 text-sm text-gray-100 whitespace-pre-wrap;
  max-height: 22rem;
  overflow-y: auto;
}
.keyRow {
  @apply mt-3 flex flex-col gap-1;
}
.keyInput {
  @apply px-2 py-1 rounded bg-gray-900 text-gray-100 text-sm;
  border: 1px solid theme("colors.gray.600");
}
</style>
