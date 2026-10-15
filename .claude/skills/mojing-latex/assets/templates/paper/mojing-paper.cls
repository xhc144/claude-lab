%% mojing-paper.cls
%% 墨经 Mojing —— 数学论文
%%
%% 设计要点：
%%   * 参照国内数学期刊的版式：首页刊头、中英文题目与摘要、关键词、
%%     MSC 分类号，首页脚注区排收稿日期、基金项目与作者信息；
%%   * 正文黑白为主，仅超链接用黛蓝；定理陈述用楷体（可改为宋体），
%%     证明、注记用宋体；
%%   * 参考文献采用 GB/T 7714—2015 著录格式（biblatex-gb7714-2015），
%%     中外文献混排时自动区分“等”与“et al.”；
%%   * 双面排版，偶数页眉排作者与题目，奇数页眉排刊名与卷期。
%%
%% 用法：\documentclass[<选项>]{mojing-paper}
%%   选项：thmstyle=kai|song（定理正文字体）、preprint（不排刊头，改为预印本样式）、
%%         oneside，以及 mojing-core 的 latin / cjk / zihao / accent / print。
%%
%% 本文件以 LPPL 1.3c 发布。
\NeedsTeXFormat{LaTeX2e}[2022/06/01]
\ProvidesExplClass{mojing-paper}{2026/10/13}{1.0}{Mojing: research papers}

\tl_new:N   \l__mjp_thmstyle_tl
\bool_new:N \l__mjp_preprint_bool
\bool_new:N \l__mjp_oneside_bool
\bool_new:N \l__mjp_enfront_bool
\bool_new:N \g__mjp_enprinted_bool
\cs_new_protected:Npn \__mojing_forward_option:
  {
    \tl_if_empty:NTF \l_keys_value_tl
      { \exp_args:Ne \PassOptionsToPackage { \l_keys_key_str } { mojing-core } }
      {
        \exp_args:Ne \PassOptionsToPackage
          { \l_keys_key_str = \exp_not:V \l_keys_value_tl } { mojing-core }
      }
  }
\keys_define:nn { mojing / paper }
  {
    thmstyle .choices:nn = { kai , song }
      { \tl_set_eq:NN \l__mjp_thmstyle_tl \l_keys_choice_tl } ,
    thmstyle .initial:n = kai ,
    preprint .bool_set:N = \l__mjp_preprint_bool ,
    preprint .default:n  = true ,
    oneside  .bool_set:N = \l__mjp_oneside_bool ,
    oneside  .default:n  = true ,
    enabstract .choices:nn = { front , end }
      {
        \str_if_eq:VnTF \l_keys_choice_tl { front }
          { \bool_set_true:N \l__mjp_enfront_bool }
          { \bool_set_false:N \l__mjp_enfront_bool }
      } ,
    unknown  .code:n     = { \__mojing_forward_option: } ,
  }
\PassOptionsToPackage { accent = mjIndigo , zihao = 5 } { mojing-core }
\ProcessKeyOptions [ mojing / paper ]

\bool_if:NTF \l__mjp_oneside_bool
  { \LoadClass [ a4paper , oneside ] { article } }
  { \LoadClass [ a4paper , twoside ] { article } }
\RequirePackage { mojing-core }
\RequirePackage { mojing-math }
\RequirePackage { mojing-tikz }

%% ---------------------------------------------------------------------------
%% 版心：A4，正文 150 mm（约 40 字）
%% ---------------------------------------------------------------------------
\RequirePackage { geometry }
\geometry
  { a4paper , textwidth = 150mm , textheight = 232mm , left = 30mm ,
    top = 30mm , headsep = 7mm , footskip = 12mm }

%% ---------------------------------------------------------------------------
%% 题录信息
%% ---------------------------------------------------------------------------
\tl_new:N \l__mjp_title_tl       \tl_new:N \l__mjp_shorttitle_tl
\tl_new:N \l__mjp_author_tl      \tl_new:N \l__mjp_shortauthor_tl
\tl_new:N \l__mjp_affil_tl
\tl_new:N \l__mjp_entitle_tl     \tl_new:N \l__mjp_enauthor_tl
\tl_new:N \l__mjp_enaffil_tl
\tl_new:N \l__mjp_keywords_tl    \tl_new:N \l__mjp_enkeywords_tl
\tl_new:N \l__mjp_msc_tl
\tl_new:N \l__mjp_abstract_tl    \tl_new:N \l__mjp_enabstract_tl
\tl_new:N \l__mjp_received_tl    \tl_new:N \l__mjp_revised_tl
\tl_new:N \l__mjp_funding_tl     \tl_new:N \l__mjp_authorinfo_tl
\tl_new:N \l__mjp_journal_tl     \tl_new:N \l__mjp_enjournal_tl
\tl_new:N \l__mjp_volume_tl      \tl_new:N \l__mjp_issue_tl
\tl_new:N \l__mjp_year_tl        \tl_new:N \l__mjp_month_tl
\tl_new:N \l__mjp_doi_tl         \tl_new:N \l__mjp_firstpage_tl
\tl_new:N \l__mjp_arxiv_tl

\RenewDocumentCommand \title  { o m }
  {
    \tl_set:Nn \l__mjp_title_tl {#2}
    \IfValueTF {#1} { \tl_set:Nn \l__mjp_shorttitle_tl {#1} }
                    { \tl_set:Nn \l__mjp_shorttitle_tl {#2} }
  }
\RenewDocumentCommand \author { o m }
  {
    \tl_set:Nn \l__mjp_author_tl {#2}
    \IfValueTF {#1} { \tl_set:Nn \l__mjp_shortauthor_tl {#1} }
                    { \tl_set:Nn \l__mjp_shortauthor_tl {#2} }
  }
\NewDocumentCommand \affiliation   { m } { \tl_set:Nn \l__mjp_affil_tl {#1} }
\NewDocumentCommand \entitle       { m } { \tl_set:Nn \l__mjp_entitle_tl {#1} }
\NewDocumentCommand \enauthor      { m } { \tl_set:Nn \l__mjp_enauthor_tl {#1} }
\NewDocumentCommand \enaffiliation { m } { \tl_set:Nn \l__mjp_enaffil_tl {#1} }
\NewDocumentCommand \keywords      { m } { \tl_set:Nn \l__mjp_keywords_tl {#1} }
\NewDocumentCommand \enkeywords    { m } { \tl_set:Nn \l__mjp_enkeywords_tl {#1} }
\NewDocumentCommand \msc           { m } { \tl_set:Nn \l__mjp_msc_tl {#1} }
\NewDocumentCommand \received      { m } { \tl_set:Nn \l__mjp_received_tl {#1} }
\NewDocumentCommand \revised       { m } { \tl_set:Nn \l__mjp_revised_tl {#1} }
\NewDocumentCommand \funding       { m } { \tl_set:Nn \l__mjp_funding_tl {#1} }
\NewDocumentCommand \authorinfo    { m } { \tl_set:Nn \l__mjp_authorinfo_tl {#1} }
\NewDocumentCommand \affil         { m } { \textsuperscript { #1 } }

\keys_define:nn { mojing / journal }
  {
    name      .tl_set:N = \l__mjp_journal_tl ,
    enname    .tl_set:N = \l__mjp_enjournal_tl ,
    volume    .tl_set:N = \l__mjp_volume_tl ,
    issue     .tl_set:N = \l__mjp_issue_tl ,
    year      .tl_set:N = \l__mjp_year_tl ,
    month     .tl_set:N = \l__mjp_month_tl ,
    doi       .tl_set:N = \l__mjp_doi_tl ,
    arxiv     .tl_set:N = \l__mjp_arxiv_tl ,
    firstpage .code:n   = { \setcounter { page } {#1} } ,
  }
\NewDocumentCommand \journalinfo { m } { \keys_set:nn { mojing / journal } {#1} }

\RenewDocumentEnvironment { abstract } { +b }
  { \tl_gset:Nn \l__mjp_abstract_tl {#1} } { }
\NewDocumentEnvironment { enabstract } { +b }
  { \tl_gset:Nn \l__mjp_enabstract_tl {#1} } { }

%% ---------------------------------------------------------------------------
%% 首页
%% ---------------------------------------------------------------------------
\cs_new_protected:Npn \__mjp_masthead:
  {
    \bool_if:NTF \l__mjp_preprint_bool
      {
        \noindent
        { \small \color { mjGray } \sffamily 预印本 \enspace · \enspace \today \hfill
          \tl_if_empty:NF \l__mjp_arxiv_tl { arXiv:\, \l__mjp_arxiv_tl } \par }
      }
      {
        \noindent
        \begin{minipage} [ b ] { .62\textwidth }
          { \heitimd \l__mjp_journal_tl } \par
          \vspace { .5mm }
          { \footnotesize \sffamily \l__mjp_enjournal_tl }
        \end{minipage}
        \hfill
        \begin{minipage} [ b ] { .36\textwidth }
          \raggedleft \small
          第 \, \l__mjp_volume_tl \, 卷 \enspace 第 \, \l__mjp_issue_tl \, 期 \par
          \vspace { .5mm }
          { \footnotesize \sffamily
            Vol.\,\l__mjp_volume_tl , ~ No.\,\l__mjp_issue_tl \enspace
            \l__mjp_year_tl \tl_if_empty:NF \l__mjp_month_tl { 年 \l__mjp_month_tl 月 } }
        \end{minipage}
        \par \vspace { 1.5mm }
        \noindent \rule { \textwidth } { .8pt } \par
        \vspace { .6mm }
        \noindent \rule { \textwidth } { .3pt } \par
        \tl_if_empty:NF \l__mjp_doi_tl
          {
            \vspace { 1mm }
            \noindent { \footnotesize \sffamily \color { mjGray }
              DOI:\,\l__mjp_doi_tl \hfill } \par
          }
      }
  }

\cs_new_protected:Npn \__mjp_label:n #1
  { { \heitimd #1 } \enspace }

\cs_new_protected:Npn \__mjp_abstract_block:
  {
    \begin{list} { } { \leftmargin = 2em \rightmargin = 2em \listparindent = 2em
                       \itemindent = 0pt \parsep = 0pt \topsep = 0pt }
      \item \relax \small
      \__mjp_label:n { 摘 \quad 要 } \l__mjp_abstract_tl \par
      \vspace { .3\baselineskip }
      \tl_if_empty:NF \l__mjp_keywords_tl
        { \noindent \__mjp_label:n { 关键词 } \l__mjp_keywords_tl \par }
      \tl_if_empty:NF \l__mjp_msc_tl
        { \noindent \__mjp_label:n { MSC\,(2020) } \l__mjp_msc_tl \par }
    \end{list}
  }

\cs_new_protected:Npn \__mjp_enabstract_block:
  {
    \tl_if_empty:NF \l__mjp_entitle_tl
      {
        \vspace { 1.6\baselineskip }
        \begin{center}
          { \large \bfseries \l__mjp_entitle_tl \par }
          \vspace { 2.5mm }
          { \normalsize \l__mjp_enauthor_tl \par }
          \vspace { 1.5mm }
          { \footnotesize \itshape \l__mjp_enaffil_tl \par }
        \end{center}
        \vspace { .3\baselineskip }
      }
    \tl_if_empty:NF \l__mjp_enabstract_tl
      {
        \begin{list} { } { \leftmargin = 2em \rightmargin = 2em \listparindent = 1.5em
                           \itemindent = 0pt \parsep = 0pt \topsep = 0pt }
          \item \relax \small
          { \bfseries Abstract } \enspace \l__mjp_enabstract_tl \par
          \vspace { .3\baselineskip }
          \tl_if_empty:NF \l__mjp_enkeywords_tl
            { \noindent { \bfseries Keywords } \enspace \l__mjp_enkeywords_tl \par }
        \end{list}
      }
  }

%% 首页脚注：收稿日期、基金、作者信息
\cs_new_protected:Npn \__mjp_firstpage_note:
  {
    \group_begin:
      \cs_set:Npn \thefootnote { }
      \cs_set:Npn \@makefnmark { }
      \footnotetext
        {
          \setlength \parindent { 0pt }
          \tl_if_empty:NF \l__mjp_received_tl
            {
              { \heitimd 收稿日期 } \enspace \l__mjp_received_tl
              \tl_if_empty:NF \l__mjp_revised_tl { ； \enspace { \heitimd 修回日期 } \enspace \l__mjp_revised_tl }
              \par
            }
          \tl_if_empty:NF \l__mjp_funding_tl
            { { \heitimd 基金项目 } \enspace \l__mjp_funding_tl \par }
          \tl_if_empty:NF \l__mjp_authorinfo_tl
            { { \heitimd 作者信息 } \enspace \l__mjp_authorinfo_tl \par }
        }
    \group_end:
    \setcounter { footnote } { 0 }
  }

\RenewDocumentCommand \maketitle { }
  {
    \thispagestyle { mjpfirst }
    \vspace* { -14mm }
    \__mjp_masthead:
    \vspace { 9mm }
    \begin{center}
      { \fontsize { 19 } { 26 } \selectfont \mojingheadfont \l__mjp_title_tl \par }
      \vspace { 5mm }
      { \large \fangsong \l__mjp_author_tl \par }
      \vspace { 2.5mm }
      { \footnotesize \l__mjp_affil_tl \par }
    \end{center}
    \vspace { .8\baselineskip }
    \__mjp_abstract_block:
    \bool_if:NT \l__mjp_enfront_bool
      { \__mjp_enabstract_block: \bool_gset_true:N \g__mjp_enprinted_bool }
    \vspace { .6\baselineskip }
    \noindent \textcolor { mjRule } { \rule { \textwidth } { .3pt } } \par
    \vspace { .2\baselineskip }
    \__mjp_firstpage_note:
  }

%% 英文题目与摘要：默认排在文末（国内期刊的通行做法），
%% 也可用 \printenabstract 手动放置，或用选项 enabstract=front 排在首页。
\NewDocumentCommand \printenabstract { }
  {
    \bool_if:NF \g__mjp_enprinted_bool
      {
        \par \vspace { 2\baselineskip }
        \noindent \textcolor { mjRule } { \rule { \textwidth } { .3pt } } \par
        \__mjp_enabstract_block:
        \bool_gset_true:N \g__mjp_enprinted_bool
      }
  }
\AddToHook { enddocument } { \printenabstract }
\interfootnotelinepenalty = 10000

%% ---------------------------------------------------------------------------
%% 节标题
%% ---------------------------------------------------------------------------
\ctexset
  {
    section =
      {
        format     = \large \mojingheadfont ,
        indent     = 0pt ,
        aftername  = \hspace { 1em } ,
        beforeskip = 1.4\baselineskip plus .3\baselineskip ,
        afterskip  = .8\baselineskip ,
      } ,
    subsection =
      {
        format     = \normalsize \mojingheadfont ,
        aftername  = \hspace { 1em } ,
        beforeskip = 1\baselineskip plus .2\baselineskip ,
        afterskip  = .5\baselineskip ,
        indent     = 0pt ,
      } ,
    appendix =
      { name = { 附录 , } , number = \Alph { section } } ,
  }

%% ---------------------------------------------------------------------------
%% 页眉页脚
%% ---------------------------------------------------------------------------
\RequirePackage { fancyhdr }
\pagestyle { fancy }
\fancyhf { }
\cs_new_protected:Npn \__mjp_head_journal:
  {
    \bool_if:NTF \l__mjp_preprint_bool
      { 预印本 }
      { \l__mjp_journal_tl \enspace 第 \, \l__mjp_volume_tl \, 卷 }
  }
\bool_if:NTF \l__mjp_oneside_bool
  {
    \fancyhead [ L ] { \small \__mjp_head_journal: }
    \fancyhead [ R ] { \small \l__mjp_shortauthor_tl ： \l__mjp_shorttitle_tl }
    \fancyfoot [ C ] { \small \thepage }
  }
  {
    \fancyhead [ LE ] { \small \thepage \quad \__mjp_head_journal: }
    \fancyhead [ RE ] { }
    \fancyhead [ RO ] { \small \l__mjp_shortauthor_tl ： \l__mjp_shorttitle_tl \quad \thepage }
    \fancyhead [ LO ] { }
  }
\RenewDocumentCommand \headrulewidth { } { .4pt }
\fancypagestyle { mjpfirst }
  {
    \fancyhf { }
    \fancyfoot [ C ] { \small \thepage }
    \RenewDocumentCommand \headrulewidth { } { 0pt }
  }

%% 脚注：上标数字，脚注线 1/4 版心宽
\RequirePackage [ bottom , hang ] { footmisc }
\RenewDocumentCommand \footnoterule { }
  { \kern -3pt \hrule width .3\columnwidth height .4pt \kern 2.6pt }
\setlength \footnotemargin { 1em }

%% ---------------------------------------------------------------------------
%% 定理类环境：首行缩进两字，定理名黑体，定理正文楷体
%% ---------------------------------------------------------------------------
\mojingloadhyperref
\RequirePackage { mojing-theorem }
\RenewDocumentCommand \mojingthmheadfont   { } { \normalfont \sffamily }
\RenewDocumentCommand \mojingthmnotefont   { } { \normalfont \sffamily }
\RenewDocumentCommand \mojingremarkheadfont { } { \normalfont \sffamily }
\RenewDocumentCommand \mojingproofheadfont { } { \normalfont \sffamily }
\RenewDocumentCommand \mojingthmindent     { } { 2em }
\RenewDocumentCommand \mojingqedsymbol     { } { \ensuremath { \square } }
\str_if_eq:VnT \l__mjp_thmstyle_tl { kai }
  { \RenewDocumentCommand \mojingthmbodyfont { } { \normalfont \kaishu } }
\mojingtheoremcounter { section }
\mojingdefinetheorems

%% ---------------------------------------------------------------------------
%% 参考文献：GB/T 7714—2015 顺序编码制
%% ---------------------------------------------------------------------------
\RequirePackage [ backend = biber , style = gb7714-2015 , gbpub = false ,
                  gbnamefmt = lowercase , gbpunctin = false ] { biblatex }
\defbibheading { mjpaper } [ 参考文献 ]
  {
    \section* { #1 }
    \addcontentsline { toc } { section } { #1 }
  }
\AtBeginBibliography { \small \linespread { 1.25 } \selectfont }
\setlength \bibitemsep { .2\baselineskip }
\NewDocumentCommand \printreferences { }
  { \printbibliography [ heading = mjpaper ] }

\captionsetup { labelfont = { normalfont , bf } }
\AtBeginDocument { \raggedbottom }
\endinput
