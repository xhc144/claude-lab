%% mojing-book.cls
%% 墨经 Mojing —— 数学书籍
%%
%% 设计要点：
%%   * 16 开（185 mm × 260 mm）双面排版，章从奇数页起；西文与数学默认用
%%     Palatino 风格的 TeX Gyre Pagella，正文宋体，主题色朱砂；
%%   * 完整的书籍结构：半书名页、书名页、版权页、前言、目录、符号说明、
%%     部分（part）扉页、章首页（大号章序数、题词、本章目录）、章末习题
%%     与历史注记、书末习题答案、参考文献与索引；
%%   * 书眉：偶数页排章名，奇数页排节名，页码在外侧；
%%   * 定理类环境沿用国内教材的排法：标题缩进两字、黑体，重要定理上下加细线。
%%
%% 主要命令：
%%   \booktitle{..} \booksubtitle{..} \bookauthor{..} \publisher{..}
%%   \halftitlepage  \maketitle  \begin{copyrightpage} ... \end{copyrightpage}
%%   \partintro{..}（写在 \part 之前） \epigraph{..}{..} \chaptertoc
%%   \term[拼音]{术语}（加粗并编入索引） \begin{exercises} \exgroup{A 组}
%%   \begin{history} ... \end{history}  \begin{algorithm}[名称] ... \end{algorithm}
%%
%% 本文件以 LPPL 1.3c 发布。
\NeedsTeXFormat{LaTeX2e}[2022/06/01]
\ProvidesExplClass{mojing-book}{2026/10/13}{1.0}{Mojing: books}

\cs_new_protected:Npn \__mojing_forward_option:
  {
    \tl_if_empty:NTF \l_keys_value_tl
      { \exp_args:Ne \PassOptionsToPackage { \l_keys_key_str } { mojing-core } }
      {
        \exp_args:Ne \PassOptionsToPackage
          { \l_keys_key_str = \exp_not:V \l_keys_value_tl } { mojing-core }
      }
  }
\bool_new:N \l__mjb_openany_bool
\keys_define:nn { mojing / book }
  {
    openany .bool_set:N = \l__mjb_openany_bool ,
    openany .default:n  = true ,
    draft   .code:n     = { \PassOptionsToClass { draft } { book } } ,
    unknown .code:n     = { \__mojing_forward_option: } ,
  }
\PassOptionsToPackage { accent = mjVermilion , latin = pagella , zihao = 5 } { mojing-core }
\ProcessKeyOptions [ mojing / book ]

\bool_if:NTF \l__mjb_openany_bool
  { \LoadClass [ twoside , openany ] { book } }
  { \LoadClass [ twoside , openright ] { book } }
\RequirePackage { mojing-core }
\RequirePackage { mojing-math }
\RequirePackage { mojing-tikz }
\RequirePackage { multicol }

%% ---------------------------------------------------------------------------
%% 版心：16 开，正文 137 mm（约 37 字）
%% ---------------------------------------------------------------------------
\RequirePackage { geometry }
\geometry
  { paperwidth = 185mm , paperheight = 260mm ,
    textwidth = 137mm , inner = 21mm , top = 25mm , textheight = 207mm ,
    headsep = 7mm , footskip = 12mm , headheight = 13pt }

%% ---------------------------------------------------------------------------
%% 书名信息
%% ---------------------------------------------------------------------------
\tl_new:N \l__mjb_title_tl     \tl_new:N \l__mjb_subtitle_tl
\tl_new:N \l__mjb_entitle_tl   \tl_new:N \l__mjb_author_tl
\tl_new:N \l__mjb_publisher_tl \tl_new:N \l__mjb_city_tl
\tl_new:N \l__mjb_year_tl      \tl_new:N \l__mjb_edition_tl
\NewDocumentCommand \booktitle    { m } { \tl_set:Nn \l__mjb_title_tl {#1} }
\NewDocumentCommand \booksubtitle { m } { \tl_set:Nn \l__mjb_subtitle_tl {#1} }
\NewDocumentCommand \bookentitle  { m } { \tl_set:Nn \l__mjb_entitle_tl {#1} }
\NewDocumentCommand \bookauthor   { m } { \tl_set:Nn \l__mjb_author_tl {#1} }
\NewDocumentCommand \bookedition  { m } { \tl_set:Nn \l__mjb_edition_tl {#1} }
\NewDocumentCommand \publisher    { m m m }
  {
    \tl_set:Nn \l__mjb_publisher_tl {#1}
    \tl_set:Nn \l__mjb_city_tl {#2}
    \tl_set:Nn \l__mjb_year_tl {#3}
  }

%% 半书名页
\NewDocumentCommand \halftitlepage { }
  {
    \cleardoublepage
    \thispagestyle { empty }
    \vspace* { 50mm }
    \begin{center}
      { \fontsize { 22 } { 30 } \selectfont \mojingheadfont \color { mjInk }
        \l__mjb_title_tl \par }
    \end{center}
    \clearpage
    \thispagestyle { empty } \null
  }

%% 书名页
\RenewDocumentCommand \maketitle { }
  {
    \cleardoublepage
    \thispagestyle { empty }
    \noindent
    \begin{tikzpicture} [ remember~picture , overlay ]
      \fill [ mjAccent ] ( current~page.north~west ) ++ ( 21mm , -40mm )
        rectangle ++ ( 3mm , -46mm ) ;
    \end{tikzpicture}
    \vspace* { 26mm }
    \noindent \hspace* { 8mm }
    \begin{minipage} [ t ] { \dim_eval:n { \textwidth - 8mm } }
      \raggedright
      { \fontsize { 30 } { 38 } \selectfont \sffamily \bfseries \color { mjInk }
        \l__mjb_title_tl \par }
      \tl_if_empty:NF \l__mjb_subtitle_tl
        {
          \vspace { 4mm }
          { \Large \mojingheadfont \color { mjAccent } \l__mjb_subtitle_tl \par }
        }
      \tl_if_empty:NF \l__mjb_entitle_tl
        {
          \vspace { 5mm }
          { \normalsize \mojingsansmedium \color { mjGray }
            \addfontfeatures { LetterSpace = 6 } \l__mjb_entitle_tl \par }
        }
      \tl_if_empty:NF \l__mjb_edition_tl
        { \vspace { 3mm } { \small \color { mjGray } \l__mjb_edition_tl \par } }
      \vspace { 22mm }
      { \Large \kaishu \l__mjb_author_tl \par }
    \end{minipage}
    \vfill
    \begin{center}
      { \color { mjAccent } \rule { 12mm } { .6pt } } \par
      \vspace { 3mm }
      { \large \mojingheadfont \l__mjb_publisher_tl \par }
      \vspace { 1.5mm }
      { \small \color { mjGray } \l__mjb_city_tl \enspace · \enspace \l__mjb_year_tl \par }
    \end{center}
    \vspace* { 6mm }
    \clearpage
  }

%% 版权页
\NewDocumentEnvironment { copyrightpage } { }
  {
    \thispagestyle { empty }
    \null \vfill
    \small \linespread { 1.35 } \selectfont
    \setlength \parindent { 0pt }
    \setlength \parskip { .5\baselineskip }
  }
  { \par \vspace* { 5mm } \clearpage }

%% ---------------------------------------------------------------------------
%% 部分扉页、章首页
%% ---------------------------------------------------------------------------
\tl_new:N \g__mjb_partintro_tl
\NewDocumentCommand \partintro { +m } { \tl_gset:Nn \g__mjb_partintro_tl {#1} }
\cs_new_protected:Npn \__mjb_part_after:
  {
    \tl_if_empty:NF \g__mjb_partintro_tl
      {
        \par \vspace { 14mm }
        \begin{minipage} { .72\textwidth }
          \normalsize \normalfont \kaishu \color { mjInk!85 }
          \setlength \parindent { 2em }
          \g__mjb_partintro_tl \par
        \end{minipage}
        \tl_gclear:N \g__mjb_partintro_tl
      }
  }

\ctexset
  {
    part =
      {
        pagestyle    = empty ,
        name         = { 第 , 部分 } ,
        number       = \chinese { part } ,
        format       = \centering ,
        nameformat   = \Large \mojingheadfont \color { mjAccent } ,
        aftername    = \par \vspace { 3mm }
                       { \color { mjAccent } \rule { 10mm } { .8pt } } \par \vspace { 6mm } ,
        titleformat  = \fontsize { 26 } { 34 } \selectfont \sffamily \bfseries \color { mjInk } ,
        beforeskip   = 48mm ,
        aftertitle   = \__mjb_part_after: ,
      } ,
    chapter =
      {
        pagestyle    = mjbchapter ,
        name         = { 第 , 章 } ,
        number       = \arabic { chapter } ,
        format       = \raggedright \__mjb_bignum: ,
        nameformat   = \large \mojingheadfont \color { mjAccent } ,
        aftername    = \par \vspace { 5mm } ,
        titleformat  = \fontsize { 24 } { 32 } \selectfont \sffamily \bfseries \color { mjInk } ,
        beforeskip   = 22mm ,
        afterskip    = 9mm ,
        aftertitle   = \par \vspace { 5mm }
                       { \color { mjAccent } \rule { \textwidth } { .6pt } }
                       \startcontents [ chapters ] ,
      } ,
    section =
      {
        format       = \Large \mojingheadfont \raggedright ,
        numberformat = \color { mjAccent } ,
        aftername    = \hspace { 1em } ,
        beforeskip   = 2\baselineskip plus .5\baselineskip minus .2\baselineskip ,
        afterskip    = 1\baselineskip ,
      } ,
    subsection =
      {
        format       = \large \mojingheadfont \raggedright ,
        numberformat = \color { mjAccent } ,
        aftername    = \hspace { 1em } ,
        beforeskip   = 1.4\baselineskip plus .3\baselineskip ,
        afterskip    = .6\baselineskip ,
      } ,
    subsubsection =
      {
        format     = \normalsize \mojingheadfont ,
        number     = { } , aftername = { } ,
        beforeskip = 1\baselineskip , afterskip = .4\baselineskip ,
      } ,
  }

%% 章首页右侧的大号章序数
\cs_new_protected:Npn \__mjb_bignum:
  {
    \int_compare:nNnT { \value { chapter } } > { 0 }
      {
        \legacy_if:nT { @mainmatter }
          {
            \leavevmode
            \rlap
              {
                \makebox [ \textwidth ] [ r ]
                  {
                    \raisebox { -18mm } [ 0pt ] [ 0pt ]
                      { \fontsize { 88 } { 88 } \selectfont \mojingsansmedium
                        \color { mjAccent!88 } \thechapter }
                  }
              }
          }
      }
  }

%% 题词：\epigraph{文字}{出处}
\NewDocumentCommand \epigraph { +m m }
  {
    \par \vspace { -2mm }
    \begin{flushright}
      \begin{minipage} { .62\textwidth }
        \raggedleft \small \kaishu \color { mjInk!90 }
        #1 \par
        \vspace { 1.5mm }
        { \footnotesize \songti \color { mjGray } —— #2 } \par
      \end{minipage}
    \end{flushright}
    \vspace { 4mm }
  }

%% 本章目录
\RequirePackage { titletoc }
\NewDocumentCommand \chaptertoc { }
  {
    \begin{tcolorbox}
      [ enhanced , frame~hidden , colback = mjLight , arc = 0pt , boxrule = 0pt ,
        left = 10pt , right = 10pt , top = 6pt , bottom = 6pt ,
        before~skip = 2mm , after~skip = 8mm ]
      { \small \mojingheadfont \color { mjAccent } 本章内容 \par }
      \vspace { 1mm }
      \printcontents [ chapters ] { mjb } { 1 } { \setcounter { tocdepth } { 1 } }
    \end{tcolorbox}
  }
\titlecontents { mjbsection } [ 2.8em ]
  { \small }
  { \contentslabel [ \color { mjAccent } \thecontentslabel ] { 2.8em } }
  { }
  { \titlerule* [ .6em ] { \color { mjRule } . } \contentspage }

%% ---------------------------------------------------------------------------
%% 目录
%% ---------------------------------------------------------------------------
\titlecontents { part } [ 0pt ]
  { \addvspace { 1.4\baselineskip } \centering \mojingheadfont \color { mjAccent } }
  { 第 \thecontentslabel 部分 \enspace }
  { }
  { }
\titlecontents { chapter } [ 3.6em ]
  { \addvspace { .9\baselineskip } \mojingheadfont }
  { \contentslabel [ \color { mjAccent } \thecontentslabel ] { 3.6em } }
  { \hspace* { -3.6em } }
  { \hfill \contentspage }
\titlecontents { section } [ 6.4em ]
  { \small }
  { \contentslabel [ \color { mjGray } \thecontentslabel ] { 2.8em } }
  { }
  { \titlerule* [ .6em ] { \color { mjRule } . } \contentspage }
\setcounter { tocdepth } { 1 }
\ctexset { contentsname = 目录 }


%% ---------------------------------------------------------------------------
%% 书眉
%% ---------------------------------------------------------------------------
\RequirePackage { fancyhdr }
\pagestyle { fancy }
\fancyhf { }
\fancyhead [ LE ] { \small \mojingsansmedium \color { mjAccent } \thepage
                    \hspace { 1.2em } \color { mjInk } \normalfont \small \leftmark }
\fancyhead [ RO ] { \small \rightmark \hspace { 1.2em }
                    \mojingsansmedium \color { mjAccent } \thepage }
\RenewDocumentCommand \headrulewidth { } { 0pt }
\fancypagestyle { mjbchapter }
  {
    \fancyhf { }
    \fancyfoot [ C ] { \small \mojingsansmedium \color { mjAccent } \thepage }
  }
\fancypagestyle { plain }
  {
    \fancyhf { }
    \fancyfoot [ C ] { \small \mojingsansmedium \color { mjAccent } \thepage }
  }
\AtBeginDocument
  {
    \cs_set:Npn \chaptermark #1
      {
        \markboth
          {
            \int_compare:nNnTF { \value { secnumdepth } } > { -1 }
              { \legacy_if:nTF { @mainmatter } { 第 \thechapter 章 \quad #1 } {#1} }
              {#1}
          } { }
      }
    \cs_set:Npn \sectionmark #1 { \markright { \thesection \quad #1 } }
  }

%% ---------------------------------------------------------------------------
%% 定理类环境
%% ---------------------------------------------------------------------------
\mojingloadhyperref
\RequirePackage { mojing-theorem }
\RenewDocumentCommand \mojingthmindent { } { 2em }
\RenewDocumentCommand \mojingthmheadfont { } { \mojingheadfont \color { mjAccent } }
\mojingtheoremcounter { chapter }
\mojingdefinetheorems
\mojingdecorate { theorem } { rules }
\counterwithin { equation } { chapter }
\counterwithin { figure } { chapter }
\counterwithin { table } { chapter }

%% 算法
\NewDocumentEnvironment { algorithm } { O{} }
  {
    \par \addvspace { .6\baselineskip }
    \begin{tcolorbox}
      [ enhanced , breakable , arc = 0pt , boxrule = 0pt , frame~hidden ,
        colback = white , left = 0pt , right = 0pt , top = 5pt , bottom = 5pt ,
        borderline~north = { .8pt } { 0pt } { mjInk } ,
        borderline~south = { .8pt } { 0pt } { mjInk } ,
        before~skip = .4\baselineskip , after~skip = .6\baselineskip ]
      \refstepcounter { mjthm }
      { \mojingheadfont 算法 ~ \themjthm \tl_if_empty:nF {#1} { \enspace （#1） } } \par
      \vspace { -1mm }
      { \color { mjRule } \rule { \linewidth } { .4pt } } \par
      \vspace { .5mm }
      \small
  }
  { \end{tcolorbox} }
\crefname { mjthm } { 算法 } { 算法 }

%% 术语：加粗并编入索引。\term[拼音排序键]{术语}
\RequirePackage { imakeidx }
\NewDocumentCommand \term { o m }
  {
    { \heitimd \color { mjAccent } #2 }
    \IfValueTF {#1} { \index { #1 @ #2 } } { \index {#2} }
  }

%% 章末习题
\NewDocumentEnvironment { exercises } { O{习题 \thechapter} }
  {
    \section* { #1 }
    \addcontentsline { toc } { section } { \protect \numberline { } #1 }
    \markright { #1 }
    \small
    \setlist [ enumerate , 1 ]
      { label = { \mojingsansmedium \color { mjAccent } \arabic* . } , ref = \arabic* ,
        leftmargin = 2.4em , labelsep = .6em , align = right ,
        itemsep = .4\baselineskip , resume }
    \restartlist { enumerate }
  }
  { }
\NewDocumentCommand \exgroup { m }
  {
    \par \addvspace { .8\baselineskip }
    \noindent { \mojingheadfont \color { mjAccent } #1 } \par
    \nopagebreak \vspace { .3\baselineskip }
  }

%% 历史注记
\NewDocumentEnvironment { history } { O{历史注记} }
  {
    \par \addvspace { 1.2\baselineskip }
    \begin{tcolorbox}
      [ enhanced , breakable , arc = 0pt , boxrule = 0pt , frame~hidden ,
        colback = mjLight , left = 12pt , right = 12pt , top = 9pt , bottom = 9pt ,
        borderline~north = { 1.2pt } { 0pt } { mjAccent } ]
      { \mojingheadfont \color { mjAccent } #1 \par }
      \vspace { .4\baselineskip }
      \small \setlength \parindent { 2em }
  }
  { \end{tcolorbox} }

%% ---------------------------------------------------------------------------
%% 索引：按拼音排序（排序键由 \term 的可选参数给出），分字母组
%% ---------------------------------------------------------------------------
\iow_new:N \g__mjb_ist_iow
\iow_open:Nn \g__mjb_ist_iow { mojing-book.ist }
\iow_now:Nn \g__mjb_ist_iow { headings_flag~1 }
\iow_now:Ne \g__mjb_ist_iow
  { heading_prefix ~ "\c_backslash_str\c_backslash_str indexgroup\c_left_brace_str" }
\iow_now:Ne \g__mjb_ist_iow
  {
    heading_suffix ~ "\c_right_brace_str\c_backslash_str\c_backslash_str nopagebreak
    \c_backslash_str n"
  }
\iow_now:Nn \g__mjb_ist_iow { delim_0~"\\dotfill~" }
\iow_now:Nn \g__mjb_ist_iow { delim_1~"\\dotfill~" }
\iow_now:Nn \g__mjb_ist_iow { delim_2~"\\dotfill~" }
\iow_close:N \g__mjb_ist_iow
\makeindex [ intoc , columns = 2 , columnsep = 2em , title = 索引 ,
             options = { -s ~ mojing-book.ist } ]
\NewDocumentCommand \indexgroup { m }
  {
    \par \addvspace { .8\baselineskip }
    { \mojingheadfont \color { mjAccent } #1 } \par \nopagebreak
    \vspace { .2\baselineskip }
  }
\indexsetup { level = \chapter* , toclevel = chapter , firstpagestyle = mjbchapter ,
              othercode = { \small \markboth { 索引 } { 索引 } } }

%% ---------------------------------------------------------------------------
%% 参考文献（GB/T 7714—2015）
%% ---------------------------------------------------------------------------
\RequirePackage [ backend = biber , style = gb7714-2015 , gbpub = false ,
                  gbnamefmt = lowercase ] { biblatex }
\defbibheading { mjbook } [ 参考文献 ]
  {
    \chapter* { #1 }
    \addcontentsline { toc } { chapter } { #1 }
    \markboth { #1 } { #1 }
  }
\AtBeginBibliography { \small }
\NewDocumentCommand \printreferences { } { \printbibliography [ heading = mjbook ] }

%% 无编号的章（前言、符号说明、答案等）：加入目录并设置书眉
\NewDocumentCommand \unnumberedchapter { m }
  {
    \chapter* {#1}
    \addcontentsline { toc } { chapter } {#1}
    \markboth {#1} {#1}
  }

\AtBeginDocument { \raggedbottom }
\endinput
