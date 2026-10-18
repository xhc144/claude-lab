%% mojing-exam.cls
%% 墨经 Mojing —— 竞赛与考试试卷
%%
%% 设计要点：
%%   * 遵循国内正式试卷的版式惯例：左侧密封线（奇数页）、卷首得分栏、
%%     “注意事项”、各大题前的“得分 / 评卷人”小表、页脚“第 x 页（共 y 页）”；
%%   * 一份源文件生成“试题卷”与“参考答案及评分标准”两种版本（选项 answers），
%%     答案版自动填入选择题答案与填空答案，印出解答与“…… 4 分”式的评分点；
%%   * 选择题选项按最长选项的宽度自动排成一行四个、一行两个或一行一个；
%%   * 一个文件可包含多份试卷（如“第一试”“加试”），页码各自从 1 起算。
%%   * 全卷只用黑色（印刷友好）；答案版的答案用朱砂色标出。
%%
%% 主要命令：
%%   \examtitle{..}  \secret{绝密★启用前}
%%   \begin{paper}[time=..., full=...]{第一试} ... \end{paper}
%%   \scoretable{一,二,9,10,11}   \begin{instructions} \item ... \end{instructions}
%%   \examsection[scorebox]{选择题}{说明}
%%   \begin{questions}[chinese] \question[分值] ... \end{questions}
%%   \paren[答案]  \choices{A}{B}{C}{D}  \fillin[答案][宽度]  \answerspace{高度}
%%   \begin{solution} ... \score{4} ... \end{solution}
%%
%% 本文件以 LPPL 1.3c 发布。
\NeedsTeXFormat{LaTeX2e}[2022/06/01]
\ProvidesExplClass{mojing-exam}{2026/10/13}{1.0}{Mojing: exam papers}

\bool_new:N \g__mje_answers_bool
\tl_new:N   \l__mje_seal_tl
\cs_new_protected:Npn \__mojing_forward_option:
  {
    \tl_if_empty:NTF \l_keys_value_tl
      { \exp_args:Ne \PassOptionsToPackage { \l_keys_key_str } { mojing-core } }
      {
        \exp_args:Ne \PassOptionsToPackage
          { \l_keys_key_str = \exp_not:V \l_keys_value_tl } { mojing-core }
      }
  }
\keys_define:nn { mojing / exam }
  {
    answers .bool_gset:N = \g__mje_answers_bool ,
    answers .default:n   = true ,
    seal    .choices:nn  = { odd , all , first , none }
      { \tl_set_eq:NN \l__mje_seal_tl \l_keys_choice_tl } ,
    seal    .initial:n   = odd ,
    unknown .code:n      = { \__mojing_forward_option: } ,
  }
\PassOptionsToPackage { accent = black , zihao = 5 , linespread = 1.32 } { mojing-core }
\ProcessKeyOptions [ mojing / exam ]
%% 命令行覆盖：xelatex "\def\MojingAnswers{true}\input{main}"
\cs_if_exist:NT \MojingAnswers
  { \exp_args:Nne \keys_set:nn { mojing / exam } { answers = \MojingAnswers } }

\LoadClass [ a4paper , oneside ] { article }
\RequirePackage { mojing-core }
\RequirePackage { mojing-math }
\RequirePackage { mojing-tikz }
\RequirePackage { refcount }
\RequirePackage { eso-pic }
\RequirePackage { needspace }

\colorlet { mjAnswer } { mjVermilion }
\bool_if:NT \g__mje_answers_bool { \tl_set:Nn \l__mje_seal_tl { none } }

%% ---------------------------------------------------------------------------
%% 版心：左侧留出密封线位置
%% ---------------------------------------------------------------------------
\RequirePackage { geometry }
\str_if_eq:VnTF \l__mje_seal_tl { none }
  {
    \geometry { a4paper , left = 26mm , right = 26mm , top = 22mm , bottom = 24mm ,
                headsep = 6mm , footskip = 12mm }
  }
  {
    \geometry { a4paper , left = 33mm , right = 19mm , top = 22mm , bottom = 24mm ,
                headsep = 6mm , footskip = 12mm }
  }
\setlength { \parskip } { 0pt plus 1pt }

%% ---------------------------------------------------------------------------
%% 超链接与定理环境（解答、证明在后文按答案版重新定义）
%% ---------------------------------------------------------------------------
\mojingloadhyperref
\hypersetup { hidelinks }
\RequirePackage { mojing-theorem }
\mojingtheoremcounter { none }
\RenewDocumentCommand \mojingthmheadfont { } { \normalfont \heiti }
\RenewDocumentCommand \mojingproofheadfont { } { \normalfont \heiti }
\RenewDocumentCommand \mojingqedsymbol { } { \ensuremath { \square } }

%% ---------------------------------------------------------------------------
%% 试卷信息
%% ---------------------------------------------------------------------------
\tl_new:N \l__mje_title_tl
\tl_new:N \l__mje_secret_tl
\tl_new:N \g__mje_paper_tl
\tl_new:N \l__mje_time_tl
\tl_new:N \l__mje_full_tl
\NewDocumentCommand \examtitle { m } { \tl_set:Nn \l__mje_title_tl {#1} }
\NewDocumentCommand \secret    { m } { \tl_set:Nn \l__mje_secret_tl {#1} }
\NewDocumentCommand \ifanswers { +m +m }
  { \bool_if:NTF \g__mje_answers_bool {#1} {#2} }

\keys_define:nn { mojing / paper }
  {
    time .tl_set:N = \l__mje_time_tl ,
    full .tl_set:N = \l__mje_full_tl ,
  }

\newcounter { mjpaper }
\NewDocumentEnvironment { paper } { O{} m }
  {
    \tl_clear:N \l__mje_time_tl
    \tl_clear:N \l__mje_full_tl
    \keys_set:nn { mojing / paper } {#1}
    \clearpage
    \stepcounter { mjpaper }
    \setcounter { page } { 1 }
    \tl_gset:Nn \g__mje_paper_tl {#2}
    \restartlist { questions }
    \setcounter { mjsection } { 0 }
    \__mje_title_block:n {#2}
  }
  {
    \label { mje-paper- \arabic { mjpaper } -last }
    \clearpage
  }

\cs_new_protected:Npn \__mje_title_block:n #1
  {
    \thispagestyle { mjefirst }
    \tl_if_empty:NF \l__mje_secret_tl
      {
        \vspace* { -6mm }
        \noindent { \small \heiti \l__mje_secret_tl } \par
        \vspace { 2mm }
      }
    \begin{center}
      { \fontsize { 18 } { 24 } \selectfont \heitimd \l__mje_title_tl \par }
      \vspace { 2.5mm }
      { \fontsize { 15 } { 20 } \selectfont \heitimd
        #1 \bool_if:NT \g__mje_answers_bool { \enspace 参考答案及评分标准 } \par }
      \bool_if:NF \g__mje_answers_bool
        {
          \vspace { 2mm }
          { \normalsize
            （
            \tl_if_empty:NF \l__mje_time_tl { 考试时间：\l__mje_time_tl }
            \tl_if_empty:NF \l__mje_full_tl { \hspace { 1.5em } 满分：\l__mje_full_tl \, 分 }
            ）\par }
        }
    \end{center}
    \vspace { 1mm }
  }

%% ---------------------------------------------------------------------------
%% 注意事项、得分栏
%% ---------------------------------------------------------------------------
\NewDocumentEnvironment { instructions } { O{注意事项} +b }
  {
    \bool_if:NF \g__mje_answers_bool
      {
        \par \small
        \noindent { \heitimd #1 } \par
        \begin{enumerate}
          [ label = \arabic* ． , leftmargin = 2.4em , labelsep = 0pt ,
            align = left , labelwidth = 1.6em , itemsep = 0pt , topsep = 1pt ]
          #2
        \end{enumerate}
        \par \vspace { 3mm }
      }
  }
  { }
%% 本份试卷的总页数（需编译两遍）
\NewDocumentCommand \papertotalpages { }
  {
    \refused { mje-paper- \arabic { mjpaper } -last }
    \getpagerefnumber { mje-paper- \arabic { mjpaper } -last }
  }

\seq_new:N \l__mje_items_seq
\dim_new:N \l__mje_tmp_dim
\cs_new_protected:Npn \__mje_score_tabular:n #1
  {
    \begin{tabular}
      { | >{ \centering \arraybackslash } p { 4.6em }
        | * {#1} { >{ \centering \arraybackslash } p { \l__mje_tmp_dim } | } }
  }
\cs_generate_variant:Nn \__mje_score_tabular:n { e }
\NewDocumentCommand \scoretable { m }
  {
    \bool_if:NF \g__mje_answers_bool
      {
        \seq_set_from_clist:Nn \l__mje_items_seq {#1}
        \int_set:Nn \l_tmpa_int { \seq_count:N \l__mje_items_seq + 1 }
        \dim_set:Nn \l__mje_tmp_dim
          {
            ( \linewidth - 4.6em - \arrayrulewidth * ( \l_tmpa_int + 2 ) )
            / \l_tmpa_int - 1sp
          }
        \par \vspace { 1mm }
        \begin{center}
          \renewcommand \arraystretch { 1.7 }
          \setlength \tabcolsep { 0pt }
          \__mje_score_tabular:e { \int_use:N \l_tmpa_int }
            \hline
            题号 & \seq_use:Nn \l__mje_items_seq { & } & 总分 \\ \hline
            得分 \prg_replicate:nn { \l_tmpa_int } { & } \\ \hline
            评卷人 \prg_replicate:nn { \l_tmpa_int } { & } \\ \hline
          \end{tabular}
        \end{center}
        \vspace { 1mm }
      }
  }

%% ---------------------------------------------------------------------------
%% 大题标题：一、选择题（本题共……）
%% ---------------------------------------------------------------------------
\newcounter { mjsection }
\cs_new_protected:Npn \__mje_mini_scorebox:
  {
    \begin{tabular} [ b ] { | c | c | }
      \hline
      \makebox [ 3.2em ] { \footnotesize 得分 } & \makebox [ 3.6em ] { \footnotesize 评卷人 } \\
      \hline
      \rule { 0pt } { 5.5mm } & \\
      \hline
    \end{tabular}
  }
\bool_new:N \l__mje_box_bool
\NewDocumentCommand \examsection { s m +m }
  {
    \par \addvspace { 1.1\baselineskip plus .3\baselineskip }
    \needspace { 6\baselineskip }
    \stepcounter { mjsection }
    \bool_set_false:N \l__mje_box_bool
    \IfBooleanT {#1}
      { \bool_if:NF \g__mje_answers_bool { \bool_set_true:N \l__mje_box_bool } }
    \dim_set:Nn \l__mje_tmp_dim { \linewidth }
    \noindent
    \bool_if:NT \l__mje_box_bool
      {
        \hbox_set:Nn \l__mje_tmp_box { \__mje_mini_scorebox: \hspace { .8em } }
        \dim_sub:Nn \l__mje_tmp_dim { \box_wd:N \l__mje_tmp_box }
        \box_use:N \l__mje_tmp_box
      }
    \parbox [ b ] { \l__mje_tmp_dim }
      {
        \setlength \parindent { 0pt }
        { \heitimd \chinese { mjsection } 、 #2 }
        \tl_if_empty:nF {#3} { （#3） }
      }
    \par \nobreak \vspace { .45\baselineskip } \nobreak
  }

%% ---------------------------------------------------------------------------
%% 题目列表
%% ---------------------------------------------------------------------------
\newlist { questions } { enumerate } { 1 }
\setlist [ questions ]
  {
    label = \arabic* ． , ref = \arabic* ,
    leftmargin = 1.9em , labelwidth = 1.9em , labelsep = 0pt , align = left ,
    itemsep = .9\baselineskip plus .3\baselineskip ,
    topsep = .2\baselineskip , resume
  }
%% \begin{questions}[chinese]：加试中“一、（本题满分 40 分）”式的编号
\SetEnumitemKey { chinese }
  {
    label = \chinese { questionsi } 、 , ref = \chinese { questionsi } ,
    leftmargin = 0pt , labelindent = 0pt , labelwidth = 2em , itemindent = 2em ,
    labelsep = 0pt , align = left , itemsep = 1.2\baselineskip
  }
\tl_new:N \g__mje_points_tl
\NewDocumentCommand \question { o }
  {
    \item
    \IfValueTF {#1}
      { \tl_gset:Nn \g__mje_points_tl { （本题满分 #1 \, 分） } }
      { \tl_gclear:N \g__mje_points_tl }
    \__mje_check_next:
  }
%% 若题干以 withfigure 开头，分值移入左侧文字栏中印出
\cs_new_protected:Npn \__mje_check_next:
  {
    \peek_meaning_ignore_spaces:NTF \begin
      { \__mje_check_begin:w }
      { \__mje_flush_points: }
  }
\cs_new_protected:Npn \__mje_check_begin:w \begin #1
  {
    \str_if_eq:nnTF {#1} { withfigure }
      { \begin { withfigure } }
      { \__mje_flush_points: \begin {#1} }
  }
\cs_new_protected:Npn \__mje_flush_points:
  { \g__mje_points_tl \tl_gclear:N \g__mje_points_tl }

%% 选择题括号：\paren[答案]
\NewDocumentCommand \paren { o }
  {
    \unskip \nobreak
    （ \makebox [ 2.6em ]
      { \bool_if:NT \g__mje_answers_bool
          { \IfValueT {#1} { \textcolor { mjAnswer } { \bfseries #1 } } } }
    ）
  }

%% 填空横线：\fillin[答案][宽度]
\NewDocumentCommand \fillin { o O{6.5em} }
  {
    \unskip \penalty 50 \,
    \mbox
      {
        \rlap { \rule [ -.35ex ] {#2} { .45pt } }
        \makebox [#2]
          { \bool_if:NT \g__mje_answers_bool
              { \IfValueT {#1} { \textcolor { mjAnswer } {#1} } } }
      }
    \, \ignorespaces
  }

%% 选项：自动选择每行 4 / 2 / 1 个
\dim_new:N \l__mje_choice_max_dim
\dim_new:N \l__mje_cell_dim
\box_new:N \l__mje_tmp_box
\tl_new:N  \l__mje_labels_tl
\tl_set:Nn \l__mje_labels_tl { ABCDEFGH }
\NewDocumentCommand \choicelabel { m } { #1 ． }

\cs_new_protected:Npn \__mje_choice:nn #1#2
  { \choicelabel {#1} #2 }

\NewDocumentCommand \choices { +m +m +m +m }
  {
    \dim_zero:N \l__mje_choice_max_dim
    \clist_map_inline:nn { {#1} , {#2} , {#3} , {#4} }
      {
        \hbox_set:Nn \l__mje_tmp_box { \choicelabel { A } ##1 }
        \dim_set:Nn \l__mje_choice_max_dim
          { \dim_max:nn { \l__mje_choice_max_dim } { \box_wd:N \l__mje_tmp_box } }
      }
    \par \nopagebreak
    \vspace { .15\baselineskip }
    \noindent
    \dim_compare:nNnTF { \l__mje_choice_max_dim } < { \linewidth / 4 - 1.2em }
      {
        \dim_set:Nn \l__mje_cell_dim { \linewidth / 4 }
        \__mje_cell:nn { A } {#1} \__mje_cell:nn { B } {#2}
        \__mje_cell:nn { C } {#3} \__mje_cell:nn { D } {#4}
      }
      {
        \dim_compare:nNnTF { \l__mje_choice_max_dim } < { \linewidth / 2 - 1.5em }
          {
            \dim_set:Nn \l__mje_cell_dim { \linewidth / 2 }
            \__mje_cell:nn { A } {#1} \__mje_cell:nn { B } {#2} \par \noindent
            \__mje_cell:nn { C } {#3} \__mje_cell:nn { D } {#4}
          }
          {
            \__mje_line:nn { A } {#1} \__mje_line:nn { B } {#2}
            \__mje_line:nn { C } {#3} \__mje_line:nn { D } {#4}
          }
      }
    \par
  }
\cs_new_protected:Npn \__mje_cell:nn #1#2
  { \makebox [ \l__mje_cell_dim ] [ l ] { \choicelabel {#1} #2 } }
\cs_new_protected:Npn \__mje_line:nn #1#2
  {
    \par \noindent
    \hangindent = 1.6em \hangafter = 1
    \makebox [ 1.6em ] [ l ] { \choicelabel {#1} } #2
  }

%% 图文并排：\begin{withfigure}[图宽比例]{图} 题干 \end{withfigure}
\NewDocumentEnvironment { withfigure } { O{.32} +m +b }
  {
    \dim_set:Nn \l__mje_tmp_dim { \linewidth - \itemindent }
    \begin{minipage} [ t ] { \dim_eval:n { \fp_eval:n { 1 - #1 } \l__mje_tmp_dim - 1em } }
      \__mje_flush_points: #3
    \end{minipage}
    \hfill
    \begin{minipage} [ t ] { \dim_eval:n { #1 \l__mje_tmp_dim } }
      \vspace { -\baselineskip }
      \centering #2
    \end{minipage}
    \par
  }
  { }

%% 作答空白（答案版中省略）
\NewDocumentCommand \answerspace { m }
  { \bool_if:NF \g__mje_answers_bool { \par \vspace* {#1} } }

%% ---------------------------------------------------------------------------
%% 解答与评分点（仅答案版排出）
%% ---------------------------------------------------------------------------
\DeclareDocumentEnvironment { solution } { O{解} +b }
  {
    \bool_if:NT \g__mje_answers_bool
      {
        \par \addvspace { .3\baselineskip }
        \noindent { \heiti #1 } \hspace { 1em } #2 \par
      }
  }
  { }
\DeclareDocumentEnvironment { proof } { O{证明} +b }
  {
    \bool_if:NT \g__mje_answers_bool
      {
        \par \addvspace { .3\baselineskip }
        \noindent { \heiti #1 } \hspace { 1em } #2 \par
      }
  }
  { }
%% 评分点：段末右对齐的“……… 4 分”
\NewDocumentCommand \score { m }
  {
    \unskip \nobreak \hfil \penalty 50
    \hskip 1.5em \hbox { } \nobreak
    \leaders \hbox to .5em { \hss . \hss } \hfill
    \hbox { \quad \textcolor { mjAnswer } { \heiti #1 \, 分 } }
    { \parfillskip = 0pt \finalhyphendemerits = 0 \par }
  }

%% 评分说明（答案版卷首；试题卷中整段略去）
\NewDocumentEnvironment { gradingnotes } { O{评分说明} +b }
  {
    \bool_if:NT \g__mje_answers_bool
      {
        \par \small \noindent { \heitimd #1 } \par
        \begin{enumerate}
          [ label = \arabic* ． , leftmargin = 2.4em , labelsep = 0pt ,
            align = left , labelwidth = 1.6em , itemsep = 0pt , topsep = 1pt ]
          #2
        \end{enumerate}
        \par \vspace { 3mm }
      }
  }
  { }

%% ---------------------------------------------------------------------------
%% 页眉页脚
%% ---------------------------------------------------------------------------
\RequirePackage { fancyhdr }
\cs_new_protected:Npn \__mje_footer:
  {
    \small \g__mje_paper_tl
    \bool_if:NT \g__mje_answers_bool { \enspace 参考答案 }
    \quad 第 \, \thepage \, 页（共 \,
    \refused { mje-paper- \arabic { mjpaper } -last }
    \getpagerefnumber { mje-paper- \arabic { mjpaper } -last } \, 页）
  }
\fancypagestyle { mjefirst }
  {
    \fancyhf { }
    \fancyfoot [ C ] { \__mje_footer: }
    \RenewDocumentCommand \headrulewidth { } { 0pt }
  }
\fancypagestyle { mjexam }
  {
    \fancyhf { }
    \fancyhead [ L ] { \small \color { mjGray } \l__mje_title_tl }
    \fancyhead [ R ] { \small \color { mjGray } \g__mje_paper_tl
                       \bool_if:NT \g__mje_answers_bool { \enspace 参考答案 } }
    \fancyfoot [ C ] { \__mje_footer: }
    \RenewDocumentCommand \headrulewidth { } { .3pt }
  }
\pagestyle { mjexam }

%% ---------------------------------------------------------------------------
%% 密封线
%% ---------------------------------------------------------------------------
\tl_new:N \l__mje_seal_fields_tl
\tl_set:Nn \l__mje_seal_fields_tl
  {
    学校 \underline { \hspace { 32mm } } \hspace { 6mm }
    姓名 \underline { \hspace { 24mm } } \hspace { 6mm }
    准考证号 \underline { \hspace { 36mm } }
  }
\NewDocumentCommand \sealfields { m } { \tl_set:Nn \l__mje_seal_fields_tl {#1} }

\cs_new_protected:Npn \__mje_draw_seal:
  {
    \AtPageLowerLeft
      {
        \begin{tikzpicture} [ overlay , x = 1mm , y = 1mm ]
          \draw [ line~width = .4pt , dash~pattern = on~2.5pt~off~2pt ]
            (23 , 18) -- (23 , 279) ;
          \foreach \y / \t in { 235 / 密 , 148.5 / 封 , 62 / 线 }
            { \node [ fill = white , inner~sep = 2pt , rotate = 90 , font = \small\heiti ]
                at (23 , \y) { \t } ; }
          \node [ rotate = 90 , font = \small ] at (14 , 148.5)
            { \l__mje_seal_fields_tl } ;
          \node [ rotate = 90 , font = \footnotesize , text = mjGray ] at (27.2 , 148.5)
            { 密 \quad 封 \quad 线 \quad 内 \quad 不 \quad 要 \quad 答 \quad 题 } ;
        \end{tikzpicture}
      }
  }
\AddToShipoutPictureBG
  {
    \str_case:Vn \l__mje_seal_tl
      {
        { all }   { \__mje_draw_seal: }
        { odd }   { \int_if_odd:nT { \value { page } } { \__mje_draw_seal: } }
        { first } { \int_compare:nNnT { \value { page } } = { 1 } { \__mje_draw_seal: } }
      }
  }

%% ---------------------------------------------------------------------------
%% 其他
%% ---------------------------------------------------------------------------
\captionsetup { labelfont = { normalfont } , font = small }
\cs_set:Npn \thefigure { \arabic { figure } }
\AtBeginDocument { \raggedbottom }
\endinput
