import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the sprint calendar shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>冲刺日历 · 薛浩琛学习计划<\/title>/i);
  assert.match(html, /冲刺日历/);
  assert.match(html, /精确到时刻 · 可提前顺延 · 固定锚点不动/);
  assert.match(html, /计划链总览/);
  assert.match(html, /下一节点/);
  assert.match(html, /链条看板/);
  assert.match(html, /08:00/);
  assert.match(html, /11:00/);
  assert.match(html, /月度作战图/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("keeps the plan, resource inventory, persistence, and Windows launcher in the deliverable", async () => {
  const [page, layout, packageJson, launcher, resourceReport] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("启动冲刺日历.bat", templateRoot), "utf8"),
    readFile(new URL("资料筛选与具体执行.md", templateRoot), "utf8"),
  ]);

  assert.match(page, /2026-07-25/);
  assert.match(page, /new Date\(2026, 9, 17\)/);
  assert.match(page, /50:20:10:20/);
  assert.match(page, /localStorage/);
  assert.match(page, /exportBackup/);
  assert.match(page, /insertIntoChain/);
  assert.match(page, /STORAGE_PLAN/);
  assert.match(page, /打开资料/);
  assert.match(page, /LOCAL_RESOURCE_URL/);
  assert.match(page, /shiftTaskBlock/);
  assert.match(page, /固定锚点/);
  assert.match(page, /item\.standalone \? undefined : item\.chainId/);
  assert.match(page, /standalone: !cleaned\.chainId/);
  assert.match(page, /type="time"/);
  assert.match(page, /calendar-chain-rails/);
  assert.match(page, /STUDY_RESOURCES/);
  assert.match(page, /普通物理学/);
  assert.match(page, /资料筛选/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(launcher, /scripts\\start-local\.mjs/);
  assert.match(resourceReport, /根据文件名已能判断的完成情况/);
  assert.match(resourceReport, /新概念英语智慧版 1/);
});
