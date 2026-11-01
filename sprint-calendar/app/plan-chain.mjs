const DAY_MS = 86_400_000;
const PERIOD_START_MINUTES = {
  上午: 8 * 60,
  下午: 14 * 60,
  晚上: 19 * 60 + 30,
};

function taskStartMinutes(task) {
  const matched = /^(\d{2}):(\d{2})$/.exec(task.startTime ?? "");
  if (matched) return Number(matched[1]) * 60 + Number(matched[2]);
  return PERIOD_START_MINUTES[task.period] ?? Number.MAX_SAFE_INTEGER;
}

export function compareTasksByTime(left, right) {
  return taskStartMinutes(left) - taskStartMinutes(right)
    || (left.chainOrder ?? Number.MAX_SAFE_INTEGER) - (right.chainOrder ?? Number.MAX_SAFE_INTEGER)
    || left.id.localeCompare(right.id);
}

export function addIsoDays(value, amount) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isoDayDistance(from, to) {
  const parse = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).getTime();
  };
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

export function orderedChain(tasks, chainId) {
  return tasks
    .filter((item) => item.chainId === chainId)
    .sort((left, right) => {
      const orderDiff = (left.chainOrder ?? Number.MAX_SAFE_INTEGER) - (right.chainOrder ?? Number.MAX_SAFE_INTEGER);
      return orderDiff || left.date.localeCompare(right.date) || left.id.localeCompare(right.id);
    });
}

function withOrders(items) {
  return items.map((item, index) => ({ ...item, chainOrder: index }));
}

export function insertIntoChain(tasks, anchorId, insertedTask, position, done = {}) {
  const anchor = tasks.find((item) => item.id === anchorId);
  if (!anchor?.chainId) return [...tasks, insertedTask];
  if (anchor.locked) return tasks;

  const chain = orderedChain(tasks, anchor.chainId);
  const anchorIndex = chain.findIndex((item) => item.id === anchorId);
  const insertIndex = anchorIndex + (position === "after" ? 1 : 0);
  const insertedDate = position === "after" ? addIsoDays(anchor.date, 1) : anchor.date;
  const prepared = { ...insertedTask, chainId: anchor.chainId, chainName: anchor.chainName, date: insertedDate };
  let fixedAnchorReached = false;
  const shifted = chain.map((item, index) => {
    if (index < insertIndex) return item;
    if (item.locked) fixedAnchorReached = true;
    if (fixedAnchorReached || done[item.id]) return item;
    return { ...item, date: addIsoDays(item.date, 1) };
  });
  shifted.splice(insertIndex, 0, prepared);
  const replacements = new Map(withOrders(shifted).map((item) => [item.id, item]));
  return [...tasks.map((item) => replacements.get(item.id) ?? item), replacements.get(prepared.id)];
}

export function deleteFromChain(tasks, taskId, done = {}) {
  const removed = tasks.find((item) => item.id === taskId);
  if (!removed) return tasks;
  if (removed.locked) return tasks;
  if (!removed.chainId) return tasks.filter((item) => item.id !== taskId);

  const chain = orderedChain(tasks, removed.chainId);
  const removedIndex = chain.findIndex((item) => item.id === taskId);
  let fixedAnchorReached = false;
  const remaining = chain
    .filter((item) => item.id !== taskId)
    .map((item, index) => {
      const wasAfter = index >= removedIndex;
      if (wasAfter && item.locked) fixedAnchorReached = true;
      return wasAfter && !fixedAnchorReached && !done[item.id] ? { ...item, date: addIsoDays(item.date, -1) } : item;
    });
  const replacements = new Map(withOrders(remaining).map((item) => [item.id, item]));
  return tasks
    .filter((item) => item.id !== taskId)
    .map((item) => replacements.get(item.id) ?? item);
}

export function moveInChain(tasks, taskId, direction, done = {}) {
  const moved = tasks.find((item) => item.id === taskId);
  if (!moved?.chainId || moved.locked) return tasks;

  const chain = orderedChain(tasks, moved.chainId);
  const from = chain.findIndex((item) => item.id === taskId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= chain.length) return tasks;
  if (chain[to].locked) return tasks;

  const reordered = [...chain];
  [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
  const unfinishedDates = chain
    .filter((item) => !done[item.id] && !item.locked)
    .map((item) => item.date)
    .sort();
  let dateIndex = 0;
  const scheduled = withOrders(
    reordered.map((item) => {
      if (done[item.id] || item.locked) return item;
      return { ...item, date: unfinishedDates[dateIndex++] };
    }),
  );
  const replacements = new Map(scheduled.map((item) => [item.id, item]));
  return tasks.map((item) => replacements.get(item.id) ?? item);
}

export function shiftFollowing(tasks, taskId, dayDelta, done = {}) {
  if (!dayDelta) return tasks;
  const changed = tasks.find((item) => item.id === taskId);
  if (!changed?.chainId) return tasks;
  const chain = orderedChain(tasks, changed.chainId);
  const index = chain.findIndex((item) => item.id === taskId);
  const movableFollowers = [];
  for (const item of chain.slice(index + 1)) {
    if (item.locked) break;
    if (!done[item.id]) movableFollowers.push(item);
  }
  const replacements = new Map(
    movableFollowers
      .map((item) => [item.id, { ...item, date: addIsoDays(item.date, dayDelta) }]),
  );
  return tasks.map((item) => replacements.get(item.id) ?? item);
}

export function shiftTaskBlock(tasks, taskId, dayDelta, done = {}) {
  if (!dayDelta) return tasks;
  const changed = tasks.find((item) => item.id === taskId);
  if (!changed || changed.locked || done[changed.id]) return tasks;
  if (!changed.chainId) {
    return tasks.map((item) => item.id === taskId ? { ...item, date: addIsoDays(item.date, dayDelta) } : item);
  }

  const chain = orderedChain(tasks, changed.chainId);
  const index = chain.findIndex((item) => item.id === taskId);
  const movableIds = new Set();
  for (const item of chain.slice(index)) {
    if (item.locked) break;
    if (!done[item.id]) movableIds.add(item.id);
  }
  return tasks.map((item) => movableIds.has(item.id) ? { ...item, date: addIsoDays(item.date, dayDelta) } : item);
}
