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

        <!-- 3. Лучшие предметы с частью твоих свойств (trade2) -->
        <div :class="$style.subhead">Лучшие предметы с частью твоих свойств</div>
        <button
          :class="$style.btn"
          :disabled="refLoading"
          @click="findReference"
        >
          {{ refLoading ? "Ищу на trade2…" : "🔎 Найти эталон (trade2)" }}
        </button>
        <div v-if="refError" :class="$style.error">{{ refError }}</div>
        <ul v-if="topReferences.length" :class="$style.refs">
          <li v-for="(r, i) in topReferences" :key="i" :class="$style.refItem">
            <div :class="$style.refPrice">{{ r.price }} {{ r.currency }}</div>
            <div :class="$style.refMods">{{ r.modLines.slice(0, 4).join(" · ") }}</div>
          </li>
        </ul>

        <!-- 4. Как скрафтить -->
        <template v-if="analysis.modifiable">
          <div :class="$style.subhead">Как скрафтить</div>
          <template v-if="diff">
            <div :class="$style.craftLabel">Есть у дорогих — оставить:</div>
            <ul :class="$style.mods">
              <li v-for="(s, i) in diff.keep" :key="'k' + i" :class="$style.modLine">
                ✓ {{ s }}
              </li>
              <li v-if="!diff.keep.length" :class="$style.note">— ничего из твоего не совпало</li>
            </ul>
            <div :class="$style.craftLabel">Добавить (частые у дорогих, у тебя нет):</div>
            <ul :class="$style.mods">
              <li v-for="(m, i) in diff.missing.slice(0, 6)" :key="'m' + i" :class="$style.modLine">
                + {{ m.shape }} <span :class="$style.k">({{ m.count }})</span>
              </li>
              <li v-if="!diff.missing.length" :class="$style.note">— нечего добавить</li>
            </ul>
          </template>
          <ul v-else :class="$style.candidates">
            <li v-for="(c, i) in candidates" :key="i" :class="$style.candidate">
              <span :class="c.kind === 'fill-slot' ? $style.fill : $style.improve">
                {{ c.kind === "fill-slot" ? "+" : "↑" }}
              </span>
              {{ c.reason }}
            </li>
            <li v-if="!candidates.length" :class="$style.note">
              Найди эталон выше — посчитаю что добавить. Пока: предмет уже плотный.
            </li>
          </ul>
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
        <div v-else :class="$style.note">
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
import { diffReference, type ReferenceListing } from "./diff";
import { fetchReference } from "./trade-reference";
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
const candidates = computed(() =>
  analysis.value ? narrowCandidates(analysis.value) : [],
);
const itemMods = computed(() =>
  item.value ? describeItemMods(item.value.rawText) : [],
);

// Слой 2–3: эталон из trade2 + diff
const references = ref<ReferenceListing[]>([]);
const refLoading = ref(false);
const refError = ref<string | null>(null);

const diff = computed(() =>
  references.value.length
    ? diffReference(itemMods.value, references.value)
    : null,
);
const topReferences = computed(() =>
  [...references.value].sort((a, b) => b.price - a.price).slice(0, 5),
);

async function findReference() {
  if (!item.value) return;
  refLoading.value = true;
  refError.value = null;
  references.value = [];
  try {
    references.value = await fetchReference(item.value);
    if (!references.value.length) refError.value = "Листингов не найдено.";
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
  references.value = [];
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
