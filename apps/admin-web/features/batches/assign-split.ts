// Stitching split rules for the assign panel (U3). Pure functions, no UI.
//
// - `ids` are always in load order: least busy first (GET /stitchers/load order).
// - Each person's floor is max(done, 1): a quota can't drop below what they've stitched,
//   and the backend refuses a 0 target.
// - Quotas always add up to the batch quantity (backend rule).

export type Targets = Record<string, number>;

/** Smallest target a stitcher can hold. */
export const floorOf = (done: number | undefined) => Math.max(done ?? 0, 1);

const get = (t: Targets, id: string) => t[id] ?? 0;

/**
 * Hand out `total` mats across `ids`, starting each at its floor, then one mat at a time to
 * whoever currently has the fewest — ties go to the least busy (earlier in `ids`).
 * Gives an even split with any remainder to the least busy. Returns null when the floors
 * alone exceed the total (more people ticked than mats).
 */
export function fill(total: number, ids: string[], done: Targets): Targets | null {
  const out: Targets = {};
  for (const id of ids) out[id] = floorOf(done[id]);
  let left = total - sumOf(ids, out);
  if (left < 0) return null;
  while (left > 0 && ids.length) {
    let pick = ids[0] as string;
    for (const id of ids) if (get(out, id) < get(out, pick)) pick = id;
    out[pick] = get(out, pick) + 1;
    left -= 1;
  }
  return out;
}

/**
 * One number was edited. The edited value is clamped so everyone else can still reach their
 * floor; the rest is spread over the others that weren't edited by hand (`pinned`), or over
 * all others when every one of them is pinned. Returns the new targets and the new pinned set.
 */
export function rebalance(
  total: number,
  ids: string[],
  current: Targets,
  done: Targets,
  pinned: ReadonlySet<string>,
  editedId: string,
  value: number,
): { targets: Targets; pinned: Set<string> } {
  const others = ids.filter((id) => id !== editedId);
  let absorbers = others.filter((id) => !pinned.has(id));
  if (!absorbers.length) absorbers = others;
  const fixed = others.filter((id) => !absorbers.includes(id));
  const fixedSum = sumOf(fixed, current);
  const absorberFloors = absorbers.reduce((s, id) => s + floorOf(done[id]), 0);

  const own = floorOf(done[editedId]);
  const max = Math.max(total - fixedSum - absorberFloors, own);
  const v = Math.min(Math.max(value, own), max);

  const targets: Targets = {};
  for (const id of fixed) targets[id] = get(current, id);
  Object.assign(targets, fill(total - fixedSum - v, absorbers, done) ?? {});
  targets[editedId] = v;
  return { targets, pinned: new Set([...fixed, editedId]) };
}

export function sumOf(ids: string[], t: Targets) {
  return ids.reduce((s, id) => s + get(t, id), 0);
}
