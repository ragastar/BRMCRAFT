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
      <template v-if="item">
        <div :class="$style.itemName">
          {{ item.info.name || item.info.refName }}
        </div>
        <div :class="$style.base">{{ item.info.refName }}</div>
        <div :class="$style.rows">
          <div :class="$style.row">
            <span :class="$style.k">iLvl</span>
            <span>{{ item.itemLevel ?? "—" }}</span>
          </div>
          <div :class="$style.row">
            <span :class="$style.k">Модов</span>
            <span>{{ modCount }}</span>
          </div>
        </div>
        <div :class="$style.note">Слой 0 (парсинг + слоты) — скоро.</div>
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

const modCount = computed(
  () => (item.value?.statsByType?.length ?? item.value?.newMods?.length ?? 0),
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
  @apply text-xs text-gray-500 mt-1;
}
.empty {
  @apply text-xs text-gray-500;
}
</style>
