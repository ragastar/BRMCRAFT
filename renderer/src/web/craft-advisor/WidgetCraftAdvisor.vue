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
        <div :class="$style.note">
          Слой 2 (цены trade2) и стратегия — следующие этапы.
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
</style>
