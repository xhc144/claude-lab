# 类与宏接口

## 目录

1. 通用选项、字体与颜色
2. 定理、数学记号与 TikZ
3. notes 讲义
4. exercise 习题
5. exam 试卷
6. paper 论文
7. book 书籍
8. translation 翻译

以下为绑定源版本的实际接口摘要。复杂签名以项目中的 `.cls`/`.sty` 及示例调用为准，勿凭名称推断参数。各类的同名命令可能具有不同语义，尤其 `\term`、`\solution`、`\exercises`。

## 1. 通用选项、字体与颜色

| 类选项 | 值或作用 |
| --- | --- |
| `latin` | `stix`、`termes`、`pagella`、`libertinus`、`newcm`、`lm`；book/translation 默认 pagella，其余 stix |
| `cjk` | `auto`（默认）、`source`、`noto`、`mac`、`windows`、`fandol` |
| `zihao` | ctex 字号，如 `5`（默认）、`-4` |
| `accent` | xcolor 颜色名，如 `mjPine` |
| `linespread` | 行距因子，默认 `1.3` |
| `print` | 超链接改为黑色 |

保留自动字体检测：Source Han → Noto CJK → macOS → Windows → Fandol；楷体与仿宋另行检测。强制选择 `cjk=source` 等时需核实对应字体存在，不假定会自动回退。FandolKai 原生按 1.07 倍放大。西文标题用 Source Sans Pro、等宽用 Source Code Pro；即使选择其他数学方案，花体字母仍使用 STIX Two Math。

公开命令：`\songti`、`\heiti`、`\kaishu`、`\fangsong`、`\heitimd`、`\mojingheadfont`、`\mojinglatin{pagella}`、`\mojingaccent[辅助色]{主题色}`、`\mojingcircled{3}`、`\mojingdate{2026/10/12}`。在导言区按用户要求以 xeCJK 的 `\setCJKmainfont` 等覆盖字体，不添加未授权商业字体或猜测系统字体名。

主题色：`mjIndigo` 黛蓝 #1F3B5C；`mjPine` 松绿 #2C5F4F；`mjVermilion` 朱砂 #9B2D20；`mjOchre` 赭石 #8B5E34；`mjPlum` 紫檀 #5B3F63；`mjInk` 墨 #1A1A1A。优先使用这些原生色名。

## 2. 定理、数学记号与 TikZ

定理类共用计数器：`theorem`、`lemma`、`proposition`、`corollary`、`conjecture`、`definition`、`example`、`axiom`、`problem`，对应星号环境不编号；`remark`、`notation` 不编号。`proof`、`solution`、`analysis` 分别为证明、解、分析，但 exercise/exam 会重定义或过滤解答。

使用 `\label`/`\cref` 引用定理、式、图等。创建新环境使用 `\mojingnewtheorem[mjplain]{claim}{断言}`，不编号使用其星号形式。装饰使用 `\mojingdecorate{theorem}{bar}`，可选 `bar`、`graybar`、`shade`、`tint`、`frame`、`rules`。按需通过公开的 `\mojingthmheadfont`、`\mojingthmbodyfont`、`\mojingthmindent`、`\mojingthmabove` 等宏调整，勿与原生环境重名。

常用数学命令：
- `\R`、`\C`、`\Z`、`\Q`、`\N`、`\F`、`\K`；`\dd x`、`\ee`、`\ii`
- `\abs{x}`、`\norm{x}`、`\floor{x}`、`\ceil{x}`，星号形式自动伸缩
- `\inner{u}{v}`、`\set{x \given x>0}`、`\vb{x}`、`A\T`
- `\diff{y}{x}`、`\diff[2]{y}{x}`、`\pdiff{f}{x}`
- `\Res`、`\Arg`、`\tr`、`\rank`、`\diag`、`\sgn`、`\Span`、`\Ker`、`\argmin`、`\argmax`

原模板将 `\le`/`\ge` 换成斜不等号、`\emptyset` 换成 `\varnothing`，不重复定义。

TikZ/pgfplots 原生样式：`mj axis`、`mj curve`、`mj curve2`、`mj aux`、`mj fill`、`mj point`、`mj hollow`、`mj cross`、`mj arrow mid=.3`；axis 的 `mojing` 为居中坐标轴，`mojing box` 为方框数据图。绘制可编辑矢量图，保留线宽、箭头和配色。

## 3. notes 讲义

元信息：`\course[英文名]{中文名}`、`\term{学期}`、`\instructor{教师}`、`\institute{单位}`；正文中 `\maketitle`、`\tableofcontents`。

`\lecture[number=4,date=日期,scribe=记录人,lecturer=讲授人,short=页眉短题]{讲题}` 新开一讲并设编号。未指定 lecturer 时取 instructor。节、公式、定理、图表带讲次前缀。

- `keypoints`：本讲要点框
- `\sidenote[偏移]{文字}`、`\margintext[偏移]{文字}`：编号/不编号旁注
- `marginfigure[偏移]`：旁注栏小图，可用 caption/label
- `exercises`：讲末习题，使用 enumerate 排题；`\item\hard` 标选做
- `nomargin`：正文加宽，旁注改为脚注，旁图改为正文小图；`twoside`：双面

## 4. exercise 习题

`\sheetinfo{course=课程,session=课次,title=题目,date=日期,ta=助教,scope=范围}`；正文中 `\maketitle`。

```latex
\begin{problem}[difficulty=2,title=题名,points=10,space=5cm]
题目……
\begin{hint}提示……\end{hint}
\end{problem}
\begin{solution}[解答]
推导……\answer{$\ln 2$}
\begin{note}评注……\end{note}
\end{solution}
\printsolutions
```

`difficulty` 用 1–3；`space` 是学生版作答空白。`hint` 在学生版仍显示，若提示不应公开必须有意调整。`note` 为评注。`recap` 和 `\difficultylegend` 生成要点/难度说明；`\ifanswers{教师版内容}{学生版内容}` 控制版本内容。`answers=end` 时保留 `\printsolutions[参考解答]`，否则收集的解答不会出现在预期位置。

## 5. exam 试卷

类选项 `answers` 显示答案版；`seal=odd|all|first|none` 控制密封线。`\examtitle{标题}`、`\secret{保密标记}`、`\sealfields{考生栏信息}`。

```latex
\begin{paper}[time={8:00—9:20},full=120]{第一试}
\begin{instructions}\item 注意事项……\end{instructions}
\begin{gradingnotes}\item 评分说明……\end{gradingnotes}
\scoretable{一,二,11,12,13}
\examsection*{选择题}{每小题 6 分……}
\begin{questions}
\question[6] 题干……\paren[A]
\choices{选项 A}{选项 B}{选项 C}{选项 D}
\begin{solution}解析……\score{4}\end{solution}
\end{questions}
\end{paper}
```

`\examsection*{名称}{说明}` 的星号加入得分/评卷人小表，真实签名是星号，不使用旧头注中的 `[scorebox]` 写法。`questions[chinese]` 改用中文编号。`\fillin[答案][宽度]` 生成填空线；`\answerspace{高度}` 仅试题版显示；`withfigure[比例]{图}` 将题干与插图并排。`\score{分值}` 为段末评分点；`solution`/`proof` 仅答案版显示。`instructions` 仅试题版、`gradingnotes` 仅答案版；`\ifanswers{答案版内容}{试题版内容}` 可条件显示。`\papertotalpages` 需要多轮编译，单文件多份 paper 的页码各从 1 起算。

## 6. paper 论文

类选项：`thmstyle=kai|song`、`preprint`、`enabstract=front|end`、`oneside`。

导言区依次设置 `\addbibresource{refs.bib}`、`\journalinfo{name=刊名,enname=英文刊名,volume=卷,issue=期,year=年,month=月,doi=DOI,arxiv=编号,firstpage=起页}`，以及：
- `\title[页眉短题]{中文题目}`、`\entitle{英文题目}`
- `\author[页眉作者]{作者\affil{1}}`、`\enauthor{英文作者}`
- `\affiliation{中文单位}`、`\enaffiliation{英文单位}`
- `abstract`/`enabstract` 环境、`\keywords{…}`、`\enkeywords{…}`、`\msc{…}`
- `\received{日期}`、`\revised{日期}`、`\funding{基金}`、`\authorinfo{作者信息}`

正文用 `\maketitle`、`\printreferences`。英文摘要默认文末，可设 front 或手动 `\printenabstract`。GB/T 7714—2015 顺序编码，`\cite` 为上标，`\parencite` 为非上标；中文条目加 `langid={chinese}`。保留 `data/*.dat` 及 `data/make_data.py`；脚本只在需要重新生成示例数值、已阅读其代码时运行。

## 7. book 书籍

`\booktitle{书名}`、`\booksubtitle{副题}`、`\bookentitle{英文书名}`、`\bookauthor{作者}`、`\bookedition{版次}`、`\publisher{出版社}{地点}{年份}`。

按 `\frontmatter` → `\mainmatter` → `\backmatter` 组织：半书名页 `\halftitlepage`，书名页 `\maketitle`，`copyrightpage` 环境，`\unnumberedchapter{前言}`、目录；正文 `\partintro{导言}` 紧邻 `\part{标题}`，章中 `\epigraph{题词}{出处}`、`\chaptertoc`；书末答案、`\printreferences`、`\printindex`。

- `\term[拼音排序键]{术语}`：醒目标注并编入索引。需拼音排序时明确给排序键，不假定自动汉字转拼音
- `algorithm[名称]`：与定理共用编号
- `exercises[标题]`、`\exgroup{A 组}`：章末分组习题，组间连续编号
- `history[标题]`：历史注记
- `openany` 允许章从偶数页开始

保留 `chapters/ch1.tex`、`ch2.tex`、`answers.tex` 的分章依赖或同步更新全部 `\input`。类会生成 `mojing-book.ist`，用 makeindex 处理索引；无需无依据添加 `-shell-escape`。

## 8. translation 翻译

类选项 `layout=facing|columns|interleave|target`。元信息：`\booktitle{译名}`、`\origtitle{原名}`、`\bookauthor{中文作者信息}`、`\origauthor{原作者名}`、`\translator{译者}`、`\sourcenote{来源}`、`\seriesname{丛书名}`；`\maketitle` 与 `\halftitle`。

在 `pairs` 环境内交替写 `original` 和 `translated`，逐段一一对应，不把两种语言各自收成整章。`\pairtitle{原文篇名}{原文副题}{译文篇名}{译文副题}`、`\pairheading{原文标题}{译文标题}`、`\omission`、`\origpage{437}`。

原注用 `\footnote`，译注用 `\yizhu{文字}`，两种编号分离。`\term{原文}{译名}` 首次出现括注原文，`\printglossary[术语对照表]` 自动汇表。检查 facing 是否始终左原右译、columns 是否栏宽合适、段落编号与脚注是否正确。target 隐藏原文，不删除原文源文件。
