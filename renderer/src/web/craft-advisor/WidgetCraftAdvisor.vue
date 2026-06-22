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
        <div :class="$style.itemName">
          {{ item.info.name || item.info.refName }}
        </div>
        <div :class="$style.base">
          {{ item.info.refName }} · iLvl {{ item.itemLevel ?? "—" }}
        </div>

        <div v-if="analysis.modifiable" :class="$style.rows">
          <div :class="$style.row">
            <span :class="$style.k">Префиксы</span>
            <span>{{ analysis.prefixes.occupied.length }}/{{ analysis.prefixes.max }}</span>
          </div>
          <div :class="$style.row">
            <span :class="$style.k">Суффиксы</span>
            <span>{{ analysis.suffixes.occupied.length }}/{{ analysis.suffixes.max }}</span>
          </div>
        </div>
        <div v-else :class="$style.note">
          Предмет не крафтится (не rare/magic).
        </div>

        <template v-if="candidates.length">
          <div :class="$style.subhead">Кандидаты на проверку</div>
          <ul :class="$style.candidates">
            <li v-for="(c, i) in candidates" :key="i" :class="$style.candidate">
              <span :class="c.kind === 'fill-slot' ? $style.fill : $style.improve">
                {{ c.kind === "fill-slot" ? "+" : "↑" }}
              </span>
              {{ c.reason }}
            </li>
          </ul>
        </template>
        <template v-if="analysis.modifiable">
          <div v-if="!config.openRouterKey" :class="$style.keyRow">
            <input
              v-model="keyInput"
              type="password"
              placeholder="OpenRouter API-ключ"
              :class="$style.keyInput"
            />
            <button :class="$style.btn" @click="saveKey">Сохранить ключ</button>
          </div>
          <button
            v-else
            :class="$style.btn"
            :disabled="strategyLoading"
            @click="getStrategy"
          >
            {{ strategyLoading ? "Думаю…" : "🛠 План крафта (Claude)" }}
          </button>
          <div v-if="strategyError" :class="$style.error">
            {{ strategyError }}
          </div>
          <div v-if="strategy" :class="$style.strategy">{{ strategy }}</div>
        </template>
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
        strategyModel: "anthropic/claude-sonnet-4",
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

const strategy = ref<string | null>(null);
const strategyLoading = ref(false);
const strategyError = ref<string | null>(null);

const keyInput = ref("");
function saveKey() {
  props.config.openRouterKey = keyInput.value.trim();
}

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
      apiKey: props.config.openRouterKey,
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
  @apply text-xs font-semibold text-gray-300 mt-2 mb-1;
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
  @apply mt-2 text-xs text-red-400;
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
