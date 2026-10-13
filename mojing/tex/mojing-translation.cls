%% mojing-translation.cls
%% 墨经 Mojing —— 翻译与对照排版
%%
%% 设计要点：
%%   * 同一份源文件支持四种版式（选项 layout）：
%%       facing      左页原文、右页译文的对照本（默认），段落逐一对齐
%%       columns     同一页左右两栏对照
%%       interleave  逐段对照：原文小字在上，译文在下
%%       target      只排译文（原文不输出），适合出版纯译本
%%     也可在命令行指定：xelatex "\def\MojingLayout{columns}\input{main}"
%%   * 原文段落与译文段落成对书写，页边自动标注段落编号，便于核对与引用；
%%   * 两类脚注：原注用阿拉伯数字，译注用带圈数字并冠以“译注”；
%%   * \term{英文}{译名}：译名首次出现时括注原文，全部术语自动汇成对照表；
%%   * 西文用 Palatino 风格（TeX Gyre Pagella），主题色赭石。
%%
%% 主要命令：
%%   \begin{pairs} \begin{original}...\end{original} \begin{translated}...\end{translated} \end{pairs}
%%   \pairheading{原文标题}{译文标题}   \omission（中略标记）  \origpage{页码}
%%   \yizhu{译注}   \term{原文}{译名}   \printglossary
%%
%% 本文件以 LPPL 1.3c 发布。
\NeedsTeXFormat{LaTeX2e}[2022/06/01]
\ProvidesExplClass{mojing-translation}{2026/10/13}{1.0}{Mojing: translations}

\tl_new:N \l__mjt_layout_tl
\cs_new_protected:Npn \__mojing_forward_option:
  {
    \tl_if_empty:NTF \l_keys_value_tl
      { \exp_args:Ne \PassOptionsToPackage { \l_keys_key_str } { mojing-core } }
      {
        \exp_args:Ne \PassOptionsToPackage
          { \l_keys_key_str = \exp_not:V \l_keys_value_tl } { mojing-core }
      }
  }
\keys_define:nn { mojing / translation }
  {
    layout .choices:nn = { facing , columns , interleave , target }
      { \tl_set_eq:NN \l__mjt_layout_tl \l_keys_choice_tl } ,
    layout .initial:n = facing ,
    unknown .code:n = { \__mojing_forward_option: } ,
  }
\PassOptionsToPackage { accent = mjOchre , latin = pagella , zihao = 5 } { mojing-core }
\ProcessKeyOptions [ mojing / translation ]
\cs_if_exist:NT \MojingLayout
  { \exp_args:Nne \keys_set:nn { mojing / translation } { layout = \MojingLayout } }

\LoadClass [ twoside , openany ] { book }
\RequirePackage { mojing-core }
\RequirePackage { mojing-math }
\RequirePackage { mojing-tikz }
\RequirePackage { paracol }

%% ---------------------------------------------------------------------------
%% 版心
%% ---------------------------------------------------------------------------
\RequirePackage { geometry }
\str_if_eq:VnTF \l__mjt_layout_tl { columns }
  {
    \geometry { a4paper , textwidth = 160mm , inner = 25mm , top = 26mm ,
                textheight = 238mm , headsep = 7mm , footskip = 12mm }
    \setlength \columnsep { 7mm }
  }
  {
    \geometry { paperwidth = 170mm , paperheight = 240mm ,
                textwidth = 118mm , inner = 23mm , top = 24mm ,
                textheight = 190mm , headsep = 7mm , footskip = 12mm }
  }

%% ---------------------------------------------------------------------------
%% 书名信息
%% ---------------------------------------------------------------------------
\tl_new:N \l__mjt_title_tl     \tl_new:N \l__mjt_origtitle_tl
\tl_new:N \l__mjt_author_tl    \tl_new:N \l__mjt_origauthor_tl
\tl_new:N \l__mjt_translator_tl \tl_new:N \l__mjt_source_tl
\tl_new:N \l__mjt_series_tl
\NewDocumentCommand \booktitle     { m } { \tl_set:Nn \l__mjt_title_tl {#1} }
\NewDocumentCommand \origtitle     { m } { \tl_set:Nn \l__mjt_origtitle_tl {#1} }
\NewDocumentCommand \bookauthor    { m } { \tl_set:Nn \l__mjt_author_tl {#1} }
\NewDocumentCommand \origauthor    { m } { \tl_set:Nn \l__mjt_origauthor_tl {#1} }
\NewDocumentCommand \translator    { m } { \tl_set:Nn \l__mjt_translator_tl {#1} }
\NewDocumentCommand \sourcenote    { m } { \tl_set:Nn \l__mjt_source_tl {#1} }
\NewDocumentCommand \seriesname    { m } { \tl_set:Nn \l__mjt_series_tl {#1} }

\cs_new_protected:Npn \__mjt_layout_name:
  {
    \str_case:Vn \l__mjt_layout_tl
      {
        { facing }     { 英汉对照 }
        { columns }    { 英汉对照 }
        { interleave } { 英汉对照 }
        { target }     { 中译本 }
      }
  }

\RenewDocumentCommand \maketitle { }
  {
    \thispagestyle { empty }
    \begin{tikzpicture} [ remember~picture , overlay ]
      \draw [ mjAccent , line~width = .5pt ]
        ( $ ( current~page.north~west ) + ( 14mm , -14mm ) $ ) rectangle
        ( $ ( current~page.south~east ) + ( -14mm , 14mm ) $ ) ;
      \draw [ mjAccent , line~width = 1.6pt ]
        ( $ ( current~page.north~west ) + ( 16.5mm , -16.5mm ) $ ) rectangle
        ( $ ( current~page.south~east ) + ( -16.5mm , 16.5mm ) $ ) ;
    \end{tikzpicture}
    \vspace* { 22mm }
    \begin{center}
      \tl_if_empty:NF \l__mjt_series_tl
        { { \small \mojingheadfont \color { mjAccent } \l__mjt_series_tl \par } \vspace { 14mm } }
      { \fontsize { 30 } { 38 } \selectfont \sffamily \bfseries \l__mjt_title_tl \par }
      \vspace { 5mm }
      { \Large \scshape \addfontfeatures { LetterSpace = 4 } \l__mjt_origtitle_tl \par }
      \vspace { 7mm }
      { \color { mjAccent } \rule { 14mm } { .6pt } } \par
      \vspace { 7mm }
      { \large \kaishu \l__mjt_author_tl \par }
      \vspace { 2mm }
      { \normalsize \itshape \l__mjt_origauthor_tl \par }
      \vspace { 18mm }
      { \normalsize \l__mjt_translator_tl \par }
      \vfill
      { \small \color { mjGray } \l__mjt_source_tl \par }
      \vspace { 4mm }
      { \footnotesize \mojingheadfont \color { mjAccent } \__mjt_layout_name: \par }
    \end{center}
    \vspace* { 10mm }
    \clearpage
  }

%% 正文前的半标题页（排在右页；对照本的正文随后从左页开始）
\NewDocumentCommand \halftitle { }
  {
    \cleardoublepage
    \thispagestyle { empty }
    \vspace* { 55mm }
    \begin{center}
      { \fontsize { 24 } { 30 } \selectfont \sffamily \bfseries \l__mjt_title_tl \par }
      \vspace { 5mm }
      { \large \scshape \addfontfeatures { LetterSpace = 4 } \l__mjt_origtitle_tl \par }
      \vspace { 8mm }
      { \color { mjAccent } \rule { 10mm } { .6pt } }
    \end{center}
    \clearpage
  }

%% ---------------------------------------------------------------------------
%% 标题与书眉
%% ---------------------------------------------------------------------------
\ctexset
  {
    chapter =
      {
        format     = \centering ,
        name       = { , } , number = { } , aftername = { } ,
        titleformat = \LARGE \mojingheadfont ,
        beforeskip = 20mm , afterskip = 6mm ,
        aftertitle = \par \vspace { 4mm } { \color { mjAccent } \rule { 12mm } { .6pt } } ,
        pagestyle  = mjtplain ,
      } ,
    section =
      {
        format     = \large \mojingheadfont \centering ,
        number     = { } , aftername = { } ,
        beforeskip = 1.6\baselineskip , afterskip = .9\baselineskip ,
      } ,
  }

\RequirePackage { fancyhdr }
\pagestyle { fancy }
\fancyhf { }
\str_if_eq:VnTF \l__mjt_layout_tl { facing }
  {
    \fancyhead [ LE ] { \small \color { mjAccent } \thepage \hspace { 1.2em }
                        \color { mjGray } \scshape \addfontfeatures { LetterSpace = 3 }
                        \l__mjt_origtitle_tl }
    \fancyhead [ RO ] { \small \color { mjGray } \l__mjt_title_tl
                        \hspace { 1.2em } \color { mjAccent } \thepage }
  }
  {
    \fancyhead [ LE ] { \small \color { mjAccent } \thepage \hspace { 1.2em }
                        \color { mjGray } \l__mjt_title_tl }
    \fancyhead [ RO ] { \small \color { mjGray } \rightmark
                        \hspace { 1.2em } \color { mjAccent } \thepage }
  }
\RenewDocumentCommand \headrulewidth { } { 0pt }
\fancypagestyle { mjtplain }
  {
    \fancyhf { }
    \fancyfoot [ C ] { \small \color { mjAccent } \thepage }
  }
\AtBeginDocument
  { \cs_set:Npn \chaptermark #1 { \markboth {#1} {#1} } }

%% ---------------------------------------------------------------------------
%% 段落对照
%% ---------------------------------------------------------------------------
\newcounter { mjpair }
\globalcounter { mjpair }
\bool_new:N \l__mjt_first_bool
\bool_new:N \l__mjt_nonum_bool

%% 原文与译文的字体（可在导言区重定义）
\NewDocumentCommand \mojingorigfont  { } { \normalfont }
\NewDocumentCommand \mojingtransfont { } { \normalfont }

%% 页边的段落编号
\cs_new_protected:Npn \__mjt_pairnum:
  {
    \bool_if:NF \l__mjt_nonum_bool
      {
        \leavevmode
        \llap
          {
            \footnotesize \mojingsansmedium \color { mjAccent!80 }
            \themjpair \hspace { 4mm }
          }
      }
  }

\NewDocumentEnvironment { pairs } { }
  {
    \bool_set_true:N \l__mjt_first_bool
    \str_case:Vn \l__mjt_layout_tl
      {
        { facing }
          {
            %% 对照本须从左页（偶数页）开始
            \clearpage
            \int_if_odd:nT { \value { page } }
              { \hbox { } \thispagestyle { empty } \newpage }
            \begin{paracol} [ 1 ] * { 2 }
          }
        { columns } { \begin{paracol} { 2 } }
      }
  }
  {
    \str_case:Vn \l__mjt_layout_tl
      {
        { facing }  { \end{paracol} }
        { columns } { \end{paracol} }
      }
  }

\cs_new_protected:Npn \__mjt_to_column:n #1
  {
    \int_compare:nNnTF {#1} = { 0 }
      {
        \bool_if:NTF \l__mjt_first_bool
          { \bool_set_false:N \l__mjt_first_bool }
          { \switchcolumn [ 0 ] * }
      }
      { \switchcolumn [ 1 ] }
  }

%% paracol 的 \switchcolumn 不能出现在编组之内，而 LaTeX 的环境总是一个编组。
%% 因此 original / translated 环境只负责收集内容，真正的排版放在环境结束之后
%% （env/…/after 钩子在编组之外执行）。
\tl_new:N \g__mjt_orig_tl
\tl_new:N \g__mjt_trans_tl
\NewDocumentEnvironment { original }   { +b } { \tl_gset:Nn \g__mjt_orig_tl  {#1} } { }
\NewDocumentEnvironment { translated } { +b } { \tl_gset:Nn \g__mjt_trans_tl {#1} } { }
\AddToHook { env / original / after }   { \__mjt_place_original: }
\AddToHook { env / translated / after } { \__mjt_place_translated: }

\cs_new_protected:Npn \__mjt_place_original:
  {
    \bool_if:NF \l__mjt_nonum_bool { \stepcounter { mjpair } }
    \str_case:VnF \l__mjt_layout_tl
      {
        { target } { }
        { interleave }
          {
            \par \addvspace { .6\baselineskip }
            { \small \mojingorigfont \color { mjInk!72 } \__mjt_pairnum: \g__mjt_orig_tl \par }
            \nopagebreak \vspace { .25\baselineskip }
          }
      }
      {
        \__mjt_to_column:n { 0 }
        { \mojingorigfont \__mjt_pairnum: \g__mjt_orig_tl \par }
      }
  }
\cs_new_protected:Npn \__mjt_place_translated:
  {
    \str_case:VnF \l__mjt_layout_tl
      {
        { target }     { { \mojingtransfont \g__mjt_trans_tl \par } }
        { interleave } { { \mojingtransfont \g__mjt_trans_tl \par } }
      }
      {
        \__mjt_to_column:n { 1 }
        { \mojingtransfont \__mjt_pairnum: \g__mjt_trans_tl \par }
      }
  }

%% 不编号的成对内容（篇名、小标题、中略标记）
\cs_new_protected:Npn \__mjt_unnumbered_pair:nn #1#2
  {
    \bool_set_true:N \l__mjt_nonum_bool
    \begin{original} #1 \end{original}
    \begin{translated} #2 \end{translated}
    \bool_set_false:N \l__mjt_nonum_bool
  }

%% 篇名：\pairtitle{原文篇名}{原文副题}{译文篇名}{译文副题}
\NewDocumentCommand \pairtitle { m m m m }
  {
    \__mjt_unnumbered_pair:nn
      {
        \vspace* { 6mm }
        \begin{center}
          { \LARGE \scshape \addfontfeatures { LetterSpace = 3 } #1 \par }
          \vspace { 3mm }
          { \small \itshape #2 \par }
        \end{center}
        \vspace { 4mm }
      }
      {
        \vspace* { 6mm }
        \begin{center}
          { \LARGE \mojingheadfont #3 \par }
          \vspace { 3mm }
          { \small \kaishu #4 \par }
        \end{center}
        \vspace { 4mm }
      }
  }

%% 成对的小标题
\NewDocumentCommand \pairheading { m m }
  {
    \__mjt_unnumbered_pair:nn
      {
        \par \addvspace { .7\baselineskip }
        \noindent \hfil { \large \itshape #1 } \hfil \par
        \vspace { .25\baselineskip }
      }
      {
        \par \addvspace { .7\baselineskip }
        \noindent \hfil { \large \mojingheadfont #2 } \hfil \par
        \vspace { .25\baselineskip }
      }
  }

%% 中略标记
\NewDocumentCommand \omission { }
  {
    \__mjt_unnumbered_pair:nn
      { \par { \centering \color { mjGray } * \quad * \quad * \par } }
      { \par { \centering \color { mjGray } （中略） \par } }
  }

%% 原书页码
\NewDocumentCommand \origpage { m }
  { \unskip \, { \footnotesize \color { mjGray } ［ #1 ］ } \, \ignorespaces }

%% ---------------------------------------------------------------------------
%% 脚注：原注（阿拉伯数字）与译注（带圈数字）
%% ---------------------------------------------------------------------------
%% （footmisc 与 paracol 都定义了 \footnotelayout，故不载入 footmisc，直接设定悬挂式脚注）
\cs_set:Npn \@makefntext #1
  {
    \noindent
    \hangindent = 1.6em \hangafter = 1
    \makebox [ 1.6em ] [ l ] { \@thefnmark } #1
  }
\newcounter { yizhu }
\NewDocumentCommand \yizhu { +m }
  {
    \stepcounter { yizhu }
    \group_begin:
      \cs_set:Npe \thefootnote { \mojingcircled { \int_use:N \c@yizhu } }
      \footnote { { \heitimd \color { mjAccent } 译注 } \enspace #1 }
      \addtocounter { footnote } { -1 }
    \group_end:
  }
\globalcounter { yizhu }

%% ---------------------------------------------------------------------------
%% 术语对照：\term{原文}{译名}
%% ---------------------------------------------------------------------------
\seq_new:N \g__mjt_terms_seq
\prop_new:N \g__mjt_terms_prop
\NewDocumentCommand \term { m m }
  {
    \prop_if_in:NnTF \g__mjt_terms_prop {#1}
      { #2 }
      {
        #2 { \small （\textit{#1}） }
        \prop_gput:Nnn \g__mjt_terms_prop {#1} {#2}
        \seq_gput_right:Nn \g__mjt_terms_seq {#1}
      }
  }
\NewDocumentCommand \printglossary { O{术语对照表} }
  {
    \chapter* {#1}
    \addcontentsline { toc } { chapter } {#1}
    \markboth {#1} {#1}
    \seq_gsort:Nn \g__mjt_terms_seq
      {
        \str_compare:eNeTF { \str_foldcase:n {##1} } > { \str_foldcase:n {##2} }
          { \sort_return_swapped: }
          { \sort_return_same: }
      }
    \tl_clear:N \l_tmpa_tl
    \seq_map_inline:Nn \g__mjt_terms_seq
      {
        \tl_put_right:Ne \l_tmpa_tl
          {
            \exp_not:n { \textit {##1} } &
            \exp_not:e { \prop_item:Nn \g__mjt_terms_prop {##1} } \exp_not:N \\
          }
      }
    \begin{center}
      \small
      \renewcommand \arraystretch { 1.3 }
      \begin{longtable} { @{} p { .44\textwidth } p { .44\textwidth } @{} }
        \toprule
        { \mojingheadfont 原文 } & { \mojingheadfont 译名 } \\
        \midrule
        \endhead
        \bottomrule
        \endfoot
        \l_tmpa_tl
      \end{longtable}
    \end{center}
  }
\RequirePackage { longtable }

%% ---------------------------------------------------------------------------
%% 其他
%% ---------------------------------------------------------------------------
\mojingloadhyperref
\RequirePackage { mojing-theorem }
\mojingtheoremcounter { none }
\mojingdefinetheorems

%% 引文（译者序中引用原文）
\RenewDocumentEnvironment { quote } { }
  { \list { } { \leftmargin = 2em \rightmargin = 2em } \item \relax \kaishu }
  { \endlist }

\AtBeginDocument { \raggedbottom }
\endinput
