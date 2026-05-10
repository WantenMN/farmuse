import { StateEffect, StateField } from "@codemirror/state";

export const setHoveredLine = StateEffect.define<number | null>();
export const hoveredLineField = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHoveredLine)) return effect.value;
    }
    return value;
  },
});

export const setSourceModeImage = StateEffect.define<{
  from: number;
  to: number;
} | null>();
export const sourceModeImageField = StateField.define<{
  from: number;
  to: number;
} | null>({
  create: () => null,
  update(value, tr) {
    let result = value;
    for (const effect of tr.effects) {
      if (effect.is(setSourceModeImage)) {
        result = effect.value;
      }
    }
    if (result) {
      const from = tr.changes.mapPos(result.from, -1);
      const to = tr.changes.mapPos(result.to, 1);
      const sel = tr.state.selection.main;
      if (sel.from < from || sel.to > to) return null;
      return { from, to };
    }
    return result;
  },
});
