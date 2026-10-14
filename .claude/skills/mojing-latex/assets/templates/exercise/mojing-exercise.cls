%% mojing-exercise.cls
%% 墨经 Mojing —— 习题与解答
%%
%% 设计要点：
%%   * 题号悬挂在左边距中，难度星级排在题号下方，正文左缘整齐；
%%   * 一份源文件输出三种版本（选项 answers）：
%%       inline  解答紧随题目（教师版，默认）
%%       end     解答集中排在文末“参考解答”中
%%       none    不印解答（学生版），可按 \begin{problem}[space=4cm] 留出作答空白
%%     也可在命令行指定，不改源文件：
%%       xelatex -jobname=main-student "\def\MojingAnswers{none}\input{main}"
%%   * 节标题用汉字序号（一、二、……）并延伸一条细线；主题色松绿。
%%
%% 环境与命令：
%%   problem[difficulty=1..3, title=..., points=..., space=...]
%%   solution  hint  note(评注)  \answer{最终答案}
%%   \sheetinfo{...}  \printsolutions
%%
%% 本文件以 LPPL 1.3c 发布。
\NeedsTeXFormat{LaTeX2e}[2022/06/01]
\ProvidesExplClass{mojing-exercise}{2026/10/13}{1.0}{Mojing: problem sets}

\tl_new:N \l__mjx_answers_tl
\cs_new_protected:Npn \__mojing_forward_option:
  {
    \tl_if_empty:NTF \l_keys_value_tl
      { \exp_args:Ne \PassOptionsToPackage { \l_keys_key_str } { mojing-core } }
      {
        \exp_args:Ne \PassOptionsToPackage
          { \l_keys_key_str = \exp_not:V \l_keys_value_tl } { mojing-core }
      }
  }
\keys_define:nn { mojing / exercise }
  {
    answers .choices:nn = { inline , end , none }
      { \tl_set_eq:NN \l__mjx_answers_tl \l_keys_choice_tl } ,
    answers .initial:n = inline ,
    draft   .code:n = { \PassOptionsToClass { draft } { article } } ,
    unknown .code:n = { \__mojing_forward_option: } ,
  }
\PassOptionsToPackage { accent = mjPine , zihao = 5 } { mojing-core }
\ProcessKeyOptions [ mojing / exercise ]
%% 命令行覆盖：\def\MojingAnswers{none}
\cs_if_exist:NT \MojingAnswers
  { \exp_args:Nne \keys_set:nn { mojing / exercise } { answers = \MojingAnswers } }

\LoadClass [ a4paper , oneside ] { article }
\RequirePackage { mojing-core }
\RequirePackage { mojing-math }
\RequirePackage { mojing-tikz }
\RequirePackage { needspace }

%% ---------------------------------------------------------------------------
%% 版心：左边距略宽，用来悬挂题号
%% ---------------------------------------------------------------------------
\RequirePackage { geometry }
\geometry
  { a4paper , textwidth = 148mm , left = 34mm ,
    top = 28mm , bottom = 26mm , headsep = 8mm , footskip = 13mm }

%% ---------------------------------------------------------------------------
%% 讲次信息与标题区
%% ---------------------------------------------------------------------------
\tl_new:N \l__mjx_course_tl
\tl_new:N \l__mjx_session_tl
\tl_new:N \l__mjx_title_tl
\tl_new:N \l__mjx_date_tl
\tl_new:N \l__mjx_ta_tl
\tl_new:N \l__mjx_scope_tl
\keys_define:nn { mojing / sheet }
  {
    course  .tl_set:N = \l__mjx_course_tl ,
    session .tl_set:N = \l__mjx_session_tl ,
    title   .tl_set:N = \l__mjx_title_tl ,
    date    .tl_set:N = \l__mjx_date_tl ,
    ta      .tl_set:N = \l__mjx_ta_tl ,
    scope   .tl_set:N = \l__mjx_scope_tl ,
  }
\NewDocumentCommand \sheetinfo { m } { \keys_set:nn { mojing / sheet } {#1} }

\cs_new_protected:Npn \__mjx_version_tag:
  {
    \str_case:Vn \l__mjx_answers_tl
      {
        { inline } { 教师版 · 含解答 }
        { end }    { 解答附后 }
        { none }   { 学生版 }
      }
  }

\cs_new_protected:Npn \__mjx_meta:nn #1#2
  {
    \tl_if_empty:nF {#2}
      { \mbox { { \color { mjGray } #1 } \enspace #2 } \hspace { 1.8em } }
  }
\cs_generate_variant:Nn \__mjx_meta:nn { nV }

\RenewDocumentCommand \maketitle { }
  {
    \thispagestyle { mjxfirst }
    \vspace* { -6mm }
    \noindent
    \makebox [ \textwidth ] [ l ]
      {
        \small \color { mjAccent } \mojingheadfont
        \l__mjx_course_tl
        \hfill
        \l__mjx_session_tl
      }
    \par \vspace { 1.5mm }
    \noindent { \color { mjAccent } \rule { \textwidth } { 1.2pt } } \par
    \vspace { .6mm }
    \noindent { \color { mjAccent } \rule { \textwidth } { .3pt } } \par
    \vspace { 6mm }
    \noindent
    { \fontsize { 21 } { 26 } \selectfont \sffamily \bfseries \color { mjInk }
      \l__mjx_title_tl \par }
    \vspace { 3.5mm }
    \noindent
    { \small
      \__mjx_meta:nV { 日期 } \l__mjx_date_tl
      \__mjx_meta:nV { 助教 } \l__mjx_ta_tl
      \__mjx_meta:nV { 范围 } \l__mjx_scope_tl
      \hfill
      \fcolorbox { mjAccent } { white }
        { \footnotesize \color { mjAccent } \heitimd \__mjx_version_tag: }
      \par }
    \vspace { 5mm }
  }

%% ---------------------------------------------------------------------------
%% 节标题：一、二、…… + 延伸细线
%% ---------------------------------------------------------------------------
\cs_new_protected:Npn \__mjx_section_title:n #1
  {
    #1
    \hspace { .8em }
    \leaders \hbox { { \color { mjAccentMid } \rule [ .55ex ] { 1pt } { .4pt } } } \hfill
    \null
  }
\ctexset
  {
    section =
      {
        name         = { , } ,
        number       = \chinese { section } 、 ,
        format       = \large \mojingheadfont ,
        numberformat = \color { mjAccent } ,
        aftername    = { } ,
        titleformat  = \__mjx_section_title:n ,
        beforeskip   = 1.6\baselineskip plus .4\baselineskip ,
        afterskip    = .8\baselineskip ,
        indent       = 0pt ,
      } ,
    subsection =
      {
        format     = \normalsize \mojingheadfont ,
        numberformat = \color { mjAccent } ,
        number     = \arabic { section } . \arabic { subsection } ,
        aftername  = \hspace { .8em } ,
        beforeskip = 1.1\baselineskip , afterskip = .5\baselineskip ,
        indent     = 0pt ,
      } ,
  }

%% ---------------------------------------------------------------------------
%% 页眉页脚
%% ---------------------------------------------------------------------------
\RequirePackage { fancyhdr }
\pagestyle { fancy }
\fancyhf { }
\fancyhead [ L ] { \small \color { mjGray } \l__mjx_course_tl }
\fancyhead [ R ] { \small \color { mjGray } \l__mjx_title_tl
                   \hspace { 1em } { \color { mjAccent } \heitimd \__mjx_version_tag: } }
\fancyfoot [ C ] { \small \color { mjAccent } \sffamily \bfseries \thepage }
\RenewDocumentCommand \headrulewidth { } { .3pt }
\RenewDocumentCommand \headrule { }
  { { \color { mjRule } \hrule height \headrulewidth width \headwidth \vskip - \headrulewidth } }
\fancypagestyle { mjxfirst }
  {
    \fancyhf { }
    \fancyfoot [ C ] { \small \color { mjAccent } \sffamily \bfseries \thepage }
    \RenewDocumentCommand \headrulewidth { } { 0pt }
  }

%% ---------------------------------------------------------------------------
%% 超链接、定理环境
%% ---------------------------------------------------------------------------
\mojingloadhyperref
\RequirePackage { mojing-theorem }
\mojingtheoremcounter { none }
\mojingdefinetheorems
\mojingdecorate { theorem } { bar }
\mojingdecorate { definition } { bar }

%% ---------------------------------------------------------------------------
%% 题目
%% ---------------------------------------------------------------------------
\newcounter { problem }
\crefname { problem } { 题 } { 题 }
\int_new:N  \l__mjx_difficulty_int
\tl_new:N   \l__mjx_ptitle_tl
\tl_new:N   \l__mjx_points_tl
\tl_new:N   \l__mjx_space_tl
\keys_define:nn { mojing / problem }
  {
    difficulty .int_set:N = \l__mjx_difficulty_int ,
    title      .tl_set:N  = \l__mjx_ptitle_tl ,
    points     .tl_set:N  = \l__mjx_points_tl ,
    space      .tl_set:N  = \l__mjx_space_tl ,
  }

\cs_new_protected:Npn \__mjx_stars:n #1
  {
    \int_compare:nNnT {#1} > { 0 }
      {
        \prg_replicate:nn {#1} { \ensuremath { \bigstar } }
        { \color { mjAccent!25 } \prg_replicate:nn { 3 - #1 } { \ensuremath { \bigstar } } }
      }
  }
%% 悬挂在左边距的题号与难度
\cs_new_protected:Npn \__mjx_problem_label:
  {
    \llap
      {
        \raisebox { 0pt } [ \height ] [ 0pt ]
          {
            \parbox [ t ] { 18mm }
              {
                \leavevmode \raggedleft
                { \large \mojingsansmedium \color { mjAccent } \theproblem } \par
                \vspace { -1pt }
                { \scriptsize \color { mjAccent } \__mjx_stars:n { \l__mjx_difficulty_int } }
              }
          }
        \hspace { 5mm }
      }
  }

%% 紧跟在 \begin{problem} 之后的 \label 及其后的空格一并吸收，
%% 以免行首多出一个空格
\cs_new_protected:Npn \__mjx_absorb_label:
  {
    \peek_meaning_remove_ignore_spaces:NTF \label
      { \__mjx_label:n }
      { }
  }
\cs_new_protected:Npn \__mjx_label:n #1
  { \label {#1} \__mjx_absorb_label: }

\DeclareDocumentEnvironment { problem } { O{} }
  {
    \int_zero:N \l__mjx_difficulty_int
    \tl_clear:N \l__mjx_ptitle_tl
    \tl_clear:N \l__mjx_points_tl
    \tl_clear:N \l__mjx_space_tl
    \keys_set:nn { mojing / problem } {#1}
    \par \addvspace { 1.1\baselineskip plus .3\baselineskip }
    %% 学生版：题目与作答空白尽量排在同一页
    \str_if_eq:VnT \l__mjx_answers_tl { none }
      {
        \tl_if_empty:NF \l__mjx_space_tl
          { \needspace { \dim_eval:n { \l__mjx_space_tl + 3\baselineskip } } }
      }
    \refstepcounter { problem }
    \noindent
    \__mjx_problem_label:
    \hskip 0pt
    \tl_if_empty:NF \l__mjx_ptitle_tl
      { { \mojingheadfont \l__mjx_ptitle_tl } \hspace { 1em } }
    \tl_if_empty:NF \l__mjx_points_tl
      { { \color { mjGray } （ \l__mjx_points_tl \, 分） } }
    \__mjx_absorb_label:
  }
  {
    \par
    \str_if_eq:VnT \l__mjx_answers_tl { none }
      {
        \tl_if_empty:NF \l__mjx_space_tl
          { \vspace { \l__mjx_space_tl } }
      }
  }

%% ---------------------------------------------------------------------------
%% 解答：按 answers 选项决定立即排出、收集到文末或不排
%% ---------------------------------------------------------------------------
\seq_new:N \g__mjx_solutions_seq

\cs_new_protected:Npn \__mjx_solution_box:nn #1#2
  {
    \begin{tcolorbox}
      [ mojing/base , blanker ,
        left = 11pt , right = 0pt , top = 2pt , bottom = 2pt ,
        borderline~west = { .8pt } { 0pt } { mjAccent!45 } ,
        before~skip = .5\baselineskip , after~skip = .3\baselineskip ]
      \noindent
      { \mojingheadfont \color { mjAccent } #1 } \hspace { 1em }
      #2
    \end{tcolorbox}
  }

\RenewDocumentEnvironment { solution } { O{解答} +b }
  {
    \str_case:Vn \l__mjx_answers_tl
      {
        { inline } { \__mjx_solution_box:nn {#1} {#2} }
        { end }
          {
            \seq_gput_right:Ne \g__mjx_solutions_seq
              {
                \exp_not:N \__mjx_print_solution:nnn
                  { \theproblem } { \exp_not:n {#1} } { \exp_not:n {#2} }
              }
          }
        { none } { }
      }
  }
  { }

\cs_new_protected:Npn \__mjx_print_solution:nnn #1#2#3
  {
    \par \addvspace { .9\baselineskip }
    \noindent
    \llap
      {
        \parbox [ t ] { 18mm }
          { \leavevmode \raggedleft { \large \mojingsansmedium \color { mjAccent } #1 } }
        \hspace { 5mm }
      }
    { \mojingheadfont \color { mjAccent } #2 } \hspace { 1em }
    #3 \par
  }

\NewDocumentCommand \printsolutions { O{参考解答} }
  {
    \str_if_eq:VnT \l__mjx_answers_tl { end }
      {
        \clearpage
        \section* { #1 }
        \seq_use:Nn \g__mjx_solutions_seq { }
      }
  }

%% 提示（学生版也印出）
\NewDocumentEnvironment { hint } { O{提示} }
  {
    \par \addvspace { .25\baselineskip }
    \noindent
    { \small \color { mjGray } \heitimd #1 } \hspace { .8em }
    \small \kaishu \color { mjInk!85 }
  }
  { \par }

%% 评注：解答后的方法总结
\NewDocumentEnvironment { note } { O{评注} }
  {
    \par \addvspace { .35\baselineskip }
    \noindent
    { \color { mjAccent } \heitimd \small 【 #1 】 }
    \kaishu
  }
  { \par }

%% 最终答案
\NewDocumentCommand \answer { m }
  {
    \par \addvspace { .3\baselineskip }
    \hfill
    \colorbox { mjAccentLight }
      { \small { \color { mjAccent } \heitimd 答案 } \enspace #1 }
    \par
  }

%% 本周要点
\NewDocumentEnvironment { recap } { O{本周要点} }
  {
    \begin{tcolorbox}
      [ mojing/base , frame~hidden , colback = mjLight ,
        left = 12pt , right = 12pt , top = 8pt , bottom = 8pt ,
        before~skip = 0pt , after~skip = 1\baselineskip ]
      { \mojingheadfont \color { mjAccent } #1 \par }
      \vspace { .35\baselineskip }
      \small
  }
  { \end{tcolorbox} }

%% 难度说明
\NewDocumentCommand \difficultylegend { }
  {
    \par \noindent
    { \small \color { mjGray }
      难度：
      { \color { mjAccent } \__mjx_stars:n { 1 } } \, 基础 \quad
      { \color { mjAccent } \__mjx_stars:n { 2 } } \, 提高 \quad
      { \color { mjAccent } \__mjx_stars:n { 3 } } \, 挑战 \par }
  }

\NewDocumentCommand \ifanswers { +m +m }
  { \str_if_eq:VnTF \l__mjx_answers_tl { none } {#2} {#1} }

\AtBeginDocument { \raggedbottom }
\endinput
