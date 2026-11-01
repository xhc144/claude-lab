"use client";

import { useEffect, useMemo, useState } from "react";
import {
  compareTasksByTime,
  deleteFromChain,
  insertIntoChain,
  isoDayDistance,
  moveInChain,
  orderedChain,
  shiftFollowing,
  shiftTaskBlock,
} from "./plan-chain.mjs";

type Category = "数学" | "物理" | "语言" | "二试" | "面试" | "恢复";
type Period = "上午" | "下午" | "晚上";

type PlanTask = {
  id: string;
  date: string;
  title: string;
  detail: string;
  category: Category;
  period: Period;
  hours: number;
  chainId?: ChainId;
  chainName?: string;
  chainOrder?: number;
  standalone?: boolean;
  resourcePath?: string;
  startTime?: string;
  endTime?: string;
  locked?: boolean;
  lockReason?: string;
};

type CustomTask = Omit<PlanTask, "id"> & { id?: string };
type ChainId = "math" | "physics" | "second" | "interview" | "language";
type FormMode = "add" | "edit" | "insert-before" | "insert-after";
type ResourceStatus = "计划使用" | "已完成" | "待确认" | "暂缓";
type StoredPlanV3 = {
  version: 3;
  done: Record<string, boolean>;
  custom: PlanTask[];
  overrides: Record<string, PlanTask>;
  deletedIds: string[];
  resourceStatus: Record<string, ResourceStatus>;
};

type StudyResource = {
  id: string;
  name: string;
  location: string;
  use: string;
  track: "数学" | "物理" | "语言" | "试卷";
  priority: "主资料" | "辅助" | "暂缓";
  initialStatus: ResourceStatus;
};

const CATEGORY_META: Record<Category, { color: string; soft: string; label: string }> = {
  数学: { color: "#315c85", soft: "#e6eef6", label: "数学" },
  物理: { color: "#b65c45", soft: "#f8e9e4", label: "物理" },
  语言: { color: "#7a6a36", soft: "#f4efd9", label: "语言" },
  二试: { color: "#596b55", soft: "#e7eee5", label: "二试开放" },
  面试: { color: "#725978", soft: "#eee7f0", label: "面试答辩" },
  恢复: { color: "#687077", soft: "#eceff1", label: "复盘恢复" },
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const STORAGE_DONE = "sprint-calendar-done-v1";
const STORAGE_CUSTOM = "sprint-calendar-custom-v1";
const STORAGE_RESOURCES = "sprint-calendar-resources-v1";
const STORAGE_PLAN = "sprint-calendar-plan-v3";
const LOCAL_RESOURCE_URL = "http://127.0.0.1:43127";
const PERIOD_START: Record<Period, number> = {
  上午: 8 * 60,
  下午: 14 * 60,
  晚上: 19 * 60 + 30,
};

const CHAIN_META: Record<ChainId, { name: string; color: string; category: Category }> = {
  math: { name: "数学主线", color: "#315c85", category: "数学" },
  physics: { name: "物理主线", color: "#b65c45", category: "物理" },
  second: { name: "二试开放链", color: "#596b55", category: "二试" },
  interview: { name: "答辩表达链", color: "#725978", category: "面试" },
  language: { name: "语言保持链", color: "#7a6a36", category: "语言" },
};

function chainForCategory(category: Category): ChainId | undefined {
  return ({
    数学: "math",
    物理: "physics",
    二试: "second",
    面试: "interview",
    语言: "language",
  } as Partial<Record<Category, ChainId>>)[category];
}

function splitResourcePaths(value: string) {
  return value.split(/[;；]/).map((item) => item.trim()).filter(Boolean);
}

function minutesToClock(total: number) {
  const normalized = Math.max(0, Math.min(total, 23 * 60 + 59));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function clockToMinutes(value?: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function timeRange(period: Period, hours: number, startAt = PERIOD_START[period]) {
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 1;
  return {
    startTime: minutesToClock(startAt),
    endTime: minutesToClock(startAt + Math.round(safeHours * 60)),
  };
}

function durationFromTimes(startTime?: string, endTime?: string) {
  const start = clockToMinutes(startTime);
  const end = clockToMinutes(endTime);
  if (start === null || end === null || end <= start) return null;
  return Math.round(((end - start) / 60) * 100) / 100;
}

function readStored(key: string, fallback: unknown) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const STUDY_RESOURCES: StudyResource[] = [
  { id: "physics-general", name: "《普通物理学》上、下册（程守洙、江之永）", location: "E:\\学习\\book\\竞赛\\杂书\\物理", use: "共同物理主教材；从振动、万有引力继续，再覆盖热、电磁、波与光学。", track: "物理", priority: "主资料", initialStatus: "计划使用" },
  { id: "physics-li-si", name: "李思《经典力学&电磁&量子》", location: "E:\\学习\\物理\\李思讲义", use: "物理加强的直觉与专题补充，不要求从头通读。", track: "物理", priority: "主资料", initialStatus: "计划使用" },
  { id: "physics-mechanics", name: "刘川《理论力学 v1.2》+《分析力学》", location: "E:\\学习\\物理\\刘川；E:\\学习\\物理", use: "物理加强：广义坐标、拉格朗日方程、守恒量与小振动。", track: "物理", priority: "主资料", initialStatus: "计划使用" },
  { id: "physics-em", name: "《电动力学速成讲义》+ 刘川《电动力学》", location: "E:\\学习\\物理", use: "物理加强：场、边界条件、典型对称模型。", track: "物理", priority: "主资料", initialStatus: "计划使用" },
  { id: "physics-thermal", name: "刘川《热力学与统计物理》", location: "E:\\学习\\物理\\领军计划二试物理资料2026\\参考教材", use: "热力学、统计分布和宏微观联系；只做计划内章节。", track: "物理", priority: "辅助", initialStatus: "计划使用" },
  { id: "physics-true", name: "2024—2026 领军二试物理真题及解析", location: "E:\\学习\\物理\\领军计划二试物理资料2026；E:\\学习\\机构\\徐恒\\求真领军\\正赛", use: "最优先的二试物理校准材料，先题目后解析。", track: "试卷", priority: "主资料", initialStatus: "待确认" },
  { id: "physics-yau", name: "2022—2025 丘赛数学物理历年真题", location: "E:\\学习\\物理\\领军计划二试物理资料2026\\丘赛数学物理历年真题", use: "陌生建模与开放探索训练，每次只做一题。", track: "试卷", priority: "主资料", initialStatus: "待确认" },
  { id: "math-true", name: "2025—2026 领军数学一试、二试真题及解答", location: "E:\\学习\\机构\\徐恒\\求真领军\\正赛", use: "数学主校准材料；用于严格限时、闭合书写和口头答辩。", track: "试卷", priority: "主资料", initialStatus: "待确认" },
  { id: "math-liwenwei", name: "李文威《代数学讲义》", location: "E:\\学习\\book\\领军\\数学教材\\代数", use: "只完成现有进度后的高价值章节，不再整本平均推进。", track: "数学", priority: "主资料", initialStatus: "待确认" },
  { id: "math-yupin", name: "于品《清华数分讲义》", location: "E:\\学习\\book\\领军\\数学教材\\分析\\数学分析\\于品", use: "课程后段与证明题查漏；按专题抽取，不做 1000 页通读计划。", track: "数学", priority: "主资料", initialStatus: "待确认" },
  { id: "math-ode", name: "丁同仁、李承治《常微分方程教程》", location: "E:\\学习\\book\\领军\\数学教材\\分析\\微分方程", use: "修补“会形式推导、不会严谨证明”：存在唯一性、Gronwall、连续依赖。", track: "数学", priority: "主资料", initialStatus: "待确认" },
  { id: "math-graph", name: "West《图论导引》", location: "E:\\学习\\book\\领军\\数学教材\\其他\\华章数学译丛", use: "只取树、连通性、匹配、定向和最小反例。", track: "数学", priority: "辅助", initialStatus: "计划使用" },
  { id: "math-prob", name: "钟开莱《概率论教程》或 Ross《概率论基础教程》", location: "E:\\学习\\book\\领军\\数学教材\\概率论与数理统计", use: "概率建模与期望递推；二选一，不重复学习。", track: "数学", priority: "辅助", initialStatus: "计划使用" },
  { id: "mock-jiuxue", name: "进阶九学零试 7—9、一试未完成卷", location: "E:\\学习\\机构\\进阶九学", use: "作为库存卷使用；文件夹已标“已完成”的卷不重复安排。", track: "试卷", priority: "辅助", initialStatus: "待确认" },
  { id: "mock-qingbei", name: "2025.10 清北学堂试卷 01—10", location: "E:\\学习\\机构\\清北学堂\\2025.10", use: "从中筛陌生卷做混合限时，不默认十套全做。", track: "试卷", priority: "辅助", initialStatus: "待确认" },
  { id: "mock-desktop", name: "桌面模拟试卷：学而思、猿辅导、刁妈、清北学堂", location: "C:\\Users\\37542\\Desktop\\模拟试卷", use: "2022 猿辅导文件名明确已完成；其余请你确认后再排。", track: "试卷", priority: "辅助", initialStatus: "待确认" },
  { id: "mock-gpt-second", name: "GPT 数学二试模拟 1—2、物理二试模拟 1", location: "E:\\学习\\GPT\\模拟试卷\\二试模拟试卷", use: "真题不够时补充；优先学生试题，完成后才看教师答案。", track: "试卷", priority: "辅助", initialStatus: "待确认" },
  { id: "language-aime", name: "AIME 2011—2024 英文试题", location: "E:\\学习\\book\\竞赛\\杂书\\题目\\真题\\USA真题", use: "语言训练素材：每天只读一道题，标主干并用中文复述，不必求解。", track: "语言", priority: "主资料", initialStatus: "计划使用" },
  { id: "done-jiuxue", name: "进阶九学零试 1—6、一试 1—5", location: "E:\\学习\\机构\\进阶九学", use: "文件夹名称明确写有“已完成”，只保留错题复盘，不重做整卷。", track: "试卷", priority: "辅助", initialStatus: "已完成" },
  { id: "done-yuan", name: "2022 寒俞辰捷猿辅导", location: "C:\\Users\\37542\\Desktop\\模拟试卷", use: "文件名明确写有“已完成”，不再安排。", track: "试卷", priority: "辅助", initialStatus: "已完成" },
  { id: "pause-advanced", name: "实变、泛函、拓扑、交换代数、p-adic、傅里叶等速成讲义", location: "E:\\学习\\GPT\\速成讲义；E:\\学习\\book\\领军\\数学教材", use: "考前不系统铺开；只有真题暴露明确缺口时查一个定理。", track: "数学", priority: "暂缓", initialStatus: "暂缓" },
  { id: "pause-olympiad", name: "海量联赛专题书、Putnam、IMC、CMC", location: "E:\\学习\\book\\竞赛；E:\\学习\\book\\领军\\题目", use: "9 月 13 日后不作为主线；只在需要陌生题时抽取。", track: "数学", priority: "暂缓", initialStatus: "暂缓" },
];

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function task(
  date: string,
  period: Period,
  category: Category,
  title: string,
  hours: number,
  detail: string,
): PlanTask {
  return {
    id: `${date}-${period}-${category}-${title}`,
    date,
    period,
    category,
    title,
    hours,
    detail,
  };
}

function phaseFor(date: Date) {
  const key = iso(date);
  if (key <= "2026-08-02") return "结构重启";
  if (key <= "2026-09-12") return "数竞集训";
  if (key === "2026-09-13") return "联赛日";
  if (key <= "2026-10-05") return "混合冲刺";
  return "考前收束";
}

const physicsRoute = [
  ["简谐振动", "《普通物理学》上册", "弹簧、单摆、能量图像与微分方程；完成章末 3—5 道代表题。"],
  ["万有引力与轨道", "《普通物理学》上册", "圆轨道、逃逸速度、有效势与开普勒定律；写一页模型总结。"],
  ["热学与热力学", "《普通物理学》下册 + 刘川热统", "状态量、过程量、第一/第二定律与循环，暂不深挖完整统计力学。"],
  ["静电场", "《普通物理学》下册 +《电磁与几何》中文版", "连续电荷、电势、场强和高斯定律；重视对称性。"],
  ["电路与电容", "《普通物理学》下册", "暂态、电容组合、能量与边界条件；做两道综合计算。"],
  ["磁场与电磁感应", "《普通物理学》下册 +《电磁与几何》中文版", "洛伦兹力、磁通量、感应电动势与能量。"],
  ["振动、波与光学", "《普通物理学》下册", "波动方程、叠加、干涉、衍射和几何光学。"],
  ["近代物理", "李思《经典力学&电磁&量子》", "相对论与量子基础；只建立概念、量纲和典型推导。"],
  ["分析力学", "刘川《理论力学》+《分析力学》", "广义坐标、拉格朗日方程、守恒量与小振动。"],
  ["电动力学", "《电动力学速成讲义》+ 刘川《电动力学》", "场的观点、边界条件和典型对称模型。"],
  ["热力学与统计", "刘川《热力学与统计物理》", "分布、宏观量与微观图景之间的联系。"],
  ["量子力学基础", "李思《量子力学与几何》中文版", "态、算符、测量与一维典型模型；不追求全书覆盖。"],
] as const;

const mathRoute = [
  ["代数后段精选", "李文威《代数学讲义》", "只补未完成的高价值章节，每次留下 2 道可口述题。"],
  ["数分后段证明", "于品《清华数分讲义》", "按专题查漏，不从第一页顺读；完成一份闭合证明。"],
  ["ODE 严谨性", "丁同仁、李承治《常微分方程教程》", "存在唯一性、Gronwall、比较原理或连续依赖四选一。"],
  ["图论工具", "West《图论导引》", "树、连通性、匹配、定向与最小反例。"],
  ["概率建模", "钟开莱或 Ross（二选一）", "条件概率、期望、递推与随机变量的基础建模。"],
] as const;

const mixedPaperPool = [
  "2026 领军数学一试真题",
  "2025 领军数学一试真题",
  "进阶九学未完成一试卷",
  "2025.10 清北学堂陌生卷",
  "桌面学而思/猿辅导/刁妈未完成卷",
] as const;

const openTaskPool = [
  "2026 领军二试数学真题",
  "2026 领军二试物理真题",
  "2024—2025 领军二试物理回忆题",
  "丘赛数学物理历年真题",
  "GPT 二试模拟（真题用完后）",
] as const;

function buildDefaultPlan() {
  const tasks: PlanTask[] = [];
  const start = new Date(2026, 6, 25);
  const end = new Date(2026, 9, 17);

  for (let cursor = start, index = 0; cursor <= end; cursor = addDays(cursor, 1), index += 1) {
    const key = iso(cursor);
    const weekday = cursor.getDay();
    const phase = phaseFor(cursor);

    if (phase === "结构重启") {
      const route = physicsRoute[index % 2];
      tasks.push(task(key, "上午", "物理", `${route[0]}主线`, 3, `${route[1]}：${route[2]}`));
      tasks.push(task(key, "下午", index % 2 ? "二试" : "数学", index % 2 ? "陌生定义开放任务" : "数学保持训练", 2.5, index % 2 ? "复述定义、造例反例、提出猜想并证明最强版本。" : "限时做题后只保留入口、关键转化、伪证风险与闭合答案。"));
      tasks.push(task(key, "晚上", "语言", "AIME 英文题精读", 0.5, "只读一道题：圈出主谓与条件，用中文复述；暂时不要求解题。"));
      if (weekday === 0) tasks.push(task(key, "晚上", "恢复", "周复盘与早睡", 0.5, "检查本周任务是否真实完成，23:00 前结束。"));
      continue;
    }

    if (phase === "数竞集训") {
      if (weekday === 0) {
        tasks.push(task(key, "上午", "数学", "联赛全真模拟", 4.5, "按真实联赛时长完成；优先几何和代数，记录读题与时间决策。"));
        tasks.push(task(key, "下午", "数学", "模拟讲评与订正", 3.5, "只整理失分入口、关键一步与可评分书写，不抄长答案。"));
        tasks.push(task(key, "晚上", "恢复", "回家、散步与早睡", 0.5, "不追加整套题，恢复连续作战状态。"));
      } else {
        tasks.push(task(key, "上午", "数学", "数竞集训 · 上午场", 4, "当天课程与训练直接计入计划，不在晚上重复堆整卷。"));
        tasks.push(task(key, "下午", "数学", "数竞集训 · 下午场", 4, "重点守住省一；只有计划确实无法完成时再考虑请假。"));
        const route = physicsRoute[Math.floor(index / 4) % physicsRoute.length];
        tasks.push(task(key, "晚上", "物理", route[0], 1.25, `${route[1]}：${route[2]}`));
        tasks.push(task(key, "晚上", "语言", "AIME 英文题精读", 0.5, "只读一道英文题，标句子主干并用中文准确复述；集训期不追加长作业。"));
      }
      continue;
    }

    if (phase === "联赛日") {
      tasks.push(task(key, "上午", "数学", "全国高中数学联赛", 4.5, "按考试要求完成；不在考前临时扩张知识。"));
      tasks.push(task(key, "下午", "恢复", "休息与轻复盘", 1, "只记录时间决策和读题问题，不立即展开长篇订正。"));
      tasks.push(task(key, "晚上", "恢复", "庆祝阶段完成，正常入睡", 0.5, "从明天起切换到新领军混合冲刺。"));
      continue;
    }

    if (phase === "混合冲刺") {
      const route = physicsRoute[(index + weekday) % physicsRoute.length];
      const math = mathRoute[(index + weekday) % mathRoute.length];
      const paper = mixedPaperPool[Math.floor(index / 6) % mixedPaperPool.length];
      const openTask = openTaskPool[Math.floor(index / 4) % openTaskPool.length];
      if (weekday === 6) {
        tasks.push(task(key, "上午", "数学", `一试限时 · ${paper}`, 4, "优先使用没做过的卷；按数学、共同物理、语言与物理加强 50:20:10:20 观察缺口。"));
        tasks.push(task(key, "下午", "恢复", "严格评分与错因统计", 3, "只整理这套卷：闭合题数、最长卡题时间、读错条件与物理建模错误。"));
      } else if (weekday === 0) {
        tasks.push(task(key, "上午", "恢复", "半日恢复", 2, "补觉不熬夜，散步，清理本周未闭合任务。"));
        tasks.push(task(key, "下午", "面试", "兴趣证据与黑板讲题", 2, "选真实深入追问过的专题：问题、尝试方法、卡点、下一步。"));
        tasks.push(task(key, "晚上", "恢复", "下周计划", 0.5, "只选三件最重要的事，不制作复杂笔记。"));
      } else {
        tasks.push(task(key, "上午", "物理", route[0], 3.5, `${route[1]}：${route[2]}`));
        tasks.push(task(key, "下午", weekday === 2 || weekday === 4 ? "二试" : "数学", weekday === 2 || weekday === 4 ? `开放训练 · ${openTask}` : math[0], 3, weekday === 2 || weekday === 4 ? "先做题目：复述定义、造例反例、提出猜想并证明；最后 20 分钟口头答辩，之后才看解析。" : `${math[1]}：${math[2]}`));
        tasks.push(task(key, "晚上", "面试", "讲题、追问与纠错", 0.75, "不背话术；解释关键转化，被指出错误后现场修正。"));
        tasks.push(task(key, "晚上", "语言", "AIME 英文题 + 基础英语", 0.5, "AIME 英文题精读 15 分钟；基础词句 15 分钟。若购买《新概念英语1》，按每日一小节推进。"));
      }
      continue;
    }

    const daysLeft = Math.max(0, Math.round((end.getTime() - cursor.getTime()) / 86400000));
    if (weekday === 3 || weekday === 6) {
      tasks.push(task(key, "上午", "数学", "轻量混合模拟", 3, "保持手感，以审题、时间决策和答案闭合为唯一目标。"));
      tasks.push(task(key, "下午", "物理", "高价值模型回看", 2.5, "只回看已做过的关键模型，不开新课程。"));
    } else {
      tasks.push(task(key, "上午", daysLeft % 2 ? "物理" : "数学", daysLeft % 2 ? "物理错题与核心推导" : "数学错题与定义定理", 2.5, "回看高价值错题，能独立复现主线即可。"));
      tasks.push(task(key, "下午", "二试", "开放题短练", 2, "造例、猜想、证明、改条件；到点停止。"));
    }
    tasks.push(task(key, "晚上", "面试", "短讲题与普通问答", 0.75, "80% 学术答辩，20% 兴趣、经历、志向。"));
    tasks.push(task(key, "晚上", "恢复", `距离收束结束 ${daysLeft} 天`, 0.5, "22:30 后不学习，固定作息，保持四小时连续状态。"));
  }

  return tasks;
}

function attachDefaultChains(tasks: PlanTask[]) {
  const counters: Partial<Record<ChainId, number>> = {};
  const nextStartBySlot: Record<string, number> = {};
  return tasks.map((item) => {
    const slotKey = `${item.date}-${item.period}`;
    const startAt = nextStartBySlot[slotKey] ?? PERIOD_START[item.period];
    const exactTime = timeRange(item.period, item.hours, startAt);
    nextStartBySlot[slotKey] = startAt + Math.round(item.hours * 60) + 15;
    const locked = item.title.startsWith("数竞集训 ·");
    const chainId = chainForCategory(item.category);
    if (!chainId) {
      return {
        ...item,
        ...exactTime,
        locked,
        lockReason: locked ? "数学竞赛集训为固定日程，不能移动或改动。" : undefined,
      };
    }
    const chainOrder = counters[chainId] ?? 0;
    counters[chainId] = chainOrder + 1;
    return {
      ...item,
      ...exactTime,
      chainId,
      chainName: CHAIN_META[chainId].name,
      chainOrder,
      locked,
      lockReason: locked ? "数学竞赛集训为固定日程，不能移动或改动。" : undefined,
    };
  });
}

const DEFAULT_PLAN = attachDefaultChains(buildDefaultPlan());

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export default function Home() {
  const [month, setMonth] = useState(new Date(2026, 6, 1));
  const [selected, setSelected] = useState("2026-07-25");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState<PlanTask[]>([]);
  const [overrides, setOverrides] = useState<Record<string, PlanTask>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showChainBoard, setShowChainBoard] = useState(false);
  const [boardChainId, setBoardChainId] = useState<ChainId>("math");
  const [filter, setFilter] = useState<Category | "全部">("全部");
  const [resourceFilter, setResourceFilter] = useState<StudyResource["track"] | "全部">("全部");
  const [resourceStatus, setResourceStatus] = useState<Record<string, ResourceStatus>>({});
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [resourceHelper, setResourceHelper] = useState<"checking" | "online" | "offline">("checking");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState<CustomTask>({
    date: "2026-07-25",
    period: "晚上",
    category: "数学",
    title: "",
    detail: "",
    hours: 1,
    startTime: "19:30",
    endTime: "20:30",
    chainId: undefined,
    chainName: undefined,
    resourcePath: "",
  });

  useEffect(() => {
    let hydrationTimer = 0;
    const rawV3 = readStored(STORAGE_PLAN, null);
    const storedV3 = isRecord(rawV3) && rawV3.version === 3 ? rawV3 as Partial<StoredPlanV3> : null;
    const legacyCustomValue = readStored(STORAGE_CUSTOM, []);
    const legacyCustom = Array.isArray(legacyCustomValue) ? legacyCustomValue as PlanTask[] : [];
    const sourceCustom = Array.isArray(storedV3?.custom) ? storedV3.custom : legacyCustom;
    const baseCounts = Object.fromEntries(
      Object.keys(CHAIN_META).map((chainId) => [chainId, orderedChain(DEFAULT_PLAN, chainId).length]),
    ) as Record<ChainId, number>;
    const customCounts: Partial<Record<ChainId, number>> = {};
    const migratedCustom = sourceCustom.map((item: PlanTask) => {
      const exactTime = item.startTime && item.endTime ? {} : timeRange(item.period, item.hours);
      const chainId = item.standalone ? undefined : item.chainId || chainForCategory(item.category);
      if (!chainId) return { ...item, ...exactTime, standalone: true };
      const fallbackOrder = baseCounts[chainId] + (customCounts[chainId] ?? 0);
      customCounts[chainId] = (customCounts[chainId] ?? 0) + 1;
      return {
        ...item,
        ...exactTime,
        chainId,
        chainName: item.chainName || CHAIN_META[chainId].name,
        chainOrder: item.chainOrder ?? fallbackOrder,
        standalone: false,
        resourcePath: item.resourcePath || "",
      };
    });
    const legacyDone = readStored(STORAGE_DONE, {});
    const legacyResources = readStored(STORAGE_RESOURCES, {});
    hydrationTimer = window.setTimeout(() => {
      setDone(isRecord(storedV3?.done) ? storedV3.done as Record<string, boolean> : isRecord(legacyDone) ? legacyDone as Record<string, boolean> : {});
      setCustom(migratedCustom);
      setOverrides(isRecord(storedV3?.overrides) ? storedV3.overrides as Record<string, PlanTask> : {});
      setDeletedIds(Array.isArray(storedV3?.deletedIds) ? storedV3.deletedIds.filter((id): id is string => typeof id === "string") : []);
      setResourceStatus(isRecord(storedV3?.resourceStatus) ? storedV3.resourceStatus as Record<string, ResourceStatus> : isRecord(legacyResources) ? legacyResources as Record<string, ResourceStatus> : {});
    }, 0);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1200);
    fetch(`${LOCAL_RESOURCE_URL}/health`, { signal: controller.signal })
      .then((response) => setResourceHelper(response.ok ? "online" : "offline"))
      .catch(() => setResourceHelper("offline"))
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(hydrationTimer);
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  const defaultIds = useMemo(() => new Set(DEFAULT_PLAN.map((item) => item.id)), []);
  const tasks = useMemo(() => {
    const deleted = new Set(deletedIds);
    return [
      ...DEFAULT_PLAN
        .filter((item) => !deleted.has(item.id))
        .map((item) => overrides[item.id] ? { ...item, ...overrides[item.id] } : item),
      ...custom,
    ];
  }, [custom, overrides, deletedIds]);
  const visibleTasks = useMemo(
    () => (filter === "全部" ? tasks : tasks.filter((item) => item.category === filter)),
    [tasks, filter],
  );
  const days = useMemo(() => monthGrid(month.getFullYear(), month.getMonth()), [month]);
  const selectedTasks = tasks
    .filter((item) => item.date === selected)
    .sort(compareTasksByTime);
  const selectedDate = dateFromIso(selected);
  const completedCount = tasks.filter((item) => done[item.id]).length;
  const planHours = tasks.reduce((sum, item) => sum + item.hours, 0);
  const completedHours = tasks.reduce((sum, item) => sum + (done[item.id] ? item.hours : 0), 0);
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const phase = phaseFor(selectedDate);
  const chainSummaries = useMemo(
    () => (Object.keys(CHAIN_META) as ChainId[]).map((chainId) => {
      const chain = orderedChain(tasks, chainId) as PlanTask[];
      const completed = chain.filter((item) => done[item.id]).length;
      return {
        chainId,
        chain,
        completed,
        next: chain.find((item) => !done[item.id]),
        progress: chain.length ? Math.round((completed / chain.length) * 100) : 0,
      };
    }),
    [tasks, done],
  );
  const nextNodeIds = useMemo(
    () => new Set(chainSummaries.map((summary) => summary.next?.id).filter(Boolean)),
    [chainSummaries],
  );
  const chainDateSets = useMemo(
    () => Object.fromEntries(
      (Object.keys(CHAIN_META) as ChainId[]).map((chainId) => [
        chainId,
        new Set(tasks.filter((item) => item.chainId === chainId).map((item) => item.date)),
      ]),
    ) as Record<ChainId, Set<string>>,
    [tasks],
  );
  const activeBoardSummary = chainSummaries.find((summary) => summary.chainId === boardChainId)!;

  function writeV3(
    nextDone = done,
    nextCustom = custom,
    nextOverrides = overrides,
    nextDeletedIds = deletedIds,
    nextResourceStatus = resourceStatus,
  ) {
    localStorage.setItem(STORAGE_PLAN, JSON.stringify({
      version: 3,
      done: nextDone,
      custom: nextCustom,
      overrides: nextOverrides,
      deletedIds: nextDeletedIds,
      resourceStatus: nextResourceStatus,
    }));
  }

  function persistDone(next: Record<string, boolean>) {
    setDone(next);
    localStorage.setItem(STORAGE_DONE, JSON.stringify(next));
    writeV3(next);
  }

  function toggleTask(id: string) {
    persistDone({ ...done, [id]: !done[id] });
  }

  function changeMonth(amount: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
  }

  function jumpToday() {
    setMonth(new Date(2026, 6, 1));
    setSelected("2026-07-25");
  }

  function openAdd(date = selected) {
    setFormMode("add");
    setActiveTaskId(null);
    setForm({
      date,
      period: "晚上",
      category: "数学",
      title: "",
      detail: "",
      hours: 1,
      startTime: "19:30",
      endTime: "20:30",
      chainId: undefined,
      chainName: undefined,
      resourcePath: "",
    });
    setShowAdd(true);
  }

  function openEdit(item: PlanTask) {
    if (item.locked) {
      notify(item.lockReason || "这是固定日程，不能编辑。");
      return;
    }
    setFormMode("edit");
    setActiveTaskId(item.id);
    setForm({ ...item, ...(!item.startTime || !item.endTime ? timeRange(item.period, item.hours) : {}) });
    setShowAdd(true);
  }

  function openInsert(item: PlanTask, position: "before" | "after") {
    if (item.locked) {
      notify(item.lockReason || "固定日程前后不能插入链节点。");
      return;
    }
    setFormMode(position === "before" ? "insert-before" : "insert-after");
    setActiveTaskId(item.id);
    setForm({
      date: position === "before" ? item.date : iso(addDays(dateFromIso(item.date), 1)),
      period: item.period,
      category: item.category,
      title: "",
      detail: "",
      hours: item.hours,
      startTime: item.startTime || timeRange(item.period, item.hours).startTime,
      endTime: item.endTime || timeRange(item.period, item.hours).endTime,
      chainId: item.chainId,
      chainName: item.chainName,
      resourcePath: "",
    });
    setShowAdd(true);
  }

  function applyTaskCollection(nextTasks: PlanTask[], nextDeletedIds = deletedIds) {
    const nextCustom = nextTasks.filter((item) => !defaultIds.has(item.id));
    const nextOverrides = { ...overrides };
    for (const item of nextTasks) {
      if (!defaultIds.has(item.id)) continue;
      const original = DEFAULT_PLAN.find((candidate) => candidate.id === item.id);
      if (original && JSON.stringify(original) !== JSON.stringify(item)) nextOverrides[item.id] = item;
      else delete nextOverrides[item.id];
    }
    setCustom(nextCustom);
    setOverrides(nextOverrides);
    setDeletedIds(nextDeletedIds);
    localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(nextCustom));
    writeV3(done, nextCustom, nextOverrides, nextDeletedIds);
  }

  function saveTask() {
    if (!form.title.trim()) return;
    const exactHours = durationFromTimes(form.startTime, form.endTime);
    if (exactHours === null) {
      notify("请填写有效的开始和结束时间，结束时间必须晚于开始时间。");
      return;
    }
    const cleaned = {
      ...form,
      hours: exactHours,
      title: form.title.trim(),
      detail: form.detail.trim() || "完成这一节点，并留下可检查的结果。",
      resourcePath: form.resourcePath?.trim() || "",
      chainName: form.chainId ? CHAIN_META[form.chainId].name : undefined,
      standalone: !form.chainId,
    };

    if (formMode === "edit" && activeTaskId) {
      const current = tasks.find((item) => item.id === activeTaskId);
      if (!current) return;
      if (current.locked) {
        notify(current.lockReason || "这是固定日程，不能编辑。");
        return;
      }
      const edited = { ...current, ...cleaned, id: current.id } as PlanTask;
      let next: PlanTask[];
      if (current.chainId !== edited.chainId) {
        const withoutCurrent = deleteFromChain(tasks, current.id, done) as PlanTask[];
        edited.chainOrder = edited.chainId ? orderedChain(withoutCurrent, edited.chainId).length : undefined;
        next = [...withoutCurrent, edited];
      } else {
        next = tasks.map((item) => item.id === current.id ? edited : item);
        next = shiftFollowing(next, current.id, isoDayDistance(current.date, edited.date), done) as PlanTask[];
      }
      applyTaskCollection(next);
      setSelected(edited.date);
      setMonth(new Date(dateFromIso(edited.date).getFullYear(), dateFromIso(edited.date).getMonth(), 1));
    } else {
      const created = {
        ...cleaned,
        id: `custom-${crypto.randomUUID()}`,
        locked: false,
        lockReason: undefined,
        standalone: !cleaned.chainId,
      } as PlanTask;
      let next: PlanTask[];
      if (activeTaskId && (formMode === "insert-before" || formMode === "insert-after")) {
        next = insertIntoChain(
          tasks,
          activeTaskId,
          created,
          formMode === "insert-before" ? "before" : "after",
          done,
        ) as PlanTask[];
      } else {
        created.chainOrder = created.chainId ? orderedChain(tasks, created.chainId).length : undefined;
        next = [...tasks, created];
      }
      const saved = next.find((item) => item.id === created.id) || created;
      applyTaskCollection(next);
      setSelected(saved.date);
      setMonth(new Date(dateFromIso(saved.date).getFullYear(), dateFromIso(saved.date).getMonth(), 1));
    }
    setShowAdd(false);
  }

  function removeTask(item: PlanTask) {
    if (item.locked) {
      notify(item.lockReason || "这是固定日程，不能删除。");
      return;
    }
    const consequence = item.chainId ? "同链后续未完成节点会向前补位。" : "这只会删除这个独立任务。";
    if (!window.confirm(`删除“${item.title}”？${consequence}`)) return;
    const next = deleteFromChain(tasks, item.id, done) as PlanTask[];
    const nextDeleted = defaultIds.has(item.id) ? [...new Set([...deletedIds, item.id])] : deletedIds;
    applyTaskCollection(next, nextDeleted);
  }

  function moveTask(item: PlanTask, direction: -1 | 1) {
    if (item.locked) {
      notify(item.lockReason || "这是固定日程，不能调整顺序。");
      return;
    }
    const next = moveInChain(tasks, item.id, direction, done) as PlanTask[];
    if (next === tasks) {
      notify("固定集训是链条锚点，其他节点不能跨过它。");
      return;
    }
    const moved = next.find((candidate) => candidate.id === item.id);
    applyTaskCollection(next);
    if (moved) {
      setSelected(moved.date);
      setMonth(new Date(dateFromIso(moved.date).getFullYear(), dateFromIso(moved.date).getMonth(), 1));
    }
  }

  function shiftSchedule(item: PlanTask, dayDelta: -1 | 1) {
    if (item.locked) {
      notify(item.lockReason || "这是固定日程，不能移动。");
      return;
    }
    if (done[item.id]) {
      notify("已完成节点保持历史日期；如需调整，请先取消完成。");
      return;
    }
    const next = shiftTaskBlock(tasks, item.id, dayDelta, done) as PlanTask[];
    if (next === tasks) return;
    const moved = next.find((candidate) => candidate.id === item.id);
    applyTaskCollection(next);
    if (moved) {
      setSelected(moved.date);
      setMonth(new Date(dateFromIso(moved.date).getFullYear(), dateFromIso(moved.date).getMonth(), 1));
    }
    notify(item.chainId
      ? `${dayDelta > 0 ? "已顺延" : "已提前"}本节点及本链后续未完成节点；固定集训和其他链不动。`
      : `独立任务已${dayDelta > 0 ? "顺延" : "提前"} 1 天，所有计划链不受影响。`);
  }

  function exportBackup() {
    const payload = JSON.stringify({
      version: 3,
      exportedAt: new Date().toISOString(),
      done,
      custom,
      overrides,
      deletedIds,
      resourceStatus,
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "冲刺日历备份.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  async function copyPath(pathValue: string, quiet = false) {
    try {
      await navigator.clipboard.writeText(pathValue);
    } catch {
      const area = document.createElement("textarea");
      area.value = pathValue;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    if (!quiet) notify("资料路径已复制，可粘贴到资源管理器地址栏。");
  }

  async function openResource(pathValue: string) {
    const target = splitResourcePaths(pathValue)[0];
    if (!target) return;
    try {
      const response = await fetch(`${LOCAL_RESOURCE_URL}/open`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: target }),
      });
      if (!response.ok) throw new Error("local helper rejected path");
      setResourceHelper("online");
      notify("已交给 Windows 打开资料。");
    } catch {
      setResourceHelper("offline");
      await copyPath(target, true);
      notify("未能直接打开，路径已自动复制；请粘贴到资源管理器。");
    }
  }

  function setStudyResourceStatus(id: string, status: ResourceStatus) {
    const next = { ...resourceStatus, [id]: status };
    setResourceStatus(next);
    localStorage.setItem(STORAGE_RESOURCES, JSON.stringify(next));
    writeV3(done, custom, overrides, deletedIds, next);
  }

  const selectedDone = selectedTasks.filter((item) => done[item.id]).length;
  const selectedHours = selectedTasks.reduce((sum, item) => sum + item.hours, 0);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">冲</div>
          <div>
            <p className="eyebrow">QIU ZHEN SPRINT · 2026</p>
            <h1>冲刺日历</h1>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost-btn" onClick={exportBackup}>导出备份</button>
          <button className="ghost-btn" onClick={() => setShowChainBoard(true)}>链条看板</button>
          <button className="ghost-btn" onClick={() => setShowResources(true)}>资料筛选</button>
          <button className="ghost-btn" onClick={() => setShowStrategy(true)}>总策略</button>
          <button className="primary-btn" onClick={() => openAdd()}>＋ 添加任务</button>
        </div>
      </header>

      <section className="hero-strip">
        <div className="hero-copy">
          <p className="hero-kicker">精确到时刻 · 可提前顺延 · 固定锚点不动</p>
          <h2>每一项任务，<br />都接在主线上。</h2>
          <p>计划链可以整体提前或顺延，独立临时任务只占自己的时间；数学竞赛集训是固定锚点，不会被任何调整带走。</p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card featured">
            <span>总体完成</span>
            <strong>{progress}<small>%</small></strong>
            <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="metric-card">
            <span>已完成任务</span>
            <strong>{completedCount}<small> / {tasks.length}</small></strong>
            <p>每次勾选都会保存在本机</p>
          </div>
          <div className="metric-card">
            <span>有效投入</span>
            <strong>{completedHours.toFixed(1)}<small> h</small></strong>
            <p>总计划约 {Math.round(planHours)} 小时</p>
          </div>
        </div>
      </section>

      <section className="chain-board" aria-label="计划链进度">
        <div className="chain-board-head">
          <div>
            <p className="section-label">计划链总览</p>
            <h2>沿着下一节点继续</h2>
          </div>
          <div className="chain-board-head-actions">
            <button className="ghost-btn compact" onClick={() => setShowChainBoard(true)}>打开完整链条</button>
            <span className={`helper-status ${resourceHelper}`}>{resourceHelper === "online" ? "本地资料可直接打开" : resourceHelper === "checking" ? "正在连接本地资料" : "资料打开失败时自动复制路径"}</span>
          </div>
        </div>
        <div className="chain-summary-grid">
          {chainSummaries.map(({ chainId, chain, completed, next, progress: chainProgress }) => (
            <button
              className="chain-summary"
              key={chainId}
              style={{ "--chain": CHAIN_META[chainId].color } as React.CSSProperties}
              onClick={() => {
                if (!next) return;
                const nextDate = dateFromIso(next.date);
                setSelected(next.date);
                setMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
              }}
            >
              <span className="chain-summary-title"><i />{CHAIN_META[chainId].name}</span>
              <strong>{completed}<small> / {chain.length}</small></strong>
              <div className="chain-progress"><i style={{ width: `${chainProgress}%` }} /></div>
              <p>{next ? <>下一节点 · <b>{next.title}</b><em>{next.date.slice(5)}</em></> : "全部完成"}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="workspace">
        <div className="calendar-panel">
          <div className="calendar-toolbar">
            <div>
              <p className="section-label">月度作战图</p>
              <div className="month-title">
                <button aria-label="上个月" onClick={() => changeMonth(-1)}>←</button>
                <h3>{month.getFullYear()} 年 {month.getMonth() + 1} 月</h3>
                <button aria-label="下个月" onClick={() => changeMonth(1)}>→</button>
              </div>
            </div>
            <div className="toolbar-right">
              <div className="filter-row" aria-label="按科目筛选">
                {(["全部", "数学", "物理", "二试", "面试", "语言"] as const).map((item) => (
                  <button
                    key={item}
                    className={filter === item ? "active" : ""}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button className="today-btn" onClick={jumpToday}>回到起点</button>
            </div>
          </div>

          <div className="calendar-guide">
            <div>
              <b>一天，从早到晚</b>
              <span>任务严格按开始时间排列</span>
            </div>
            <div className="chain-key" aria-label="日历链路图例">
              {(Object.keys(CHAIN_META) as ChainId[]).map((chainId) => (
                <span key={chainId} style={{ "--rail": CHAIN_META[chainId].color } as React.CSSProperties}>
                  <i />{CHAIN_META[chainId].name}
                </span>
              ))}
            </div>
          </div>
          <div className="calendar-grid weekday-row">
            {WEEKDAYS.map((day) => <div key={day}>周{day}</div>)}
          </div>
          <div className="calendar-grid days-grid">
            {days.map((date) => {
              const key = iso(date);
              const inMonth = date.getMonth() === month.getMonth();
              const dayTasks = visibleTasks
                .filter((item) => item.date === key)
                .sort(compareTasksByTime);
              const allDayTasks = tasks.filter((item) => item.date === key);
              const finished = allDayTasks.filter((item) => done[item.id]).length;
              const isSelected = selected === key;
              const isStart = key === "2026-07-25";
              const previousKey = iso(addDays(date, -1));
              const nextKey = iso(addDays(date, 1));
              const railChains = (Object.keys(CHAIN_META) as ChainId[]).filter(
                (chainId) => allDayTasks.some((item) => item.chainId === chainId),
              );
              return (
                <button
                  key={key}
                  className={`day-cell ${inMonth ? "" : "muted"} ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelected(key)}
                >
                  <div className="day-number">
                    <span>{date.getDate()}</span>
                    {isStart && <b>起点</b>}
                    {allDayTasks.length > 0 && <em>{finished}/{allDayTasks.length}</em>}
                  </div>
                  <div className="task-chips" aria-label="按开始时间排列的任务">
                    {dayTasks.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className={`task-chip ${done[item.id] ? "done" : ""} ${nextNodeIds.has(item.id) ? "next" : ""}`}
                        style={{ "--chip": CATEGORY_META[item.category].color, "--chip-soft": CATEGORY_META[item.category].soft } as React.CSSProperties}
                        title={`${item.startTime || timeRange(item.period, item.hours).startTime} ${item.title}`}
                      >
                        <i aria-hidden="true">{nextNodeIds.has(item.id) ? "›" : ""}</i>
                        <time>{item.startTime || timeRange(item.period, item.hours).startTime}</time>
                        <span>{item.title}</span>
                        {item.locked && <b aria-label="固定锚点">锚</b>}
                      </div>
                    ))}
                    {dayTasks.length > 3 && <small>＋{dayTasks.length - 3} 项稍后任务</small>}
                  </div>
                  {railChains.length > 0 && (
                    <div className="calendar-chain-rails" aria-label="当日计划链轨道">
                      {railChains.map((chainId) => {
                        const chainIndex = (Object.keys(CHAIN_META) as ChainId[]).indexOf(chainId);
                        const count = allDayTasks.filter((item) => item.chainId === chainId).length;
                        const connectsLeft = date.getDay() !== 0 && chainDateSets[chainId].has(previousKey);
                        const connectsRight = date.getDay() !== 6 && chainDateSets[chainId].has(nextKey);
                        return (
                          <span
                            key={chainId}
                            className={`calendar-chain-rail ${connectsLeft ? "connect-left" : ""} ${connectsRight ? "connect-right" : ""}`}
                            style={{ "--rail": CHAIN_META[chainId].color, gridRow: chainIndex + 1 } as React.CSSProperties}
                            title={`${CHAIN_META[chainId].name} · ${count} 个节点`}
                          >
                            <i>{CHAIN_META[chainId].name.slice(0, 1)}</i>
                            {count > 1 && <em>{count}</em>}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="day-panel">
          <div className="day-panel-head">
            <div>
              <span className="phase-pill">{phase}</span>
              <h3>{selectedDate.getMonth() + 1} 月 {selectedDate.getDate()} 日</h3>
              <p>星期{WEEKDAYS[selectedDate.getDay()]} · {selectedHours.toFixed(1)} 小时计划</p>
            </div>
            <div className="day-ring" style={{ "--day-progress": `${selectedTasks.length ? (selectedDone / selectedTasks.length) * 360 : 0}deg` } as React.CSSProperties}>
              <span>{selectedDone}/{selectedTasks.length}</span>
            </div>
          </div>

          <div className="daily-note">
            <span>今日原则</span>
            <p>{phase === "数竞集训" ? "集训就是主训练，晚上不再追加整套卷。" : phase === "考前收束" ? "停止扩张，只解决审题、决策、闭合与作息。" : "做完、讲清、能被追问，比留下漂亮笔记更重要。"}</p>
          </div>

          <div className="task-list">
            {selectedTasks.length === 0 && (
              <div className="empty-day">
                <strong>这一天还没有安排</strong>
                <p>可以留作休息，也可以添加一项明确的小任务。</p>
              </div>
            )}
            {selectedTasks.map((item) => {
              const chain = item.chainId ? orderedChain(tasks, item.chainId) as PlanTask[] : [];
              const chainIndex = chain.findIndex((candidate) => candidate.id === item.id);
              const isNext = nextNodeIds.has(item.id);
              const previousNode = chainIndex > 0 ? chain[chainIndex - 1] : null;
              const nextNode = chainIndex >= 0 && chainIndex < chain.length - 1 ? chain[chainIndex + 1] : null;
              return (
              <article
                key={item.id}
                className={`task-card ${item.chainId ? "chain-node" : "independent-node"} ${item.locked ? "locked-node" : ""} ${done[item.id] ? "completed" : ""} ${isNext ? "next-node" : ""}`}
                style={{ "--chain": item.chainId ? CHAIN_META[item.chainId].color : CATEGORY_META[item.category].color } as React.CSSProperties}
              >
                <button className="check-btn" aria-label={`完成 ${item.title}`} onClick={() => toggleTask(item.id)}>
                  {done[item.id] ? "✓" : ""}
                </button>
                <div className="task-card-body">
                  <div className="task-meta">
                    <span style={{ color: CATEGORY_META[item.category].color }}>{CATEGORY_META[item.category].label}</span>
                    <b>{item.period} · {item.startTime || timeRange(item.period, item.hours).startTime}—{item.endTime || timeRange(item.period, item.hours).endTime}</b>
                    {item.chainId && <b className="chain-badge">{item.chainName} · {chainIndex + 1}/{chain.length}</b>}
                    {!item.chainId && <b className="independent-badge">独立任务</b>}
                    {item.locked && <b className="locked-badge">固定锚点</b>}
                    {isNext && <b className="next-badge">下一节点</b>}
                    <em>{item.hours}h</em>
                  </div>
                  <h4>{item.title}</h4>
                  <p>{item.detail}</p>
                  {item.resourcePath && (
                    <div className="task-resource">
                      <code title={item.resourcePath}>{item.resourcePath}</code>
                      <button onClick={() => openResource(item.resourcePath!)}>打开资料</button>
                      <button onClick={() => copyPath(item.resourcePath!)}>复制路径</button>
                    </div>
                  )}
                  <div className="task-actions">
                    {item.locked ? (
                      <span className="fixed-action-note">{item.lockReason}</span>
                    ) : (
                      <>
                        {item.chainId && <button onClick={() => openInsert(item, "before")}>＋ 前插</button>}
                        {item.chainId && <button onClick={() => openInsert(item, "after")}>＋ 后插</button>}
                        <button disabled={Boolean(done[item.id])} onClick={() => shiftSchedule(item, -1)}>← 提前 1 天</button>
                        <button disabled={Boolean(done[item.id])} onClick={() => shiftSchedule(item, 1)}>顺延 1 天 →</button>
                        <button onClick={() => openEdit(item)}>编辑</button>
                        {item.chainId && <button disabled={Boolean(done[item.id]) || chainIndex <= 0 || Boolean(previousNode?.locked)} onClick={() => moveTask(item, -1)}>上移</button>}
                        {item.chainId && <button disabled={Boolean(done[item.id]) || chainIndex >= chain.length - 1 || Boolean(nextNode?.locked)} onClick={() => moveTask(item, 1)}>下移</button>}
                        <button className="danger-action" onClick={() => removeTask(item)}>删除</button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )})}
          </div>
          <button className="add-inline" onClick={() => openAdd(selected)}>＋ 为这一天添加任务</button>
        </aside>
      </section>

      <footer>
        <p>计划不是判决书。每周看一次数据，允许调整，但不要因为焦虑频繁换方向。</p>
        <span>正常作息 · 先不请假 · 新领军唯一主线</span>
      </footer>

      {showChainBoard && (
        <div className="modal-backdrop" onClick={() => setShowChainBoard(false)}>
          <section className="chain-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowChainBoard(false)}>×</button>
            <p className="section-label">独立链条看板</p>
            <h2>从已完成，到下一节点，再到固定锚点</h2>
            <div className="chain-board-tabs" aria-label="选择计划链">
              {(Object.keys(CHAIN_META) as ChainId[]).map((chainId) => (
                <button
                  key={chainId}
                  className={boardChainId === chainId ? "active" : ""}
                  style={{ "--chain": CHAIN_META[chainId].color } as React.CSSProperties}
                  onClick={() => setBoardChainId(chainId)}
                >
                  {CHAIN_META[chainId].name}
                </button>
              ))}
            </div>
            <div className="chain-sheet-summary" style={{ "--chain": CHAIN_META[boardChainId].color } as React.CSSProperties}>
              <div>
                <span>{CHAIN_META[boardChainId].name}</span>
                <strong>{activeBoardSummary.completed}<small> / {activeBoardSummary.chain.length}</small></strong>
              </div>
              <div className="chain-progress"><i style={{ width: `${activeBoardSummary.progress}%` }} /></div>
              <p>{activeBoardSummary.next ? <>下一节点：<b>{activeBoardSummary.next.title}</b> · {activeBoardSummary.next.date} {activeBoardSummary.next.startTime}</> : "这条链已经全部完成。"}</p>
            </div>
            <div className="chain-board-legend">
              <span><i className="done-dot" />已完成</span>
              <span><i className="next-dot" />下一节点</span>
              <span><i className="fixed-dot" />固定锚点</span>
            </div>
            <div className="chain-timeline">
              {activeBoardSummary.chain.map((item, index) => (
                <button
                  key={item.id}
                  className={`chain-timeline-node ${done[item.id] ? "done" : ""} ${nextNodeIds.has(item.id) ? "next" : ""} ${item.locked ? "locked" : ""}`}
                  style={{ "--chain": CHAIN_META[boardChainId].color } as React.CSSProperties}
                  onClick={() => {
                    const targetDate = dateFromIso(item.date);
                    setSelected(item.date);
                    setMonth(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
                    setShowChainBoard(false);
                  }}
                >
                  <span className="timeline-track"><i /></span>
                  <span className="timeline-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="timeline-copy">
                    <b>{item.title}</b>
                    <small>{item.date} · {item.startTime || timeRange(item.period, item.hours).startTime}—{item.endTime || timeRange(item.period, item.hours).endTime}</small>
                  </span>
                  {done[item.id] && <em>已完成</em>}
                  {nextNodeIds.has(item.id) && <em>下一节点</em>}
                  {item.locked && <em>固定</em>}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {showResources && (
        <div className="modal-backdrop" onClick={() => setShowResources(false)}>
          <section className="resource-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowResources(false)}>×</button>
            <p className="section-label">仅依据文件名与目录分类</p>
            <h2>本轮真正会用到的资料</h2>
            <div className="resource-summary">
              <div><strong>{STUDY_RESOURCES.filter((item) => item.priority !== "暂缓").length}</strong><span>筛出候选</span></div>
              <div><strong>{STUDY_RESOURCES.filter((item) => (resourceStatus[item.id] || item.initialStatus) === "已完成").length}</strong><span>确认已完成</span></div>
              <div><strong>{STUDY_RESOURCES.filter((item) => (resourceStatus[item.id] || item.initialStatus) === "待确认").length}</strong><span>等你确认</span></div>
              <p>目录里约 3,854 个文件，但本轮不需要逐本识别。下面只保留能直接服务一试、二试和面试的材料。</p>
            </div>
            <div className="resource-filters">
              {(["全部", "数学", "物理", "试卷", "语言"] as const).map((item) => (
                <button key={item} className={resourceFilter === item ? "active" : ""} onClick={() => setResourceFilter(item)}>{item}</button>
              ))}
            </div>
            <div className="resource-list">
              {STUDY_RESOURCES
                .filter((item) => resourceFilter === "全部" || item.track === resourceFilter)
                .map((item) => {
                  const status = resourceStatus[item.id] || item.initialStatus;
                  return (
                    <article className={`resource-card priority-${item.priority}`} key={item.id}>
                      <div className="resource-card-main">
                        <div className="resource-tags">
                          <span>{item.track}</span>
                          <b>{item.priority}</b>
                        </div>
                        <h3>{item.name}</h3>
                        <p>{item.use}</p>
                        <code>{item.location}</code>
                        <div className="resource-open-actions">
                          <button onClick={() => openResource(item.location)}>打开资料</button>
                          <button onClick={() => copyPath(item.location)}>复制路径</button>
                        </div>
                      </div>
                      <label>
                        你的状态
                        <select value={status} onChange={(event) => setStudyResourceStatus(item.id, event.target.value as ResourceStatus)}>
                          <option>计划使用</option>
                          <option>已完成</option>
                          <option>待确认</option>
                          <option>暂缓</option>
                        </select>
                      </label>
                    </article>
                  );
                })}
            </div>
          </section>
        </div>
      )}

      {showStrategy && (
        <div className="modal-backdrop" onClick={() => setShowStrategy(false)}>
          <section className="strategy-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowStrategy(false)}>×</button>
            <p className="section-label">最终执行口径</p>
            <h2>一张图看清整个冲刺</h2>
            <div className="ratio-bar">
              <div style={{ width: "50%", background: CATEGORY_META.数学.color }}>数学 50%</div>
              <div style={{ width: "20%", background: "#c97860" }}>共同物理 20%</div>
              <div style={{ width: "10%", background: CATEGORY_META.语言.color }}>语言 10%</div>
              <div style={{ width: "20%", background: "#874f40" }}>物理加强 20%</div>
            </div>
            <p className="ratio-note">这是改革后一试内部结构；二试与面试总权重未定，因此日历另外安排开放探索和答辩训练。</p>
            <div className="strategy-grid">
              <article><span>01</span><h3>数学保持高位</h3><p>数分、高代、群论为基本盘；补 ODE、图论与课程后段，但不无限铺新课。</p></article>
              <article><span>02</span><h3>物理完整建系</h3><p>从简谐振动、万有引力继续，覆盖普物主干，再进入四大力学必要核心。</p></article>
              <article><span>03</span><h3>二试看探索</h3><p>陌生定义 → 例子反例 → 猜想 → 证明 → 改条件，不再机械重复旧答案。</p></article>
              <article><span>04</span><h3>面试看真实理解</h3><p>80% 讲题答辩、纠错追问，20% 兴趣证据、学习经历与学术志向。</p></article>
            </div>
            <div className="phase-line">
              <div><b>7.25—8.02</b><span>重建结构</span></div>
              <div><b>8.03—9.12</b><span>数竞集训</span></div>
              <div><b>9.13</b><span>联赛</span></div>
              <div><b>9.14—10.05</b><span>混合冲刺</span></div>
              <div><b>10.06—10.17</b><span>考前收束</span></div>
            </div>
          </section>
        </div>
      )}

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <section className="add-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowAdd(false)}>×</button>
            <p className="section-label">{formMode === "edit" ? "修改节点" : formMode.startsWith("insert") ? "插入链条" : "自定义安排"}</p>
            <h2>{formMode === "edit" ? "编辑任务节点" : formMode.startsWith("insert") ? "在当前链中插入节点" : "添加一项具体任务"}</h2>
            {formMode.startsWith("insert") && <p className="insert-notice">插入后，只顺延本链后续未完成节点；遇到固定集训锚点就停止，其他链完全不变。</p>}
            <label>日期<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
            <div className="form-row">
              <label>时段<select value={form.period} onChange={(event) => {
                const period = event.target.value as Period;
                const exactTime = timeRange(period, durationFromTimes(form.startTime, form.endTime) || form.hours);
                setForm({ ...form, period, ...exactTime });
              }}><option>上午</option><option>下午</option><option>晚上</option></select></label>
              <label>分类<select value={form.category} disabled={formMode.startsWith("insert")} onChange={(event) => {
                const category = event.target.value as Category;
                setForm({ ...form, category });
              }}>{Object.keys(CATEGORY_META).map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <div className="form-row time-row">
              <label>开始时间<input type="time" value={form.startTime || ""} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label>
              <label>结束时间<input type="time" value={form.endTime || ""} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label>
              <label>精确时长<input readOnly value={durationFromTimes(form.startTime, form.endTime)?.toFixed(2) || "—"} /></label>
            </div>
            <label>所属安排
              <select
                value={form.chainId || ""}
                disabled={formMode.startsWith("insert")}
                onChange={(event) => {
                  const chainId = event.target.value as ChainId | "";
                  setForm({
                    ...form,
                    chainId: chainId || undefined,
                    chainName: chainId ? CHAIN_META[chainId].name : undefined,
                    category: chainId ? CHAIN_META[chainId].category : form.category,
                  });
                }}
              >
                <option value="">独立任务（只移动自己，不影响任何链）</option>
                {(Object.keys(CHAIN_META) as ChainId[]).map((chainId) => <option key={chainId} value={chainId}>{CHAIN_META[chainId].name}</option>)}
              </select>
            </label>
            <p className="arrangement-hint">{form.chainId
              ? "这是计划链节点：提前或顺延时会带动本链后续未完成节点，遇到固定集训即停止。"
              : "这是独立任务：适合临时事项，移动、编辑或删除都不会影响任何计划链。"}</p>
            <label>任务名称<input autoFocus placeholder="例如：重做万有引力错题" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label>完成标准<textarea placeholder="写清楚做到什么才算完成" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} /></label>
            <label>本地资料路径（PDF、电子书或文件夹）
              <input placeholder="例如：E:\资料库\物理资料\普通物理学.pdf" value={form.resourcePath || ""} onChange={(event) => setForm({ ...form, resourcePath: event.target.value })} />
            </label>
            <p className="path-hint">通过桌面启动器运行时可直接打开；若浏览器限制或路径不存在，会自动复制路径供你粘贴到资源管理器。</p>
            <button className="primary-btn save-btn" onClick={saveTask}>{formMode === "edit" ? "保存修改" : formMode.startsWith("insert") ? "插入并顺延" : "保存到日历"}</button>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
