import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  compareTasksByTime,
  deleteFromChain,
  insertIntoChain,
  moveInChain,
  shiftFollowing,
  shiftTaskBlock,
} from "../app/plan-chain.mjs";
import { createResourceServer, normalizeLocalPath } from "../scripts/local-resource-server.mjs";

const task = (id, date, chainId = "physics") => ({
  id,
  date,
  title: id,
  chainId,
  chainName: chainId,
  chainOrder: Number(id.slice(1)),
});

test("calendar tasks are strictly ordered by exact start time", () => {
  const unordered = [
    { ...task("p2", "2026-07-30"), period: "晚上", startTime: "19:30" },
    { ...task("p1", "2026-07-30"), period: "下午", startTime: "14:00" },
    { ...task("p0", "2026-07-30"), period: "上午", startTime: "08:00" },
  ];
  assert.deepEqual(unordered.sort(compareTasksByTime).map((item) => item.startTime), ["08:00", "14:00", "19:30"]);
});

test("insertion only postpones unfinished successors in the same chain", () => {
  const tasks = [task("p0", "2026-08-01"), task("p1", "2026-08-02"), task("p2", "2026-08-03"), task("m0", "2026-08-02", "math")];
  const result = insertIntoChain(tasks, "p1", task("p-new", "2026-01-01"), "before", { p2: true });
  assert.equal(result.find((item) => item.id === "p-new").date, "2026-08-02");
  assert.equal(result.find((item) => item.id === "p1").date, "2026-08-03");
  assert.equal(result.find((item) => item.id === "p2").date, "2026-08-03");
  assert.equal(result.find((item) => item.id === "m0").date, "2026-08-02");
});

test("delete pulls later unfinished nodes forward but leaves completed nodes fixed", () => {
  const tasks = [task("p0", "2026-08-01"), task("p1", "2026-08-02"), task("p2", "2026-08-03")];
  const result = deleteFromChain(tasks, "p0", { p2: true });
  assert.equal(result.find((item) => item.id === "p1").date, "2026-08-01");
  assert.equal(result.find((item) => item.id === "p2").date, "2026-08-03");
});

test("reorder preserves the chain date slots and shift edit ignores other chains", () => {
  const tasks = [task("p0", "2026-08-01"), task("p1", "2026-08-02"), task("m0", "2026-08-02", "math")];
  const reordered = moveInChain(tasks, "p1", -1);
  assert.equal(reordered.find((item) => item.id === "p1").date, "2026-08-01");
  assert.equal(reordered.find((item) => item.id === "p0").date, "2026-08-02");
  const shifted = shiftFollowing(reordered, "p1", 2);
  assert.equal(shifted.find((item) => item.id === "p0").date, "2026-08-04");
  assert.equal(shifted.find((item) => item.id === "m0").date, "2026-08-02");
});

test("fixed training anchors cannot move and stop schedule propagation", () => {
  const fixed = { ...task("m1", "2026-08-03", "math"), locked: true };
  const tasks = [
    task("m0", "2026-08-02", "math"),
    fixed,
    task("m2", "2026-08-04", "math"),
    task("p0", "2026-08-02", "physics"),
  ];

  const shifted = shiftTaskBlock(tasks, "m0", 1);
  assert.equal(shifted.find((item) => item.id === "m0").date, "2026-08-03");
  assert.equal(shifted.find((item) => item.id === "m1").date, "2026-08-03");
  assert.equal(shifted.find((item) => item.id === "m2").date, "2026-08-04");
  assert.equal(shifted.find((item) => item.id === "p0").date, "2026-08-02");

  assert.strictEqual(moveInChain(tasks, "m1", 1), tasks);
  assert.strictEqual(moveInChain(tasks, "m0", 1), tasks);
  assert.strictEqual(deleteFromChain(tasks, "m1"), tasks);
  assert.strictEqual(insertIntoChain(tasks, "m1", task("mx", "2026-01-01", "math"), "before"), tasks);
});

test("standalone tasks move by themselves while completed chain nodes stay put", () => {
  const tasks = [
    task("p0", "2026-08-01"),
    task("p1", "2026-08-02"),
    { ...task("solo", "2026-08-01"), chainId: undefined, chainName: undefined },
  ];
  const standalone = shiftTaskBlock(tasks, "solo", 2);
  assert.equal(standalone.find((item) => item.id === "solo").date, "2026-08-03");
  assert.equal(standalone.find((item) => item.id === "p0").date, "2026-08-01");

  const completed = shiftTaskBlock(tasks, "p0", 1, { p0: true });
  assert.strictEqual(completed, tasks);
});

test("local opener accepts only absolute Windows file paths", () => {
  assert.equal(normalizeLocalPath("E:\\学习\\book.pdf"), "E:\\学习\\book.pdf");
  assert.equal(normalizeLocalPath("..\\book.pdf"), null);
  assert.equal(normalizeLocalPath("https://example.com/book.pdf"), null);
  assert.equal(normalizeLocalPath("E:\nbook.pdf"), null);
});

test("local opener API checks the file and passes it to the Windows launcher adapter", async (context) => {
  let opened = "";
  const server = createResourceServer({ openPath: (target) => { opened = target; } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const target = path.join(process.cwd(), "package.json");

  const response = await fetch(`${base}/open`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ path: target }),
  });
  assert.equal(response.status, 200);
  assert.equal(opened, path.win32.normalize(target));

  const blocked = await fetch(`${base}/open`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    body: JSON.stringify({ path: target }),
  });
  assert.equal(blocked.status, 403);
});
