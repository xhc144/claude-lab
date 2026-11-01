import React from 'react'
import { ArrowRight, BookOpen, Compass, Sparkles } from 'lucide-react'

export default function Home() {
  return <main className="home-shell">
    <nav className="home-nav"><a className="home-brand" href="/"><span>AF</span> AI Field Guide</a><a className="home-link" href="/game">进入竞技场 <ArrowRight size={15} /></a></nav>
    <section className="home-hero"><div><p className="home-kicker">FIELD NOTES / 2026</p><h1>和 AI 一起<br /><em>做得更深。</em></h1><p>一份写给好奇心的现场指南。<br />从 Agent、Prompt 到评估，拆开当下 AI 的工作方式。</p><a className="home-action" href="#guide">开始探索 <ArrowRight size={16} /></a></div><div className="home-orbit"><span className="orbit-center"><Sparkles size={28} />intent</span><i className="orbit-one" /><i className="orbit-two" /><b className="orbit-node one">01<br /><strong>Plan</strong></b><b className="orbit-node two">02<br /><strong>Use tools</strong></b><b className="orbit-node three">03<br /><strong>Reflect</strong></b></div></section>
    <section className="home-signal">AI 的下一步，不是替你思考，而是把你的思考变成一套<strong>可复用的系统。</strong></section>
    <section className="home-guide" id="guide"><p className="home-kicker">概念地图</p><h2>先找到你正在谈论的东西。</h2><div className="home-list"><Item icon={<Compass />} title="Agent" text="会规划、会调用工具、会复盘的执行者。" /><Item icon={<BookOpen />} title="Prompt" text="把模糊意图，变成可重复的工作指令。" /><Item icon={<Sparkles />} title="Evals" text="用可观测的标准，判断输出是否真的变好。" /></div></section>
  </main>
}
function Item({ icon, title, text }) { return <article><span>{icon}</span><div><h3>{title}</h3><p>{text}</p></div><ArrowRight size={18} /></article> }
