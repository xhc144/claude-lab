# 2027 新领军学科能力测试 · 预测训练卷

按 2027 年清华丘成桐数学科学领军人才培养计划的考试结构，编写的一整套模拟训练卷：一试三卷、二试八卷、三试一卷，每卷另有“参考答案及评分标准”。
全部为本次编写的训练题，不是官方试题。官方没有公布任何一场的题量、时长和分值，二试、三试也没有考纲，卷面安排都是训练设置。

## 文件

| 场次 | 试卷 | 试题卷 | 答案与评分 |
| --- | --- | --- | --- |
| 一试 | 数学 1（分析、代数、几何与拓扑） | [r1-math1.pdf](dist/questions/r1-math1.pdf) | [答案](dist/answers/r1-math1-answers.pdf) |
| 一试 | 数学 2（概率统计、应用数学） | [r1-math2.pdf](dist/questions/r1-math2.pdf) | [答案](dist/answers/r1-math2-answers.pdf) |
| 一试 | 物理 | [r1-physics.pdf](dist/questions/r1-physics.pdf) | [答案](dist/answers/r1-physics-answers.pdf) |
| 二试 | 语言 · 语文 | [r2-chinese.pdf](dist/questions/r2-chinese.pdf) | [答案](dist/answers/r2-chinese-answers.pdf) |
| 二试 | 语言 · 英语 | [r2-english.pdf](dist/questions/r2-english.pdf) | [答案](dist/answers/r2-english-answers.pdf) |
| 二试 | 综合 · 物理加强 | [r2-physics-plus.pdf](dist/questions/r2-physics-plus.pdf) | [答案](dist/answers/r2-physics-plus-answers.pdf) |
| 二试 | 综合 · 化学 | [r2-chemistry.pdf](dist/questions/r2-chemistry.pdf) | [答案](dist/answers/r2-chemistry-answers.pdf) |
| 二试 | 综合 · 生物 | [r2-biology.pdf](dist/questions/r2-biology.pdf) | [答案](dist/answers/r2-biology-answers.pdf) |
| 二试 | 综合 · 计算机 | [r2-cs.pdf](dist/questions/r2-cs.pdf) | [答案](dist/answers/r2-cs-answers.pdf) |
| 二试 | 综合 · 经济 | [r2-economics.pdf](dist/questions/r2-economics.pdf) | [答案](dist/answers/r2-economics-answers.pdf) |
| 二试 | 综合 · 社科 | [r2-social.pdf](dist/questions/r2-social.pdf) | [答案](dist/answers/r2-social-answers.pdf) |
| 三试 | 现学现考（四元数与旋转；快度与相对论） | [r3-open.pdf](dist/questions/r3-open.pdf) | [答案](dist/answers/r3-open-answers.pdf) |

[设计说明](dist/notes.pdf)：卷子的身份与依据、历年 48 道一试真题的“经典结论”归类、各卷逐题设计、二试与三试的不确定性、独立审核记录与使用建议。

二试综合六科中按规定只需选考两科。建议先只打印试题卷，按建议用时独立完成，再对照答案。

## 重新编译

源文件在 `latex/`，使用墨经 Mojing 的 `mojing-exam`（试卷）与 `mojing-notes`（设计说明）文档类。需要 TeX Live 2023+（XeLaTeX、latexmk、ctex）和 Noto CJK 字体。

```bash
cd latex
bash build.sh             # 编译全部，PDF 复制到 ../dist/
bash build.sh r1-math1    # 只编译一份
```

每份试卷用同一份源文件生成两版：`latexmk r1-math1.tex` 得试题卷；加 `-jobname=r1-math1-answers -usepretex='\def\MojingAnswers{true}'` 得答案版。
