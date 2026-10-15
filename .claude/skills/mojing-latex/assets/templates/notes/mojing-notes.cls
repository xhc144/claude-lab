%% mojing-notes.cls
%% 墨经 Mojing —— 数学讲义
%%
%% 设计要点：
%%   * A4 单面，正文栏约 36 字，右侧留出 38 mm 的旁注栏，放历史注记、
%%     提示、小插图（\sidenote、\margintext、\marginfigure）；
%%   * 以“讲”为单位组织：\lecture 开新页、排讲题区，节、公式、定理、
%%     图表均按讲编号（4.1、4.2……）；
%%   * 定理类环境左侧一条黛蓝细线，定义用极浅底色，其余不加装饰。
%%
%% 用法：\documentclass[<选项>]{mojing-notes}
%%   选项：twoside、nomargin（取消旁注栏），以及 mojing-core 的
%%         latin / cjk / zihao / accent / print。
%%
%% 本文件以 LPPL 1.3c 发布。
\NeedsTeXFormat{LaTeX2e}[2022/06/01]
\ProvidesExplClass{mojing-notes}{2026/10/13}{1.0}{Mojing: lecture notes}

\bool_new:N \l__mjn_twoside_bool
\bool_new:N \l__mjn_nomargin_bool

\cs_new_protected:Npn \__mojing_forward_option:
  {
    \tl_if_empty:NTF \l_keys_value_tl
      { \exp_args:Ne \PassOptionsToPackage { \l_keys_key_str } { mojing-core } }
      {
        \exp_args:Ne \PassOptionsToPackage
          { \l_keys_key_str = \exp_not:V \l_keys_value_tl } { mojing-core }
      }
  }

\keys_define:nn { mojing / notes }
  {
    twoside  .bool_set:N = \l__mjn_twoside_bool ,
    twoside  .default:n  = true ,
    oneside  .code:n     = { \bool_set_false:N \l__mjn_twoside_bool } ,
    nomargin .bool_set:N = \l__mjn_nomargin_bool ,
    nomargin .default:n  = true ,
    draft    .code:n     = { \PassOptionsToClass { draft } { article } } ,
    unknown  .code:n     = { \__mojing_forward_option: } ,
  }
\PassOptionsToPackage { accent = mjIndigo , zihao = 5 } { mojing-core }
\ProcessKeyOptions [ mojing / notes ]

\bool_if:NTF \l__mjn_twoside_bool
  { \LoadClass [ a4paper , twoside ] { article } }
  { \LoadClass [ a4paper , oneside ] { article } }

\RequirePackage { mojing-core }
\RequirePackage { mojing-math }
\RequirePackage { mojing-tikz }

%% ---------------------------------------------------------------------------
%% 版心
%% ---------------------------------------------------------------------------
\RequirePackage { geometry }
\bool_if:NTF \l__mjn_nomargin_bool
  {
    \geometry
      { a4paper , textwidth = 150mm , left = 30mm ,
        top = 27mm , bottom = 25mm , headsep = 8mm , footskip = 12mm ,
        marginparwidth = 0mm , marginparsep = 0mm }
  }
  {
    \geometry
      { a4paper , textwidth = 134mm , left = 21mm ,
        marginparsep = 6mm , marginparwidth = 38mm ,
        top = 27mm , bottom = 25mm , headsep = 8mm , footskip = 12mm }
  }
\dim_new:N \mojingfullwidth
\dim_set:Nn \mojingfullwidth { \textwidth + \marginparsep + \marginparwidth }
%% 讲题区：题目栏与讲次号栏的宽度
\dim_new:N \l__mjn_titlew_dim
\dim_new:N \l__mjn_numw_dim
\bool_if:NTF \l__mjn_nomargin_bool
  {
    \dim_set:Nn \l__mjn_numw_dim { 30mm }
    \dim_set:Nn \l__mjn_titlew_dim { \textwidth - 34mm }
  }
  {
    \dim_set:Nn \l__mjn_numw_dim { \marginparwidth }
    \dim_set:Nn \l__mjn_titlew_dim { \textwidth }
  }

%% ---------------------------------------------------------------------------
%% 课程与讲次信息
%% ---------------------------------------------------------------------------
\tl_new:N \l__mjn_course_tl
\tl_new:N \l__mjn_course_en_tl
\tl_new:N \l__mjn_term_tl
\tl_new:N \l__mjn_instructor_tl
\tl_new:N \l__mjn_institute_tl
\NewDocumentCommand \course     { o m }
  { \tl_set:Nn \l__mjn_course_tl {#2} \IfValueT {#1} { \tl_set:Nn \l__mjn_course_en_tl {#1} } }
\NewDocumentCommand \term       { m } { \tl_set:Nn \l__mjn_term_tl {#1} }
\NewDocumentCommand \instructor { m } { \tl_set:Nn \l__mjn_instructor_tl {#1} }
\NewDocumentCommand \institute  { m } { \tl_set:Nn \l__mjn_institute_tl {#1} }

\newcounter { lecture }
\tl_new:N \l__mjn_lecture_title_tl
\tl_new:N \l__mjn_lecture_short_tl
\tl_new:N \l__mjn_lecture_date_tl
\tl_new:N \l__mjn_lecture_scribe_tl
\tl_new:N \l__mjn_lecture_by_tl
\keys_define:nn { mojing / lecture }
  {
    date     .tl_set:N = \l__mjn_lecture_date_tl ,
    scribe   .tl_set:N = \l__mjn_lecture_scribe_tl ,
    lecturer .tl_set:N = \l__mjn_lecture_by_tl ,
    short    .tl_set:N = \l__mjn_lecture_short_tl ,
    number   .code:n   = { \setcounter { lecture } { \int_eval:n { #1 - 1 } } } ,
  }

%% 讲次之下的编号
\counterwithin* { section } { lecture }
\counterwithin* { equation } { lecture }
\counterwithin* { figure } { lecture }
\counterwithin* { table } { lecture }
\cs_set:Npn \thesection  { \thelecture . \arabic { section } }
\cs_set:Npn \theequation { \thelecture . \arabic { equation } }
\cs_set:Npn \thefigure   { \thelecture . \arabic { figure } }
\cs_set:Npn \thetable    { \thelecture . \arabic { table } }

%% ---------------------------------------------------------------------------
%% 讲题区
%% ---------------------------------------------------------------------------
\tl_new:N \g__mjn_mark_tl
\cs_new_protected:Npn \__mjn_fullwidth:n #1
  {
    \noindent
    \makebox [ \textwidth ] [ l ]
      { \parbox [ t ] { \mojingfullwidth } {#1} }
  }

\cs_new_protected:Npn \__mjn_meta_item:nn #1#2
  {
    \tl_if_empty:nF {#2}
      { \mbox { { \color { mjGray } #1 } \enspace #2 } \hspace { 1.6em } }
  }

\NewDocumentCommand \lecture { O{} m }
  {
    \tl_clear:N \l__mjn_lecture_short_tl
    \tl_clear:N \l__mjn_lecture_date_tl
    \tl_clear:N \l__mjn_lecture_scribe_tl
    \tl_set_eq:NN \l__mjn_lecture_by_tl \l__mjn_instructor_tl
    \keys_set:nn { mojing / lecture } {#1}
    \tl_set:Nn \l__mjn_lecture_title_tl {#2}
    \tl_if_empty:NT \l__mjn_lecture_short_tl
      { \tl_set:Nn \l__mjn_lecture_short_tl {#2} }
    \clearpage
    \refstepcounter { lecture }
    \tl_gset:Ne \g__mjn_mark_tl
      { 第 \thelecture 讲 \exp_not:N \quad \exp_not:V \l__mjn_lecture_short_tl }
    \thispagestyle { mjnfirst }
    \addcontentsline { toc } { lecture }
      { \protect \numberline { \thelecture } #2 }
    \__mjn_lecture_block:
  }

\cs_new_protected:Npn \__mjn_lecture_block:
  {
    \vspace* { -4mm }
    \__mjn_fullwidth:n
      {
        { \small \color { mjGray } \l__mjn_course_tl
          \tl_if_empty:NF \l__mjn_term_tl { \enspace · \enspace \l__mjn_term_tl } }
        \par \vspace { 2.2mm }
        { \color { mjAccent } \rule { \linewidth } { .9pt } }
        \par \vspace { 4.5mm }
        \begin{minipage} [ t ] { \l__mjn_titlew_dim }
          \raggedright
          { \LARGE \sffamily \bfseries \color { mjInk }
            \l__mjn_lecture_title_tl \par }
          \vspace { 3.2mm }
          { \small
            \__mjn_meta_item:nV { 主讲 } \l__mjn_lecture_by_tl
            \__mjn_meta_item:nV { 记录 } \l__mjn_lecture_scribe_tl
            \__mjn_meta_item:nV { 日期 } \l__mjn_lecture_date_tl \par }
        \end{minipage}
        \hfill
        \begin{minipage} [ t ] { \l__mjn_numw_dim }
          \raggedleft
          \vspace* { -1.5mm }
          { \color { mjAccent } \heitimd \large 第 }
          { \fontsize { 40 } { 40 } \selectfont \mojingsansmedium \color { mjAccent }
            \thelecture }
          { \color { mjAccent } \heitimd \large 讲 }
        \end{minipage}
        \par \vspace { 4mm }
        { \color { mjRule } \rule { \linewidth } { .3pt } }
      }
    \par \vspace { 1.2\baselineskip }
    \@afterindentfalse \@afterheading
  }
\cs_generate_variant:Nn \__mjn_meta_item:nn { nV }

%% ---------------------------------------------------------------------------
%% 节标题
%% ---------------------------------------------------------------------------
\ctexset
  {
    section =
      {
        format       = \raggedright \large \mojingheadfont ,
        numberformat = \color { mjAccent } ,
        aftername    = \hspace { 1em } ,
        beforeskip   = 1.5\baselineskip plus .4\baselineskip minus .2\baselineskip ,
        afterskip    = .7\baselineskip ,
        indent       = 0pt ,
      } ,
    subsection =
      {
        format       = \raggedright \normalsize \mojingheadfont ,
        numberformat = \color { mjAccent } ,
        aftername    = \hspace { .8em } ,
        beforeskip   = 1.1\baselineskip plus .3\baselineskip ,
        afterskip    = .4\baselineskip ,
        indent       = 0pt ,
      } ,
    subsubsection =
      {
        format     = \normalsize \mojingheadfont ,
        number     = {} , aftername = {} ,
        beforeskip = .8\baselineskip , afterskip = .3\baselineskip ,
        indent = 0pt ,
      } ,
    paragraph =
      {
        format = \normalsize \mojingheadfont \color { mjAccent } ,
        aftertitle = \hspace { 1em } , beforeskip = .4\baselineskip ,
        indent = 0pt ,
      } ,
  }

%% ---------------------------------------------------------------------------
%% 页眉页脚
%% ---------------------------------------------------------------------------
\RequirePackage { fancyhdr }
\pagestyle { fancy }
\fancyhf { }
\bool_if:NF \l__mjn_nomargin_bool
  {
    \bool_if:NTF \l__mjn_twoside_bool
      { \fancyhfoffset [ RO , LE ] { \marginparsep + \marginparwidth } }
      { \fancyhfoffset [ R ] { \marginparsep + \marginparwidth } }
  }
\cs_new_protected:Npn \__mjn_head_left:
  { \small \color { mjGray } \l__mjn_course_tl }
\cs_new_protected:Npn \__mjn_head_right:
  {
    \small \color { mjGray } \g__mjn_mark_tl
    \hspace { 1.2em }
    { \color { mjAccent } \sffamily \bfseries \thepage }
  }
\bool_if:NTF \l__mjn_twoside_bool
  {
    \fancyhead [ LO ] { \__mjn_head_left: }
    \fancyhead [ RO ] { \__mjn_head_right: }
    \fancyhead [ LE ] { { \color { mjAccent } \sffamily \bfseries \thepage } \hspace { 1.2em }
                        \small \color { mjGray } \l__mjn_course_tl }
    \fancyhead [ RE ] { \small \color { mjGray } \g__mjn_mark_tl }
  }
  {
    \fancyhead [ L ] { \__mjn_head_left: }
    \fancyhead [ R ] { \__mjn_head_right: }
  }
\RenewDocumentCommand \headrulewidth { } { .3pt }
\RenewDocumentCommand \headrule { }
  {
    { \color { mjRule }
      \hrule height \headrulewidth width \headwidth
      \vskip - \headrulewidth }
  }
\fancypagestyle { mjnfirst }
  {
    \fancyhf { }
    \fancyfoot [ R ] { \small \color { mjAccent } \sffamily \bfseries \thepage }
    \RenewDocumentCommand \headrulewidth { } { 0pt }
  }
\fancypagestyle { plain }
  {
    \fancyhf { }
    \fancyfoot [ R ] { \small \color { mjAccent } \sffamily \bfseries \thepage }
    \RenewDocumentCommand \headrulewidth { } { 0pt }
  }

%% ---------------------------------------------------------------------------
%% 旁注
%% ---------------------------------------------------------------------------
\RequirePackage { marginnote }
\RenewDocumentCommand \raggedrightmarginnote { } { \raggedright }
\RenewDocumentCommand \raggedleftmarginnote  { } { \raggedright }
\NewDocumentCommand \mojingmarginfont { }
  { \small \linespread { 1.2 } \selectfont \kaishu \color { mjInk!85 } }

\newcounter { sidenote }
\NewDocumentCommand \sidenote { O{0pt} +m }
  {
    \refstepcounter { sidenote }
    \textsuperscript { \color { mjAccent } \sffamily \bfseries \thesidenote }
    \marginnote
      {
        \mojingmarginfont
        \llap { \textsuperscript { \color { mjAccent } \sffamily \bfseries \thesidenote } \, }
        #2
      } [ #1 ]
  }
\NewDocumentCommand \margintext { O{0pt} +m }
  { \marginnote { \mojingmarginfont #2 } [ #1 ] }
%% 旁注插图：\begin{marginfigure}[垂直偏移] 内容 \caption{图题} \end{marginfigure}
\NewDocumentEnvironment { marginfigure } { O{0pt} +b }
  {
    \marginnote
      {
        \captionsetup
          { type = figure , font = { footnotesize } , labelfont = { sf , bf } ,
            justification = raggedright , singlelinecheck = false ,
            skip = .4\baselineskip }
        \centering #2 \par
      } [ #1 ]
  }
  { }

%% ---------------------------------------------------------------------------
%% 目录
%% ---------------------------------------------------------------------------
\RequirePackage { titletoc }
\cs_new:Npn \toclevel@lecture { 0 }
\contentsuse { lecture } { toc }
\titlecontents { lecture } [ 0pt ]
  { \addvspace { .7\baselineskip } \mojingheadfont }
  { \makebox [ 4.6em ] [ l ] { \color { mjAccent } 第 \thecontentslabel 讲 } }
  { }
  { \hfill \color { mjAccent } \sffamily \bfseries \contentspage }
\titlecontents { section } [ 4.6em ]
  { \small }
  { \makebox [ 2.6em ] [ l ] { \color { mjGray } \thecontentslabel } }
  { }
  { \titlerule* [ .7em ] { \color { mjRule } . } \contentspage }
\setcounter { tocdepth } { 1 }

\ctexset { contentsname = 目录 }
\RenewDocumentCommand \tableofcontents { }
  {
    \par \vspace { 1.5\baselineskip }
    { \noindent \Large \sffamily \bfseries \color { mjInk } \contentsname \par }
    \vspace { .3\baselineskip }
    { \noindent \color { mjAccent } \rule { 2.2em } { .9pt } \par }
    \vspace { .4\baselineskip }
    \@starttoc { toc }
  }

%% ---------------------------------------------------------------------------
%% 封面（课程信息 + 目录 + 说明，合为首页）
%% ---------------------------------------------------------------------------
\RenewDocumentCommand \maketitle { }
  {
    \thispagestyle { empty }
    \vspace* { 6mm }
    \__mjn_fullwidth:n
      {
        { \color { mjAccent } \rule { \linewidth } { .9pt } } \par
        \vspace { 9mm }
        { \fontsize { 30 } { 36 } \selectfont \sffamily \bfseries \color { mjInk }
          \l__mjn_course_tl \par }
        \tl_if_empty:NF \l__mjn_course_en_tl
          {
            \vspace { 3mm }
            { \large \mojingsansmedium \color { mjAccent }
              \addfontfeatures { LetterSpace = 8 } \l__mjn_course_en_tl \par }
          }
        \vspace { 6mm }
        { \large \color { mjInk } 课程讲义
          \tl_if_empty:NF \l__mjn_term_tl { \enspace · \enspace \l__mjn_term_tl } \par }
        \vspace { 2.5mm }
        { \color { mjGray }
          \l__mjn_instructor_tl
          \tl_if_empty:NF \l__mjn_institute_tl { \enspace \l__mjn_institute_tl } \par }
        \vspace { 8mm }
        { \color { mjRule } \rule { \linewidth } { .3pt } } \par
      }
  }

%% ---------------------------------------------------------------------------
%% 定理类环境
%% ---------------------------------------------------------------------------
\mojingloadhyperref
\crefname { lecture } { 第 } { 第 }
\creflabelformat { lecture } { #2#1#3~讲 }
\RequirePackage { mojing-theorem }
\mojingtheoremcounter { lecture }
\mojingdefinetheorems
\mojingdecorate { theorem }     { bar }
\mojingdecorate { proposition } { bar }
\mojingdecorate { lemma }       { graybar }
\mojingdecorate { corollary }   { graybar }
\mojingdecorate { definition }  { tint }
\RenewDocumentCommand \mojingremarkheadfont { } { \mojingheadfont \color { mjAccent } }

%% 本讲要点
\NewDocumentEnvironment { keypoints } { O{本讲要点} }
  {
    \begin{tcolorbox}
      [ mojing/base , frame~hidden , colback = mjLight ,
        left = 10pt , right = 10pt , top = 7pt , bottom = 7pt ,
        before~skip = .2\baselineskip , after~skip = 1\baselineskip ]
      { \mojingheadfont \color { mjAccent } #1 \par }
      \vspace { .3\baselineskip }
      \small
  }
  { \end{tcolorbox} }

%% 讲末习题：\begin{exercises} \item ... \end{exercises}
\NewDocumentEnvironment { exercises } { O{习题} }
  {
    \section* { #1 }
    \addcontentsline { toc } { section } { \protect \numberline { } #1 }
    \small
    \begin{enumerate}
      [ label = { \color { mjAccent } \sffamily \bfseries \thelecture . \arabic* } ,
        ref = \thelecture . \arabic* ,
        leftmargin = 3.2em , labelsep = .8em , align = left ,
        itemsep = .45\baselineskip ]
  }
  { \end{enumerate} }
%% 难题标记（放在 \item 之后）
\NewDocumentCommand \hard { }
  { \marginnote { \small \color { mjAccent } \heitimd 选做 } }

%% 取消旁注栏时：旁注改为脚注，旁注插图改为正文中的小插图
\bool_if:NT \l__mjn_nomargin_bool
  {
    \RenewDocumentCommand \sidenote { O{} +m } { \footnote {#2} }
    \RenewDocumentCommand \margintext { O{} +m } { \footnote {#2} }
    \RenewDocumentEnvironment { marginfigure } { O{} +b }
      {
        \par \addvspace { .5\baselineskip }
        \begin{center}
          \begin{minipage} { .5\textwidth }
            \captionsetup { type = figure , font = { footnotesize } }
            \centering #2 \par
          \end{minipage}
        \end{center}
      }
      { }
    \RenewDocumentCommand \hard { } { { \small \color { mjAccent } \heitimd （选做）} }
  }

\AtBeginDocument { \raggedbottom }
\endinput
