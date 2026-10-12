(()=>{var $0=i=>typeof matchMedia=="function"&&matchMedia(i).matches,Yd=new URLSearchParams(location.search),Yt={params:Yd,reducedMotion:$0("(prefers-reduced-motion: reduce)"),coarse:$0("(pointer: coarse)"),narrow:$0("(max-width: 860px)"),file:location.protocol==="file:"};function Mg(){let i=Yd.get("q");if(i==="low"||i==="mid"||i==="high")return i;if(Yt.reducedMotion||Yt.coarse||Yt.narrow)return"low";let e=navigator.hardwareConcurrency||4,t=navigator.deviceMemory||8;return e>=8&&t>=8?"high":"mid"}Yt.quality=Mg();Yt.particles={high:65536,mid:49152,low:24576}[Yt.quality];Yt.pixelRatio=Math.min(window.devicePixelRatio||1,Yt.quality==="high"?1.75:Yt.quality==="mid"?1.4:1.25);var ra=new Map,St={on(i,e){return ra.has(i)||ra.set(i,new Set),ra.get(i).add(e),()=>ra.get(i).delete(e)},emit(i,e){let t=ra.get(i);if(t)for(let n of[...t])n(e)}};var Kd="xhc144:",ps={get(i,e=null){try{let t=localStorage.getItem(Kd+i);return t===null?e:JSON.parse(t)}catch{return e}},set(i,e){try{localStorage.setItem(Kd+i,JSON.stringify(e))}catch{}}};var Zd=[1,9/8,5/4,4/3,3/2,5/3,15/8,2,9/4,5/2],Ze=null,qn=null,fr=null,aa=null,Po=null,wi=!1;function Sg(i=3){let e=Math.floor(Ze.sampleRate*i),t=Ze.createBuffer(2,e,Ze.sampleRate);for(let n=0;n<2;n++){let r=t.getChannelData(n);for(let s=0;s<e;s++)r[s]=(Math.random()*2-1)*Math.pow(1-s/e,3.2)}return t}function wg(){if(Ze)return!0;let i=window.AudioContext||window.webkitAudioContext;if(!i)return!1;Ze=new i,qn=Ze.createGain(),qn.gain.value=0;let e=Ze.createDynamicsCompressor();e.threshold.value=-18,e.ratio.value=3,qn.connect(e).connect(Ze.destination),fr=Ze.createConvolver(),fr.buffer=Sg(3.2);let t=Ze.createGain();t.gain.value=.55,fr.connect(t).connect(qn),aa=Ze.createBuffer(1,Ze.sampleRate*2,Ze.sampleRate);let n=aa.getChannelData(0);for(let r=0;r<n.length;r++)n[r]=Math.random()*2-1;return!0}function Tg(){let i=Ze.currentTime,e=Ze.createBiquadFilter();e.type="lowpass",e.frequency.value=340,e.Q.value=.8;let t=Ze.createOscillator();t.frequency.value=.045;let n=Ze.createGain();n.gain.value=140,t.connect(n).connect(e.frequency),t.start(i);let r=Ze.createGain();r.gain.value=.032;for(let h of[55,55*1.0045,27.5]){let d=Ze.createOscillator();d.type=h<40?"sine":"sawtooth",d.frequency.value=h,d.connect(h<40?r:e),d.start(i)}e.connect(r),r.connect(qn),r.connect(fr);let s=Ze.createGain();s.gain.value=.014;let a=Ze.createBiquadFilter();a.type="lowpass",a.frequency.value=1400,Po=[1,1.5,2.5].map(h=>{let d=Ze.createOscillator();return d.type="triangle",d.frequency.value=110*h,d.connect(a),d.start(i),{o:d,r:h}}),a.connect(s),s.connect(qn),s.connect(fr);let o=Ze.createBufferSource();o.buffer=aa,o.loop=!0;let l=Ze.createBiquadFilter();l.type="bandpass",l.frequency.value=5200,l.Q.value=.6;let c=Ze.createGain();c.gain.value=.0045,o.connect(l).connect(c).connect(qn),o.start(i)}function Qd(i,e,t,n,r=Ze.currentTime){i.gain.setValueAtTime(1e-4,r),i.gain.exponentialRampToValueAtTime(e,r+t),i.gain.exponentialRampToValueAtTime(1e-4,r+t+n)}function sa(i,{type:e="sine",peak:t=.05,attack:n=.004,decay:r=.14,at:s,wet:a=!0,glide:o}={}){if(!wi)return;let l=s??Ze.currentTime,c=Ze.createOscillator();c.type=e,c.frequency.setValueAtTime(i,l),o&&c.frequency.exponentialRampToValueAtTime(o,l+n+r);let h=Ze.createGain();Qd(h,t,n,r,l),c.connect(h),h.connect(qn),a&&h.connect(fr),c.start(l),c.stop(l+n+r+.05)}var Jd=[880,988,1109,1319,1480,1760],jd=0,Nt={get on(){return wi},async enable(){if(!wg())return!1;try{await Ze.resume()}catch{return!1}return Po||Tg(),wi=!0,qn.gain.cancelScheduledValues(Ze.currentTime),qn.gain.setTargetAtTime(.85,Ze.currentTime,.6),ps.set("sound",!0),!0},disable(){wi=!1,ps.set("sound",!1),Ze&&qn.gain.setTargetAtTime(0,Ze.currentTime,.15)},chord(i){if(!Ze||!Po)return;let e=110*Zd[i%Zd.length];for(let{o:t,r:n}of Po)t.frequency.setTargetAtTime(e*n,Ze.currentTime,.8)},blip(){if(!wi)return;let i=performance.now();i-jd<60||(jd=i,sa(Jd[Math.random()*Jd.length|0],{peak:.022,decay:.12}))},tick(){wi&&sa(2200,{type:"square",peak:.008,decay:.02,wet:!1})},click(){wi&&sa(660,{type:"triangle",peak:.05,decay:.09,glide:990})},whoosh(i=!0){if(!wi)return;let e=Ze.currentTime,t=Ze.createBufferSource();t.buffer=aa;let n=Ze.createBiquadFilter();n.type="bandpass",n.Q.value=1.1,n.frequency.setValueAtTime(i?260:2600,e),n.frequency.exponentialRampToValueAtTime(i?2600:260,e+.7);let r=Ze.createGain();r.gain.setValueAtTime(1e-4,e),r.gain.exponentialRampToValueAtTime(.13,e+.25),r.gain.exponentialRampToValueAtTime(1e-4,e+.9),t.connect(n).connect(r),r.connect(qn),r.connect(fr),t.start(e,Math.random()),t.stop(e+1)},impact(){if(!wi)return;let i=Ze.currentTime;sa(72,{peak:.32,attack:.01,decay:1.4,glide:30,wet:!0});let e=Ze.createBufferSource();e.buffer=aa;let t=Ze.createBiquadFilter();t.type="lowpass",t.frequency.value=900;let n=Ze.createGain();Qd(n,.16,.005,.45,i),e.connect(t).connect(n),n.connect(qn),n.connect(fr),e.start(i),e.stop(i+.6)},success(){if(!wi)return;let i=Ze.currentTime;[1,5/4,3/2,2,5/2].forEach((e,t)=>sa(523.25*e,{type:"triangle",peak:.05,decay:.6,at:i+t*.07}))}};var Vi={time:0,dt:.016666666666666666,frame:0,fps:60},Do=new Set,Lo=0,zo=0,Y0=0;function vn(i){return Do.add(i),()=>Do.delete(i)}function ef(i){let e=Lo?Math.min(.05,(i-Lo)/1e3):.016666666666666666;Lo=i,Vi.dt=e,Vi.time+=e,Vi.frame++,zo+=e,Y0++,zo>.5&&(Vi.fps=Math.round(Y0/zo),zo=0,Y0=0);for(let t of Do)try{t(Vi)}catch(n){console.error(n),Do.delete(t)}requestAnimationFrame(ef)}function tf(){requestAnimationFrame(ef),document.addEventListener("visibilitychange",()=>{Lo=0})}var K0=(i,e,t)=>i<e?e:i>t?t:i,Z0=[],Xn={y:0,v:0,speed:0,total:0,chapter:null};function oa(i,e,t=i.dataset.progress==="pin"?"pin":"enter"){let n={el:i,cb:e,mode:t,last:-1};return Z0.push(n),n}function Ag(i,e="enter"){let t=i.getBoundingClientRect(),n=window.innerHeight;if(e==="pin"){let r=t.height-n;return r>0?K0(-t.top/r,0,1):0}return K0((n-t.top)/t.height,0,1)}function nf(){let i=[...document.querySelectorAll("[data-chapter]")];for(let t of document.querySelectorAll("[data-progress]"))Z0.some(n=>n.el===t)||oa(t,null);let e=window.scrollY;vn(({dt:t})=>{let n=window.scrollY,r=window.innerHeight,a=Math.abs(n-e)>r*2||performance.now()<rf?0:(n-e)/Math.max(t,.001);e=n,Xn.v=a,Xn.speed+=(Math.abs(a)-Xn.speed)*Math.min(1,t*5),Xn.y=n;let o=document.documentElement.scrollHeight-r;Xn.total=o>0?K0(n/o,0,1):0;for(let h of Z0){let d=Ag(h.el,h.mode);Math.abs(d-h.last)>1e-4&&(h.last=d,h.el.style.setProperty("--p",d.toFixed(4)),h.cb&&h.cb(d))}let l=r*.5,c=null;for(let h of i){let d=h.getBoundingClientRect();if(d.top<=l&&d.bottom>l){c=h;break}}if(!c&&i.length&&(c=n<10?i[0]:i[i.length-1]),c!==Xn.chapter){let h=Xn.chapter;Xn.chapter=c,St.emit("chapter",{el:c,prev:h})}})}var rf=0;function la(i,{offset:e=0}={}){rf=performance.now()+1800;let t=document.getElementById(i);if(!t)return;let n=t.getBoundingClientRect().top+window.scrollY+e;window.scrollTo({top:i==="hero"?0:n,behavior:"smooth"})}var fe=class i extends Error{constructor(e,t){var n="KaTeX parse error: "+e,r,s,a=t&&t.loc;if(a&&a.start<=a.end){var o=a.lexer.input;r=a.start,s=a.end,r===o.length?n+=" at end of input: ":n+=" at position "+(r+1)+": ";var l=o.slice(r,s).replace(/[^]/g,"$&̲"),c;r>15?c="…"+o.slice(r-15,r):c=o.slice(0,r);var h;s+15<o.length?h=o.slice(s,s+15)+"…":h=o.slice(s),n+=c+l+h}super(n),this.name="ParseError",this.position=void 0,this.length=void 0,this.rawMessage=void 0,Object.setPrototypeOf(this,i.prototype),this.position=r,r!=null&&s!=null&&(this.length=s-r),this.rawMessage=e}},Eg=/([A-Z])/g,Cg=i=>i.replace(Eg,"-$1").toLowerCase(),Rg={"&":"&amp;",">":"&gt;","<":"&lt;",'"':"&quot;","'":"&#x27;"},kg=/[&><"']/g,An=i=>String(i).replace(kg,e=>Rg[e]),qo=i=>i.type==="ordgroup"||i.type==="color"?i.body.length===1?qo(i.body[0]):i:i.type==="font"?qo(i.body):i,Ig=new Set(["mathord","textord","atom"]),qi=i=>Ig.has(qo(i).type),Pg=i=>{var e=/^[\x00-\x20]*([^\\/#?]*?)(:|&#0*58|&#x0*3a|&colon)/i.exec(i);return e?e[2]!==":"||!/^[a-zA-Z][a-zA-Z0-9+\-.]*$/.test(e[1])?null:e[1].toLowerCase():"_relative"},hh={displayMode:{type:"boolean",description:"Render math in display mode, which puts the math in display style (so \\int and \\sum are large, for example), and centers the math on the page on its own line.",cli:"-d, --display-mode"},output:{type:{enum:["htmlAndMathml","html","mathml"]},description:"Determines the markup language of the output.",cli:"-F, --format <type>"},leqno:{type:"boolean",description:"Render display math in leqno style (left-justified tags)."},fleqn:{type:"boolean",description:"Render display math flush left."},throwOnError:{type:"boolean",default:!0,cli:"-t, --no-throw-on-error",cliDescription:"Render errors (in the color given by --error-color) instead of throwing a ParseError exception when encountering an error."},errorColor:{type:"string",default:"#cc0000",cli:"-c, --error-color <color>",cliDescription:"A color string given in the format 'rgb' or 'rrggbb' (no #). This option determines the color of errors rendered by the -t option.",cliProcessor:i=>"#"+i},macros:{type:"object",cli:"-m, --macro <def>",cliDescription:"Define custom macro of the form '\\foo:expansion' (use multiple -m arguments for multiple macros).",cliDefault:[],cliProcessor:(i,e)=>(e.push(i),e)},minRuleThickness:{type:"number",description:"Specifies a minimum thickness, in ems, for fraction lines, `\\sqrt` top lines, `{array}` vertical lines, `\\hline`, `\\hdashline`, `\\underline`, `\\overline`, and the borders of `\\fbox`, `\\boxed`, and `\\fcolorbox`.",processor:i=>Math.max(0,i),cli:"--min-rule-thickness <size>",cliProcessor:parseFloat},colorIsTextColor:{type:"boolean",description:"Makes \\color behave like LaTeX's 2-argument \\textcolor, instead of LaTeX's one-argument \\color mode change.",cli:"-b, --color-is-text-color"},strict:{type:[{enum:["warn","ignore","error"]},"boolean","function"],description:"Turn on strict / LaTeX faithfulness mode, which throws an error if the input uses features that are not supported by LaTeX.",cli:"-S, --strict",cliDefault:!1},trust:{type:["boolean","function"],description:"Trust the input, enabling all HTML features such as \\url.",cli:"-T, --trust"},maxSize:{type:"number",default:1/0,description:"If non-zero, all user-specified sizes, e.g. in \\rule{500em}{500em}, will be capped to maxSize ems. Otherwise, elements and spaces can be arbitrarily large",processor:i=>Math.max(0,i),cli:"-s, --max-size <n>",cliProcessor:parseInt},maxExpand:{type:"number",default:1e3,description:"Limit the number of macro expansions to the specified number, to prevent e.g. infinite macro loops. If set to Infinity, the macro expander will try to fully expand as in LaTeX.",processor:i=>Math.max(0,i),cli:"-e, --max-expand <n>",cliProcessor:i=>i==="Infinity"?1/0:parseInt(i)},globalGroup:{type:"boolean",cli:!1}};function zg(i){if(typeof i!="string")return i.enum[0];switch(i){case"boolean":return!1;case"string":return"";case"number":return 0;case"object":return{};default:throw new Error("Unexpected schema type; settings must declare an explicit default.")}}function Lg(i){if(Object.prototype.hasOwnProperty.call(i,"default")&&i.default!==void 0)return i.default;var e=Array.isArray(i.type)?i.type[0]:i.type;return zg(e)}function Dg(i,e,t,n){var r=Object.prototype.hasOwnProperty.call(t,e)?t[e]:void 0,s=Object.prototype.hasOwnProperty.call(n,"processor")?n.processor:void 0;i[e]=r!==void 0?s?s(r):r:Lg(n)}var fa=class{constructor(e){e===void 0&&(e={}),this.displayMode=void 0,this.output=void 0,this.leqno=void 0,this.fleqn=void 0,this.throwOnError=void 0,this.errorColor=void 0,this.macros=void 0,this.minRuleThickness=void 0,this.colorIsTextColor=void 0,this.strict=void 0,this.trust=void 0,this.maxSize=void 0,this.maxExpand=void 0,this.globalGroup=void 0,e=e||{};for(var t of Object.keys(hh)){var n=hh[t];n&&Dg(this,t,e,n)}}reportNonstrict(e,t,n){var r=this.strict;if(typeof r=="function"&&(r=r(e,t,n)),!(!r||r==="ignore")){if(r===!0||r==="error")throw new fe("LaTeX-incompatible input and strict mode is set to 'error': "+(t+" ["+e+"]"),n);r==="warn"?typeof console<"u"&&console.warn("LaTeX-incompatible input and strict mode is set to 'warn': "+(t+" ["+e+"]")):typeof console<"u"&&console.warn("LaTeX-incompatible input and strict mode is set to "+("unrecognized '"+r+"': "+t+" ["+e+"]"))}}useStrictBehavior(e,t,n){var r=this.strict;if(typeof r=="function")try{r=r(e,t,n)}catch{r="error"}return!r||r==="ignore"?!1:r===!0||r==="error"?!0:r==="warn"?(typeof console<"u"&&console.warn("LaTeX-incompatible input and strict mode is set to 'warn': "+(t+" ["+e+"]")),!1):(typeof console<"u"&&console.warn("LaTeX-incompatible input and strict mode is set to "+("unrecognized '"+r+"': "+t+" ["+e+"]")),!1)}isTrusted(e){if("url"in e&&e.url&&!e.protocol){var t=Pg(e.url);if(t==null)return!1;e.protocol=t}var n=typeof this.trust=="function"?this.trust(e):this.trust;return!!n}},Ti=class{constructor(e,t,n){this.id=void 0,this.size=void 0,this.cramped=void 0,this.id=e,this.size=t,this.cramped=n}sup(){return Ai[Ng[this.id]]}sub(){return Ai[Fg[this.id]]}fracNum(){return Ai[Ug[this.id]]}fracDen(){return Ai[Bg[this.id]]}cramp(){return Ai[Og[this.id]]}text(){return Ai[Vg[this.id]]}isTight(){return this.size>=2}},Ih=0,$o=1,gs=2,Wi=3,pa=4,ii=5,xs=6,Ln=7,Ai=[new Ti(Ih,0,!1),new Ti($o,0,!0),new Ti(gs,1,!1),new Ti(Wi,1,!0),new Ti(pa,2,!1),new Ti(ii,2,!0),new Ti(xs,3,!1),new Ti(Ln,3,!0)],Ng=[pa,ii,pa,ii,xs,Ln,xs,Ln],Fg=[ii,ii,ii,ii,Ln,Ln,Ln,Ln],Ug=[gs,Wi,pa,ii,xs,Ln,xs,Ln],Bg=[Wi,Wi,ii,ii,Ln,Ln,Ln,Ln],Og=[$o,$o,Wi,Wi,ii,ii,Ln,Ln],Vg=[Ih,$o,gs,Wi,gs,Wi,gs,Wi],Je={DISPLAY:Ai[Ih],TEXT:Ai[gs],SCRIPT:Ai[pa],SCRIPTSCRIPT:Ai[xs]},uh=[{name:"latin",blocks:[[256,591],[768,879]]},{name:"cyrillic",blocks:[[1024,1279]]},{name:"armenian",blocks:[[1328,1423]]},{name:"brahmic",blocks:[[2304,4255]]},{name:"georgian",blocks:[[4256,4351]]},{name:"cjk",blocks:[[12288,12543],[19968,40879],[65280,65376]]},{name:"hangul",blocks:[[44032,55215]]}];function Hg(i){for(var e=0;e<uh.length;e++)for(var t=uh[e],n=0;n<t.blocks.length;n++){var r=t.blocks[n];if(i>=r[0]&&i<=r[1])return t.name}return null}var Xo=[];uh.forEach(i=>i.blocks.forEach(e=>Xo.push(...e)));function Hf(i){for(var e=0;e<Xo.length;e+=2)if(i>=Xo[e]&&i<=Xo[e+1])return!0;return!1}var dn=i=>i+" "+i,ms=80,Gg=function(e,t){return"M95,"+(622+e+t)+`
c-2.7,0,-7.17,-2.7,-13.5,-8c-5.8,-5.3,-9.5,-10,-9.5,-14
c0,-2,0.3,-3.3,1,-4c1.3,-2.7,23.83,-20.7,67.5,-54
c44.2,-33.3,65.8,-50.3,66.5,-51c1.3,-1.3,3,-2,5,-2c4.7,0,8.7,3.3,12,10
s173,378,173,378c0.7,0,35.3,-71,104,-213c68.7,-142,137.5,-285,206.5,-429
c69,-144,104.5,-217.7,106.5,-221
l`+e/2.075+" -"+e+`
c5.3,-9.3,12,-14,20,-14
H400000v`+(40+e)+`H845.2724
s-225.272,467,-225.272,467s-235,486,-235,486c-2.7,4.7,-9,7,-19,7
c-6,0,-10,-1,-12,-3s-194,-422,-194,-422s-65,47,-65,47z
M`+(834+e)+" "+t+"h400000v"+(40+e)+"h-400000z"},Wg=function(e,t){return"M263,"+(601+e+t)+`c0.7,0,18,39.7,52,119
c34,79.3,68.167,158.7,102.5,238c34.3,79.3,51.8,119.3,52.5,120
c340,-704.7,510.7,-1060.3,512,-1067
l`+e/2.084+" -"+e+`
c4.7,-7.3,11,-11,19,-11
H40000v`+(40+e)+`H1012.3
s-271.3,567,-271.3,567c-38.7,80.7,-84,175,-136,283c-52,108,-89.167,185.3,-111.5,232
c-22.3,46.7,-33.8,70.3,-34.5,71c-4.7,4.7,-12.3,7,-23,7s-12,-1,-12,-1
s-109,-253,-109,-253c-72.7,-168,-109.3,-252,-110,-252c-10.7,8,-22,16.7,-34,26
c-22,17.3,-33.3,26,-34,26s-26,-26,-26,-26s76,-59,76,-59s76,-60,76,-60z
M`+(1001+e)+" "+t+"h400000v"+(40+e)+"h-400000z"},qg=function(e,t){return"M983 "+(10+e+t)+`
l`+e/3.13+" -"+e+`
c4,-6.7,10,-10,18,-10 H400000v`+(40+e)+`
H1013.1s-83.4,268,-264.1,840c-180.7,572,-277,876.3,-289,913c-4.7,4.7,-12.7,7,-24,7
s-12,0,-12,0c-1.3,-3.3,-3.7,-11.7,-7,-25c-35.3,-125.3,-106.7,-373.3,-214,-744
c-10,12,-21,25,-33,39s-32,39,-32,39c-6,-5.3,-15,-14,-27,-26s25,-30,25,-30
c26.7,-32.7,52,-63,76,-91s52,-60,52,-60s208,722,208,722
c56,-175.3,126.3,-397.3,211,-666c84.7,-268.7,153.8,-488.2,207.5,-658.5
c53.7,-170.3,84.5,-266.8,92.5,-289.5z
M`+(1001+e)+" "+t+"h400000v"+(40+e)+"h-400000z"},Xg=function(e,t){return"M424,"+(2398+e+t)+`
c-1.3,-0.7,-38.5,-172,-111.5,-514c-73,-342,-109.8,-513.3,-110.5,-514
c0,-2,-10.7,14.3,-32,49c-4.7,7.3,-9.8,15.7,-15.5,25c-5.7,9.3,-9.8,16,-12.5,20
s-5,7,-5,7c-4,-3.3,-8.3,-7.7,-13,-13s-13,-13,-13,-13s76,-122,76,-122s77,-121,77,-121
s209,968,209,968c0,-2,84.7,-361.7,254,-1079c169.3,-717.3,254.7,-1077.7,256,-1081
l`+e/4.223+" -"+e+`c4,-6.7,10,-10,18,-10 H400000
v`+(40+e)+`H1014.6
s-87.3,378.7,-272.6,1166c-185.3,787.3,-279.3,1182.3,-282,1185
c-2,6,-10,9,-24,9
c-8,0,-12,-0.7,-12,-2z M`+(1001+e)+" "+t+`
h400000v`+(40+e)+"h-400000z"},$g=function(e,t){return"M473,"+(2713+e+t)+`
c339.3,-1799.3,509.3,-2700,510,-2702 l`+e/5.298+" -"+e+`
c3.3,-7.3,9.3,-11,18,-11 H400000v`+(40+e)+`H1017.7
s-90.5,478,-276.2,1466c-185.7,988,-279.5,1483,-281.5,1485c-2,6,-10,9,-24,9
c-8,0,-12,-0.7,-12,-2c0,-1.3,-5.3,-32,-16,-92c-50.7,-293.3,-119.7,-693.3,-207,-1200
c0,-1.3,-5.3,8.7,-16,30c-10.7,21.3,-21.3,42.7,-32,64s-16,33,-16,33s-26,-26,-26,-26
s76,-153,76,-153s77,-151,77,-151c0.7,0.7,35.7,202,105,604c67.3,400.7,102,602.7,104,
606zM`+(1001+e)+" "+t+"h400000v"+(40+e)+"H1017.7z"},Yg=function(e){var t=e/2;return"M400000 "+e+" H0 L"+t+" 0 l65 45 L145 "+(e-80)+" H400000z"},Kg=function(e,t,n){var r=n-54-t-e;return"M702 "+(e+t)+"H400000"+(40+e)+`
H742v`+r+`l-4 4-4 4c-.667.7 -2 1.5-4 2.5s-4.167 1.833-6.5 2.5-5.5 1-9.5 1
h-12l-28-84c-16.667-52-96.667 -294.333-240-727l-212 -643 -85 170
c-4-3.333-8.333-7.667-13 -13l-13-13l77-155 77-156c66 199.333 139 419.667
219 661 l218 661zM702 `+t+"H400000v"+(40+e)+"H742z"},Zg=function(e,t,n){t=1e3*t;var r="";switch(e){case"sqrtMain":r=Gg(t,ms);break;case"sqrtSize1":r=Wg(t,ms);break;case"sqrtSize2":r=qg(t,ms);break;case"sqrtSize3":r=Xg(t,ms);break;case"sqrtSize4":r=$g(t,ms);break;case"sqrtTall":r=Kg(t,ms,n)}return r},Jg=function(e,t){switch(e){case"⎜":return dn("M291 0 H417 V"+t+" H291z");case"∣":return dn("M145 0 H188 V"+t+" H145z");case"∥":return dn("M145 0 H188 V"+t+" H145z")+dn("M367 0 H410 V"+t+" H367z");case"⎟":return dn("M457 0 H583 V"+t+" H457z");case"⎢":return dn("M319 0 H403 V"+t+" H319z");case"⎥":return dn("M263 0 H347 V"+t+" H263z");case"⎪":return dn("M384 0 H504 V"+t+" H384z");case"⏐":return dn("M312 0 H355 V"+t+" H312z");case"‖":return dn("M257 0 H300 V"+t+" H257z")+dn("M478 0 H521 V"+t+" H478z");default:return""}},sf={doubleleftarrow:`M262 157
l10-10c34-36 62.7-77 86-123 3.3-8 5-13.3 5-16 0-5.3-6.7-8-20-8-7.3
 0-12.2.5-14.5 1.5-2.3 1-4.8 4.5-7.5 10.5-49.3 97.3-121.7 169.3-217 216-28
 14-57.3 25-88 33-6.7 2-11 3.8-13 5.5-2 1.7-3 4.2-3 7.5s1 5.8 3 7.5
c2 1.7 6.3 3.5 13 5.5 68 17.3 128.2 47.8 180.5 91.5 52.3 43.7 93.8 96.2 124.5
 157.5 9.3 8 15.3 12.3 18 13h6c12-.7 18-4 18-10 0-2-1.7-7-5-15-23.3-46-52-87
-86-123l-10-10h399738v-40H218c328 0 0 0 0 0l-10-8c-26.7-20-65.7-43-117-69 2.7
-2 6-3.7 10-5 36.7-16 72.3-37.3 107-64l10-8h399782v-40z
m8 0v40h399730v-40zm0 194v40h399730v-40z`,doublerightarrow:`M399738 392l
-10 10c-34 36-62.7 77-86 123-3.3 8-5 13.3-5 16 0 5.3 6.7 8 20 8 7.3 0 12.2-.5
 14.5-1.5 2.3-1 4.8-4.5 7.5-10.5 49.3-97.3 121.7-169.3 217-216 28-14 57.3-25 88
-33 6.7-2 11-3.8 13-5.5 2-1.7 3-4.2 3-7.5s-1-5.8-3-7.5c-2-1.7-6.3-3.5-13-5.5-68
-17.3-128.2-47.8-180.5-91.5-52.3-43.7-93.8-96.2-124.5-157.5-9.3-8-15.3-12.3-18
-13h-6c-12 .7-18 4-18 10 0 2 1.7 7 5 15 23.3 46 52 87 86 123l10 10H0v40h399782
c-328 0 0 0 0 0l10 8c26.7 20 65.7 43 117 69-2.7 2-6 3.7-10 5-36.7 16-72.3 37.3
-107 64l-10 8H0v40zM0 157v40h399730v-40zm0 194v40h399730v-40z`,leftarrow:`M400000 241H110l3-3c68.7-52.7 113.7-120
 135-202 4-14.7 6-23 6-25 0-7.3-7-11-21-11-8 0-13.2.8-15.5 2.5-2.3 1.7-4.2 5.8
-5.5 12.5-1.3 4.7-2.7 10.3-4 17-12 48.7-34.8 92-68.5 130S65.3 228.3 18 247
c-10 4-16 7.7-18 11 0 8.7 6 14.3 18 17 47.3 18.7 87.8 47 121.5 85S196 441.3 208
 490c.7 2 1.3 5 2 9s1.2 6.7 1.5 8c.3 1.3 1 3.3 2 6s2.2 4.5 3.5 5.5c1.3 1 3.3
 1.8 6 2.5s6 1 10 1c14 0 21-3.7 21-11 0-2-2-10.3-6-25-20-79.3-65-146.7-135-202
 l-3-3h399890zM100 241v40h399900v-40z`,leftbrace:`M6 548l-6-6v-35l6-11c56-104 135.3-181.3 238-232 57.3-28.7 117
-45 179-50h399577v120H403c-43.3 7-81 15-113 26-100.7 33-179.7 91-237 174-2.7
 5-6 9-10 13-.7 1-7.3 1-20 1H6z`,leftbraceunder:`M0 6l6-6h17c12.688 0 19.313.3 20 1 4 4 7.313 8.3 10 13
 35.313 51.3 80.813 93.8 136.5 127.5 55.688 33.7 117.188 55.8 184.5 66.5.688
 0 2 .3 4 1 18.688 2.7 76 4.3 172 5h399450v120H429l-6-1c-124.688-8-235-61.7
-331-161C60.687 138.7 32.312 99.3 7 54L0 41V6z`,leftgroup:`M400000 80
H435C64 80 168.3 229.4 21 260c-5.9 1.2-18 0-18 0-2 0-3-1-3-3v-38C76 61 257 0
 435 0h399565z`,leftgroupunder:`M400000 262
H435C64 262 168.3 112.6 21 82c-5.9-1.2-18 0-18 0-2 0-3 1-3 3v38c76 158 257 219
 435 219h399565z`,leftharpoon:`M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3
-3.3 10.2-9.5 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5
-18.3 3-21-1.3-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7
-196 228-6.7 4.7-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40z`,leftharpoonplus:`M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3-3.3 10.2-9.5
 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5-18.3 3-21-1.3
-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7-196 228-6.7 4.7
-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40zM0 435v40h400000v-40z
m0 0v40h400000v-40z`,leftharpoondown:`M7 241c-4 4-6.333 8.667-7 14 0 5.333.667 9 2 11s5.333
 5.333 12 10c90.667 54 156 130 196 228 3.333 10.667 6.333 16.333 9 17 2 .667 5
 1 9 1h5c10.667 0 16.667-2 18-6 2-2.667 1-9.667-3-21-32-87.333-82.667-157.667
-152-211l-3-3h399907v-40zM93 281 H400000 v-40L7 241z`,leftharpoondownplus:`M7 435c-4 4-6.3 8.7-7 14 0 5.3.7 9 2 11s5.3 5.3 12
 10c90.7 54 156 130 196 228 3.3 10.7 6.3 16.3 9 17 2 .7 5 1 9 1h5c10.7 0 16.7
-2 18-6 2-2.7 1-9.7-3-21-32-87.3-82.7-157.7-152-211l-3-3h399907v-40H7zm93 0
v40h399900v-40zM0 241v40h399900v-40zm0 0v40h399900v-40z`,lefthook:`M400000 281 H103s-33-11.2-61-33.5S0 197.3 0 164s14.2-61.2 42.5
-83.5C70.8 58.2 104 47 142 47 c16.7 0 25 6.7 25 20 0 12-8.7 18.7-26 20-40 3.3
-68.7 15.7-86 37-10 12-15 25.3-15 40 0 22.7 9.8 40.7 29.5 54 19.7 13.3 43.5 21
 71.5 23h399859zM103 281v-40h399897v40z`,leftlinesegment:dn("M40 281 V428 H0 V94 H40 V241 H400000 v40z"),leftbracketunder:dn("M0 0 h120 V290 H399995 v120 H0z"),leftbracketover:dn("M0 440 h120 V150 H399995 v-120 H0z"),leftmapsto:dn("M40 281 V448H0V74H40V241H400000v40z"),leftToFrom:`M0 147h400000v40H0zm0 214c68 40 115.7 95.7 143 167h22c15.3 0 23
-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69-70-101l-7-8h399905v-40H95l7-8
c28.7-32 52-65.7 70-101 10.7-23.3 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 265.3
 68 321 0 361zm0-174v-40h399900v40zm100 154v40h399900v-40z`,longequal:dn("M0 50 h400000 v40H0z m0 194h40000v40H0z"),midbrace:`M200428 334
c-100.7-8.3-195.3-44-280-108-55.3-42-101.7-93-139-153l-9-14c-2.7 4-5.7 8.7-9 14
-53.3 86.7-123.7 153-211 199-66.7 36-137.3 56.3-212 62H0V214h199568c178.3-11.7
 311.7-78.3 403-201 6-8 9.7-12 11-12 .7-.7 6.7-1 18-1s17.3.3 18 1c1.3 0 5 4 11
 12 44.7 59.3 101.3 106.3 170 141s145.3 54.3 229 60h199572v120z`,midbraceunder:`M199572 214
c100.7 8.3 195.3 44 280 108 55.3 42 101.7 93 139 153l9 14c2.7-4 5.7-8.7 9-14
 53.3-86.7 123.7-153 211-199 66.7-36 137.3-56.3 212-62h199568v120H200432c-178.3
 11.7-311.7 78.3-403 201-6 8-9.7 12-11 12-.7.7-6.7 1-18 1s-17.3-.3-18-1c-1.3 0
-5-4-11-12-44.7-59.3-101.3-106.3-170-141s-145.3-54.3-229-60H0V214z`,oiintSize1:`M512.6 71.6c272.6 0 320.3 106.8 320.3 178.2 0 70.8-47.7 177.6
-320.3 177.6S193.1 320.6 193.1 249.8c0-71.4 46.9-178.2 319.5-178.2z
m368.1 178.2c0-86.4-60.9-215.4-368.1-215.4-306.4 0-367.3 129-367.3 215.4 0 85.8
60.9 214.8 367.3 214.8 307.2 0 368.1-129 368.1-214.8z`,oiintSize2:`M757.8 100.1c384.7 0 451.1 137.6 451.1 230 0 91.3-66.4 228.8
-451.1 228.8-386.3 0-452.7-137.5-452.7-228.8 0-92.4 66.4-230 452.7-230z
m502.4 230c0-111.2-82.4-277.2-502.4-277.2s-504 166-504 277.2
c0 110 84 276 504 276s502.4-166 502.4-276z`,oiiintSize1:`M681.4 71.6c408.9 0 480.5 106.8 480.5 178.2 0 70.8-71.6 177.6
-480.5 177.6S202.1 320.6 202.1 249.8c0-71.4 70.5-178.2 479.3-178.2z
m525.8 178.2c0-86.4-86.8-215.4-525.7-215.4-437.9 0-524.7 129-524.7 215.4 0
85.8 86.8 214.8 524.7 214.8 438.9 0 525.7-129 525.7-214.8z`,oiiintSize2:`M1021.2 53c603.6 0 707.8 165.8 707.8 277.2 0 110-104.2 275.8
-707.8 275.8-606 0-710.2-165.8-710.2-275.8C311 218.8 415.2 53 1021.2 53z
m770.4 277.1c0-131.2-126.4-327.6-770.5-327.6S248.4 198.9 248.4 330.1
c0 130 128.8 326.4 772.7 326.4s770.5-196.4 770.5-326.4z`,rightarrow:`M0 241v40h399891c-47.3 35.3-84 78-110 128
-16.7 32-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20
 11 8 0 13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7
 39-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85
-40.5-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5
-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67
 151.7 139 205zm0 0v40h399900v-40z`,rightbrace:`M400000 542l
-6 6h-17c-12.7 0-19.3-.3-20-1-4-4-7.3-8.3-10-13-35.3-51.3-80.8-93.8-136.5-127.5
s-117.2-55.8-184.5-66.5c-.7 0-2-.3-4-1-18.7-2.7-76-4.3-172-5H0V214h399571l6 1
c124.7 8 235 61.7 331 161 31.3 33.3 59.7 72.7 85 118l7 13v35z`,rightbraceunder:`M399994 0l6 6v35l-6 11c-56 104-135.3 181.3-238 232-57.3
 28.7-117 45-179 50H-300V214h399897c43.3-7 81-15 113-26 100.7-33 179.7-91 237
-174 2.7-5 6-9 10-13 .7-1 7.3-1 20-1h17z`,rightgroup:`M0 80h399565c371 0 266.7 149.4 414 180 5.9 1.2 18 0 18 0 2 0
 3-1 3-3v-38c-76-158-257-219-435-219H0z`,rightgroupunder:`M0 262h399565c371 0 266.7-149.4 414-180 5.9-1.2 18 0 18
 0 2 0 3 1 3 3v38c-76 158-257 219-435 219H0z`,rightharpoon:`M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3
-3.7-15.3-11-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2
-10.7 0-16.7 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58
 69.2 92 94.5zm0 0v40h399900v-40z`,rightharpoonplus:`M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3-3.7-15.3-11
-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2-10.7 0-16.7
 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58 69.2 92 94.5z
m0 0v40h399900v-40z m100 194v40h399900v-40zm0 0v40h399900v-40z`,rightharpoondown:`M399747 511c0 7.3 6.7 11 20 11 8 0 13-.8 15-2.5s4.7-6.8
 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3 8.5-5.8 9.5
-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3-64.7 57-92 95
-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 241v40h399900v-40z`,rightharpoondownplus:`M399747 705c0 7.3 6.7 11 20 11 8 0 13-.8
 15-2.5s4.7-6.8 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3
 8.5-5.8 9.5-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3
-64.7 57-92 95-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 435v40h399900v-40z
m0-194v40h400000v-40zm0 0v40h400000v-40z`,righthook:`M399859 241c-764 0 0 0 0 0 40-3.3 68.7-15.7 86-37 10-12 15-25.3
 15-40 0-22.7-9.8-40.7-29.5-54-19.7-13.3-43.5-21-71.5-23-17.3-1.3-26-8-26-20 0
-13.3 8.7-20 26-20 38 0 71 11.2 99 33.5 0 0 7 5.6 21 16.7 14 11.2 21 33.5 21
 66.8s-14 61.2-42 83.5c-28 22.3-61 33.5-99 33.5L0 241z M0 281v-40h399859v40z`,rightlinesegment:dn("M399960 241 V94 h40 V428 h-40 V281 H0 v-40z"),rightbracketunder:dn("M399995 0 h-120 V290 H0 v120 H400000z"),rightbracketover:dn("M399995 440 h-120 V150 H0 v-120 H399995z"),rightToFrom:`M400000 167c-70.7-42-118-97.7-142-167h-23c-15.3 0-23 .3-23
 1 0 1.3 5.3 13.7 16 37 18 35.3 41.3 69 70 101l7 8H0v40h399905l-7 8c-28.7 32
-52 65.7-70 101-10.7 23.3-16 35.7-16 37 0 .7 7.7 1 23 1h23c24-69.3 71.3-125 142
-167z M100 147v40h399900v-40zM0 341v40h399900v-40z`,twoheadleftarrow:`M0 167c68 40
 115.7 95.7 143 167h22c15.3 0 23-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69
-70-101l-7-8h125l9 7c50.7 39.3 85 86 103 140h46c0-4.7-6.3-18.7-19-42-18-35.3
-40-67.3-66-96l-9-9h399716v-40H284l9-9c26-28.7 48-60.7 66-96 12.7-23.333 19
-37.333 19-42h-46c-18 54-52.3 100.7-103 140l-9 7H95l7-8c28.7-32 52-65.7 70-101
 10.7-23.333 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 71.3 68 127 0 167z`,twoheadrightarrow:`M400000 167
c-68-40-115.7-95.7-143-167h-22c-15.3 0-23 .3-23 1 0 1.3 5.3 13.7 16 37 18 35.3
 41.3 69 70 101l7 8h-125l-9-7c-50.7-39.3-85-86-103-140h-46c0 4.7 6.3 18.7 19 42
 18 35.3 40 67.3 66 96l9 9H0v40h399716l-9 9c-26 28.7-48 60.7-66 96-12.7 23.333
-19 37.333-19 42h46c18-54 52.3-100.7 103-140l9-7h125l-7 8c-28.7 32-52 65.7-70
 101-10.7 23.333-16 35.7-16 37 0 .7 7.7 1 23 1h22c27.3-71.3 75-127 143-167z`,tilde1:`M200 55.538c-77 0-168 73.953-177 73.953-3 0-7
-2.175-9-5.437L2 97c-1-2-2-4-2-6 0-4 2-7 5-9l20-12C116 12 171 0 207 0c86 0
 114 68 191 68 78 0 168-68 177-68 4 0 7 2 9 5l12 19c1 2.175 2 4.35 2 6.525 0
 4.35-2 7.613-5 9.788l-19 13.05c-92 63.077-116.937 75.308-183 76.128
-68.267.847-113-73.952-191-73.952z`,tilde2:`M344 55.266c-142 0-300.638 81.316-311.5 86.418
-8.01 3.762-22.5 10.91-23.5 5.562L1 120c-1-2-1-3-1-4 0-5 3-9 8-10l18.4-9C160.9
 31.9 283 0 358 0c148 0 188 122 331 122s314-97 326-97c4 0 8 2 10 7l7 21.114
c1 2.14 1 3.21 1 4.28 0 5.347-3 9.626-7 10.696l-22.3 12.622C852.6 158.372 751
 181.476 676 181.476c-149 0-189-126.21-332-126.21z`,tilde3:`M786 59C457 59 32 175.242 13 175.242c-6 0-10-3.457
-11-10.37L.15 138c-1-7 3-12 10-13l19.2-6.4C378.4 40.7 634.3 0 804.3 0c337 0
 411.8 157 746.8 157 328 0 754-112 773-112 5 0 10 3 11 9l1 14.075c1 8.066-.697
 16.595-6.697 17.492l-21.052 7.31c-367.9 98.146-609.15 122.696-778.15 122.696
 -338 0-409-156.573-744-156.573z`,tilde4:`M786 58C457 58 32 177.487 13 177.487c-6 0-10-3.345
-11-10.035L.15 143c-1-7 3-12 10-13l22-6.7C381.2 35 637.15 0 807.15 0c337 0 409
 177 744 177 328 0 754-127 773-127 5 0 10 3 11 9l1 14.794c1 7.805-3 13.38-9
 14.495l-20.7 5.574c-366.85 99.79-607.3 139.372-776.3 139.372-338 0-409
 -175.236-744-175.236z`,vec:`M377 20c0-5.333 1.833-10 5.5-14S391 0 397 0c4.667 0 8.667 1.667 12 5
3.333 2.667 6.667 9 10 19 6.667 24.667 20.333 43.667 41 57 7.333 4.667 11
10.667 11 18 0 6-1 10-3 12s-6.667 5-14 9c-28.667 14.667-53.667 35.667-75 63
-1.333 1.333-3.167 3.5-5.5 6.5s-4 4.833-5 5.5c-1 .667-2.5 1.333-4.5 2s-4.333 1
-7 1c-4.667 0-9.167-1.833-13.5-5.5S337 184 337 178c0-12.667 15.667-32.333 47-59
H213l-171-1c-8.667-6-13-12.333-13-19 0-4.667 4.333-11.333 13-20h359
c-16-25.333-24-45-24-59z`,widehat1:`M529 0h5l519 115c5 1 9 5 9 10 0 1-1 2-1 3l-4 22
c-1 5-5 9-11 9h-2L532 67 19 159h-2c-5 0-9-4-11-9l-5-22c-1-6 2-12 8-13z`,widehat2:`M1181 0h2l1171 176c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 220h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`,widehat3:`M1181 0h2l1171 236c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 280h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`,widehat4:`M1181 0h2l1171 296c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 340h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`,widecheck1:`M529,159h5l519,-115c5,-1,9,-5,9,-10c0,-1,-1,-2,-1,-3l-4,-22c-1,
-5,-5,-9,-11,-9h-2l-512,92l-513,-92h-2c-5,0,-9,4,-11,9l-5,22c-1,6,2,12,8,13z`,widecheck2:`M1181,220h2l1171,-176c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,153l-1167,-153h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`,widecheck3:`M1181,280h2l1171,-236c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,213l-1167,-213h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`,widecheck4:`M1181,340h2l1171,-296c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,273l-1167,-273h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`,baraboveleftarrow:`M400000 620h-399890l3 -3c68.7 -52.7 113.7 -120 135 -202
c4 -14.7 6 -23 6 -25c0 -7.3 -7 -11 -21 -11c-8 0 -13.2 0.8 -15.5 2.5
c-2.3 1.7 -4.2 5.8 -5.5 12.5c-1.3 4.7 -2.7 10.3 -4 17c-12 48.7 -34.8 92 -68.5 130
s-74.2 66.3 -121.5 85c-10 4 -16 7.7 -18 11c0 8.7 6 14.3 18 17c47.3 18.7 87.8 47
121.5 85s56.5 81.3 68.5 130c0.7 2 1.3 5 2 9s1.2 6.7 1.5 8c0.3 1.3 1 3.3 2 6
s2.2 4.5 3.5 5.5c1.3 1 3.3 1.8 6 2.5s6 1 10 1c14 0 21 -3.7 21 -11
c0 -2 -2 -10.3 -6 -25c-20 -79.3 -65 -146.7 -135 -202l-3 -3h399890z
M100 620v40h399900v-40z M0 241v40h399900v-40zM0 241v40h399900v-40z`,rightarrowabovebar:`M0 241v40h399891c-47.3 35.3-84 78-110 128-16.7 32
-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20 11 8 0
13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7 39
-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85-40.5
-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5
-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67
151.7 139 205zm96 379h399894v40H0zm0 0h399904v40H0z`,baraboveshortleftharpoon:`M507,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11
c1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17
c2,0.7,5,1,9,1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21
c-32,-87.3,-82.7,-157.7,-152,-211c0,0,-3,-3,-3,-3l399351,0l0,-40
c-398570,0,-399437,0,-399437,0z M593 435 v40 H399500 v-40z
M0 281 v-40 H399908 v40z M0 281 v-40 H399908 v40z`,rightharpoonaboveshortbar:`M0,241 l0,40c399126,0,399993,0,399993,0
c4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,
-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6
c-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z
M0 241 v40 H399908 v-40z M0 475 v-40 H399500 v40z M0 475 v-40 H399500 v40z`,shortbaraboveleftharpoon:`M7,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11
c1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17c2,0.7,5,1,9,
1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21c-32,-87.3,-82.7,-157.7,
-152,-211c0,0,-3,-3,-3,-3l399907,0l0,-40c-399126,0,-399993,0,-399993,0z
M93 435 v40 H400000 v-40z M500 241 v40 H400000 v-40z M500 241 v40 H400000 v-40z`,shortrightharpoonabovebar:`M53,241l0,40c398570,0,399437,0,399437,0
c4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,
-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6
c-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z
M500 241 v40 H399408 v-40z M500 435 v40 H400000 v-40z`},jg=function(e,t){switch(e){case"lbrack":return"M403 1759 V84 H666 V0 H319 V1759 v"+t+` v1759 v84 h347 v-84
H403z M403 1759 V0 H319 V1759 v`+t+" v1759 v84 h84z";case"rbrack":return"M347 1759 V0 H0 V84 H263 V1759 v"+t+` v1759 H0 v84 H347z
M347 1759 V0 H263 V1759 v`+t+" v1759 h84z";case"vert":return"M145 15 v585 v"+t+` v585 c2.667,10,9.667,15,21,15
c10,0,16.667,-5,20,-15 v-585 v`+-t+` v-585 c-2.667,-10,-9.667,-15,-21,-15
c-10,0,-16.667,5,-20,15z M188 15 H145 v585 v`+t+" v585 h43z";case"doublevert":return"M145 15 v585 v"+t+` v585 c2.667,10,9.667,15,21,15
c10,0,16.667,-5,20,-15 v-585 v`+-t+` v-585 c-2.667,-10,-9.667,-15,-21,-15
c-10,0,-16.667,5,-20,15z M188 15 H145 v585 v`+t+` v585 h43z
M367 15 v585 v`+t+` v585 c2.667,10,9.667,15,21,15
c10,0,16.667,-5,20,-15 v-585 v`+-t+` v-585 c-2.667,-10,-9.667,-15,-21,-15
c-10,0,-16.667,5,-20,15z M410 15 H367 v585 v`+t+" v585 h43z";case"lfloor":return"M319 602 V0 H403 V602 v"+t+` v1715 h263 v84 H319z
MM319 602 V0 H403 V602 v`+t+" v1715 H319z";case"rfloor":return"M319 602 V0 H403 V602 v"+t+` v1799 H0 v-84 H319z
MM319 602 V0 H403 V602 v`+t+" v1715 H319z";case"lceil":return"M403 1759 V84 H666 V0 H319 V1759 v"+t+` v602 h84z
M403 1759 V0 H319 V1759 v`+t+" v602 h84z";case"rceil":return"M347 1759 V0 H0 V84 H263 V1759 v"+t+` v602 h84z
M347 1759 V0 h-84 V1759 v`+t+" v602 h84z";case"lparen":return`M863,9c0,-2,-2,-5,-6,-9c0,0,-17,0,-17,0c-12.7,0,-19.3,0.3,-20,1
c-5.3,5.3,-10.3,11,-15,17c-242.7,294.7,-395.3,682,-458,1162c-21.3,163.3,-33.3,349,
-36,557 l0,`+(t+84)+`c0.2,6,0,26,0,60c2,159.3,10,310.7,24,454c53.3,528,210,
949.7,470,1265c4.7,6,9.7,11.7,15,17c0.7,0.7,7,1,19,1c0,0,18,0,18,0c4,-4,6,-7,6,-9
c0,-2.7,-3.3,-8.7,-10,-18c-135.3,-192.7,-235.5,-414.3,-300.5,-665c-65,-250.7,-102.5,
-544.7,-112.5,-882c-2,-104,-3,-167,-3,-189
l0,-`+(t+92)+`c0,-162.7,5.7,-314,17,-454c20.7,-272,63.7,-513,129,-723c65.3,
-210,155.3,-396.3,270,-559c6.7,-9.3,10,-15.3,10,-18z`;case"rparen":return`M76,0c-16.7,0,-25,3,-25,9c0,2,2,6.3,6,13c21.3,28.7,42.3,60.3,
63,95c96.7,156.7,172.8,332.5,228.5,527.5c55.7,195,92.8,416.5,111.5,664.5
c11.3,139.3,17,290.7,17,454c0,28,1.7,43,3.3,45l0,`+(t+9)+`
c-3,4,-3.3,16.7,-3.3,38c0,162,-5.7,313.7,-17,455c-18.7,248,-55.8,469.3,-111.5,664
c-55.7,194.7,-131.8,370.3,-228.5,527c-20.7,34.7,-41.7,66.3,-63,95c-2,3.3,-4,7,-6,11
c0,7.3,5.7,11,17,11c0,0,11,0,11,0c9.3,0,14.3,-0.3,15,-1c5.3,-5.3,10.3,-11,15,-17
c242.7,-294.7,395.3,-681.7,458,-1161c21.3,-164.7,33.3,-350.7,36,-558
l0,-`+(t+144)+`c-2,-159.3,-10,-310.7,-24,-454c-53.3,-528,-210,-949.7,
-470,-1265c-4.7,-6,-9.7,-11.7,-15,-17c-0.7,-0.7,-6.7,-1,-18,-1z`;default:throw new Error("Unknown stretchy delimiter.")}};function Qg(i){return"toText"in i}var gr=class{constructor(e){this.children=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.maxFontSize=void 0,this.style=void 0,this.children=e,this.classes=[],this.height=0,this.depth=0,this.maxFontSize=0,this.style={}}hasClass(e){return this.classes.includes(e)}toNode(){for(var e=document.createDocumentFragment(),t=0;t<this.children.length;t++)e.appendChild(this.children[t].toNode());return e}toMarkup(){for(var e="",t=0;t<this.children.length;t++)e+=this.children[t].toMarkup();return e}toText(){return this.children.map(e=>{if(Qg(e))return e.toText();throw new Error("Expected MathDomNode with toText, got "+e.constructor.name)}).join("")}},dh={pt:1,mm:7227/2540,cm:7227/254,in:72.27,bp:803/800,pc:12,dd:1238/1157,cc:14856/1157,nd:685/642,nc:1370/107,sp:1/65536,px:803/800},ex={ex:!0,em:!0,mu:!0},Gf=function(e){return typeof e!="string"&&(e=e.unit),e in dh||e in ex||e==="ex"},Wt=function(e,t){var n;if(e.unit in dh)n=dh[e.unit]/t.fontMetrics().ptPerEm/t.sizeMultiplier;else if(e.unit==="mu")n=t.fontMetrics().cssEmPerMu;else{var r;if(t.style.isTight()?r=t.havingStyle(t.style.text()):r=t,e.unit==="ex")n=r.fontMetrics().xHeight;else if(e.unit==="em")n=r.fontMetrics().quad;else throw new fe("Invalid unit: '"+e.unit+"'");r!==t&&(n*=r.sizeMultiplier/t.sizeMultiplier)}return Math.min(e.number*n,t.maxSize)},me=function(e){return+e.toFixed(4)+"em"},xr=function(e){return e.filter(t=>t).join(" ")},Ph=function(e){var t="";for(var n of Object.keys(e)){var r=e[n];r!==void 0&&(t+=Cg(n)+":"+r+";")}return t},Wf=function(e,t,n){if(this.classes=e||[],this.attributes={},this.height=0,this.depth=0,this.maxFontSize=0,this.style=n||{},t){t.style.isTight()&&this.classes.push("mtight");var r=t.getColor();r&&(this.style.color=r)}},qf=function(e){var t=document.createElement(e);t.className=xr(this.classes),Object.assign(t.style,this.style);for(var n of Object.keys(this.attributes))t.setAttribute(n,this.attributes[n]);for(var r=0;r<this.children.length;r++)t.appendChild(this.children[r].toNode());return t},tx=/[\s"'>/=\x00-\x1f]/,Xf=function(e){var t="<"+e;this.classes.length&&(t+=' class="'+An(xr(this.classes))+'"');var n=Ph(this.style);n&&(t+=' style="'+An(n)+'"');for(var r of Object.keys(this.attributes)){if(tx.test(r))throw new fe("Invalid attribute name '"+r+"'");t+=" "+r+'="'+An(this.attributes[r])+'"'}t+=">";for(var s=0;s<this.children.length;s++)t+=this.children[s].toMarkup();return t+="</"+e+">",t},vr=class{constructor(e,t,n,r){this.children=void 0,this.attributes=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.width=void 0,this.maxFontSize=void 0,this.style=void 0,this.italic=void 0,Wf.call(this,e,n,r),this.children=t||[]}setAttribute(e,t){this.attributes[e]=t}hasClass(e){return this.classes.includes(e)}toNode(){return qf.call(this,"span")}toMarkup(){return Xf.call(this,"span")}},vs=class{constructor(e,t,n,r){this.children=void 0,this.attributes=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.maxFontSize=void 0,this.style=void 0,Wf.call(this,t,r),this.children=n||[],this.setAttribute("href",e)}setAttribute(e,t){this.attributes[e]=t}hasClass(e){return this.classes.includes(e)}toNode(){return qf.call(this,"a")}toMarkup(){return Xf.call(this,"a")}},fh=class{constructor(e,t,n){this.src=void 0,this.alt=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.maxFontSize=void 0,this.style=void 0,this.alt=t,this.src=e,this.classes=["mord"],this.height=0,this.depth=0,this.maxFontSize=0,this.style=n}hasClass(e){return this.classes.includes(e)}toNode(){var e=document.createElement("img");return e.src=this.src,e.alt=this.alt,e.className="mord",Object.assign(e.style,this.style),e}toMarkup(){var e='<img src="'+An(this.src)+'"'+(' alt="'+An(this.alt)+'"'),t=Ph(this.style);return t&&(e+=' style="'+An(t)+'"'),e+="'/>",e}},nx={î:"ı̂",ï:"ı̈",í:"ı́",ì:"ı̀"},Dn=class{constructor(e,t,n,r,s,a,o,l){this.text=void 0,this.height=void 0,this.depth=void 0,this.italic=void 0,this.skew=void 0,this.width=void 0,this.maxFontSize=void 0,this.classes=void 0,this.style=void 0,this.text=e,this.height=t||0,this.depth=n||0,this.italic=r||0,this.skew=s||0,this.width=a||0,this.classes=o||[],this.style=l||{},this.maxFontSize=0;var c=Hg(this.text.charCodeAt(0));c&&this.classes.push(c+"_fallback"),/[îïíì]/.test(this.text)&&(this.text=nx[this.text])}hasClass(e){return this.classes.includes(e)}toNode(){var e=document.createTextNode(this.text),t=null;return this.italic>0&&(t=document.createElement("span"),t.style.marginRight=me(this.italic)),this.classes.length>0&&(t=t||document.createElement("span"),t.className=xr(this.classes)),Object.keys(this.style).length>0&&(t=t||document.createElement("span"),Object.assign(t.style,this.style)),t?(t.appendChild(e),t):e}toMarkup(){var e=!1,t="<span";this.classes.length&&(e=!0,t+=' class="',t+=An(xr(this.classes)),t+='"');var n="";this.italic>0&&(n+="margin-right:"+me(this.italic)+";"),n+=Ph(this.style),n&&(e=!0,t+=' style="'+An(n)+'"');var r=An(this.text);return e?(t+=">",t+=r,t+="</span>",t):r}},ui=class{constructor(e,t){this.children=void 0,this.attributes=void 0,this.children=e||[],this.attributes=t||{}}toNode(){var e="http://www.w3.org/2000/svg",t=document.createElementNS(e,"svg");for(var n of Object.keys(this.attributes))t.setAttribute(n,this.attributes[n]);for(var r=0;r<this.children.length;r++)t.appendChild(this.children[r].toNode());return t}toMarkup(){var e='<svg xmlns="http://www.w3.org/2000/svg"';for(var t of Object.keys(this.attributes))e+=" "+t+'="'+An(this.attributes[t])+'"';e+=">";for(var n=0;n<this.children.length;n++)e+=this.children[n].toMarkup();return e+="</svg>",e}},Ci=class{constructor(e,t){this.pathName=void 0,this.alternate=void 0,this.pathName=e,this.alternate=t}toNode(){var e="http://www.w3.org/2000/svg",t=document.createElementNS(e,"path");return this.alternate?t.setAttribute("d",this.alternate):t.setAttribute("d",sf[this.pathName]),t}toMarkup(){return this.alternate?'<path d="'+An(this.alternate)+'"/>':'<path d="'+An(sf[this.pathName])+'"/>'}},ma=class{constructor(e){this.attributes=void 0,this.attributes=e||{}}toNode(){var e="http://www.w3.org/2000/svg",t=document.createElementNS(e,"line");for(var n of Object.keys(this.attributes))t.setAttribute(n,this.attributes[n]);return t}toMarkup(){var e="<line";for(var t of Object.keys(this.attributes))e+=" "+t+'="'+An(this.attributes[t])+'"';return e+="/>",e}};function ix(i){if(i instanceof Dn)return i;throw new Error("Expected symbolNode but got "+String(i)+".")}function rx(i){if(i instanceof vr)return i;throw new Error("Expected span<HtmlDomNode> but got "+String(i)+".")}var sx=i=>i instanceof vr||i instanceof vs||i instanceof gr,Ei={"AMS-Regular":{32:[0,0,0,0,.25],65:[0,.68889,0,0,.72222],66:[0,.68889,0,0,.66667],67:[0,.68889,0,0,.72222],68:[0,.68889,0,0,.72222],69:[0,.68889,0,0,.66667],70:[0,.68889,0,0,.61111],71:[0,.68889,0,0,.77778],72:[0,.68889,0,0,.77778],73:[0,.68889,0,0,.38889],74:[.16667,.68889,0,0,.5],75:[0,.68889,0,0,.77778],76:[0,.68889,0,0,.66667],77:[0,.68889,0,0,.94445],78:[0,.68889,0,0,.72222],79:[.16667,.68889,0,0,.77778],80:[0,.68889,0,0,.61111],81:[.16667,.68889,0,0,.77778],82:[0,.68889,0,0,.72222],83:[0,.68889,0,0,.55556],84:[0,.68889,0,0,.66667],85:[0,.68889,0,0,.72222],86:[0,.68889,0,0,.72222],87:[0,.68889,0,0,1],88:[0,.68889,0,0,.72222],89:[0,.68889,0,0,.72222],90:[0,.68889,0,0,.66667],107:[0,.68889,0,0,.55556],160:[0,0,0,0,.25],165:[0,.675,.025,0,.75],174:[.15559,.69224,0,0,.94666],240:[0,.68889,0,0,.55556],295:[0,.68889,0,0,.54028],710:[0,.825,0,0,2.33334],732:[0,.9,0,0,2.33334],770:[0,.825,0,0,2.33334],771:[0,.9,0,0,2.33334],989:[.08167,.58167,0,0,.77778],1008:[0,.43056,.04028,0,.66667],8245:[0,.54986,0,0,.275],8463:[0,.68889,0,0,.54028],8487:[0,.68889,0,0,.72222],8498:[0,.68889,0,0,.55556],8502:[0,.68889,0,0,.66667],8503:[0,.68889,0,0,.44445],8504:[0,.68889,0,0,.66667],8513:[0,.68889,0,0,.63889],8592:[-.03598,.46402,0,0,.5],8594:[-.03598,.46402,0,0,.5],8602:[-.13313,.36687,0,0,1],8603:[-.13313,.36687,0,0,1],8606:[.01354,.52239,0,0,1],8608:[.01354,.52239,0,0,1],8610:[.01354,.52239,0,0,1.11111],8611:[.01354,.52239,0,0,1.11111],8619:[0,.54986,0,0,1],8620:[0,.54986,0,0,1],8621:[-.13313,.37788,0,0,1.38889],8622:[-.13313,.36687,0,0,1],8624:[0,.69224,0,0,.5],8625:[0,.69224,0,0,.5],8630:[0,.43056,0,0,1],8631:[0,.43056,0,0,1],8634:[.08198,.58198,0,0,.77778],8635:[.08198,.58198,0,0,.77778],8638:[.19444,.69224,0,0,.41667],8639:[.19444,.69224,0,0,.41667],8642:[.19444,.69224,0,0,.41667],8643:[.19444,.69224,0,0,.41667],8644:[.1808,.675,0,0,1],8646:[.1808,.675,0,0,1],8647:[.1808,.675,0,0,1],8648:[.19444,.69224,0,0,.83334],8649:[.1808,.675,0,0,1],8650:[.19444,.69224,0,0,.83334],8651:[.01354,.52239,0,0,1],8652:[.01354,.52239,0,0,1],8653:[-.13313,.36687,0,0,1],8654:[-.13313,.36687,0,0,1],8655:[-.13313,.36687,0,0,1],8666:[.13667,.63667,0,0,1],8667:[.13667,.63667,0,0,1],8669:[-.13313,.37788,0,0,1],8672:[-.064,.437,0,0,1.334],8674:[-.064,.437,0,0,1.334],8705:[0,.825,0,0,.5],8708:[0,.68889,0,0,.55556],8709:[.08167,.58167,0,0,.77778],8717:[0,.43056,0,0,.42917],8722:[-.03598,.46402,0,0,.5],8724:[.08198,.69224,0,0,.77778],8726:[.08167,.58167,0,0,.77778],8733:[0,.69224,0,0,.77778],8736:[0,.69224,0,0,.72222],8737:[0,.69224,0,0,.72222],8738:[.03517,.52239,0,0,.72222],8739:[.08167,.58167,0,0,.22222],8740:[.25142,.74111,0,0,.27778],8741:[.08167,.58167,0,0,.38889],8742:[.25142,.74111,0,0,.5],8756:[0,.69224,0,0,.66667],8757:[0,.69224,0,0,.66667],8764:[-.13313,.36687,0,0,.77778],8765:[-.13313,.37788,0,0,.77778],8769:[-.13313,.36687,0,0,.77778],8770:[-.03625,.46375,0,0,.77778],8774:[.30274,.79383,0,0,.77778],8776:[-.01688,.48312,0,0,.77778],8778:[.08167,.58167,0,0,.77778],8782:[.06062,.54986,0,0,.77778],8783:[.06062,.54986,0,0,.77778],8785:[.08198,.58198,0,0,.77778],8786:[.08198,.58198,0,0,.77778],8787:[.08198,.58198,0,0,.77778],8790:[0,.69224,0,0,.77778],8791:[.22958,.72958,0,0,.77778],8796:[.08198,.91667,0,0,.77778],8806:[.25583,.75583,0,0,.77778],8807:[.25583,.75583,0,0,.77778],8808:[.25142,.75726,0,0,.77778],8809:[.25142,.75726,0,0,.77778],8812:[.25583,.75583,0,0,.5],8814:[.20576,.70576,0,0,.77778],8815:[.20576,.70576,0,0,.77778],8816:[.30274,.79383,0,0,.77778],8817:[.30274,.79383,0,0,.77778],8818:[.22958,.72958,0,0,.77778],8819:[.22958,.72958,0,0,.77778],8822:[.1808,.675,0,0,.77778],8823:[.1808,.675,0,0,.77778],8828:[.13667,.63667,0,0,.77778],8829:[.13667,.63667,0,0,.77778],8830:[.22958,.72958,0,0,.77778],8831:[.22958,.72958,0,0,.77778],8832:[.20576,.70576,0,0,.77778],8833:[.20576,.70576,0,0,.77778],8840:[.30274,.79383,0,0,.77778],8841:[.30274,.79383,0,0,.77778],8842:[.13597,.63597,0,0,.77778],8843:[.13597,.63597,0,0,.77778],8847:[.03517,.54986,0,0,.77778],8848:[.03517,.54986,0,0,.77778],8858:[.08198,.58198,0,0,.77778],8859:[.08198,.58198,0,0,.77778],8861:[.08198,.58198,0,0,.77778],8862:[0,.675,0,0,.77778],8863:[0,.675,0,0,.77778],8864:[0,.675,0,0,.77778],8865:[0,.675,0,0,.77778],8872:[0,.69224,0,0,.61111],8873:[0,.69224,0,0,.72222],8874:[0,.69224,0,0,.88889],8876:[0,.68889,0,0,.61111],8877:[0,.68889,0,0,.61111],8878:[0,.68889,0,0,.72222],8879:[0,.68889,0,0,.72222],8882:[.03517,.54986,0,0,.77778],8883:[.03517,.54986,0,0,.77778],8884:[.13667,.63667,0,0,.77778],8885:[.13667,.63667,0,0,.77778],8888:[0,.54986,0,0,1.11111],8890:[.19444,.43056,0,0,.55556],8891:[.19444,.69224,0,0,.61111],8892:[.19444,.69224,0,0,.61111],8901:[0,.54986,0,0,.27778],8903:[.08167,.58167,0,0,.77778],8905:[.08167,.58167,0,0,.77778],8906:[.08167,.58167,0,0,.77778],8907:[0,.69224,0,0,.77778],8908:[0,.69224,0,0,.77778],8909:[-.03598,.46402,0,0,.77778],8910:[0,.54986,0,0,.76042],8911:[0,.54986,0,0,.76042],8912:[.03517,.54986,0,0,.77778],8913:[.03517,.54986,0,0,.77778],8914:[0,.54986,0,0,.66667],8915:[0,.54986,0,0,.66667],8916:[0,.69224,0,0,.66667],8918:[.0391,.5391,0,0,.77778],8919:[.0391,.5391,0,0,.77778],8920:[.03517,.54986,0,0,1.33334],8921:[.03517,.54986,0,0,1.33334],8922:[.38569,.88569,0,0,.77778],8923:[.38569,.88569,0,0,.77778],8926:[.13667,.63667,0,0,.77778],8927:[.13667,.63667,0,0,.77778],8928:[.30274,.79383,0,0,.77778],8929:[.30274,.79383,0,0,.77778],8934:[.23222,.74111,0,0,.77778],8935:[.23222,.74111,0,0,.77778],8936:[.23222,.74111,0,0,.77778],8937:[.23222,.74111,0,0,.77778],8938:[.20576,.70576,0,0,.77778],8939:[.20576,.70576,0,0,.77778],8940:[.30274,.79383,0,0,.77778],8941:[.30274,.79383,0,0,.77778],8994:[.19444,.69224,0,0,.77778],8995:[.19444,.69224,0,0,.77778],9416:[.15559,.69224,0,0,.90222],9484:[0,.69224,0,0,.5],9488:[0,.69224,0,0,.5],9492:[0,.37788,0,0,.5],9496:[0,.37788,0,0,.5],9585:[.19444,.68889,0,0,.88889],9586:[.19444,.74111,0,0,.88889],9632:[0,.675,0,0,.77778],9633:[0,.675,0,0,.77778],9650:[0,.54986,0,0,.72222],9651:[0,.54986,0,0,.72222],9654:[.03517,.54986,0,0,.77778],9660:[0,.54986,0,0,.72222],9661:[0,.54986,0,0,.72222],9664:[.03517,.54986,0,0,.77778],9674:[.11111,.69224,0,0,.66667],9733:[.19444,.69224,0,0,.94445],10003:[0,.69224,0,0,.83334],10016:[0,.69224,0,0,.83334],10731:[.11111,.69224,0,0,.66667],10846:[.19444,.75583,0,0,.61111],10877:[.13667,.63667,0,0,.77778],10878:[.13667,.63667,0,0,.77778],10885:[.25583,.75583,0,0,.77778],10886:[.25583,.75583,0,0,.77778],10887:[.13597,.63597,0,0,.77778],10888:[.13597,.63597,0,0,.77778],10889:[.26167,.75726,0,0,.77778],10890:[.26167,.75726,0,0,.77778],10891:[.48256,.98256,0,0,.77778],10892:[.48256,.98256,0,0,.77778],10901:[.13667,.63667,0,0,.77778],10902:[.13667,.63667,0,0,.77778],10933:[.25142,.75726,0,0,.77778],10934:[.25142,.75726,0,0,.77778],10935:[.26167,.75726,0,0,.77778],10936:[.26167,.75726,0,0,.77778],10937:[.26167,.75726,0,0,.77778],10938:[.26167,.75726,0,0,.77778],10949:[.25583,.75583,0,0,.77778],10950:[.25583,.75583,0,0,.77778],10955:[.28481,.79383,0,0,.77778],10956:[.28481,.79383,0,0,.77778],57350:[.08167,.58167,0,0,.22222],57351:[.08167,.58167,0,0,.38889],57352:[.08167,.58167,0,0,.77778],57353:[0,.43056,.04028,0,.66667],57356:[.25142,.75726,0,0,.77778],57357:[.25142,.75726,0,0,.77778],57358:[.41951,.91951,0,0,.77778],57359:[.30274,.79383,0,0,.77778],57360:[.30274,.79383,0,0,.77778],57361:[.41951,.91951,0,0,.77778],57366:[.25142,.75726,0,0,.77778],57367:[.25142,.75726,0,0,.77778],57368:[.25142,.75726,0,0,.77778],57369:[.25142,.75726,0,0,.77778],57370:[.13597,.63597,0,0,.77778],57371:[.13597,.63597,0,0,.77778]},"Caligraphic-Regular":{32:[0,0,0,0,.25],65:[0,.68333,0,.19445,.79847],66:[0,.68333,.03041,.13889,.65681],67:[0,.68333,.05834,.13889,.52653],68:[0,.68333,.02778,.08334,.77139],69:[0,.68333,.08944,.11111,.52778],70:[0,.68333,.09931,.11111,.71875],71:[.09722,.68333,.0593,.11111,.59487],72:[0,.68333,.00965,.11111,.84452],73:[0,.68333,.07382,0,.54452],74:[.09722,.68333,.18472,.16667,.67778],75:[0,.68333,.01445,.05556,.76195],76:[0,.68333,0,.13889,.68972],77:[0,.68333,0,.13889,1.2009],78:[0,.68333,.14736,.08334,.82049],79:[0,.68333,.02778,.11111,.79611],80:[0,.68333,.08222,.08334,.69556],81:[.09722,.68333,0,.11111,.81667],82:[0,.68333,0,.08334,.8475],83:[0,.68333,.075,.13889,.60556],84:[0,.68333,.25417,0,.54464],85:[0,.68333,.09931,.08334,.62583],86:[0,.68333,.08222,0,.61278],87:[0,.68333,.08222,.08334,.98778],88:[0,.68333,.14643,.13889,.7133],89:[.09722,.68333,.08222,.08334,.66834],90:[0,.68333,.07944,.13889,.72473],160:[0,0,0,0,.25]},"Fraktur-Regular":{32:[0,0,0,0,.25],33:[0,.69141,0,0,.29574],34:[0,.69141,0,0,.21471],38:[0,.69141,0,0,.73786],39:[0,.69141,0,0,.21201],40:[.24982,.74947,0,0,.38865],41:[.24982,.74947,0,0,.38865],42:[0,.62119,0,0,.27764],43:[.08319,.58283,0,0,.75623],44:[0,.10803,0,0,.27764],45:[.08319,.58283,0,0,.75623],46:[0,.10803,0,0,.27764],47:[.24982,.74947,0,0,.50181],48:[0,.47534,0,0,.50181],49:[0,.47534,0,0,.50181],50:[0,.47534,0,0,.50181],51:[.18906,.47534,0,0,.50181],52:[.18906,.47534,0,0,.50181],53:[.18906,.47534,0,0,.50181],54:[0,.69141,0,0,.50181],55:[.18906,.47534,0,0,.50181],56:[0,.69141,0,0,.50181],57:[.18906,.47534,0,0,.50181],58:[0,.47534,0,0,.21606],59:[.12604,.47534,0,0,.21606],61:[-.13099,.36866,0,0,.75623],63:[0,.69141,0,0,.36245],65:[0,.69141,0,0,.7176],66:[0,.69141,0,0,.88397],67:[0,.69141,0,0,.61254],68:[0,.69141,0,0,.83158],69:[0,.69141,0,0,.66278],70:[.12604,.69141,0,0,.61119],71:[0,.69141,0,0,.78539],72:[.06302,.69141,0,0,.7203],73:[0,.69141,0,0,.55448],74:[.12604,.69141,0,0,.55231],75:[0,.69141,0,0,.66845],76:[0,.69141,0,0,.66602],77:[0,.69141,0,0,1.04953],78:[0,.69141,0,0,.83212],79:[0,.69141,0,0,.82699],80:[.18906,.69141,0,0,.82753],81:[.03781,.69141,0,0,.82699],82:[0,.69141,0,0,.82807],83:[0,.69141,0,0,.82861],84:[0,.69141,0,0,.66899],85:[0,.69141,0,0,.64576],86:[0,.69141,0,0,.83131],87:[0,.69141,0,0,1.04602],88:[0,.69141,0,0,.71922],89:[.18906,.69141,0,0,.83293],90:[.12604,.69141,0,0,.60201],91:[.24982,.74947,0,0,.27764],93:[.24982,.74947,0,0,.27764],94:[0,.69141,0,0,.49965],97:[0,.47534,0,0,.50046],98:[0,.69141,0,0,.51315],99:[0,.47534,0,0,.38946],100:[0,.62119,0,0,.49857],101:[0,.47534,0,0,.40053],102:[.18906,.69141,0,0,.32626],103:[.18906,.47534,0,0,.5037],104:[.18906,.69141,0,0,.52126],105:[0,.69141,0,0,.27899],106:[0,.69141,0,0,.28088],107:[0,.69141,0,0,.38946],108:[0,.69141,0,0,.27953],109:[0,.47534,0,0,.76676],110:[0,.47534,0,0,.52666],111:[0,.47534,0,0,.48885],112:[.18906,.52396,0,0,.50046],113:[.18906,.47534,0,0,.48912],114:[0,.47534,0,0,.38919],115:[0,.47534,0,0,.44266],116:[0,.62119,0,0,.33301],117:[0,.47534,0,0,.5172],118:[0,.52396,0,0,.5118],119:[0,.52396,0,0,.77351],120:[.18906,.47534,0,0,.38865],121:[.18906,.47534,0,0,.49884],122:[.18906,.47534,0,0,.39054],160:[0,0,0,0,.25],8216:[0,.69141,0,0,.21471],8217:[0,.69141,0,0,.21471],58112:[0,.62119,0,0,.49749],58113:[0,.62119,0,0,.4983],58114:[.18906,.69141,0,0,.33328],58115:[.18906,.69141,0,0,.32923],58116:[.18906,.47534,0,0,.50343],58117:[0,.69141,0,0,.33301],58118:[0,.62119,0,0,.33409],58119:[0,.47534,0,0,.50073]},"Main-Bold":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.35],34:[0,.69444,0,0,.60278],35:[.19444,.69444,0,0,.95833],36:[.05556,.75,0,0,.575],37:[.05556,.75,0,0,.95833],38:[0,.69444,0,0,.89444],39:[0,.69444,0,0,.31944],40:[.25,.75,0,0,.44722],41:[.25,.75,0,0,.44722],42:[0,.75,0,0,.575],43:[.13333,.63333,0,0,.89444],44:[.19444,.15556,0,0,.31944],45:[0,.44444,0,0,.38333],46:[0,.15556,0,0,.31944],47:[.25,.75,0,0,.575],48:[0,.64444,0,0,.575],49:[0,.64444,0,0,.575],50:[0,.64444,0,0,.575],51:[0,.64444,0,0,.575],52:[0,.64444,0,0,.575],53:[0,.64444,0,0,.575],54:[0,.64444,0,0,.575],55:[0,.64444,0,0,.575],56:[0,.64444,0,0,.575],57:[0,.64444,0,0,.575],58:[0,.44444,0,0,.31944],59:[.19444,.44444,0,0,.31944],60:[.08556,.58556,0,0,.89444],61:[-.10889,.39111,0,0,.89444],62:[.08556,.58556,0,0,.89444],63:[0,.69444,0,0,.54305],64:[0,.69444,0,0,.89444],65:[0,.68611,0,0,.86944],66:[0,.68611,0,0,.81805],67:[0,.68611,0,0,.83055],68:[0,.68611,0,0,.88194],69:[0,.68611,0,0,.75555],70:[0,.68611,0,0,.72361],71:[0,.68611,0,0,.90416],72:[0,.68611,0,0,.9],73:[0,.68611,0,0,.43611],74:[0,.68611,0,0,.59444],75:[0,.68611,0,0,.90138],76:[0,.68611,0,0,.69166],77:[0,.68611,0,0,1.09166],78:[0,.68611,0,0,.9],79:[0,.68611,0,0,.86388],80:[0,.68611,0,0,.78611],81:[.19444,.68611,0,0,.86388],82:[0,.68611,0,0,.8625],83:[0,.68611,0,0,.63889],84:[0,.68611,0,0,.8],85:[0,.68611,0,0,.88472],86:[0,.68611,.01597,0,.86944],87:[0,.68611,.01597,0,1.18888],88:[0,.68611,0,0,.86944],89:[0,.68611,.02875,0,.86944],90:[0,.68611,0,0,.70277],91:[.25,.75,0,0,.31944],92:[.25,.75,0,0,.575],93:[.25,.75,0,0,.31944],94:[0,.69444,0,0,.575],95:[.31,.13444,.03194,0,.575],97:[0,.44444,0,0,.55902],98:[0,.69444,0,0,.63889],99:[0,.44444,0,0,.51111],100:[0,.69444,0,0,.63889],101:[0,.44444,0,0,.52708],102:[0,.69444,.10903,0,.35139],103:[.19444,.44444,.01597,0,.575],104:[0,.69444,0,0,.63889],105:[0,.69444,0,0,.31944],106:[.19444,.69444,0,0,.35139],107:[0,.69444,0,0,.60694],108:[0,.69444,0,0,.31944],109:[0,.44444,0,0,.95833],110:[0,.44444,0,0,.63889],111:[0,.44444,0,0,.575],112:[.19444,.44444,0,0,.63889],113:[.19444,.44444,0,0,.60694],114:[0,.44444,0,0,.47361],115:[0,.44444,0,0,.45361],116:[0,.63492,0,0,.44722],117:[0,.44444,0,0,.63889],118:[0,.44444,.01597,0,.60694],119:[0,.44444,.01597,0,.83055],120:[0,.44444,0,0,.60694],121:[.19444,.44444,.01597,0,.60694],122:[0,.44444,0,0,.51111],123:[.25,.75,0,0,.575],124:[.25,.75,0,0,.31944],125:[.25,.75,0,0,.575],126:[.35,.34444,0,0,.575],160:[0,0,0,0,.25],163:[0,.69444,0,0,.86853],168:[0,.69444,0,0,.575],172:[0,.44444,0,0,.76666],176:[0,.69444,0,0,.86944],177:[.13333,.63333,0,0,.89444],184:[.17014,0,0,0,.51111],198:[0,.68611,0,0,1.04166],215:[.13333,.63333,0,0,.89444],216:[.04861,.73472,0,0,.89444],223:[0,.69444,0,0,.59722],230:[0,.44444,0,0,.83055],247:[.13333,.63333,0,0,.89444],248:[.09722,.54167,0,0,.575],305:[0,.44444,0,0,.31944],338:[0,.68611,0,0,1.16944],339:[0,.44444,0,0,.89444],567:[.19444,.44444,0,0,.35139],710:[0,.69444,0,0,.575],711:[0,.63194,0,0,.575],713:[0,.59611,0,0,.575],714:[0,.69444,0,0,.575],715:[0,.69444,0,0,.575],728:[0,.69444,0,0,.575],729:[0,.69444,0,0,.31944],730:[0,.69444,0,0,.86944],732:[0,.69444,0,0,.575],733:[0,.69444,0,0,.575],915:[0,.68611,0,0,.69166],916:[0,.68611,0,0,.95833],920:[0,.68611,0,0,.89444],923:[0,.68611,0,0,.80555],926:[0,.68611,0,0,.76666],928:[0,.68611,0,0,.9],931:[0,.68611,0,0,.83055],933:[0,.68611,0,0,.89444],934:[0,.68611,0,0,.83055],936:[0,.68611,0,0,.89444],937:[0,.68611,0,0,.83055],8211:[0,.44444,.03194,0,.575],8212:[0,.44444,.03194,0,1.14999],8216:[0,.69444,0,0,.31944],8217:[0,.69444,0,0,.31944],8220:[0,.69444,0,0,.60278],8221:[0,.69444,0,0,.60278],8224:[.19444,.69444,0,0,.51111],8225:[.19444,.69444,0,0,.51111],8242:[0,.55556,0,0,.34444],8407:[0,.72444,.15486,0,.575],8463:[0,.69444,0,0,.66759],8465:[0,.69444,0,0,.83055],8467:[0,.69444,0,0,.47361],8472:[.19444,.44444,0,0,.74027],8476:[0,.69444,0,0,.83055],8501:[0,.69444,0,0,.70277],8592:[-.10889,.39111,0,0,1.14999],8593:[.19444,.69444,0,0,.575],8594:[-.10889,.39111,0,0,1.14999],8595:[.19444,.69444,0,0,.575],8596:[-.10889,.39111,0,0,1.14999],8597:[.25,.75,0,0,.575],8598:[.19444,.69444,0,0,1.14999],8599:[.19444,.69444,0,0,1.14999],8600:[.19444,.69444,0,0,1.14999],8601:[.19444,.69444,0,0,1.14999],8636:[-.10889,.39111,0,0,1.14999],8637:[-.10889,.39111,0,0,1.14999],8640:[-.10889,.39111,0,0,1.14999],8641:[-.10889,.39111,0,0,1.14999],8656:[-.10889,.39111,0,0,1.14999],8657:[.19444,.69444,0,0,.70277],8658:[-.10889,.39111,0,0,1.14999],8659:[.19444,.69444,0,0,.70277],8660:[-.10889,.39111,0,0,1.14999],8661:[.25,.75,0,0,.70277],8704:[0,.69444,0,0,.63889],8706:[0,.69444,.06389,0,.62847],8707:[0,.69444,0,0,.63889],8709:[.05556,.75,0,0,.575],8711:[0,.68611,0,0,.95833],8712:[.08556,.58556,0,0,.76666],8715:[.08556,.58556,0,0,.76666],8722:[.13333,.63333,0,0,.89444],8723:[.13333,.63333,0,0,.89444],8725:[.25,.75,0,0,.575],8726:[.25,.75,0,0,.575],8727:[-.02778,.47222,0,0,.575],8728:[-.02639,.47361,0,0,.575],8729:[-.02639,.47361,0,0,.575],8730:[.18,.82,0,0,.95833],8733:[0,.44444,0,0,.89444],8734:[0,.44444,0,0,1.14999],8736:[0,.69224,0,0,.72222],8739:[.25,.75,0,0,.31944],8741:[.25,.75,0,0,.575],8743:[0,.55556,0,0,.76666],8744:[0,.55556,0,0,.76666],8745:[0,.55556,0,0,.76666],8746:[0,.55556,0,0,.76666],8747:[.19444,.69444,.12778,0,.56875],8764:[-.10889,.39111,0,0,.89444],8768:[.19444,.69444,0,0,.31944],8771:[.00222,.50222,0,0,.89444],8773:[.027,.638,0,0,.894],8776:[.02444,.52444,0,0,.89444],8781:[.00222,.50222,0,0,.89444],8801:[.00222,.50222,0,0,.89444],8804:[.19667,.69667,0,0,.89444],8805:[.19667,.69667,0,0,.89444],8810:[.08556,.58556,0,0,1.14999],8811:[.08556,.58556,0,0,1.14999],8826:[.08556,.58556,0,0,.89444],8827:[.08556,.58556,0,0,.89444],8834:[.08556,.58556,0,0,.89444],8835:[.08556,.58556,0,0,.89444],8838:[.19667,.69667,0,0,.89444],8839:[.19667,.69667,0,0,.89444],8846:[0,.55556,0,0,.76666],8849:[.19667,.69667,0,0,.89444],8850:[.19667,.69667,0,0,.89444],8851:[0,.55556,0,0,.76666],8852:[0,.55556,0,0,.76666],8853:[.13333,.63333,0,0,.89444],8854:[.13333,.63333,0,0,.89444],8855:[.13333,.63333,0,0,.89444],8856:[.13333,.63333,0,0,.89444],8857:[.13333,.63333,0,0,.89444],8866:[0,.69444,0,0,.70277],8867:[0,.69444,0,0,.70277],8868:[0,.69444,0,0,.89444],8869:[0,.69444,0,0,.89444],8900:[-.02639,.47361,0,0,.575],8901:[-.02639,.47361,0,0,.31944],8902:[-.02778,.47222,0,0,.575],8968:[.25,.75,0,0,.51111],8969:[.25,.75,0,0,.51111],8970:[.25,.75,0,0,.51111],8971:[.25,.75,0,0,.51111],8994:[-.13889,.36111,0,0,1.14999],8995:[-.13889,.36111,0,0,1.14999],9651:[.19444,.69444,0,0,1.02222],9657:[-.02778,.47222,0,0,.575],9661:[.19444,.69444,0,0,1.02222],9667:[-.02778,.47222,0,0,.575],9711:[.19444,.69444,0,0,1.14999],9824:[.12963,.69444,0,0,.89444],9825:[.12963,.69444,0,0,.89444],9826:[.12963,.69444,0,0,.89444],9827:[.12963,.69444,0,0,.89444],9837:[0,.75,0,0,.44722],9838:[.19444,.69444,0,0,.44722],9839:[.19444,.69444,0,0,.44722],10216:[.25,.75,0,0,.44722],10217:[.25,.75,0,0,.44722],10815:[0,.68611,0,0,.9],10927:[.19667,.69667,0,0,.89444],10928:[.19667,.69667,0,0,.89444],57376:[.19444,.69444,0,0,0]},"Main-BoldItalic":{32:[0,0,0,0,.25],33:[0,.69444,.11417,0,.38611],34:[0,.69444,.07939,0,.62055],35:[.19444,.69444,.06833,0,.94444],37:[.05556,.75,.12861,0,.94444],38:[0,.69444,.08528,0,.88555],39:[0,.69444,.12945,0,.35555],40:[.25,.75,.15806,0,.47333],41:[.25,.75,.03306,0,.47333],42:[0,.75,.14333,0,.59111],43:[.10333,.60333,.03306,0,.88555],44:[.19444,.14722,0,0,.35555],45:[0,.44444,.02611,0,.41444],46:[0,.14722,0,0,.35555],47:[.25,.75,.15806,0,.59111],48:[0,.64444,.13167,0,.59111],49:[0,.64444,.13167,0,.59111],50:[0,.64444,.13167,0,.59111],51:[0,.64444,.13167,0,.59111],52:[.19444,.64444,.13167,0,.59111],53:[0,.64444,.13167,0,.59111],54:[0,.64444,.13167,0,.59111],55:[.19444,.64444,.13167,0,.59111],56:[0,.64444,.13167,0,.59111],57:[0,.64444,.13167,0,.59111],58:[0,.44444,.06695,0,.35555],59:[.19444,.44444,.06695,0,.35555],61:[-.10889,.39111,.06833,0,.88555],63:[0,.69444,.11472,0,.59111],64:[0,.69444,.09208,0,.88555],65:[0,.68611,0,0,.86555],66:[0,.68611,.0992,0,.81666],67:[0,.68611,.14208,0,.82666],68:[0,.68611,.09062,0,.87555],69:[0,.68611,.11431,0,.75666],70:[0,.68611,.12903,0,.72722],71:[0,.68611,.07347,0,.89527],72:[0,.68611,.17208,0,.8961],73:[0,.68611,.15681,0,.47166],74:[0,.68611,.145,0,.61055],75:[0,.68611,.14208,0,.89499],76:[0,.68611,0,0,.69777],77:[0,.68611,.17208,0,1.07277],78:[0,.68611,.17208,0,.8961],79:[0,.68611,.09062,0,.85499],80:[0,.68611,.0992,0,.78721],81:[.19444,.68611,.09062,0,.85499],82:[0,.68611,.02559,0,.85944],83:[0,.68611,.11264,0,.64999],84:[0,.68611,.12903,0,.7961],85:[0,.68611,.17208,0,.88083],86:[0,.68611,.18625,0,.86555],87:[0,.68611,.18625,0,1.15999],88:[0,.68611,.15681,0,.86555],89:[0,.68611,.19803,0,.86555],90:[0,.68611,.14208,0,.70888],91:[.25,.75,.1875,0,.35611],93:[.25,.75,.09972,0,.35611],94:[0,.69444,.06709,0,.59111],95:[.31,.13444,.09811,0,.59111],97:[0,.44444,.09426,0,.59111],98:[0,.69444,.07861,0,.53222],99:[0,.44444,.05222,0,.53222],100:[0,.69444,.10861,0,.59111],101:[0,.44444,.085,0,.53222],102:[.19444,.69444,.21778,0,.4],103:[.19444,.44444,.105,0,.53222],104:[0,.69444,.09426,0,.59111],105:[0,.69326,.11387,0,.35555],106:[.19444,.69326,.1672,0,.35555],107:[0,.69444,.11111,0,.53222],108:[0,.69444,.10861,0,.29666],109:[0,.44444,.09426,0,.94444],110:[0,.44444,.09426,0,.64999],111:[0,.44444,.07861,0,.59111],112:[.19444,.44444,.07861,0,.59111],113:[.19444,.44444,.105,0,.53222],114:[0,.44444,.11111,0,.50167],115:[0,.44444,.08167,0,.48694],116:[0,.63492,.09639,0,.385],117:[0,.44444,.09426,0,.62055],118:[0,.44444,.11111,0,.53222],119:[0,.44444,.11111,0,.76777],120:[0,.44444,.12583,0,.56055],121:[.19444,.44444,.105,0,.56166],122:[0,.44444,.13889,0,.49055],126:[.35,.34444,.11472,0,.59111],160:[0,0,0,0,.25],168:[0,.69444,.11473,0,.59111],176:[0,.69444,0,0,.94888],184:[.17014,0,0,0,.53222],198:[0,.68611,.11431,0,1.02277],216:[.04861,.73472,.09062,0,.88555],223:[.19444,.69444,.09736,0,.665],230:[0,.44444,.085,0,.82666],248:[.09722,.54167,.09458,0,.59111],305:[0,.44444,.09426,0,.35555],338:[0,.68611,.11431,0,1.14054],339:[0,.44444,.085,0,.82666],567:[.19444,.44444,.04611,0,.385],710:[0,.69444,.06709,0,.59111],711:[0,.63194,.08271,0,.59111],713:[0,.59444,.10444,0,.59111],714:[0,.69444,.08528,0,.59111],715:[0,.69444,0,0,.59111],728:[0,.69444,.10333,0,.59111],729:[0,.69444,.12945,0,.35555],730:[0,.69444,0,0,.94888],732:[0,.69444,.11472,0,.59111],733:[0,.69444,.11472,0,.59111],915:[0,.68611,.12903,0,.69777],916:[0,.68611,0,0,.94444],920:[0,.68611,.09062,0,.88555],923:[0,.68611,0,0,.80666],926:[0,.68611,.15092,0,.76777],928:[0,.68611,.17208,0,.8961],931:[0,.68611,.11431,0,.82666],933:[0,.68611,.10778,0,.88555],934:[0,.68611,.05632,0,.82666],936:[0,.68611,.10778,0,.88555],937:[0,.68611,.0992,0,.82666],8211:[0,.44444,.09811,0,.59111],8212:[0,.44444,.09811,0,1.18221],8216:[0,.69444,.12945,0,.35555],8217:[0,.69444,.12945,0,.35555],8220:[0,.69444,.16772,0,.62055],8221:[0,.69444,.07939,0,.62055]},"Main-Italic":{32:[0,0,0,0,.25],33:[0,.69444,.12417,0,.30667],34:[0,.69444,.06961,0,.51444],35:[.19444,.69444,.06616,0,.81777],37:[.05556,.75,.13639,0,.81777],38:[0,.69444,.09694,0,.76666],39:[0,.69444,.12417,0,.30667],40:[.25,.75,.16194,0,.40889],41:[.25,.75,.03694,0,.40889],42:[0,.75,.14917,0,.51111],43:[.05667,.56167,.03694,0,.76666],44:[.19444,.10556,0,0,.30667],45:[0,.43056,.02826,0,.35778],46:[0,.10556,0,0,.30667],47:[.25,.75,.16194,0,.51111],48:[0,.64444,.13556,0,.51111],49:[0,.64444,.13556,0,.51111],50:[0,.64444,.13556,0,.51111],51:[0,.64444,.13556,0,.51111],52:[.19444,.64444,.13556,0,.51111],53:[0,.64444,.13556,0,.51111],54:[0,.64444,.13556,0,.51111],55:[.19444,.64444,.13556,0,.51111],56:[0,.64444,.13556,0,.51111],57:[0,.64444,.13556,0,.51111],58:[0,.43056,.0582,0,.30667],59:[.19444,.43056,.0582,0,.30667],61:[-.13313,.36687,.06616,0,.76666],63:[0,.69444,.1225,0,.51111],64:[0,.69444,.09597,0,.76666],65:[0,.68333,0,0,.74333],66:[0,.68333,.10257,0,.70389],67:[0,.68333,.14528,0,.71555],68:[0,.68333,.09403,0,.755],69:[0,.68333,.12028,0,.67833],70:[0,.68333,.13305,0,.65277],71:[0,.68333,.08722,0,.77361],72:[0,.68333,.16389,0,.74333],73:[0,.68333,.15806,0,.38555],74:[0,.68333,.14028,0,.525],75:[0,.68333,.14528,0,.76888],76:[0,.68333,0,0,.62722],77:[0,.68333,.16389,0,.89666],78:[0,.68333,.16389,0,.74333],79:[0,.68333,.09403,0,.76666],80:[0,.68333,.10257,0,.67833],81:[.19444,.68333,.09403,0,.76666],82:[0,.68333,.03868,0,.72944],83:[0,.68333,.11972,0,.56222],84:[0,.68333,.13305,0,.71555],85:[0,.68333,.16389,0,.74333],86:[0,.68333,.18361,0,.74333],87:[0,.68333,.18361,0,.99888],88:[0,.68333,.15806,0,.74333],89:[0,.68333,.19383,0,.74333],90:[0,.68333,.14528,0,.61333],91:[.25,.75,.1875,0,.30667],93:[.25,.75,.10528,0,.30667],94:[0,.69444,.06646,0,.51111],95:[.31,.12056,.09208,0,.51111],97:[0,.43056,.07671,0,.51111],98:[0,.69444,.06312,0,.46],99:[0,.43056,.05653,0,.46],100:[0,.69444,.10333,0,.51111],101:[0,.43056,.07514,0,.46],102:[.19444,.69444,.21194,0,.30667],103:[.19444,.43056,.08847,0,.46],104:[0,.69444,.07671,0,.51111],105:[0,.65536,.1019,0,.30667],106:[.19444,.65536,.14467,0,.30667],107:[0,.69444,.10764,0,.46],108:[0,.69444,.10333,0,.25555],109:[0,.43056,.07671,0,.81777],110:[0,.43056,.07671,0,.56222],111:[0,.43056,.06312,0,.51111],112:[.19444,.43056,.06312,0,.51111],113:[.19444,.43056,.08847,0,.46],114:[0,.43056,.10764,0,.42166],115:[0,.43056,.08208,0,.40889],116:[0,.61508,.09486,0,.33222],117:[0,.43056,.07671,0,.53666],118:[0,.43056,.10764,0,.46],119:[0,.43056,.10764,0,.66444],120:[0,.43056,.12042,0,.46389],121:[.19444,.43056,.08847,0,.48555],122:[0,.43056,.12292,0,.40889],126:[.35,.31786,.11585,0,.51111],160:[0,0,0,0,.25],168:[0,.66786,.10474,0,.51111],176:[0,.69444,0,0,.83129],184:[.17014,0,0,0,.46],198:[0,.68333,.12028,0,.88277],216:[.04861,.73194,.09403,0,.76666],223:[.19444,.69444,.10514,0,.53666],230:[0,.43056,.07514,0,.71555],248:[.09722,.52778,.09194,0,.51111],338:[0,.68333,.12028,0,.98499],339:[0,.43056,.07514,0,.71555],710:[0,.69444,.06646,0,.51111],711:[0,.62847,.08295,0,.51111],713:[0,.56167,.10333,0,.51111],714:[0,.69444,.09694,0,.51111],715:[0,.69444,0,0,.51111],728:[0,.69444,.10806,0,.51111],729:[0,.66786,.11752,0,.30667],730:[0,.69444,0,0,.83129],732:[0,.66786,.11585,0,.51111],733:[0,.69444,.1225,0,.51111],915:[0,.68333,.13305,0,.62722],916:[0,.68333,0,0,.81777],920:[0,.68333,.09403,0,.76666],923:[0,.68333,0,0,.69222],926:[0,.68333,.15294,0,.66444],928:[0,.68333,.16389,0,.74333],931:[0,.68333,.12028,0,.71555],933:[0,.68333,.11111,0,.76666],934:[0,.68333,.05986,0,.71555],936:[0,.68333,.11111,0,.76666],937:[0,.68333,.10257,0,.71555],8211:[0,.43056,.09208,0,.51111],8212:[0,.43056,.09208,0,1.02222],8216:[0,.69444,.12417,0,.30667],8217:[0,.69444,.12417,0,.30667],8220:[0,.69444,.1685,0,.51444],8221:[0,.69444,.06961,0,.51444],8463:[0,.68889,0,0,.54028]},"Main-Regular":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.27778],34:[0,.69444,0,0,.5],35:[.19444,.69444,0,0,.83334],36:[.05556,.75,0,0,.5],37:[.05556,.75,0,0,.83334],38:[0,.69444,0,0,.77778],39:[0,.69444,0,0,.27778],40:[.25,.75,0,0,.38889],41:[.25,.75,0,0,.38889],42:[0,.75,0,0,.5],43:[.08333,.58333,0,0,.77778],44:[.19444,.10556,0,0,.27778],45:[0,.43056,0,0,.33333],46:[0,.10556,0,0,.27778],47:[.25,.75,0,0,.5],48:[0,.64444,0,0,.5],49:[0,.64444,0,0,.5],50:[0,.64444,0,0,.5],51:[0,.64444,0,0,.5],52:[0,.64444,0,0,.5],53:[0,.64444,0,0,.5],54:[0,.64444,0,0,.5],55:[0,.64444,0,0,.5],56:[0,.64444,0,0,.5],57:[0,.64444,0,0,.5],58:[0,.43056,0,0,.27778],59:[.19444,.43056,0,0,.27778],60:[.0391,.5391,0,0,.77778],61:[-.13313,.36687,0,0,.77778],62:[.0391,.5391,0,0,.77778],63:[0,.69444,0,0,.47222],64:[0,.69444,0,0,.77778],65:[0,.68333,0,0,.75],66:[0,.68333,0,0,.70834],67:[0,.68333,0,0,.72222],68:[0,.68333,0,0,.76389],69:[0,.68333,0,0,.68056],70:[0,.68333,0,0,.65278],71:[0,.68333,0,0,.78472],72:[0,.68333,0,0,.75],73:[0,.68333,0,0,.36111],74:[0,.68333,0,0,.51389],75:[0,.68333,0,0,.77778],76:[0,.68333,0,0,.625],77:[0,.68333,0,0,.91667],78:[0,.68333,0,0,.75],79:[0,.68333,0,0,.77778],80:[0,.68333,0,0,.68056],81:[.19444,.68333,0,0,.77778],82:[0,.68333,0,0,.73611],83:[0,.68333,0,0,.55556],84:[0,.68333,0,0,.72222],85:[0,.68333,0,0,.75],86:[0,.68333,.01389,0,.75],87:[0,.68333,.01389,0,1.02778],88:[0,.68333,0,0,.75],89:[0,.68333,.025,0,.75],90:[0,.68333,0,0,.61111],91:[.25,.75,0,0,.27778],92:[.25,.75,0,0,.5],93:[.25,.75,0,0,.27778],94:[0,.69444,0,0,.5],95:[.31,.12056,.02778,0,.5],97:[0,.43056,0,0,.5],98:[0,.69444,0,0,.55556],99:[0,.43056,0,0,.44445],100:[0,.69444,0,0,.55556],101:[0,.43056,0,0,.44445],102:[0,.69444,.07778,0,.30556],103:[.19444,.43056,.01389,0,.5],104:[0,.69444,0,0,.55556],105:[0,.66786,0,0,.27778],106:[.19444,.66786,0,0,.30556],107:[0,.69444,0,0,.52778],108:[0,.69444,0,0,.27778],109:[0,.43056,0,0,.83334],110:[0,.43056,0,0,.55556],111:[0,.43056,0,0,.5],112:[.19444,.43056,0,0,.55556],113:[.19444,.43056,0,0,.52778],114:[0,.43056,0,0,.39167],115:[0,.43056,0,0,.39445],116:[0,.61508,0,0,.38889],117:[0,.43056,0,0,.55556],118:[0,.43056,.01389,0,.52778],119:[0,.43056,.01389,0,.72222],120:[0,.43056,0,0,.52778],121:[.19444,.43056,.01389,0,.52778],122:[0,.43056,0,0,.44445],123:[.25,.75,0,0,.5],124:[.25,.75,0,0,.27778],125:[.25,.75,0,0,.5],126:[.35,.31786,0,0,.5],160:[0,0,0,0,.25],163:[0,.69444,0,0,.76909],167:[.19444,.69444,0,0,.44445],168:[0,.66786,0,0,.5],172:[0,.43056,0,0,.66667],176:[0,.69444,0,0,.75],177:[.08333,.58333,0,0,.77778],182:[.19444,.69444,0,0,.61111],184:[.17014,0,0,0,.44445],198:[0,.68333,0,0,.90278],215:[.08333,.58333,0,0,.77778],216:[.04861,.73194,0,0,.77778],223:[0,.69444,0,0,.5],230:[0,.43056,0,0,.72222],247:[.08333,.58333,0,0,.77778],248:[.09722,.52778,0,0,.5],305:[0,.43056,0,0,.27778],338:[0,.68333,0,0,1.01389],339:[0,.43056,0,0,.77778],567:[.19444,.43056,0,0,.30556],710:[0,.69444,0,0,.5],711:[0,.62847,0,0,.5],713:[0,.56778,0,0,.5],714:[0,.69444,0,0,.5],715:[0,.69444,0,0,.5],728:[0,.69444,0,0,.5],729:[0,.66786,0,0,.27778],730:[0,.69444,0,0,.75],732:[0,.66786,0,0,.5],733:[0,.69444,0,0,.5],915:[0,.68333,0,0,.625],916:[0,.68333,0,0,.83334],920:[0,.68333,0,0,.77778],923:[0,.68333,0,0,.69445],926:[0,.68333,0,0,.66667],928:[0,.68333,0,0,.75],931:[0,.68333,0,0,.72222],933:[0,.68333,0,0,.77778],934:[0,.68333,0,0,.72222],936:[0,.68333,0,0,.77778],937:[0,.68333,0,0,.72222],8211:[0,.43056,.02778,0,.5],8212:[0,.43056,.02778,0,1],8216:[0,.69444,0,0,.27778],8217:[0,.69444,0,0,.27778],8220:[0,.69444,0,0,.5],8221:[0,.69444,0,0,.5],8224:[.19444,.69444,0,0,.44445],8225:[.19444,.69444,0,0,.44445],8230:[0,.123,0,0,1.172],8242:[0,.55556,0,0,.275],8407:[0,.71444,.15382,0,.5],8463:[0,.68889,0,0,.54028],8465:[0,.69444,0,0,.72222],8467:[0,.69444,0,.11111,.41667],8472:[.19444,.43056,0,.11111,.63646],8476:[0,.69444,0,0,.72222],8501:[0,.69444,0,0,.61111],8592:[-.13313,.36687,0,0,1],8593:[.19444,.69444,0,0,.5],8594:[-.13313,.36687,0,0,1],8595:[.19444,.69444,0,0,.5],8596:[-.13313,.36687,0,0,1],8597:[.25,.75,0,0,.5],8598:[.19444,.69444,0,0,1],8599:[.19444,.69444,0,0,1],8600:[.19444,.69444,0,0,1],8601:[.19444,.69444,0,0,1],8614:[.011,.511,0,0,1],8617:[.011,.511,0,0,1.126],8618:[.011,.511,0,0,1.126],8636:[-.13313,.36687,0,0,1],8637:[-.13313,.36687,0,0,1],8640:[-.13313,.36687,0,0,1],8641:[-.13313,.36687,0,0,1],8652:[.011,.671,0,0,1],8656:[-.13313,.36687,0,0,1],8657:[.19444,.69444,0,0,.61111],8658:[-.13313,.36687,0,0,1],8659:[.19444,.69444,0,0,.61111],8660:[-.13313,.36687,0,0,1],8661:[.25,.75,0,0,.61111],8704:[0,.69444,0,0,.55556],8706:[0,.69444,.05556,.08334,.5309],8707:[0,.69444,0,0,.55556],8709:[.05556,.75,0,0,.5],8711:[0,.68333,0,0,.83334],8712:[.0391,.5391,0,0,.66667],8715:[.0391,.5391,0,0,.66667],8722:[.08333,.58333,0,0,.77778],8723:[.08333,.58333,0,0,.77778],8725:[.25,.75,0,0,.5],8726:[.25,.75,0,0,.5],8727:[-.03472,.46528,0,0,.5],8728:[-.05555,.44445,0,0,.5],8729:[-.05555,.44445,0,0,.5],8730:[.2,.8,0,0,.83334],8733:[0,.43056,0,0,.77778],8734:[0,.43056,0,0,1],8736:[0,.69224,0,0,.72222],8739:[.25,.75,0,0,.27778],8741:[.25,.75,0,0,.5],8743:[0,.55556,0,0,.66667],8744:[0,.55556,0,0,.66667],8745:[0,.55556,0,0,.66667],8746:[0,.55556,0,0,.66667],8747:[.19444,.69444,.11111,0,.41667],8764:[-.13313,.36687,0,0,.77778],8768:[.19444,.69444,0,0,.27778],8771:[-.03625,.46375,0,0,.77778],8773:[-.022,.589,0,0,.778],8776:[-.01688,.48312,0,0,.77778],8781:[-.03625,.46375,0,0,.77778],8784:[-.133,.673,0,0,.778],8801:[-.03625,.46375,0,0,.77778],8804:[.13597,.63597,0,0,.77778],8805:[.13597,.63597,0,0,.77778],8810:[.0391,.5391,0,0,1],8811:[.0391,.5391,0,0,1],8826:[.0391,.5391,0,0,.77778],8827:[.0391,.5391,0,0,.77778],8834:[.0391,.5391,0,0,.77778],8835:[.0391,.5391,0,0,.77778],8838:[.13597,.63597,0,0,.77778],8839:[.13597,.63597,0,0,.77778],8846:[0,.55556,0,0,.66667],8849:[.13597,.63597,0,0,.77778],8850:[.13597,.63597,0,0,.77778],8851:[0,.55556,0,0,.66667],8852:[0,.55556,0,0,.66667],8853:[.08333,.58333,0,0,.77778],8854:[.08333,.58333,0,0,.77778],8855:[.08333,.58333,0,0,.77778],8856:[.08333,.58333,0,0,.77778],8857:[.08333,.58333,0,0,.77778],8866:[0,.69444,0,0,.61111],8867:[0,.69444,0,0,.61111],8868:[0,.69444,0,0,.77778],8869:[0,.69444,0,0,.77778],8872:[.249,.75,0,0,.867],8900:[-.05555,.44445,0,0,.5],8901:[-.05555,.44445,0,0,.27778],8902:[-.03472,.46528,0,0,.5],8904:[.005,.505,0,0,.9],8942:[.03,.903,0,0,.278],8943:[-.19,.313,0,0,1.172],8945:[-.1,.823,0,0,1.282],8968:[.25,.75,0,0,.44445],8969:[.25,.75,0,0,.44445],8970:[.25,.75,0,0,.44445],8971:[.25,.75,0,0,.44445],8994:[-.14236,.35764,0,0,1],8995:[-.14236,.35764,0,0,1],9136:[.244,.744,0,0,.412],9137:[.244,.745,0,0,.412],9651:[.19444,.69444,0,0,.88889],9657:[-.03472,.46528,0,0,.5],9661:[.19444,.69444,0,0,.88889],9667:[-.03472,.46528,0,0,.5],9711:[.19444,.69444,0,0,1],9824:[.12963,.69444,0,0,.77778],9825:[.12963,.69444,0,0,.77778],9826:[.12963,.69444,0,0,.77778],9827:[.12963,.69444,0,0,.77778],9837:[0,.75,0,0,.38889],9838:[.19444,.69444,0,0,.38889],9839:[.19444,.69444,0,0,.38889],10216:[.25,.75,0,0,.38889],10217:[.25,.75,0,0,.38889],10222:[.244,.744,0,0,.412],10223:[.244,.745,0,0,.412],10229:[.011,.511,0,0,1.609],10230:[.011,.511,0,0,1.638],10231:[.011,.511,0,0,1.859],10232:[.024,.525,0,0,1.609],10233:[.024,.525,0,0,1.638],10234:[.024,.525,0,0,1.858],10236:[.011,.511,0,0,1.638],10815:[0,.68333,0,0,.75],10927:[.13597,.63597,0,0,.77778],10928:[.13597,.63597,0,0,.77778],57376:[.19444,.69444,0,0,0]},"Math-BoldItalic":{32:[0,0,0,0,.25],48:[0,.44444,0,0,.575],49:[0,.44444,0,0,.575],50:[0,.44444,0,0,.575],51:[.19444,.44444,0,0,.575],52:[.19444,.44444,0,0,.575],53:[.19444,.44444,0,0,.575],54:[0,.64444,0,0,.575],55:[.19444,.44444,0,0,.575],56:[0,.64444,0,0,.575],57:[.19444,.44444,0,0,.575],65:[0,.68611,0,0,.86944],66:[0,.68611,.04835,0,.8664],67:[0,.68611,.06979,0,.81694],68:[0,.68611,.03194,0,.93812],69:[0,.68611,.05451,0,.81007],70:[0,.68611,.15972,0,.68889],71:[0,.68611,0,0,.88673],72:[0,.68611,.08229,0,.98229],73:[0,.68611,.07778,0,.51111],74:[0,.68611,.10069,0,.63125],75:[0,.68611,.06979,0,.97118],76:[0,.68611,0,0,.75555],77:[0,.68611,.11424,0,1.14201],78:[0,.68611,.11424,0,.95034],79:[0,.68611,.03194,0,.83666],80:[0,.68611,.15972,0,.72309],81:[.19444,.68611,0,0,.86861],82:[0,.68611,.00421,0,.87235],83:[0,.68611,.05382,0,.69271],84:[0,.68611,.15972,0,.63663],85:[0,.68611,.11424,0,.80027],86:[0,.68611,.25555,0,.67778],87:[0,.68611,.15972,0,1.09305],88:[0,.68611,.07778,0,.94722],89:[0,.68611,.25555,0,.67458],90:[0,.68611,.06979,0,.77257],97:[0,.44444,0,0,.63287],98:[0,.69444,0,0,.52083],99:[0,.44444,0,0,.51342],100:[0,.69444,0,0,.60972],101:[0,.44444,0,0,.55361],102:[.19444,.69444,.11042,0,.56806],103:[.19444,.44444,.03704,0,.5449],104:[0,.69444,0,0,.66759],105:[0,.69326,0,0,.4048],106:[.19444,.69326,.0622,0,.47083],107:[0,.69444,.01852,0,.6037],108:[0,.69444,.0088,0,.34815],109:[0,.44444,0,0,1.0324],110:[0,.44444,0,0,.71296],111:[0,.44444,0,0,.58472],112:[.19444,.44444,0,0,.60092],113:[.19444,.44444,.03704,0,.54213],114:[0,.44444,.03194,0,.5287],115:[0,.44444,0,0,.53125],116:[0,.63492,0,0,.41528],117:[0,.44444,0,0,.68102],118:[0,.44444,.03704,0,.56666],119:[0,.44444,.02778,0,.83148],120:[0,.44444,0,0,.65903],121:[.19444,.44444,.03704,0,.59028],122:[0,.44444,.04213,0,.55509],160:[0,0,0,0,.25],915:[0,.68611,.15972,0,.65694],916:[0,.68611,0,0,.95833],920:[0,.68611,.03194,0,.86722],923:[0,.68611,0,0,.80555],926:[0,.68611,.07458,0,.84125],928:[0,.68611,.08229,0,.98229],931:[0,.68611,.05451,0,.88507],933:[0,.68611,.15972,0,.67083],934:[0,.68611,0,0,.76666],936:[0,.68611,.11653,0,.71402],937:[0,.68611,.04835,0,.8789],945:[0,.44444,0,0,.76064],946:[.19444,.69444,.03403,0,.65972],947:[.19444,.44444,.06389,0,.59003],948:[0,.69444,.03819,0,.52222],949:[0,.44444,0,0,.52882],950:[.19444,.69444,.06215,0,.50833],951:[.19444,.44444,.03704,0,.6],952:[0,.69444,.03194,0,.5618],953:[0,.44444,0,0,.41204],954:[0,.44444,0,0,.66759],955:[0,.69444,0,0,.67083],956:[.19444,.44444,0,0,.70787],957:[0,.44444,.06898,0,.57685],958:[.19444,.69444,.03021,0,.50833],959:[0,.44444,0,0,.58472],960:[0,.44444,.03704,0,.68241],961:[.19444,.44444,0,0,.6118],962:[.09722,.44444,.07917,0,.42361],963:[0,.44444,.03704,0,.68588],964:[0,.44444,.13472,0,.52083],965:[0,.44444,.03704,0,.63055],966:[.19444,.44444,0,0,.74722],967:[.19444,.44444,0,0,.71805],968:[.19444,.69444,.03704,0,.75833],969:[0,.44444,.03704,0,.71782],977:[0,.69444,0,0,.69155],981:[.19444,.69444,0,0,.7125],982:[0,.44444,.03194,0,.975],1009:[.19444,.44444,0,0,.6118],1013:[0,.44444,0,0,.48333],57649:[0,.44444,0,0,.39352],57911:[.19444,.44444,0,0,.43889]},"Math-Italic":{32:[0,0,0,0,.25],48:[0,.43056,0,0,.5],49:[0,.43056,0,0,.5],50:[0,.43056,0,0,.5],51:[.19444,.43056,0,0,.5],52:[.19444,.43056,0,0,.5],53:[.19444,.43056,0,0,.5],54:[0,.64444,0,0,.5],55:[.19444,.43056,0,0,.5],56:[0,.64444,0,0,.5],57:[.19444,.43056,0,0,.5],65:[0,.68333,0,.13889,.75],66:[0,.68333,.05017,.08334,.75851],67:[0,.68333,.07153,.08334,.71472],68:[0,.68333,.02778,.05556,.82792],69:[0,.68333,.05764,.08334,.7382],70:[0,.68333,.13889,.08334,.64306],71:[0,.68333,0,.08334,.78625],72:[0,.68333,.08125,.05556,.83125],73:[0,.68333,.07847,.11111,.43958],74:[0,.68333,.09618,.16667,.55451],75:[0,.68333,.07153,.05556,.84931],76:[0,.68333,0,.02778,.68056],77:[0,.68333,.10903,.08334,.97014],78:[0,.68333,.10903,.08334,.80347],79:[0,.68333,.02778,.08334,.76278],80:[0,.68333,.13889,.08334,.64201],81:[.19444,.68333,0,.08334,.79056],82:[0,.68333,.00773,.08334,.75929],83:[0,.68333,.05764,.08334,.6132],84:[0,.68333,.13889,.08334,.58438],85:[0,.68333,.10903,.02778,.68278],86:[0,.68333,.22222,0,.58333],87:[0,.68333,.13889,0,.94445],88:[0,.68333,.07847,.08334,.82847],89:[0,.68333,.22222,0,.58056],90:[0,.68333,.07153,.08334,.68264],97:[0,.43056,0,0,.52859],98:[0,.69444,0,0,.42917],99:[0,.43056,0,.05556,.43276],100:[0,.69444,0,.16667,.52049],101:[0,.43056,0,.05556,.46563],102:[.19444,.69444,.10764,.16667,.48959],103:[.19444,.43056,.03588,.02778,.47697],104:[0,.69444,0,0,.57616],105:[0,.65952,0,0,.34451],106:[.19444,.65952,.05724,0,.41181],107:[0,.69444,.03148,0,.5206],108:[0,.69444,.01968,.08334,.29838],109:[0,.43056,0,0,.87801],110:[0,.43056,0,0,.60023],111:[0,.43056,0,.05556,.48472],112:[.19444,.43056,0,.08334,.50313],113:[.19444,.43056,.03588,.08334,.44641],114:[0,.43056,.02778,.05556,.45116],115:[0,.43056,0,.05556,.46875],116:[0,.61508,0,.08334,.36111],117:[0,.43056,0,.02778,.57246],118:[0,.43056,.03588,.02778,.48472],119:[0,.43056,.02691,.08334,.71592],120:[0,.43056,0,.02778,.57153],121:[.19444,.43056,.03588,.05556,.49028],122:[0,.43056,.04398,.05556,.46505],160:[0,0,0,0,.25],915:[0,.68333,.13889,.08334,.61528],916:[0,.68333,0,.16667,.83334],920:[0,.68333,.02778,.08334,.76278],923:[0,.68333,0,.16667,.69445],926:[0,.68333,.07569,.08334,.74236],928:[0,.68333,.08125,.05556,.83125],931:[0,.68333,.05764,.08334,.77986],933:[0,.68333,.13889,.05556,.58333],934:[0,.68333,0,.08334,.66667],936:[0,.68333,.11,.05556,.61222],937:[0,.68333,.05017,.08334,.7724],945:[0,.43056,.0037,.02778,.6397],946:[.19444,.69444,.05278,.08334,.56563],947:[.19444,.43056,.05556,0,.51773],948:[0,.69444,.03785,.05556,.44444],949:[0,.43056,0,.08334,.46632],950:[.19444,.69444,.07378,.08334,.4375],951:[.19444,.43056,.03588,.05556,.49653],952:[0,.69444,.02778,.08334,.46944],953:[0,.43056,0,.05556,.35394],954:[0,.43056,0,0,.57616],955:[0,.69444,0,0,.58334],956:[.19444,.43056,0,.02778,.60255],957:[0,.43056,.06366,.02778,.49398],958:[.19444,.69444,.04601,.11111,.4375],959:[0,.43056,0,.05556,.48472],960:[0,.43056,.03588,0,.57003],961:[.19444,.43056,0,.08334,.51702],962:[.09722,.43056,.07986,.08334,.36285],963:[0,.43056,.03588,0,.57141],964:[0,.43056,.1132,.02778,.43715],965:[0,.43056,.03588,.02778,.54028],966:[.19444,.43056,0,.08334,.65417],967:[.19444,.43056,0,.05556,.62569],968:[.19444,.69444,.03588,.11111,.65139],969:[0,.43056,.03588,0,.62245],977:[0,.69444,0,.08334,.59144],981:[.19444,.69444,0,.08334,.59583],982:[0,.43056,.02778,0,.82813],1009:[.19444,.43056,0,.08334,.51702],1013:[0,.43056,0,.05556,.4059],57649:[0,.43056,0,.02778,.32246],57911:[.19444,.43056,0,.08334,.38403]},"SansSerif-Bold":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.36667],34:[0,.69444,0,0,.55834],35:[.19444,.69444,0,0,.91667],36:[.05556,.75,0,0,.55],37:[.05556,.75,0,0,1.02912],38:[0,.69444,0,0,.83056],39:[0,.69444,0,0,.30556],40:[.25,.75,0,0,.42778],41:[.25,.75,0,0,.42778],42:[0,.75,0,0,.55],43:[.11667,.61667,0,0,.85556],44:[.10556,.13056,0,0,.30556],45:[0,.45833,0,0,.36667],46:[0,.13056,0,0,.30556],47:[.25,.75,0,0,.55],48:[0,.69444,0,0,.55],49:[0,.69444,0,0,.55],50:[0,.69444,0,0,.55],51:[0,.69444,0,0,.55],52:[0,.69444,0,0,.55],53:[0,.69444,0,0,.55],54:[0,.69444,0,0,.55],55:[0,.69444,0,0,.55],56:[0,.69444,0,0,.55],57:[0,.69444,0,0,.55],58:[0,.45833,0,0,.30556],59:[.10556,.45833,0,0,.30556],61:[-.09375,.40625,0,0,.85556],63:[0,.69444,0,0,.51945],64:[0,.69444,0,0,.73334],65:[0,.69444,0,0,.73334],66:[0,.69444,0,0,.73334],67:[0,.69444,0,0,.70278],68:[0,.69444,0,0,.79445],69:[0,.69444,0,0,.64167],70:[0,.69444,0,0,.61111],71:[0,.69444,0,0,.73334],72:[0,.69444,0,0,.79445],73:[0,.69444,0,0,.33056],74:[0,.69444,0,0,.51945],75:[0,.69444,0,0,.76389],76:[0,.69444,0,0,.58056],77:[0,.69444,0,0,.97778],78:[0,.69444,0,0,.79445],79:[0,.69444,0,0,.79445],80:[0,.69444,0,0,.70278],81:[.10556,.69444,0,0,.79445],82:[0,.69444,0,0,.70278],83:[0,.69444,0,0,.61111],84:[0,.69444,0,0,.73334],85:[0,.69444,0,0,.76389],86:[0,.69444,.01528,0,.73334],87:[0,.69444,.01528,0,1.03889],88:[0,.69444,0,0,.73334],89:[0,.69444,.0275,0,.73334],90:[0,.69444,0,0,.67223],91:[.25,.75,0,0,.34306],93:[.25,.75,0,0,.34306],94:[0,.69444,0,0,.55],95:[.35,.10833,.03056,0,.55],97:[0,.45833,0,0,.525],98:[0,.69444,0,0,.56111],99:[0,.45833,0,0,.48889],100:[0,.69444,0,0,.56111],101:[0,.45833,0,0,.51111],102:[0,.69444,.07639,0,.33611],103:[.19444,.45833,.01528,0,.55],104:[0,.69444,0,0,.56111],105:[0,.69444,0,0,.25556],106:[.19444,.69444,0,0,.28611],107:[0,.69444,0,0,.53056],108:[0,.69444,0,0,.25556],109:[0,.45833,0,0,.86667],110:[0,.45833,0,0,.56111],111:[0,.45833,0,0,.55],112:[.19444,.45833,0,0,.56111],113:[.19444,.45833,0,0,.56111],114:[0,.45833,.01528,0,.37222],115:[0,.45833,0,0,.42167],116:[0,.58929,0,0,.40417],117:[0,.45833,0,0,.56111],118:[0,.45833,.01528,0,.5],119:[0,.45833,.01528,0,.74445],120:[0,.45833,0,0,.5],121:[.19444,.45833,.01528,0,.5],122:[0,.45833,0,0,.47639],126:[.35,.34444,0,0,.55],160:[0,0,0,0,.25],168:[0,.69444,0,0,.55],176:[0,.69444,0,0,.73334],180:[0,.69444,0,0,.55],184:[.17014,0,0,0,.48889],305:[0,.45833,0,0,.25556],567:[.19444,.45833,0,0,.28611],710:[0,.69444,0,0,.55],711:[0,.63542,0,0,.55],713:[0,.63778,0,0,.55],728:[0,.69444,0,0,.55],729:[0,.69444,0,0,.30556],730:[0,.69444,0,0,.73334],732:[0,.69444,0,0,.55],733:[0,.69444,0,0,.55],915:[0,.69444,0,0,.58056],916:[0,.69444,0,0,.91667],920:[0,.69444,0,0,.85556],923:[0,.69444,0,0,.67223],926:[0,.69444,0,0,.73334],928:[0,.69444,0,0,.79445],931:[0,.69444,0,0,.79445],933:[0,.69444,0,0,.85556],934:[0,.69444,0,0,.79445],936:[0,.69444,0,0,.85556],937:[0,.69444,0,0,.79445],8211:[0,.45833,.03056,0,.55],8212:[0,.45833,.03056,0,1.10001],8216:[0,.69444,0,0,.30556],8217:[0,.69444,0,0,.30556],8220:[0,.69444,0,0,.55834],8221:[0,.69444,0,0,.55834]},"SansSerif-Italic":{32:[0,0,0,0,.25],33:[0,.69444,.05733,0,.31945],34:[0,.69444,.00316,0,.5],35:[.19444,.69444,.05087,0,.83334],36:[.05556,.75,.11156,0,.5],37:[.05556,.75,.03126,0,.83334],38:[0,.69444,.03058,0,.75834],39:[0,.69444,.07816,0,.27778],40:[.25,.75,.13164,0,.38889],41:[.25,.75,.02536,0,.38889],42:[0,.75,.11775,0,.5],43:[.08333,.58333,.02536,0,.77778],44:[.125,.08333,0,0,.27778],45:[0,.44444,.01946,0,.33333],46:[0,.08333,0,0,.27778],47:[.25,.75,.13164,0,.5],48:[0,.65556,.11156,0,.5],49:[0,.65556,.11156,0,.5],50:[0,.65556,.11156,0,.5],51:[0,.65556,.11156,0,.5],52:[0,.65556,.11156,0,.5],53:[0,.65556,.11156,0,.5],54:[0,.65556,.11156,0,.5],55:[0,.65556,.11156,0,.5],56:[0,.65556,.11156,0,.5],57:[0,.65556,.11156,0,.5],58:[0,.44444,.02502,0,.27778],59:[.125,.44444,.02502,0,.27778],61:[-.13,.37,.05087,0,.77778],63:[0,.69444,.11809,0,.47222],64:[0,.69444,.07555,0,.66667],65:[0,.69444,0,0,.66667],66:[0,.69444,.08293,0,.66667],67:[0,.69444,.11983,0,.63889],68:[0,.69444,.07555,0,.72223],69:[0,.69444,.11983,0,.59722],70:[0,.69444,.13372,0,.56945],71:[0,.69444,.11983,0,.66667],72:[0,.69444,.08094,0,.70834],73:[0,.69444,.13372,0,.27778],74:[0,.69444,.08094,0,.47222],75:[0,.69444,.11983,0,.69445],76:[0,.69444,0,0,.54167],77:[0,.69444,.08094,0,.875],78:[0,.69444,.08094,0,.70834],79:[0,.69444,.07555,0,.73611],80:[0,.69444,.08293,0,.63889],81:[.125,.69444,.07555,0,.73611],82:[0,.69444,.08293,0,.64584],83:[0,.69444,.09205,0,.55556],84:[0,.69444,.13372,0,.68056],85:[0,.69444,.08094,0,.6875],86:[0,.69444,.1615,0,.66667],87:[0,.69444,.1615,0,.94445],88:[0,.69444,.13372,0,.66667],89:[0,.69444,.17261,0,.66667],90:[0,.69444,.11983,0,.61111],91:[.25,.75,.15942,0,.28889],93:[.25,.75,.08719,0,.28889],94:[0,.69444,.0799,0,.5],95:[.35,.09444,.08616,0,.5],97:[0,.44444,.00981,0,.48056],98:[0,.69444,.03057,0,.51667],99:[0,.44444,.08336,0,.44445],100:[0,.69444,.09483,0,.51667],101:[0,.44444,.06778,0,.44445],102:[0,.69444,.21705,0,.30556],103:[.19444,.44444,.10836,0,.5],104:[0,.69444,.01778,0,.51667],105:[0,.67937,.09718,0,.23889],106:[.19444,.67937,.09162,0,.26667],107:[0,.69444,.08336,0,.48889],108:[0,.69444,.09483,0,.23889],109:[0,.44444,.01778,0,.79445],110:[0,.44444,.01778,0,.51667],111:[0,.44444,.06613,0,.5],112:[.19444,.44444,.0389,0,.51667],113:[.19444,.44444,.04169,0,.51667],114:[0,.44444,.10836,0,.34167],115:[0,.44444,.0778,0,.38333],116:[0,.57143,.07225,0,.36111],117:[0,.44444,.04169,0,.51667],118:[0,.44444,.10836,0,.46111],119:[0,.44444,.10836,0,.68334],120:[0,.44444,.09169,0,.46111],121:[.19444,.44444,.10836,0,.46111],122:[0,.44444,.08752,0,.43472],126:[.35,.32659,.08826,0,.5],160:[0,0,0,0,.25],168:[0,.67937,.06385,0,.5],176:[0,.69444,0,0,.73752],184:[.17014,0,0,0,.44445],305:[0,.44444,.04169,0,.23889],567:[.19444,.44444,.04169,0,.26667],710:[0,.69444,.0799,0,.5],711:[0,.63194,.08432,0,.5],713:[0,.60889,.08776,0,.5],714:[0,.69444,.09205,0,.5],715:[0,.69444,0,0,.5],728:[0,.69444,.09483,0,.5],729:[0,.67937,.07774,0,.27778],730:[0,.69444,0,0,.73752],732:[0,.67659,.08826,0,.5],733:[0,.69444,.09205,0,.5],915:[0,.69444,.13372,0,.54167],916:[0,.69444,0,0,.83334],920:[0,.69444,.07555,0,.77778],923:[0,.69444,0,0,.61111],926:[0,.69444,.12816,0,.66667],928:[0,.69444,.08094,0,.70834],931:[0,.69444,.11983,0,.72222],933:[0,.69444,.09031,0,.77778],934:[0,.69444,.04603,0,.72222],936:[0,.69444,.09031,0,.77778],937:[0,.69444,.08293,0,.72222],8211:[0,.44444,.08616,0,.5],8212:[0,.44444,.08616,0,1],8216:[0,.69444,.07816,0,.27778],8217:[0,.69444,.07816,0,.27778],8220:[0,.69444,.14205,0,.5],8221:[0,.69444,.00316,0,.5]},"SansSerif-Regular":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.31945],34:[0,.69444,0,0,.5],35:[.19444,.69444,0,0,.83334],36:[.05556,.75,0,0,.5],37:[.05556,.75,0,0,.83334],38:[0,.69444,0,0,.75834],39:[0,.69444,0,0,.27778],40:[.25,.75,0,0,.38889],41:[.25,.75,0,0,.38889],42:[0,.75,0,0,.5],43:[.08333,.58333,0,0,.77778],44:[.125,.08333,0,0,.27778],45:[0,.44444,0,0,.33333],46:[0,.08333,0,0,.27778],47:[.25,.75,0,0,.5],48:[0,.65556,0,0,.5],49:[0,.65556,0,0,.5],50:[0,.65556,0,0,.5],51:[0,.65556,0,0,.5],52:[0,.65556,0,0,.5],53:[0,.65556,0,0,.5],54:[0,.65556,0,0,.5],55:[0,.65556,0,0,.5],56:[0,.65556,0,0,.5],57:[0,.65556,0,0,.5],58:[0,.44444,0,0,.27778],59:[.125,.44444,0,0,.27778],61:[-.13,.37,0,0,.77778],63:[0,.69444,0,0,.47222],64:[0,.69444,0,0,.66667],65:[0,.69444,0,0,.66667],66:[0,.69444,0,0,.66667],67:[0,.69444,0,0,.63889],68:[0,.69444,0,0,.72223],69:[0,.69444,0,0,.59722],70:[0,.69444,0,0,.56945],71:[0,.69444,0,0,.66667],72:[0,.69444,0,0,.70834],73:[0,.69444,0,0,.27778],74:[0,.69444,0,0,.47222],75:[0,.69444,0,0,.69445],76:[0,.69444,0,0,.54167],77:[0,.69444,0,0,.875],78:[0,.69444,0,0,.70834],79:[0,.69444,0,0,.73611],80:[0,.69444,0,0,.63889],81:[.125,.69444,0,0,.73611],82:[0,.69444,0,0,.64584],83:[0,.69444,0,0,.55556],84:[0,.69444,0,0,.68056],85:[0,.69444,0,0,.6875],86:[0,.69444,.01389,0,.66667],87:[0,.69444,.01389,0,.94445],88:[0,.69444,0,0,.66667],89:[0,.69444,.025,0,.66667],90:[0,.69444,0,0,.61111],91:[.25,.75,0,0,.28889],93:[.25,.75,0,0,.28889],94:[0,.69444,0,0,.5],95:[.35,.09444,.02778,0,.5],97:[0,.44444,0,0,.48056],98:[0,.69444,0,0,.51667],99:[0,.44444,0,0,.44445],100:[0,.69444,0,0,.51667],101:[0,.44444,0,0,.44445],102:[0,.69444,.06944,0,.30556],103:[.19444,.44444,.01389,0,.5],104:[0,.69444,0,0,.51667],105:[0,.67937,0,0,.23889],106:[.19444,.67937,0,0,.26667],107:[0,.69444,0,0,.48889],108:[0,.69444,0,0,.23889],109:[0,.44444,0,0,.79445],110:[0,.44444,0,0,.51667],111:[0,.44444,0,0,.5],112:[.19444,.44444,0,0,.51667],113:[.19444,.44444,0,0,.51667],114:[0,.44444,.01389,0,.34167],115:[0,.44444,0,0,.38333],116:[0,.57143,0,0,.36111],117:[0,.44444,0,0,.51667],118:[0,.44444,.01389,0,.46111],119:[0,.44444,.01389,0,.68334],120:[0,.44444,0,0,.46111],121:[.19444,.44444,.01389,0,.46111],122:[0,.44444,0,0,.43472],126:[.35,.32659,0,0,.5],160:[0,0,0,0,.25],168:[0,.67937,0,0,.5],176:[0,.69444,0,0,.66667],184:[.17014,0,0,0,.44445],305:[0,.44444,0,0,.23889],567:[.19444,.44444,0,0,.26667],710:[0,.69444,0,0,.5],711:[0,.63194,0,0,.5],713:[0,.60889,0,0,.5],714:[0,.69444,0,0,.5],715:[0,.69444,0,0,.5],728:[0,.69444,0,0,.5],729:[0,.67937,0,0,.27778],730:[0,.69444,0,0,.66667],732:[0,.67659,0,0,.5],733:[0,.69444,0,0,.5],915:[0,.69444,0,0,.54167],916:[0,.69444,0,0,.83334],920:[0,.69444,0,0,.77778],923:[0,.69444,0,0,.61111],926:[0,.69444,0,0,.66667],928:[0,.69444,0,0,.70834],931:[0,.69444,0,0,.72222],933:[0,.69444,0,0,.77778],934:[0,.69444,0,0,.72222],936:[0,.69444,0,0,.77778],937:[0,.69444,0,0,.72222],8211:[0,.44444,.02778,0,.5],8212:[0,.44444,.02778,0,1],8216:[0,.69444,0,0,.27778],8217:[0,.69444,0,0,.27778],8220:[0,.69444,0,0,.5],8221:[0,.69444,0,0,.5]},"Script-Regular":{32:[0,0,0,0,.25],65:[0,.7,.22925,0,.80253],66:[0,.7,.04087,0,.90757],67:[0,.7,.1689,0,.66619],68:[0,.7,.09371,0,.77443],69:[0,.7,.18583,0,.56162],70:[0,.7,.13634,0,.89544],71:[0,.7,.17322,0,.60961],72:[0,.7,.29694,0,.96919],73:[0,.7,.19189,0,.80907],74:[.27778,.7,.19189,0,1.05159],75:[0,.7,.31259,0,.91364],76:[0,.7,.19189,0,.87373],77:[0,.7,.15981,0,1.08031],78:[0,.7,.3525,0,.9015],79:[0,.7,.08078,0,.73787],80:[0,.7,.08078,0,1.01262],81:[0,.7,.03305,0,.88282],82:[0,.7,.06259,0,.85],83:[0,.7,.19189,0,.86767],84:[0,.7,.29087,0,.74697],85:[0,.7,.25815,0,.79996],86:[0,.7,.27523,0,.62204],87:[0,.7,.27523,0,.80532],88:[0,.7,.26006,0,.94445],89:[0,.7,.2939,0,.70961],90:[0,.7,.24037,0,.8212],160:[0,0,0,0,.25]},"Size1-Regular":{32:[0,0,0,0,.25],40:[.35001,.85,0,0,.45834],41:[.35001,.85,0,0,.45834],47:[.35001,.85,0,0,.57778],91:[.35001,.85,0,0,.41667],92:[.35001,.85,0,0,.57778],93:[.35001,.85,0,0,.41667],123:[.35001,.85,0,0,.58334],125:[.35001,.85,0,0,.58334],160:[0,0,0,0,.25],710:[0,.72222,0,0,.55556],732:[0,.72222,0,0,.55556],770:[0,.72222,0,0,.55556],771:[0,.72222,0,0,.55556],8214:[-99e-5,.601,0,0,.77778],8593:[1e-5,.6,0,0,.66667],8595:[1e-5,.6,0,0,.66667],8657:[1e-5,.6,0,0,.77778],8659:[1e-5,.6,0,0,.77778],8719:[.25001,.75,0,0,.94445],8720:[.25001,.75,0,0,.94445],8721:[.25001,.75,0,0,1.05556],8730:[.35001,.85,0,0,1],8739:[-.00599,.606,0,0,.33333],8741:[-.00599,.606,0,0,.55556],8747:[.30612,.805,.19445,0,.47222],8748:[.306,.805,.19445,0,.47222],8749:[.306,.805,.19445,0,.47222],8750:[.30612,.805,.19445,0,.47222],8896:[.25001,.75,0,0,.83334],8897:[.25001,.75,0,0,.83334],8898:[.25001,.75,0,0,.83334],8899:[.25001,.75,0,0,.83334],8968:[.35001,.85,0,0,.47222],8969:[.35001,.85,0,0,.47222],8970:[.35001,.85,0,0,.47222],8971:[.35001,.85,0,0,.47222],9168:[-99e-5,.601,0,0,.66667],10216:[.35001,.85,0,0,.47222],10217:[.35001,.85,0,0,.47222],10752:[.25001,.75,0,0,1.11111],10753:[.25001,.75,0,0,1.11111],10754:[.25001,.75,0,0,1.11111],10756:[.25001,.75,0,0,.83334],10758:[.25001,.75,0,0,.83334]},"Size2-Regular":{32:[0,0,0,0,.25],40:[.65002,1.15,0,0,.59722],41:[.65002,1.15,0,0,.59722],47:[.65002,1.15,0,0,.81111],91:[.65002,1.15,0,0,.47222],92:[.65002,1.15,0,0,.81111],93:[.65002,1.15,0,0,.47222],123:[.65002,1.15,0,0,.66667],125:[.65002,1.15,0,0,.66667],160:[0,0,0,0,.25],710:[0,.75,0,0,1],732:[0,.75,0,0,1],770:[0,.75,0,0,1],771:[0,.75,0,0,1],8719:[.55001,1.05,0,0,1.27778],8720:[.55001,1.05,0,0,1.27778],8721:[.55001,1.05,0,0,1.44445],8730:[.65002,1.15,0,0,1],8747:[.86225,1.36,.44445,0,.55556],8748:[.862,1.36,.44445,0,.55556],8749:[.862,1.36,.44445,0,.55556],8750:[.86225,1.36,.44445,0,.55556],8896:[.55001,1.05,0,0,1.11111],8897:[.55001,1.05,0,0,1.11111],8898:[.55001,1.05,0,0,1.11111],8899:[.55001,1.05,0,0,1.11111],8968:[.65002,1.15,0,0,.52778],8969:[.65002,1.15,0,0,.52778],8970:[.65002,1.15,0,0,.52778],8971:[.65002,1.15,0,0,.52778],10216:[.65002,1.15,0,0,.61111],10217:[.65002,1.15,0,0,.61111],10752:[.55001,1.05,0,0,1.51112],10753:[.55001,1.05,0,0,1.51112],10754:[.55001,1.05,0,0,1.51112],10756:[.55001,1.05,0,0,1.11111],10758:[.55001,1.05,0,0,1.11111]},"Size3-Regular":{32:[0,0,0,0,.25],40:[.95003,1.45,0,0,.73611],41:[.95003,1.45,0,0,.73611],47:[.95003,1.45,0,0,1.04445],91:[.95003,1.45,0,0,.52778],92:[.95003,1.45,0,0,1.04445],93:[.95003,1.45,0,0,.52778],123:[.95003,1.45,0,0,.75],125:[.95003,1.45,0,0,.75],160:[0,0,0,0,.25],710:[0,.75,0,0,1.44445],732:[0,.75,0,0,1.44445],770:[0,.75,0,0,1.44445],771:[0,.75,0,0,1.44445],8730:[.95003,1.45,0,0,1],8968:[.95003,1.45,0,0,.58334],8969:[.95003,1.45,0,0,.58334],8970:[.95003,1.45,0,0,.58334],8971:[.95003,1.45,0,0,.58334],10216:[.95003,1.45,0,0,.75],10217:[.95003,1.45,0,0,.75]},"Size4-Regular":{32:[0,0,0,0,.25],40:[1.25003,1.75,0,0,.79167],41:[1.25003,1.75,0,0,.79167],47:[1.25003,1.75,0,0,1.27778],91:[1.25003,1.75,0,0,.58334],92:[1.25003,1.75,0,0,1.27778],93:[1.25003,1.75,0,0,.58334],123:[1.25003,1.75,0,0,.80556],125:[1.25003,1.75,0,0,.80556],160:[0,0,0,0,.25],710:[0,.825,0,0,1.8889],732:[0,.825,0,0,1.8889],770:[0,.825,0,0,1.8889],771:[0,.825,0,0,1.8889],8730:[1.25003,1.75,0,0,1],8968:[1.25003,1.75,0,0,.63889],8969:[1.25003,1.75,0,0,.63889],8970:[1.25003,1.75,0,0,.63889],8971:[1.25003,1.75,0,0,.63889],9115:[.64502,1.155,0,0,.875],9116:[1e-5,.6,0,0,.875],9117:[.64502,1.155,0,0,.875],9118:[.64502,1.155,0,0,.875],9119:[1e-5,.6,0,0,.875],9120:[.64502,1.155,0,0,.875],9121:[.64502,1.155,0,0,.66667],9122:[-99e-5,.601,0,0,.66667],9123:[.64502,1.155,0,0,.66667],9124:[.64502,1.155,0,0,.66667],9125:[-99e-5,.601,0,0,.66667],9126:[.64502,1.155,0,0,.66667],9127:[1e-5,.9,0,0,.88889],9128:[.65002,1.15,0,0,.88889],9129:[.90001,0,0,0,.88889],9130:[0,.3,0,0,.88889],9131:[1e-5,.9,0,0,.88889],9132:[.65002,1.15,0,0,.88889],9133:[.90001,0,0,0,.88889],9143:[.88502,.915,0,0,1.05556],10216:[1.25003,1.75,0,0,.80556],10217:[1.25003,1.75,0,0,.80556],57344:[-.00499,.605,0,0,1.05556],57345:[-.00499,.605,0,0,1.05556],57680:[0,.12,0,0,.45],57681:[0,.12,0,0,.45],57682:[0,.12,0,0,.45],57683:[0,.12,0,0,.45]},"Typewriter-Regular":{32:[0,0,0,0,.525],33:[0,.61111,0,0,.525],34:[0,.61111,0,0,.525],35:[0,.61111,0,0,.525],36:[.08333,.69444,0,0,.525],37:[.08333,.69444,0,0,.525],38:[0,.61111,0,0,.525],39:[0,.61111,0,0,.525],40:[.08333,.69444,0,0,.525],41:[.08333,.69444,0,0,.525],42:[0,.52083,0,0,.525],43:[-.08056,.53055,0,0,.525],44:[.13889,.125,0,0,.525],45:[-.08056,.53055,0,0,.525],46:[0,.125,0,0,.525],47:[.08333,.69444,0,0,.525],48:[0,.61111,0,0,.525],49:[0,.61111,0,0,.525],50:[0,.61111,0,0,.525],51:[0,.61111,0,0,.525],52:[0,.61111,0,0,.525],53:[0,.61111,0,0,.525],54:[0,.61111,0,0,.525],55:[0,.61111,0,0,.525],56:[0,.61111,0,0,.525],57:[0,.61111,0,0,.525],58:[0,.43056,0,0,.525],59:[.13889,.43056,0,0,.525],60:[-.05556,.55556,0,0,.525],61:[-.19549,.41562,0,0,.525],62:[-.05556,.55556,0,0,.525],63:[0,.61111,0,0,.525],64:[0,.61111,0,0,.525],65:[0,.61111,0,0,.525],66:[0,.61111,0,0,.525],67:[0,.61111,0,0,.525],68:[0,.61111,0,0,.525],69:[0,.61111,0,0,.525],70:[0,.61111,0,0,.525],71:[0,.61111,0,0,.525],72:[0,.61111,0,0,.525],73:[0,.61111,0,0,.525],74:[0,.61111,0,0,.525],75:[0,.61111,0,0,.525],76:[0,.61111,0,0,.525],77:[0,.61111,0,0,.525],78:[0,.61111,0,0,.525],79:[0,.61111,0,0,.525],80:[0,.61111,0,0,.525],81:[.13889,.61111,0,0,.525],82:[0,.61111,0,0,.525],83:[0,.61111,0,0,.525],84:[0,.61111,0,0,.525],85:[0,.61111,0,0,.525],86:[0,.61111,0,0,.525],87:[0,.61111,0,0,.525],88:[0,.61111,0,0,.525],89:[0,.61111,0,0,.525],90:[0,.61111,0,0,.525],91:[.08333,.69444,0,0,.525],92:[.08333,.69444,0,0,.525],93:[.08333,.69444,0,0,.525],94:[0,.61111,0,0,.525],95:[.09514,0,0,0,.525],96:[0,.61111,0,0,.525],97:[0,.43056,0,0,.525],98:[0,.61111,0,0,.525],99:[0,.43056,0,0,.525],100:[0,.61111,0,0,.525],101:[0,.43056,0,0,.525],102:[0,.61111,0,0,.525],103:[.22222,.43056,0,0,.525],104:[0,.61111,0,0,.525],105:[0,.61111,0,0,.525],106:[.22222,.61111,0,0,.525],107:[0,.61111,0,0,.525],108:[0,.61111,0,0,.525],109:[0,.43056,0,0,.525],110:[0,.43056,0,0,.525],111:[0,.43056,0,0,.525],112:[.22222,.43056,0,0,.525],113:[.22222,.43056,0,0,.525],114:[0,.43056,0,0,.525],115:[0,.43056,0,0,.525],116:[0,.55358,0,0,.525],117:[0,.43056,0,0,.525],118:[0,.43056,0,0,.525],119:[0,.43056,0,0,.525],120:[0,.43056,0,0,.525],121:[.22222,.43056,0,0,.525],122:[0,.43056,0,0,.525],123:[.08333,.69444,0,0,.525],124:[.08333,.69444,0,0,.525],125:[.08333,.69444,0,0,.525],126:[0,.61111,0,0,.525],127:[0,.61111,0,0,.525],160:[0,0,0,0,.525],176:[0,.61111,0,0,.525],184:[.19445,0,0,0,.525],305:[0,.43056,0,0,.525],567:[.22222,.43056,0,0,.525],711:[0,.56597,0,0,.525],713:[0,.56555,0,0,.525],714:[0,.61111,0,0,.525],715:[0,.61111,0,0,.525],728:[0,.61111,0,0,.525],730:[0,.61111,0,0,.525],770:[0,.61111,0,0,.525],771:[0,.61111,0,0,.525],776:[0,.61111,0,0,.525],915:[0,.61111,0,0,.525],916:[0,.61111,0,0,.525],920:[0,.61111,0,0,.525],923:[0,.61111,0,0,.525],926:[0,.61111,0,0,.525],928:[0,.61111,0,0,.525],931:[0,.61111,0,0,.525],933:[0,.61111,0,0,.525],934:[0,.61111,0,0,.525],936:[0,.61111,0,0,.525],937:[0,.61111,0,0,.525],8216:[0,.61111,0,0,.525],8217:[0,.61111,0,0,.525],8242:[0,.61111,0,0,.525],9251:[.11111,.21944,0,0,.525]}},J0={slant:[.25,.25,.25],space:[0,0,0],stretch:[0,0,0],shrink:[0,0,0],xHeight:[.431,.431,.431],quad:[1,1.171,1.472],extraSpace:[0,0,0],num1:[.677,.732,.925],num2:[.394,.384,.387],num3:[.444,.471,.504],denom1:[.686,.752,1.025],denom2:[.345,.344,.532],sup1:[.413,.503,.504],sup2:[.363,.431,.404],sup3:[.289,.286,.294],sub1:[.15,.143,.2],sub2:[.247,.286,.4],supDrop:[.386,.353,.494],subDrop:[.05,.071,.1],delim1:[2.39,1.7,1.98],delim2:[1.01,1.157,1.42],axisHeight:[.25,.25,.25],defaultRuleThickness:[.04,.049,.049],bigOpSpacing1:[.111,.111,.111],bigOpSpacing2:[.166,.166,.166],bigOpSpacing3:[.2,.2,.2],bigOpSpacing4:[.6,.611,.611],bigOpSpacing5:[.1,.143,.143],sqrtRuleThickness:[.04,.04,.04],ptPerEm:[10,10,10],doubleRuleSep:[.2,.2,.2],arrayRuleWidth:[.04,.04,.04],fboxsep:[.3,.3,.3],fboxrule:[.04,.04,.04]},af={Å:"A",Ð:"D",Þ:"o",å:"a",ð:"d",þ:"o",А:"A",Б:"B",В:"B",Г:"F",Д:"A",Е:"E",Ж:"K",З:"3",И:"N",Й:"N",К:"K",Л:"N",М:"M",Н:"H",О:"O",П:"N",Р:"P",С:"C",Т:"T",У:"y",Ф:"O",Х:"X",Ц:"U",Ч:"h",Ш:"W",Щ:"W",Ъ:"B",Ы:"X",Ь:"B",Э:"3",Ю:"X",Я:"R",а:"a",б:"b",в:"a",г:"r",д:"y",е:"e",ж:"m",з:"e",и:"n",й:"n",к:"n",л:"n",м:"m",н:"n",о:"o",п:"n",р:"p",с:"c",т:"o",у:"y",ф:"b",х:"x",ц:"n",ч:"n",ш:"w",щ:"w",ъ:"a",ы:"m",ь:"a",э:"e",ю:"m",я:"r"};function ax(i,e){Ei[i]=e}function zh(i,e,t){if(!Ei[e])throw new Error("Font metrics not found for font: "+e+".");var n=i.charCodeAt(0),r=Ei[e][n];if(!r&&i[0]in af&&(n=af[i[0]].charCodeAt(0),r=Ei[e][n]),!r&&t==="text"&&Hf(n)&&(r=Ei[e][77]),r)return{depth:r[0],height:r[1],italic:r[2],skew:r[3],width:r[4]}}var j0={};function ox(i){var e;if(i>=5?e=0:i>=3?e=1:e=2,!j0[e]){var t=j0[e]={cssEmPerMu:J0.quad[e]/18};for(var n of Object.keys(J0))t[n]=J0[n][e]}return j0[e]}var Ot={math:{},text:{}};function x(i,e,t,n,r,s){Ot[i][r]={font:e,group:t,replace:n},s&&n&&(Ot[i][n]=Ot[i][r])}var y="math",he="text",E="main",z="ams",Vt="accent-token",Pe="bin",Nn="close",_s="inner",We="mathord",nn="op-token",Yn="open",ba="punct",D="rel",Xi="spacing",O="textord";x(y,E,D,"≡","\\equiv",!0);x(y,E,D,"≺","\\prec",!0);x(y,E,D,"≻","\\succ",!0);x(y,E,D,"∼","\\sim",!0);x(y,E,D,"⊥","\\perp");x(y,E,D,"⪯","\\preceq",!0);x(y,E,D,"⪰","\\succeq",!0);x(y,E,D,"≃","\\simeq",!0);x(y,E,D,"∣","\\mid",!0);x(y,E,D,"≪","\\ll",!0);x(y,E,D,"≫","\\gg",!0);x(y,E,D,"≍","\\asymp",!0);x(y,E,D,"∥","\\parallel");x(y,E,D,"⋈","\\bowtie",!0);x(y,E,D,"⌣","\\smile",!0);x(y,E,D,"⊑","\\sqsubseteq",!0);x(y,E,D,"⊒","\\sqsupseteq",!0);x(y,E,D,"≐","\\doteq",!0);x(y,E,D,"⌢","\\frown",!0);x(y,E,D,"∋","\\ni",!0);x(y,E,D,"∝","\\propto",!0);x(y,E,D,"⊢","\\vdash",!0);x(y,E,D,"⊣","\\dashv",!0);x(y,E,D,"∋","\\owns");x(y,E,ba,".","\\ldotp");x(y,E,ba,"⋅","\\cdotp");x(y,E,ba,"⋅","·");x(he,E,O,"⋅","·");x(y,E,O,"#","\\#");x(he,E,O,"#","\\#");x(y,E,O,"&","\\&");x(he,E,O,"&","\\&");x(y,E,O,"ℵ","\\aleph",!0);x(y,E,O,"∀","\\forall",!0);x(y,E,O,"ℏ","\\hbar",!0);x(y,E,O,"∃","\\exists",!0);x(y,E,O,"∇","\\nabla",!0);x(y,E,O,"♭","\\flat",!0);x(y,E,O,"ℓ","\\ell",!0);x(y,E,O,"♮","\\natural",!0);x(y,E,O,"♣","\\clubsuit",!0);x(y,E,O,"℘","\\wp",!0);x(y,E,O,"♯","\\sharp",!0);x(y,E,O,"♢","\\diamondsuit",!0);x(y,E,O,"ℜ","\\Re",!0);x(y,E,O,"♡","\\heartsuit",!0);x(y,E,O,"ℑ","\\Im",!0);x(y,E,O,"♠","\\spadesuit",!0);x(y,E,O,"§","\\S",!0);x(he,E,O,"§","\\S");x(y,E,O,"¶","\\P",!0);x(he,E,O,"¶","\\P");x(y,E,O,"†","\\dag");x(he,E,O,"†","\\dag");x(he,E,O,"†","\\textdagger");x(y,E,O,"‡","\\ddag");x(he,E,O,"‡","\\ddag");x(he,E,O,"‡","\\textdaggerdbl");x(y,E,Nn,"⎱","\\rmoustache",!0);x(y,E,Yn,"⎰","\\lmoustache",!0);x(y,E,Nn,"⟯","\\rgroup",!0);x(y,E,Yn,"⟮","\\lgroup",!0);x(y,E,Pe,"∓","\\mp",!0);x(y,E,Pe,"⊖","\\ominus",!0);x(y,E,Pe,"⊎","\\uplus",!0);x(y,E,Pe,"⊓","\\sqcap",!0);x(y,E,Pe,"∗","\\ast");x(y,E,Pe,"⊔","\\sqcup",!0);x(y,E,Pe,"◯","\\bigcirc",!0);x(y,E,Pe,"∙","\\bullet",!0);x(y,E,Pe,"‡","\\ddagger");x(y,E,Pe,"≀","\\wr",!0);x(y,E,Pe,"⨿","\\amalg");x(y,E,Pe,"&","\\And");x(y,E,D,"⟵","\\longleftarrow",!0);x(y,E,D,"⇐","\\Leftarrow",!0);x(y,E,D,"⟸","\\Longleftarrow",!0);x(y,E,D,"⟶","\\longrightarrow",!0);x(y,E,D,"⇒","\\Rightarrow",!0);x(y,E,D,"⟹","\\Longrightarrow",!0);x(y,E,D,"↔","\\leftrightarrow",!0);x(y,E,D,"⟷","\\longleftrightarrow",!0);x(y,E,D,"⇔","\\Leftrightarrow",!0);x(y,E,D,"⟺","\\Longleftrightarrow",!0);x(y,E,D,"↦","\\mapsto",!0);x(y,E,D,"⟼","\\longmapsto",!0);x(y,E,D,"↗","\\nearrow",!0);x(y,E,D,"↩","\\hookleftarrow",!0);x(y,E,D,"↪","\\hookrightarrow",!0);x(y,E,D,"↘","\\searrow",!0);x(y,E,D,"↼","\\leftharpoonup",!0);x(y,E,D,"⇀","\\rightharpoonup",!0);x(y,E,D,"↙","\\swarrow",!0);x(y,E,D,"↽","\\leftharpoondown",!0);x(y,E,D,"⇁","\\rightharpoondown",!0);x(y,E,D,"↖","\\nwarrow",!0);x(y,E,D,"⇌","\\rightleftharpoons",!0);x(y,z,D,"≮","\\nless",!0);x(y,z,D,"","\\@nleqslant");x(y,z,D,"","\\@nleqq");x(y,z,D,"⪇","\\lneq",!0);x(y,z,D,"≨","\\lneqq",!0);x(y,z,D,"","\\@lvertneqq");x(y,z,D,"⋦","\\lnsim",!0);x(y,z,D,"⪉","\\lnapprox",!0);x(y,z,D,"⊀","\\nprec",!0);x(y,z,D,"⋠","\\npreceq",!0);x(y,z,D,"⋨","\\precnsim",!0);x(y,z,D,"⪹","\\precnapprox",!0);x(y,z,D,"≁","\\nsim",!0);x(y,z,D,"","\\@nshortmid");x(y,z,D,"∤","\\nmid",!0);x(y,z,D,"⊬","\\nvdash",!0);x(y,z,D,"⊭","\\nvDash",!0);x(y,z,D,"⋪","\\ntriangleleft");x(y,z,D,"⋬","\\ntrianglelefteq",!0);x(y,z,D,"⊊","\\subsetneq",!0);x(y,z,D,"","\\@varsubsetneq");x(y,z,D,"⫋","\\subsetneqq",!0);x(y,z,D,"","\\@varsubsetneqq");x(y,z,D,"≯","\\ngtr",!0);x(y,z,D,"","\\@ngeqslant");x(y,z,D,"","\\@ngeqq");x(y,z,D,"⪈","\\gneq",!0);x(y,z,D,"≩","\\gneqq",!0);x(y,z,D,"","\\@gvertneqq");x(y,z,D,"⋧","\\gnsim",!0);x(y,z,D,"⪊","\\gnapprox",!0);x(y,z,D,"⊁","\\nsucc",!0);x(y,z,D,"⋡","\\nsucceq",!0);x(y,z,D,"⋩","\\succnsim",!0);x(y,z,D,"⪺","\\succnapprox",!0);x(y,z,D,"≆","\\ncong",!0);x(y,z,D,"","\\@nshortparallel");x(y,z,D,"∦","\\nparallel",!0);x(y,z,D,"⊯","\\nVDash",!0);x(y,z,D,"⋫","\\ntriangleright");x(y,z,D,"⋭","\\ntrianglerighteq",!0);x(y,z,D,"","\\@nsupseteqq");x(y,z,D,"⊋","\\supsetneq",!0);x(y,z,D,"","\\@varsupsetneq");x(y,z,D,"⫌","\\supsetneqq",!0);x(y,z,D,"","\\@varsupsetneqq");x(y,z,D,"⊮","\\nVdash",!0);x(y,z,D,"⪵","\\precneqq",!0);x(y,z,D,"⪶","\\succneqq",!0);x(y,z,D,"","\\@nsubseteqq");x(y,z,Pe,"⊴","\\unlhd");x(y,z,Pe,"⊵","\\unrhd");x(y,z,D,"↚","\\nleftarrow",!0);x(y,z,D,"↛","\\nrightarrow",!0);x(y,z,D,"⇍","\\nLeftarrow",!0);x(y,z,D,"⇏","\\nRightarrow",!0);x(y,z,D,"↮","\\nleftrightarrow",!0);x(y,z,D,"⇎","\\nLeftrightarrow",!0);x(y,z,D,"△","\\vartriangle");x(y,z,O,"ℏ","\\hslash");x(y,z,O,"▽","\\triangledown");x(y,z,O,"◊","\\lozenge");x(y,z,O,"Ⓢ","\\circledS");x(y,z,O,"®","\\circledR");x(he,z,O,"®","\\circledR");x(y,z,O,"∡","\\measuredangle",!0);x(y,z,O,"∄","\\nexists");x(y,z,O,"℧","\\mho");x(y,z,O,"Ⅎ","\\Finv",!0);x(y,z,O,"⅁","\\Game",!0);x(y,z,O,"‵","\\backprime");x(y,z,O,"▲","\\blacktriangle");x(y,z,O,"▼","\\blacktriangledown");x(y,z,O,"■","\\blacksquare");x(y,z,O,"⧫","\\blacklozenge");x(y,z,O,"★","\\bigstar");x(y,z,O,"∢","\\sphericalangle",!0);x(y,z,O,"∁","\\complement",!0);x(y,z,O,"ð","\\eth",!0);x(he,E,O,"ð","ð");x(y,z,O,"╱","\\diagup");x(y,z,O,"╲","\\diagdown");x(y,z,O,"□","\\square");x(y,z,O,"□","\\Box");x(y,z,O,"◊","\\Diamond");x(y,z,O,"¥","\\yen",!0);x(he,z,O,"¥","\\yen",!0);x(y,z,O,"✓","\\checkmark",!0);x(he,z,O,"✓","\\checkmark");x(y,z,O,"ℶ","\\beth",!0);x(y,z,O,"ℸ","\\daleth",!0);x(y,z,O,"ℷ","\\gimel",!0);x(y,z,O,"ϝ","\\digamma",!0);x(y,z,O,"ϰ","\\varkappa");x(y,z,Yn,"┌","\\@ulcorner",!0);x(y,z,Nn,"┐","\\@urcorner",!0);x(y,z,Yn,"└","\\@llcorner",!0);x(y,z,Nn,"┘","\\@lrcorner",!0);x(y,z,D,"≦","\\leqq",!0);x(y,z,D,"⩽","\\leqslant",!0);x(y,z,D,"⪕","\\eqslantless",!0);x(y,z,D,"≲","\\lesssim",!0);x(y,z,D,"⪅","\\lessapprox",!0);x(y,z,D,"≊","\\approxeq",!0);x(y,z,Pe,"⋖","\\lessdot");x(y,z,D,"⋘","\\lll",!0);x(y,z,D,"≶","\\lessgtr",!0);x(y,z,D,"⋚","\\lesseqgtr",!0);x(y,z,D,"⪋","\\lesseqqgtr",!0);x(y,z,D,"≑","\\doteqdot");x(y,z,D,"≓","\\risingdotseq",!0);x(y,z,D,"≒","\\fallingdotseq",!0);x(y,z,D,"∽","\\backsim",!0);x(y,z,D,"⋍","\\backsimeq",!0);x(y,z,D,"⫅","\\subseteqq",!0);x(y,z,D,"⋐","\\Subset",!0);x(y,z,D,"⊏","\\sqsubset",!0);x(y,z,D,"≼","\\preccurlyeq",!0);x(y,z,D,"⋞","\\curlyeqprec",!0);x(y,z,D,"≾","\\precsim",!0);x(y,z,D,"⪷","\\precapprox",!0);x(y,z,D,"⊲","\\vartriangleleft");x(y,z,D,"⊴","\\trianglelefteq");x(y,z,D,"⊨","\\vDash",!0);x(y,z,D,"⊪","\\Vvdash",!0);x(y,z,D,"⌣","\\smallsmile");x(y,z,D,"⌢","\\smallfrown");x(y,z,D,"≏","\\bumpeq",!0);x(y,z,D,"≎","\\Bumpeq",!0);x(y,z,D,"≧","\\geqq",!0);x(y,z,D,"⩾","\\geqslant",!0);x(y,z,D,"⪖","\\eqslantgtr",!0);x(y,z,D,"≳","\\gtrsim",!0);x(y,z,D,"⪆","\\gtrapprox",!0);x(y,z,Pe,"⋗","\\gtrdot");x(y,z,D,"⋙","\\ggg",!0);x(y,z,D,"≷","\\gtrless",!0);x(y,z,D,"⋛","\\gtreqless",!0);x(y,z,D,"⪌","\\gtreqqless",!0);x(y,z,D,"≖","\\eqcirc",!0);x(y,z,D,"≗","\\circeq",!0);x(y,z,D,"≜","\\triangleq",!0);x(y,z,D,"∼","\\thicksim");x(y,z,D,"≈","\\thickapprox");x(y,z,D,"⫆","\\supseteqq",!0);x(y,z,D,"⋑","\\Supset",!0);x(y,z,D,"⊐","\\sqsupset",!0);x(y,z,D,"≽","\\succcurlyeq",!0);x(y,z,D,"⋟","\\curlyeqsucc",!0);x(y,z,D,"≿","\\succsim",!0);x(y,z,D,"⪸","\\succapprox",!0);x(y,z,D,"⊳","\\vartriangleright");x(y,z,D,"⊵","\\trianglerighteq");x(y,z,D,"⊩","\\Vdash",!0);x(y,z,D,"∣","\\shortmid");x(y,z,D,"∥","\\shortparallel");x(y,z,D,"≬","\\between",!0);x(y,z,D,"⋔","\\pitchfork",!0);x(y,z,D,"∝","\\varpropto");x(y,z,D,"◀","\\blacktriangleleft");x(y,z,D,"∴","\\therefore",!0);x(y,z,D,"∍","\\backepsilon");x(y,z,D,"▶","\\blacktriangleright");x(y,z,D,"∵","\\because",!0);x(y,z,D,"⋘","\\llless");x(y,z,D,"⋙","\\gggtr");x(y,z,Pe,"⊲","\\lhd");x(y,z,Pe,"⊳","\\rhd");x(y,z,D,"≂","\\eqsim",!0);x(y,E,D,"⋈","\\Join");x(y,z,D,"≑","\\Doteq",!0);x(y,z,Pe,"∔","\\dotplus",!0);x(y,z,Pe,"∖","\\smallsetminus");x(y,z,Pe,"⋒","\\Cap",!0);x(y,z,Pe,"⋓","\\Cup",!0);x(y,z,Pe,"⩞","\\doublebarwedge",!0);x(y,z,Pe,"⊟","\\boxminus",!0);x(y,z,Pe,"⊞","\\boxplus",!0);x(y,z,Pe,"⋇","\\divideontimes",!0);x(y,z,Pe,"⋉","\\ltimes",!0);x(y,z,Pe,"⋊","\\rtimes",!0);x(y,z,Pe,"⋋","\\leftthreetimes",!0);x(y,z,Pe,"⋌","\\rightthreetimes",!0);x(y,z,Pe,"⋏","\\curlywedge",!0);x(y,z,Pe,"⋎","\\curlyvee",!0);x(y,z,Pe,"⊝","\\circleddash",!0);x(y,z,Pe,"⊛","\\circledast",!0);x(y,z,Pe,"⋅","\\centerdot");x(y,z,Pe,"⊺","\\intercal",!0);x(y,z,Pe,"⋒","\\doublecap");x(y,z,Pe,"⋓","\\doublecup");x(y,z,Pe,"⊠","\\boxtimes",!0);x(y,z,D,"⇢","\\dashrightarrow",!0);x(y,z,D,"⇠","\\dashleftarrow",!0);x(y,z,D,"⇇","\\leftleftarrows",!0);x(y,z,D,"⇆","\\leftrightarrows",!0);x(y,z,D,"⇚","\\Lleftarrow",!0);x(y,z,D,"↞","\\twoheadleftarrow",!0);x(y,z,D,"↢","\\leftarrowtail",!0);x(y,z,D,"↫","\\looparrowleft",!0);x(y,z,D,"⇋","\\leftrightharpoons",!0);x(y,z,D,"↶","\\curvearrowleft",!0);x(y,z,D,"↺","\\circlearrowleft",!0);x(y,z,D,"↰","\\Lsh",!0);x(y,z,D,"⇈","\\upuparrows",!0);x(y,z,D,"↿","\\upharpoonleft",!0);x(y,z,D,"⇃","\\downharpoonleft",!0);x(y,E,D,"⊶","\\origof",!0);x(y,E,D,"⊷","\\imageof",!0);x(y,z,D,"⊸","\\multimap",!0);x(y,z,D,"↭","\\leftrightsquigarrow",!0);x(y,z,D,"⇉","\\rightrightarrows",!0);x(y,z,D,"⇄","\\rightleftarrows",!0);x(y,z,D,"↠","\\twoheadrightarrow",!0);x(y,z,D,"↣","\\rightarrowtail",!0);x(y,z,D,"↬","\\looparrowright",!0);x(y,z,D,"↷","\\curvearrowright",!0);x(y,z,D,"↻","\\circlearrowright",!0);x(y,z,D,"↱","\\Rsh",!0);x(y,z,D,"⇊","\\downdownarrows",!0);x(y,z,D,"↾","\\upharpoonright",!0);x(y,z,D,"⇂","\\downharpoonright",!0);x(y,z,D,"⇝","\\rightsquigarrow",!0);x(y,z,D,"⇝","\\leadsto");x(y,z,D,"⇛","\\Rrightarrow",!0);x(y,z,D,"↾","\\restriction");x(y,E,O,"‘","`");x(y,E,O,"$","\\$");x(he,E,O,"$","\\$");x(he,E,O,"$","\\textdollar");x(y,E,O,"%","\\%");x(he,E,O,"%","\\%");x(y,E,O,"_","\\_");x(he,E,O,"_","\\_");x(he,E,O,"_","\\textunderscore");x(y,E,O,"∠","\\angle",!0);x(y,E,O,"∞","\\infty",!0);x(y,E,O,"′","\\prime");x(y,E,O,"△","\\triangle");x(y,E,O,"Γ","\\Gamma",!0);x(y,E,O,"Δ","\\Delta",!0);x(y,E,O,"Θ","\\Theta",!0);x(y,E,O,"Λ","\\Lambda",!0);x(y,E,O,"Ξ","\\Xi",!0);x(y,E,O,"Π","\\Pi",!0);x(y,E,O,"Σ","\\Sigma",!0);x(y,E,O,"Υ","\\Upsilon",!0);x(y,E,O,"Φ","\\Phi",!0);x(y,E,O,"Ψ","\\Psi",!0);x(y,E,O,"Ω","\\Omega",!0);x(y,E,O,"A","Α");x(y,E,O,"B","Β");x(y,E,O,"E","Ε");x(y,E,O,"Z","Ζ");x(y,E,O,"H","Η");x(y,E,O,"I","Ι");x(y,E,O,"K","Κ");x(y,E,O,"M","Μ");x(y,E,O,"N","Ν");x(y,E,O,"O","Ο");x(y,E,O,"P","Ρ");x(y,E,O,"T","Τ");x(y,E,O,"X","Χ");x(y,E,O,"¬","\\neg",!0);x(y,E,O,"¬","\\lnot");x(y,E,O,"⊤","\\top");x(y,E,O,"⊥","\\bot");x(y,E,O,"∅","\\emptyset");x(y,z,O,"∅","\\varnothing");x(y,E,We,"α","\\alpha",!0);x(y,E,We,"β","\\beta",!0);x(y,E,We,"γ","\\gamma",!0);x(y,E,We,"δ","\\delta",!0);x(y,E,We,"ϵ","\\epsilon",!0);x(y,E,We,"ζ","\\zeta",!0);x(y,E,We,"η","\\eta",!0);x(y,E,We,"θ","\\theta",!0);x(y,E,We,"ι","\\iota",!0);x(y,E,We,"κ","\\kappa",!0);x(y,E,We,"λ","\\lambda",!0);x(y,E,We,"μ","\\mu",!0);x(y,E,We,"ν","\\nu",!0);x(y,E,We,"ξ","\\xi",!0);x(y,E,We,"ο","\\omicron",!0);x(y,E,We,"π","\\pi",!0);x(y,E,We,"ρ","\\rho",!0);x(y,E,We,"σ","\\sigma",!0);x(y,E,We,"τ","\\tau",!0);x(y,E,We,"υ","\\upsilon",!0);x(y,E,We,"ϕ","\\phi",!0);x(y,E,We,"χ","\\chi",!0);x(y,E,We,"ψ","\\psi",!0);x(y,E,We,"ω","\\omega",!0);x(y,E,We,"ε","\\varepsilon",!0);x(y,E,We,"ϑ","\\vartheta",!0);x(y,E,We,"ϖ","\\varpi",!0);x(y,E,We,"ϱ","\\varrho",!0);x(y,E,We,"ς","\\varsigma",!0);x(y,E,We,"φ","\\varphi",!0);x(y,E,Pe,"∗","*",!0);x(y,E,Pe,"+","+");x(y,E,Pe,"−","-",!0);x(y,E,Pe,"⋅","\\cdot",!0);x(y,E,Pe,"∘","\\circ",!0);x(y,E,Pe,"÷","\\div",!0);x(y,E,Pe,"±","\\pm",!0);x(y,E,Pe,"×","\\times",!0);x(y,E,Pe,"∩","\\cap",!0);x(y,E,Pe,"∪","\\cup",!0);x(y,E,Pe,"∖","\\setminus",!0);x(y,E,Pe,"∧","\\land");x(y,E,Pe,"∨","\\lor");x(y,E,Pe,"∧","\\wedge",!0);x(y,E,Pe,"∨","\\vee",!0);x(y,E,O,"√","\\surd");x(y,E,Yn,"⟨","\\langle",!0);x(y,E,Yn,"∣","\\lvert");x(y,E,Yn,"∥","\\lVert");x(y,E,Nn,"?","?");x(y,E,Nn,"!","!");x(y,E,Nn,"⟩","\\rangle",!0);x(y,E,Nn,"∣","\\rvert");x(y,E,Nn,"∥","\\rVert");x(y,E,D,"=","=");x(y,E,D,":",":");x(y,E,D,"≈","\\approx",!0);x(y,E,D,"≅","\\cong",!0);x(y,E,D,"≥","\\ge");x(y,E,D,"≥","\\geq",!0);x(y,E,D,"←","\\gets");x(y,E,D,">","\\gt",!0);x(y,E,D,"∈","\\in",!0);x(y,E,D,"","\\@not");x(y,E,D,"⊂","\\subset",!0);x(y,E,D,"⊃","\\supset",!0);x(y,E,D,"⊆","\\subseteq",!0);x(y,E,D,"⊇","\\supseteq",!0);x(y,z,D,"⊈","\\nsubseteq",!0);x(y,z,D,"⊉","\\nsupseteq",!0);x(y,E,D,"⊨","\\models");x(y,E,D,"←","\\leftarrow",!0);x(y,E,D,"≤","\\le");x(y,E,D,"≤","\\leq",!0);x(y,E,D,"<","\\lt",!0);x(y,E,D,"→","\\rightarrow",!0);x(y,E,D,"→","\\to");x(y,z,D,"≱","\\ngeq",!0);x(y,z,D,"≰","\\nleq",!0);x(y,E,Xi," ","\\ ");x(y,E,Xi," ","\\space");x(y,E,Xi," ","\\nobreakspace");x(he,E,Xi," ","\\ ");x(he,E,Xi," "," ");x(he,E,Xi," ","\\space");x(he,E,Xi," ","\\nobreakspace");x(y,E,Xi,"","\\nobreak");x(y,E,Xi,"","\\allowbreak");x(y,E,ba,",",",");x(y,E,ba,";",";");x(y,z,Pe,"⊼","\\barwedge",!0);x(y,z,Pe,"⊻","\\veebar",!0);x(y,E,Pe,"⊙","\\odot",!0);x(y,E,Pe,"⊕","\\oplus",!0);x(y,E,Pe,"⊗","\\otimes",!0);x(y,E,O,"∂","\\partial",!0);x(y,E,Pe,"⊘","\\oslash",!0);x(y,z,Pe,"⊚","\\circledcirc",!0);x(y,z,Pe,"⊡","\\boxdot",!0);x(y,E,Pe,"△","\\bigtriangleup");x(y,E,Pe,"▽","\\bigtriangledown");x(y,E,Pe,"†","\\dagger");x(y,E,Pe,"⋄","\\diamond");x(y,E,Pe,"⋆","\\star");x(y,E,Pe,"◃","\\triangleleft");x(y,E,Pe,"▹","\\triangleright");x(y,E,Yn,"{","\\{");x(he,E,O,"{","\\{");x(he,E,O,"{","\\textbraceleft");x(y,E,Nn,"}","\\}");x(he,E,O,"}","\\}");x(he,E,O,"}","\\textbraceright");x(y,E,Yn,"{","\\lbrace");x(y,E,Nn,"}","\\rbrace");x(y,E,Yn,"[","\\lbrack",!0);x(he,E,O,"[","\\lbrack",!0);x(y,E,Nn,"]","\\rbrack",!0);x(he,E,O,"]","\\rbrack",!0);x(y,E,Yn,"(","\\lparen",!0);x(y,E,Nn,")","\\rparen",!0);x(he,E,O,"<","\\textless",!0);x(he,E,O,">","\\textgreater",!0);x(y,E,Yn,"⌊","\\lfloor",!0);x(y,E,Nn,"⌋","\\rfloor",!0);x(y,E,Yn,"⌈","\\lceil",!0);x(y,E,Nn,"⌉","\\rceil",!0);x(y,E,O,"\\","\\backslash");x(y,E,O,"∣","|");x(y,E,O,"∣","\\vert");x(he,E,O,"|","\\textbar",!0);x(y,E,O,"∥","\\|");x(y,E,O,"∥","\\Vert");x(he,E,O,"∥","\\textbardbl");x(he,E,O,"~","\\textasciitilde");x(he,E,O,"\\","\\textbackslash");x(he,E,O,"^","\\textasciicircum");x(y,E,D,"↑","\\uparrow",!0);x(y,E,D,"⇑","\\Uparrow",!0);x(y,E,D,"↓","\\downarrow",!0);x(y,E,D,"⇓","\\Downarrow",!0);x(y,E,D,"↕","\\updownarrow",!0);x(y,E,D,"⇕","\\Updownarrow",!0);x(y,E,nn,"∐","\\coprod");x(y,E,nn,"⋁","\\bigvee");x(y,E,nn,"⋀","\\bigwedge");x(y,E,nn,"⨄","\\biguplus");x(y,E,nn,"⋂","\\bigcap");x(y,E,nn,"⋃","\\bigcup");x(y,E,nn,"∫","\\int");x(y,E,nn,"∫","\\intop");x(y,E,nn,"∬","\\iint");x(y,E,nn,"∭","\\iiint");x(y,E,nn,"∏","\\prod");x(y,E,nn,"∑","\\sum");x(y,E,nn,"⨂","\\bigotimes");x(y,E,nn,"⨁","\\bigoplus");x(y,E,nn,"⨀","\\bigodot");x(y,E,nn,"∮","\\oint");x(y,E,nn,"∯","\\oiint");x(y,E,nn,"∰","\\oiiint");x(y,E,nn,"⨆","\\bigsqcup");x(y,E,nn,"∫","\\smallint");x(he,E,_s,"…","\\textellipsis");x(y,E,_s,"…","\\mathellipsis");x(he,E,_s,"…","\\ldots",!0);x(y,E,_s,"…","\\ldots",!0);x(y,E,_s,"⋯","\\@cdots",!0);x(y,E,_s,"⋱","\\ddots",!0);x(y,E,O,"⋮","\\varvdots");x(he,E,O,"⋮","\\varvdots");x(y,E,Vt,"ˊ","\\acute");x(y,E,Vt,"ˋ","\\grave");x(y,E,Vt,"¨","\\ddot");x(y,E,Vt,"~","\\tilde");x(y,E,Vt,"ˉ","\\bar");x(y,E,Vt,"˘","\\breve");x(y,E,Vt,"ˇ","\\check");x(y,E,Vt,"^","\\hat");x(y,E,Vt,"⃗","\\vec");x(y,E,Vt,"˙","\\dot");x(y,E,Vt,"˚","\\mathring");x(y,E,We,"","\\@imath");x(y,E,We,"","\\@jmath");x(y,E,O,"ı","ı");x(y,E,O,"ȷ","ȷ");x(he,E,O,"ı","\\i",!0);x(he,E,O,"ȷ","\\j",!0);x(he,E,O,"ß","\\ss",!0);x(he,E,O,"æ","\\ae",!0);x(he,E,O,"œ","\\oe",!0);x(he,E,O,"ø","\\o",!0);x(he,E,O,"Æ","\\AE",!0);x(he,E,O,"Œ","\\OE",!0);x(he,E,O,"Ø","\\O",!0);x(he,E,Vt,"ˊ","\\'");x(he,E,Vt,"ˋ","\\`");x(he,E,Vt,"ˆ","\\^");x(he,E,Vt,"˜","\\~");x(he,E,Vt,"ˉ","\\=");x(he,E,Vt,"˘","\\u");x(he,E,Vt,"˙","\\.");x(he,E,Vt,"¸","\\c");x(he,E,Vt,"˚","\\r");x(he,E,Vt,"ˇ","\\v");x(he,E,Vt,"¨",'\\"');x(he,E,Vt,"˝","\\H");x(he,E,Vt,"◯","\\textcircled");var $f={"--":!0,"---":!0,"``":!0,"''":!0};x(he,E,O,"–","--",!0);x(he,E,O,"–","\\textendash");x(he,E,O,"—","---",!0);x(he,E,O,"—","\\textemdash");x(he,E,O,"‘","`",!0);x(he,E,O,"‘","\\textquoteleft");x(he,E,O,"’","'",!0);x(he,E,O,"’","\\textquoteright");x(he,E,O,"“","``",!0);x(he,E,O,"“","\\textquotedblleft");x(he,E,O,"”","''",!0);x(he,E,O,"”","\\textquotedblright");x(y,E,O,"°","\\degree",!0);x(he,E,O,"°","\\degree");x(he,E,O,"°","\\textdegree",!0);x(y,E,O,"£","\\pounds");x(y,E,O,"£","\\mathsterling",!0);x(he,E,O,"£","\\pounds");x(he,E,O,"£","\\textsterling",!0);x(y,z,O,"✠","\\maltese");x(he,z,O,"✠","\\maltese");var of='0123456789/@."';for(No=0;No<of.length;No++)Q0=of.charAt(No),x(y,E,O,Q0,Q0);var Q0,No,lf='0123456789!@*()-=+";:?/.,';for(Fo=0;Fo<lf.length;Fo++)eh=lf.charAt(Fo),x(he,E,O,eh,eh);var eh,Fo,Yo="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";for(Uo=0;Uo<Yo.length;Uo++)ca=Yo.charAt(Uo),x(y,E,We,ca,ca),x(he,E,O,ca,ca);var ca,Uo;x(y,z,O,"C","ℂ");x(he,z,O,"C","ℂ");x(y,z,O,"H","ℍ");x(he,z,O,"H","ℍ");x(y,z,O,"N","ℕ");x(he,z,O,"N","ℕ");x(y,z,O,"P","ℙ");x(he,z,O,"P","ℙ");x(y,z,O,"Q","ℚ");x(he,z,O,"Q","ℚ");x(y,z,O,"R","ℝ");x(he,z,O,"R","ℝ");x(y,z,O,"Z","ℤ");x(he,z,O,"Z","ℤ");x(y,E,We,"h","ℎ");x(he,E,We,"h","ℎ");var $e;for(Tn=0;Tn<Yo.length;Tn++)Ht=Yo.charAt(Tn),$e=String.fromCharCode(55349,56320+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e),$e=String.fromCharCode(55349,56372+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e),$e=String.fromCharCode(55349,56424+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e),$e=String.fromCharCode(55349,56580+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e),$e=String.fromCharCode(55349,56684+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e),$e=String.fromCharCode(55349,56736+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e),$e=String.fromCharCode(55349,56788+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e),$e=String.fromCharCode(55349,56840+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e),$e=String.fromCharCode(55349,56944+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e),Tn<26&&($e=String.fromCharCode(55349,56632+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e),$e=String.fromCharCode(55349,56476+Tn),x(y,E,We,Ht,$e),x(he,E,O,Ht,$e));var Ht,Tn;$e="𝕜";x(y,E,We,"k",$e);x(he,E,O,"k",$e);for(pr=0;pr<10;pr++)Hi=pr.toString(),$e=String.fromCharCode(55349,57294+pr),x(y,E,We,Hi,$e),x(he,E,O,Hi,$e),$e=String.fromCharCode(55349,57314+pr),x(y,E,We,Hi,$e),x(he,E,O,Hi,$e),$e=String.fromCharCode(55349,57324+pr),x(y,E,We,Hi,$e),x(he,E,O,Hi,$e),$e=String.fromCharCode(55349,57334+pr),x(y,E,We,Hi,$e),x(he,E,O,Hi,$e);var Hi,pr,ph="ÐÞþ";for(Bo=0;Bo<ph.length;Bo++)ha=ph.charAt(Bo),x(y,E,We,ha,ha),x(he,E,O,ha,ha);var ha,Bo,mh={mathClass:"mathbf",textClass:"textbf",font:"Main-Bold"},cf={mathClass:"mathnormal",textClass:"textit",font:"Math-Italic"},hf={mathClass:"boldsymbol",textClass:"boldsymbol",font:"Main-BoldItalic"},lx={mathClass:"mathscr",textClass:"textscr",font:"Script-Regular"},$r={mathClass:"",textClass:"",font:""},uf={mathClass:"mathfrak",textClass:"textfrak",font:"Fraktur-Regular"},df={mathClass:"mathbb",textClass:"textbb",font:"AMS-Regular"},ff={mathClass:"mathboldfrak",textClass:"textboldfrak",font:"Fraktur-Regular"},gh={mathClass:"mathsf",textClass:"textsf",font:"SansSerif-Regular"},xh={mathClass:"mathboldsf",textClass:"textboldsf",font:"SansSerif-Bold"},pf={mathClass:"mathitsf",textClass:"textitsf",font:"SansSerif-Italic"},vh={mathClass:"mathtt",textClass:"texttt",font:"Typewriter-Regular"},mf=[mh,mh,cf,cf,hf,hf,lx,$r,$r,$r,uf,uf,df,df,ff,ff,gh,gh,xh,xh,pf,pf,$r,$r,vh,vh],cx=[mh,$r,gh,xh,vh],hx=i=>{var e=i.charCodeAt(0),t=i.charCodeAt(1),n=(e-55296)*1024+(t-56320)+65536;if(119808<=n&&n<120484){var r=Math.floor((n-119808)/26);return mf[r]}else if(120782<=n&&n<=120831){var s=Math.floor((n-120782)/10);return cx[s]}else{if(n===120485||n===120486)return mf[0];if(120486<n&&n<120782)return $r;throw new fe("Unsupported character: "+i)}},Qo=function(e,t,n){if(Ot[n][e]){var r=Ot[n][e].replace;r&&(e=r)}return{value:e,metrics:zh(e,t,n)}},zn=function(e,t,n,r,s){var a=Qo(e,t,n),o=a.metrics;e=a.value;var l;if(o){var c=o.italic;(n==="text"||r&&r.font==="mathit")&&(c=0),l=new Dn(e,o.height,o.depth,c,o.skew,o.width,s)}else typeof console<"u"&&console.warn("No character metrics "+("for '"+e+"' in style '"+t+"' and mode '"+n+"'")),l=new Dn(e,0,0,0,0,0,s);if(r){l.maxFontSize=r.sizeMultiplier,r.style.isTight()&&l.classes.push("mtight");var h=r.getColor();h&&(l.style.color=h)}return l},Lh=function(e,t,n,r){return r===void 0&&(r=[]),n.font==="boldsymbol"&&Qo(e,"Main-Bold",t).metrics?zn(e,"Main-Bold",t,n,r.concat(["mathbf"])):e==="\\"||Ot[t][e].font==="main"?zn(e,"Main-Regular",t,n,r):zn(e,"AMS-Regular",t,n,r.concat(["amsrm"]))},ux=function(e,t,n){return n!=="textord"&&Qo(e,"Math-BoldItalic",t).metrics?{fontName:"Math-BoldItalic",fontClass:"boldsymbol"}:{fontName:"Main-Bold",fontClass:"mathbf"}},el=function(e,t){var n=e.type==="mathord"?"mathord":"textord",r=e.mode,s=e.text,a=["mord"],o=t.font,l=t.fontFamily,c=t.fontWeight,h=t.fontShape,d=r==="math"||r==="text"&&!!o,u=d?o:l,f="",g="";if(s.charCodeAt(0)===55349){var v=hx(s);f=v.font,g=v[r+"Class"]}if(f)return zn(s,f,r,t,a.concat(g));if(u){var m,p;if(u==="boldsymbol"){var _=ux(s,r,n);m=_.fontName,p=[_.fontClass]}else d?(m=yh[o].fontName,p=[o]):(m=Oo(l,c,h),p=[l,c,h]);if(Qo(s,m,r).metrics)return zn(s,m,r,t,a.concat(p));if(Object.prototype.hasOwnProperty.call($f,s)&&m.slice(0,10)==="Typewriter"){for(var A=[],M=0;M<s.length;M++)A.push(zn(s[M],m,r,t,a.concat(p)));return $i(A)}}if(n==="mathord")return zn(s,"Math-Italic",r,t,a.concat(["mathnormal"]));if(n==="textord"){var T=Ot[r][s]&&Ot[r][s].font;if(T==="ams"){var S=Oo("amsrm",c,h);return zn(s,S,r,t,a.concat("amsrm",c,h))}else if(T==="main"||!T){var I=Oo("textrm",c,h);return zn(s,I,r,t,a.concat(c,h))}else{var b=Oo(T,c,h);return zn(s,b,r,t,a.concat(b,c,h))}}else throw new Error("unexpected type: "+n+" in makeOrd")},dx=(i,e)=>{if(xr(i.classes)!==xr(e.classes)||i.skew!==e.skew||i.maxFontSize!==e.maxFontSize||i.italic!==0&&i.hasClass("mathnormal"))return!1;if(i.classes.length===1){var t=i.classes[0];if(t==="mbin"||t==="mord")return!1}for(var n of Object.keys(i.style))if(i.style[n]!==e.style[n])return!1;for(var r of Object.keys(e.style))if(i.style[r]!==e.style[r])return!1;return!0},Yf=i=>{for(var e=0;e<i.length-1;e++){var t=i[e],n=i[e+1];t instanceof Dn&&n instanceof Dn&&dx(t,n)&&(t.text+=n.text,t.height=Math.max(t.height,n.height),t.depth=Math.max(t.depth,n.depth),t.italic=n.italic,i.splice(e+1,1),e--)}return i},Dh=function(e){for(var t=0,n=0,r=0,s=0;s<e.children.length;s++){var a=e.children[s];a.height>t&&(t=a.height),a.depth>n&&(n=a.depth),a.maxFontSize>r&&(r=a.maxFontSize)}e.height=t,e.depth=n,e.maxFontSize=r},ue=function(e,t,n,r){var s=new vr(e,t,n,r);return Dh(s),s},yr=(i,e,t,n)=>new vr(i,e,t,n),ys=function(e,t,n){var r=ue([e],[],t);return r.height=Math.max(n||t.fontMetrics().defaultRuleThickness,t.minRuleThickness),r.style.borderBottomWidth=me(r.height),r.maxFontSize=1,r},fx=function(e,t,n,r){var s=new vs(e,t,n,r);return Dh(s),s},$i=function(e){var t=new gr(e);return Dh(t),t},bs=function(e,t){return e instanceof gr?ue([],[e],t):e},px=function(e){if(e.positionType==="individualShift"){for(var t=e.children,n=[t[0]],r=-t[0].shift-t[0].elem.depth,s=r,a=1;a<t.length;a++){var o=-t[a].shift-s-t[a].elem.depth,l=o-(t[a-1].elem.height+t[a-1].elem.depth);s=s+o,n.push({type:"kern",size:l}),n.push(t[a])}return{children:n,depth:r}}var c;if(e.positionType==="top"){for(var h=e.positionData,d=0;d<e.children.length;d++){var u=e.children[d];h-=u.type==="kern"?u.size:u.elem.height+u.elem.depth}c=h}else if(e.positionType==="bottom")c=-e.positionData;else{var f=e.children[0];if(f.type!=="elem")throw new Error('First child must have type "elem".');if(e.positionType==="shift")c=-f.elem.depth-e.positionData;else if(e.positionType==="firstBaseline")c=-f.elem.depth;else throw new Error("Invalid positionType "+e.positionType+".")}return{children:e.children,depth:c}},bt=function(e,t){for(var n=px(e),r=n.children,s=n.depth,a=0,o=0;o<r.length;o++){var l=r[o];if(l.type==="elem"){var c=l.elem;a=Math.max(a,c.maxFontSize,c.height)}}a+=2;var h=ue(["pstrut"],[]);h.style.height=me(a);for(var d=[],u=s,f=s,g=s,v=0;v<r.length;v++){var m=r[v];if(m.type==="kern")g+=m.size;else{var p=m.elem,_=m.wrapperClasses||[],A=m.wrapperStyle||{},M=ue(_,[h,p],void 0,A);M.style.top=me(-a-g-p.depth),m.marginLeft&&(M.style.marginLeft=m.marginLeft),m.marginRight&&(M.style.marginRight=m.marginRight),d.push(M),g+=p.height+p.depth}u=Math.min(u,g),f=Math.max(f,g)}var T=ue(["vlist"],d);T.style.height=me(f);var S;if(u<0){var I=ue([],[]),b=ue(["vlist"],[I]);b.style.height=me(-u);var R=ue(["vlist-s"],[new Dn("​")]);S=[ue(["vlist-r"],[T,R]),ue(["vlist-r"],[b])]}else S=[ue(["vlist-r"],[T])];var L=ue(["vlist-t"],S);return S.length===2&&L.classes.push("vlist-t2"),L.height=f,L.depth=-u,L},Kf=(i,e)=>{var t=ue(["mspace"],[],e),n=Wt(i,e);return t.style.marginRight=me(n),t},Oo=(i,e,t)=>{var n,r;switch(i){case"amsrm":n="AMS";break;case"textrm":n="Main";break;case"textsf":n="SansSerif";break;case"texttt":n="Typewriter";break;default:n=i}return e==="textbf"&&t==="textit"?r="BoldItalic":e==="textbf"?r="Bold":t==="textit"?r="Italic":r="Regular",n+"-"+r},yh={mathbf:{variant:"bold",fontName:"Main-Bold"},mathrm:{variant:"normal",fontName:"Main-Regular"},textit:{variant:"italic",fontName:"Main-Italic"},mathit:{variant:"italic",fontName:"Main-Italic"},mathnormal:{variant:"italic",fontName:"Math-Italic"},mathsfit:{variant:"sans-serif-italic",fontName:"SansSerif-Italic"},mathbb:{variant:"double-struck",fontName:"AMS-Regular"},mathcal:{variant:"script",fontName:"Caligraphic-Regular"},mathfrak:{variant:"fraktur",fontName:"Fraktur-Regular"},mathscr:{variant:"script",fontName:"Script-Regular"},mathsf:{variant:"sans-serif",fontName:"SansSerif-Regular"},mathtt:{variant:"monospace",fontName:"Typewriter-Regular"}},Zf={vec:["vec",.471,.714],oiintSize1:["oiintSize1",.957,.499],oiintSize2:["oiintSize2",1.472,.659],oiiintSize1:["oiiintSize1",1.304,.499],oiiintSize2:["oiiintSize2",1.98,.659]},Jf=function(e,t){var n=Zf[e],r=n[0],s=n[1],a=n[2],o=new Ci(r),l=new ui([o],{width:me(s),height:me(a),style:"width:"+me(s),viewBox:"0 0 "+1e3*s+" "+1e3*a,preserveAspectRatio:"xMinYMin"}),c=yr(["katex-overlay"],[l],t);return c.height=a,c.style.height=me(a),c.style.width=me(s),c},Gt={number:3,unit:"mu"},Xr={number:4,unit:"mu"},Gi={number:5,unit:"mu"},mx={mord:{mop:Gt,mbin:Xr,mrel:Gi,minner:Gt},mop:{mord:Gt,mop:Gt,mrel:Gi,minner:Gt},mbin:{mord:Xr,mop:Xr,mopen:Xr,minner:Xr},mrel:{mord:Gi,mop:Gi,mopen:Gi,minner:Gi},mopen:{},mclose:{mop:Gt,mbin:Xr,mrel:Gi,minner:Gt},mpunct:{mord:Gt,mop:Gt,mrel:Gi,mopen:Gt,mclose:Gt,mpunct:Gt,minner:Gt},minner:{mord:Gt,mop:Gt,mbin:Xr,mrel:Gi,mopen:Gt,mpunct:Gt,minner:Gt}},gx={mord:{mop:Gt},mop:{mord:Gt,mop:Gt},mbin:{},mrel:{},mopen:{},mclose:{mop:Gt},mpunct:{},minner:{mop:Gt}},jf={},ga={},xa={};function Ae(i){for(var e=i.type,t=i.names,n=i.htmlBuilder,r=i.mathmlBuilder,s=0;s<t.length;++s)jf[t[s]]=i;e&&(n&&(ga[e]=n),r&&(xa[e]=r))}function Yr(i){var e=i.type,t=i.htmlBuilder,n=i.mathmlBuilder;t&&(ga[e]=t),n&&(xa[e]=n)}var va=function(e){return e.type==="ordgroup"&&e.body.length===1?e.body[0]:e},tn=function(e){return e.type==="ordgroup"?e.body:[e]},xx=new Set(["leftmost","mbin","mopen","mrel","mop","mpunct"]),vx=new Set(["rightmost","mrel","mclose","mpunct"]),yx={display:Je.DISPLAY,text:Je.TEXT,script:Je.SCRIPT,scriptscript:Je.SCRIPTSCRIPT},bx={mord:"mord",mop:"mop",mbin:"mbin",mrel:"mrel",mopen:"mopen",mclose:"mclose",mpunct:"mpunct",minner:"minner"},fn=function(e,t,n,r){r===void 0&&(r=[null,null]);for(var s=[],a=0;a<e.length;a++){var o=vt(e[a],t);if(o instanceof gr){var l=o.children;s.push(...l)}else s.push(o)}if(Yf(s),!n)return s;var c=t;if(e.length===1){var h=e[0];h.type==="sizing"?c=t.havingSize(h.size):h.type==="styling"&&(c=t.havingStyle(yx[h.style]))}var d=ue([r[0]||"leftmost"],[],t),u=ue([r[1]||"rightmost"],[],t),f=n==="root";return bh(s,(g,v)=>{var m=v.classes[0],p=g.classes[0];m==="mbin"&&vx.has(p)?v.classes[0]="mord":p==="mbin"&&xx.has(m)&&(g.classes[0]="mord")},{node:d},u,f),bh(s,(g,v)=>{var m,p,_=Mh(v),A=Mh(g),M=_&&A?g.hasClass("mtight")?(m=gx[_])==null?void 0:m[A]:(p=mx[_])==null?void 0:p[A]:null;if(M)return Kf(M,c)},{node:d},u,f),s},bh=function(e,t,n,r,s){r&&e.push(r);for(var a=0;a<e.length;a++){var o=e[a],l=Qf(o);if(l){bh(l.children,t,n,null,s);continue}var c=!o.hasClass("mspace");if(c){var h=t(o,n.node);h&&(n.insertAfter?n.insertAfter(h):(e.unshift(h),a++))}c?n.node=o:s&&o.hasClass("katex-newline")&&(n.node=ue(["leftmost"])),n.insertAfter=(d=>u=>{e.splice(d+1,0,u),a++})(a)}r&&e.pop()},Qf=function(e){return e instanceof gr||e instanceof vs||e instanceof vr&&e.hasClass("enclosing")?e:null},_h=function(e,t){var n=Qf(e);if(n){var r=n.children;if(r.length){if(t==="right")return _h(r[r.length-1],"right");if(t==="left")return _h(r[0],"left")}}return e},Mh=function(e,t){if(!e)return null;t&&(e=_h(e,t));var n=e.classes[0];return bx[n]||null},ya=function(e,t){var n=["nulldelimiter"].concat(e.baseSizingClasses());return ue(t.concat(n))},vt=function(e,t,n){if(!e)return ue();if(ga[e.type]){var r=ga[e.type](e,t);if(n&&t.size!==n.size){r=ue(t.sizingClasses(n),[r],t);var s=t.sizeMultiplier/n.sizeMultiplier;r.height*=s,r.depth*=s}return r}else throw new fe("Got group of unknown type: '"+e.type+"'")};function Vo(i,e){var t=ue(["katex-base"],i,e),n=ue(["katex-strut"]);return n.style.height=me(t.height+t.depth),t.depth&&(n.style.verticalAlign=me(-t.depth)),t.children.unshift(n),t}function Sh(i,e){var t=null;i.length===1&&i[0].type==="tag"&&(t=i[0].tag,i=i[0].body);var n=fn(i,e,"root"),r;n.length===2&&n[1].hasClass("katex-tag")&&(r=n.pop());for(var s=[],a=[],o=0;o<n.length;o++)if(a.push(n[o]),n[o].hasClass("mbin")||n[o].hasClass("mrel")||n[o].hasClass("allowbreak")){for(var l=!1;o<n.length-1&&n[o+1].hasClass("mspace")&&!n[o+1].hasClass("katex-newline");)o++,a.push(n[o]),n[o].hasClass("nobreak")&&(l=!0);l||(s.push(Vo(a,e)),a=[])}else n[o].hasClass("katex-newline")&&(a.pop(),a.length>0&&(s.push(Vo(a,e)),a=[]),s.push(n[o]));a.length>0&&s.push(Vo(a,e));var c;t?(c=Vo(fn(t,e,!0),e),c.classes=["katex-tag"],s.push(c)):r&&s.push(r);var h=ue(["katex-html"],s);if(h.setAttribute("aria-hidden","true"),c){var d=c.children[0];d.style.height=me(h.height+h.depth),h.depth&&(d.style.verticalAlign=me(-h.depth))}return h}function ep(i){return new gr(i)}var pe=class{constructor(e,t,n){this.type=void 0,this.attributes=void 0,this.children=void 0,this.classes=void 0,this.type=e,this.attributes={},this.children=t||[],this.classes=n||[]}setAttribute(e,t){this.attributes[e]=t}getAttribute(e){return this.attributes[e]}toNode(){var e=document.createElementNS("http://www.w3.org/1998/Math/MathML",this.type);for(var t of Object.entries(this.attributes)){var n=t[0],r=t[1];e.setAttribute(n,r)}this.classes.length>0&&(e.className=xr(this.classes));for(var s=0;s<this.children.length;s++)if(this.children[s]instanceof Kt&&this.children[s+1]instanceof Kt){for(var a=this.children[s].toText()+this.children[++s].toText();this.children[s+1]instanceof Kt;)a+=this.children[++s].toText();e.appendChild(new Kt(a).toNode())}else e.appendChild(this.children[s].toNode());return e}toMarkup(){var e="<"+this.type;for(var t of Object.entries(this.attributes)){var n=t[0],r=t[1];e+=" "+n+'="',e+=An(r),e+='"'}this.classes.length>0&&(e+=' class ="'+An(xr(this.classes))+'"'),e+=">";for(var s=0;s<this.children.length;s++)e+=this.children[s].toMarkup();return e+="</"+this.type+">",e}toText(){return this.children.map(e=>e.toText()).join("")}},Kt=class{constructor(e){this.text=void 0,this.text=e}toNode(){return document.createTextNode(this.text)}toMarkup(){return An(this.toText())}toText(){return this.text}},Ko=class{constructor(e){this.width=void 0,this.character=void 0,this.width=e,e>=.05555&&e<=.05556?this.character=" ":e>=.1666&&e<=.1667?this.character=" ":e>=.2222&&e<=.2223?this.character=" ":e>=.2777&&e<=.2778?this.character="  ":e>=-.05556&&e<=-.05555?this.character=" ⁣":e>=-.1667&&e<=-.1666?this.character=" ⁣":e>=-.2223&&e<=-.2222?this.character=" ⁣":e>=-.2778&&e<=-.2777?this.character=" ⁣":this.character=null}toNode(){if(this.character)return document.createTextNode(this.character);var e=document.createElementNS("http://www.w3.org/1998/Math/MathML","mspace");return e.setAttribute("width",me(this.width)),e}toMarkup(){return this.character?"<mtext>"+this.character+"</mtext>":'<mspace width="'+me(this.width)+'"/>'}toText(){return this.character?this.character:" "}},_x=new Set(["\\imath","\\jmath"]),Mx=new Set(["mrow","mtable"]),ri=function(e,t,n){var r,s;return Ot[t][e]&&Ot[t][e].replace&&e.charCodeAt(0)!==55349&&!(Object.prototype.hasOwnProperty.call($f,e)&&((n==null||(r=n.fontFamily)==null?void 0:r.slice(4,6))==="tt"||(n==null||(s=n.font)==null?void 0:s.slice(4,6))==="tt"))&&(e=Ot[t][e].replace),new Kt(e)},Nh=function(e){return e.length===1?e[0]:new pe("mrow",e)},Sx={mathit:"italic",boldsymbol:i=>i.type==="textord"?"bold":"bold-italic",mathbf:"bold",mathbb:"double-struck",mathsfit:"sans-serif-italic",mathfrak:"fraktur",mathscr:"script",mathcal:"script",mathsf:"sans-serif",mathtt:"monospace"},Fh=(i,e)=>{if(i.mode==="text"){if(e.fontFamily==="texttt")return"monospace";if(e.fontFamily==="textsf")return e.fontShape==="textit"&&e.fontWeight==="textbf"?"sans-serif-bold-italic":e.fontShape==="textit"?"sans-serif-italic":e.fontWeight==="textbf"?"bold-sans-serif":"sans-serif";if(e.fontShape==="textit"&&e.fontWeight==="textbf")return"bold-italic";if(e.fontShape==="textit")return"italic";if(e.fontWeight==="textbf")return"bold"}var t=e.font;if(!t||t==="mathnormal")return null;var n=i.mode,r=Sx[t];if(r)return typeof r=="function"?r(i):r;var s=i.text;if(_x.has(s))return null;if(Ot[n][s]){var a=Ot[n][s].replace;a&&(s=a)}var o=yh[t].fontName;return zh(s,o,n)?yh[t].variant:null};function th(i){if(!i)return!1;if(i.type==="mi"&&i.children.length===1){var e=i.children[0];return e instanceof Kt&&e.text==="."}else if(i.type==="mo"&&i.children.length===1&&i.getAttribute("separator")==="true"&&i.getAttribute("lspace")==="0em"&&i.getAttribute("rspace")==="0em"){var t=i.children[0];return t instanceof Kt&&t.text===","}else return!1}var Kn=function(e,t,n){if(e.length===1){var r=Et(e[0],t);return n&&r instanceof pe&&r.type==="mo"&&(r.setAttribute("lspace","0em"),r.setAttribute("rspace","0em")),[r]}for(var s=[],a,o=0;o<e.length;o++){var l=Et(e[o],t);if(l instanceof pe&&a instanceof pe){if(l.type==="mtext"&&a.type==="mtext"&&l.getAttribute("mathvariant")===a.getAttribute("mathvariant")){a.children.push(...l.children);continue}else if(l.type==="mn"&&a.type==="mn"){a.children.push(...l.children);continue}else if(th(l)&&a.type==="mn"){a.children.push(...l.children);continue}else if(l.type==="mn"&&th(a))l.children=[...a.children,...l.children],s.pop();else if((l.type==="msup"||l.type==="msub")&&l.children.length>=1&&(a.type==="mn"||th(a))){var c=l.children[0];c instanceof pe&&c.type==="mn"&&(c.children=[...a.children,...c.children],s.pop())}else if(a.type==="mi"&&a.children.length===1){var h=a.children[0];if(h instanceof Kt&&h.text==="̸"&&(l.type==="mo"||l.type==="mi"||l.type==="mn")){var d=l.children[0];d instanceof Kt&&d.text.length>0&&(d.text=d.text.slice(0,1)+"̸"+d.text.slice(1),s.pop())}}}s.push(l),a=l}return s},br=function(e,t,n){return Nh(Kn(e,t,n))},Et=function(e,t){if(!e)return new pe("mrow");if(xa[e.type])return xa[e.type](e,t);throw new fe("Got group of unknown type: '"+e.type+"'")};function gf(i,e,t,n,r){var s=Kn(i,t),a;s.length===1&&s[0]instanceof pe&&Mx.has(s[0].type)?a=s[0]:a=new pe("mrow",s);var o=new pe("annotation",[new Kt(e)]);o.setAttribute("encoding","application/x-tex");var l=new pe("semantics",[a,o]),c=new pe("math",[l]);c.setAttribute("xmlns","http://www.w3.org/1998/Math/MathML"),n&&c.setAttribute("display","block");var h=r?"katex":"katex-mathml";return ue([h],[c])}var wx=[[1,1,1],[2,1,1],[3,1,1],[4,2,1],[5,2,1],[6,3,1],[7,4,2],[8,6,3],[9,7,6],[10,8,7],[11,10,9]],xf=[.5,.6,.7,.8,.9,1,1.2,1.44,1.728,2.074,2.488],vf=function(e,t){return t.size<2?e:wx[e-1][t.size-1]},Zo=class i{constructor(e){this.style=void 0,this.color=void 0,this.size=void 0,this.textSize=void 0,this.phantom=void 0,this.font=void 0,this.fontFamily=void 0,this.fontWeight=void 0,this.fontShape=void 0,this.sizeMultiplier=void 0,this.maxSize=void 0,this.minRuleThickness=void 0,this._fontMetrics=void 0,this.style=e.style,this.color=e.color,this.size=e.size||i.BASESIZE,this.textSize=e.textSize||this.size,this.phantom=!!e.phantom,this.font=e.font||"",this.fontFamily=e.fontFamily||"",this.fontWeight=e.fontWeight||"",this.fontShape=e.fontShape||"",this.sizeMultiplier=xf[this.size-1],this.maxSize=e.maxSize,this.minRuleThickness=e.minRuleThickness,this._fontMetrics=void 0}extend(e){var t={style:this.style,size:this.size,textSize:this.textSize,color:this.color,phantom:this.phantom,font:this.font,fontFamily:this.fontFamily,fontWeight:this.fontWeight,fontShape:this.fontShape,maxSize:this.maxSize,minRuleThickness:this.minRuleThickness};return Object.assign(t,e),new i(t)}havingStyle(e){return this.style===e?this:this.extend({style:e,size:vf(this.textSize,e)})}havingCrampedStyle(){return this.havingStyle(this.style.cramp())}havingSize(e){return this.size===e&&this.textSize===e?this:this.extend({style:this.style.text(),size:e,textSize:e,sizeMultiplier:xf[e-1]})}havingBaseStyle(e){e=e||this.style.text();var t=vf(i.BASESIZE,e);return this.size===t&&this.textSize===i.BASESIZE&&this.style===e?this:this.extend({style:e,size:t})}havingBaseSizing(){var e;switch(this.style.id){case 4:case 5:e=3;break;case 6:case 7:e=1;break;default:e=6}return this.extend({style:this.style.text(),size:e})}withColor(e){return this.extend({color:e})}withPhantom(){return this.extend({phantom:!0})}withFont(e){return this.extend({font:e})}withTextFontFamily(e){return this.extend({fontFamily:e,font:""})}withTextFontWeight(e){return this.extend({fontWeight:e,font:""})}withTextFontShape(e){return this.extend({fontShape:e,font:""})}sizingClasses(e){return e.size!==this.size?["katex-sizing","reset-size"+e.size,"size"+this.size]:[]}baseSizingClasses(){return this.size!==i.BASESIZE?["katex-sizing","reset-size"+this.size,"size"+i.BASESIZE]:[]}fontMetrics(){return this._fontMetrics||(this._fontMetrics=ox(this.size)),this._fontMetrics}getColor(){return this.phantom?"transparent":this.color}};Zo.BASESIZE=6;var tp=function(e){return new Zo({style:e.displayMode?Je.DISPLAY:Je.TEXT,maxSize:e.maxSize,minRuleThickness:e.minRuleThickness})},np=function(e,t){if(t.displayMode){var n=["katex-display"];t.leqno&&n.push("leqno"),t.fleqn&&n.push("fleqn"),e=ue(n,[e])}return e},Tx=function(e,t,n){var r=tp(n),s;if(n.output==="mathml")return gf(e,t,r,n.displayMode,!0);if(n.output==="html"){var a=Sh(e,r);s=ue(["katex"],[a])}else{var o=gf(e,t,r,n.displayMode,!1),l=Sh(e,r);s=ue(["katex"],[o,l])}return np(s,n)},Ax=function(e,t,n){var r=tp(n),s=Sh(e,r),a=ue(["katex"],[s]);return np(a,n)},Ex={widehat:"^",widecheck:"ˇ",widetilde:"~",utilde:"~",overleftarrow:"←",underleftarrow:"←",xleftarrow:"←",overrightarrow:"→",underrightarrow:"→",xrightarrow:"→",underbrace:"⏟",overbrace:"⏞",underbracket:"⎵",overbracket:"⎴",overgroup:"⏠",undergroup:"⏡",overleftrightarrow:"↔",underleftrightarrow:"↔",xleftrightarrow:"↔",Overrightarrow:"⇒",xRightarrow:"⇒",overleftharpoon:"↼",xleftharpoonup:"↼",overrightharpoon:"⇀",xrightharpoonup:"⇀",xLeftarrow:"⇐",xLeftrightarrow:"⇔",xhookleftarrow:"↩",xhookrightarrow:"↪",xmapsto:"↦",xrightharpoondown:"⇁",xleftharpoondown:"↽",xrightleftharpoons:"⇌",xleftrightharpoons:"⇋",xtwoheadleftarrow:"↞",xtwoheadrightarrow:"↠",xlongequal:"=",xtofrom:"⇄",xrightleftarrows:"⇄",xrightequilibrium:"⇌",xleftequilibrium:"⇋","\\cdrightarrow":"→","\\cdleftarrow":"←","\\cdlongequal":"="},tl=function(e){var t=new pe("mo",[new Kt(Ex[e.replace(/^\\/,"")])]);return t.setAttribute("stretchy","true"),t},Cx={overrightarrow:[["rightarrow"],.888,522,"xMaxYMin"],overleftarrow:[["leftarrow"],.888,522,"xMinYMin"],underrightarrow:[["rightarrow"],.888,522,"xMaxYMin"],underleftarrow:[["leftarrow"],.888,522,"xMinYMin"],xrightarrow:[["rightarrow"],1.469,522,"xMaxYMin"],"\\cdrightarrow":[["rightarrow"],3,522,"xMaxYMin"],xleftarrow:[["leftarrow"],1.469,522,"xMinYMin"],"\\cdleftarrow":[["leftarrow"],3,522,"xMinYMin"],Overrightarrow:[["doublerightarrow"],.888,560,"xMaxYMin"],xRightarrow:[["doublerightarrow"],1.526,560,"xMaxYMin"],xLeftarrow:[["doubleleftarrow"],1.526,560,"xMinYMin"],overleftharpoon:[["leftharpoon"],.888,522,"xMinYMin"],xleftharpoonup:[["leftharpoon"],.888,522,"xMinYMin"],xleftharpoondown:[["leftharpoondown"],.888,522,"xMinYMin"],overrightharpoon:[["rightharpoon"],.888,522,"xMaxYMin"],xrightharpoonup:[["rightharpoon"],.888,522,"xMaxYMin"],xrightharpoondown:[["rightharpoondown"],.888,522,"xMaxYMin"],xlongequal:[["longequal"],.888,334,"xMinYMin"],"\\cdlongequal":[["longequal"],3,334,"xMinYMin"],xtwoheadleftarrow:[["twoheadleftarrow"],.888,334,"xMinYMin"],xtwoheadrightarrow:[["twoheadrightarrow"],.888,334,"xMaxYMin"],overleftrightarrow:[["leftarrow","rightarrow"],.888,522],overbrace:[["leftbrace","midbrace","rightbrace"],1.6,548],underbrace:[["leftbraceunder","midbraceunder","rightbraceunder"],1.6,548],underleftrightarrow:[["leftarrow","rightarrow"],.888,522],xleftrightarrow:[["leftarrow","rightarrow"],1.75,522],xLeftrightarrow:[["doubleleftarrow","doublerightarrow"],1.75,560],xrightleftharpoons:[["leftharpoondownplus","rightharpoonplus"],1.75,716],xleftrightharpoons:[["leftharpoonplus","rightharpoondownplus"],1.75,716],xhookleftarrow:[["leftarrow","righthook"],1.08,522],xhookrightarrow:[["lefthook","rightarrow"],1.08,522],overlinesegment:[["leftlinesegment","rightlinesegment"],.888,522],underlinesegment:[["leftlinesegment","rightlinesegment"],.888,522],overbracket:[["leftbracketover","rightbracketover"],1.6,440],underbracket:[["leftbracketunder","rightbracketunder"],1.6,410],overgroup:[["leftgroup","rightgroup"],.888,342],undergroup:[["leftgroupunder","rightgroupunder"],.888,342],xmapsto:[["leftmapsto","rightarrow"],1.5,522],xtofrom:[["leftToFrom","rightToFrom"],1.75,528],xrightleftarrows:[["baraboveleftarrow","rightarrowabovebar"],1.75,901],xrightequilibrium:[["baraboveshortleftharpoon","rightharpoonaboveshortbar"],1.75,716],xleftequilibrium:[["shortbaraboveleftharpoon","shortrightharpoonabovebar"],1.75,716]},Rx=new Set(["widehat","widecheck","widetilde","utilde"]),nl=function(e,t){function n(){var l=4e5,c=e.label.slice(1);if(Rx.has(c)&&"base"in e){var h=e.base.type==="ordgroup"?e.base.body.length:1,d,u,f;if(h>5)c==="widehat"||c==="widecheck"?(d=420,l=2364,f=.42,u=c+"4"):(d=312,l=2340,f=.34,u="tilde4");else{var g=[1,1,2,2,3,3][h];c==="widehat"||c==="widecheck"?(l=[0,1062,2364,2364,2364][g],d=[0,239,300,360,420][g],f=[0,.24,.3,.3,.36,.42][g],u=c+g):(l=[0,600,1033,2339,2340][g],d=[0,260,286,306,312][g],f=[0,.26,.286,.3,.306,.34][g],u="tilde"+g)}var v=new Ci(u),m=new ui([v],{width:"100%",height:me(f),viewBox:"0 0 "+l+" "+d,preserveAspectRatio:"none"});return{span:yr([],[m],t),minWidth:0,height:f}}else{var p=[],_=Cx[c];if(!_)throw new Error('No SVG data for "'+c+'".');var A=_[0],M=_[1],T=_[2],S=T/1e3,I=A.length,b,R;if(I===1){if(_.length!==4)throw new Error('Expected 4-tuple for single-path SVG data "'+c+'".');b=["hide-tail"],R=[_[3]]}else if(I===2)b=["halfarrow-left","halfarrow-right"],R=["xMinYMin","xMaxYMin"];else if(I===3)b=["brace-left","brace-center","brace-right"],R=["xMinYMin","xMidYMin","xMaxYMin"];else throw new Error(`Correct katexImagesData or update code here to support
                    `+I+" children.");for(var L=0;L<I;L++){var N=new Ci(A[L]),U=new ui([N],{width:"400em",height:me(S),viewBox:"0 0 "+l+" "+T,preserveAspectRatio:R[L]+" slice"}),W=yr([b[L]],[U],t);if(I===1)return{span:W,minWidth:M,height:S};W.style.height=me(S),p.push(W)}return{span:ue(["katex-stretchy"],p,t),minWidth:M,height:S}}}var r=n(),s=r.span,a=r.minWidth,o=r.height;return s.height=o,s.style.height=me(o),a>0&&(s.style.minWidth=me(a)),s},kx=function(e,t,n,r,s){var a,o=e.height+e.depth+n+r;if(/fbox|color|angl/.test(t)){if(a=ue(["katex-stretchy",t],[],s),t==="fbox"){var l=s.color&&s.getColor();l&&(a.style.borderColor=l)}}else{var c=[];/^[bx]cancel$/.test(t)&&c.push(new ma({x1:"0",y1:"0",x2:"100%",y2:"100%","stroke-width":"0.046em"})),/^x?cancel$/.test(t)&&c.push(new ma({x1:"0",y1:"100%",x2:"100%",y2:"0","stroke-width":"0.046em"}));var h=new ui(c,{width:"100%",height:me(o)});a=yr([],[h],s)}return a.height=o,a.style.height=me(o),a},Ix=["bin","close","inner","open","punct","rel"],Px=["accent-token","mathord","op-token","spacing","textord"],zx=new Set(Ix),Lx=new Set(Px);function Dx(i){return zx.has(i)}function ot(i,e){if(!i||i.type!==e)throw new Error("Expected node of type "+e+", but got "+(i?"node of type "+i.type:String(i)));return i}function il(i){var e=rl(i);if(!e)throw new Error("Expected node of symbol group type, but got "+(i?"node of type "+i.type:String(i)));return e}function rl(i){return i.type==="atom"||Lx.has(i.type)?i:null}function Uh(i,e,t){var n="";for(var r of i.body)if(r.type==="textord")n+=r.text;else if(t&&r.type==="spacing"&&r.text===" ")n+=" ";else throw new fe(e,i);return n}var ip=i=>{if(i instanceof Dn)return i;if(sx(i)&&i.children.length===1)return ip(i.children[0])},rp=(i,e)=>{var t,n,r;i&&i.type==="supsub"?(n=ot(i.base,"accent"),t=n.base,i.base=t,r=rx(vt(i,e)),i.base=n):(n=ot(i,"accent"),t=n.base);var s=vt(t,e.havingCrampedStyle()),a=n.isShifty&&qi(t),o=0;if(a){var l,c;o=(l=(c=ip(s))==null?void 0:c.skew)!=null?l:0}var h=n.label==="\\c",d=h?s.height+s.depth:Math.min(s.height,e.fontMetrics().xHeight),u;if(n.isStretchy)u=nl(n,e),u=bt({positionType:"firstBaseline",children:[{type:"elem",elem:s},{type:"elem",elem:u,wrapperClasses:["svg-align"],wrapperStyle:o>0?{width:"calc(100% - "+me(2*o)+")",marginLeft:me(2*o)}:void 0}]});else{var f,g;n.label==="\\vec"?(f=Jf("vec",e),g=Zf.vec[1]):(f=el({type:"textord",mode:n.mode,text:n.label},e),f=ix(f),f.italic=0,g=f.width,h&&(d+=f.depth)),u=ue(["accent-body"],[f]);var v=n.label==="\\textcircled";v&&(u.classes.push("accent-full"),d=s.height);var m=o;v||(m-=g/2),u.style.left=me(m),n.label==="\\textcircled"&&(u.style.top=".2em"),u=bt({positionType:"firstBaseline",children:[{type:"elem",elem:s},{type:"kern",size:-d},{type:"elem",elem:u}]})}var p=ue(["mord","katex-accent"],[u],e);return r?(r.children[0]=p,r.height=Math.max(p.height,r.height),r.classes[0]="mord",r):p},Nx=(i,e)=>{var t=i.isStretchy?tl(i.label):new pe("mo",[ri(i.label,i.mode)]),n=new pe("mover",[Et(i.base,e),t]);return n.setAttribute("accent","true"),n},Fx=new RegExp(["\\acute","\\grave","\\ddot","\\tilde","\\bar","\\breve","\\check","\\hat","\\vec","\\dot","\\mathring"].map(i=>"\\"+i).join("|"));Ae({type:"accent",names:["\\acute","\\grave","\\ddot","\\tilde","\\bar","\\breve","\\check","\\hat","\\vec","\\dot","\\mathring","\\widecheck","\\widehat","\\widetilde","\\overrightarrow","\\overleftarrow","\\Overrightarrow","\\overleftrightarrow","\\overgroup","\\overlinesegment","\\overleftharpoon","\\overrightharpoon"],numArgs:1,handler:(i,e)=>{var t=va(e[0]),n=!Fx.test(i.funcName),r=!n||i.funcName==="\\widehat"||i.funcName==="\\widetilde"||i.funcName==="\\widecheck";return{type:"accent",mode:i.parser.mode,label:i.funcName,isStretchy:n,isShifty:r,base:t}},htmlBuilder:rp,mathmlBuilder:Nx});Ae({type:"accent",names:["\\'","\\`","\\^","\\~","\\=","\\u","\\.",'\\"',"\\c","\\r","\\H","\\v","\\textcircled"],numArgs:1,allowedInText:!0,allowedInMath:!0,argTypes:["primitive"],handler:(i,e)=>{var t=e[0],n=i.parser.mode;return n==="math"&&(i.parser.settings.reportNonstrict("mathVsTextAccents","LaTeX's accent "+i.funcName+" works only in text mode"),n="text"),{type:"accent",mode:n,label:i.funcName,isStretchy:!1,isShifty:!0,base:t}}});Ae({type:"accentUnder",names:["\\underleftarrow","\\underrightarrow","\\underleftrightarrow","\\undergroup","\\underlinesegment","\\utilde"],numArgs:1,handler:(i,e)=>{var t=i.parser,n=i.funcName,r=e[0];return{type:"accentUnder",mode:t.mode,label:n,base:r}},htmlBuilder:(i,e)=>{var t=vt(i.base,e),n=nl(i,e),r=i.label==="\\utilde"?.12:0,s=bt({positionType:"top",positionData:t.height,children:[{type:"elem",elem:n,wrapperClasses:["svg-align"]},{type:"kern",size:r},{type:"elem",elem:t}]});return ue(["mord","accentunder"],[s],e)},mathmlBuilder:(i,e)=>{var t=tl(i.label),n=new pe("munder",[Et(i.base,e),t]);return n.setAttribute("accentunder","true"),n}});var Ho=i=>{var e=new pe("mpadded",i?[i]:[]);return e.setAttribute("width","+0.6em"),e.setAttribute("lspace","0.3em"),e};Ae({type:"xArrow",names:["\\xleftarrow","\\xrightarrow","\\xLeftarrow","\\xRightarrow","\\xleftrightarrow","\\xLeftrightarrow","\\xhookleftarrow","\\xhookrightarrow","\\xmapsto","\\xrightharpoondown","\\xrightharpoonup","\\xleftharpoondown","\\xleftharpoonup","\\xrightleftharpoons","\\xleftrightharpoons","\\xlongequal","\\xtwoheadrightarrow","\\xtwoheadleftarrow","\\xtofrom","\\xrightleftarrows","\\xrightequilibrium","\\xleftequilibrium","\\\\cdrightarrow","\\\\cdleftarrow","\\\\cdlongequal"],numArgs:1,numOptionalArgs:1,handler(i,e,t){var n=i.parser,r=i.funcName;return{type:"xArrow",mode:n.mode,label:r,body:e[0],below:t[0]}},htmlBuilder(i,e){var t=e.style,n=e.havingStyle(t.sup()),r=bs(vt(i.body,n,e),e),s=i.label.slice(0,2)==="\\x"?"x":"cd";r.classes.push(s+"-arrow-pad");var a;i.below&&(n=e.havingStyle(t.sub()),a=bs(vt(i.below,n,e),e),a.classes.push(s+"-arrow-pad"));var o=nl(i,e),l=-e.fontMetrics().axisHeight+.5*o.height,c=-e.fontMetrics().axisHeight-.5*o.height-.111;(r.depth>.25||i.label==="\\xleftequilibrium")&&(c-=r.depth);var h;if(a){var d=-e.fontMetrics().axisHeight+a.height+.5*o.height+.111;h=bt({positionType:"individualShift",children:[{type:"elem",elem:r,shift:c},{type:"elem",elem:o,shift:l,wrapperClasses:["svg-align"]},{type:"elem",elem:a,shift:d}]})}else h=bt({positionType:"individualShift",children:[{type:"elem",elem:r,shift:c},{type:"elem",elem:o,shift:l,wrapperClasses:["svg-align"]}]});return ue(["mrel","x-arrow"],[h],e)},mathmlBuilder(i,e){var t=tl(i.label);t.setAttribute("minsize",i.label.charAt(0)==="x"?"1.75em":"3.0em");var n;if(i.body){var r=Ho(Et(i.body,e));if(i.below){var s=Ho(Et(i.below,e));n=new pe("munderover",[t,s,r])}else n=new pe("mover",[t,r])}else if(i.below){var a=Ho(Et(i.below,e));n=new pe("munder",[t,a])}else n=Ho(),n=new pe("mover",[t,n]);return n}});function Ux(i,e){var t=fn(i.body,e,!0);return ue([i.mclass],t,e)}function Bx(i,e){var t,n=Kn(i.body,e);return i.mclass==="minner"?t=new pe("mpadded",n):i.mclass==="mord"?i.isCharacterBox?(t=n[0],t.type="mi"):t=new pe("mi",n):(i.isCharacterBox?(t=n[0],t.type="mo"):t=new pe("mo",n),i.mclass==="mbin"?(t.attributes.lspace="0.22em",t.attributes.rspace="0.22em"):i.mclass==="mpunct"?(t.attributes.lspace="0em",t.attributes.rspace="0.17em"):(i.mclass==="mopen"||i.mclass==="mclose")&&(t.attributes.lspace="0em",t.attributes.rspace="0em")),t}Ae({type:"mclass",names:["\\mathord","\\mathbin","\\mathrel","\\mathopen","\\mathclose","\\mathpunct","\\mathinner"],numArgs:1,primitive:!0,handler(i,e){var t=i.parser,n=i.funcName,r=e[0];return{type:"mclass",mode:t.mode,mclass:"m"+n.slice(5),body:tn(r),isCharacterBox:qi(r)}},htmlBuilder:Ux,mathmlBuilder:Bx});var sl=i=>{var e=i.type==="ordgroup"&&i.body.length?i.body[0]:i;return e.type==="atom"&&(e.family==="bin"||e.family==="rel")?"m"+e.family:"mord"};Ae({type:"mclass",names:["\\@binrel"],numArgs:2,handler(i,e){var t=i.parser;return{type:"mclass",mode:t.mode,mclass:sl(e[0]),body:tn(e[1]),isCharacterBox:qi(e[1])}}});Ae({type:"mclass",names:["\\stackrel","\\overset","\\underset"],numArgs:2,handler(i,e){var t=i.parser,n=i.funcName,r=e[1],s=e[0],a;n!=="\\stackrel"?a=sl(r):a="mrel";var o={type:"op",mode:r.mode,limits:!0,alwaysHandleSupSub:!0,parentIsSupSub:!1,symbol:!1,suppressBaseShift:n!=="\\stackrel",body:tn(r)},l=n==="\\underset"?{type:"supsub",mode:s.mode,base:o,sub:s}:{type:"supsub",mode:s.mode,base:o,sup:s};return{type:"mclass",mode:t.mode,mclass:a,body:[l],isCharacterBox:qi(l)}}});Ae({type:"pmb",names:["\\pmb"],numArgs:1,allowedInText:!0,handler(i,e){var t=i.parser;return{type:"pmb",mode:t.mode,mclass:sl(e[0]),body:tn(e[0])}},htmlBuilder(i,e){var t=fn(i.body,e,!0),n=ue([i.mclass],t,e);return n.style.textShadow="0.02em 0.01em 0.04px",n},mathmlBuilder(i,e){var t=Kn(i.body,e),n=new pe("mstyle",t);return n.setAttribute("style","text-shadow: 0.02em 0.01em 0.04px"),n}});var Ox={">":"\\\\cdrightarrow","<":"\\\\cdleftarrow","=":"\\\\cdlongequal",A:"\\uparrow",V:"\\downarrow","|":"\\Vert",".":"no arrow"},yf=()=>({type:"styling",body:[],mode:"math",style:"display",resetFont:!0}),bf=i=>i.type==="textord"&&i.text==="@",Vx=(i,e)=>(i.type==="mathord"||i.type==="atom")&&i.text===e;function Hx(i,e,t){var n=Ox[i];switch(n){case"\\\\cdrightarrow":case"\\\\cdleftarrow":return t.callFunction(n,[e[0]],[e[1]]);case"\\uparrow":case"\\downarrow":{var r=t.callFunction("\\\\cdleft",[e[0]],[]),s={type:"atom",text:n,mode:"math",family:"rel"},a=t.callFunction("\\Big",[s],[]),o=t.callFunction("\\\\cdright",[e[1]],[]),l={type:"ordgroup",mode:"math",body:[r,a,o]};return t.callFunction("\\\\cdparent",[l],[])}case"\\\\cdlongequal":return t.callFunction("\\\\cdlongequal",[],[]);case"\\Vert":{var c={type:"textord",text:"\\Vert",mode:"math"};return t.callFunction("\\Big",[c],[])}default:return{type:"textord",text:" ",mode:"math"}}}function Gx(i){var e=[];for(i.gullet.beginGroup(),i.gullet.macros.set("\\cr","\\\\\\relax"),i.gullet.beginGroup();;){e.push(i.parseExpression(!1,"\\\\")),i.gullet.endGroup(),i.gullet.beginGroup();var t=i.fetch().text;if(t==="&"||t==="\\\\")i.consume();else if(t==="\\end"){e[e.length-1].length===0&&e.pop();break}else throw new fe("Expected \\\\ or \\cr or \\end",i.nextToken)}for(var n=[],r=[n],s=0;s<e.length;s++){for(var a=e[s],o=yf(),l=0;l<a.length;l++)if(!bf(a[l]))o.body.push(a[l]);else{n.push(o),l+=1;var c=il(a[l]).text,h=new Array(2);if(h[0]={type:"ordgroup",mode:"math",body:[]},h[1]={type:"ordgroup",mode:"math",body:[]},!"=|.".includes(c))if("<>AV".includes(c))for(var d=0;d<2;d++){for(var u=!0,f=l+1;f<a.length;f++){if(Vx(a[f],c)){u=!1,l=f;break}if(bf(a[f]))throw new fe("Missing a "+c+" character to complete a CD arrow.",a[f]);h[d].body.push(a[f])}if(u)throw new fe("Missing a "+c+" character to complete a CD arrow.",a[l])}else throw new fe('Expected one of "<>AV=|." after @',a[l]);var g=Hx(c,h,i),v={type:"styling",body:[g],mode:"math",style:"display",resetFont:!0};n.push(v),o=yf()}s%2===0?n.push(o):n.shift(),n=[],r.push(n)}i.gullet.endGroup(),i.gullet.endGroup();var m=new Array(r[0].length).fill({type:"align",align:"c",pregap:.25,postgap:.25});return{type:"array",mode:"math",body:r,arraystretch:1,addJot:!0,rowGaps:[null],cols:m,colSeparationType:"CD",hLinesBeforeRow:new Array(r.length+1).fill([])}}Ae({type:"cdlabel",names:["\\\\cdleft","\\\\cdright"],numArgs:1,handler(i,e){var t=i.parser,n=i.funcName;return{type:"cdlabel",mode:t.mode,side:n.slice(4),label:e[0]}},htmlBuilder(i,e){var t=e.havingStyle(e.style.sup()),n=bs(vt(i.label,t,e),e);return n.classes.push("cd-label-"+i.side),n.style.bottom=me(.8-n.depth),n.height=0,n.depth=0,n},mathmlBuilder(i,e){var t=new pe("mrow",[Et(i.label,e)]);return t=new pe("mpadded",[t]),t.setAttribute("width","0"),i.side==="left"&&t.setAttribute("lspace","-1width"),t.setAttribute("voffset","0.7em"),t=new pe("mstyle",[t]),t.setAttribute("displaystyle","false"),t.setAttribute("scriptlevel","1"),t}});Ae({type:"cdlabelparent",names:["\\\\cdparent"],numArgs:1,handler(i,e){var t=i.parser;return{type:"cdlabelparent",mode:t.mode,fragment:e[0]}},htmlBuilder(i,e){var t=bs(vt(i.fragment,e),e);return t.classes.push("cd-vert-arrow"),t},mathmlBuilder(i,e){return new pe("mrow",[Et(i.fragment,e)])}});Ae({type:"textord",names:["\\@char"],numArgs:1,allowedInText:!0,handler(i,e){var t=i.parser,n=ot(e[0],"ordgroup"),r=Uh(n,"\\@char has non-numeric argument"),s=parseInt(r),a;if(isNaN(s))throw new fe("\\@char has non-numeric argument "+r);if(s<0||s>1114111)throw new fe("\\@char with invalid code point "+r);return s<=65535?a=String.fromCharCode(s):(s-=65536,a=String.fromCharCode((s>>10)+55296,(s&1023)+56320)),{type:"textord",mode:t.mode,text:a}}});var Wx=(i,e)=>{var t=fn(i.body,e.withColor(i.color),!1);return $i(t)},qx=(i,e)=>{var t=Kn(i.body,e.withColor(i.color)),n=new pe("mstyle",t);return n.setAttribute("mathcolor",i.color),n};Ae({type:"color",names:["\\textcolor"],numArgs:2,allowedInText:!0,argTypes:["color","original"],handler(i,e){var t=i.parser,n=ot(e[0],"color-token").color,r=e[1];return{type:"color",mode:t.mode,color:n,body:tn(r)}},htmlBuilder:Wx,mathmlBuilder:qx});Ae({type:"color",names:["\\color"],numArgs:1,allowedInText:!0,argTypes:["color"],handler(i,e){var t=i.parser,n=i.breakOnTokenText,r=ot(e[0],"color-token").color;t.gullet.macros.set("\\current@color",r);var s=t.parseExpression(!0,n);return{type:"color",mode:t.mode,color:r,body:s}}});Ae({type:"cr",names:["\\\\"],numArgs:0,numOptionalArgs:0,allowedInText:!0,handler(i,e,t){var n=i.parser,r=n.gullet.future().text==="["?n.parseSizeGroup(!0):null,s=!n.settings.displayMode||!n.settings.useStrictBehavior("newLineInDisplayMode","In LaTeX, \\\\ or \\newline does nothing in display mode");return{type:"cr",mode:n.mode,newLine:s,size:r&&ot(r,"size").value}},htmlBuilder(i,e){var t=ue(["mspace"],[],e);return i.newLine&&(t.classes.push("katex-newline"),i.size&&(t.style.marginTop=me(Wt(i.size,e)))),t},mathmlBuilder(i,e){var t=new pe("mspace");return i.newLine&&(t.setAttribute("linebreak","newline"),i.size&&t.setAttribute("height",me(Wt(i.size,e)))),t}});var wh={"\\global":"\\global","\\long":"\\\\globallong","\\\\globallong":"\\\\globallong","\\def":"\\gdef","\\gdef":"\\gdef","\\edef":"\\xdef","\\xdef":"\\xdef","\\let":"\\\\globallet","\\futurelet":"\\\\globalfuture"},sp=i=>{var e=i.text;if(/^(?:[\\{}$&#^_]|EOF)$/.test(e))throw new fe("Expected a control sequence",i);return e},Xx=i=>{var e=i.gullet.popToken();return e.text==="="&&(e=i.gullet.popToken(),e.text===" "&&(e=i.gullet.popToken())),e},ap=(i,e,t,n)=>{var r=i.gullet.macros.get(t.text);r==null&&(t.noexpand=!0,r={tokens:[t],numArgs:0,unexpandable:!i.gullet.isExpandable(t.text)}),i.gullet.macros.set(e,r,n)};Ae({type:"internal",names:["\\global","\\long","\\\\globallong"],numArgs:0,allowedInText:!0,handler(i){var e=i.parser,t=i.funcName;e.consumeSpaces();var n=e.fetch();if(wh[n.text])return(t==="\\global"||t==="\\\\globallong")&&(n.text=wh[n.text]),ot(e.parseFunction(),"internal");throw new fe("Invalid token after macro prefix",n)}});Ae({type:"internal",names:["\\def","\\gdef","\\edef","\\xdef"],numArgs:0,allowedInText:!0,primitive:!0,handler(i){var e=i.parser,t=i.funcName,n=e.gullet.popToken(),r=n.text;if(/^(?:[\\{}$&#^_]|EOF)$/.test(r))throw new fe("Expected a control sequence",n);for(var s=0,a,o=[[]];e.gullet.future().text!=="{";)if(n=e.gullet.popToken(),n.text==="#"){if(e.gullet.future().text==="{"){a=e.gullet.future(),o[s].push("{");break}if(n=e.gullet.popToken(),!/^[1-9]$/.test(n.text))throw new fe('Invalid argument number "'+n.text+'"');if(parseInt(n.text)!==s+1)throw new fe('Argument number "'+n.text+'" out of order');s++,o.push([])}else{if(n.text==="EOF")throw new fe("Expected a macro definition");o[s].push(n.text)}var l=e.gullet.consumeArg(),c=l.tokens;return a&&c.unshift(a),(t==="\\edef"||t==="\\xdef")&&(c=e.gullet.expandTokens(c),c.reverse()),e.gullet.macros.set(r,{tokens:c,numArgs:s,delimiters:o},t===wh[t]),{type:"internal",mode:e.mode}}});Ae({type:"internal",names:["\\let","\\\\globallet"],numArgs:0,allowedInText:!0,primitive:!0,handler(i){var e=i.parser,t=i.funcName,n=sp(e.gullet.popToken());e.gullet.consumeSpaces();var r=Xx(e);return ap(e,n,r,t==="\\\\globallet"),{type:"internal",mode:e.mode}}});Ae({type:"internal",names:["\\futurelet","\\\\globalfuture"],numArgs:0,allowedInText:!0,primitive:!0,handler(i){var e=i.parser,t=i.funcName,n=sp(e.gullet.popToken()),r=e.gullet.popToken(),s=e.gullet.popToken();return ap(e,n,s,t==="\\\\globalfuture"),e.gullet.pushToken(s),e.gullet.pushToken(r),{type:"internal",mode:e.mode}}});var ua=function(e,t,n){var r=Ot.math[e]&&Ot.math[e].replace,s=zh(r||e,t,n);if(!s)throw new Error("Unsupported symbol "+e+" and font size "+t+".");return s},Bh=function(e,t,n,r){var s=n.havingBaseStyle(t),a=ue(r.concat(s.sizingClasses(n)),[e],n),o=s.sizeMultiplier/n.sizeMultiplier;return a.height*=o,a.depth*=o,a.maxFontSize=s.sizeMultiplier,a},op=function(e,t,n){var r=t.havingBaseStyle(n),s=(1-t.sizeMultiplier/r.sizeMultiplier)*t.fontMetrics().axisHeight;e.classes.push("delimcenter"),e.style.top=me(s),e.height-=s,e.depth+=s},$x=function(e,t,n,r,s,a){var o=zn(e,"Main-Regular",s,r),l=Bh(o,t,r,a);return n&&op(l,r,t),l},Yx=function(e,t,n,r){return zn(e,"Size"+t+"-Regular",n,r)},lp=function(e,t,n,r,s,a){var o=Yx(e,t,s,r),l=Bh(ue(["delimsizing","size"+t],[o],r),Je.TEXT,r,a);return n&&op(l,r,Je.TEXT),l},nh=function(e,t,n){var r;t==="Size1-Regular"?r="delim-size1":r="delim-size4";var s=ue(["delimsizinginner",r],[ue([],[zn(e,t,n)])]);return{type:"elem",elem:s}},ih=function(e,t,n){var r=Ei["Size4-Regular"][e.charCodeAt(0)]?Ei["Size4-Regular"][e.charCodeAt(0)][4]:Ei["Size1-Regular"][e.charCodeAt(0)][4],s=new Ci("inner",Jg(e,Math.round(1e3*t))),a=new ui([s],{width:me(r),height:me(t),style:"width:"+me(r),viewBox:"0 0 "+1e3*r+" "+Math.round(1e3*t),preserveAspectRatio:"xMinYMin"}),o=yr([],[a],n);return o.height=t,o.style.height=me(t),o.style.width=me(r),{type:"elem",elem:o}},Th=.008,Go={type:"kern",size:-1*Th},Kx=new Set(["|","\\lvert","\\rvert","\\vert"]),Zx=new Set(["\\|","\\lVert","\\rVert","\\Vert"]),cp=function(e,t,n,r,s,a){var o,l,c,h,d="",u=0;o=c=h=e,l=null;var f="Size1-Regular";e==="\\uparrow"?c=h="⏐":e==="\\Uparrow"?c=h="‖":e==="\\downarrow"?o=c="⏐":e==="\\Downarrow"?o=c="‖":e==="\\updownarrow"?(o="\\uparrow",c="⏐",h="\\downarrow"):e==="\\Updownarrow"?(o="\\Uparrow",c="‖",h="\\Downarrow"):Kx.has(e)?(c="∣",d="vert",u=333):Zx.has(e)?(c="∥",d="doublevert",u=556):e==="["||e==="\\lbrack"?(o="⎡",c="⎢",h="⎣",f="Size4-Regular",d="lbrack",u=667):e==="]"||e==="\\rbrack"?(o="⎤",c="⎥",h="⎦",f="Size4-Regular",d="rbrack",u=667):e==="\\lfloor"||e==="⌊"?(c=o="⎢",h="⎣",f="Size4-Regular",d="lfloor",u=667):e==="\\lceil"||e==="⌈"?(o="⎡",c=h="⎢",f="Size4-Regular",d="lceil",u=667):e==="\\rfloor"||e==="⌋"?(c=o="⎥",h="⎦",f="Size4-Regular",d="rfloor",u=667):e==="\\rceil"||e==="⌉"?(o="⎤",c=h="⎥",f="Size4-Regular",d="rceil",u=667):e==="("||e==="\\lparen"?(o="⎛",c="⎜",h="⎝",f="Size4-Regular",d="lparen",u=875):e===")"||e==="\\rparen"?(o="⎞",c="⎟",h="⎠",f="Size4-Regular",d="rparen",u=875):e==="\\{"||e==="\\lbrace"?(o="⎧",l="⎨",h="⎩",c="⎪",f="Size4-Regular"):e==="\\}"||e==="\\rbrace"?(o="⎫",l="⎬",h="⎭",c="⎪",f="Size4-Regular"):e==="\\lgroup"||e==="⟮"?(o="⎧",h="⎩",c="⎪",f="Size4-Regular"):e==="\\rgroup"||e==="⟯"?(o="⎫",h="⎭",c="⎪",f="Size4-Regular"):e==="\\lmoustache"||e==="⎰"?(o="⎧",h="⎭",c="⎪",f="Size4-Regular"):(e==="\\rmoustache"||e==="⎱")&&(o="⎫",h="⎩",c="⎪",f="Size4-Regular");var g=ua(o,f,s),v=g.height+g.depth,m=ua(c,f,s),p=m.height+m.depth,_=ua(h,f,s),A=_.height+_.depth,M=0,T=1;if(l!==null){var S=ua(l,f,s);M=S.height+S.depth,T=2}var I=v+A+M,b=Math.max(0,Math.ceil((t-I)/(T*p))),R=I+b*T*p,L=r.fontMetrics().axisHeight;n&&(L*=r.sizeMultiplier);var N=R/2-L,U=[];if(d.length>0){var W=R-v-A,F=Math.round(R*1e3),q=jg(d,Math.round(W*1e3)),Z=new Ci(d,q),J=me(u/1e3),re=me(F/1e3),Q=new ui([Z],{width:J,height:re,viewBox:"0 0 "+u+" "+F}),ne=yr([],[Q],r);ne.height=F/1e3,ne.style.width=J,ne.style.height=re,U.push({type:"elem",elem:ne})}else{if(U.push(nh(h,f,s)),U.push(Go),l===null){var se=R-v-A+2*Th;U.push(ih(c,se,r))}else{var ke=(R-v-A-M)/2+2*Th;U.push(ih(c,ke,r)),U.push(Go),U.push(nh(l,f,s)),U.push(Go),U.push(ih(c,ke,r))}U.push(Go),U.push(nh(o,f,s))}var Re=r.havingBaseStyle(Je.TEXT),mt=bt({positionType:"bottom",positionData:N,children:U});return Bh(ue(["delimsizing","mult"],[mt],Re),Je.TEXT,r,a)},rh=80,sh=.08,ah=function(e,t,n,r,s){var a=Zg(e,r,n),o=new Ci(e,a),l=new ui([o],{width:"400em",height:me(t),viewBox:"0 0 400000 "+n,preserveAspectRatio:"xMinYMin slice"});return yr(["hide-tail"],[l],s)},Jx=function(e,t){var n=t.havingBaseSizing(),r=pp("\\surd",e*n.sizeMultiplier,fp,n),s=n.sizeMultiplier,a=Math.max(0,t.minRuleThickness-t.fontMetrics().sqrtRuleThickness),o,l,c,h,d;return r.type==="small"?(h=1e3+1e3*a+rh,e<1?s=1:e<1.4&&(s=.7),l=(1+a+sh)/s,c=(1+a)/s,o=ah("sqrtMain",l,h,a,t),o.style.minWidth="0.853em",d=.833/s):r.type==="large"?(h=(1e3+rh)*da[r.size],c=(da[r.size]+a)/s,l=(da[r.size]+a+sh)/s,o=ah("sqrtSize"+r.size,l,h,a,t),o.style.minWidth="1.02em",d=1/s):(l=e+a+sh,c=e+a,h=Math.floor(1e3*e+a)+rh,o=ah("sqrtTall",l,h,a,t),o.style.minWidth="0.742em",d=1.056),o.height=c,o.style.height=me(l),{span:o,advanceWidth:d,ruleWidth:(t.fontMetrics().sqrtRuleThickness+a)*s}},hp=new Set(["(","\\lparen",")","\\rparen","[","\\lbrack","]","\\rbrack","\\{","\\lbrace","\\}","\\rbrace","\\lfloor","\\rfloor","⌊","⌋","\\lceil","\\rceil","⌈","⌉","\\surd"]),jx=new Set(["\\uparrow","\\downarrow","\\updownarrow","\\Uparrow","\\Downarrow","\\Updownarrow","|","\\|","\\vert","\\Vert","\\lvert","\\rvert","\\lVert","\\rVert","\\lgroup","\\rgroup","⟮","⟯","\\lmoustache","\\rmoustache","⎰","⎱"]),up=new Set(["<",">","\\langle","\\rangle","/","\\backslash","\\lt","\\gt"]),da=[0,1.2,1.8,2.4,3],dp=function(e,t,n,r,s){if(e==="<"||e==="\\lt"||e==="⟨"?e="\\langle":(e===">"||e==="\\gt"||e==="⟩")&&(e="\\rangle"),hp.has(e)||up.has(e))return lp(e,t,!1,n,r,s);if(jx.has(e))return cp(e,da[t],!1,n,r,s);throw new fe("Illegal delimiter: '"+e+"'")},Qx=[{type:"small",style:Je.SCRIPTSCRIPT},{type:"small",style:Je.SCRIPT},{type:"small",style:Je.TEXT},{type:"large",size:1},{type:"large",size:2},{type:"large",size:3},{type:"large",size:4}],ev=[{type:"small",style:Je.SCRIPTSCRIPT},{type:"small",style:Je.SCRIPT},{type:"small",style:Je.TEXT},{type:"stack"}],fp=[{type:"small",style:Je.SCRIPTSCRIPT},{type:"small",style:Je.SCRIPT},{type:"small",style:Je.TEXT},{type:"large",size:1},{type:"large",size:2},{type:"large",size:3},{type:"large",size:4},{type:"stack"}],tv=function(e){if(e.type==="small")return"Main-Regular";if(e.type==="large")return"Size"+e.size+"-Regular";if(e.type==="stack")return"Size4-Regular";var t=e.type;throw new Error("Add support for delim type '"+t+"' here.")},pp=function(e,t,n,r){for(var s=Math.min(2,3-r.style.size),a=s;a<n.length;a++){var o=n[a];if(o.type==="stack")break;var l=ua(e,tv(o),"math"),c=l.height+l.depth;if(o.type==="small"){var h=r.havingBaseStyle(o.style);c*=h.sizeMultiplier}if(c>t)return o}return n[n.length-1]},Ah=function(e,t,n,r,s,a){e==="<"||e==="\\lt"||e==="⟨"?e="\\langle":(e===">"||e==="\\gt"||e==="⟩")&&(e="\\rangle");var o;up.has(e)?o=Qx:hp.has(e)?o=fp:o=ev;var l=pp(e,t,o,r);return l.type==="small"?$x(e,l.style,n,r,s,a):l.type==="large"?lp(e,l.size,n,r,s,a):cp(e,t,n,r,s,a)},oh=function(e,t,n,r,s,a){var o=r.fontMetrics().axisHeight*r.sizeMultiplier,l=901,c=5/r.fontMetrics().ptPerEm,h=Math.max(t-o,n+o),d=Math.max(h/500*l,2*h-c);return Ah(e,d,!0,r,s,a)},_f={"\\bigl":{mclass:"mopen",size:1},"\\Bigl":{mclass:"mopen",size:2},"\\biggl":{mclass:"mopen",size:3},"\\Biggl":{mclass:"mopen",size:4},"\\bigr":{mclass:"mclose",size:1},"\\Bigr":{mclass:"mclose",size:2},"\\biggr":{mclass:"mclose",size:3},"\\Biggr":{mclass:"mclose",size:4},"\\bigm":{mclass:"mrel",size:1},"\\Bigm":{mclass:"mrel",size:2},"\\biggm":{mclass:"mrel",size:3},"\\Biggm":{mclass:"mrel",size:4},"\\big":{mclass:"mord",size:1},"\\Big":{mclass:"mord",size:2},"\\bigg":{mclass:"mord",size:3},"\\Bigg":{mclass:"mord",size:4}},nv=new Set(["(","\\lparen",")","\\rparen","[","\\lbrack","]","\\rbrack","\\{","\\lbrace","\\}","\\rbrace","\\lfloor","\\rfloor","⌊","⌋","\\lceil","\\rceil","⌈","⌉","<",">","\\langle","⟨","\\rangle","⟩","\\lt","\\gt","\\lvert","\\rvert","\\lVert","\\rVert","\\lgroup","\\rgroup","⟮","⟯","\\lmoustache","\\rmoustache","⎰","⎱","/","\\backslash","|","\\vert","\\|","\\Vert","\\uparrow","\\Uparrow","\\downarrow","\\Downarrow","\\updownarrow","\\Updownarrow","."]);function Mf(i){return"isMiddle"in i}function al(i,e){var t=rl(i);if(t&&nv.has(t.text))return t;throw t?new fe("Invalid delimiter '"+t.text+"' after '"+e.funcName+"'",i):new fe("Invalid delimiter type '"+i.type+"'",i)}Ae({type:"delimsizing",names:["\\bigl","\\Bigl","\\biggl","\\Biggl","\\bigr","\\Bigr","\\biggr","\\Biggr","\\bigm","\\Bigm","\\biggm","\\Biggm","\\big","\\Big","\\bigg","\\Bigg"],numArgs:1,argTypes:["primitive"],handler:(i,e)=>{var t=al(va(e[0]),i);return{type:"delimsizing",mode:i.parser.mode,size:_f[i.funcName].size,mclass:_f[i.funcName].mclass,delim:t.text}},htmlBuilder:(i,e)=>i.delim==="."?ue([i.mclass]):dp(i.delim,i.size,e,i.mode,[i.mclass]),mathmlBuilder:i=>{var e=[];i.delim!=="."&&e.push(ri(i.delim,i.mode));var t=new pe("mo",e);i.mclass==="mopen"||i.mclass==="mclose"?t.setAttribute("fence","true"):t.setAttribute("fence","false"),t.setAttribute("stretchy","true");var n=me(da[i.size]);return t.setAttribute("minsize",n),t.setAttribute("maxsize",n),t}});function Sf(i){if(!i.body)throw new Error("Bug: The leftright ParseNode wasn't fully parsed.")}Ae({type:"leftright-right",names:["\\right"],numArgs:1,primitive:!0,handler:(i,e)=>{var t=i.parser.gullet.macros.get("\\current@color");if(t&&typeof t!="string")throw new fe("\\current@color set to non-string in \\right");return{type:"leftright-right",mode:i.parser.mode,delim:al(e[0],i).text,color:t}}});Ae({type:"leftright",names:["\\left"],numArgs:1,primitive:!0,handler:(i,e)=>{var t=al(e[0],i),n=i.parser;++n.leftrightDepth;var r=n.parseExpression(!1);--n.leftrightDepth,n.expect("\\right",!1);var s=ot(n.parseFunction(),"leftright-right");return{type:"leftright",mode:n.mode,body:r,left:t.text,right:s.delim,rightColor:s.color}},htmlBuilder:(i,e)=>{Sf(i);for(var t=fn(i.body,e,!0,["mopen","mclose"]),n=0,r=0,s=!1,a=0;a<t.length;a++){var o=t[a];Mf(o)?s=!0:(n=Math.max(t[a].height,n),r=Math.max(t[a].depth,r))}n*=e.sizeMultiplier,r*=e.sizeMultiplier;var l;if(i.left==="."?l=ya(e,["mopen"]):l=oh(i.left,n,r,e,i.mode,["mopen"]),t.unshift(l),s)for(var c=1;c<t.length;c++){var h=t[c];if(Mf(h)){var d=h.isMiddle;t[c]=oh(d.delim,n,r,d.options,i.mode,[])}}var u;if(i.right===".")u=ya(e,["mclose"]);else{var f=i.rightColor?e.withColor(i.rightColor):e;u=oh(i.right,n,r,f,i.mode,["mclose"])}return t.push(u),ue(["minner"],t,e)},mathmlBuilder:(i,e)=>{Sf(i);var t=Kn(i.body,e);if(i.left!=="."){var n=new pe("mo",[ri(i.left,i.mode)]);n.setAttribute("fence","true"),t.unshift(n)}if(i.right!=="."){var r=new pe("mo",[ri(i.right,i.mode)]);r.setAttribute("fence","true"),i.rightColor&&r.setAttribute("mathcolor",i.rightColor),t.push(r)}return Nh(t)}});Ae({type:"middle",names:["\\middle"],numArgs:1,primitive:!0,handler:(i,e)=>{var t=al(e[0],i);if(!i.parser.leftrightDepth)throw new fe("\\middle without preceding \\left",t);return{type:"middle",mode:i.parser.mode,delim:t.text}},htmlBuilder:(i,e)=>{var t;return i.delim==="."?t=ya(e,[]):(t=dp(i.delim,1,e,i.mode,[]),t.isMiddle={delim:i.delim,options:e}),t},mathmlBuilder:(i,e)=>{var t=i.delim==="\\vert"||i.delim==="|"?ri("|","text"):ri(i.delim,i.mode),n=new pe("mo",[t]);return n.setAttribute("fence","true"),n.setAttribute("lspace","0.05em"),n.setAttribute("rspace","0.05em"),n}});var iv=(i,e)=>{var t=bs(vt(i.body,e),e),n=i.label.slice(1),r=e.sizeMultiplier,s,a,o=qi(i.body);if(n==="sout")s=ue(["katex-stretchy","katex-sout"]),s.height=e.fontMetrics().defaultRuleThickness/r,a=-.5*e.fontMetrics().xHeight;else if(n==="phase"){var l=Wt({number:.6,unit:"pt"},e),c=Wt({number:.35,unit:"ex"},e),h=e.havingBaseSizing();r=r/h.sizeMultiplier;var d=t.height+t.depth+l+c;t.style.paddingLeft=me(d/2+l);var u=Math.floor(1e3*d*r),f=Yg(u),g=new ui([new Ci("phase",f)],{width:"400em",height:me(u/1e3),viewBox:"0 0 400000 "+u,preserveAspectRatio:"xMinYMin slice"});s=yr(["hide-tail"],[g],e),s.style.height=me(d),a=t.depth+l+c}else{/cancel/.test(n)?o||t.classes.push("cancel-pad"):n==="angl"?t.classes.push("anglpad"):t.classes.push("boxpad");var v,m,p=0;/box/.test(n)?(p=Math.max(e.fontMetrics().fboxrule,e.minRuleThickness),v=e.fontMetrics().fboxsep+(n==="colorbox"?0:p),m=v):n==="angl"?(p=Math.max(e.fontMetrics().defaultRuleThickness,e.minRuleThickness),v=4*p,m=Math.max(0,.25-t.depth)):(v=o?.2:0,m=v),s=kx(t,n,v,m,e),/fbox|boxed|fcolorbox/.test(n)?(s.style.borderStyle="solid",s.style.borderWidth=me(p)):n==="angl"&&p!==.049&&(s.style.borderTopWidth=me(p),s.style.borderRightWidth=me(p)),a=t.depth+m,i.backgroundColor&&(s.style.backgroundColor=i.backgroundColor,i.borderColor&&(s.style.borderColor=i.borderColor))}var _;if(i.backgroundColor)_=bt({positionType:"individualShift",children:[{type:"elem",elem:s,shift:a},{type:"elem",elem:t,shift:0}]});else{var A=/cancel|phase/.test(n)?["svg-align"]:[];_=bt({positionType:"individualShift",children:[{type:"elem",elem:t,shift:0},{type:"elem",elem:s,shift:a,wrapperClasses:A}]})}return/cancel/.test(n)&&(_.height=t.height,_.depth=t.depth),/cancel/.test(n)&&!o?ue(["mord","cancel-lap"],[_],e):ue(["mord"],[_],e)},rv=(i,e)=>{var t,n=new pe(i.label.includes("colorbox")?"mpadded":"menclose",[Et(i.body,e)]);switch(i.label){case"\\cancel":n.setAttribute("notation","updiagonalstrike");break;case"\\bcancel":n.setAttribute("notation","downdiagonalstrike");break;case"\\phase":n.setAttribute("notation","phasorangle");break;case"\\sout":n.setAttribute("notation","horizontalstrike");break;case"\\fbox":n.setAttribute("notation","box");break;case"\\angl":n.setAttribute("notation","actuarial");break;case"\\fcolorbox":case"\\colorbox":if(t=e.fontMetrics().fboxsep*e.fontMetrics().ptPerEm,n.setAttribute("width","+"+2*t+"pt"),n.setAttribute("height","+"+2*t+"pt"),n.setAttribute("lspace",t+"pt"),n.setAttribute("voffset",t+"pt"),i.label==="\\fcolorbox"){var r=Math.max(e.fontMetrics().fboxrule,e.minRuleThickness);n.setAttribute("style","border: "+me(r)+" solid "+i.borderColor)}break;case"\\xcancel":n.setAttribute("notation","updiagonalstrike downdiagonalstrike");break}return i.backgroundColor&&n.setAttribute("mathbackground",i.backgroundColor),n};Ae({type:"enclose",names:["\\colorbox"],numArgs:2,allowedInText:!0,argTypes:["color","hbox"],handler(i,e,t){var n=i.parser,r=i.funcName,s=ot(e[0],"color-token").color,a=e[1];return{type:"enclose",mode:n.mode,label:r,backgroundColor:s,body:a}},htmlBuilder:iv,mathmlBuilder:rv});Ae({type:"enclose",names:["\\fcolorbox"],numArgs:3,allowedInText:!0,argTypes:["color","color","hbox"],handler(i,e,t){var n=i.parser,r=i.funcName,s=ot(e[0],"color-token").color,a=ot(e[1],"color-token").color,o=e[2];return{type:"enclose",mode:n.mode,label:r,backgroundColor:a,borderColor:s,body:o}}});Ae({type:"enclose",names:["\\fbox"],numArgs:1,argTypes:["hbox"],allowedInText:!0,handler(i,e){var t=i.parser;return{type:"enclose",mode:t.mode,label:"\\fbox",body:e[0]}}});Ae({type:"enclose",names:["\\cancel","\\bcancel","\\xcancel","\\phase"],numArgs:1,handler(i,e){var t=i.parser,n=i.funcName,r=e[0];return{type:"enclose",mode:t.mode,label:n,body:r}}});Ae({type:"enclose",names:["\\sout"],numArgs:1,allowedInText:!0,handler(i,e){var t=i.parser,n=i.funcName;t.mode==="math"&&t.settings.reportNonstrict("mathVsSout","LaTeX's \\sout works only in text mode");var r=e[0];return{type:"enclose",mode:t.mode,label:n,body:r}}});Ae({type:"enclose",names:["\\angl"],numArgs:1,argTypes:["hbox"],allowedInText:!1,handler(i,e){var t=i.parser;return{type:"enclose",mode:t.mode,label:"\\angl",body:e[0]}}});var mp={};function Ri(i){for(var e=i.type,t=i.names,n=i.props,r=i.handler,s=i.htmlBuilder,a=i.mathmlBuilder,o={type:e,numArgs:n.numArgs||0,allowedInText:!1,numOptionalArgs:0,handler:r},l=0;l<t.length;++l)mp[t[l]]=o;s&&(ga[e]=s),a&&(xa[e]=a)}var gp={};function k(i,e){gp[i]=e}var Bn=class i{constructor(e,t,n){this.lexer=void 0,this.start=void 0,this.end=void 0,this.lexer=e,this.start=t,this.end=n}static range(e,t){return t?!e||!e.loc||!t.loc||e.loc.lexer!==t.loc.lexer?null:new i(e.loc.lexer,e.loc.start,t.loc.end):e&&e.loc}},$n=class i{constructor(e,t){this.text=void 0,this.loc=void 0,this.noexpand=void 0,this.treatAsRelax=void 0,this.text=e,this.loc=t}range(e,t){return new i(t,Bn.range(this,e))}};function wf(i){var e=[];i.consumeSpaces();var t=i.fetch().text;for(t==="\\relax"&&(i.consume(),i.consumeSpaces(),t=i.fetch().text);t==="\\hline"||t==="\\hdashline";)i.consume(),e.push(t==="\\hdashline"),i.consumeSpaces(),t=i.fetch().text;return e}var ol=i=>{var e=i.parser.settings;if(!e.displayMode)throw new fe("{"+i.envName+"} can be used only in display mode.")},sv=new Set(["gather","gather*"]);function Oh(i){if(!i.includes("ed"))return!i.includes("*")}function _r(i,e,t){var n=e.hskipBeforeAndAfter,r=e.addJot,s=e.cols,a=e.arraystretch,o=e.colSeparationType,l=e.autoTag,c=e.singleRow,h=e.emptySingleRow,d=e.maxNumCols,u=e.leqno;if(i.gullet.beginGroup(),c||i.gullet.macros.set("\\cr","\\\\\\relax"),!a){var f=i.gullet.expandMacroAsText("\\arraystretch");if(f==null)a=1;else if(a=parseFloat(f),!a||a<0)throw new fe("Invalid \\arraystretch: "+f)}i.gullet.beginGroup();var g=[],v=[g],m=[],p=[],_=l!=null?[]:void 0;function A(){l&&i.gullet.macros.set("\\@eqnsw","1",!0)}function M(){_&&(i.gullet.macros.get("\\df@tag")?(_.push(i.subparse([new $n("\\df@tag")])),i.gullet.macros.set("\\df@tag",void 0,!0)):_.push(!!l&&i.gullet.macros.get("\\@eqnsw")==="1"))}for(A(),p.push(wf(i));;){var T=i.parseExpression(!1,c?"\\end":"\\\\");i.gullet.endGroup(),i.gullet.beginGroup();var S={type:"ordgroup",mode:i.mode,body:T};t&&(S={type:"styling",mode:i.mode,style:t,resetFont:!0,body:[S]}),g.push(S);var I=i.fetch().text;if(I==="&"){if(d&&g.length===d){if(c||o)throw new fe("Too many tab characters: &",i.nextToken);i.settings.reportNonstrict("textEnv","Too few columns specified in the {array} column argument.")}i.consume()}else if(I==="\\end"){M(),g.length===1&&S.type==="styling"&&S.body.length===1&&S.body[0].type==="ordgroup"&&S.body[0].body.length===0&&(v.length>1||!h)&&!Array.isArray(_?.[_.length-1])&&v.pop(),p.length<v.length+1&&p.push([]);break}else if(I==="\\\\"){i.consume();var b=void 0;i.gullet.future().text!==" "&&(b=i.parseSizeGroup(!0)),m.push(b?b.value:null),M(),p.push(wf(i)),g=[],v.push(g),A()}else throw new fe("Expected & or \\\\ or \\cr or \\end",i.nextToken)}return i.gullet.endGroup(),i.gullet.endGroup(),{type:"array",mode:i.mode,addJot:r,arraystretch:a,body:v,cols:s,rowGaps:m,hskipBeforeAndAfter:n,hLinesBeforeRow:p,colSeparationType:o,tags:_,leqno:u}}function Vh(i){return i.slice(0,1)==="d"?"display":"text"}var ki=function(e,t){var n,r,s=e.body.length,a=e.hLinesBeforeRow,o=0,l=new Array(s),c=[],h=Math.max(t.fontMetrics().arrayRuleWidth,t.minRuleThickness),d=1/t.fontMetrics().ptPerEm,u=5*d;if(e.colSeparationType&&e.colSeparationType==="small"){var f=t.havingStyle(Je.SCRIPT).sizeMultiplier;u=.2778*(f/t.sizeMultiplier)}var g=e.colSeparationType==="CD"?Wt({number:3,unit:"ex"},t):12*d,v=3*d,m=e.arraystretch*g,p=.7*m,_=.3*m,A=0;function M(X){for(var K=0;K<X.length;++K)K>0&&(A+=.25),c.push({pos:A,isDashed:X[K]})}for(M(a[0]),n=0;n<e.body.length;++n){var T=e.body[n],S=p,I=_;o<T.length&&(o=T.length);var b={cells:new Array(T.length),height:0,depth:0,pos:0};for(r=0;r<T.length;++r){var R=vt(T[r],t);I<R.depth&&(I=R.depth),S<R.height&&(S=R.height),b.cells[r]=R}var L=e.rowGaps[n],N=0;L&&(N=Wt(L,t),N>0&&(N+=_,I<N&&(I=N),N=0)),e.addJot&&n<e.body.length-1&&(I+=v),b.height=S,b.depth=I,A+=S,b.pos=A,A+=I+N,l[n]=b,M(a[n+1])}var U=A/2+t.fontMetrics().axisHeight,W=e.cols||[],F=[],q,Z,J=[];if(e.tags&&e.tags.some(X=>X))for(n=0;n<s;++n){var re=l[n],Q=re.pos-U,ne=e.tags[n],se=void 0;ne===!0?se=ue(["eqn-num"],[],t):ne===!1?se=ue([],[],t):se=ue([],fn(ne,t,!0),t),se.depth=re.depth,se.height=re.height,J.push({type:"elem",elem:se,shift:Q})}for(r=0,Z=0;r<o||Z<W.length;++r,++Z){for(var ke,Re=W[Z],mt=!0;((st=Re)==null?void 0:st.type)==="separator";){var st;if(mt||(q=ue(["arraycolsep"],[]),q.style.width=me(t.fontMetrics().doubleRuleSep),F.push(q)),Re.separator==="|"||Re.separator===":"){var ct=Re.separator==="|"?"solid":"dashed",ee=ue(["vertical-separator"],[],t);ee.style.height=me(A),ee.style.borderRightWidth=me(h),ee.style.borderRightStyle=ct,ee.style.margin="0 "+me(-h/2);var le=A-U;le&&(ee.style.verticalAlign=me(-le)),F.push(ee)}else throw new fe("Invalid separator type: "+Re.separator);Z++,Re=W[Z],mt=!1}if(!(r>=o)){var Ee=void 0;if(r>0||e.hskipBeforeAndAfter){var Ke,Ie;Ee=(Ke=(Ie=Re)==null?void 0:Ie.pregap)!=null?Ke:u,Ee!==0&&(q=ue(["arraycolsep"],[]),q.style.width=me(Ee),F.push(q))}var nt=[];for(n=0;n<s;++n){var Bt=l[n],Qe=Bt.cells[r];if(Qe){var ft=Bt.pos-U;Qe.depth=Bt.depth,Qe.height=Bt.height,nt.push({type:"elem",elem:Qe,shift:ft})}}var Tt=bt({positionType:"individualShift",children:nt}),at=ue(["col-align-"+(((ke=Re)==null?void 0:ke.align)||"c")],[Tt]);if(F.push(at),r<o-1||e.hskipBeforeAndAfter){var Rt,Jt;Ee=(Rt=(Jt=Re)==null?void 0:Jt.postgap)!=null?Rt:u,Ee!==0&&(q=ue(["arraycolsep"],[]),q.style.width=me(Ee),F.push(q))}}}var hn=ue(["mtable"],F);if(c.length>0){for(var Lt=ys("katex-hline",t,h),$t=ys("katex-hdashline",t,h),H=[{type:"elem",elem:hn,shift:0}];c.length>0;){var un=c.pop(),xt=un.pos-U;un.isDashed?H.push({type:"elem",elem:$t,shift:xt}):H.push({type:"elem",elem:Lt,shift:xt})}hn=bt({positionType:"individualShift",children:H})}if(J.length===0)return ue(["mord"],[hn],t);var P=bt({positionType:"individualShift",children:J}),w=ue(["katex-tag"],[P],t);return $i([hn,w])},av={c:"center ",l:"left ",r:"right "},Ii=function(e,t){for(var n=[],r=new pe("mtd",[],["mtr-glue"]),s=new pe("mtd",[],["mml-eqn-num"]),a=0;a<e.body.length;a++){for(var o=e.body[a],l=[],c=0;c<o.length;c++)l.push(new pe("mtd",[Et(o[c],t)]));e.tags&&e.tags[a]&&(l.unshift(r),l.push(r),e.leqno?l.unshift(s):l.push(s)),n.push(new pe("mtr",l))}var h=new pe("mtable",n),d=e.arraystretch===.5?.1:.16+e.arraystretch-1+(e.addJot?.09:0);h.setAttribute("rowspacing",me(d));var u="",f="";if(e.cols&&e.cols.length>0){var g=e.cols,v="",m=!1,p=0,_=g.length;g[0].type==="separator"&&(u+="top ",p=1),g[g.length-1].type==="separator"&&(u+="bottom ",_-=1);for(var A=p;A<_;A++){var M=g[A];M.type==="align"?(f+=av[M.align],m&&(v+="none "),m=!0):M.type==="separator"&&m&&(v+=M.separator==="|"?"solid ":"dashed ",m=!1)}h.setAttribute("columnalign",f.trim()),/[sd]/.test(v)&&h.setAttribute("columnlines",v.trim())}if(e.colSeparationType==="align"){for(var T=e.cols||[],S="",I=1;I<T.length;I++)S+=I%2?"0em ":"1em ";h.setAttribute("columnspacing",S.trim())}else e.colSeparationType==="alignat"||e.colSeparationType==="gather"?h.setAttribute("columnspacing","0em"):e.colSeparationType==="small"?h.setAttribute("columnspacing","0.2778em"):e.colSeparationType==="CD"?h.setAttribute("columnspacing","0.5em"):h.setAttribute("columnspacing","1em");var b="",R=e.hLinesBeforeRow;u+=R[0].length>0?"left ":"",u+=R[R.length-1].length>0?"right ":"";for(var L=1;L<R.length-1;L++)b+=R[L].length===0?"none ":R[L][0]?"dashed ":"solid ";return/[sd]/.test(b)&&h.setAttribute("rowlines",b.trim()),u!==""&&(h=new pe("menclose",[h]),h.setAttribute("notation",u.trim())),e.arraystretch&&e.arraystretch<1&&(h=new pe("mstyle",[h]),h.setAttribute("scriptlevel","1")),h},xp=function(e,t){e.envName.includes("ed")||ol(e);var n=[],r=e.envName==="split",s=_r(e.parser,{cols:n,addJot:!0,autoTag:r?void 0:Oh(e.envName),emptySingleRow:!0,colSeparationType:e.envName.includes("at")?"alignat":"align",maxNumCols:r?2:void 0,leqno:e.parser.settings.leqno},"display"),a=0,o=0,l={type:"ordgroup",mode:e.mode,body:[]};if(t[0]&&t[0].type==="ordgroup"){var c="Number of columns should be a positive integer",h=Uh(t[0],c);if(!/^[0-9]+$/.test(h)||Number(h)<1)throw new fe(c,t[0]);a=Number(h),o=a*2}var d=!o;s.body.forEach(function(v){for(var m=1;m<v.length;m+=2){var p=ot(v[m],"styling"),_=ot(p.body[0],"ordgroup");_.body.unshift(l)}if(d)o<v.length&&(o=v.length);else{var A=v.length/2;if(a<A)throw new fe("Too many math in a row: "+("expected "+a+", but got "+A),v[0])}});for(var u=0;u<o;++u){var f="r",g=0;u%2===1?f="l":u>0&&d&&(g=1),n[u]={type:"align",align:f,pregap:g,postgap:0}}return s.colSeparationType=d?"align":"alignat",s};Ri({type:"array",names:["array","darray"],props:{numArgs:1},handler(i,e){var t=rl(e[0]),n=t?[e[0]]:ot(e[0],"ordgroup").body,r=n.map(function(a){var o=il(a),l=o.text;if("lcr".includes(l))return{type:"align",align:l};if(l==="|")return{type:"separator",separator:"|"};if(l===":")return{type:"separator",separator:":"};throw new fe("Unknown column alignment: "+l,a)}),s={cols:r,hskipBeforeAndAfter:!0,maxNumCols:r.length};return _r(i.parser,s,Vh(i.envName))},htmlBuilder:ki,mathmlBuilder:Ii});Ri({type:"array",names:["matrix","pmatrix","bmatrix","Bmatrix","vmatrix","Vmatrix","matrix*","pmatrix*","bmatrix*","Bmatrix*","vmatrix*","Vmatrix*"],props:{numArgs:0},handler(i){var e={matrix:null,pmatrix:["(",")"],bmatrix:["[","]"],Bmatrix:["\\{","\\}"],vmatrix:["|","|"],Vmatrix:["\\Vert","\\Vert"]}[i.envName.replace("*","")],t="c",n={hskipBeforeAndAfter:!1,cols:[{type:"align",align:t}]};if(i.envName.charAt(i.envName.length-1)==="*"){var r=i.parser;if(r.consumeSpaces(),r.fetch().text==="["){if(r.consume(),r.consumeSpaces(),t=r.fetch().text,!"lcr".includes(t))throw new fe("Expected l or c or r",r.nextToken);r.consume(),r.consumeSpaces(),r.expect("]"),r.consume(),n.cols=[{type:"align",align:t}]}}var s=_r(i.parser,n,Vh(i.envName)),a=Math.max(0,...s.body.map(o=>o.length));return s.cols=new Array(a).fill({type:"align",align:t}),e?{type:"leftright",mode:i.mode,body:[s],left:e[0],right:e[1],rightColor:void 0}:s},htmlBuilder:ki,mathmlBuilder:Ii});Ri({type:"array",names:["smallmatrix"],props:{numArgs:0},handler(i){var e={arraystretch:.5},t=_r(i.parser,e,"script");return t.colSeparationType="small",t},htmlBuilder:ki,mathmlBuilder:Ii});Ri({type:"array",names:["subarray"],props:{numArgs:1},handler(i,e){var t=rl(e[0]),n=t?[e[0]]:ot(e[0],"ordgroup").body,r=n.map(function(o){var l=il(o),c=l.text;if("lc".includes(c))return{type:"align",align:c};throw new fe("Unknown column alignment: "+c,o)});if(r.length>1)throw new fe("{subarray} can contain only one column");var s={cols:r,hskipBeforeAndAfter:!1,arraystretch:.5},a=_r(i.parser,s,"script");if(a.body.length>0&&a.body[0].length>1)throw new fe("{subarray} can contain only one column");return a},htmlBuilder:ki,mathmlBuilder:Ii});Ri({type:"array",names:["cases","dcases","rcases","drcases"],props:{numArgs:0},handler(i){var e={arraystretch:1.2,cols:[{type:"align",align:"l",pregap:0,postgap:1},{type:"align",align:"l",pregap:0,postgap:0}]},t=_r(i.parser,e,Vh(i.envName));return{type:"leftright",mode:i.mode,body:[t],left:i.envName.includes("r")?".":"\\{",right:i.envName.includes("r")?"\\}":".",rightColor:void 0}},htmlBuilder:ki,mathmlBuilder:Ii});Ri({type:"array",names:["align","align*","aligned","split"],props:{numArgs:0},handler:xp,htmlBuilder:ki,mathmlBuilder:Ii});Ri({type:"array",names:["gathered","gather","gather*"],props:{numArgs:0},handler(i){sv.has(i.envName)&&ol(i);var e={cols:[{type:"align",align:"c"}],addJot:!0,colSeparationType:"gather",autoTag:Oh(i.envName),emptySingleRow:!0,leqno:i.parser.settings.leqno};return _r(i.parser,e,"display")},htmlBuilder:ki,mathmlBuilder:Ii});Ri({type:"array",names:["alignat","alignat*","alignedat"],props:{numArgs:1},handler:xp,htmlBuilder:ki,mathmlBuilder:Ii});Ri({type:"array",names:["equation","equation*"],props:{numArgs:0},handler(i){ol(i);var e={autoTag:Oh(i.envName),emptySingleRow:!0,singleRow:!0,maxNumCols:1,leqno:i.parser.settings.leqno};return _r(i.parser,e,"display")},htmlBuilder:ki,mathmlBuilder:Ii});Ri({type:"array",names:["CD"],props:{numArgs:0},handler(i){return ol(i),Gx(i.parser)},htmlBuilder:ki,mathmlBuilder:Ii});k("\\nonumber","\\gdef\\@eqnsw{0}");k("\\notag","\\nonumber");Ae({type:"text",names:["\\hline","\\hdashline"],numArgs:0,allowedInText:!0,allowedInMath:!0,handler(i,e){throw new fe(i.funcName+" valid only within array environment")}});var Tf=mp;Ae({type:"environment",names:["\\begin","\\end"],numArgs:1,argTypes:["text"],handler(i,e){var t=i.parser,n=i.funcName,r=e[0];if(r.type!=="ordgroup")throw new fe("Invalid environment name",r);var s=Uh(r,"Environment name should contain only text characters and spaces",!0);if(n==="\\begin"){if(!Object.prototype.hasOwnProperty.call(Tf,s))throw new fe("No such environment: "+s,r);var a=Tf[s],o=t.parseArguments("\\begin{"+s+"}",a),l=o.args,c=o.optArgs,h={mode:t.mode,envName:s,parser:t},d=a.handler(h,l,c);t.expect("\\end",!1);var u=t.nextToken,f=ot(t.parseFunction(),"environment");if(f.name!==s)throw new fe("Mismatch: \\begin{"+s+"} matched by \\end{"+f.name+"}",u);return d}return{type:"environment",mode:t.mode,name:s,nameGroup:r}}});var ov=(i,e)=>{var t=i.font,n=e.withFont(t);return vt(i.body,n)},lv=(i,e)=>{var t=i.font,n=e.withFont(t);return Et(i.body,n)},Af={"\\Bbb":"\\mathbb","\\bold":"\\mathbf","\\frak":"\\mathfrak"};Ae({type:"font",names:["\\mathrm","\\mathit","\\mathbf","\\mathnormal","\\mathsfit","\\mathbb","\\mathcal","\\mathfrak","\\mathscr","\\mathsf","\\mathtt","\\Bbb","\\bold","\\frak"],numArgs:1,allowedInArgument:!0,handler:(i,e)=>{var t=i.parser,n=i.funcName,r=va(e[0]),s=n in Af?Af[n]:n;return{type:"font",mode:t.mode,font:s.slice(1),body:r}},htmlBuilder:ov,mathmlBuilder:lv});Ae({type:"mclass",names:["\\boldsymbol","\\bm"],numArgs:1,handler:(i,e)=>{var t=i.parser,n=e[0];return{type:"mclass",mode:t.mode,mclass:sl(n),body:[{type:"font",mode:t.mode,font:"boldsymbol",body:n}],isCharacterBox:qi(n)}}});Ae({type:"font",names:["\\rm","\\sf","\\tt","\\bf","\\it","\\cal"],numArgs:0,allowedInText:!0,handler:(i,e)=>{var t=i.parser,n=i.funcName,r=i.breakOnTokenText,s=t.mode,a=t.parseExpression(!0,r);return{type:"font",mode:s,font:"math"+n.slice(1),body:{type:"ordgroup",mode:t.mode,body:a}}}});var cv=(i,e)=>{var t=e.style,n=t.fracNum(),r=t.fracDen(),s;s=e.havingStyle(n);var a=vt(i.numer,s,e);if(i.continued){var o=8.5/e.fontMetrics().ptPerEm,l=3.5/e.fontMetrics().ptPerEm;a.height=a.height<o?o:a.height,a.depth=a.depth<l?l:a.depth}s=e.havingStyle(r);var c=vt(i.denom,s,e),h,d,u;i.hasBarLine?(i.barSize?(d=Wt(i.barSize,e),h=ys("frac-line",e,d)):h=ys("frac-line",e),d=h.height,u=h.height):(h=null,d=0,u=e.fontMetrics().defaultRuleThickness);var f,g,v;t.size===Je.DISPLAY.size?(f=e.fontMetrics().num1,d>0?g=3*u:g=7*u,v=e.fontMetrics().denom1):(d>0?(f=e.fontMetrics().num2,g=u):(f=e.fontMetrics().num3,g=3*u),v=e.fontMetrics().denom2);var m;if(h){var _=e.fontMetrics().axisHeight;f-a.depth-(_+.5*d)<g&&(f+=g-(f-a.depth-(_+.5*d))),_-.5*d-(c.height-v)<g&&(v+=g-(_-.5*d-(c.height-v)));var A=-(_-.5*d);m=bt({positionType:"individualShift",children:[{type:"elem",elem:c,shift:v},{type:"elem",elem:h,shift:A},{type:"elem",elem:a,shift:-f}]})}else{var p=f-a.depth-(c.height-v);p<g&&(f+=.5*(g-p),v+=.5*(g-p)),m=bt({positionType:"individualShift",children:[{type:"elem",elem:c,shift:v},{type:"elem",elem:a,shift:-f}]})}s=e.havingStyle(t),m.height*=s.sizeMultiplier/e.sizeMultiplier,m.depth*=s.sizeMultiplier/e.sizeMultiplier;var M;t.size===Je.DISPLAY.size?M=e.fontMetrics().delim1:t.size===Je.SCRIPTSCRIPT.size?M=e.havingStyle(Je.SCRIPT).fontMetrics().delim2:M=e.fontMetrics().delim2;var T,S;return i.leftDelim==null?T=ya(e,["mopen"]):T=Ah(i.leftDelim,M,!0,e.havingStyle(t),i.mode,["mopen"]),i.continued?S=ue([]):i.rightDelim==null?S=ya(e,["mclose"]):S=Ah(i.rightDelim,M,!0,e.havingStyle(t),i.mode,["mclose"]),ue(["mord"].concat(s.sizingClasses(e)),[T,ue(["mfrac"],[m]),S],e)},hv=(i,e)=>{var t=new pe("mfrac",[Et(i.numer,e),Et(i.denom,e)]);if(!i.hasBarLine)t.setAttribute("linethickness","0px");else if(i.barSize){var n=Wt(i.barSize,e);t.setAttribute("linethickness",me(n))}if(i.leftDelim!=null||i.rightDelim!=null){var r=[];if(i.leftDelim!=null){var s=new pe("mo",[new Kt(i.leftDelim.replace("\\",""))]);s.setAttribute("fence","true"),r.push(s)}if(r.push(t),i.rightDelim!=null){var a=new pe("mo",[new Kt(i.rightDelim.replace("\\",""))]);a.setAttribute("fence","true"),r.push(a)}return Nh(r)}return t},vp=(i,e)=>{if(!e)return i;var t={type:"styling",mode:i.mode,style:e,body:[i]};return t};Ae({type:"genfrac",names:["\\cfrac","\\dfrac","\\frac","\\tfrac","\\dbinom","\\binom","\\tbinom","\\\\atopfrac","\\\\bracefrac","\\\\brackfrac"],numArgs:2,allowedInArgument:!0,handler:(i,e)=>{var t=i.parser,n=i.funcName,r=e[0],s=e[1],a,o=null,l=null;switch(n){case"\\cfrac":case"\\dfrac":case"\\frac":case"\\tfrac":a=!0;break;case"\\\\atopfrac":a=!1;break;case"\\dbinom":case"\\binom":case"\\tbinom":a=!1,o="(",l=")";break;case"\\\\bracefrac":a=!1,o="\\{",l="\\}";break;case"\\\\brackfrac":a=!1,o="[",l="]";break;default:throw new Error("Unrecognized genfrac command")}var c=n==="\\cfrac",h=null;return c||n.startsWith("\\d")?h="display":n.startsWith("\\t")&&(h="text"),vp({type:"genfrac",mode:t.mode,numer:r,denom:s,continued:c,hasBarLine:a,leftDelim:o,rightDelim:l,barSize:null},h)},htmlBuilder:cv,mathmlBuilder:hv});Ae({type:"infix",names:["\\over","\\choose","\\atop","\\brace","\\brack"],numArgs:0,infix:!0,handler(i){var e=i.parser,t=i.funcName,n=i.token,r;switch(t){case"\\over":r="\\frac";break;case"\\choose":r="\\binom";break;case"\\atop":r="\\\\atopfrac";break;case"\\brace":r="\\\\bracefrac";break;case"\\brack":r="\\\\brackfrac";break;default:throw new Error("Unrecognized infix genfrac command")}return{type:"infix",mode:e.mode,replaceWith:r,token:n}}});var Ef=["display","text","script","scriptscript"],Cf=function(e){var t=null;return e.length>0&&(t=e,t=t==="."?null:t),t};Ae({type:"genfrac",names:["\\genfrac"],numArgs:6,allowedInArgument:!0,argTypes:["math","math","size","text","math","math"],handler(i,e){var t=i.parser,n=e[4],r=e[5],s=va(e[0]),a=s.type==="atom"&&s.family==="open"?Cf(s.text):null,o=va(e[1]),l=o.type==="atom"&&o.family==="close"?Cf(o.text):null,c=ot(e[2],"size"),h,d=null;c.isBlank?h=!0:(d=c.value,h=d.number>0);var u=null,f=e[3];if(f.type==="ordgroup"){if(f.body.length>0){var g=ot(f.body[0],"textord");u=Ef[Number(g.text)]}}else f=ot(f,"textord"),u=Ef[Number(f.text)];return vp({type:"genfrac",mode:t.mode,numer:n,denom:r,continued:!1,hasBarLine:h,barSize:d,leftDelim:a,rightDelim:l},u)}});Ae({type:"infix",names:["\\above"],numArgs:1,argTypes:["size"],infix:!0,handler(i,e){var t=i.parser;i.funcName;var n=i.token;return{type:"infix",mode:t.mode,replaceWith:"\\\\abovefrac",size:ot(e[0],"size").value,token:n}}});Ae({type:"genfrac",names:["\\\\abovefrac"],numArgs:3,argTypes:["math","size","math"],handler:(i,e)=>{var t=i.parser;i.funcName;var n=e[0],r=ot(e[1],"infix").size;if(!r)throw new Error("\\\\abovefrac expected size, but got "+String(r));var s=e[2],a=r.number>0;return{type:"genfrac",mode:t.mode,numer:n,denom:s,continued:!1,hasBarLine:a,barSize:r,leftDelim:null,rightDelim:null}}});var yp=(i,e)=>{var t=e.style,n,r;i.type==="supsub"?(n=i.sup?vt(i.sup,e.havingStyle(t.sup()),e):vt(i.sub,e.havingStyle(t.sub()),e),r=ot(i.base,"horizBrace")):r=ot(i,"horizBrace");var s=vt(r.base,e.havingBaseStyle(Je.DISPLAY)),a=nl(r,e),o;if(r.isOver?o=bt({positionType:"firstBaseline",children:[{type:"elem",elem:s},{type:"kern",size:.1},{type:"elem",elem:a,wrapperClasses:["svg-align"]}]}):o=bt({positionType:"bottom",positionData:s.depth+.1+a.height,children:[{type:"elem",elem:a,wrapperClasses:["svg-align"]},{type:"kern",size:.1},{type:"elem",elem:s}]}),n){var l=ue(["minner",r.isOver?"mover":"munder"],[o],e);r.isOver?o=bt({positionType:"firstBaseline",children:[{type:"elem",elem:l},{type:"kern",size:.2},{type:"elem",elem:n}]}):o=bt({positionType:"bottom",positionData:l.depth+.2+n.height+n.depth,children:[{type:"elem",elem:n},{type:"kern",size:.2},{type:"elem",elem:l}]})}return ue(["minner",r.isOver?"mover":"munder"],[o],e)},uv=(i,e)=>{var t=tl(i.label);return new pe(i.isOver?"mover":"munder",[Et(i.base,e),t])};Ae({type:"horizBrace",names:["\\overbrace","\\underbrace","\\overbracket","\\underbracket"],numArgs:1,handler(i,e){var t=i.parser,n=i.funcName;return{type:"horizBrace",mode:t.mode,label:n,isOver:n.includes("\\over"),base:e[0]}},htmlBuilder:yp,mathmlBuilder:uv});Ae({type:"href",names:["\\href"],numArgs:2,argTypes:["url","original"],allowedInText:!0,handler:(i,e)=>{var t=i.parser,n=e[1],r=ot(e[0],"url").url;return t.settings.isTrusted({command:"\\href",url:r})?{type:"href",mode:t.mode,href:r,body:tn(n)}:t.formatUnsupportedCmd("\\href")},htmlBuilder:(i,e)=>{var t=fn(i.body,e,!1);return fx(i.href,[],t,e)},mathmlBuilder:(i,e)=>{var t=br(i.body,e);return t instanceof pe||(t=new pe("mrow",[t])),t.setAttribute("href",i.href),t}});Ae({type:"href",names:["\\url"],numArgs:1,argTypes:["url"],allowedInText:!0,handler:(i,e)=>{var t=i.parser,n=ot(e[0],"url").url;if(!t.settings.isTrusted({command:"\\url",url:n}))return t.formatUnsupportedCmd("\\url");for(var r=[],s=0;s<n.length;s++){var a=n[s];a==="~"&&(a="\\textasciitilde"),r.push({type:"textord",mode:"text",text:a})}var o={type:"text",mode:t.mode,font:"\\texttt",body:r};return{type:"href",mode:t.mode,href:n,body:tn(o)}}});Ae({type:"hbox",names:["\\hbox"],numArgs:1,argTypes:["text"],allowedInText:!0,primitive:!0,handler(i,e){var t=i.parser;return{type:"hbox",mode:t.mode,body:tn(e[0])}},htmlBuilder(i,e){var t=fn(i.body,e.withFont(""),!1);return $i(t)},mathmlBuilder(i,e){return new pe("mrow",Kn(i.body,e.withFont("")))}});Ae({type:"html",names:["\\htmlClass","\\htmlId","\\htmlStyle","\\htmlData"],numArgs:2,argTypes:["raw","original"],allowedInText:!0,handler:(i,e)=>{var t=i.parser,n=i.funcName;i.token;var r=ot(e[0],"raw").string,s=e[1];t.settings.strict&&t.settings.reportNonstrict("htmlExtension","HTML extension is disabled on strict mode");var a,o={};switch(n){case"\\htmlClass":o.class=r,a={command:"\\htmlClass",class:r};break;case"\\htmlId":o.id=r,a={command:"\\htmlId",id:r};break;case"\\htmlStyle":o.style=r,a={command:"\\htmlStyle",style:r};break;case"\\htmlData":{for(var l="{,}",c=[],h="",d=0;d<r.length;d++)r.startsWith(l,d)?(h+=",",d+=l.length-1):r[d]===","?(c.push(h),h=""):h+=r[d];c.push(h);for(var u=0;u<c.length;u++){var f=c[u],g=f.indexOf("=");if(g<0)throw new fe("\\htmlData key/value '"+f+"' missing equals sign");var v=f.slice(0,g),m=f.slice(g+1);o["data-"+v.trim()]=m}a={command:"\\htmlData",attributes:o};break}default:throw new Error("Unrecognized html command")}return t.settings.isTrusted(a)?{type:"html",mode:t.mode,attributes:o,body:tn(s)}:t.formatUnsupportedCmd(n)},htmlBuilder:(i,e)=>{var t=fn(i.body,e,!1),n=["enclosing"];i.attributes.class&&n.push(...i.attributes.class.trim().split(/\s+/));var r=ue(n,t,e);for(var s of Object.entries(i.attributes)){var a=s[0],o=s[1];a!=="class"&&r.setAttribute(a,o)}return r},mathmlBuilder:(i,e)=>br(i.body,e)});Ae({type:"htmlmathml",names:["\\html@mathml"],numArgs:2,allowedInArgument:!0,allowedInText:!0,handler:(i,e)=>{var t=i.parser;return{type:"htmlmathml",mode:t.mode,html:tn(e[0]),mathml:tn(e[1])}},htmlBuilder:(i,e)=>{var t=fn(i.html,e,!1);return $i(t)},mathmlBuilder:(i,e)=>br(i.mathml,e)});var lh=function(e){if(/^[-+]? *(\d+(\.\d*)?|\.\d+)$/.test(e))return{number:+e,unit:"bp"};var t=/([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(e);if(!t)throw new fe("Invalid size: '"+e+"' in \\includegraphics");var n={number:+(t[1]+t[2]),unit:t[3]};if(!Gf(n))throw new fe("Invalid unit: '"+n.unit+"' in \\includegraphics.");return n};Ae({type:"includegraphics",names:["\\includegraphics"],numArgs:1,numOptionalArgs:1,argTypes:["raw","url"],allowedInText:!1,handler:(i,e,t)=>{var n=i.parser,r={number:0,unit:"em"},s={number:.9,unit:"em"},a={number:0,unit:"em"},o="";if(t[0])for(var l=ot(t[0],"raw").string,c=l.split(","),h=0;h<c.length;h++){var d=c[h].split("=");if(d.length===2){var u=d[1].trim();switch(d[0].trim()){case"alt":o=u;break;case"width":r=lh(u);break;case"height":s=lh(u);break;case"totalheight":a=lh(u);break;default:throw new fe("Invalid key: '"+d[0]+"' in \\includegraphics.")}}}var f=ot(e[0],"url").url;return o===""&&(o=f,o=o.replace(/^.*[\\/]/,""),o=o.substring(0,o.lastIndexOf("."))),n.settings.isTrusted({command:"\\includegraphics",url:f})?{type:"includegraphics",mode:n.mode,alt:o,width:r,height:s,totalheight:a,src:f}:n.formatUnsupportedCmd("\\includegraphics")},htmlBuilder:(i,e)=>{var t=Wt(i.height,e),n=0;i.totalheight.number>0&&(n=Wt(i.totalheight,e)-t);var r=0;i.width.number>0&&(r=Wt(i.width,e));var s={height:me(t+n)};r>0&&(s.width=me(r)),n>0&&(s.verticalAlign=me(-n));var a=new fh(i.src,i.alt,s);return a.height=t,a.depth=n,a},mathmlBuilder:(i,e)=>{var t=new pe("mglyph",[]);t.setAttribute("alt",i.alt);var n=Wt(i.height,e),r=0;if(i.totalheight.number>0&&(r=Wt(i.totalheight,e)-n,t.setAttribute("valign",me(-r))),t.setAttribute("height",me(n+r)),i.width.number>0){var s=Wt(i.width,e);t.setAttribute("width",me(s))}return t.setAttribute("src",i.src),t}});Ae({type:"kern",names:["\\kern","\\mkern","\\hskip","\\mskip"],numArgs:1,argTypes:["size"],primitive:!0,allowedInText:!0,handler(i,e){var t=i.parser,n=i.funcName,r=ot(e[0],"size");if(t.settings.strict){var s=n[1]==="m",a=r.value.unit==="mu";s?(a||t.settings.reportNonstrict("mathVsTextUnits","LaTeX's "+n+" supports only mu units, "+("not "+r.value.unit+" units")),t.mode!=="math"&&t.settings.reportNonstrict("mathVsTextUnits","LaTeX's "+n+" works only in math mode")):a&&t.settings.reportNonstrict("mathVsTextUnits","LaTeX's "+n+" doesn't support mu units")}return{type:"kern",mode:t.mode,dimension:r.value}},htmlBuilder(i,e){return Kf(i.dimension,e)},mathmlBuilder(i,e){var t=Wt(i.dimension,e);return new Ko(t)}});Ae({type:"lap",names:["\\mathllap","\\mathrlap","\\mathclap"],numArgs:1,allowedInText:!0,handler:(i,e)=>{var t=i.parser,n=i.funcName,r=e[0];return{type:"lap",mode:t.mode,alignment:n.slice(5),body:r}},htmlBuilder:(i,e)=>{var t;i.alignment==="clap"?(t=ue([],[vt(i.body,e)]),t=ue(["katex-inner"],[t],e)):t=ue(["katex-inner"],[vt(i.body,e)]);var n=ue(["katex-fix"],[]),r=ue([i.alignment],[t,n],e),s=ue(["katex-strut"]);return s.style.height=me(r.height+r.depth),r.depth&&(s.style.verticalAlign=me(-r.depth)),r.children.unshift(s),r=ue(["katex-thinbox"],[r],e),ue(["mord","katex-vbox"],[r],e)},mathmlBuilder:(i,e)=>{var t=new pe("mpadded",[Et(i.body,e)]);if(i.alignment!=="rlap"){var n=i.alignment==="llap"?"-1":"-0.5";t.setAttribute("lspace",n+"width")}return t.setAttribute("width","0px"),t}});Ae({type:"styling",names:["\\(","$"],numArgs:0,allowedInText:!0,allowedInMath:!1,handler(i,e){var t=i.funcName,n=i.parser,r=n.mode;n.switchMode("math");var s=t==="\\("?"\\)":"$",a=n.parseExpression(!1,s);return n.expect(s),n.switchMode(r),{type:"styling",mode:n.mode,style:"text",resetFont:!0,body:a}}});Ae({type:"text",names:["\\)","\\]"],numArgs:0,allowedInText:!0,allowedInMath:!1,handler(i,e){throw new fe("Mismatched "+i.funcName)}});var Rf=(i,e)=>{switch(e.style.size){case Je.DISPLAY.size:return i.display;case Je.TEXT.size:return i.text;case Je.SCRIPT.size:return i.script;case Je.SCRIPTSCRIPT.size:return i.scriptscript;default:return i.text}};Ae({type:"mathchoice",names:["\\mathchoice"],numArgs:4,primitive:!0,handler:(i,e)=>{var t=i.parser;return{type:"mathchoice",mode:t.mode,display:tn(e[0]),text:tn(e[1]),script:tn(e[2]),scriptscript:tn(e[3])}},htmlBuilder:(i,e)=>{var t=Rf(i,e),n=fn(t,e,!1);return $i(n)},mathmlBuilder:(i,e)=>{var t=Rf(i,e);return br(t,e)}});var bp=(i,e,t,n,r,s,a)=>{i=ue([],[i]);var o=t&&qi(t),l,c;if(e){var h=vt(e,n.havingStyle(r.sup()),n);c={elem:h,kern:Math.max(n.fontMetrics().bigOpSpacing1,n.fontMetrics().bigOpSpacing3-h.depth)}}if(t){var d=vt(t,n.havingStyle(r.sub()),n);l={elem:d,kern:Math.max(n.fontMetrics().bigOpSpacing2,n.fontMetrics().bigOpSpacing4-d.height)}}var u;if(c&&l){var f=n.fontMetrics().bigOpSpacing5+l.elem.height+l.elem.depth+l.kern+i.depth+a;u=bt({positionType:"bottom",positionData:f,children:[{type:"kern",size:n.fontMetrics().bigOpSpacing5},{type:"elem",elem:l.elem,marginLeft:me(-s)},{type:"kern",size:l.kern},{type:"elem",elem:i},{type:"kern",size:c.kern},{type:"elem",elem:c.elem,marginLeft:me(s)},{type:"kern",size:n.fontMetrics().bigOpSpacing5}]})}else if(l){var g=i.height-a;u=bt({positionType:"top",positionData:g,children:[{type:"kern",size:n.fontMetrics().bigOpSpacing5},{type:"elem",elem:l.elem,marginLeft:me(-s)},{type:"kern",size:l.kern},{type:"elem",elem:i}]})}else if(c){var v=i.depth+a;u=bt({positionType:"bottom",positionData:v,children:[{type:"elem",elem:i},{type:"kern",size:c.kern},{type:"elem",elem:c.elem,marginLeft:me(s)},{type:"kern",size:n.fontMetrics().bigOpSpacing5}]})}else return i;var m=[u];if(l&&s!==0&&!o){var p=ue(["mspace"],[],n);p.style.marginRight=me(s),m.unshift(p)}return ue(["mop","op-limits"],m,n)},_p=new Set(["\\smallint"]),Mp=(i,e)=>{var t,n,r=!1,s;i.type==="supsub"?(t=i.sup,n=i.sub,s=ot(i.base,"op"),r=!0):s=ot(i,"op");var a=e.style,o=!1;a.size===Je.DISPLAY.size&&s.symbol&&!_p.has(s.name)&&(o=!0);var l,c;if(s.symbol){var h=o?"Size2-Regular":"Size1-Regular",d="";if((s.name==="\\oiint"||s.name==="\\oiiint")&&(d=s.name.slice(1),s.name=d==="oiint"?"\\iint":"\\iiint"),l=zn(s.name,h,"math",e,["mop","op-symbol",o?"large-op":"small-op"]),c=l.italic,d.length>0){var u=Jf(d+"Size"+(o?"2":"1"),e);l=bt({positionType:"individualShift",children:[{type:"elem",elem:l,shift:0},{type:"elem",elem:u,shift:o?.08:0}]}),s.name="\\"+d,l.classes.unshift("mop"),l.italic=c}}else if(s.body){var f=fn(s.body,e,!0);f.length===1&&f[0]instanceof Dn?(l=f[0],l.classes[0]="mop"):l=ue(["mop"],f,e)}else{for(var g=[],v=1;v<s.name.length;v++)g.push(Lh(s.name[v],s.mode,e));l=ue(["mop"],g,e)}var m=0,p=0;if((l instanceof Dn||s.name==="\\oiint"||s.name==="\\oiiint")&&!s.suppressBaseShift){var _;m=(l.height-l.depth)/2-e.fontMetrics().axisHeight,p=(_=l.italic)!=null?_:0}return r?bp(l,t,n,e,a,p,m):(m&&(l.style.position="relative",l.style.top=me(m)),l)},dv=(i,e)=>{var t;if(i.symbol)t=new pe("mo",[ri(i.name,i.mode)]),_p.has(i.name)&&t.setAttribute("largeop","false");else if(i.body)t=new pe("mo",Kn(i.body,e));else{t=new pe("mi",[new Kt(i.name.slice(1))]);var n=new pe("mo",[ri("⁡","text")]);i.parentIsSupSub?t=new pe("mrow",[t,n]):t=ep([t,n])}return t},fv={"∏":"\\prod","∐":"\\coprod","∑":"\\sum","⋀":"\\bigwedge","⋁":"\\bigvee","⋂":"\\bigcap","⋃":"\\bigcup","⨀":"\\bigodot","⨁":"\\bigoplus","⨂":"\\bigotimes","⨄":"\\biguplus","⨆":"\\bigsqcup"};Ae({type:"op",names:["\\coprod","\\bigvee","\\bigwedge","\\biguplus","\\bigcap","\\bigcup","\\intop","\\prod","\\sum","\\bigotimes","\\bigoplus","\\bigodot","\\bigsqcup","\\smallint","∏","∐","∑","⋀","⋁","⋂","⋃","⨀","⨁","⨂","⨄","⨆"],numArgs:0,handler:(i,e)=>{var t=i.parser,n=i.funcName,r=n;return r.length===1&&(r=fv[r]),{type:"op",mode:t.mode,limits:!0,parentIsSupSub:!1,symbol:!0,name:r}},htmlBuilder:Mp,mathmlBuilder:dv});Ae({type:"op",names:["\\mathop"],numArgs:1,primitive:!0,handler:(i,e)=>{var t=i.parser,n=e[0];return{type:"op",mode:t.mode,limits:!1,parentIsSupSub:!1,symbol:!1,body:tn(n)}}});var pv={"∫":"\\int","∬":"\\iint","∭":"\\iiint","∮":"\\oint","∯":"\\oiint","∰":"\\oiiint"};Ae({type:"op",names:["\\arcsin","\\arccos","\\arctan","\\arctg","\\arcctg","\\arg","\\ch","\\cos","\\cosec","\\cosh","\\cot","\\cotg","\\coth","\\csc","\\ctg","\\cth","\\deg","\\dim","\\exp","\\hom","\\ker","\\lg","\\ln","\\log","\\sec","\\sin","\\sinh","\\sh","\\tan","\\tanh","\\tg","\\th"],numArgs:0,handler(i){var e=i.parser,t=i.funcName;return{type:"op",mode:e.mode,limits:!1,parentIsSupSub:!1,symbol:!1,name:t}}});Ae({type:"op",names:["\\det","\\gcd","\\inf","\\lim","\\max","\\min","\\Pr","\\sup"],numArgs:0,handler(i){var e=i.parser,t=i.funcName;return{type:"op",mode:e.mode,limits:!0,parentIsSupSub:!1,symbol:!1,name:t}}});Ae({type:"op",names:["\\int","\\iint","\\iiint","\\oint","\\oiint","\\oiiint","∫","∬","∭","∮","∯","∰"],numArgs:0,allowedInArgument:!0,handler(i){var e=i.parser,t=i.funcName,n=t;return n.length===1&&(n=pv[n]),{type:"op",mode:e.mode,limits:!1,parentIsSupSub:!1,symbol:!0,name:n}}});var Sp=(i,e)=>{var t,n,r=!1,s;i.type==="supsub"?(t=i.sup,n=i.sub,s=ot(i.base,"operatorname"),r=!0):s=ot(i,"operatorname");var a;if(s.body.length>0){for(var o=s.body.map(d=>{var u="text"in d?d.text:void 0;return typeof u=="string"?{type:"textord",mode:d.mode,text:u}:d}),l=fn(o,e.withFont("mathrm"),!0),c=0;c<l.length;c++){var h=l[c];h instanceof Dn&&(h.text=h.text.replace(/\u2212/,"-").replace(/\u2217/,"*"))}a=ue(["mop"],l,e)}else a=ue(["mop"],[],e);return r?bp(a,t,n,e,e.style,0,0):a},mv=(i,e)=>{for(var t=Kn(i.body,e.withFont("mathrm")),n=!0,r=0;r<t.length;r++){var s=t[r];if(!(s instanceof Ko))if(s instanceof pe)switch(s.type){case"mi":case"mn":case"mspace":case"mtext":break;case"mo":{var a=s.children[0];s.children.length===1&&a instanceof Kt?a.text=a.text.replace(/\u2212/,"-").replace(/\u2217/,"*"):n=!1;break}default:n=!1}else n=!1}if(n){var o=t.map(h=>h.toText()).join("");t=[new Kt(o)]}var l=new pe("mi",t);l.setAttribute("mathvariant","normal");var c=new pe("mo",[ri("⁡","text")]);return i.parentIsSupSub?new pe("mrow",[l,c]):ep([l,c])};Ae({type:"operatorname",names:["\\operatorname@","\\operatornamewithlimits"],numArgs:1,handler:(i,e)=>{var t=i.parser,n=i.funcName,r=e[0];return{type:"operatorname",mode:t.mode,body:tn(r),alwaysHandleSupSub:n==="\\operatornamewithlimits",limits:!1,parentIsSupSub:!1}},htmlBuilder:Sp,mathmlBuilder:mv});k("\\operatorname","\\@ifstar\\operatornamewithlimits\\operatorname@");Yr({type:"ordgroup",htmlBuilder(i,e){return i.semisimple?$i(fn(i.body,e,!1)):ue(["mord"],fn(i.body,e,!0),e)},mathmlBuilder(i,e){return br(i.body,e,!0)}});Ae({type:"overline",names:["\\overline"],numArgs:1,handler(i,e){var t=i.parser,n=e[0];return{type:"overline",mode:t.mode,body:n}},htmlBuilder(i,e){var t=vt(i.body,e.havingCrampedStyle()),n=ys("overline-line",e),r=e.fontMetrics().defaultRuleThickness,s=bt({positionType:"firstBaseline",children:[{type:"elem",elem:t},{type:"kern",size:3*r},{type:"elem",elem:n},{type:"kern",size:r}]});return ue(["mord","katex-overline"],[s],e)},mathmlBuilder(i,e){var t=new pe("mo",[new Kt("‾")]);t.setAttribute("stretchy","true");var n=new pe("mover",[Et(i.body,e),t]);return n.setAttribute("accent","true"),n}});Ae({type:"phantom",names:["\\phantom"],numArgs:1,allowedInText:!0,handler:(i,e)=>{var t=i.parser,n=e[0];return{type:"phantom",mode:t.mode,body:tn(n)}},htmlBuilder:(i,e)=>{var t=fn(i.body,e.withPhantom(),!1);return $i(t)},mathmlBuilder:(i,e)=>{var t=Kn(i.body,e);return new pe("mphantom",t)}});k("\\hphantom","\\smash{\\phantom{#1}}");Ae({type:"vphantom",names:["\\vphantom"],numArgs:1,allowedInText:!0,handler:(i,e)=>{var t=i.parser,n=e[0];return{type:"vphantom",mode:t.mode,body:n}},htmlBuilder:(i,e)=>{var t=ue(["katex-inner"],[vt(i.body,e.withPhantom())]),n=ue(["katex-fix"],[]);return ue(["mord","rlap"],[t,n],e)},mathmlBuilder:(i,e)=>{var t=Kn(tn(i.body),e),n=new pe("mphantom",t),r=new pe("mpadded",[n]);return r.setAttribute("width","0px"),r}});Ae({type:"raisebox",names:["\\raisebox"],numArgs:2,argTypes:["size","hbox"],allowedInText:!0,handler(i,e){var t=i.parser,n=ot(e[0],"size").value,r=e[1];return{type:"raisebox",mode:t.mode,dy:n,body:r}},htmlBuilder(i,e){var t=vt(i.body,e),n=Wt(i.dy,e);return bt({positionType:"shift",positionData:-n,children:[{type:"elem",elem:t}]})},mathmlBuilder(i,e){var t=new pe("mpadded",[Et(i.body,e)]),n=i.dy.number+i.dy.unit;return t.setAttribute("voffset",n),t}});var wp=(i,e)=>{var t=i.parser;return{type:"reflectbox",mode:t.mode,body:e[0]}};Ae({type:"reflectbox",names:["\\reflectbox"],numArgs:1,argTypes:["hbox"],allowedInText:!0,handler:wp,htmlBuilder(i,e){return ue(["mord","reflectbox"],[vt(i.body,e)],e)},mathmlBuilder(i,e){return Et(i.body,e)}});Ae({type:"reflectbox",names:["\\mathreflectbox"],numArgs:1,argTypes:["math"],handler:wp});Ae({type:"internal",names:["\\relax"],numArgs:0,allowedInText:!0,allowedInArgument:!0,handler(i){var e=i.parser;return{type:"internal",mode:e.mode}}});Ae({type:"rule",names:["\\rule"],numArgs:2,numOptionalArgs:1,allowedInText:!0,allowedInMath:!0,argTypes:["size","size","size"],handler(i,e,t){var n=i.parser,r=t[0],s=ot(e[0],"size"),a=ot(e[1],"size");return{type:"rule",mode:n.mode,shift:r&&ot(r,"size").value,width:s.value,height:a.value}},htmlBuilder(i,e){var t=ue(["mord","katex-rule"],[],e),n=Wt(i.width,e),r=Wt(i.height,e),s=i.shift?Wt(i.shift,e):0;return t.style.borderRightWidth=me(n),t.style.borderTopWidth=me(r),t.style.bottom=me(s),t.width=n,t.height=r+s,t.depth=-s,t.maxFontSize=r*1.125*e.sizeMultiplier,t},mathmlBuilder(i,e){var t=Wt(i.width,e),n=Wt(i.height,e),r=i.shift?Wt(i.shift,e):0,s=e.color&&e.getColor()||"black",a=new pe("mspace");a.setAttribute("mathbackground",s),a.setAttribute("width",me(t)),a.setAttribute("height",me(n));var o=new pe("mpadded",[a]);return r>=0?o.setAttribute("height",me(r)):(o.setAttribute("height",me(r)),o.setAttribute("depth",me(-r))),o.setAttribute("voffset",me(r)),o}});function Tp(i,e,t){for(var n=fn(i,e,!1),r=e.sizeMultiplier/t.sizeMultiplier,s=0;s<n.length;s++){var a=n[s].classes.indexOf("katex-sizing");a<0?Array.prototype.push.apply(n[s].classes,e.sizingClasses(t)):n[s].classes[a+1]==="reset-size"+e.size&&(n[s].classes[a+1]="reset-size"+t.size),n[s].height*=r,n[s].depth*=r}return $i(n)}var kf=["\\tiny","\\sixptsize","\\scriptsize","\\footnotesize","\\small","\\normalsize","\\large","\\Large","\\LARGE","\\huge","\\Huge"],gv=(i,e)=>{var t=e.havingSize(i.size);return Tp(i.body,t,e)};Ae({type:"sizing",names:kf,numArgs:0,allowedInText:!0,handler:(i,e)=>{var t=i.breakOnTokenText,n=i.funcName,r=i.parser,s=r.parseExpression(!1,t);return{type:"sizing",mode:r.mode,size:kf.indexOf(n)+1,body:s}},htmlBuilder:gv,mathmlBuilder:(i,e)=>{var t=e.havingSize(i.size),n=Kn(i.body,t),r=new pe("mstyle",n);return r.setAttribute("mathsize",me(t.sizeMultiplier)),r}});Ae({type:"smash",names:["\\smash"],numArgs:1,numOptionalArgs:1,allowedInText:!0,handler:(i,e,t)=>{var n=i.parser,r=!1,s=!1,a=t[0]&&ot(t[0],"ordgroup");if(a)for(var o,l=0;l<a.body.length;++l){var c=a.body[l];if(o=il(c).text,o==="t")r=!0;else if(o==="b")s=!0;else{r=!1,s=!1;break}}else r=!0,s=!0;var h=e[0];return{type:"smash",mode:n.mode,body:h,smashHeight:r,smashDepth:s}},htmlBuilder:(i,e)=>{var t=ue([],[vt(i.body,e)]);if(!i.smashHeight&&!i.smashDepth)return t;if(i.smashHeight&&(t.height=0),i.smashDepth&&(t.depth=0),i.smashHeight&&i.smashDepth)return ue(["mord","katex-smash"],[t],e);if(t.children)for(var n=0;n<t.children.length;n++)i.smashHeight&&(t.children[n].height=0),i.smashDepth&&(t.children[n].depth=0);var r=bt({positionType:"firstBaseline",children:[{type:"elem",elem:t}]});return ue(["mord"],[r],e)},mathmlBuilder:(i,e)=>{var t=new pe("mpadded",[Et(i.body,e)]);return i.smashHeight&&t.setAttribute("height","0px"),i.smashDepth&&t.setAttribute("depth","0px"),t}});Ae({type:"sqrt",names:["\\sqrt"],numArgs:1,numOptionalArgs:1,handler(i,e,t){var n=i.parser,r=t[0],s=e[0];return{type:"sqrt",mode:n.mode,body:s,index:r}},htmlBuilder(i,e){var t=vt(i.body,e.havingCrampedStyle());t.height===0&&(t.height=e.fontMetrics().xHeight),t=bs(t,e);var n=e.fontMetrics(),r=n.defaultRuleThickness,s=r;e.style.id<Je.TEXT.id&&(s=e.fontMetrics().xHeight);var a=r+s/4,o=t.height+t.depth+a+r,l=Jx(o,e),c=l.span,h=l.ruleWidth,d=l.advanceWidth,u=c.height-h;u>t.height+t.depth+a&&(a=(a+u-t.height-t.depth)/2);var f=c.height-t.height-a-h;t.style.paddingLeft=me(d);var g=bt({positionType:"firstBaseline",children:[{type:"elem",elem:t,wrapperClasses:["svg-align"]},{type:"kern",size:-(t.height+f)},{type:"elem",elem:c},{type:"kern",size:h}]});if(i.index){var v=e.havingStyle(Je.SCRIPTSCRIPT),m=vt(i.index,v,e),p=.6*(g.height-g.depth),_=bt({positionType:"shift",positionData:-p,children:[{type:"elem",elem:m}]}),A=ue(["katex-root"],[_]);return ue(["mord","sqrt"],[A,g],e)}else return ue(["mord","sqrt"],[g],e)},mathmlBuilder(i,e){var t=i.body,n=i.index;return n?new pe("mroot",[Et(t,e),Et(n,e)]):new pe("msqrt",[Et(t,e)])}});var Eh={display:Je.DISPLAY,text:Je.TEXT,script:Je.SCRIPT,scriptscript:Je.SCRIPTSCRIPT};function xv(i){return i in Eh}Ae({type:"styling",names:["\\displaystyle","\\textstyle","\\scriptstyle","\\scriptscriptstyle"],numArgs:0,allowedInText:!0,primitive:!0,handler(i,e){var t=i.breakOnTokenText,n=i.funcName,r=i.parser,s=r.parseExpression(!0,t),a=n.slice(1,n.length-5);if(!xv(a))throw new Error("Unknown style: "+a);return{type:"styling",mode:r.mode,style:a,body:s}},htmlBuilder(i,e){var t=Eh[i.style],n=e.havingStyle(t);return i.resetFont&&(n=n.withFont("")),Tp(i.body,n,e)},mathmlBuilder(i,e){var t=Eh[i.style],n=e.havingStyle(t);i.resetFont&&(n=n.withFont(""));var r=Kn(i.body,n),s=new pe("mstyle",r),a={display:["0","true"],text:["0","false"],script:["1","false"],scriptscript:["2","false"]},o=a[i.style];return s.setAttribute("scriptlevel",o[0]),s.setAttribute("displaystyle",o[1]),s}});var vv=function(e,t){var n=e.base;if(n)if(n.type==="op"){var r=n.limits&&(t.style.size===Je.DISPLAY.size||n.alwaysHandleSupSub);return r?Mp:null}else if(n.type==="operatorname"){var s=n.alwaysHandleSupSub&&(t.style.size===Je.DISPLAY.size||n.limits);return s?Sp:null}else{if(n.type==="accent")return qi(n.base)?rp:null;if(n.type==="horizBrace"){var a=!e.sub;return a===n.isOver?yp:null}else return null}else return null};Yr({type:"supsub",htmlBuilder(i,e){var t=vv(i,e);if(t)return t(i,e);var n=i.base,r=i.sup,s=i.sub,a=vt(n,e),o,l,c=e.fontMetrics(),h=0,d=0,u=n&&qi(n);if(r){var f=e.havingStyle(e.style.sup());o=vt(r,f,e),u||(h=a.height-f.fontMetrics().supDrop*f.sizeMultiplier/e.sizeMultiplier)}if(s){var g=e.havingStyle(e.style.sub());l=vt(s,g,e),u||(d=a.depth+g.fontMetrics().subDrop*g.sizeMultiplier/e.sizeMultiplier)}var v;e.style===Je.DISPLAY?v=c.sup1:e.style.cramped?v=c.sup3:v=c.sup2;var m=e.sizeMultiplier,p=me(.5/c.ptPerEm/m),_=null;if(l){var A=i.base&&i.base.type==="op"&&i.base.name&&(i.base.name==="\\oiint"||i.base.name==="\\oiiint");if(a instanceof Dn||A){var M;_=me(-((M=a.italic)!=null?M:0))}}var T;if(o&&l){h=Math.max(h,v,o.depth+.25*c.xHeight),d=Math.max(d,c.sub2);var S=c.defaultRuleThickness,I=4*S;if(h-o.depth-(l.height-d)<I){d=I-(h-o.depth)+l.height;var b=.8*c.xHeight-(h-o.depth);b>0&&(h+=b,d-=b)}var R=[{type:"elem",elem:l,shift:d,marginRight:p,marginLeft:_},{type:"elem",elem:o,shift:-h,marginRight:p}];T=bt({positionType:"individualShift",children:R})}else if(l){d=Math.max(d,c.sub1,l.height-.8*c.xHeight);var L=[{type:"elem",elem:l,marginLeft:_,marginRight:p}];T=bt({positionType:"shift",positionData:d,children:L})}else if(o)h=Math.max(h,v,o.depth+.25*c.xHeight),T=bt({positionType:"shift",positionData:-h,children:[{type:"elem",elem:o,marginRight:p}]});else throw new Error("supsub must have either sup or sub.");var N=Mh(a,"right")||"mord";return ue([N],[a,ue(["msupsub"],[T])],e)},mathmlBuilder(i,e){var t=!1,n,r;i.base&&i.base.type==="horizBrace"&&(r=!!i.sup,r===i.base.isOver&&(t=!0,n=i.base.isOver)),i.base&&(i.base.type==="op"||i.base.type==="operatorname")&&(i.base.parentIsSupSub=!0);var s=[Et(i.base,e)];i.sub&&s.push(Et(i.sub,e)),i.sup&&s.push(Et(i.sup,e));var a;if(t)a=n?"mover":"munder";else if(i.sub)if(i.sup){var c=i.base;c&&c.type==="op"&&c.limits&&e.style===Je.DISPLAY||c&&c.type==="operatorname"&&c.alwaysHandleSupSub&&(e.style===Je.DISPLAY||c.limits)?a="munderover":a="msubsup"}else{var l=i.base;l&&l.type==="op"&&l.limits&&(e.style===Je.DISPLAY||l.alwaysHandleSupSub)||l&&l.type==="operatorname"&&l.alwaysHandleSupSub&&(l.limits||e.style===Je.DISPLAY)?a="munder":a="msub"}else{var o=i.base;o&&o.type==="op"&&o.limits&&(e.style===Je.DISPLAY||o.alwaysHandleSupSub)||o&&o.type==="operatorname"&&o.alwaysHandleSupSub&&(o.limits||e.style===Je.DISPLAY)?a="mover":a="msup"}return new pe(a,s)}});Yr({type:"atom",htmlBuilder(i,e){return Lh(i.text,i.mode,e,["m"+i.family])},mathmlBuilder(i,e){var t=new pe("mo",[ri(i.text,i.mode)]);if(i.family==="bin"){var n=Fh(i,e);n==="bold-italic"&&t.setAttribute("mathvariant",n)}else i.family==="punct"?t.setAttribute("separator","true"):(i.family==="open"||i.family==="close")&&t.setAttribute("stretchy","false");return t}});var Ap={mi:"italic",mn:"normal",mtext:"normal"};Yr({type:"mathord",htmlBuilder(i,e){return el(i,e)},mathmlBuilder(i,e){var t=new pe("mi",[ri(i.text,i.mode,e)]),n=Fh(i,e)||"italic";return n!==Ap[t.type]&&t.setAttribute("mathvariant",n),t}});Yr({type:"textord",htmlBuilder(i,e){return el(i,e)},mathmlBuilder(i,e){var t=ri(i.text,i.mode,e),n=Fh(i,e)||"normal",r;return i.mode==="text"?r=new pe("mtext",[t]):/[0-9]/.test(i.text)?r=new pe("mn",[t]):i.text==="\\prime"?r=new pe("mo",[t]):r=new pe("mi",[t]),n!==Ap[r.type]&&r.setAttribute("mathvariant",n),r}});var If=new Map([["\\nobreak","nobreak"],["\\allowbreak","allowbreak"]]),Pf=new Map([[" ",{}],["\\ ",{}],["~",{className:"nobreak"}],["\\space",{}],["\\nobreakspace",{className:"nobreak"}]]);Yr({type:"spacing",htmlBuilder(i,e){var t=Pf.get(i.text),n=If.get(i.text);if(t){var r=t.className||"";if(i.mode==="text"){var s=el(i,e);return s.classes.push(r),s}else return ue(["mspace",r],[Lh(i.text,i.mode,e)],e)}else{if(n)return ue(["mspace",n],[],e);throw new fe('Unknown type of space "'+i.text+'"')}},mathmlBuilder(i,e){var t;if(Pf.has(i.text))t=new pe("mtext",[new Kt(" ")]);else{if(If.has(i.text))return new pe("mspace");throw new fe('Unknown type of space "'+i.text+'"')}return t}});var zf=()=>{var i=new pe("mtd",[]);return i.setAttribute("width","50%"),i};Yr({type:"tag",mathmlBuilder(i,e){var t=new pe("mtable",[new pe("mtr",[zf(),new pe("mtd",[br(i.body,e)]),zf(),new pe("mtd",[br(i.tag,e)])])]);return t.setAttribute("width","100%"),t}});var Lf={"\\text":void 0,"\\textrm":"textrm","\\textsf":"textsf","\\texttt":"texttt","\\textnormal":"textrm"},Df={"\\textbf":"textbf","\\textmd":"textmd"},yv={"\\textit":"textit","\\textup":"textup"},Nf=(i,e)=>{var t=i.font;if(t){if(Lf[t])return e.withTextFontFamily(Lf[t]);if(Df[t])return e.withTextFontWeight(Df[t]);if(t==="\\emph")return e.fontShape==="textit"?e.withTextFontShape("textup"):e.withTextFontShape("textit")}else return e;return e.withTextFontShape(yv[t])};Ae({type:"text",names:["\\text","\\textrm","\\textsf","\\texttt","\\textnormal","\\textbf","\\textmd","\\textit","\\textup","\\emph"],numArgs:1,argTypes:["text"],allowedInArgument:!0,allowedInText:!0,handler(i,e){var t=i.parser,n=i.funcName,r=e[0];return{type:"text",mode:t.mode,body:tn(r),font:n}},htmlBuilder(i,e){var t=Nf(i,e),n=fn(i.body,t,!0);return ue(["mord","text"],n,t)},mathmlBuilder(i,e){var t=Nf(i,e);return br(i.body,t)}});Ae({type:"underline",names:["\\underline"],numArgs:1,allowedInText:!0,handler(i,e){var t=i.parser;return{type:"underline",mode:t.mode,body:e[0]}},htmlBuilder(i,e){var t=vt(i.body,e),n=ys("underline-line",e),r=e.fontMetrics().defaultRuleThickness,s=bt({positionType:"top",positionData:t.height,children:[{type:"kern",size:r},{type:"elem",elem:n},{type:"kern",size:3*r},{type:"elem",elem:t}]});return ue(["mord","katex-underline"],[s],e)},mathmlBuilder(i,e){var t=new pe("mo",[new Kt("‾")]);t.setAttribute("stretchy","true");var n=new pe("munder",[Et(i.body,e),t]);return n.setAttribute("accentunder","true"),n}});Ae({type:"vcenter",names:["\\vcenter"],numArgs:1,argTypes:["original"],allowedInText:!1,handler(i,e){var t=i.parser;return{type:"vcenter",mode:t.mode,body:e[0]}},htmlBuilder(i,e){var t=vt(i.body,e),n=e.fontMetrics().axisHeight,r=.5*(t.height-n-(t.depth+n));return bt({positionType:"shift",positionData:r,children:[{type:"elem",elem:t}]})},mathmlBuilder(i,e){var t=new pe("mpadded",[Et(i.body,e)],["vcenter"]);return new pe("mrow",[t])}});Ae({type:"verb",names:["\\verb"],numArgs:0,allowedInText:!0,handler(i,e,t){throw new fe("\\verb ended by end of line instead of matching delimiter")},htmlBuilder(i,e){for(var t=Ff(i),n=[],r=e.havingStyle(e.style.text()),s=0;s<t.length;s++){var a=t[s];a==="~"&&(a="\\textasciitilde"),n.push(zn(a,"Typewriter-Regular",i.mode,r,["mord","texttt"]))}return ue(["mord","text"].concat(r.sizingClasses(e)),Yf(n),r)},mathmlBuilder(i,e){var t=new Kt(Ff(i)),n=new pe("mtext",[t]);return n.setAttribute("mathvariant","monospace"),n}});var Ff=i=>i.body.replace(/ /g,i.star?"␣":" "),mr=jf,Ep=`[ \r
	]`,bv="\\\\[a-zA-Z@]+",_v="\\\\[^\uD800-\uDFFF]",Mv="("+bv+")"+Ep+"*",Sv=`\\\\(
|[ \r	]+
?)[ \r	]*`,Ch="[̀-ͯ]",wv=new RegExp(Ch+"+$"),Tv="("+Ep+"+)|"+(Sv+"|")+"([!-\\[\\]-‧‪-퟿豈-￿]"+(Ch+"*")+"|[\uD800-\uDBFF][\uDC00-\uDFFF]"+(Ch+"*")+"|\\\\verb\\*([^]).*?\\4|\\\\verb([^*a-zA-Z]).*?\\5"+("|"+Mv)+("|"+_v+")"),Jo=class{constructor(e,t){this.input=void 0,this.settings=void 0,this.tokenRegex=void 0,this.catcodes=void 0,this.input=e,this.settings=t,this.tokenRegex=new RegExp(Tv,"g"),this.catcodes={"%":14,"~":13}}setCatcode(e,t){this.catcodes[e]=t}lex(){var e=this.input,t=this.tokenRegex.lastIndex;if(t===e.length)return new $n("EOF",new Bn(this,t,t));var n=this.tokenRegex.exec(e);if(n===null||n.index!==t)throw new fe("Unexpected character: '"+e[t]+"'",new $n(e[t],new Bn(this,t,t+1)));var r=n[6]||n[3]||(n[2]?"\\ ":" ");if(this.catcodes[r]===14){var s=e.indexOf(`
`,this.tokenRegex.lastIndex);return s===-1?(this.tokenRegex.lastIndex=e.length,this.settings.reportNonstrict("commentAtEnd","% comment has no terminating newline; LaTeX would fail because of commenting the end of math mode (e.g. $)")):this.tokenRegex.lastIndex=s+1,this.lex()}return new $n(r,new Bn(this,t,this.tokenRegex.lastIndex))}},Rh=class{constructor(e,t){e===void 0&&(e={}),t===void 0&&(t={}),this.current=void 0,this.builtins=void 0,this.undefStack=void 0,this.current=t,this.builtins=e,this.undefStack=[]}beginGroup(){this.undefStack.push({})}endGroup(){if(this.undefStack.length===0)throw new fe("Unbalanced namespace destruction: attempt to pop global namespace; please report this as a bug");var e=this.undefStack.pop();for(var t of Object.keys(e))e[t]===void 0?delete this.current[t]:this.current[t]=e[t]}endGroups(){for(;this.undefStack.length>0;)this.endGroup()}has(e){return Object.prototype.hasOwnProperty.call(this.current,e)||Object.prototype.hasOwnProperty.call(this.builtins,e)}get(e){return Object.prototype.hasOwnProperty.call(this.current,e)?this.current[e]:Object.prototype.hasOwnProperty.call(this.builtins,e)?this.builtins[e]:void 0}set(e,t,n){if(n===void 0&&(n=!1),n){for(var r=0;r<this.undefStack.length;r++)delete this.undefStack[r][e];this.undefStack.length>0&&(this.undefStack[this.undefStack.length-1][e]=t)}else{var s=this.undefStack[this.undefStack.length-1];s&&!Object.prototype.hasOwnProperty.call(s,e)&&(s[e]=Object.prototype.hasOwnProperty.call(this.current,e)?this.current[e]:void 0)}t==null?delete this.current[e]:this.current[e]=t}},Av=gp;k("\\noexpand",function(i){var e=i.popToken();return i.isExpandable(e.text)&&(e.noexpand=!0,e.treatAsRelax=!0),{tokens:[e],numArgs:0}});k("\\expandafter",function(i){var e=i.popToken();return i.expandOnce(!0),{tokens:[e],numArgs:0}});k("\\@firstoftwo",function(i){var e=i.consumeArgs(2);return{tokens:e[0],numArgs:0}});k("\\@secondoftwo",function(i){var e=i.consumeArgs(2);return{tokens:e[1],numArgs:0}});k("\\@ifnextchar",function(i){var e=i.consumeArgs(3);i.consumeSpaces();var t=i.future();return e[0].length===1&&e[0][0].text===t.text?{tokens:e[1],numArgs:0}:{tokens:e[2],numArgs:0}});k("\\@ifstar","\\@ifnextchar *{\\@firstoftwo{#1}}");k("\\TextOrMath",function(i){var e=i.consumeArgs(2);return i.mode==="text"?{tokens:e[0],numArgs:0}:{tokens:e[1],numArgs:0}});var Uf={0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,a:10,A:10,b:11,B:11,c:12,C:12,d:13,D:13,e:14,E:14,f:15,F:15};k("\\char",function(i){var e=i.popToken(),t,n=0;if(e.text==="'")t=8,e=i.popToken();else if(e.text==='"')t=16,e=i.popToken();else if(e.text==="`")if(e=i.popToken(),e.text[0]==="\\")n=e.text.charCodeAt(1);else{if(e.text==="EOF")throw new fe("\\char` missing argument");n=e.text.charCodeAt(0)}else t=10;if(t){if(n=Uf[e.text],n==null||n>=t)throw new fe("Invalid base-"+t+" digit "+e.text);for(var r;(r=Uf[i.future().text])!=null&&r<t;)n*=t,n+=r,i.popToken()}return"\\@char{"+n+"}"});var Hh=(i,e,t,n)=>{var r=i.consumeArg().tokens;if(r.length!==1)throw new fe("\\newcommand's first argument must be a macro name");var s=r[0].text,a=i.isDefined(s);if(a&&!e)throw new fe("\\newcommand{"+s+"} attempting to redefine "+(s+"; use \\renewcommand"));if(!a&&!t)throw new fe("\\renewcommand{"+s+"} when command "+s+" does not yet exist; use \\newcommand");var o=0;if(r=i.consumeArg().tokens,r.length===1&&r[0].text==="["){for(var l="",c=i.expandNextToken();c.text!=="]"&&c.text!=="EOF";)l+=c.text,c=i.expandNextToken();if(!l.match(/^\s*[0-9]+\s*$/))throw new fe("Invalid number of arguments: "+l);o=parseInt(l),r=i.consumeArg().tokens}return a&&n||i.macros.set(s,{tokens:r,numArgs:o}),""};k("\\newcommand",i=>Hh(i,!1,!0,!1));k("\\renewcommand",i=>Hh(i,!0,!1,!1));k("\\providecommand",i=>Hh(i,!0,!0,!0));k("\\message",i=>{var e=i.consumeArgs(1)[0];return console.log(e.reverse().map(t=>t.text).join("")),""});k("\\errmessage",i=>{var e=i.consumeArgs(1)[0];return console.error(e.reverse().map(t=>t.text).join("")),""});k("\\show",i=>{var e=i.popToken(),t=e.text;return console.log(e,i.macros.get(t),mr[t],Ot.math[t],Ot.text[t]),""});k("\\bgroup","{");k("\\egroup","}");k("~","\\nobreakspace");k("\\lq","`");k("\\rq","'");k("\\aa","\\r a");k("\\AA","\\r A");k("\\textcopyright","\\html@mathml{\\textcircled{c}}{\\char`©}");k("\\copyright","\\TextOrMath{\\textcopyright}{\\text{\\textcopyright}}");k("\\textregistered","\\html@mathml{\\textcircled{\\scriptsize R}}{\\char`®}");k("ℬ","\\mathscr{B}");k("ℰ","\\mathscr{E}");k("ℱ","\\mathscr{F}");k("ℋ","\\mathscr{H}");k("ℐ","\\mathscr{I}");k("ℒ","\\mathscr{L}");k("ℳ","\\mathscr{M}");k("ℛ","\\mathscr{R}");k("ℭ","\\mathfrak{C}");k("ℌ","\\mathfrak{H}");k("ℨ","\\mathfrak{Z}");k("\\Bbbk","\\Bbb{k}");k("\\llap","\\mathllap{\\textrm{#1}}");k("\\rlap","\\mathrlap{\\textrm{#1}}");k("\\clap","\\mathclap{\\textrm{#1}}");k("\\mathstrut","\\vphantom{(}");k("\\underbar","\\underline{\\text{#1}}");k("\\not",'\\html@mathml{\\mathrel{\\mathrlap\\@not}\\nobreak}{\\char"338}');k("\\neq","\\html@mathml{\\mathrel{\\not=}}{\\mathrel{\\char`≠}}");k("\\ne","\\neq");k("≠","\\neq");k("\\notin","\\html@mathml{\\mathrel{{\\in}\\mathllap{/\\mskip1mu}}}{\\mathrel{\\char`∉}}");k("∉","\\notin");k("≘","\\html@mathml{\\mathrel{=\\kern{-1em}\\raisebox{0.4em}{$\\scriptsize\\frown$}}}{\\mathrel{\\char`≘}}");k("≙","\\html@mathml{\\stackrel{\\tiny\\wedge}{=}}{\\mathrel{\\char`≘}}");k("≚","\\html@mathml{\\stackrel{\\tiny\\vee}{=}}{\\mathrel{\\char`≚}}");k("≛","\\html@mathml{\\stackrel{\\scriptsize\\star}{=}}{\\mathrel{\\char`≛}}");k("≝","\\html@mathml{\\stackrel{\\tiny\\mathrm{def}}{=}}{\\mathrel{\\char`≝}}");k("≞","\\html@mathml{\\stackrel{\\tiny\\mathrm{m}}{=}}{\\mathrel{\\char`≞}}");k("≟","\\html@mathml{\\stackrel{\\tiny?}{=}}{\\mathrel{\\char`≟}}");k("⟂","\\perp");k("‼","\\mathclose{!\\mkern-0.8mu!}");k("∌","\\notni");k("⌜","\\ulcorner");k("⌝","\\urcorner");k("⌞","\\llcorner");k("⌟","\\lrcorner");k("©","\\copyright");k("®","\\textregistered");k("\\ulcorner",'\\html@mathml{\\@ulcorner}{\\mathop{\\char"231c}}');k("\\urcorner",'\\html@mathml{\\@urcorner}{\\mathop{\\char"231d}}');k("\\llcorner",'\\html@mathml{\\@llcorner}{\\mathop{\\char"231e}}');k("\\lrcorner",'\\html@mathml{\\@lrcorner}{\\mathop{\\char"231f}}');k("\\vdots","{\\varvdots\\rule{0pt}{15pt}}");k("⋮","\\vdots");k("\\varGamma","\\mathit{\\Gamma}");k("\\varDelta","\\mathit{\\Delta}");k("\\varTheta","\\mathit{\\Theta}");k("\\varLambda","\\mathit{\\Lambda}");k("\\varXi","\\mathit{\\Xi}");k("\\varPi","\\mathit{\\Pi}");k("\\varSigma","\\mathit{\\Sigma}");k("\\varUpsilon","\\mathit{\\Upsilon}");k("\\varPhi","\\mathit{\\Phi}");k("\\varPsi","\\mathit{\\Psi}");k("\\varOmega","\\mathit{\\Omega}");k("\\substack","\\begin{subarray}{c}#1\\end{subarray}");k("\\colon","\\nobreak\\mskip2mu\\mathpunct{}\\mathchoice{\\mkern-3mu}{\\mkern-3mu}{}{}{:}\\mskip6mu\\relax");k("\\boxed","\\fbox{$\\displaystyle{#1}$}");k("\\iff","\\DOTSB\\;\\Longleftrightarrow\\;");k("\\implies","\\DOTSB\\;\\Longrightarrow\\;");k("\\impliedby","\\DOTSB\\;\\Longleftarrow\\;");k("\\dddot","{\\overset{\\raisebox{-0.1ex}{\\normalsize ...}}{#1}}");k("\\ddddot","{\\overset{\\raisebox{-0.1ex}{\\normalsize ....}}{#1}}");var Bf={",":"\\dotsc","\\not":"\\dotsb","+":"\\dotsb","=":"\\dotsb","<":"\\dotsb",">":"\\dotsb","-":"\\dotsb","*":"\\dotsb",":":"\\dotsb","\\DOTSB":"\\dotsb","\\coprod":"\\dotsb","\\bigvee":"\\dotsb","\\bigwedge":"\\dotsb","\\biguplus":"\\dotsb","\\bigcap":"\\dotsb","\\bigcup":"\\dotsb","\\prod":"\\dotsb","\\sum":"\\dotsb","\\bigotimes":"\\dotsb","\\bigoplus":"\\dotsb","\\bigodot":"\\dotsb","\\bigsqcup":"\\dotsb","\\And":"\\dotsb","\\longrightarrow":"\\dotsb","\\Longrightarrow":"\\dotsb","\\longleftarrow":"\\dotsb","\\Longleftarrow":"\\dotsb","\\longleftrightarrow":"\\dotsb","\\Longleftrightarrow":"\\dotsb","\\mapsto":"\\dotsb","\\longmapsto":"\\dotsb","\\hookrightarrow":"\\dotsb","\\doteq":"\\dotsb","\\mathbin":"\\dotsb","\\mathrel":"\\dotsb","\\relbar":"\\dotsb","\\Relbar":"\\dotsb","\\xrightarrow":"\\dotsb","\\xleftarrow":"\\dotsb","\\DOTSI":"\\dotsi","\\int":"\\dotsi","\\oint":"\\dotsi","\\iint":"\\dotsi","\\iiint":"\\dotsi","\\iiiint":"\\dotsi","\\idotsint":"\\dotsi","\\DOTSX":"\\dotsx"},Ev=new Set(["bin","rel"]);k("\\dots",function(i){var e="\\dotso",t=i.expandAfterFuture().text;return t in Bf?e=Bf[t]:(t.slice(0,4)==="\\not"||t in Ot.math&&Ev.has(Ot.math[t].group))&&(e="\\dotsb"),e});var Gh={")":!0,"]":!0,"\\rbrack":!0,"\\}":!0,"\\rbrace":!0,"\\rangle":!0,"\\rceil":!0,"\\rfloor":!0,"\\rgroup":!0,"\\rmoustache":!0,"\\right":!0,"\\bigr":!0,"\\biggr":!0,"\\Bigr":!0,"\\Biggr":!0,$:!0,";":!0,".":!0,",":!0};k("\\dotso",function(i){var e=i.future().text;return e in Gh?"\\ldots\\,":"\\ldots"});k("\\dotsc",function(i){var e=i.future().text;return e in Gh&&e!==","?"\\ldots\\,":"\\ldots"});k("\\cdots",function(i){var e=i.future().text;return e in Gh?"\\@cdots\\,":"\\@cdots"});k("\\dotsb","\\cdots");k("\\dotsm","\\cdots");k("\\dotsi","\\!\\cdots");k("\\dotsx","\\ldots\\,");k("\\DOTSI","\\relax");k("\\DOTSB","\\relax");k("\\DOTSX","\\relax");k("\\tmspace","\\TextOrMath{\\kern#1#3}{\\mskip#1#2}\\relax");k("\\,","\\tmspace+{3mu}{.1667em}");k("\\thinspace","\\,");k("\\>","\\mskip{4mu}");k("\\:","\\tmspace+{4mu}{.2222em}");k("\\medspace","\\:");k("\\;","\\tmspace+{5mu}{.2777em}");k("\\thickspace","\\;");k("\\!","\\tmspace-{3mu}{.1667em}");k("\\negthinspace","\\!");k("\\negmedspace","\\tmspace-{4mu}{.2222em}");k("\\negthickspace","\\tmspace-{5mu}{.277em}");k("\\enspace","\\kern.5em ");k("\\enskip","\\hskip.5em\\relax");k("\\quad","\\hskip1em\\relax");k("\\qquad","\\hskip2em\\relax");k("\\tag","\\@ifstar\\tag@literal\\tag@paren");k("\\tag@paren","\\tag@literal{({#1})}");k("\\tag@literal",i=>{if(i.macros.get("\\df@tag"))throw new fe("Multiple \\tag");return"\\gdef\\df@tag{\\text{#1}}"});k("\\bmod","\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}\\mathbin{\\rm mod}\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}");k("\\pod","\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern8mu}{\\mkern8mu}{\\mkern8mu}(#1)");k("\\pmod","\\pod{{\\rm mod}\\mkern6mu#1}");k("\\mod","\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern12mu}{\\mkern12mu}{\\mkern12mu}{\\rm mod}\\,\\,#1");k("\\newline","\\\\\\relax");k("\\TeX","\\textrm{\\html@mathml{T\\kern-.1667em\\raisebox{-.5ex}{E}\\kern-.125emX}{TeX}}");var Cp=me(Ei["Main-Regular"][84][1]-.7*Ei["Main-Regular"][65][1]);k("\\LaTeX","\\textrm{\\html@mathml{"+("L\\kern-.36em\\raisebox{"+Cp+"}{\\scriptstyle A}")+"\\kern-.15em\\TeX}{LaTeX}}");k("\\KaTeX","\\textrm{\\html@mathml{"+("K\\kern-.17em\\raisebox{"+Cp+"}{\\scriptstyle A}")+"\\kern-.15em\\TeX}{KaTeX}}");k("\\hspace","\\@ifstar\\@hspacer\\@hspace");k("\\@hspace","\\hskip #1\\relax");k("\\@hspacer","\\rule{0pt}{0pt}\\hskip #1\\relax");k("\\ordinarycolon",":");k("\\vcentcolon","\\mathrel{\\mathop\\ordinarycolon}");k("\\dblcolon",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-.9mu}\\vcentcolon}}{\\mathop{\\char"2237}}');k("\\coloneqq",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2254}}');k("\\Coloneqq",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2237\\char"3d}}');k("\\coloneq",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"3a\\char"2212}}');k("\\Coloneq",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"2237\\char"2212}}');k("\\eqqcolon",'\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2255}}');k("\\Eqqcolon",'\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"3d\\char"2237}}');k("\\eqcolon",'\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2239}}');k("\\Eqcolon",'\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"2212\\char"2237}}');k("\\colonapprox",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"3a\\char"2248}}');k("\\Colonapprox",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"2237\\char"2248}}');k("\\colonsim",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"3a\\char"223c}}');k("\\Colonsim",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"2237\\char"223c}}');k("∷","\\dblcolon");k("∹","\\eqcolon");k("≔","\\coloneqq");k("≕","\\eqqcolon");k("⩴","\\Coloneqq");k("\\ratio","\\vcentcolon");k("\\coloncolon","\\dblcolon");k("\\colonequals","\\coloneqq");k("\\coloncolonequals","\\Coloneqq");k("\\equalscolon","\\eqqcolon");k("\\equalscoloncolon","\\Eqqcolon");k("\\colonminus","\\coloneq");k("\\coloncolonminus","\\Coloneq");k("\\minuscolon","\\eqcolon");k("\\minuscoloncolon","\\Eqcolon");k("\\coloncolonapprox","\\Colonapprox");k("\\coloncolonsim","\\Colonsim");k("\\simcolon","\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\vcentcolon}");k("\\simcoloncolon","\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}");k("\\approxcolon","\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\vcentcolon}");k("\\approxcoloncolon","\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}");k("\\notni","\\html@mathml{\\not\\ni}{\\mathrel{\\char`∌}}");k("\\limsup","\\DOTSB\\operatorname*{lim\\,sup}");k("\\liminf","\\DOTSB\\operatorname*{lim\\,inf}");k("\\injlim","\\DOTSB\\operatorname*{inj\\,lim}");k("\\projlim","\\DOTSB\\operatorname*{proj\\,lim}");k("\\varlimsup","\\DOTSB\\operatorname*{\\overline{lim}}");k("\\varliminf","\\DOTSB\\operatorname*{\\underline{lim}}");k("\\varinjlim","\\DOTSB\\operatorname*{\\underrightarrow{lim}}");k("\\varprojlim","\\DOTSB\\operatorname*{\\underleftarrow{lim}}");k("\\gvertneqq","\\html@mathml{\\@gvertneqq}{≩}");k("\\lvertneqq","\\html@mathml{\\@lvertneqq}{≨}");k("\\ngeqq","\\html@mathml{\\@ngeqq}{≱}");k("\\ngeqslant","\\html@mathml{\\@ngeqslant}{≱}");k("\\nleqq","\\html@mathml{\\@nleqq}{≰}");k("\\nleqslant","\\html@mathml{\\@nleqslant}{≰}");k("\\nshortmid","\\html@mathml{\\@nshortmid}{∤}");k("\\nshortparallel","\\html@mathml{\\@nshortparallel}{∦}");k("\\nsubseteqq","\\html@mathml{\\@nsubseteqq}{⊈}");k("\\nsupseteqq","\\html@mathml{\\@nsupseteqq}{⊉}");k("\\varsubsetneq","\\html@mathml{\\@varsubsetneq}{⊊}");k("\\varsubsetneqq","\\html@mathml{\\@varsubsetneqq}{⫋}");k("\\varsupsetneq","\\html@mathml{\\@varsupsetneq}{⊋}");k("\\varsupsetneqq","\\html@mathml{\\@varsupsetneqq}{⫌}");k("\\imath","\\html@mathml{\\@imath}{ı}");k("\\jmath","\\html@mathml{\\@jmath}{ȷ}");k("\\llbracket","\\html@mathml{\\mathopen{[\\mkern-3.2mu[}}{\\mathopen{\\char`⟦}}");k("\\rrbracket","\\html@mathml{\\mathclose{]\\mkern-3.2mu]}}{\\mathclose{\\char`⟧}}");k("⟦","\\llbracket");k("⟧","\\rrbracket");k("\\lBrace","\\html@mathml{\\mathopen{\\{\\mkern-3.2mu[}}{\\mathopen{\\char`⦃}}");k("\\rBrace","\\html@mathml{\\mathclose{]\\mkern-3.2mu\\}}}{\\mathclose{\\char`⦄}}");k("↤","\\mapsfrom");k("\\mapsfrom","\\html@mathml{\\mathrel{\\mathreflectbox{\\mapsto}}}{\\mathrel{\\char`↤}}");k("⦃","\\lBrace");k("⦄","\\rBrace");k("\\minuso","\\mathbin{\\html@mathml{{\\mathrlap{\\mathchoice{\\kern{0.145em}}{\\kern{0.145em}}{\\kern{0.1015em}}{\\kern{0.0725em}}\\circ}{-}}}{\\char`⦵}}");k("⦵","\\minuso");k("\\darr","\\downarrow");k("\\dArr","\\Downarrow");k("\\Darr","\\Downarrow");k("\\lang","\\langle");k("\\rang","\\rangle");k("\\uarr","\\uparrow");k("\\uArr","\\Uparrow");k("\\Uarr","\\Uparrow");k("\\N","\\mathbb{N}");k("\\R","\\mathbb{R}");k("\\Z","\\mathbb{Z}");k("\\alef","\\aleph");k("\\alefsym","\\aleph");k("\\Alpha","\\mathrm{A}");k("\\Beta","\\mathrm{B}");k("\\bull","\\bullet");k("\\Chi","\\mathrm{X}");k("\\clubs","\\clubsuit");k("\\cnums","\\mathbb{C}");k("\\Complex","\\mathbb{C}");k("\\Dagger","\\ddagger");k("\\diamonds","\\diamondsuit");k("\\empty","\\emptyset");k("\\Epsilon","\\mathrm{E}");k("\\Eta","\\mathrm{H}");k("\\exist","\\exists");k("\\harr","\\leftrightarrow");k("\\hArr","\\Leftrightarrow");k("\\Harr","\\Leftrightarrow");k("\\hearts","\\heartsuit");k("\\image","\\Im");k("\\infin","\\infty");k("\\Iota","\\mathrm{I}");k("\\isin","\\in");k("\\Kappa","\\mathrm{K}");k("\\larr","\\leftarrow");k("\\lArr","\\Leftarrow");k("\\Larr","\\Leftarrow");k("\\lrarr","\\leftrightarrow");k("\\lrArr","\\Leftrightarrow");k("\\Lrarr","\\Leftrightarrow");k("\\Mu","\\mathrm{M}");k("\\natnums","\\mathbb{N}");k("\\Nu","\\mathrm{N}");k("\\Omicron","\\mathrm{O}");k("\\plusmn","\\pm");k("\\rarr","\\rightarrow");k("\\rArr","\\Rightarrow");k("\\Rarr","\\Rightarrow");k("\\real","\\Re");k("\\reals","\\mathbb{R}");k("\\Reals","\\mathbb{R}");k("\\Rho","\\mathrm{P}");k("\\sdot","\\cdot");k("\\sect","\\S");k("\\spades","\\spadesuit");k("\\sub","\\subset");k("\\sube","\\subseteq");k("\\supe","\\supseteq");k("\\Tau","\\mathrm{T}");k("\\thetasym","\\vartheta");k("\\weierp","\\wp");k("\\Zeta","\\mathrm{Z}");k("\\argmin","\\DOTSB\\operatorname*{arg\\,min}");k("\\argmax","\\DOTSB\\operatorname*{arg\\,max}");k("\\plim","\\DOTSB\\mathop{\\operatorname{plim}}\\limits");k("\\bra","\\mathinner{\\langle{#1}|}");k("\\ket","\\mathinner{|{#1}\\rangle}");k("\\braket","\\mathinner{\\langle{#1}\\rangle}");k("\\Bra","\\left\\langle#1\\right|");k("\\Ket","\\left|#1\\right\\rangle");var Rp=i=>e=>{var t=e.consumeArg().tokens,n=e.consumeArg().tokens,r=e.consumeArg().tokens,s=e.consumeArg().tokens,a=e.macros.get("|"),o=e.macros.get("\\|");e.macros.beginGroup();var l=d=>u=>{i&&(u.macros.set("|",a),r.length&&u.macros.set("\\|",o));var f=d;if(!d&&r.length){var g=u.future();g.text==="|"&&(u.popToken(),f=!0)}return{tokens:f?r:n,numArgs:0}};e.macros.set("|",l(!1)),r.length&&e.macros.set("\\|",l(!0));var c=e.consumeArg().tokens,h=e.expandTokens([...s,...c,...t]);return e.macros.endGroup(),{tokens:h.reverse(),numArgs:0}};k("\\bra@ket",Rp(!1));k("\\bra@set",Rp(!0));k("\\Braket","\\bra@ket{\\left\\langle}{\\,\\middle\\vert\\,}{\\,\\middle\\vert\\,}{\\right\\rangle}");k("\\Set","\\bra@set{\\left\\{\\:}{\\;\\middle\\vert\\;}{\\;\\middle\\Vert\\;}{\\:\\right\\}}");k("\\set","\\bra@set{\\{\\,}{\\mid}{}{\\,\\}}");k("\\angln","{\\angl n}");k("\\blue","\\textcolor{##6495ed}{#1}");k("\\orange","\\textcolor{##ffa500}{#1}");k("\\pink","\\textcolor{##ff00af}{#1}");k("\\red","\\textcolor{##df0030}{#1}");k("\\green","\\textcolor{##28ae7b}{#1}");k("\\gray","\\textcolor{gray}{#1}");k("\\purple","\\textcolor{##9d38bd}{#1}");k("\\blueA","\\textcolor{##ccfaff}{#1}");k("\\blueB","\\textcolor{##80f6ff}{#1}");k("\\blueC","\\textcolor{##63d9ea}{#1}");k("\\blueD","\\textcolor{##11accd}{#1}");k("\\blueE","\\textcolor{##0c7f99}{#1}");k("\\tealA","\\textcolor{##94fff5}{#1}");k("\\tealB","\\textcolor{##26edd5}{#1}");k("\\tealC","\\textcolor{##01d1c1}{#1}");k("\\tealD","\\textcolor{##01a995}{#1}");k("\\tealE","\\textcolor{##208170}{#1}");k("\\greenA","\\textcolor{##b6ffb0}{#1}");k("\\greenB","\\textcolor{##8af281}{#1}");k("\\greenC","\\textcolor{##74cf70}{#1}");k("\\greenD","\\textcolor{##1fab54}{#1}");k("\\greenE","\\textcolor{##0d923f}{#1}");k("\\goldA","\\textcolor{##ffd0a9}{#1}");k("\\goldB","\\textcolor{##ffbb71}{#1}");k("\\goldC","\\textcolor{##ff9c39}{#1}");k("\\goldD","\\textcolor{##e07d10}{#1}");k("\\goldE","\\textcolor{##a75a05}{#1}");k("\\redA","\\textcolor{##fca9a9}{#1}");k("\\redB","\\textcolor{##ff8482}{#1}");k("\\redC","\\textcolor{##f9685d}{#1}");k("\\redD","\\textcolor{##e84d39}{#1}");k("\\redE","\\textcolor{##bc2612}{#1}");k("\\maroonA","\\textcolor{##ffbde0}{#1}");k("\\maroonB","\\textcolor{##ff92c6}{#1}");k("\\maroonC","\\textcolor{##ed5fa6}{#1}");k("\\maroonD","\\textcolor{##ca337c}{#1}");k("\\maroonE","\\textcolor{##9e034e}{#1}");k("\\purpleA","\\textcolor{##ddd7ff}{#1}");k("\\purpleB","\\textcolor{##c6b9fc}{#1}");k("\\purpleC","\\textcolor{##aa87ff}{#1}");k("\\purpleD","\\textcolor{##7854ab}{#1}");k("\\purpleE","\\textcolor{##543b78}{#1}");k("\\mintA","\\textcolor{##f5f9e8}{#1}");k("\\mintB","\\textcolor{##edf2df}{#1}");k("\\mintC","\\textcolor{##e0e5cc}{#1}");k("\\grayA","\\textcolor{##f6f7f7}{#1}");k("\\grayB","\\textcolor{##f0f1f2}{#1}");k("\\grayC","\\textcolor{##e3e5e6}{#1}");k("\\grayD","\\textcolor{##d6d8da}{#1}");k("\\grayE","\\textcolor{##babec2}{#1}");k("\\grayF","\\textcolor{##888d93}{#1}");k("\\grayG","\\textcolor{##626569}{#1}");k("\\grayH","\\textcolor{##3b3e40}{#1}");k("\\grayI","\\textcolor{##21242c}{#1}");k("\\kaBlue","\\textcolor{##314453}{#1}");k("\\kaGreen","\\textcolor{##71B307}{#1}");var kp={"^":!0,_:!0,"\\limits":!0,"\\nolimits":!0},kh=class{constructor(e,t,n){this.settings=void 0,this.expansionCount=void 0,this.lexer=void 0,this.macros=void 0,this.stack=void 0,this.mode=void 0,this.settings=t,this.expansionCount=0,this.feed(e),this.macros=new Rh(Av,t.macros),this.mode=n,this.stack=[]}feed(e){this.lexer=new Jo(e,this.settings)}switchMode(e){this.mode=e}beginGroup(){this.macros.beginGroup()}endGroup(){this.macros.endGroup()}endGroups(){this.macros.endGroups()}future(){return this.stack.length===0&&this.pushToken(this.lexer.lex()),this.stack[this.stack.length-1]}popToken(){return this.future(),this.stack.pop()}pushToken(e){this.stack.push(e)}pushTokens(e){this.stack.push(...e)}scanArgument(e){var t,n,r;if(e){if(this.consumeSpaces(),this.future().text!=="[")return null;t=this.popToken();var s=this.consumeArg(["]"]);r=s.tokens,n=s.end}else{var a=this.consumeArg();r=a.tokens,t=a.start,n=a.end}return this.pushToken(new $n("EOF",n.loc)),this.pushTokens(r),new $n("",Bn.range(t,n))}consumeSpaces(){for(;;){var e=this.future();if(e.text===" ")this.stack.pop();else break}}consumeArg(e){var t=[],n=e&&e.length>0;n||this.consumeSpaces();var r=this.future(),s,a=0,o=0;do{if(s=this.popToken(),t.push(s),s.text==="{")++a;else if(s.text==="}"){if(--a,a===-1)throw new fe("Extra }",s)}else if(s.text==="EOF")throw new fe("Unexpected end of input in a macro argument, expected '"+(e&&n?e[o]:"}")+"'",s);if(e&&n)if((a===0||a===1&&e[o]==="{")&&s.text===e[o]){if(++o,o===e.length){t.splice(-o,o);break}}else o=0}while(a!==0||n);return r.text==="{"&&t[t.length-1].text==="}"&&(t.pop(),t.shift()),t.reverse(),{tokens:t,start:r,end:s}}consumeArgs(e,t){if(t){if(t.length!==e+1)throw new fe("The length of delimiters doesn't match the number of args!");for(var n=t[0],r=0;r<n.length;r++){var s=this.popToken();if(n[r]!==s.text)throw new fe("Use of the macro doesn't match its definition",s)}}for(var a=[],o=0;o<e;o++)a.push(this.consumeArg(t&&t[o+1]).tokens);return a}countExpansion(e){if(this.expansionCount+=e,this.expansionCount>this.settings.maxExpand)throw new fe("Too many expansions: infinite loop or need to increase maxExpand setting")}expandOnce(e){var t=this.popToken(),n=t.text,r=t.noexpand?null:this._getExpansion(n);if(r==null||e&&r.unexpandable){if(e&&r==null&&n[0]==="\\"&&!this.isDefined(n))throw new fe("Undefined control sequence: "+n);return this.pushToken(t),!1}this.countExpansion(1);var s=r.tokens,a=this.consumeArgs(r.numArgs,r.delimiters);if(r.numArgs){s=s.slice();for(var o=s.length-1;o>=0;--o){var l=s[o];if(l.text==="#"){if(o===0)throw new fe("Incomplete placeholder at end of macro body",l);if(l=s[--o],l.text==="#")s.splice(o+1,1);else if(/^[1-9]$/.test(l.text))s.splice(o,2,...a[+l.text-1]);else throw new fe("Not a valid argument number",l)}}}return this.pushTokens(s),s.length}expandAfterFuture(){return this.expandOnce(),this.future()}expandNextToken(){for(;;)if(this.expandOnce()===!1){var e=this.stack.pop();return e.treatAsRelax&&(e.text="\\relax"),e}}expandMacro(e){return this.macros.has(e)?this.expandTokens([new $n(e)]):void 0}expandTokens(e){var t=[],n=this.stack.length;for(this.pushTokens(e);this.stack.length>n;)if(this.expandOnce(!0)===!1){var r=this.stack.pop();r.treatAsRelax&&(r.noexpand=!1,r.treatAsRelax=!1),t.push(r)}return this.countExpansion(t.length),t}expandMacroAsText(e){var t=this.expandMacro(e);return t&&t.map(n=>n.text).join("")}_getExpansion(e){var t=this.macros.get(e);if(t==null)return t;if(e.length===1){var n=this.lexer.catcodes[e];if(n!=null&&n!==13)return}var r=typeof t=="function"?t(this):t;if(typeof r=="string"){var s=0;if(r.includes("#"))for(var a=r.replace(/##/g,"");a.includes("#"+(s+1));)++s;for(var o=new Jo(r,this.settings),l=[],c=o.lex();c.text!=="EOF";)l.push(c),c=o.lex();l.reverse();var h={tokens:l,numArgs:s};return h}return r}isDefined(e){return this.macros.has(e)||Object.prototype.hasOwnProperty.call(mr,e)||Object.prototype.hasOwnProperty.call(Ot.math,e)||Object.prototype.hasOwnProperty.call(Ot.text,e)||Object.prototype.hasOwnProperty.call(kp,e)}isExpandable(e){var t=this.macros.get(e);return t!=null?typeof t=="string"||typeof t=="function"||!t.unexpandable:Object.prototype.hasOwnProperty.call(mr,e)&&!mr[e].primitive}},Of=/^[₊₋₌₍₎₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦᵧᵨᵩᵪ]/,Wo=Object.freeze({"₊":"+","₋":"-","₌":"=","₍":"(","₎":")","₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9","ₐ":"a","ₑ":"e","ₕ":"h","ᵢ":"i","ⱼ":"j","ₖ":"k","ₗ":"l","ₘ":"m","ₙ":"n","ₒ":"o","ₚ":"p","ᵣ":"r","ₛ":"s","ₜ":"t","ᵤ":"u","ᵥ":"v","ₓ":"x","ᵦ":"β","ᵧ":"γ","ᵨ":"ρ","ᵩ":"ϕ","ᵪ":"χ","⁺":"+","⁻":"-","⁼":"=","⁽":"(","⁾":")","⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9","ᴬ":"A","ᴮ":"B","ᴰ":"D","ᴱ":"E","ᴳ":"G","ᴴ":"H","ᴵ":"I","ᴶ":"J","ᴷ":"K","ᴸ":"L","ᴹ":"M","ᴺ":"N","ᴼ":"O","ᴾ":"P","ᴿ":"R","ᵀ":"T","ᵁ":"U","ⱽ":"V","ᵂ":"W","ᵃ":"a","ᵇ":"b","ᶜ":"c","ᵈ":"d","ᵉ":"e","ᶠ":"f","ᵍ":"g",ʰ:"h","ⁱ":"i",ʲ:"j","ᵏ":"k",ˡ:"l","ᵐ":"m",ⁿ:"n","ᵒ":"o","ᵖ":"p",ʳ:"r",ˢ:"s","ᵗ":"t","ᵘ":"u","ᵛ":"v",ʷ:"w",ˣ:"x",ʸ:"y","ᶻ":"z","ᵝ":"β","ᵞ":"γ","ᵟ":"δ","ᵠ":"ϕ","ᵡ":"χ","ᶿ":"θ"}),ch={"́":{text:"\\'",math:"\\acute"},"̀":{text:"\\`",math:"\\grave"},"̈":{text:'\\"',math:"\\ddot"},"̃":{text:"\\~",math:"\\tilde"},"̄":{text:"\\=",math:"\\bar"},"̆":{text:"\\u",math:"\\breve"},"̌":{text:"\\v",math:"\\check"},"̂":{text:"\\^",math:"\\hat"},"̇":{text:"\\.",math:"\\dot"},"̊":{text:"\\r",math:"\\mathring"},"̋":{text:"\\H"},"̧":{text:"\\c"}},Vf={á:"á",à:"à",ä:"ä",ǟ:"ǟ",ã:"ã",ā:"ā",ă:"ă",ắ:"ắ",ằ:"ằ",ẵ:"ẵ",ǎ:"ǎ",â:"â",ấ:"ấ",ầ:"ầ",ẫ:"ẫ",ȧ:"ȧ",ǡ:"ǡ",å:"å",ǻ:"ǻ",ḃ:"ḃ",ć:"ć",ḉ:"ḉ",č:"č",ĉ:"ĉ",ċ:"ċ",ç:"ç",ď:"ď",ḋ:"ḋ",ḑ:"ḑ",é:"é",è:"è",ë:"ë",ẽ:"ẽ",ē:"ē",ḗ:"ḗ",ḕ:"ḕ",ĕ:"ĕ",ḝ:"ḝ",ě:"ě",ê:"ê",ế:"ế",ề:"ề",ễ:"ễ",ė:"ė",ȩ:"ȩ",ḟ:"ḟ",ǵ:"ǵ",ḡ:"ḡ",ğ:"ğ",ǧ:"ǧ",ĝ:"ĝ",ġ:"ġ",ģ:"ģ",ḧ:"ḧ",ȟ:"ȟ",ĥ:"ĥ",ḣ:"ḣ",ḩ:"ḩ",í:"í",ì:"ì",ï:"ï",ḯ:"ḯ",ĩ:"ĩ",ī:"ī",ĭ:"ĭ",ǐ:"ǐ",î:"î",ǰ:"ǰ",ĵ:"ĵ",ḱ:"ḱ",ǩ:"ǩ",ķ:"ķ",ĺ:"ĺ",ľ:"ľ",ļ:"ļ",ḿ:"ḿ",ṁ:"ṁ",ń:"ń",ǹ:"ǹ",ñ:"ñ",ň:"ň",ṅ:"ṅ",ņ:"ņ",ó:"ó",ò:"ò",ö:"ö",ȫ:"ȫ",õ:"õ",ṍ:"ṍ",ṏ:"ṏ",ȭ:"ȭ",ō:"ō",ṓ:"ṓ",ṑ:"ṑ",ŏ:"ŏ",ǒ:"ǒ",ô:"ô",ố:"ố",ồ:"ồ",ỗ:"ỗ",ȯ:"ȯ",ȱ:"ȱ",ő:"ő",ṕ:"ṕ",ṗ:"ṗ",ŕ:"ŕ",ř:"ř",ṙ:"ṙ",ŗ:"ŗ",ś:"ś",ṥ:"ṥ",š:"š",ṧ:"ṧ",ŝ:"ŝ",ṡ:"ṡ",ş:"ş",ẗ:"ẗ",ť:"ť",ṫ:"ṫ",ţ:"ţ",ú:"ú",ù:"ù",ü:"ü",ǘ:"ǘ",ǜ:"ǜ",ǖ:"ǖ",ǚ:"ǚ",ũ:"ũ",ṹ:"ṹ",ū:"ū",ṻ:"ṻ",ŭ:"ŭ",ǔ:"ǔ",û:"û",ů:"ů",ű:"ű",ṽ:"ṽ",ẃ:"ẃ",ẁ:"ẁ",ẅ:"ẅ",ŵ:"ŵ",ẇ:"ẇ",ẘ:"ẘ",ẍ:"ẍ",ẋ:"ẋ",ý:"ý",ỳ:"ỳ",ÿ:"ÿ",ỹ:"ỹ",ȳ:"ȳ",ŷ:"ŷ",ẏ:"ẏ",ẙ:"ẙ",ź:"ź",ž:"ž",ẑ:"ẑ",ż:"ż",Á:"Á",À:"À",Ä:"Ä",Ǟ:"Ǟ",Ã:"Ã",Ā:"Ā",Ă:"Ă",Ắ:"Ắ",Ằ:"Ằ",Ẵ:"Ẵ",Ǎ:"Ǎ",Â:"Â",Ấ:"Ấ",Ầ:"Ầ",Ẫ:"Ẫ",Ȧ:"Ȧ",Ǡ:"Ǡ",Å:"Å",Ǻ:"Ǻ",Ḃ:"Ḃ",Ć:"Ć",Ḉ:"Ḉ",Č:"Č",Ĉ:"Ĉ",Ċ:"Ċ",Ç:"Ç",Ď:"Ď",Ḋ:"Ḋ",Ḑ:"Ḑ",É:"É",È:"È",Ë:"Ë",Ẽ:"Ẽ",Ē:"Ē",Ḗ:"Ḗ",Ḕ:"Ḕ",Ĕ:"Ĕ",Ḝ:"Ḝ",Ě:"Ě",Ê:"Ê",Ế:"Ế",Ề:"Ề",Ễ:"Ễ",Ė:"Ė",Ȩ:"Ȩ",Ḟ:"Ḟ",Ǵ:"Ǵ",Ḡ:"Ḡ",Ğ:"Ğ",Ǧ:"Ǧ",Ĝ:"Ĝ",Ġ:"Ġ",Ģ:"Ģ",Ḧ:"Ḧ",Ȟ:"Ȟ",Ĥ:"Ĥ",Ḣ:"Ḣ",Ḩ:"Ḩ",Í:"Í",Ì:"Ì",Ï:"Ï",Ḯ:"Ḯ",Ĩ:"Ĩ",Ī:"Ī",Ĭ:"Ĭ",Ǐ:"Ǐ",Î:"Î",İ:"İ",Ĵ:"Ĵ",Ḱ:"Ḱ",Ǩ:"Ǩ",Ķ:"Ķ",Ĺ:"Ĺ",Ľ:"Ľ",Ļ:"Ļ",Ḿ:"Ḿ",Ṁ:"Ṁ",Ń:"Ń",Ǹ:"Ǹ",Ñ:"Ñ",Ň:"Ň",Ṅ:"Ṅ",Ņ:"Ņ",Ó:"Ó",Ò:"Ò",Ö:"Ö",Ȫ:"Ȫ",Õ:"Õ",Ṍ:"Ṍ",Ṏ:"Ṏ",Ȭ:"Ȭ",Ō:"Ō",Ṓ:"Ṓ",Ṑ:"Ṑ",Ŏ:"Ŏ",Ǒ:"Ǒ",Ô:"Ô",Ố:"Ố",Ồ:"Ồ",Ỗ:"Ỗ",Ȯ:"Ȯ",Ȱ:"Ȱ",Ő:"Ő",Ṕ:"Ṕ",Ṗ:"Ṗ",Ŕ:"Ŕ",Ř:"Ř",Ṙ:"Ṙ",Ŗ:"Ŗ",Ś:"Ś",Ṥ:"Ṥ",Š:"Š",Ṧ:"Ṧ",Ŝ:"Ŝ",Ṡ:"Ṡ",Ş:"Ş",Ť:"Ť",Ṫ:"Ṫ",Ţ:"Ţ",Ú:"Ú",Ù:"Ù",Ü:"Ü",Ǘ:"Ǘ",Ǜ:"Ǜ",Ǖ:"Ǖ",Ǚ:"Ǚ",Ũ:"Ũ",Ṹ:"Ṹ",Ū:"Ū",Ṻ:"Ṻ",Ŭ:"Ŭ",Ǔ:"Ǔ",Û:"Û",Ů:"Ů",Ű:"Ű",Ṽ:"Ṽ",Ẃ:"Ẃ",Ẁ:"Ẁ",Ẅ:"Ẅ",Ŵ:"Ŵ",Ẇ:"Ẇ",Ẍ:"Ẍ",Ẋ:"Ẋ",Ý:"Ý",Ỳ:"Ỳ",Ÿ:"Ÿ",Ỹ:"Ỹ",Ȳ:"Ȳ",Ŷ:"Ŷ",Ẏ:"Ẏ",Ź:"Ź",Ž:"Ž",Ẑ:"Ẑ",Ż:"Ż",ά:"ά",ὰ:"ὰ",ᾱ:"ᾱ",ᾰ:"ᾰ",έ:"έ",ὲ:"ὲ",ή:"ή",ὴ:"ὴ",ί:"ί",ὶ:"ὶ",ϊ:"ϊ",ΐ:"ΐ",ῒ:"ῒ",ῑ:"ῑ",ῐ:"ῐ",ό:"ό",ὸ:"ὸ",ύ:"ύ",ὺ:"ὺ",ϋ:"ϋ",ΰ:"ΰ",ῢ:"ῢ",ῡ:"ῡ",ῠ:"ῠ",ώ:"ώ",ὼ:"ὼ",Ύ:"Ύ",Ὺ:"Ὺ",Ϋ:"Ϋ",Ῡ:"Ῡ",Ῠ:"Ῠ",Ώ:"Ώ",Ὼ:"Ὼ"},jo=class i{constructor(e,t){this.mode=void 0,this.gullet=void 0,this.settings=void 0,this.leftrightDepth=void 0,this.nextToken=void 0,this.mode="math",this.gullet=new kh(e,t,this.mode),this.settings=t,this.leftrightDepth=0,this.nextToken=null}expect(e,t){if(t===void 0&&(t=!0),this.fetch().text!==e)throw new fe("Expected '"+e+"', got '"+this.fetch().text+"'",this.fetch());t&&this.consume()}consume(){this.nextToken=null}fetch(){return this.nextToken==null&&(this.nextToken=this.gullet.expandNextToken()),this.nextToken}switchMode(e){this.mode=e,this.gullet.switchMode(e)}parse(){this.settings.globalGroup||this.gullet.beginGroup(),this.settings.colorIsTextColor&&this.gullet.macros.set("\\color","\\textcolor");try{var e=this.parseExpression(!1);return this.expect("EOF"),this.settings.globalGroup||this.gullet.endGroup(),e}finally{this.gullet.endGroups()}}subparse(e){var t=this.nextToken;this.consume(),this.gullet.pushToken(new $n("}")),this.gullet.pushTokens(e);var n=this.parseExpression(!1);return this.expect("}"),this.nextToken=t,n}parseExpression(e,t){for(var n=[];;){this.mode==="math"&&this.consumeSpaces();var r=this.fetch();if(i.endOfExpression.has(r.text)||t&&r.text===t||e&&mr[r.text]&&mr[r.text].infix)break;var s=this.parseAtom(t);if(s){if(s.type==="internal")continue}else break;n.push(s)}return this.mode==="text"&&this.formLigatures(n),this.handleInfixNodes(n)}handleInfixNodes(e){for(var t=-1,n,r=0;r<e.length;r++){var s=e[r];if(s.type==="infix"){if(t!==-1)throw new fe("only one infix operator per group",s.token);t=r,n=s.replaceWith}}if(t!==-1&&n){var a,o,l=e.slice(0,t),c=e.slice(t+1);l.length===1&&l[0].type==="ordgroup"?a=l[0]:a={type:"ordgroup",mode:this.mode,body:l},c.length===1&&c[0].type==="ordgroup"?o=c[0]:o={type:"ordgroup",mode:this.mode,body:c};var h;return n==="\\\\abovefrac"?h=this.callFunction(n,[a,e[t],o],[]):h=this.callFunction(n,[a,o],[]),[h]}else return e}handleSupSubscript(e){var t=this.fetch(),n=t.text;this.consume(),this.consumeSpaces();var r;do{var s;r=this.parseGroup(e)}while(((s=r)==null?void 0:s.type)==="internal");if(!r)throw new fe("Expected group after '"+n+"'",t);return r}formatUnsupportedCmd(e){for(var t=[],n=0;n<e.length;n++)t.push({type:"textord",mode:"text",text:e[n]});var r={type:"text",mode:this.mode,body:t},s={type:"color",mode:this.mode,color:this.settings.errorColor,body:[r]};return s}parseAtom(e){var t=this.parseGroup("atom",e);if(t?.type==="internal"||this.mode==="text")return t;for(var n,r;;){this.consumeSpaces();var s=this.fetch();if(s.text==="\\limits"||s.text==="\\nolimits"){if(t&&t.type==="op")t.limits=s.text==="\\limits",t.alwaysHandleSupSub=!0;else if(t&&t.type==="operatorname")t.alwaysHandleSupSub&&(t.limits=s.text==="\\limits");else throw new fe("Limit controls must follow a math operator",s);this.consume()}else if(s.text==="^"){if(n)throw new fe("Double superscript",s);n=this.handleSupSubscript("superscript")}else if(s.text==="_"){if(r)throw new fe("Double subscript",s);r=this.handleSupSubscript("subscript")}else if(s.text==="'"){if(n)throw new fe("Double superscript",s);var a={type:"textord",mode:this.mode,text:"\\prime"},o=[a];for(this.consume();this.fetch().text==="'";)o.push(a),this.consume();this.fetch().text==="^"&&o.push(this.handleSupSubscript("superscript")),n={type:"ordgroup",mode:this.mode,body:o}}else if(Wo[s.text]){var l=Of.test(s.text),c=[];for(c.push(new $n(Wo[s.text])),this.consume();;){var h=this.fetch().text;if(!Wo[h]||Of.test(h)!==l)break;c.unshift(new $n(Wo[h])),this.consume()}var d=this.subparse(c);l?r={type:"ordgroup",mode:"math",body:d}:n={type:"ordgroup",mode:"math",body:d}}else break}return n&&r?{type:"supsub",mode:this.mode,base:t,sup:n,sub:r}:n?{type:"supsub",mode:this.mode,base:t,sup:n}:r?{type:"supsub",mode:this.mode,base:t,sub:r}:t}parseFunction(e,t){var n=this.fetch(),r=n.text,s=mr[r];if(!s)return null;if(this.consume(),t&&t!=="atom"&&!s.allowedInArgument)throw new fe("Got function '"+r+"' with no arguments"+(t?" as "+t:""),n);if(this.mode==="text"&&!s.allowedInText)throw new fe("Can't use function '"+r+"' in text mode",n);if(this.mode==="math"&&s.allowedInMath===!1)throw new fe("Can't use function '"+r+"' in math mode",n);var a=this.parseArguments(r,s),o=a.args,l=a.optArgs;return this.callFunction(r,o,l,n,e)}callFunction(e,t,n,r,s){var a={funcName:e,parser:this,token:r,breakOnTokenText:s},o=mr[e];if(o&&o.handler)return o.handler(a,t,n);throw new fe("No function handler for "+e)}parseArguments(e,t){var n,r=(n=t.numOptionalArgs)!=null?n:0,s=t.numArgs+r;if(s===0)return{args:[],optArgs:[]};for(var a=[],o=[],l=0;l<s;l++){var c,h=(c=t.argTypes)==null?void 0:c[l],d=l<r;("primitive"in t&&t.primitive&&h==null||t.type==="sqrt"&&l===1&&o[0]==null)&&(h="primitive");var u=this.parseGroupOfType("argument to '"+e+"'",h,d);if(d)o.push(u);else if(u!=null)a.push(u);else throw new fe("Null argument, please report this as a bug")}return{args:a,optArgs:o}}parseGroupOfType(e,t,n){switch(t){case"color":return this.parseColorGroup(n);case"size":return this.parseSizeGroup(n);case"url":return this.parseUrlGroup(n);case"math":case"text":return this.parseArgumentGroup(n,t);case"hbox":{var r=this.parseArgumentGroup(n,"text");return r!=null?{type:"styling",mode:r.mode,body:[r],style:"text",resetFont:!0}:null}case"raw":{var s=this.parseStringGroup(n);return s!=null?{type:"raw",mode:"text",string:s.text}:null}case"primitive":{if(n)throw new fe("A primitive argument cannot be optional");var a=this.parseGroup(e);if(a==null)throw new fe("Expected group as "+e,this.fetch());return a}case"original":case void 0:return this.parseArgumentGroup(n);default:throw new fe("Unknown group type as "+e,this.fetch())}}consumeSpaces(){for(;this.fetch().text===" ";)this.consume()}parseStringGroup(e){var t=this.gullet.scanArgument(e);if(t==null)return null;for(var n="",r;(r=this.fetch()).text!=="EOF";)n+=r.text,this.consume();return this.consume(),t.text=n,t}parseRegexGroup(e,t){for(var n=this.fetch(),r=n,s="",a;(a=this.fetch()).text!=="EOF"&&e.test(s+a.text);)r=a,s+=r.text,this.consume();if(s==="")throw new fe("Invalid "+t+": '"+n.text+"'",n);return n.range(r,s)}parseColorGroup(e){var t=this.parseStringGroup(e);if(t==null)return null;var n=/^(#[a-f0-9]{3,4}|#[a-f0-9]{6}|#[a-f0-9]{8}|[a-f0-9]{6}|[a-z]+)$/i.exec(t.text);if(!n)throw new fe("Invalid color: '"+t.text+"'",t);var r=n[0];return/^[0-9a-f]{6}$/i.test(r)&&(r="#"+r),{type:"color-token",mode:this.mode,color:r}}parseSizeGroup(e){var t,n=!1;if(this.gullet.consumeSpaces(),!e&&this.gullet.future().text!=="{"?t=this.parseRegexGroup(/^[-+]? *(?:$|\d+|\d+\.\d*|\.\d*) *[a-z]{0,2} *$/,"size"):t=this.parseStringGroup(e),!t)return null;!e&&t.text.length===0&&(t.text="0pt",n=!0);var r=/([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(t.text);if(!r)throw new fe("Invalid size: '"+t.text+"'",t);var s={number:+(r[1]+r[2]),unit:r[3]};if(!Gf(s))throw new fe("Invalid unit: '"+s.unit+"'",t);return{type:"size",mode:this.mode,value:s,isBlank:n}}parseUrlGroup(e){this.gullet.lexer.setCatcode("%",13),this.gullet.lexer.setCatcode("~",12);var t=this.parseStringGroup(e);if(this.gullet.lexer.setCatcode("%",14),this.gullet.lexer.setCatcode("~",13),t==null)return null;var n=t.text.replace(/\\([#$%&~_^{}])/g,"$1");return{type:"url",mode:this.mode,url:n}}parseArgumentGroup(e,t){var n=this.gullet.scanArgument(e);if(n==null)return null;var r=this.mode;t&&this.switchMode(t),this.gullet.beginGroup();var s=this.parseExpression(!1,"EOF");this.expect("EOF"),this.gullet.endGroup();var a={type:"ordgroup",mode:this.mode,loc:n.loc,body:s};return t&&this.switchMode(r),a}parseGroup(e,t){var n=this.fetch(),r=n.text,s;if(r==="{"||r==="\\begingroup"){this.consume();var a=r==="{"?"}":"\\endgroup";this.gullet.beginGroup();var o=this.parseExpression(!1,a),l=this.fetch();this.expect(a),this.gullet.endGroup(),s={type:"ordgroup",mode:this.mode,loc:Bn.range(n,l),body:o,semisimple:r==="\\begingroup"||void 0}}else if(s=this.parseFunction(t,e)||this.parseSymbol(),s==null&&r[0]==="\\"&&!Object.prototype.hasOwnProperty.call(kp,r)){if(this.settings.throwOnError)throw new fe("Undefined control sequence: "+r,n);s=this.formatUnsupportedCmd(r),this.consume()}return s}formLigatures(e){for(var t=e.length-1,n=0;n<t;++n){var r=e[n];if(r.type==="textord"){var s=r.text,a=e[n+1];if(!(!a||a.type!=="textord")){if(s==="-"&&a.text==="-"){var o=e[n+2];n+1<t&&o&&o.type==="textord"&&o.text==="-"?(e.splice(n,3,{type:"textord",mode:"text",loc:Bn.range(r,o),text:"---"}),t-=2):(e.splice(n,2,{type:"textord",mode:"text",loc:Bn.range(r,a),text:"--"}),t-=1)}(s==="'"||s==="`")&&a.text===s&&(e.splice(n,2,{type:"textord",mode:"text",loc:Bn.range(r,a),text:s+s}),t-=1)}}}}parseSymbol(){var e=this.fetch(),t=e.text;if(/^\\verb[^a-zA-Z]/.test(t)){this.consume();var n=t.slice(5),r=n.charAt(0)==="*";if(r&&(n=n.slice(1)),n.length<2||n.charAt(0)!==n.slice(-1))throw new fe(`\\verb assertion failed --
                    please report what input caused this bug`);return n=n.slice(1,-1),{type:"verb",mode:"text",body:n,star:r}}Object.prototype.hasOwnProperty.call(Vf,t[0])&&!Ot[this.mode][t[0]]&&(this.settings.strict&&this.mode==="math"&&this.settings.reportNonstrict("unicodeTextInMathMode",'Accented Unicode text character "'+t[0]+'" used in math mode',e),t=Vf[t[0]]+t.slice(1));var s=wv.exec(t);s&&(t=t.substring(0,s.index),t==="i"?t="ı":t==="j"&&(t="ȷ"));var a;if(Ot[this.mode][t]){this.settings.strict&&this.mode==="math"&&ph.includes(t)&&this.settings.reportNonstrict("unicodeTextInMathMode",'Latin-1/Unicode text character "'+t[0]+'" used in math mode',e);var o=Ot[this.mode][t].group,l=Bn.range(e),c;Dx(o)?c={type:"atom",mode:this.mode,family:o,loc:l,text:t}:c={type:o,mode:this.mode,loc:l,text:t},a=c}else if(t.charCodeAt(0)>=128)this.settings.strict&&(Hf(t.charCodeAt(0))?this.mode==="math"&&this.settings.reportNonstrict("unicodeTextInMathMode",'Unicode text character "'+t[0]+'" used in math mode',e):this.settings.reportNonstrict("unknownSymbol",'Unrecognized Unicode character "'+t[0]+'"'+(" ("+t.charCodeAt(0)+")"),e)),a={type:"textord",mode:"text",loc:Bn.range(e),text:t};else return null;if(this.consume(),s)for(var h=0;h<s[0].length;h++){var d=s[0][h];if(!ch[d])throw new fe("Unknown accent ' "+d+"'",e);var u=ch[d][this.mode]||ch[d].text;if(!u)throw new fe("Accent "+d+" unsupported in "+this.mode+" mode",e);a={type:"accent",mode:this.mode,loc:Bn.range(e),label:u,isStretchy:!1,isShifty:!0,base:a}}return a}};jo.endOfExpression=new Set(["}","\\endgroup","\\end","\\right","&"]);var Wh=function(e,t){if(!(typeof e=="string"||e instanceof String))throw new TypeError("KaTeX can only parse string typed expression");var n=new jo(e,t);delete n.gullet.macros.current["\\df@tag"];var r=n.parse();if(delete n.gullet.macros.current["\\current@color"],delete n.gullet.macros.current["\\color"],n.gullet.macros.get("\\df@tag")){if(!t.displayMode)throw new fe("\\tag works only in display equations");r=[{type:"tag",mode:"text",body:r,tag:n.subparse([new $n("\\df@tag")])}]}return r},Ip=function(e,t,n){t.textContent="";var r=qh(e,n).toNode();t.appendChild(r)};typeof document<"u"&&document.compatMode!=="CSS1Compat"&&(typeof console<"u"&&console.warn("Warning: KaTeX doesn't work in quirks mode. Make sure your website has a suitable doctype."),Ip=function(){throw new fe("KaTeX doesn't work in quirks mode.")});var Cv=function(e,t){var n=qh(e,t).toMarkup();return n},Rv=function(e,t){var n=new fa(t);return Wh(e,n)},Pp=function(e,t,n){if(n.throwOnError||!(e instanceof fe))throw e;var r=ue(["katex-error"],[new Dn(t)]);return r.setAttribute("title",e.toString()),r.setAttribute("style","color:"+n.errorColor),r},qh=function(e,t){var n=new fa(t);try{var r=Wh(e,n);return Tx(r,e,n)}catch(s){return Pp(s,e,n)}},kv=function(e,t){var n=new fa(t);try{var r=Wh(e,n);return Ax(r,e,n)}catch(s){return Pp(s,e,n)}},Iv="0.18.7",Pv={Span:vr,Anchor:vs,SymbolNode:Dn,SvgNode:ui,PathNode:Ci,LineNode:ma},Xh={version:Iv,render:Ip,renderToString:Cv,ParseError:fe,SETTINGS_SCHEMA:hh,__parse:Rv,__renderToDomTree:qh,__renderToHTMLTree:kv,__setFontMetrics:ax,__defineSymbol:x,__defineFunction:Ae,__defineMacro:k,__domTree:Pv};function Fn(i,e=!1){return Xh.renderToString(i,{throwOnError:!1,displayMode:e,output:"html",strict:"ignore"})}function _a(i=document){for(let e of i.querySelectorAll("[data-tex]"))if(!e.dataset.texDone)try{Xh.render(e.dataset.tex,e,{throwOnError:!1,displayMode:e.classList.contains("formula")||e.hasAttribute("data-display"),output:"html",strict:"ignore"}),e.dataset.texDone="1"}catch{e.textContent=e.dataset.tex}}var om=0,Au=1,lm=2;var ja=1,cm=2,Ws=3,Dr=0,Un=1,Fi=2,oi=0,qs=1,nr=2,Eu=3,Cu=4,hm=5;var ns=100,um=101,dm=102,fm=103,pm=104,mm=200,gm=201,xm=202,vm=203,Ru=204,ku=205,ym=206,bm=207,_m=208,Mm=209,Sm=210,wm=211,Tm=212,Am=213,Em=214,zl=0,Ll=1,Dl=2,Ns=3,Nl=4,Fl=5,Ul=6,Bl=7,Iu=0,Cm=1,Rm=2,xi=0,Qa=1,eo=2,to=3,is=4,no=5,io=6,ro=7;var Pu=300,Nr=301,rs=302,Mc=303,Sc=304,so=306,Ol=1e3,zi=1001,Vl=1002,bn=1003,km=1004;var ao=1005;var Mn=1006,wc=1007;var Fr=1008;var ei=1009,zu=1010,Lu=1011,Xs=1012,Tc=1013,vi=1014,yi=1015,Sn=1016,Ac=1017,Ec=1018,$s=1020,Du=35902,Nu=35899,Fu=1021,Uu=1022,li=1023,Li=1026,Ur=1027,Bu=1028,Cc=1029,Br=1030,Rc=1031;var kc=1033,oo=33776,lo=33777,co=33778,ho=33779,Ic=35840,Pc=35841,zc=35842,Lc=35843,Dc=36196,Nc=37492,Fc=37496,Uc=37488,Bc=37489,uo=37490,Oc=37491,Vc=37808,Hc=37809,Gc=37810,Wc=37811,qc=37812,Xc=37813,$c=37814,Yc=37815,Kc=37816,Zc=37817,Jc=37818,jc=37819,Qc=37820,e0=37821,t0=36492,n0=36494,i0=36495,r0=36283,s0=36284,fo=36285,a0=36286;var ka=2300,Hl=2301,Il=2302,yu=2303,bu=2400,_u=2401,Mu=2402;var Im=3200;var Ou=0,Pm=1,ir="",jn="srgb",Ia="srgb-linear",Pa="linear",yt="srgb";var Pl=7680;var zm=519,Lm=512,Dm=513,Nm=514,o0=515,Fm=516,Um=517,l0=518,Bm=519,Om=35044,Vu=35048;var Hu="300 es",gi=2e3,za=2001;function zv(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function Lv(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function La(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Vm(){let i=La("canvas");return i.style.display="block",i}var zp={},Fs=null;function Gu(...i){let e="THREE."+i.shift();Fs?Fs("log",e,...i):console.log(e,...i)}function Hm(i){let e=i[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=i[1];t&&t.isStackTrace?i[0]+=" "+t.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function qe(...i){i=Hm(i);let e="THREE."+i.shift();if(Fs)Fs("warn",e,...i);else{let t=i[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...i)}}function Ye(...i){i=Hm(i);let e="THREE."+i.shift();if(Fs)Fs("error",e,...i);else{let t=i[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...i)}}function Qr(...i){let e=i.join(" ");e in zp||(zp[e]=!0,qe(...i))}function Gm(i,e,t){return new Promise(function(n,r){function s(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:r();break;case i.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:n()}}setTimeout(s,t)})}var Wm={[zl]:Ll,[Dl]:Ul,[Nl]:Bl,[Ns]:Fl,[Ll]:zl,[Ul]:Dl,[Bl]:Nl,[Fl]:Ns},Di=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let r=n.slice(0);for(let s=0,a=r.length;s<a;s++)r[s].call(this,e);e.target=null}}},En=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var $h=Math.PI/180,Gl=180/Math.PI;function po(){let i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(En[i&255]+En[i>>8&255]+En[i>>16&255]+En[i>>24&255]+"-"+En[e&255]+En[e>>8&255]+"-"+En[e>>16&15|64]+En[e>>24&255]+"-"+En[t&63|128]+En[t>>8&255]+"-"+En[t>>16&255]+En[t>>24&255]+En[n&255]+En[n>>8&255]+En[n>>16&255]+En[n>>24&255]).toLowerCase()}function ut(i,e,t){return Math.max(e,Math.min(t,i))}function Dv(i,e){return(i%e+e)%e}function Yh(i,e,t){return(1-t)*i+t*e}function Ma(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:case Uint8ClampedArray:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function On(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Ku=class Ku{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=ut(this.x,e.x,t.x),this.y=ut(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=ut(this.x,e,t),this.y=ut(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ut(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(ut(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),s=this.x-e.x,a=this.y-e.y;return this.x=s*n-a*r+e.x,this.y=s*r+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};Ku.prototype.isVector2=!0;var Le=Ku,Ni=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,s,a,o){let l=n[r+0],c=n[r+1],h=n[r+2],d=n[r+3],u=s[a+0],f=s[a+1],g=s[a+2],v=s[a+3];if(d!==v||l!==u||c!==f||h!==g){let m=l*u+c*f+h*g+d*v;m<0&&(u=-u,f=-f,g=-g,v=-v,m=-m);let p=1-o;if(m<.9995){let _=Math.acos(m),A=Math.sin(_);p=Math.sin(p*_)/A,o=Math.sin(o*_)/A,l=l*p+u*o,c=c*p+f*o,h=h*p+g*o,d=d*p+v*o}else{l=l*p+u*o,c=c*p+f*o,h=h*p+g*o,d=d*p+v*o;let _=1/Math.sqrt(l*l+c*c+h*h+d*d);l*=_,c*=_,h*=_,d*=_}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=d}static multiplyQuaternionsFlat(e,t,n,r,s,a){let o=n[r],l=n[r+1],c=n[r+2],h=n[r+3],d=s[a],u=s[a+1],f=s[a+2],g=s[a+3];return e[t]=o*g+h*d+l*f-c*u,e[t+1]=l*g+h*u+c*d-o*f,e[t+2]=c*g+h*f+o*u-l*d,e[t+3]=h*g-o*d-l*u-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,s=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(r/2),d=o(s/2),u=l(n/2),f=l(r/2),g=l(s/2);switch(a){case"XYZ":this._x=u*h*d+c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d-u*f*g;break;case"YXZ":this._x=u*h*d+c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d+u*f*g;break;case"ZXY":this._x=u*h*d-c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d-u*f*g;break;case"ZYX":this._x=u*h*d-c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d+u*f*g;break;case"YZX":this._x=u*h*d+c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d-u*f*g;break;case"XZY":this._x=u*h*d-c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d+u*f*g;break;default:qe("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],s=t[8],a=t[1],o=t[5],l=t[9],c=t[2],h=t[6],d=t[10],u=n+o+d;if(u>0){let f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(h-l)*f,this._y=(s-c)*f,this._z=(a-r)*f}else if(n>o&&n>d){let f=2*Math.sqrt(1+n-o-d);this._w=(h-l)/f,this._x=.25*f,this._y=(r+a)/f,this._z=(s+c)/f}else if(o>d){let f=2*Math.sqrt(1+o-n-d);this._w=(s-c)/f,this._x=(r+a)/f,this._y=.25*f,this._z=(l+h)/f}else{let f=2*Math.sqrt(1+d-n-o);this._w=(a-r)/f,this._x=(s+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(ut(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,s=e._z,a=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+a*o+r*c-s*l,this._y=r*h+a*l+s*o-n*c,this._z=s*h+a*c+n*l-r*o,this._w=a*h-n*o-r*l-s*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,s=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,r=-r,s=-s,a=-a,o=-o);let l=1-t;if(o<.9995){let c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+n*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},Zu=class Zu{constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Lp.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Lp.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6]*r,this.y=s[1]*t+s[4]*n+s[7]*r,this.z=s[2]*t+s[5]*n+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,s=e.elements,a=1/(s[3]*t+s[7]*n+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*n+s[8]*r+s[12])*a,this.y=(s[1]*t+s[5]*n+s[9]*r+s[13])*a,this.z=(s[2]*t+s[6]*n+s[10]*r+s[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,s=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*r-o*n),h=2*(o*t-s*r),d=2*(s*n-a*t);return this.x=t+l*c+a*d-o*h,this.y=n+l*h+o*c-s*d,this.z=r+l*d+s*h-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*r,this.y=s[1]*t+s[5]*n+s[9]*r,this.z=s[2]*t+s[6]*n+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=ut(this.x,e.x,t.x),this.y=ut(this.y,e.y,t.y),this.z=ut(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=ut(this.x,e,t),this.y=ut(this.y,e,t),this.z=ut(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ut(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,s=e.z,a=t.x,o=t.y,l=t.z;return this.x=r*l-s*o,this.y=s*a-n*l,this.z=n*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Kh.copy(this).projectOnVector(e),this.sub(Kh)}reflect(e){return this.sub(Kh.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(ut(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};Zu.prototype.isVector3=!0;var V=Zu,Kh=new V,Lp=new Ni,Ju=class Ju{constructor(e,t,n,r,s,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,s,a,o,l,c)}set(e,t,n,r,s,a,o,l,c){let h=this.elements;return h[0]=e,h[1]=r,h[2]=o,h[3]=t,h[4]=s,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,s=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],d=n[7],u=n[2],f=n[5],g=n[8],v=r[0],m=r[3],p=r[6],_=r[1],A=r[4],M=r[7],T=r[2],S=r[5],I=r[8];return s[0]=a*v+o*_+l*T,s[3]=a*m+o*A+l*S,s[6]=a*p+o*M+l*I,s[1]=c*v+h*_+d*T,s[4]=c*m+h*A+d*S,s[7]=c*p+h*M+d*I,s[2]=u*v+f*_+g*T,s[5]=u*m+f*A+g*S,s[8]=u*p+f*M+g*I,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-n*s*h+n*o*l+r*s*c-r*a*l}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],d=h*a-o*c,u=o*l-h*s,f=c*s-a*l,g=t*d+n*u+r*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let v=1/g;return e[0]=d*v,e[1]=(r*c-h*n)*v,e[2]=(o*n-r*a)*v,e[3]=u*v,e[4]=(h*t-r*l)*v,e[5]=(r*s-o*t)*v,e[6]=f*v,e[7]=(n*l-c*t)*v,e[8]=(a*t-n*s)*v,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,s,a,o){let l=Math.cos(s),c=Math.sin(s);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-r*c,r*l,-r*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return Qr("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Zh.makeScale(e,t)),this}rotate(e){return Qr("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Zh.makeRotation(-e)),this}translate(e,t){return Qr("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Zh.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let r=0;r<9;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}};Ju.prototype.isMatrix3=!0;var je=Ju,Zh=new je,Dp=new je().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Np=new je().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Nv(){let i={enabled:!0,workingColorSpace:Ia,spaces:{},convert:function(r,s,a){return this.enabled===!1||s===a||!s||!a||(this.spaces[s].transfer===yt&&(r.r=er(r.r),r.g=er(r.g),r.b=er(r.b)),this.spaces[s].primaries!==this.spaces[a].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===yt&&(r.r=Ds(r.r),r.g=Ds(r.g),r.b=Ds(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===ir?Pa:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,a){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Qr("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Qr("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[Ia]:{primaries:e,whitePoint:n,transfer:Pa,toXYZ:Dp,fromXYZ:Np,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:jn},outputColorSpaceConfig:{drawingBufferColorSpace:jn}},[jn]:{primaries:e,whitePoint:n,transfer:yt,toXYZ:Dp,fromXYZ:Np,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:jn}}}),i}var lt=Nv();function er(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Ds(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var Ms,Wl=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Ms===void 0&&(Ms=La("canvas")),Ms.width=e.width,Ms.height=e.height;let r=Ms.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),n=Ms}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=La("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),s=r.data;for(let a=0;a<s.length;a++)s[a]=er(s[a]/255)*255;return n.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(er(t[n]/255)*255):t[n]=er(t[n]);return{data:t,width:e.width,height:e.height}}else return qe("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Fv=0,Us=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Fv++}),this.uuid=po(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let a=0,o=r.length;a<o;a++)r[a].isDataTexture?s.push(Jh(r[a].image)):s.push(Jh(r[a]))}else s=Jh(r);n.url=s}return t||(e.images[this.uuid]=n),n}};function Jh(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Wl.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(qe("Texture: Unable to serialize Texture."),{})}var Uv=0,jh=new V,Vn=class i extends Di{constructor(e=i.DEFAULT_IMAGE,t=i.DEFAULT_MAPPING,n=zi,r=zi,s=Mn,a=Fr,o=li,l=ei,c=i.DEFAULT_ANISOTROPY,h=ir){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Uv++}),this.uuid=po(),this.name="",this.source=new Us(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=r,this.magFilter=s,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Le(0,0),this.repeat=new Le(1,1),this.center=new Le(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new je,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(jh).x}get height(){return this.source.getSize(jh).y}get depth(){return this.source.getSize(jh).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){qe(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){qe(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Pu)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Ol:e.x=e.x-Math.floor(e.x);break;case zi:e.x=e.x<0?0:1;break;case Vl:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Ol:e.y=e.y-Math.floor(e.y);break;case zi:e.y=e.y<0?0:1;break;case Vl:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Vn.DEFAULT_IMAGE=null;Vn.DEFAULT_MAPPING=Pu;Vn.DEFAULT_ANISOTROPY=1;var ju=class ju{constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,s=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r+a[12]*s,this.y=a[1]*t+a[5]*n+a[9]*r+a[13]*s,this.z=a[2]*t+a[6]*n+a[10]*r+a[14]*s,this.w=a[3]*t+a[7]*n+a[11]*r+a[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,s,l=e.elements,c=l[0],h=l[4],d=l[8],u=l[1],f=l[5],g=l[9],v=l[2],m=l[6],p=l[10];if(Math.abs(h-u)<.01&&Math.abs(d-v)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+u)<.1&&Math.abs(d+v)<.1&&Math.abs(g+m)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let A=(c+1)/2,M=(f+1)/2,T=(p+1)/2,S=(h+u)/4,I=(d+v)/4,b=(g+m)/4;return A>M&&A>T?A<.01?(n=0,r=.707106781,s=.707106781):(n=Math.sqrt(A),r=S/n,s=I/n):M>T?M<.01?(n=.707106781,r=0,s=.707106781):(r=Math.sqrt(M),n=S/r,s=b/r):T<.01?(n=.707106781,r=.707106781,s=0):(s=Math.sqrt(T),n=I/s,r=b/s),this.set(n,r,s,t),this}let _=Math.sqrt((m-g)*(m-g)+(d-v)*(d-v)+(u-h)*(u-h));return Math.abs(_)<.001&&(_=1),this.x=(m-g)/_,this.y=(d-v)/_,this.z=(u-h)/_,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=ut(this.x,e.x,t.x),this.y=ut(this.y,e.y,t.y),this.z=ut(this.z,e.z,t.z),this.w=ut(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=ut(this.x,e,t),this.y=ut(this.y,e,t),this.z=ut(this.z,e,t),this.w=ut(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ut(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};ju.prototype.isVector4=!0;var qt=ju,ql=class extends Di{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Mn,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new qt(0,0,e,t),this.scissorTest=!1,this.viewport=new qt(0,0,e,t),this.textures=[];let r={width:e,height:t,depth:n.depth},s=new Vn(r),a=n.count;for(let o=0;o<a;o++)this.textures[o]=s.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:Mn,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let r=Object.assign({},e.textures[t].image);this.textures[t].source=new Us(r)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},on=class extends ql{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Da=class extends Vn{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=bn,this.minFilter=bn,this.wrapR=zi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var Xl=class extends Vn{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=bn,this.minFilter=bn,this.wrapR=zi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}};var _c=class _c{constructor(e,t,n,r,s,a,o,l,c,h,d,u,f,g,v,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,s,a,o,l,c,h,d,u,f,g,v,m)}set(e,t,n,r,s,a,o,l,c,h,d,u,f,g,v,m){let p=this.elements;return p[0]=e,p[4]=t,p[8]=n,p[12]=r,p[1]=s,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=h,p[10]=d,p[14]=u,p[3]=f,p[7]=g,p[11]=v,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new _c().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,r=1/Ss.setFromMatrixColumn(e,0).length(),s=1/Ss.setFromMatrixColumn(e,1).length(),a=1/Ss.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*s,t[5]=n[5]*s,t[6]=n[6]*s,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,s=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(r),c=Math.sin(r),h=Math.cos(s),d=Math.sin(s);if(e.order==="XYZ"){let u=a*h,f=a*d,g=o*h,v=o*d;t[0]=l*h,t[4]=-l*d,t[8]=c,t[1]=f+g*c,t[5]=u-v*c,t[9]=-o*l,t[2]=v-u*c,t[6]=g+f*c,t[10]=a*l}else if(e.order==="YXZ"){let u=l*h,f=l*d,g=c*h,v=c*d;t[0]=u+v*o,t[4]=g*o-f,t[8]=a*c,t[1]=a*d,t[5]=a*h,t[9]=-o,t[2]=f*o-g,t[6]=v+u*o,t[10]=a*l}else if(e.order==="ZXY"){let u=l*h,f=l*d,g=c*h,v=c*d;t[0]=u-v*o,t[4]=-a*d,t[8]=g+f*o,t[1]=f+g*o,t[5]=a*h,t[9]=v-u*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){let u=a*h,f=a*d,g=o*h,v=o*d;t[0]=l*h,t[4]=g*c-f,t[8]=u*c+v,t[1]=l*d,t[5]=v*c+u,t[9]=f*c-g,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){let u=a*l,f=a*c,g=o*l,v=o*c;t[0]=l*h,t[4]=v-u*d,t[8]=g*d+f,t[1]=d,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=f*d+g,t[10]=u-v*d}else if(e.order==="XZY"){let u=a*l,f=a*c,g=o*l,v=o*c;t[0]=l*h,t[4]=-d,t[8]=c*h,t[1]=u*d+v,t[5]=a*h,t[9]=f*d-g,t[2]=g*d-f,t[6]=o*h,t[10]=v*d+u}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Bv,e,Ov)}lookAt(e,t,n){let r=this.elements;return Zn.subVectors(e,t),Zn.lengthSq()===0&&(Zn.z=1),Zn.normalize(),Mr.crossVectors(n,Zn),Mr.lengthSq()===0&&(Math.abs(n.z)===1?Zn.x+=1e-4:Zn.z+=1e-4,Zn.normalize(),Mr.crossVectors(n,Zn)),Mr.normalize(),ll.crossVectors(Zn,Mr),r[0]=Mr.x,r[4]=ll.x,r[8]=Zn.x,r[1]=Mr.y,r[5]=ll.y,r[9]=Zn.y,r[2]=Mr.z,r[6]=ll.z,r[10]=Zn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,s=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],d=n[5],u=n[9],f=n[13],g=n[2],v=n[6],m=n[10],p=n[14],_=n[3],A=n[7],M=n[11],T=n[15],S=r[0],I=r[4],b=r[8],R=r[12],L=r[1],N=r[5],U=r[9],W=r[13],F=r[2],q=r[6],Z=r[10],J=r[14],re=r[3],Q=r[7],ne=r[11],se=r[15];return s[0]=a*S+o*L+l*F+c*re,s[4]=a*I+o*N+l*q+c*Q,s[8]=a*b+o*U+l*Z+c*ne,s[12]=a*R+o*W+l*J+c*se,s[1]=h*S+d*L+u*F+f*re,s[5]=h*I+d*N+u*q+f*Q,s[9]=h*b+d*U+u*Z+f*ne,s[13]=h*R+d*W+u*J+f*se,s[2]=g*S+v*L+m*F+p*re,s[6]=g*I+v*N+m*q+p*Q,s[10]=g*b+v*U+m*Z+p*ne,s[14]=g*R+v*W+m*J+p*se,s[3]=_*S+A*L+M*F+T*re,s[7]=_*I+A*N+M*q+T*Q,s[11]=_*b+A*U+M*Z+T*ne,s[15]=_*R+A*W+M*J+T*se,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],s=e[12],a=e[1],o=e[5],l=e[9],c=e[13],h=e[2],d=e[6],u=e[10],f=e[14],g=e[3],v=e[7],m=e[11],p=e[15],_=l*f-c*u,A=o*f-c*d,M=o*u-l*d,T=a*f-c*h,S=a*u-l*h,I=a*d-o*h;return t*(v*_-m*A+p*M)-n*(g*_-m*T+p*S)+r*(g*A-v*T+p*I)-s*(g*M-v*S+m*I)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],r=e[8],s=e[1],a=e[5],o=e[9],l=e[2],c=e[6],h=e[10];return t*(a*h-o*c)-n*(s*h-o*l)+r*(s*c-a*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],d=e[9],u=e[10],f=e[11],g=e[12],v=e[13],m=e[14],p=e[15],_=t*o-n*a,A=t*l-r*a,M=t*c-s*a,T=n*l-r*o,S=n*c-s*o,I=r*c-s*l,b=h*v-d*g,R=h*m-u*g,L=h*p-f*g,N=d*m-u*v,U=d*p-f*v,W=u*p-f*m,F=_*W-A*U+M*N+T*L-S*R+I*b;if(F===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let q=1/F;return e[0]=(o*W-l*U+c*N)*q,e[1]=(r*U-n*W-s*N)*q,e[2]=(v*I-m*S+p*T)*q,e[3]=(u*S-d*I-f*T)*q,e[4]=(l*L-a*W-c*R)*q,e[5]=(t*W-r*L+s*R)*q,e[6]=(m*M-g*I-p*A)*q,e[7]=(h*I-u*M+f*A)*q,e[8]=(a*U-o*L+c*b)*q,e[9]=(n*L-t*U-s*b)*q,e[10]=(g*S-v*M+p*_)*q,e[11]=(d*M-h*S-f*_)*q,e[12]=(o*R-a*N-l*b)*q,e[13]=(t*N-n*R+r*b)*q,e[14]=(v*A-g*T-m*_)*q,e[15]=(h*T-d*A+u*_)*q,this}scale(e){let t=this.elements,n=e.x,r=e.y,s=e.z;return t[0]*=n,t[4]*=r,t[8]*=s,t[1]*=n,t[5]*=r,t[9]*=s,t[2]*=n,t[6]*=r,t[10]*=s,t[3]*=n,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),s=1-n,a=e.x,o=e.y,l=e.z,c=s*a,h=s*o;return this.set(c*a+n,c*o-r*l,c*l+r*o,0,c*o+r*l,h*o+n,h*l-r*a,0,c*l-r*o,h*l+r*a,s*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,s,a){return this.set(1,n,s,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,s=t._x,a=t._y,o=t._z,l=t._w,c=s+s,h=a+a,d=o+o,u=s*c,f=s*h,g=s*d,v=a*h,m=a*d,p=o*d,_=l*c,A=l*h,M=l*d,T=n.x,S=n.y,I=n.z;return r[0]=(1-(v+p))*T,r[1]=(f+M)*T,r[2]=(g-A)*T,r[3]=0,r[4]=(f-M)*S,r[5]=(1-(u+p))*S,r[6]=(m+_)*S,r[7]=0,r[8]=(g+A)*I,r[9]=(m-_)*I,r[10]=(1-(u+v))*I,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let s=this.determinantAffine();if(s===0)return n.set(1,1,1),t.identity(),this;let a=Ss.set(r[0],r[1],r[2]).length(),o=Ss.set(r[4],r[5],r[6]).length(),l=Ss.set(r[8],r[9],r[10]).length();s<0&&(a=-a),di.copy(this);let c=1/a,h=1/o,d=1/l;return di.elements[0]*=c,di.elements[1]*=c,di.elements[2]*=c,di.elements[4]*=h,di.elements[5]*=h,di.elements[6]*=h,di.elements[8]*=d,di.elements[9]*=d,di.elements[10]*=d,t.setFromRotationMatrix(di),n.x=a,n.y=o,n.z=l,this}makePerspective(e,t,n,r,s,a,o=gi,l=!1){let c=this.elements,h=2*s/(t-e),d=2*s/(n-r),u=(t+e)/(t-e),f=(n+r)/(n-r),g,v;if(l)g=s/(a-s),v=a*s/(a-s);else if(o===gi)g=-(a+s)/(a-s),v=-2*a*s/(a-s);else if(o===za)g=-a/(a-s),v=-a*s/(a-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=d,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=v,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,s,a,o=gi,l=!1){let c=this.elements,h=2/(t-e),d=2/(n-r),u=-(t+e)/(t-e),f=-(n+r)/(n-r),g,v;if(l)g=1/(a-s),v=a/(a-s);else if(o===gi)g=-2/(a-s),v=-(a+s)/(a-s);else if(o===za)g=-1/(a-s),v=-s/(a-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=d,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=g,c[14]=v,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let r=0;r<16;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}};_c.prototype.isMatrix4=!0;var It=_c,Ss=new V,di=new It,Bv=new V(0,0,0),Ov=new V(1,1,1),Mr=new V,ll=new V,Zn=new V,Fp=new It,Up=new Ni,Cr=class i{constructor(e=0,t=0,n=0,r=i.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,s=r[0],a=r[4],o=r[8],l=r[1],c=r[5],h=r[9],d=r[2],u=r[6],f=r[10];switch(t){case"XYZ":this._y=Math.asin(ut(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,s)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-ut(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,s),this._z=0);break;case"ZXY":this._x=Math.asin(ut(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-ut(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,f),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(ut(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-d,s)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-ut(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-h,f),this._y=0);break;default:qe("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Fp.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Fp,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Up.setFromEuler(this),this.setFromQuaternion(Up,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Cr.DEFAULT_ORDER="XYZ";var Na=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},Vv=0,Bp=new V,ws=new Ni,Yi=new It,cl=new V,Sa=new V,Hv=new V,Gv=new Ni,Op=new V(1,0,0),Vp=new V(0,1,0),Hp=new V(0,0,1),Gp={type:"added"},Wv={type:"removed"},Ts={type:"childadded",child:null},Qh={type:"childremoved",child:null},Hn=class i extends Di{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Vv++}),this.uuid=po(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let e=new V,t=new Cr,n=new Ni,r=new V(1,1,1);function s(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(s),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new It},normalMatrix:{value:new je}}),this.matrix=new It,this.matrixWorld=new It,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Na,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return ws.setFromAxisAngle(e,t),this.quaternion.multiply(ws),this}rotateOnWorldAxis(e,t){return ws.setFromAxisAngle(e,t),this.quaternion.premultiply(ws),this}rotateX(e){return this.rotateOnAxis(Op,e)}rotateY(e){return this.rotateOnAxis(Vp,e)}rotateZ(e){return this.rotateOnAxis(Hp,e)}translateOnAxis(e,t){return Bp.copy(e).applyQuaternion(this.quaternion),this.position.add(Bp.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Op,e)}translateY(e){return this.translateOnAxis(Vp,e)}translateZ(e){return this.translateOnAxis(Hp,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Yi.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?cl.copy(e):cl.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),Sa.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Yi.lookAt(Sa,cl,this.up):Yi.lookAt(cl,Sa,this.up),this.quaternion.setFromRotationMatrix(Yi),r&&(Yi.extractRotation(r.matrixWorld),ws.setFromRotationMatrix(Yi),this.quaternion.premultiply(ws.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ye("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Gp),Ts.child=e,this.dispatchEvent(Ts),Ts.child=null):Ye("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Wv),Qh.child=e,this.dispatchEvent(Qh),Qh.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Yi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Yi.multiply(e.parent.matrixWorld)),e.applyMatrix4(Yi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Gp),Ts.child=e,this.dispatchEvent(Ts),Ts.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let s=0,a=r.length;s<a;s++)r[s].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Sa,e,Hv),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Sa,Gv,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*n-s[8]*r,s[13]+=n-s[1]*t-s[5]*n-s[9]*r,s[14]+=r-s[2]*t-s[6]*n-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let s=this.children;for(let a=0,o=s.length;a<o;a++)s[a].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,r.name=this.name,r.castShadow=this.castShadow,r.receiveShadow=this.receiveShadow,r.visible=this.visible,r.frustumCulled=this.frustumCulled,r.renderOrder=this.renderOrder,r.static=this.static,r.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(o=>({...o})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let d=l[c];s(e.shapes,d)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(e.materials,this.material[l]));r.material=o}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let o=0;o<this.children.length;o++)r.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];r.animations.push(s(e.animations,l))}}if(t){let o=a(e.geometries),l=a(e.materials),c=a(e.textures),h=a(e.images),d=a(e.shapes),u=a(e.skeletons),f=a(e.animations),g=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),u.length>0&&(n.skeletons=u),f.length>0&&(n.animations=f),g.length>0&&(n.nodes=g)}return n.object=r,n;function a(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let r=e.children[n];this.add(r.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Hn.DEFAULT_UP=new V(0,1,0);Hn.DEFAULT_MATRIX_AUTO_UPDATE=!0;Hn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Qi=class extends Hn{constructor(){super(),this.isGroup=!0,this.type="Group"}},qv={type:"move"},Bs=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Qi,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Qi,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new V,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new V),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Qi,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new V,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new V,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,s=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(let v of e.hand.values()){let m=t.getJointPose(v,n),p=this._getHandJoint(c,v);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}let h=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],u=h.position.distanceTo(d.position),f=.02,g=.005;c.inputState.pinching&&u>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&u<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,n),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&s!==null&&(r=s),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(qv)))}return o!==null&&(o.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Qi;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},qm={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Sr={h:0,s:0,l:0},hl={h:0,s:0,l:0};function eu(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}var tt=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=jn){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,lt.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=lt.workingColorSpace){return this.r=e,this.g=t,this.b=n,lt.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=lt.workingColorSpace){if(e=Dv(e,1),t=ut(t,0,1),n=ut(n,0,1),t===0)this.r=this.g=this.b=n;else{let s=n<=.5?n*(1+t):n+t-n*t,a=2*n-s;this.r=eu(a,s,e+1/3),this.g=eu(a,s,e),this.b=eu(a,s,e-1/3)}return lt.colorSpaceToWorking(this,r),this}setStyle(e,t=jn){function n(s){s!==void 0&&parseFloat(s)<1&&qe("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,a=r[1],o=r[2];switch(a){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:qe("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],a=s.length;if(a===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(s,16),t);qe("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=jn){let n=qm[e.toLowerCase()];return n!==void 0?this.setHex(n,t):qe("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=er(e.r),this.g=er(e.g),this.b=er(e.b),this}copyLinearToSRGB(e){return this.r=Ds(e.r),this.g=Ds(e.g),this.b=Ds(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=jn){return lt.workingToColorSpace(Cn.copy(this),e),Math.round(ut(Cn.r*255,0,255))*65536+Math.round(ut(Cn.g*255,0,255))*256+Math.round(ut(Cn.b*255,0,255))}getHexString(e=jn){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=lt.workingColorSpace){lt.workingToColorSpace(Cn.copy(this),t);let n=Cn.r,r=Cn.g,s=Cn.b,a=Math.max(n,r,s),o=Math.min(n,r,s),l,c,h=(o+a)/2;if(o===a)l=0,c=0;else{let d=a-o;switch(c=h<=.5?d/(a+o):d/(2-a-o),a){case n:l=(r-s)/d+(r<s?6:0);break;case r:l=(s-n)/d+2;break;case s:l=(n-r)/d+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=lt.workingColorSpace){return lt.workingToColorSpace(Cn.copy(this),t),e.r=Cn.r,e.g=Cn.g,e.b=Cn.b,e}getStyle(e=jn){lt.workingToColorSpace(Cn.copy(this),e);let t=Cn.r,n=Cn.g,r=Cn.b;return e!==jn?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`}offsetHSL(e,t,n){return this.getHSL(Sr),this.setHSL(Sr.h+e,Sr.s+t,Sr.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Sr),e.getHSL(hl);let n=Yh(Sr.h,hl.h,t),r=Yh(Sr.s,hl.s,t),s=Yh(Sr.l,hl.l,t);return this.setHSL(n,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*n+s[6]*r,this.g=s[1]*t+s[4]*n+s[7]*r,this.b=s[2]*t+s[5]*n+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Cn=new tt;tt.NAMES=qm;var Fa=class extends Hn{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Cr,this.environmentIntensity=1,this.environmentRotation=new Cr,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},fi=new V,Ki=new V,tu=new V,Zi=new V,As=new V,Es=new V,Wp=new V,nu=new V,iu=new V,ru=new V,su=new qt,au=new qt,ou=new qt,Er=class i{constructor(e=new V,t=new V,n=new V){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),fi.subVectors(e,t),r.cross(fi);let s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,n,r,s){fi.subVectors(r,t),Ki.subVectors(n,t),tu.subVectors(e,t);let a=fi.dot(fi),o=fi.dot(Ki),l=fi.dot(tu),c=Ki.dot(Ki),h=Ki.dot(tu),d=a*c-o*o;if(d===0)return s.set(0,0,0),null;let u=1/d,f=(c*l-o*h)*u,g=(a*h-o*l)*u;return s.set(1-f-g,g,f)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,Zi)===null?!1:Zi.x>=0&&Zi.y>=0&&Zi.x+Zi.y<=1}static getInterpolation(e,t,n,r,s,a,o,l){return this.getBarycoord(e,t,n,r,Zi)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Zi.x),l.addScaledVector(a,Zi.y),l.addScaledVector(o,Zi.z),l)}static getInterpolatedAttribute(e,t,n,r,s,a){return su.setScalar(0),au.setScalar(0),ou.setScalar(0),su.fromBufferAttribute(e,t),au.fromBufferAttribute(e,n),ou.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(su,s.x),a.addScaledVector(au,s.y),a.addScaledVector(ou,s.z),a}static isFrontFacing(e,t,n,r){return fi.subVectors(n,t),Ki.subVectors(e,t),fi.cross(Ki).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return fi.subVectors(this.c,this.b),Ki.subVectors(this.a,this.b),fi.cross(Ki).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return i.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return i.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,r,s){return i.getInterpolation(e,this.a,this.b,this.c,t,n,r,s)}containsPoint(e){return i.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return i.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,s=this.c,a,o;As.subVectors(r,n),Es.subVectors(s,n),nu.subVectors(e,n);let l=As.dot(nu),c=Es.dot(nu);if(l<=0&&c<=0)return t.copy(n);iu.subVectors(e,r);let h=As.dot(iu),d=Es.dot(iu);if(h>=0&&d<=h)return t.copy(r);let u=l*d-h*c;if(u<=0&&l>=0&&h<=0)return a=l/(l-h),t.copy(n).addScaledVector(As,a);ru.subVectors(e,s);let f=As.dot(ru),g=Es.dot(ru);if(g>=0&&f<=g)return t.copy(s);let v=f*c-l*g;if(v<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(n).addScaledVector(Es,o);let m=h*g-f*d;if(m<=0&&d-h>=0&&f-g>=0)return Wp.subVectors(s,r),o=(d-h)/(d-h+(f-g)),t.copy(r).addScaledVector(Wp,o);let p=1/(m+v+u);return a=v*p,o=u*p,t.copy(n).addScaledVector(As,a).addScaledVector(Es,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Rr=class{constructor(e=new V(1/0,1/0,1/0),t=new V(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(pi.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(pi.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=pi.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let s=n.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=s.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,pi):pi.fromBufferAttribute(s,a),pi.applyMatrix4(e.matrixWorld),this.expandByPoint(pi);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ul.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ul.copy(n.boundingBox)),ul.applyMatrix4(e.matrixWorld),this.union(ul)}let r=e.children;for(let s=0,a=r.length;s<a;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,pi),pi.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(wa),dl.subVectors(this.max,wa),Cs.subVectors(e.a,wa),Rs.subVectors(e.b,wa),ks.subVectors(e.c,wa),wr.subVectors(Rs,Cs),Tr.subVectors(ks,Rs),Kr.subVectors(Cs,ks);let t=[0,-wr.z,wr.y,0,-Tr.z,Tr.y,0,-Kr.z,Kr.y,wr.z,0,-wr.x,Tr.z,0,-Tr.x,Kr.z,0,-Kr.x,-wr.y,wr.x,0,-Tr.y,Tr.x,0,-Kr.y,Kr.x,0];return!lu(t,Cs,Rs,ks,dl)||(t=[1,0,0,0,1,0,0,0,1],!lu(t,Cs,Rs,ks,dl))?!1:(fl.crossVectors(wr,Tr),t=[fl.x,fl.y,fl.z],lu(t,Cs,Rs,ks,dl))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,pi).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(pi).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Ji[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Ji[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Ji[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Ji[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Ji[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Ji[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Ji[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Ji[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Ji),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Ji=[new V,new V,new V,new V,new V,new V,new V,new V],pi=new V,ul=new Rr,Cs=new V,Rs=new V,ks=new V,wr=new V,Tr=new V,Kr=new V,wa=new V,dl=new V,fl=new V,Zr=new V;function lu(i,e,t,n,r){for(let s=0,a=i.length-3;s<=a;s+=3){Zr.fromArray(i,s);let o=r.x*Math.abs(Zr.x)+r.y*Math.abs(Zr.y)+r.z*Math.abs(Zr.z),l=e.dot(Zr),c=t.dot(Zr),h=n.dot(Zr);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var rn=new V,pl=new Le,Xv=0,sn=class extends Di{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Xv++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Om,this.updateRanges=[],this.gpuType=yi,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)pl.fromBufferAttribute(this,t),pl.applyMatrix3(e),this.setXY(t,pl.x,pl.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)rn.fromBufferAttribute(this,t),rn.applyMatrix3(e),this.setXYZ(t,rn.x,rn.y,rn.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)rn.fromBufferAttribute(this,t),rn.applyMatrix4(e),this.setXYZ(t,rn.x,rn.y,rn.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)rn.fromBufferAttribute(this,t),rn.applyNormalMatrix(e),this.setXYZ(t,rn.x,rn.y,rn.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)rn.fromBufferAttribute(this,t),rn.transformDirection(e),this.setXYZ(t,rn.x,rn.y,rn.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Ma(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=On(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Ma(t,this.array)),t}setX(e,t){return this.normalized&&(t=On(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Ma(t,this.array)),t}setY(e,t){return this.normalized&&(t=On(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Ma(t,this.array)),t}setZ(e,t){return this.normalized&&(t=On(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Ma(t,this.array)),t}setW(e,t){return this.normalized&&(t=On(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=On(t,this.array),n=On(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=On(t,this.array),n=On(n,this.array),r=On(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,s){return e*=this.itemSize,this.normalized&&(t=On(t,this.array),n=On(n,this.array),r=On(r,this.array),s=On(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}};var Ua=class extends sn{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var Ba=class extends sn{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var an=class extends sn{constructor(e,t,n){super(new Float32Array(e),t,n)}},$v=new Rr,Ta=new V,cu=new V,kr=class{constructor(e=new V,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):$v.setFromPoints(e).getCenter(n);let r=0;for(let s=0,a=e.length;s<a;s++)r=Math.max(r,n.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ta.subVectors(e,this.center);let t=Ta.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),r=(n-this.radius)*.5;this.center.addScaledVector(Ta,r/n),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(cu.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ta.copy(e.center).add(cu)),this.expandByPoint(Ta.copy(e.center).sub(cu))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},Yv=0,si=new It,hu=new Hn,Is=new V,Jn=new Rr,Aa=new Rr,yn=new V,_n=class i extends Di{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Yv++}),this.uuid=po(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(zv(e)?Ba:Ua)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let s=new je().getNormalMatrix(e);n.applyNormalMatrix(s),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return si.makeRotationFromQuaternion(e),this.applyMatrix4(si),this}rotateX(e){return si.makeRotationX(e),this.applyMatrix4(si),this}rotateY(e){return si.makeRotationY(e),this.applyMatrix4(si),this}rotateZ(e){return si.makeRotationZ(e),this.applyMatrix4(si),this}translate(e,t,n){return si.makeTranslation(e,t,n),this.applyMatrix4(si),this}scale(e,t,n){return si.makeScale(e,t,n),this.applyMatrix4(si),this}lookAt(e){return hu.lookAt(e),hu.updateMatrix(),this.applyMatrix4(hu.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Is).negate(),this.translate(Is.x,Is.y,Is.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let r=0,s=e.length;r<s;r++){let a=e[r];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new an(n,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let s=e[r];t.setXYZ(r,s.x,s.y,s.z||0)}e.length>t.count&&qe("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Rr);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ye("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new V(-1/0,-1/0,-1/0),new V(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,r=t.length;n<r;n++){let s=t[n];Jn.setFromBufferAttribute(s),this.morphTargetsRelative?(yn.addVectors(this.boundingBox.min,Jn.min),this.boundingBox.expandByPoint(yn),yn.addVectors(this.boundingBox.max,Jn.max),this.boundingBox.expandByPoint(yn)):(this.boundingBox.expandByPoint(Jn.min),this.boundingBox.expandByPoint(Jn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ye('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new kr);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ye("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new V,1/0);return}if(e){let n=this.boundingSphere.center;if(Jn.setFromBufferAttribute(e),t)for(let s=0,a=t.length;s<a;s++){let o=t[s];Aa.setFromBufferAttribute(o),this.morphTargetsRelative?(yn.addVectors(Jn.min,Aa.min),Jn.expandByPoint(yn),yn.addVectors(Jn.max,Aa.max),Jn.expandByPoint(yn)):(Jn.expandByPoint(Aa.min),Jn.expandByPoint(Aa.max))}Jn.getCenter(n);let r=0;for(let s=0,a=e.count;s<a;s++)yn.fromBufferAttribute(e,s),r=Math.max(r,n.distanceToSquared(yn));if(t)for(let s=0,a=t.length;s<a;s++){let o=t[s],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)yn.fromBufferAttribute(o,c),l&&(Is.fromBufferAttribute(e,c),yn.add(Is)),r=Math.max(r,n.distanceToSquared(yn))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&Ye('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ye("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=t.position,r=t.normal,s=t.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new sn(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));let o=[],l=[];for(let b=0;b<n.count;b++)o[b]=new V,l[b]=new V;let c=new V,h=new V,d=new V,u=new Le,f=new Le,g=new Le,v=new V,m=new V;function p(b,R,L){c.fromBufferAttribute(n,b),h.fromBufferAttribute(n,R),d.fromBufferAttribute(n,L),u.fromBufferAttribute(s,b),f.fromBufferAttribute(s,R),g.fromBufferAttribute(s,L),h.sub(c),d.sub(c),f.sub(u),g.sub(u);let N=1/(f.x*g.y-g.x*f.y);isFinite(N)&&(v.copy(h).multiplyScalar(g.y).addScaledVector(d,-f.y).multiplyScalar(N),m.copy(d).multiplyScalar(f.x).addScaledVector(h,-g.x).multiplyScalar(N),o[b].add(v),o[R].add(v),o[L].add(v),l[b].add(m),l[R].add(m),l[L].add(m))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let b=0,R=_.length;b<R;++b){let L=_[b],N=L.start,U=L.count;for(let W=N,F=N+U;W<F;W+=3)p(e.getX(W+0),e.getX(W+1),e.getX(W+2))}let A=new V,M=new V,T=new V,S=new V;function I(b){T.fromBufferAttribute(r,b),S.copy(T);let R=o[b];A.copy(R),A.sub(T.multiplyScalar(T.dot(R))).normalize(),M.crossVectors(S,R);let N=M.dot(l[b])<0?-1:1;a.setXYZW(b,A.x,A.y,A.z,N)}for(let b=0,R=_.length;b<R;++b){let L=_[b],N=L.start,U=L.count;for(let W=N,F=N+U;W<F;W+=3)I(e.getX(W+0)),I(e.getX(W+1)),I(e.getX(W+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new sn(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let u=0,f=n.count;u<f;u++)n.setXYZ(u,0,0,0);let r=new V,s=new V,a=new V,o=new V,l=new V,c=new V,h=new V,d=new V;if(e)for(let u=0,f=e.count;u<f;u+=3){let g=e.getX(u+0),v=e.getX(u+1),m=e.getX(u+2);r.fromBufferAttribute(t,g),s.fromBufferAttribute(t,v),a.fromBufferAttribute(t,m),h.subVectors(a,s),d.subVectors(r,s),h.cross(d),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,v),c.fromBufferAttribute(n,m),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(v,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let u=0,f=t.count;u<f;u+=3)r.fromBufferAttribute(t,u+0),s.fromBufferAttribute(t,u+1),a.fromBufferAttribute(t,u+2),h.subVectors(a,s),d.subVectors(r,s),h.cross(d),n.setXYZ(u+0,h.x,h.y,h.z),n.setXYZ(u+1,h.x,h.y,h.z),n.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)yn.fromBufferAttribute(e,t),yn.normalize(),e.setXYZ(t,yn.x,yn.y,yn.z)}toNonIndexed(){function e(o,l){let c=o.array,h=o.itemSize,d=o.normalized,u=new c.constructor(l.length*h),f=0,g=0;for(let v=0,m=l.length;v<m;v++){o.isInterleavedBufferAttribute?f=l[v]*o.data.stride+o.offset:f=l[v]*h;for(let p=0;p<h;p++)u[g++]=c[f++]}return new sn(u,h,d)}if(this.index===null)return qe("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new i,n=this.index.array,r=this.attributes;for(let o in r){let l=r[o],c=e(l,n);t.setAttribute(o,c)}let s=this.morphAttributes;for(let o in s){let l=[],c=s[o];for(let h=0,d=c.length;h<d;h++){let u=c[h],f=e(u,n);l.push(f)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let c=n[l];e.data.attributes[l]=c.toJSON(e.data)}let r={},s=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let d=0,u=c.length;d<u;d++){let f=c[d];h.push(f.toJSON(e.data))}h.length>0&&(r[l]=h,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let c in r){let h=r[c];this.setAttribute(c,h.clone(t))}let s=e.morphAttributes;for(let c in s){let h=[],d=s[c];for(let u=0,f=d.length;u<f;u++)h.push(d[u].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let c=0,h=a.length;c<h;c++){let d=a[c];this.addGroup(d.start,d.count,d.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var uu=new V,Kv=new V,Zv=new je,mi=class{constructor(e=new V(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=uu.subVectors(n,t).cross(Kv.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(uu),s=this.normal.dot(r);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/s;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Zv.getNormalMatrix(e),r=this.coplanarPoint(uu).applyMatrix4(e),s=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},Jv=0,tr=class extends Di{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Jv++}),this.uuid=po(),this.name="",this.type="Material",this.blending=qs,this.side=Dr,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Ru,this.blendDst=ku,this.blendEquation=ns,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new tt(0,0,0),this.blendAlpha=0,this.depthFunc=Ns,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=zm,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Pl,this.stencilZFail=Pl,this.stencilZPass=Pl,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){qe(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){qe(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(n):r&&r.isVector2&&n&&n.isVector2||r&&r.isEuler&&n&&n.isEuler||r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(s=>s.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(s){let a=[];for(let o in s){let l=s[o];delete l.metadata,a.push(l)}return a}if(t){let s=r(e.textures),a=r(e.images);s.length>0&&(n.textures=s),a.length>0&&(n.images=a)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new tt().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(n=>new mi().fromJSON(n))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new Le().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Le().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let r=t.length;n=new Array(r);for(let s=0;s!==r;++s)n[s]=t[s].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var ji=new V,du=new V,ml=new V,gl=new V,Os=class{constructor(e=new V,t=new V(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,ji)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=ji.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(ji.copy(this.origin).addScaledVector(this.direction,t),ji.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){du.copy(e).add(t).multiplyScalar(.5),ml.copy(t).sub(e).normalize(),gl.copy(this.origin).sub(du);let s=e.distanceTo(t)*.5,a=-this.direction.dot(ml),o=gl.dot(this.direction),l=-gl.dot(ml),c=gl.lengthSq(),h=Math.abs(1-a*a),d,u,f,g;if(h>0)if(d=a*l-o,u=a*o-l,g=s*h,d>=0)if(u>=-g)if(u<=g){let v=1/h;d*=v,u*=v,f=d*(d+a*u+2*o)+u*(a*d+u+2*l)+c}else u=s,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;else u=-s,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;else u<=-g?(d=Math.max(0,-(-a*s+o)),u=d>0?-s:Math.min(Math.max(-s,-l),s),f=-d*d+u*(u+2*l)+c):u<=g?(d=0,u=Math.min(Math.max(-s,-l),s),f=u*(u+2*l)+c):(d=Math.max(0,-(a*s+o)),u=d>0?s:Math.min(Math.max(-s,-l),s),f=-d*d+u*(u+2*l)+c);else u=a>0?-s:s,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,d),r&&r.copy(du).addScaledVector(ml,u),f}intersectSphere(e,t){if(e.radius<0)return null;ji.subVectors(e.center,this.origin);let n=ji.dot(this.direction),r=ji.dot(ji)-n*n,s=e.radius*e.radius;if(r>s)return null;let a=Math.sqrt(s-r),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,s,a,o,l,c=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,u=this.origin;return c>=0?(n=(e.min.x-u.x)*c,r=(e.max.x-u.x)*c):(n=(e.max.x-u.x)*c,r=(e.min.x-u.x)*c),h>=0?(s=(e.min.y-u.y)*h,a=(e.max.y-u.y)*h):(s=(e.max.y-u.y)*h,a=(e.min.y-u.y)*h),n>a||s>r||((s>n||isNaN(n))&&(n=s),(a<r||isNaN(r))&&(r=a),d>=0?(o=(e.min.z-u.z)*d,l=(e.max.z-u.z)*d):(o=(e.max.z-u.z)*d,l=(e.min.z-u.z)*d),n>l||o>r)||((o>n||n!==n)&&(n=o),(l<r||r!==r)&&(r=l),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,ji)!==null}intersectTriangle(e,t,n,r,s){let a=this.origin,o=this.direction,l=o.x,c=o.y,h=o.z,d=e.x-a.x,u=e.y-a.y,f=e.z-a.z,g=t.x-a.x,v=t.y-a.y,m=t.z-a.z,p=n.x-a.x,_=n.y-a.y,A=n.z-a.z,M=Math.abs(l),T=Math.abs(c),S=Math.abs(h),I,b,R,L,N,U,W,F,q,Z,J,re;if(M>=T&&M>=S?(R=l,U=d,q=g,re=p,l>=0?(I=c,b=h,L=u,N=f,W=v,F=m,Z=_,J=A):(I=h,b=c,L=f,N=u,W=m,F=v,Z=A,J=_)):T>=S?(R=c,U=u,q=v,re=_,c>=0?(I=h,b=l,L=f,N=d,W=m,F=g,Z=A,J=p):(I=l,b=h,L=d,N=f,W=g,F=m,Z=p,J=A)):(R=h,U=f,q=m,re=A,h>=0?(I=l,b=c,L=d,N=u,W=g,F=v,Z=p,J=_):(I=c,b=l,L=u,N=d,W=v,F=g,Z=_,J=p)),R===0)return null;let Q=I/R,ne=b/R,se=1/R,ke=L-Q*U,Re=N-ne*U,mt=W-Q*q,st=F-ne*q,ct=Z-Q*re,ee=J-ne*re,le=ct*st-ee*mt,Ee=ke*ee-Re*ct,Ke=mt*Re-st*ke;if(r){if(le<0||Ee<0||Ke<0)return null}else if((le<0||Ee<0||Ke<0)&&(le>0||Ee>0||Ke>0))return null;let Ie=le+Ee+Ke;if(Ie===0)return null;let nt=se*(le*U+Ee*q+Ke*re);return(Ie>0?nt<0:nt>0)?null:this.at(nt/Ie,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},es=class extends tr{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new tt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Cr,this.combine=Iu,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},qp=new It,Jr=new Os,xl=new kr,Xp=new V,vl=new V,yl=new V,bl=new V,fu=new V,_l=new V,$p=new V,Ml=new V,kn=class extends Hn{constructor(e=new _n,t=new es){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let r=t[n[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){let o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,s=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(s&&o){_l.set(0,0,0);for(let l=0,c=s.length;l<c;l++){let h=o[l],d=s[l];h!==0&&(fu.fromBufferAttribute(d,e),a?_l.addScaledVector(fu,h):_l.addScaledVector(fu.sub(t),h))}t.add(_l)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),xl.copy(n.boundingSphere),xl.applyMatrix4(s),Jr.copy(e.ray).recast(e.near),!(xl.containsPoint(Jr.origin)===!1&&(Jr.intersectSphere(xl,Xp)===null||Jr.origin.distanceToSquared(Xp)>(e.far-e.near)**2))&&(qp.copy(s).invert(),Jr.copy(e.ray).applyMatrix4(qp),!(n.boundingBox!==null&&Jr.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Jr)))}_computeIntersections(e,t,n){let r,s=this.geometry,a=this.material,o=s.index,l=s.attributes.position,c=s.attributes.uv,h=s.attributes.uv1,d=s.attributes.normal,u=s.groups,f=s.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,v=u.length;g<v;g++){let m=u[g],p=a[m.materialIndex],_=Math.max(m.start,f.start),A=Math.min(o.count,Math.min(m.start+m.count,f.start+f.count));for(let M=_,T=A;M<T;M+=3){let S=o.getX(M),I=o.getX(M+1),b=o.getX(M+2);r=Sl(this,p,e,n,c,h,d,S,I,b),r&&(r.faceIndex=Math.floor(M/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{let g=Math.max(0,f.start),v=Math.min(o.count,f.start+f.count);for(let m=g,p=v;m<p;m+=3){let _=o.getX(m),A=o.getX(m+1),M=o.getX(m+2);r=Sl(this,a,e,n,c,h,d,_,A,M),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,v=u.length;g<v;g++){let m=u[g],p=a[m.materialIndex],_=Math.max(m.start,f.start),A=Math.min(l.count,Math.min(m.start+m.count,f.start+f.count));for(let M=_,T=A;M<T;M+=3){let S=M,I=M+1,b=M+2;r=Sl(this,p,e,n,c,h,d,S,I,b),r&&(r.faceIndex=Math.floor(M/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{let g=Math.max(0,f.start),v=Math.min(l.count,f.start+f.count);for(let m=g,p=v;m<p;m+=3){let _=m,A=m+1,M=m+2;r=Sl(this,a,e,n,c,h,d,_,A,M),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}}};function jv(i,e,t,n,r,s,a,o){let l;if(e.side===Un?l=n.intersectTriangle(a,s,r,!0,o):l=n.intersectTriangle(r,s,a,e.side===Dr,o),l===null)return null;Ml.copy(o),Ml.applyMatrix4(i.matrixWorld);let c=t.ray.origin.distanceTo(Ml);return c<t.near||c>t.far?null:{distance:c,point:Ml.clone(),object:i}}function Sl(i,e,t,n,r,s,a,o,l,c){i.getVertexPosition(o,vl),i.getVertexPosition(l,yl),i.getVertexPosition(c,bl);let h=jv(i,e,t,n,vl,yl,bl,$p);if(h){let d=new V;Er.getBarycoord($p,vl,yl,bl,d),r&&(h.uv=Er.getInterpolatedAttribute(r,o,l,c,d,new Le)),s&&(h.uv1=Er.getInterpolatedAttribute(s,o,l,c,d,new Le)),a&&(h.normal=Er.getInterpolatedAttribute(a,o,l,c,d,new V),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let u={a:o,b:l,c,normal:new V,materialIndex:0};Er.getNormal(vl,yl,bl,u.normal),h.face=u,h.barycoord=d}return h}var $l=class extends Vn{constructor(e=null,t=1,n=1,r,s,a,o,l,c=bn,h=bn,d,u){super(null,a,o,l,c,h,r,s,d,u),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var jr=new kr,Qv=new Le(.5,.5),wl=new V,Oa=class{constructor(e=new mi,t=new mi,n=new mi,r=new mi,s=new mi,a=new mi){this.planes=[e,t,n,r,s,a]}set(e,t,n,r,s,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(s),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=gi,n=!1){let r=this.planes,s=e.elements,a=s[0],o=s[1],l=s[2],c=s[3],h=s[4],d=s[5],u=s[6],f=s[7],g=s[8],v=s[9],m=s[10],p=s[11],_=s[12],A=s[13],M=s[14],T=s[15];if(r[0].setComponents(c-a,f-h,p-g,T-_).normalize(),r[1].setComponents(c+a,f+h,p+g,T+_).normalize(),r[2].setComponents(c+o,f+d,p+v,T+A).normalize(),r[3].setComponents(c-o,f-d,p-v,T-A).normalize(),n)r[4].setComponents(l,u,m,M).normalize(),r[5].setComponents(c-l,f-u,p-m,T-M).normalize();else if(r[4].setComponents(c-l,f-u,p-m,T-M).normalize(),t===gi)r[5].setComponents(c+l,f+u,p+m,T+M).normalize();else if(t===za)r[5].setComponents(l,u,m,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),jr.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),jr.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(jr)}intersectsSprite(e){jr.center.set(0,0,0);let t=Qv.distanceTo(e.center);return jr.radius=.7071067811865476+t,jr.applyMatrix4(e.matrixWorld),this.intersectsSphere(jr)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(wl.x=r.normal.x>0?e.max.x:e.min.x,wl.y=r.normal.y>0?e.max.y:e.min.y,wl.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(wl)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var Yl=class extends tr{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new tt(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Kl=new V,Zl=new V,Yp=new It,Ea=new Os,Tl=new kr,pu=new V,Kp=new V,Jl=class extends Hn{constructor(e=new _n,t=new Yl){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let r=1,s=t.count;r<s;r++)Kl.fromBufferAttribute(t,r-1),Zl.fromBufferAttribute(t,r),n[r]=n[r-1],n[r]+=Kl.distanceTo(Zl);e.setAttribute("lineDistance",new an(n,1))}else qe("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,s=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Tl.copy(n.boundingSphere),Tl.applyMatrix4(r),Tl.radius+=s,e.ray.intersectsSphere(Tl)===!1)return;Yp.copy(r).invert(),Ea.copy(e.ray).applyMatrix4(Yp);let o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=n.index,u=n.attributes.position;if(h!==null){let f=Math.max(0,a.start),g=Math.min(h.count,a.start+a.count);for(let v=f,m=g-1;v<m;v+=c){let p=h.getX(v),_=h.getX(v+1),A=Al(this,e,Ea,l,p,_,v);A&&t.push(A)}if(this.isLineLoop){let v=h.getX(g-1),m=h.getX(f),p=Al(this,e,Ea,l,v,m,g-1);p&&t.push(p)}}else{let f=Math.max(0,a.start),g=Math.min(u.count,a.start+a.count);for(let v=f,m=g-1;v<m;v+=c){let p=Al(this,e,Ea,l,v,v+1,v);p&&t.push(p)}if(this.isLineLoop){let v=Al(this,e,Ea,l,g-1,f,g-1);v&&t.push(v)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let r=t[n[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){let o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}};function Al(i,e,t,n,r,s,a){let o=i.geometry.attributes.position;if(Kl.fromBufferAttribute(o,r),Zl.fromBufferAttribute(o,s),t.distanceSqToSegment(Kl,Zl,pu,Kp)>n)return;pu.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(pu);if(!(c<e.near||c>e.far))return{distance:c,point:Kp.clone().applyMatrix4(i.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:i}}var Zp=new V,Jp=new V,Va=class extends Jl{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let r=0,s=t.count;r<s;r+=2)Zp.fromBufferAttribute(t,r),Jp.fromBufferAttribute(t,r+1),n[r]=r===0?0:n[r-1],n[r+1]=n[r]+Zp.distanceTo(Jp);e.setAttribute("lineDistance",new an(n,1))}else qe("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var jl=class extends tr{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new tt(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},jp=new It,Su=new Os,El=new kr,Cl=new V,Ha=class extends Hn{constructor(e=new _n,t=new jl){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,s=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),El.copy(n.boundingSphere),El.applyMatrix4(r),El.radius+=s,e.ray.intersectsSphere(El)===!1)return;jp.copy(r).invert(),Su.copy(e.ray).applyMatrix4(jp);let o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,d=n.attributes.position;if(c!==null){let u=Math.max(0,a.start),f=Math.min(c.count,a.start+a.count);for(let g=u,v=f;g<v;g++){let m=c.getX(g);Cl.fromBufferAttribute(d,m),Qp(Cl,m,l,r,e,t,this)}}else{let u=Math.max(0,a.start),f=Math.min(d.count,a.start+a.count);for(let g=u,v=f;g<v;g++)Cl.fromBufferAttribute(d,g),Qp(Cl,g,l,r,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let r=t[n[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){let o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}};function Qp(i,e,t,n,r,s,a){let o=Su.distanceSqToPoint(i);if(o<t){let l=new V;Su.closestPointToPoint(i,l),l.applyMatrix4(n);let c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}var Ga=class extends Vn{constructor(e=[],t=Nr,n,r,s,a,o,l,c,h){super(e,t,n,r,s,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}};var Ir=class extends Vn{constructor(e,t,n=vi,r,s,a,o=bn,l=bn,c,h=Li,d=1){if(h!==Li&&h!==Ur)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:e,height:t,depth:d};super(u,r,s,a,o,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Us(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},Ql=class extends Ir{constructor(e,t=vi,n=Nr,r,s,a=bn,o=bn,l,c=Li){let h={width:e,height:e,depth:1},d=[h,h,h,h,h,h];super(e,e,t,n,r,s,a,o,l,c),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Wa=class extends Vn{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},Vs=class i extends _n{constructor(e=1,t=1,n=1,r=1,s=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:s,depthSegments:a};let o=this;r=Math.floor(r),s=Math.floor(s),a=Math.floor(a);let l=[],c=[],h=[],d=[],u=0,f=0;g("z","y","x",-1,-1,n,t,e,a,s,0),g("z","y","x",1,-1,n,t,-e,a,s,1),g("x","z","y",1,1,e,n,t,r,a,2),g("x","z","y",1,-1,e,n,-t,r,a,3),g("x","y","z",1,-1,e,t,n,r,s,4),g("x","y","z",-1,-1,e,t,-n,r,s,5),this.setIndex(l),this.setAttribute("position",new an(c,3)),this.setAttribute("normal",new an(h,3)),this.setAttribute("uv",new an(d,2));function g(v,m,p,_,A,M,T,S,I,b,R){let L=M/I,N=T/b,U=M/2,W=T/2,F=S/2,q=I+1,Z=b+1,J=0,re=0,Q=new V;for(let ne=0;ne<Z;ne++){let se=ne*N-W;for(let ke=0;ke<q;ke++){let Re=ke*L-U;Q[v]=Re*_,Q[m]=se*A,Q[p]=F,c.push(Q.x,Q.y,Q.z),Q[v]=0,Q[m]=0,Q[p]=S>0?1:-1,h.push(Q.x,Q.y,Q.z),d.push(ke/I),d.push(1-ne/b),J+=1}}for(let ne=0;ne<b;ne++)for(let se=0;se<I;se++){let ke=u+se+q*ne,Re=u+se+q*(ne+1),mt=u+(se+1)+q*(ne+1),st=u+(se+1)+q*ne;l.push(ke,Re,st),l.push(Re,mt,st),re+=6}o.addGroup(f,re,R),f+=re,u+=J}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var ai=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){qe("Curve: .getPoint() not implemented.")}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,r=this.getPoint(0),s=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),s+=n.distanceTo(r),t.push(s),r=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),r=0,s=n.length,a;t?a=t:a=e*n[s-1];let o=0,l=s-1,c;for(;o<=l;)if(r=Math.floor(o+(l-o)/2),c=n[r]-a,c<0)o=r+1;else if(c>0)l=r-1;else{l=r;break}if(r=l,n[r]===a)return r/(s-1);let h=n[r],u=n[r+1]-h,f=(a-h)/u;return(r+f)/(s-1)}getTangent(e,t){let r=e-1e-4,s=e+1e-4;r<0&&(r=0),s>1&&(s=1);let a=this.getPoint(r),o=this.getPoint(s),l=t||(a.isVector2?new Le:new V);return l.copy(o).sub(a).normalize(),l}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new V,r=[],s=[],a=[],o=new V,l=new It;for(let f=0;f<=e;f++){let g=f/e;r[f]=this.getTangentAt(g,new V)}s[0]=new V,a[0]=new V;let c=Number.MAX_VALUE,h=Math.abs(r[0].x),d=Math.abs(r[0].y),u=Math.abs(r[0].z);h<=c&&(c=h,n.set(1,0,0)),d<=c&&(c=d,n.set(0,1,0)),u<=c&&n.set(0,0,1),o.crossVectors(r[0],n).normalize(),s[0].crossVectors(r[0],o),a[0].crossVectors(r[0],s[0]);for(let f=1;f<=e;f++){if(s[f]=s[f-1].clone(),a[f]=a[f-1].clone(),o.crossVectors(r[f-1],r[f]),o.length()>Number.EPSILON){o.normalize();let g=Math.acos(ut(r[f-1].dot(r[f]),-1,1));s[f].applyMatrix4(l.makeRotationAxis(o,g))}a[f].crossVectors(r[f],s[f])}if(t===!0){let f=Math.acos(ut(s[0].dot(s[e]),-1,1));f/=e,r[0].dot(o.crossVectors(s[0],s[e]))>0&&(f=-f);for(let g=1;g<=e;g++)s[g].applyMatrix4(l.makeRotationAxis(r[g],f*g)),a[g].crossVectors(r[g],s[g])}return{tangents:r,normals:s,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},qa=class extends ai{constructor(e=0,t=0,n=1,r=1,s=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=r,this.aStartAngle=s,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(e,t=new Le){let n=t,r=Math.PI*2,s=this.aEndAngle-this.aStartAngle,a=Math.abs(s)<Number.EPSILON;for(;s<0;)s+=r;for(;s>r;)s-=r;s<Number.EPSILON&&(a?s=0:s=r),this.aClockwise===!0&&!a&&(s===r?s=-r:s=s-r);let o=this.aStartAngle+e*s,l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),d=Math.sin(this.aRotation),u=l-this.aX,f=c-this.aY;l=u*h-f*d+this.aX,c=u*d+f*h+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},ec=class extends qa{constructor(e,t,n,r,s,a){super(e,t,n,n,r,s,a),this.isArcCurve=!0,this.type="ArcCurve"}};function Wu(){let i=0,e=0,t=0,n=0;function r(s,a,o,l){i=s,e=o,t=-3*s+3*a-2*o-l,n=2*s-2*a+o+l}return{initCatmullRom:function(s,a,o,l,c){r(a,o,c*(o-s),c*(l-a))},initNonuniformCatmullRom:function(s,a,o,l,c,h,d){let u=(a-s)/c-(o-s)/(c+h)+(o-a)/h,f=(o-a)/h-(l-a)/(h+d)+(l-o)/d;u*=h,f*=h,r(a,o,u,f)},calc:function(s){let a=s*s,o=a*s;return i+e*s+t*a+n*o}}}var em=new V,tm=new V,mu=new Wu,gu=new Wu,xu=new Wu,Hs=class extends ai{constructor(e=[],t=!1,n="centripetal",r=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=r}getPoint(e,t=new V){let n=t,r=this.points,s=r.length,a=(s-(this.closed?0:1))*e,o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/s)+1)*s:l===0&&o===s-1&&(o=s-2,l=1);let c,h;this.closed||o>0?c=r[(o-1)%s]:(tm.subVectors(r[0],r[1]).add(r[0]),c=tm);let d=r[o%s],u=r[(o+1)%s];if(this.closed||o+2<s?h=r[(o+2)%s]:(em.subVectors(r[s-1],r[s-2]).add(r[s-1]),h=em),this.curveType==="centripetal"||this.curveType==="chordal"){let f=this.curveType==="chordal"?.5:.25,g=Math.pow(c.distanceToSquared(d),f),v=Math.pow(d.distanceToSquared(u),f),m=Math.pow(u.distanceToSquared(h),f);v<1e-4&&(v=1),g<1e-4&&(g=v),m<1e-4&&(m=v),mu.initNonuniformCatmullRom(c.x,d.x,u.x,h.x,g,v,m),gu.initNonuniformCatmullRom(c.y,d.y,u.y,h.y,g,v,m),xu.initNonuniformCatmullRom(c.z,d.z,u.z,h.z,g,v,m)}else this.curveType==="catmullrom"&&(mu.initCatmullRom(c.x,d.x,u.x,h.x,this.tension),gu.initCatmullRom(c.y,d.y,u.y,h.y,this.tension),xu.initCatmullRom(c.z,d.z,u.z,h.z,this.tension));return n.set(mu.calc(l),gu.calc(l),xu.calc(l)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(r.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let r=this.points[t];e.points.push(r.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(new V().fromArray(r))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function nm(i,e,t,n,r){let s=(n-e)*.5,a=(r-t)*.5,o=i*i,l=i*o;return(2*t-2*n+s+a)*l+(-3*t+3*n-2*s-a)*o+s*i+t}function e2(i,e){let t=1-i;return t*t*e}function t2(i,e){return 2*(1-i)*i*e}function n2(i,e){return i*i*e}function Ca(i,e,t,n){return e2(i,e)+t2(i,t)+n2(i,n)}function i2(i,e){let t=1-i;return t*t*t*e}function r2(i,e){let t=1-i;return 3*t*t*i*e}function s2(i,e){return 3*(1-i)*i*i*e}function a2(i,e){return i*i*i*e}function Ra(i,e,t,n,r){return i2(i,e)+r2(i,t)+s2(i,n)+a2(i,r)}var tc=class extends ai{constructor(e=new Le,t=new Le,n=new Le,r=new Le){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new Le){let n=t,r=this.v0,s=this.v1,a=this.v2,o=this.v3;return n.set(Ra(e,r.x,s.x,a.x,o.x),Ra(e,r.y,s.y,a.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},nc=class extends ai{constructor(e=new V,t=new V,n=new V,r=new V){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new V){let n=t,r=this.v0,s=this.v1,a=this.v2,o=this.v3;return n.set(Ra(e,r.x,s.x,a.x,o.x),Ra(e,r.y,s.y,a.y,o.y),Ra(e,r.z,s.z,a.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},ic=class extends ai{constructor(e=new Le,t=new Le){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new Le){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new Le){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},rc=class extends ai{constructor(e=new V,t=new V){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new V){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new V){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},sc=class extends ai{constructor(e=new Le,t=new Le,n=new Le){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new Le){let n=t,r=this.v0,s=this.v1,a=this.v2;return n.set(Ca(e,r.x,s.x,a.x),Ca(e,r.y,s.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Xa=class extends ai{constructor(e=new V,t=new V,n=new V){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new V){let n=t,r=this.v0,s=this.v1,a=this.v2;return n.set(Ca(e,r.x,s.x,a.x),Ca(e,r.y,s.y,a.y),Ca(e,r.z,s.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},ac=class extends ai{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new Le){let n=t,r=this.points,s=(r.length-1)*e,a=Math.floor(s),o=s-a,l=r[a===0?a:a-1],c=r[a],h=r[a>r.length-2?r.length-1:a+1],d=r[a>r.length-3?r.length-1:a+2];return n.set(nm(o,l.x,c.x,h.x,d.x),nm(o,l.y,c.y,h.y,d.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(r.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let r=this.points[t];e.points.push(r.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(new Le().fromArray(r))}return this}},o2=Object.freeze({__proto__:null,ArcCurve:ec,CatmullRomCurve3:Hs,CubicBezierCurve:tc,CubicBezierCurve3:nc,EllipseCurve:qa,LineCurve:ic,LineCurve3:rc,QuadraticBezierCurve:sc,QuadraticBezierCurve3:Xa,SplineCurve:ac});var $a=class i extends _n{constructor(e=1,t=1,n=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let s=e/2,a=t/2,o=Math.floor(n),l=Math.floor(r),c=o+1,h=l+1,d=e/o,u=t/l,f=[],g=[],v=[],m=[];for(let p=0;p<h;p++){let _=p*u-a;for(let A=0;A<c;A++){let M=A*d-s;g.push(M,-_,0),v.push(0,0,1),m.push(A/o),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let _=0;_<o;_++){let A=_+c*p,M=_+c*(p+1),T=_+1+c*(p+1),S=_+1+c*p;f.push(A,M,S),f.push(M,T,S)}this.setIndex(f),this.setAttribute("position",new an(g,3)),this.setAttribute("normal",new an(v,3)),this.setAttribute("uv",new an(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.widthSegments,e.heightSegments)}};var Ya=class i extends _n{constructor(e=new Xa(new V(-1,-1,0),new V(-1,1,0),new V(1,1,0)),t=64,n=1,r=8,s=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:r,closed:s};let a=e.computeFrenetFrames(t,s);this.tangents=a.tangents,this.normals=a.normals,this.binormals=a.binormals;let o=new V,l=new V,c=new Le,h=new V,d=[],u=[],f=[],g=[];v(),this.setIndex(g),this.setAttribute("position",new an(d,3)),this.setAttribute("normal",new an(u,3)),this.setAttribute("uv",new an(f,2));function v(){for(let A=0;A<t;A++)m(A);m(s===!1?t:0),_(),p()}function m(A){h=e.getPointAt(A/t,h);let M=a.normals[A],T=a.binormals[A];for(let S=0;S<=r;S++){let I=S/r*Math.PI*2,b=Math.sin(I),R=-Math.cos(I);l.x=R*M.x+b*T.x,l.y=R*M.y+b*T.y,l.z=R*M.z+b*T.z,l.normalize(),u.push(l.x,l.y,l.z),o.x=h.x+n*l.x,o.y=h.y+n*l.y,o.z=h.z+n*l.z,d.push(o.x,o.y,o.z)}}function p(){for(let A=1;A<=t;A++)for(let M=1;M<=r;M++){let T=(r+1)*(A-1)+(M-1),S=(r+1)*A+(M-1),I=(r+1)*A+M,b=(r+1)*(A-1)+M;g.push(T,S,b),g.push(S,I,b)}}function _(){for(let A=0;A<=t;A++)for(let M=0;M<=r;M++)c.x=A/t,c.y=M/r,f.push(c.x,c.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new i(new o2[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}};function ss(i){let e={};for(let t in i){e[t]={};for(let n in i[t]){let r=i[t][n];if(im(r))r.isRenderTargetTexture?(qe("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=r.clone();else if(Array.isArray(r))if(im(r[0])){let s=[];for(let a=0,o=r.length;a<o;a++)s[a]=r[a].clone();e[t][n]=s}else e[t][n]=r.slice();else e[t][n]=r}}return e}function In(i){let e={};for(let t=0;t<i.length;t++){let n=ss(i[t]);for(let r in n)e[r]=n[r]}return e}function im(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function l2(i){let e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function qu(i){let e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:lt.workingColorSpace}var rr={clone:ss,merge:In},c2=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,h2=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Ut=class extends tr{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=c2,this.fragmentShader=h2,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=ss(e.uniforms),this.uniformsGroups=l2(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let a=this.uniforms[r].value;a&&a.isTexture?t.uniforms[r]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[r]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[r]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[r]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[r]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[r]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[r]={type:"m4",value:a.toArray()}:t.uniforms[r]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let r in this.extensions)this.extensions[r]===!0&&(n[r]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let r=e.uniforms[n];switch(this.uniforms[n]={},r.type){case"t":this.uniforms[n].value=t[r.value]||null;break;case"c":this.uniforms[n].value=new tt().setHex(r.value);break;case"v2":this.uniforms[n].value=new Le().fromArray(r.value);break;case"v3":this.uniforms[n].value=new V().fromArray(r.value);break;case"v4":this.uniforms[n].value=new qt().fromArray(r.value);break;case"m3":this.uniforms[n].value=new je().fromArray(r.value);break;case"m4":this.uniforms[n].value=new It().fromArray(r.value);break;default:this.uniforms[n].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Gs=class extends Ut{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}};var oc=class extends tr{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Im,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},lc=class extends tr{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function Ps(i,e){return!i||i.constructor===e?i:typeof e.BYTES_PER_ELEMENT=="number"?new e(i):Array.prototype.slice.call(i)}function vu(i){return i!==void 0&&i.inTangents!==void 0&&i.outTangents!==void 0}var Pr=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],s=t[n-1];n:{e:{let a;t:{i:if(!(e<r)){for(let o=n+2;;){if(r===void 0){if(e<s)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(s=r,r=t[++n],e<r)break e}a=t.length;break t}if(!(e>=s)){let o=t[1];e<o&&(n=2,s=o);for(let l=n-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(r=s,s=t[--n-1],e>=s)break e}a=n,n=0;break t}break n}for(;n<a;){let o=n+a>>>1;e<t[o]?a=o:n=o+1}if(r=t[n],s=t[n-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,s,r)}return this.interpolate_(n,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,s=e*r;for(let a=0;a!==r;++a)t[a]=n[s+a];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},cc=class extends Pr{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:bu,endingEnd:bu}}intervalChanged_(e,t,n){let r=this.parameterPositions,s=e-2,a=e+1,o=r[s],l=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case _u:s=e,o=2*t-n;break;case Mu:s=r.length-2,o=t+r[s]-r[s+1];break;default:s=e,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case _u:a=e,l=2*n-t;break;case Mu:a=1,l=n+r[1]-r[0];break;default:a=e-1,l=t}let c=(n-t)*.5,h=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-n),this._offsetPrev=s*h,this._offsetNext=a*h}interpolate_(e,t,n,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this._offsetPrev,d=this._offsetNext,u=this._weightPrev,f=this._weightNext,g=(n-t)/(r-t),v=g*g,m=v*g,p=-u*m+2*u*v-u*g,_=(1+u)*m+(-1.5-2*u)*v+(-.5+u)*g+1,A=(-1-f)*m+(1.5+f)*v+.5*g,M=f*m-f*v;for(let T=0;T!==o;++T)s[T]=p*a[h+T]+_*a[c+T]+A*a[l+T]+M*a[d+T];return s}},hc=class extends Pr{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=(n-t)/(r-t),d=1-h;for(let u=0;u!==o;++u)s[u]=a[c+u]*d+a[l+u]*h;return s}},uc=class extends Pr{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},dc=class extends Pr{interpolate_(e,t,n,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this.inTangents,d=this.outTangents;if(!h||!d){let g=(n-t)/(r-t),v=1-g;for(let m=0;m!==o;++m)s[m]=a[c+m]*v+a[l+m]*g;return s}let u=o*2,f=e-1;for(let g=0;g!==o;++g){let v=a[c+g],m=a[l+g],p=f*u+g*2,_=d[p],A=d[p+1],M=e*u+g*2,T=h[M],S=h[M+1],I=d2(n,t,_,T,r);s[g]=Xm(I,v,A,S,m)}return s}};function Xm(i,e,t,n,r){let s=1-i;return s*s*s*e+3*s*s*i*t+3*s*i*i*n+i*i*i*r}function u2(i,e,t,n,r){let s=1-i;return 3*s*s*(t-e)+6*s*i*(n-t)+3*i*i*(r-n)}function d2(i,e,t,n,r){let s=(i-e)/(r-e);for(let a=0;a<8;a++){let o=Xm(s,e,t,n,r)-i;if(Math.abs(o)<1e-10)break;let l=u2(s,e,t,n,r);if(Math.abs(l)<1e-10)break;s=Math.max(0,Math.min(1,s-o/l))}return s}var Qn=class{constructor(e,t,n,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Ps(t,this.TimeBufferType),this.values=Ps(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Ps(e.times,Array),values:Ps(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(n.interpolation=r),vu(e.settings)&&(n.settings={inTangents:Ps(e.settings.inTangents,Array),outTangents:Ps(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new uc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new hc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new cc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new dc(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case ka:t=this.InterpolantFactoryMethodDiscrete;break;case Hl:t=this.InterpolantFactoryMethodLinear;break;case Il:t=this.InterpolantFactoryMethodSmooth;break;case yu:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return qe("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ka;case this.InterpolantFactoryMethodLinear:return Hl;case this.InterpolantFactoryMethodSmooth:return Il;case this.InterpolantFactoryMethodBezier:return yu}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e;vu(this.settings)&&(rm(this.settings.inTangents,e),rm(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,r=n.length,s=0,a=r-1;for(;s!==r&&n[s]<e;)++s;for(;a!==-1&&n[a]>t;)--a;if(++a,s!==0||a!==r){s>=a&&(a=Math.max(a,1),s=a-1);let o=this.getValueSize();this.times=n.slice(s,a),this.values=this.values.slice(s*o,a*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Ye("KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,r=this.values,s=n.length;s===0&&(Ye("KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==s;o++){let l=n[o];if(typeof l=="number"&&isNaN(l)){Ye("KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){Ye("KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(r!==void 0&&Lv(r))for(let o=0,l=r.length;o!==l;++o){let c=r[o];if(isNaN(c)){Ye("KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===Il,s=e.length-1,a=1;for(let o=1;o<s;++o){let l=!1,c=e[o],h=e[o+1];if(c!==h&&(o!==1||c!==e[0]))if(r)l=!0;else{let d=o*n,u=d-n,f=d+n;for(let g=0;g!==n;++g){let v=t[d+g];if(v!==t[u+g]||v!==t[f+g]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];let d=o*n,u=a*n;for(let f=0;f!==n;++f)t[u+f]=t[d+f]}++a}}if(s>0){e[a]=e[s];for(let o=s*n,l=a*n,c=0;c!==n;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,vu(this.settings)&&(r.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),r}};function rm(i,e){for(let t=0,n=i.length;t!==n;t+=2)i[t]*=e}Qn.prototype.ValueTypeName="";Qn.prototype.TimeBufferType=Float32Array;Qn.prototype.ValueBufferType=Float32Array;Qn.prototype.DefaultInterpolation=Hl;var zr=class extends Qn{constructor(e,t,n){super(e,t,n)}};zr.prototype.ValueTypeName="bool";zr.prototype.ValueBufferType=Array;zr.prototype.DefaultInterpolation=ka;zr.prototype.InterpolantFactoryMethodLinear=void 0;zr.prototype.InterpolantFactoryMethodSmooth=void 0;var fc=class extends Qn{constructor(e,t,n,r){super(e,t,n,r)}};fc.prototype.ValueTypeName="color";var pc=class extends Qn{constructor(e,t,n,r){super(e,t,n,r)}};pc.prototype.ValueTypeName="number";var mc=class extends Pr{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-t)/(r-t),c=e*o;for(let h=c+o;c!==h;c+=4)Ni.slerpFlat(s,0,a,c-o,a,c,l);return s}},Ka=class extends Qn{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new mc(this.times,this.values,this.getValueSize(),e)}};Ka.prototype.ValueTypeName="quaternion";Ka.prototype.InterpolantFactoryMethodSmooth=void 0;var Lr=class extends Qn{constructor(e,t,n){super(e,t,n)}};Lr.prototype.ValueTypeName="string";Lr.prototype.ValueBufferType=Array;Lr.prototype.DefaultInterpolation=ka;Lr.prototype.InterpolantFactoryMethodLinear=void 0;Lr.prototype.InterpolantFactoryMethodSmooth=void 0;var gc=class extends Qn{constructor(e,t,n,r){super(e,t,n,r)}};gc.prototype.ValueTypeName="vector";var xc=class{constructor(e,t,n){let r=this,s=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(h){o++,s===!1&&r.onStart!==void 0&&r.onStart(h,a,o),s=!0},this.itemEnd=function(h){a++,r.onProgress!==void 0&&r.onProgress(h,a,o),a===o&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(h){r.onError!==void 0&&r.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,d){return c.push(h,d),this},this.removeHandler=function(h){let d=c.indexOf(h);return d!==-1&&c.splice(d,2),this},this.getHandler=function(h){for(let d=0,u=c.length;d<u;d+=2){let f=c[d],g=c[d+1];if(f.global&&(f.lastIndex=0),f.test(h))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},$m=new xc,vc=class{constructor(e){this.manager=e!==void 0?e:$m,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(r,s){n.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};vc.DEFAULT_MATERIAL_NAME="__DEFAULT";var Rl=new V,kl=new Ni,Pi=new V,Za=class extends Hn{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new It,this.projectionMatrix=new It,this.projectionMatrixInverse=new It,this.coordinateSystem=gi,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Rl,kl,Pi),Pi.x===1&&Pi.y===1&&Pi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Rl,kl,Pi.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(Rl,kl,Pi),Pi.x===1&&Pi.y===1&&Pi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Rl,kl,Pi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Ar=new V,sm=new Le,am=new Le,Rn=class extends Za{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Gl*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan($h*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Gl*2*Math.atan(Math.tan($h*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Ar.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Ar.x,Ar.y).multiplyScalar(-e/Ar.z),Ar.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Ar.x,Ar.y).multiplyScalar(-e/Ar.z)}getViewSize(e,t){return this.getViewBounds(e,sm,am),t.subVectors(am,sm)}setViewOffset(e,t,n,r,s,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan($h*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,s=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;s+=a.offsetX*r/l,t-=a.offsetY*n/c,r*=a.width/l,n*=a.height/c}let o=this.filmOffset;o!==0&&(s+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var ts=class extends Za{constructor(e=-1,t=1,n=1,r=-1,s=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=s,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,s,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,s=n-e,a=n+e,o=r+t,l=r-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,a=s+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(s,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}};var zs=-90,Ls=1,yc=class extends Hn{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Rn(zs,Ls,e,t);r.layers=this.layers,this.add(r);let s=new Rn(zs,Ls,e,t);s.layers=this.layers,this.add(s);let a=new Rn(zs,Ls,e,t);a.layers=this.layers,this.add(a);let o=new Rn(zs,Ls,e,t);o.layers=this.layers,this.add(o);let l=new Rn(zs,Ls,e,t);l.layers=this.layers,this.add(l);let c=new Rn(zs,Ls,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,s,a,o,l]=t;for(let c of t)this.remove(c);if(e===gi)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===za)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[s,a,o,l,c,h]=this.children,d=e.getRenderTarget(),u=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;let v=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(n,0,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,1,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=v,e.setRenderTarget(n,5,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(d,u,f),e.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},bc=class extends Rn{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},Ja=class{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){this._document=e,e.hidden!==void 0&&(this._pageVisibilityHandler=f2.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1))}disconnect(){this._pageVisibilityHandler!==null&&(this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null),this._document=null}getDelta(){return this._delta/1e3}getElapsed(){return this._elapsed/1e3}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){return this._pageVisibilityHandler!==null&&this._document.hidden===!0?this._delta=0:(this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta),this}};function f2(){this._document.hidden===!1&&this.reset()}var Xu="\\[\\]\\.:\\/",p2=new RegExp("["+Xu+"]","g"),$u="[^"+Xu+"]",m2="[^"+Xu.replace("\\.","")+"]",g2=/((?:WC+[\/:])*)/.source.replace("WC",$u),x2=/(WCOD+)?/.source.replace("WCOD",m2),v2=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",$u),y2=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",$u),b2=new RegExp("^"+g2+x2+v2+y2+"$"),_2=["material","materials","bones","map"],wu=class{constructor(e,t,n){let r=n||Ft.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=n.length;r!==s;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},Ft=class i{constructor(e,t,n){this.path=t,this.parsedPath=n||i.parseTrackName(t),this.node=i.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new i.Composite(e,t,n):new i(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(p2,"")}static parseTrackName(e){let t=b2.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=n.nodeName.substring(r+1);_2.indexOf(s)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=s)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(s){for(let a=0;a<s.length;a++){let o=s[a];if(o.name===t||o.uuid===t)return o;let l=n(o.children);if(l)return l}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,r=t.propertyName,s=t.propertyIndex;if(e||(e=i.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){qe("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){Ye("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ye("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ye("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ye("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ye("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){Ye("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){Ye("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let a=e[r];if(a===void 0){let c=t.nodeName;Ye("PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){Ye("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ye("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=s}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Ft.Composite=wu;Ft.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Ft.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Ft.prototype.GetterByBindingType=[Ft.prototype._getValue_direct,Ft.prototype._getValue_array,Ft.prototype._getValue_arrayElement,Ft.prototype._getValue_toArray];Ft.prototype.SetterByBindingTypeAndVersioning=[[Ft.prototype._setValue_direct,Ft.prototype._setValue_direct_setNeedsUpdate,Ft.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Ft.prototype._setValue_array,Ft.prototype._setValue_array_setNeedsUpdate,Ft.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Ft.prototype._setValue_arrayElement,Ft.prototype._setValue_arrayElement_setNeedsUpdate,Ft.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Ft.prototype._setValue_fromArray,Ft.prototype._setValue_fromArray_setNeedsUpdate,Ft.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var F5=new Float32Array(1);var Qu=class Qu{constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let s=this.elements;return s[0]=e,s[2]=t,s[1]=n,s[3]=r,this}};Qu.prototype.isMatrix2=!0;var Tu=Qu;function Yu(i,e,t,n){let r=M2(n);switch(t){case Fu:return i*e;case Bu:return i*e/r.components*r.byteLength;case Cc:return i*e/r.components*r.byteLength;case Br:return i*e*2/r.components*r.byteLength;case Rc:return i*e*2/r.components*r.byteLength;case Uu:return i*e*3/r.components*r.byteLength;case li:return i*e*4/r.components*r.byteLength;case kc:return i*e*4/r.components*r.byteLength;case oo:case lo:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case co:case ho:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Pc:case Lc:return Math.max(i,16)*Math.max(e,8)/4;case Ic:case zc:return Math.max(i,8)*Math.max(e,8)/2;case Dc:case Nc:case Uc:case Bc:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case Fc:case uo:case Oc:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Vc:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Hc:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case Gc:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case Wc:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case qc:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case Xc:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case $c:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case Yc:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case Kc:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case Zc:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case Jc:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case jc:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case Qc:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case e0:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case t0:case n0:case i0:return Math.ceil(i/4)*Math.ceil(e/4)*16;case r0:case s0:return Math.ceil(i/4)*Math.ceil(e/4)*8;case fo:case a0:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function M2(i){switch(i){case ei:case zu:return{byteLength:1,components:1};case Xs:case Lu:case Sn:return{byteLength:2,components:1};case Ac:case Ec:return{byteLength:2,components:4};case vi:case Tc:case yi:return{byteLength:4,components:1};case Du:case Nu:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?qe("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");function m1(){let i=null,e=!1,t=null,n=null;function r(s,a){n=i.requestAnimationFrame(r),t(s,a)}return{start:function(){e!==!0&&t!==null&&i!==null&&(n=i.requestAnimationFrame(r),e=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){i=s}}}function w2(i){let e=new WeakMap;function t(o,l){let c=o.array,h=o.usage,d=c.byteLength,u=i.createBuffer();i.bindBuffer(l,u),i.bufferData(l,c,h),o.onUploadCallback();let f;if(c instanceof Float32Array)f=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=i.SHORT;else if(c instanceof Uint32Array)f=i.UNSIGNED_INT;else if(c instanceof Int32Array)f=i.INT;else if(c instanceof Int8Array)f=i.BYTE;else if(c instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:d}}function n(o,l,c){let h=l.array,d=l.updateRanges;if(i.bindBuffer(c,o),d.length===0)i.bufferSubData(c,0,h);else{d.sort((f,g)=>f.start-g.start);let u=0;for(let f=1;f<d.length;f++){let g=d[u],v=d[f];v.start<=g.start+g.count+1?g.count=Math.max(g.count,v.start+v.count-g.start):(++u,d[u]=v)}d.length=u+1;for(let f=0,g=d.length;f<g;f++){let v=d[f];i.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function s(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=e.get(o);l&&(i.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:r,remove:s,update:a}}var T2=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,A2=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,E2=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,C2=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,R2=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,k2=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,I2=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,P2=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,z2=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,L2=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,D2=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,N2=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,F2=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,U2=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,B2=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,O2=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,V2=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,H2=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,G2=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,W2=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,q2=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,X2=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,$2=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Y2=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,K2=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Z2=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,J2=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,j2=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Q2=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,ey=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,ty="gl_FragColor = linearToOutputTexel( gl_FragColor );",ny=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,iy=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,ry=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,sy=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,ay=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,oy=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,ly=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,cy=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,hy=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,uy=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,dy=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,fy=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,py=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,my=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,gy=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,xy=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,vy=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,yy=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,by=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,_y=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,My=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Sy=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,wy=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Ty=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Ay=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Ey=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Cy=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Ry=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,ky=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Iy=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Py=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,zy=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Ly=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Dy=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ny=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Fy=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Uy=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,By=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Oy=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Vy=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Hy=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Gy=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Wy=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,qy=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Xy=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,$y=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Yy=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Ky=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Zy=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Jy=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,jy=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Qy=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,e3=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,t3=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,n3=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,i3=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,r3=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,s3=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,a3=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,o3=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,l3=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,c3=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,h3=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,u3=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,d3=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,f3=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,p3=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,m3=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,g3=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,x3=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,v3=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,y3=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,b3=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,_3=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,M3=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,S3=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,w3=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,T3=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,A3=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,E3=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,C3=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,R3=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,k3=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,I3=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,P3=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,z3=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,L3=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,D3=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,N3=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,F3=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,U3=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,B3=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,O3=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,V3=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,H3=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,G3=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,W3=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,q3=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,X3=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,$3=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Y3=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,K3=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Z3=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,J3=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,j3=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Q3=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,e4=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,t4=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,n4=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,i4=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,r4=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,rt={alphahash_fragment:T2,alphahash_pars_fragment:A2,alphamap_fragment:E2,alphamap_pars_fragment:C2,alphatest_fragment:R2,alphatest_pars_fragment:k2,aomap_fragment:I2,aomap_pars_fragment:P2,batching_pars_vertex:z2,batching_vertex:L2,begin_vertex:D2,beginnormal_vertex:N2,bsdfs:F2,iridescence_fragment:U2,bumpmap_pars_fragment:B2,clipping_planes_fragment:O2,clipping_planes_pars_fragment:V2,clipping_planes_pars_vertex:H2,clipping_planes_vertex:G2,color_fragment:W2,color_pars_fragment:q2,color_pars_vertex:X2,color_vertex:$2,common:Y2,cube_uv_reflection_fragment:K2,defaultnormal_vertex:Z2,displacementmap_pars_vertex:J2,displacementmap_vertex:j2,emissivemap_fragment:Q2,emissivemap_pars_fragment:ey,colorspace_fragment:ty,colorspace_pars_fragment:ny,envmap_fragment:iy,envmap_common_pars_fragment:ry,envmap_pars_fragment:sy,envmap_pars_vertex:ay,envmap_physical_pars_fragment:xy,envmap_vertex:oy,fog_vertex:ly,fog_pars_vertex:cy,fog_fragment:hy,fog_pars_fragment:uy,gradientmap_pars_fragment:dy,lightmap_pars_fragment:fy,lights_lambert_fragment:py,lights_lambert_pars_fragment:my,lights_pars_begin:gy,lights_toon_fragment:vy,lights_toon_pars_fragment:yy,lights_phong_fragment:by,lights_phong_pars_fragment:_y,lights_physical_fragment:My,lights_physical_pars_fragment:Sy,lights_fragment_begin:wy,lights_fragment_maps:Ty,lights_fragment_end:Ay,lightprobes_pars_fragment:Ey,logdepthbuf_fragment:Cy,logdepthbuf_pars_fragment:Ry,logdepthbuf_pars_vertex:ky,logdepthbuf_vertex:Iy,map_fragment:Py,map_pars_fragment:zy,map_particle_fragment:Ly,map_particle_pars_fragment:Dy,metalnessmap_fragment:Ny,metalnessmap_pars_fragment:Fy,morphinstance_vertex:Uy,morphcolor_vertex:By,morphnormal_vertex:Oy,morphtarget_pars_vertex:Vy,morphtarget_vertex:Hy,normal_fragment_begin:Gy,normal_fragment_maps:Wy,normal_pars_fragment:qy,normal_pars_vertex:Xy,normal_vertex:$y,normalmap_pars_fragment:Yy,clearcoat_normal_fragment_begin:Ky,clearcoat_normal_fragment_maps:Zy,clearcoat_pars_fragment:Jy,iridescence_pars_fragment:jy,opaque_fragment:Qy,packing:e3,premultiplied_alpha_fragment:t3,project_vertex:n3,dithering_fragment:i3,dithering_pars_fragment:r3,roughnessmap_fragment:s3,roughnessmap_pars_fragment:a3,shadowmap_pars_fragment:o3,shadowmap_pars_vertex:l3,shadowmap_vertex:c3,shadowmask_pars_fragment:h3,skinbase_vertex:u3,skinning_pars_vertex:d3,skinning_vertex:f3,skinnormal_vertex:p3,specularmap_fragment:m3,specularmap_pars_fragment:g3,tonemapping_fragment:x3,tonemapping_pars_fragment:v3,transmission_fragment:y3,transmission_pars_fragment:b3,uv_pars_fragment:_3,uv_pars_vertex:M3,uv_vertex:S3,worldpos_vertex:w3,background_vert:T3,background_frag:A3,backgroundCube_vert:E3,backgroundCube_frag:C3,cube_vert:R3,cube_frag:k3,depth_vert:I3,depth_frag:P3,distance_vert:z3,distance_frag:L3,equirect_vert:D3,equirect_frag:N3,linedashed_vert:F3,linedashed_frag:U3,meshbasic_vert:B3,meshbasic_frag:O3,meshlambert_vert:V3,meshlambert_frag:H3,meshmatcap_vert:G3,meshmatcap_frag:W3,meshnormal_vert:q3,meshnormal_frag:X3,meshphong_vert:$3,meshphong_frag:Y3,meshphysical_vert:K3,meshphysical_frag:Z3,meshtoon_vert:J3,meshtoon_frag:j3,points_vert:Q3,points_frag:e4,shadow_vert:t4,shadow_frag:n4,sprite_vert:i4,sprite_frag:r4},Se={common:{diffuse:{value:new tt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new je},alphaMap:{value:null},alphaMapTransform:{value:new je},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new je}},envmap:{envMap:{value:null},envMapRotation:{value:new je},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new je}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new je}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new je},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new je},normalScale:{value:new Le(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new je},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new je}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new je}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new je}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new tt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new V},probesMax:{value:new V},probesResolution:{value:new V}},points:{diffuse:{value:new tt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new je},alphaTest:{value:0},uvTransform:{value:new je}},sprite:{diffuse:{value:new tt(16777215)},opacity:{value:1},center:{value:new Le(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new je},alphaMap:{value:null},alphaMapTransform:{value:new je},alphaTest:{value:0}}},Bi={basic:{uniforms:In([Se.common,Se.specularmap,Se.envmap,Se.aomap,Se.lightmap,Se.fog]),vertexShader:rt.meshbasic_vert,fragmentShader:rt.meshbasic_frag},lambert:{uniforms:In([Se.common,Se.specularmap,Se.envmap,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.fog,Se.lights,{emissive:{value:new tt(0)},envMapIntensity:{value:1}}]),vertexShader:rt.meshlambert_vert,fragmentShader:rt.meshlambert_frag},phong:{uniforms:In([Se.common,Se.specularmap,Se.envmap,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.fog,Se.lights,{emissive:{value:new tt(0)},specular:{value:new tt(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:rt.meshphong_vert,fragmentShader:rt.meshphong_frag},standard:{uniforms:In([Se.common,Se.envmap,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.roughnessmap,Se.metalnessmap,Se.fog,Se.lights,{emissive:{value:new tt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:rt.meshphysical_vert,fragmentShader:rt.meshphysical_frag},toon:{uniforms:In([Se.common,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.gradientmap,Se.fog,Se.lights,{emissive:{value:new tt(0)}}]),vertexShader:rt.meshtoon_vert,fragmentShader:rt.meshtoon_frag},matcap:{uniforms:In([Se.common,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.fog,{matcap:{value:null}}]),vertexShader:rt.meshmatcap_vert,fragmentShader:rt.meshmatcap_frag},points:{uniforms:In([Se.points,Se.fog]),vertexShader:rt.points_vert,fragmentShader:rt.points_frag},dashed:{uniforms:In([Se.common,Se.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:rt.linedashed_vert,fragmentShader:rt.linedashed_frag},depth:{uniforms:In([Se.common,Se.displacementmap]),vertexShader:rt.depth_vert,fragmentShader:rt.depth_frag},normal:{uniforms:In([Se.common,Se.bumpmap,Se.normalmap,Se.displacementmap,{opacity:{value:1}}]),vertexShader:rt.meshnormal_vert,fragmentShader:rt.meshnormal_frag},sprite:{uniforms:In([Se.sprite,Se.fog]),vertexShader:rt.sprite_vert,fragmentShader:rt.sprite_frag},background:{uniforms:{uvTransform:{value:new je},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:rt.background_vert,fragmentShader:rt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new je}},vertexShader:rt.backgroundCube_vert,fragmentShader:rt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:rt.cube_vert,fragmentShader:rt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:rt.equirect_vert,fragmentShader:rt.equirect_frag},distance:{uniforms:In([Se.common,Se.displacementmap,{referencePosition:{value:new V},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:rt.distance_vert,fragmentShader:rt.distance_frag},shadow:{uniforms:In([Se.lights,Se.fog,{color:{value:new tt(0)},opacity:{value:1}}]),vertexShader:rt.shadow_vert,fragmentShader:rt.shadow_frag}};Bi.physical={uniforms:In([Bi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new je},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new je},clearcoatNormalScale:{value:new Le(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new je},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new je},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new je},sheen:{value:0},sheenColor:{value:new tt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new je},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new je},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new je},transmissionSamplerSize:{value:new Le},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new je},attenuationDistance:{value:0},attenuationColor:{value:new tt(0)},specularColor:{value:new tt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new je},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new je},anisotropyVector:{value:new Le},anisotropyMap:{value:null},anisotropyMapTransform:{value:new je}}]),vertexShader:rt.meshphysical_vert,fragmentShader:rt.meshphysical_frag};var c0={r:0,b:0,g:0},s4=new It,g1=new je;g1.set(-1,0,0,0,1,0,0,0,1);function a4(i,e,t,n,r,s){let a=new tt(0),o=r===!0?0:1,l,c,h=null,d=0,u=null;function f(_){let A=_.isScene===!0?_.background:null;if(A&&A.isTexture){let M=_.backgroundBlurriness>0;A=e.get(A,M)}return A}function g(_){let A=!1,M=f(_);M===null?m(a,o):M&&M.isColor&&(m(M,1),A=!0);let T=i.xr.getEnvironmentBlendMode();T==="additive"?t.buffers.color.setClear(0,0,0,1,s):T==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,s),(i.autoClear||A)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function v(_,A){let M=f(A);M&&(M.isCubeTexture||M.mapping===so)?(c===void 0&&(c=new kn(new Vs(1,1,1),new Ut({name:"BackgroundCubeMaterial",uniforms:ss(Bi.backgroundCube.uniforms),vertexShader:Bi.backgroundCube.vertexShader,fragmentShader:Bi.backgroundCube.fragmentShader,side:Un,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(T,S,I){this.matrixWorld.copyPosition(I.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=M,c.material.uniforms.backgroundBlurriness.value=A.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=A.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(s4.makeRotationFromEuler(A.backgroundRotation)).transpose(),M.isCubeTexture&&M.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(g1),c.material.toneMapped=lt.getTransfer(M.colorSpace)!==yt,(h!==M||d!==M.version||u!==i.toneMapping)&&(c.material.needsUpdate=!0,h=M,d=M.version,u=i.toneMapping),c.layers.enableAll(),_.unshift(c,c.geometry,c.material,0,0,null)):M&&M.isTexture&&(l===void 0&&(l=new kn(new $a(2,2),new Ut({name:"BackgroundMaterial",uniforms:ss(Bi.background.uniforms),vertexShader:Bi.background.vertexShader,fragmentShader:Bi.background.fragmentShader,side:Dr,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=M,l.material.uniforms.backgroundIntensity.value=A.backgroundIntensity,l.material.toneMapped=lt.getTransfer(M.colorSpace)!==yt,M.matrixAutoUpdate===!0&&M.updateMatrix(),l.material.uniforms.uvTransform.value.copy(M.matrix),(h!==M||d!==M.version||u!==i.toneMapping)&&(l.material.needsUpdate=!0,h=M,d=M.version,u=i.toneMapping),l.layers.enableAll(),_.unshift(l,l.geometry,l.material,0,0,null))}function m(_,A){_.getRGB(c0,qu(i)),t.buffers.color.setClear(c0.r,c0.g,c0.b,A,s)}function p(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(_,A=1){a.set(_),o=A,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(_){o=_,m(a,o)},render:g,addToRenderList:v,dispose:p}}function o4(i,e){let t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},r=u(null),s=r,a=!1;function o(N,U,W,F,q){let Z=!1,J=d(N,F,W,U);s!==J&&(s=J,c(s.object)),Z=f(N,F,W,q),Z&&g(N,F,W,q),q!==null&&e.update(q,i.ELEMENT_ARRAY_BUFFER),(Z||a)&&(a=!1,M(N,U,W,F),q!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(q).buffer))}function l(){return i.createVertexArray()}function c(N){return i.bindVertexArray(N)}function h(N){return i.deleteVertexArray(N)}function d(N,U,W,F){let q=F.wireframe===!0,Z=n[U.id];Z===void 0&&(Z={},n[U.id]=Z);let J=N.isInstancedMesh===!0?N.id:0,re=Z[J];re===void 0&&(re={},Z[J]=re);let Q=re[W.id];Q===void 0&&(Q={},re[W.id]=Q);let ne=Q[q];return ne===void 0&&(ne=u(l()),Q[q]=ne),ne}function u(N){let U=[],W=[],F=[];for(let q=0;q<t;q++)U[q]=0,W[q]=0,F[q]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:U,enabledAttributes:W,attributeDivisors:F,object:N,attributes:{},index:null}}function f(N,U,W,F){let q=s.attributes,Z=U.attributes,J=0,re=W.getAttributes();for(let Q in re)if(re[Q].location>=0){let se=q[Q],ke=Z[Q];if(ke===void 0&&(Q==="instanceMatrix"&&N.instanceMatrix&&(ke=N.instanceMatrix),Q==="instanceColor"&&N.instanceColor&&(ke=N.instanceColor)),se===void 0||se.attribute!==ke||ke&&se.data!==ke.data)return!0;J++}return s.attributesNum!==J||s.index!==F}function g(N,U,W,F){let q={},Z=U.attributes,J=0,re=W.getAttributes();for(let Q in re)if(re[Q].location>=0){let se=Z[Q];se===void 0&&(Q==="instanceMatrix"&&N.instanceMatrix&&(se=N.instanceMatrix),Q==="instanceColor"&&N.instanceColor&&(se=N.instanceColor));let ke={};ke.attribute=se,se&&se.data&&(ke.data=se.data),q[Q]=ke,J++}s.attributes=q,s.attributesNum=J,s.index=F}function v(){let N=s.newAttributes;for(let U=0,W=N.length;U<W;U++)N[U]=0}function m(N){p(N,0)}function p(N,U){let W=s.newAttributes,F=s.enabledAttributes,q=s.attributeDivisors;W[N]=1,F[N]===0&&(i.enableVertexAttribArray(N),F[N]=1),q[N]!==U&&(i.vertexAttribDivisor(N,U),q[N]=U)}function _(){let N=s.newAttributes,U=s.enabledAttributes;for(let W=0,F=U.length;W<F;W++)U[W]!==N[W]&&(i.disableVertexAttribArray(W),U[W]=0)}function A(N,U,W,F,q,Z,J){J===!0?i.vertexAttribIPointer(N,U,W,q,Z):i.vertexAttribPointer(N,U,W,F,q,Z)}function M(N,U,W,F){v();let q=F.attributes,Z=W.getAttributes(),J=U.defaultAttributeValues;for(let re in Z){let Q=Z[re];if(Q.location>=0){let ne=q[re];if(ne===void 0&&(re==="instanceMatrix"&&N.instanceMatrix&&(ne=N.instanceMatrix),re==="instanceColor"&&N.instanceColor&&(ne=N.instanceColor)),ne!==void 0){let se=ne.normalized,ke=ne.itemSize,Re=e.get(ne);if(Re===void 0)continue;let mt=Re.buffer,st=Re.type,ct=Re.bytesPerElement,ee=st===i.INT||st===i.UNSIGNED_INT||ne.gpuType===Tc;if(ne.isInterleavedBufferAttribute){let le=ne.data,Ee=le.stride,Ke=ne.offset;if(le.isInstancedInterleavedBuffer){for(let Ie=0;Ie<Q.locationSize;Ie++)p(Q.location+Ie,le.meshPerAttribute);N.isInstancedMesh!==!0&&F._maxInstanceCount===void 0&&(F._maxInstanceCount=le.meshPerAttribute*le.count)}else for(let Ie=0;Ie<Q.locationSize;Ie++)m(Q.location+Ie);i.bindBuffer(i.ARRAY_BUFFER,mt);for(let Ie=0;Ie<Q.locationSize;Ie++)A(Q.location+Ie,ke/Q.locationSize,st,se,Ee*ct,(Ke+ke/Q.locationSize*Ie)*ct,ee)}else{if(ne.isInstancedBufferAttribute){for(let le=0;le<Q.locationSize;le++)p(Q.location+le,ne.meshPerAttribute);N.isInstancedMesh!==!0&&F._maxInstanceCount===void 0&&(F._maxInstanceCount=ne.meshPerAttribute*ne.count)}else for(let le=0;le<Q.locationSize;le++)m(Q.location+le);i.bindBuffer(i.ARRAY_BUFFER,mt);for(let le=0;le<Q.locationSize;le++)A(Q.location+le,ke/Q.locationSize,st,se,ke*ct,ke/Q.locationSize*le*ct,ee)}}else if(J!==void 0){let se=J[re];if(se!==void 0)switch(se.length){case 2:i.vertexAttrib2fv(Q.location,se);break;case 3:i.vertexAttrib3fv(Q.location,se);break;case 4:i.vertexAttrib4fv(Q.location,se);break;default:i.vertexAttrib1fv(Q.location,se)}}}}_()}function T(){R();for(let N in n){let U=n[N];for(let W in U){let F=U[W];for(let q in F){let Z=F[q];for(let J in Z)h(Z[J].object),delete Z[J];delete F[q]}}delete n[N]}}function S(N){if(n[N.id]===void 0)return;let U=n[N.id];for(let W in U){let F=U[W];for(let q in F){let Z=F[q];for(let J in Z)h(Z[J].object),delete Z[J];delete F[q]}}delete n[N.id]}function I(N){for(let U in n){let W=n[U];for(let F in W){let q=W[F];if(q[N.id]===void 0)continue;let Z=q[N.id];for(let J in Z)h(Z[J].object),delete Z[J];delete q[N.id]}}}function b(N){for(let U in n){let W=n[U],F=N.isInstancedMesh===!0?N.id:0,q=W[F];if(q!==void 0){for(let Z in q){let J=q[Z];for(let re in J)h(J[re].object),delete J[re];delete q[Z]}delete W[F],Object.keys(W).length===0&&delete n[U]}}}function R(){L(),a=!0,s!==r&&(s=r,c(s.object))}function L(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:o,reset:R,resetDefaultState:L,dispose:T,releaseStatesOfGeometry:S,releaseStatesOfObject:b,releaseStatesOfProgram:I,initAttributes:v,enableAttribute:m,disableUnusedAttributes:_}}function l4(i,e,t){let n;function r(l){n=l}function s(l,c){i.drawArrays(n,l,c),t.update(c,n,1)}function a(l,c,h){h!==0&&(i.drawArraysInstanced(n,l,c,h),t.update(c,n,h))}function o(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let u=0;for(let f=0;f<h;f++)u+=c[f];t.update(u,n,1)}this.setMode=r,this.render=s,this.renderInstances=a,this.renderMultiDraw=o}function c4(i,e,t,n){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let I=e.get("EXT_texture_filter_anisotropic");r=i.getParameter(I.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function a(I){return!(I!==li&&n.convert(I)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(I){let b=I===Sn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(I!==ei&&I!==yi&&!b&&n.convert(I)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function l(I){if(I==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";I="mediump"}return I==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",h=l(c);h!==c&&(qe("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let d=t.logarithmicDepthBuffer===!0,u=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&u===!1&&qe("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),p=i.getParameter(i.MAX_VERTEX_ATTRIBS),_=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),A=i.getParameter(i.MAX_VARYING_VECTORS),M=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),T=i.getParameter(i.MAX_SAMPLES),S=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:u,maxTextures:f,maxVertexTextures:g,maxTextureSize:v,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:_,maxVaryings:A,maxFragmentUniforms:M,maxSamples:T,samples:S}}function h4(i){let e=this,t=null,n=0,r=!1,s=!1,a=new mi,o=new je,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,u){let f=d.length!==0||u||n!==0||r;return r=u,n=d.length,f},this.beginShadows=function(){s=!0,h(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(d,u){t=h(d,u,0)},this.setState=function(d,u,f){let g=d.clippingPlanes,v=d.clipIntersection,m=d.clipShadows,p=i.get(d);if(!r||g===null||g.length===0||s&&!m)s?h(null):c();else{let _=s?0:n,A=_*4,M=p.clippingState||null;l.value=M,M=h(g,u,A,f);for(let T=0;T!==A;++T)M[T]=t[T];p.clippingState=M,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=_}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(d,u,f,g){let v=d!==null?d.length:0,m=null;if(v!==0){if(m=l.value,g!==!0||m===null){let p=f+v*4,_=u.matrixWorldInverse;o.getNormalMatrix(_),(m===null||m.length<p)&&(m=new Float32Array(p));for(let A=0,M=f;A!==v;++A,M+=4)a.copy(d[A]).applyMatrix4(_,o),a.normal.toArray(m,M),m[M+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=v,e.numIntersection=0,m}}var Ks=4,u4=6,d4=20,f4=256,mo=new ts,Ym=new tt,ed=null,td=0,nd=0,id=!1,p4=new V,as=new V,u0=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,s={}){let{size:a=256,position:o=p4}=s;ed=this._renderer.getRenderTarget(),td=this._renderer.getActiveCubeFace(),nd=this._renderer.getActiveMipmapLevel(),id=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,r,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Jm(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Zm(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(ed,td,nd),this._renderer.xr.enabled=id,e.scissorTest=!1,Ys(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Nr||e.mapping===rs?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),ed=this._renderer.getRenderTarget(),td=this._renderer.getActiveCubeFace(),nd=this._renderer.getActiveMipmapLevel(),id=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Mn,minFilter:Mn,generateMipmaps:!1,type:Sn,format:li,colorSpace:Ia,depthBuffer:!1},r=Km(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Km(e,t,n);let{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=m4(s)),this._blurMaterial=x4(s,e,t),this._ggxMaterial=g4(s,e,t)}return r}_compileMaterial(e){let t=new kn(new _n,e);this._renderer.compile(t,mo)}_sceneToCubeUV(e,t,n,r,s){let l=new Rn(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],d=this._renderer,u=d.autoClear,f=d.toneMapping;d.getClearColor(Ym),d.toneMapping=xi,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(r),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new kn(new Vs,new es({name:"PMREM.Background",side:Un,depthWrite:!1,depthTest:!1})));let v=this._backgroundBox,m=v.material,p=!1,_=e.background;_?_.isColor&&(m.color.copy(_),e.background=null,p=!0):(m.color.copy(Ym),p=!0);for(let A=0;A<6;A++){let M=A%3;M===0?(l.up.set(0,c[A],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+h[A],s.y,s.z)):M===1?(l.up.set(0,0,c[A]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+h[A],s.z)):(l.up.set(0,c[A],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+h[A]));let T=this._cubeSize;Ys(r,M*T,A>2?T:0,T,T),d.setRenderTarget(r),p&&d.render(v,l),d.render(e,l)}d.toneMapping=f,d.autoClear=u,e.background=_}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===Nr||e.mapping===rs;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Jm()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Zm());let s=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=s;let o=s.uniforms;o.envMap.value=e;let l=this._cubeSize;Ys(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,mo)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let s=1;s<r;s++)this._applyGGXFilter(e,s-1,s);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,s=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let l=a.uniforms,c=n/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),d=Math.sqrt(c*c-h*h),u=c*1.25,f=d*u,{_lodMax:g}=this,v=this._sizeLods[n],m=3*v*(n>g-Ks?n-g+Ks:0),p=4*(this._cubeSize-v);l.envMap.value=e.texture,l.roughness.value=f,l.mipInt.value=g-t,Ys(s,m,p,3*v,2*v),r.setRenderTarget(s),r.render(o,mo),l.envMap.value=s.texture,l.roughness.value=0,l.mipInt.value=g-n,Ys(e,m,p,3*v,2*v),r.setRenderTarget(e),r.render(o,mo)}_blur(e,t,n,r){let s=this._pingPongRenderTarget,a=Math.min(r,Math.PI)/Math.SQRT2;this._blurPass(e,s,t,n,a),this._blurPass(s,e,n,n,a)}_blurPass(e,t,n,r,s){let a=this._renderer,o=this._blurMaterial,l=this._lodMeshes[r];l.material=o;let c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=s,c.mipInt.value=this._lodMax-n;let h=this._sizeLods[r],d=3*h*(r>this._lodMax-Ks?r-this._lodMax+Ks:0),u=4*(this._cubeSize-h);Ys(t,d,u,3*h,2*h),a.setRenderTarget(t),a.render(l,mo)}};function m4(i){let e=[],t=[],n=i,r=i-Ks+1+u4;for(let s=0;s<r;s++){let a=Math.pow(2,n);e.push(a);let o=1/(a-2),l=-o,c=1+o,h=[l,l,c,l,c,c,l,l,c,c,l,c],d=6,u=6,f=3,g=new Float32Array(f*u*d),v=new Float32Array(f*u*d);for(let p=0;p<d;p++){let _=p%3*2/3-1,A=p>2?0:-1,M=[_,A,0,_+2/3,A,0,_+2/3,A+1,0,_,A,0,_+2/3,A+1,0,_,A+1,0];g.set(M,f*u*p);for(let T=0;T<u;T++){let S=h[T*2]*2-1,I=h[T*2+1]*2-1;p===0?as.set(1,I,S):p===1?as.set(-S,1,-I):p===2?as.set(-S,I,1):p===3?as.set(-1,I,-S):p===4?as.set(-S,-1,I):as.set(S,I,-1),as.toArray(v,(p*u+T)*f)}}let m=new _n;m.setAttribute("position",new sn(g,f)),m.setAttribute("outputDirection",new sn(v,f)),t.push(new kn(m,null)),n>Ks&&n--}return{lodMeshes:t,sizeLods:e}}function Km(i,e,t){let n=new on(i,e,t);return n.texture.mapping=so,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Ys(i,e,t,n,r){i.viewport.set(e,t,n,r),i.scissor.set(e,t,n,r)}function g4(i,e,t){return new Ut({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:f4,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:p0(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:oi,depthTest:!1,depthWrite:!1})}function x4(i,e,t){return new Ut({name:"SphericalGaussianBlur",defines:{SAMPLES:d4,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:p0(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:oi,depthTest:!1,depthWrite:!1})}function Zm(){return new Ut({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:p0(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:oi,depthTest:!1,depthWrite:!1})}function Jm(){return new Ut({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:p0(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:oi,depthTest:!1,depthWrite:!1})}function p0(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var d0=class extends on{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new Ga(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new Vs(5,5,5),s=new Ut({name:"CubemapFromEquirect",uniforms:ss(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Un,blending:oi});s.uniforms.tEquirect.value=t;let a=new kn(r,s),o=t.minFilter;return t.minFilter===Fr&&(t.minFilter=Mn),new yc(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let s=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,r);e.setRenderTarget(s)}};function v4(i){let e=new WeakMap,t=new WeakMap,n=null;function r(u,f=!1){return u==null?null:f?a(u):s(u)}function s(u){if(u&&u.isTexture){let f=u.mapping;if(f===Mc||f===Sc)if(e.has(u)){let g=e.get(u).texture;return o(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let v=new d0(g.height);return v.fromEquirectangularTexture(i,u),e.set(u,v),u.addEventListener("dispose",c),o(v.texture,u.mapping)}else return null}}return u}function a(u){if(u&&u.isTexture){let f=u.mapping,g=f===Mc||f===Sc,v=f===Nr||f===rs;if(g||v){let m=t.get(u),p=m!==void 0?m.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==p)return n===null&&(n=new u0(i)),m=g?n.fromEquirectangular(u,m):n.fromCubemap(u,m),m.texture.pmremVersion=u.pmremVersion,t.set(u,m),m.texture;if(m!==void 0)return m.texture;{let _=u.image;return g&&_&&_.height>0||v&&_&&l(_)?(n===null&&(n=new u0(i)),m=g?n.fromEquirectangular(u):n.fromCubemap(u),m.texture.pmremVersion=u.pmremVersion,t.set(u,m),u.addEventListener("dispose",h),m.texture):null}}}return u}function o(u,f){return f===Mc?u.mapping=Nr:f===Sc&&(u.mapping=rs),u}function l(u){let f=0,g=6;for(let v=0;v<g;v++)u[v]!==void 0&&f++;return f===g}function c(u){let f=u.target;f.removeEventListener("dispose",c);let g=e.get(f);g!==void 0&&(e.delete(f),g.dispose())}function h(u){let f=u.target;f.removeEventListener("dispose",h);let g=t.get(f);g!==void 0&&(t.delete(f),g.dispose())}function d(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:r,dispose:d}}function y4(i){let e={};function t(n){if(e[n]!==void 0)return e[n];let r=i.getExtension(n);return e[n]=r,r}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let r=t(n);return r===null&&Qr("WebGLRenderer: "+n+" extension not supported."),r}}}function b4(i,e,t,n){let r={},s=new WeakMap;function a(d){let u=d.target;u.index!==null&&e.remove(u.index);for(let g in u.attributes)e.remove(u.attributes[g]);u.removeEventListener("dispose",a),delete r[u.id];let f=s.get(u);f&&(e.remove(f),s.delete(u)),n.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,t.memory.geometries--}function o(d,u){return r[u.id]===!0||(u.addEventListener("dispose",a),r[u.id]=!0,t.memory.geometries++),u}function l(d){let u=d.attributes;for(let f in u)e.update(u[f],i.ARRAY_BUFFER)}function c(d){let u=[],f=d.index,g=d.attributes.position,v=0;if(g===void 0)return;if(f!==null){let _=f.array;v=f.version;for(let A=0,M=_.length;A<M;A+=3){let T=_[A+0],S=_[A+1],I=_[A+2];u.push(T,S,S,I,I,T)}}else{let _=g.array;v=g.version;for(let A=0,M=_.length/3-1;A<M;A+=3){let T=A+0,S=A+1,I=A+2;u.push(T,S,S,I,I,T)}}let m=new(g.count>=65535?Ba:Ua)(u,1);m.version=v;let p=s.get(d);p&&e.remove(p),s.set(d,m)}function h(d){let u=s.get(d);if(u){let f=d.index;f!==null&&u.version<f.version&&c(d)}else c(d);return s.get(d)}return{get:o,update:l,getWireframeAttribute:h}}function _4(i,e,t){let n;function r(d){n=d}let s,a;function o(d){s=d.type,a=d.bytesPerElement}function l(d,u){i.drawElements(n,u,s,d*a),t.update(u,n,1)}function c(d,u,f){f!==0&&(i.drawElementsInstanced(n,u,s,d*a,f),t.update(u,n,f))}function h(d,u,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,s,d,0,f);let v=0;for(let m=0;m<f;m++)v+=u[m];t.update(v,n,1)}this.setMode=r,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function M4(i){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(s/3);break;case i.LINES:t.lines+=o*(s/2);break;case i.LINE_STRIP:t.lines+=o*(s-1);break;case i.LINE_LOOP:t.lines+=o*s;break;case i.POINTS:t.points+=o*s;break;default:Ye("WebGLInfo: Unknown draw mode:",a);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:n}}function S4(i,e,t){let n=new WeakMap,r=new qt;function s(a,o,l){let c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,d=h!==void 0?h.length:0,u=n.get(o);if(u===void 0||u.count!==d){let R=function(){I.dispose(),n.delete(o),o.removeEventListener("dispose",R)};u!==void 0&&u.texture.dispose();let f=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,v=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],p=o.morphAttributes.normal||[],_=o.morphAttributes.color||[],A=0;f===!0&&(A=1),g===!0&&(A=2),v===!0&&(A=3);let M=o.attributes.position.count*A,T=1;M>e.maxTextureSize&&(T=Math.ceil(M/e.maxTextureSize),M=e.maxTextureSize);let S=new Float32Array(M*T*4*d),I=new Da(S,M,T,d);I.type=yi,I.needsUpdate=!0;let b=A*4;for(let L=0;L<d;L++){let N=m[L],U=p[L],W=_[L],F=M*T*4*L;for(let q=0;q<N.count;q++){let Z=q*b;f===!0&&(r.fromBufferAttribute(N,q),S[F+Z+0]=r.x,S[F+Z+1]=r.y,S[F+Z+2]=r.z,S[F+Z+3]=0),g===!0&&(r.fromBufferAttribute(U,q),S[F+Z+4]=r.x,S[F+Z+5]=r.y,S[F+Z+6]=r.z,S[F+Z+7]=0),v===!0&&(r.fromBufferAttribute(W,q),S[F+Z+8]=r.x,S[F+Z+9]=r.y,S[F+Z+10]=r.z,S[F+Z+11]=W.itemSize===4?r.w:1)}}u={count:d,texture:I,size:new Le(M,T)},n.set(o,u),o.addEventListener("dispose",R)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let f=0;for(let v=0;v<c.length;v++)f+=c[v];let g=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",u.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",u.size)}return{update:s}}function w4(i,e,t,n,r){let s=new WeakMap;function a(c){let h=r.render.frame,d=c.geometry,u=e.get(c,d);if(s.get(u)!==h&&(e.update(u),s.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),s.get(c)!==h&&(t.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,i.ARRAY_BUFFER),s.set(c,h))),c.isSkinnedMesh){let f=c.skeleton;s.get(f)!==h&&(f.update(),s.set(f,h))}return u}function o(){s=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:a,dispose:o}}var T4={[Qa]:"LINEAR_TONE_MAPPING",[eo]:"REINHARD_TONE_MAPPING",[to]:"CINEON_TONE_MAPPING",[is]:"ACES_FILMIC_TONE_MAPPING",[io]:"AGX_TONE_MAPPING",[ro]:"NEUTRAL_TONE_MAPPING",[no]:"CUSTOM_TONE_MAPPING"};function A4(i,e,t,n,r,s){let a=new on(e,t,{type:i,depthBuffer:r,stencilBuffer:s,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),o=null,l=null,c=new _n;c.setAttribute("position",new an([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new an([0,2,0,0,2,0],2));let h=new Gs({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new kn(c,h),u=new ts(-1,1,1,-1,0,1),f=null,g=null,v=!1,m,p=null,_=[],A=!1;this.setSize=function(M,T){a.setSize(M,T),o!==null&&o.setSize(M,T),l!==null&&l.setSize(M,T);for(let S=0;S<_.length;S++){let I=_[S];I.setSize&&I.setSize(M,T)}},this.setEffects=function(M){_=M,A=_.length>0&&_[0].isRenderPass===!0;let T=a.width,S=a.height;_.length>0&&o===null&&(o=new on(T,S,{type:Sn,depthBuffer:!1,stencilBuffer:!1}),l=new on(T,S,{type:Sn,depthBuffer:!1,stencilBuffer:!1}));for(let I=0;I<_.length;I++){let b=_[I];b.setSize&&b.setSize(T,S)}},this.begin=function(M,T){if(v||M.toneMapping===xi&&_.length===0)return!1;if(p=T,T!==null){let S=T.width,I=T.height;(a.width!==S||a.height!==I)&&this.setSize(S,I)}return A===!1&&M.setRenderTarget(a),m=M.toneMapping,M.toneMapping=xi,!0},this.hasRenderPass=function(){return A},this.end=function(M,T){M.toneMapping=m,v=!0;let S=a,I=o;for(let b=0;b<_.length;b++){let R=_[b];R.enabled!==!1&&(R.render(M,I,S,T),R.needsSwap!==!1&&(S=I,I=I===o?l:o))}if(f!==M.outputColorSpace||g!==M.toneMapping){f=M.outputColorSpace,g=M.toneMapping,h.defines={},lt.getTransfer(f)===yt&&(h.defines.SRGB_TRANSFER="");let b=T4[g];b&&(h.defines[b]=""),h.needsUpdate=!0}h.uniforms.tDiffuse.value=S.texture,M.setRenderTarget(p),M.render(d,u),p=null,v=!1},this.isCompositing=function(){return v},this.dispose=function(){a.dispose(),o!==null&&o.dispose(),l!==null&&l.dispose(),c.dispose(),h.dispose()}}var x1=new Vn,ad=new Ir(1,1),v1=new Da,y1=new Xl,b1=new Ga,jm=[],Qm=[],e1=new Float32Array(16),t1=new Float32Array(9),n1=new Float32Array(4);function Js(i,e,t){let n=i[0];if(n<=0||n>0)return i;let r=e*t,s=jm[r];if(s===void 0&&(s=new Float32Array(r),jm[r]=s),e!==0){n.toArray(s,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(s,o)}return s}function pn(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function mn(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function m0(i,e){let t=Qm[e];t===void 0&&(t=new Int32Array(e),Qm[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function E4(i,e){let t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function C4(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(pn(t,e))return;i.uniform2fv(this.addr,e),mn(t,e)}}function R4(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(pn(t,e))return;i.uniform3fv(this.addr,e),mn(t,e)}}function k4(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(pn(t,e))return;i.uniform4fv(this.addr,e),mn(t,e)}}function I4(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(pn(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),mn(t,e)}else{if(pn(t,n))return;n1.set(n),i.uniformMatrix2fv(this.addr,!1,n1),mn(t,n)}}function P4(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(pn(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),mn(t,e)}else{if(pn(t,n))return;t1.set(n),i.uniformMatrix3fv(this.addr,!1,t1),mn(t,n)}}function z4(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(pn(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),mn(t,e)}else{if(pn(t,n))return;e1.set(n),i.uniformMatrix4fv(this.addr,!1,e1),mn(t,n)}}function L4(i,e){let t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function D4(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(pn(t,e))return;i.uniform2iv(this.addr,e),mn(t,e)}}function N4(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(pn(t,e))return;i.uniform3iv(this.addr,e),mn(t,e)}}function F4(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(pn(t,e))return;i.uniform4iv(this.addr,e),mn(t,e)}}function U4(i,e){let t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function B4(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(pn(t,e))return;i.uniform2uiv(this.addr,e),mn(t,e)}}function O4(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(pn(t,e))return;i.uniform3uiv(this.addr,e),mn(t,e)}}function V4(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(pn(t,e))return;i.uniform4uiv(this.addr,e),mn(t,e)}}function H4(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r);let s;this.type===i.SAMPLER_2D_SHADOW?(ad.compareFunction=t.isReversedDepthBuffer()?l0:o0,s=ad):s=x1,t.setTexture2D(e||s,r)}function G4(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture3D(e||y1,r)}function W4(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTextureCube(e||b1,r)}function q4(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture2DArray(e||v1,r)}function X4(i){switch(i){case 5126:return E4;case 35664:return C4;case 35665:return R4;case 35666:return k4;case 35674:return I4;case 35675:return P4;case 35676:return z4;case 5124:case 35670:return L4;case 35667:case 35671:return D4;case 35668:case 35672:return N4;case 35669:case 35673:return F4;case 5125:return U4;case 36294:return B4;case 36295:return O4;case 36296:return V4;case 35678:case 36198:case 36298:case 36306:case 35682:return H4;case 35679:case 36299:case 36307:return G4;case 35680:case 36300:case 36308:case 36293:return W4;case 36289:case 36303:case 36311:case 36292:return q4}}function $4(i,e){i.uniform1fv(this.addr,e)}function Y4(i,e){let t=Js(e,this.size,2);i.uniform2fv(this.addr,t)}function K4(i,e){let t=Js(e,this.size,3);i.uniform3fv(this.addr,t)}function Z4(i,e){let t=Js(e,this.size,4);i.uniform4fv(this.addr,t)}function J4(i,e){let t=Js(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function j4(i,e){let t=Js(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function Q4(i,e){let t=Js(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function eb(i,e){i.uniform1iv(this.addr,e)}function tb(i,e){i.uniform2iv(this.addr,e)}function nb(i,e){i.uniform3iv(this.addr,e)}function ib(i,e){i.uniform4iv(this.addr,e)}function rb(i,e){i.uniform1uiv(this.addr,e)}function sb(i,e){i.uniform2uiv(this.addr,e)}function ab(i,e){i.uniform3uiv(this.addr,e)}function ob(i,e){i.uniform4uiv(this.addr,e)}function lb(i,e,t){let n=this.cache,r=e.length,s=m0(t,r);pn(n,s)||(i.uniform1iv(this.addr,s),mn(n,s));let a;this.type===i.SAMPLER_2D_SHADOW?a=ad:a=x1;for(let o=0;o!==r;++o)t.setTexture2D(e[o]||a,s[o])}function cb(i,e,t){let n=this.cache,r=e.length,s=m0(t,r);pn(n,s)||(i.uniform1iv(this.addr,s),mn(n,s));for(let a=0;a!==r;++a)t.setTexture3D(e[a]||y1,s[a])}function hb(i,e,t){let n=this.cache,r=e.length,s=m0(t,r);pn(n,s)||(i.uniform1iv(this.addr,s),mn(n,s));for(let a=0;a!==r;++a)t.setTextureCube(e[a]||b1,s[a])}function ub(i,e,t){let n=this.cache,r=e.length,s=m0(t,r);pn(n,s)||(i.uniform1iv(this.addr,s),mn(n,s));for(let a=0;a!==r;++a)t.setTexture2DArray(e[a]||v1,s[a])}function db(i){switch(i){case 5126:return $4;case 35664:return Y4;case 35665:return K4;case 35666:return Z4;case 35674:return J4;case 35675:return j4;case 35676:return Q4;case 5124:case 35670:return eb;case 35667:case 35671:return tb;case 35668:case 35672:return nb;case 35669:case 35673:return ib;case 5125:return rb;case 36294:return sb;case 36295:return ab;case 36296:return ob;case 35678:case 36198:case 36298:case 36306:case 35682:return lb;case 35679:case 36299:case 36307:return cb;case 35680:case 36300:case 36308:case 36293:return hb;case 36289:case 36303:case 36311:case 36292:return ub}}var od=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=X4(t.type)}},ld=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=db(t.type)}},cd=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let s=0,a=r.length;s!==a;++s){let o=r[s];o.setValue(e,t[o.id],n)}}},rd=/(\w+)(\])?(\[|\.)?/g;function i1(i,e){i.seq.push(e),i.map[e.id]=e}function fb(i,e,t){let n=i.name,r=n.length;for(rd.lastIndex=0;;){let s=rd.exec(n),a=rd.lastIndex,o=s[1],l=s[2]==="]",c=s[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===r){i1(t,c===void 0?new od(o,i,e):new ld(o,i,e));break}else{let d=t.map[o];d===void 0&&(d=new cd(o),i1(t,d)),t=d}}}var Zs=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){let o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);fb(o,l,this)}let r=[],s=[];for(let a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(a):s.push(a);r.length>0&&(this.seq=r.concat(s))}setValue(e,t,n,r){let s=this.map[t];s!==void 0&&s.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let s=0,a=t.length;s!==a;++s){let o=t[s],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,s=e.length;r!==s;++r){let a=e[r];a.id in t&&n.push(a)}return n}};function r1(i,e,t){let n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}var pb=37297,mb=0;function gb(i,e){let t=i.split(`
`),n=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let a=r;a<s;a++){let o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}var s1=new je;function xb(i){lt._getMatrix(s1,lt.workingColorSpace,i);let e=`mat3( ${s1.elements.map(t=>t.toFixed(4))} )`;switch(lt.getTransfer(i)){case Pa:return[e,"LinearTransferOETF"];case yt:return[e,"sRGBTransferOETF"];default:return qe("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function a1(i,e,t){let n=i.getShaderParameter(e,i.COMPILE_STATUS),s=(i.getShaderInfoLog(e)||"").trim();if(n&&s==="")return"";let a=/ERROR: 0:(\d+)/.exec(s);if(a){let o=parseInt(a[1]);return t.toUpperCase()+`

`+s+`

`+gb(i.getShaderSource(e),o)}else return s}function vb(i,e){let t=xb(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var yb={[Qa]:"Linear",[eo]:"Reinhard",[to]:"Cineon",[is]:"ACESFilmic",[io]:"AgX",[ro]:"Neutral",[no]:"Custom"};function bb(i,e){let t=yb[e];return t===void 0?(qe("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var h0=new V;function _b(){lt.getLuminanceCoefficients(h0);let i=h0.x.toFixed(4),e=h0.y.toFixed(4),t=h0.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Mb(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(xo).join(`
`)}function Sb(i){let e=[];for(let t in i){let n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function wb(i,e){let t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let r=0;r<n;r++){let s=i.getActiveAttrib(e,r),a=s.name,o=1;s.type===i.FLOAT_MAT2&&(o=2),s.type===i.FLOAT_MAT3&&(o=3),s.type===i.FLOAT_MAT4&&(o=4),t[a]={type:s.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function xo(i){return i!==""}function o1(i,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function l1(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var Tb=/^[ \t]*#include +<([\w\d./]+)>/gm;function hd(i){return i.replace(Tb,Eb)}var Ab=new Map;function Eb(i,e){let t=rt[e];if(t===void 0){let n=Ab.get(e);if(n!==void 0)t=rt[n],qe('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return hd(t)}var Cb=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function c1(i){return i.replace(Cb,Rb)}function Rb(i,e,t,n){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function h1(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}var kb={[ja]:"SHADOWMAP_TYPE_PCF",[Ws]:"SHADOWMAP_TYPE_VSM"};function Ib(i){return kb[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var Pb={[Nr]:"ENVMAP_TYPE_CUBE",[rs]:"ENVMAP_TYPE_CUBE",[so]:"ENVMAP_TYPE_CUBE_UV"};function zb(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":Pb[i.envMapMode]||"ENVMAP_TYPE_CUBE"}var Lb={[rs]:"ENVMAP_MODE_REFRACTION"};function Db(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":Lb[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Nb={[Iu]:"ENVMAP_BLENDING_MULTIPLY",[Cm]:"ENVMAP_BLENDING_MIX",[Rm]:"ENVMAP_BLENDING_ADD"};function Fb(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Nb[i.combine]||"ENVMAP_BLENDING_NONE"}function Ub(i){let e=i.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function Bb(i,e,t,n){let r=i.getContext(),s=t.defines,a=t.vertexShader,o=t.fragmentShader,l=Ib(t),c=zb(t),h=Db(t),d=Fb(t),u=Ub(t),f=Mb(t),g=Sb(s),v=r.createProgram(),m,p,_=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(xo).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(xo).join(`
`),p.length>0&&(p+=`
`)):(m=[h1(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(xo).join(`
`),p=[h1(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+d:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==xi?"#define TONE_MAPPING":"",t.toneMapping!==xi?rt.tonemapping_pars_fragment:"",t.toneMapping!==xi?bb("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",rt.colorspace_pars_fragment,vb("linearToOutputTexel",t.outputColorSpace),_b(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(xo).join(`
`)),a=hd(a),a=o1(a,t),a=l1(a,t),o=hd(o),o=o1(o,t),o=l1(o,t),a=c1(a),o=c1(o),t.isRawShaderMaterial!==!0&&(_=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",t.glslVersion===Hu?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Hu?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);let A=_+m+a,M=_+p+o,T=r1(r,r.VERTEX_SHADER,A),S=r1(r,r.FRAGMENT_SHADER,M);r.attachShader(v,T),r.attachShader(v,S),t.index0AttributeName!==void 0?r.bindAttribLocation(v,0,t.index0AttributeName):t.hasPositionAttribute===!0&&r.bindAttribLocation(v,0,"position"),r.linkProgram(v);function I(N){if(i.debug.checkShaderErrors){let U=r.getProgramInfoLog(v)||"",W=r.getShaderInfoLog(T)||"",F=r.getShaderInfoLog(S)||"",q=U.trim(),Z=W.trim(),J=F.trim(),re=!0,Q=!0;if(r.getProgramParameter(v,r.LINK_STATUS)===!1)if(re=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(r,v,T,S);else{let ne=a1(r,T,"vertex"),se=a1(r,S,"fragment");Ye("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(v,r.VALIDATE_STATUS)+`

Material Name: `+N.name+`
Material Type: `+N.type+`

Program Info Log: `+q+`
`+ne+`
`+se)}else q!==""?qe("WebGLProgram: Program Info Log:",q):(Z===""||J==="")&&(Q=!1);Q&&(N.diagnostics={runnable:re,programLog:q,vertexShader:{log:Z,prefix:m},fragmentShader:{log:J,prefix:p}})}r.deleteShader(T),r.deleteShader(S),b=new Zs(r,v),R=wb(r,v)}let b;this.getUniforms=function(){return b===void 0&&I(this),b};let R;this.getAttributes=function(){return R===void 0&&I(this),R};let L=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return L===!1&&(L=r.getProgramParameter(v,pb)),L},this.destroy=function(){n.releaseStatesOfProgram(this),r.deleteProgram(v),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=mb++,this.cacheKey=e,this.usedTimes=1,this.program=v,this.vertexShader=T,this.fragmentShader=S,this}var Ob=0,ud=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new dd(e),t.set(e,n)),n}},dd=class{constructor(e){this.id=Ob++,this.code=e,this.usedTimes=0}};function Vb(i){return i===Br||i===uo||i===fo}function Hb(i,e,t,n,r,s){let a=new Na,o=new ud,l=new Set,c=[],h=new Map,d=n.logarithmicDepthBuffer,u=n.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(b){return l.add(b),b===0?"uv":`uv${b}`}function v(b,R,L,N,U,W){let F=N.fog,q=U.geometry,Z=b.isMeshStandardMaterial||b.isMeshLambertMaterial||b.isMeshPhongMaterial?N.environment:null,J=b.isMeshStandardMaterial||b.isMeshLambertMaterial&&!b.envMap||b.isMeshPhongMaterial&&!b.envMap,re=e.get(b.envMap||Z,J),Q=re&&re.mapping===so?re.image.height:null,ne=f[b.type];b.precision!==null&&(u=n.getMaxPrecision(b.precision),u!==b.precision&&qe("WebGLProgram.getParameters:",b.precision,"not supported, using",u,"instead."));let se=q.morphAttributes.position||q.morphAttributes.normal||q.morphAttributes.color,ke=se!==void 0?se.length:0,Re=0;q.morphAttributes.position!==void 0&&(Re=1),q.morphAttributes.normal!==void 0&&(Re=2),q.morphAttributes.color!==void 0&&(Re=3);let mt,st,ct,ee;if(ne){let Pt=Bi[ne];mt=Pt.vertexShader,st=Pt.fragmentShader}else{mt=b.vertexShader,st=b.fragmentShader;let Pt=o.getVertexShaderStage(b),_t=o.getFragmentShaderStage(b);o.update(b,Pt,_t),ct=Pt.id,ee=_t.id}let le=i.getRenderTarget(),Ee=i.state.buffers.depth.getReversed(),Ke=U.isInstancedMesh===!0,Ie=U.isBatchedMesh===!0,nt=!!b.map,Bt=!!b.matcap,Qe=!!re,ft=!!b.aoMap,Tt=!!b.lightMap,at=!!b.bumpMap&&b.wireframe===!1,Rt=!!b.normalMap,Jt=!!b.displacementMap,hn=!!b.emissiveMap,Lt=!!b.metalnessMap,$t=!!b.roughnessMap,H=b.anisotropy>0,un=b.clearcoat>0,xt=b.dispersion>0,P=b.retroreflectivity>0,w=b.iridescence>0,X=b.sheen>0,K=b.transmission>0,te=H&&!!b.anisotropyMap,ge=un&&!!b.clearcoatMap,xe=un&&!!b.clearcoatNormalMap,ie=un&&!!b.clearcoatRoughnessMap,oe=w&&!!b.iridescenceMap,ve=w&&!!b.iridescenceThicknessMap,Oe=X&&!!b.sheenColorMap,Me=X&&!!b.sheenRoughnessMap,ye=!!b.specularMap,Ve=!!b.specularColorMap,Xe=!!b.specularIntensityMap,et=K&&!!b.transmissionMap,G=K&&!!b.thicknessMap,be=!!b.gradientMap,ae=!!b.alphaMap,_e=b.alphaTest>0,Ce=!!b.alphaHash,ce=!!b.extensions,He=xi;b.toneMapped&&(le===null||le.isXRRenderTarget===!0)&&(He=i.toneMapping);let Ue={shaderID:ne,shaderType:b.type,shaderName:b.name,vertexShader:mt,fragmentShader:st,defines:b.defines,customVertexShaderID:ct,customFragmentShaderID:ee,isRawShaderMaterial:b.isRawShaderMaterial===!0,glslVersion:b.glslVersion,precision:u,batching:Ie,batchingColor:Ie&&U._colorsTexture!==null,instancing:Ke,instancingColor:Ke&&U.instanceColor!==null,instancingMorph:Ke&&U.morphTexture!==null,outputColorSpace:le===null?i.outputColorSpace:le.isXRRenderTarget===!0?le.texture.colorSpace:lt.workingColorSpace,alphaToCoverage:!!b.alphaToCoverage,map:nt,matcap:Bt,envMap:Qe,envMapMode:Qe&&re.mapping,envMapCubeUVHeight:Q,aoMap:ft,lightMap:Tt,bumpMap:at,normalMap:Rt,displacementMap:Jt,emissiveMap:hn,normalMapObjectSpace:Rt&&b.normalMapType===Pm,normalMapTangentSpace:Rt&&b.normalMapType===Ou,packedNormalMap:Rt&&b.normalMapType===Ou&&Vb(b.normalMap.format),metalnessMap:Lt,roughnessMap:$t,anisotropy:H,anisotropyMap:te,clearcoat:un,clearcoatMap:ge,clearcoatNormalMap:xe,clearcoatRoughnessMap:ie,dispersion:xt,retroreflection:P,iridescence:w,iridescenceMap:oe,iridescenceThicknessMap:ve,sheen:X,sheenColorMap:Oe,sheenRoughnessMap:Me,specularMap:ye,specularColorMap:Ve,specularIntensityMap:Xe,transmission:K,transmissionMap:et,thicknessMap:G,gradientMap:be,opaque:b.transparent===!1&&b.blending===qs&&b.alphaToCoverage===!1,alphaMap:ae,alphaTest:_e,alphaHash:Ce,combine:b.combine,mapUv:nt&&g(b.map.channel),aoMapUv:ft&&g(b.aoMap.channel),lightMapUv:Tt&&g(b.lightMap.channel),bumpMapUv:at&&g(b.bumpMap.channel),normalMapUv:Rt&&g(b.normalMap.channel),displacementMapUv:Jt&&g(b.displacementMap.channel),emissiveMapUv:hn&&g(b.emissiveMap.channel),metalnessMapUv:Lt&&g(b.metalnessMap.channel),roughnessMapUv:$t&&g(b.roughnessMap.channel),anisotropyMapUv:te&&g(b.anisotropyMap.channel),clearcoatMapUv:ge&&g(b.clearcoatMap.channel),clearcoatNormalMapUv:xe&&g(b.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ie&&g(b.clearcoatRoughnessMap.channel),iridescenceMapUv:oe&&g(b.iridescenceMap.channel),iridescenceThicknessMapUv:ve&&g(b.iridescenceThicknessMap.channel),sheenColorMapUv:Oe&&g(b.sheenColorMap.channel),sheenRoughnessMapUv:Me&&g(b.sheenRoughnessMap.channel),specularMapUv:ye&&g(b.specularMap.channel),specularColorMapUv:Ve&&g(b.specularColorMap.channel),specularIntensityMapUv:Xe&&g(b.specularIntensityMap.channel),transmissionMapUv:et&&g(b.transmissionMap.channel),thicknessMapUv:G&&g(b.thicknessMap.channel),alphaMapUv:ae&&g(b.alphaMap.channel),vertexTangents:!!q.attributes.tangent&&(Rt||H),vertexNormals:!!q.attributes.normal,vertexColors:b.vertexColors,vertexAlphas:b.vertexColors===!0&&!!q.attributes.color&&q.attributes.color.itemSize===4,pointsUvs:U.isPoints===!0&&!!q.attributes.uv&&(nt||ae),fog:!!F,useFog:b.fog===!0,fogExp2:!!F&&F.isFogExp2,flatShading:b.wireframe===!1&&(b.flatShading===!0||q.attributes.normal===void 0&&Rt===!1&&(b.isMeshLambertMaterial||b.isMeshPhongMaterial||b.isMeshStandardMaterial||b.isMeshPhysicalMaterial)),sizeAttenuation:b.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:Ee,skinning:U.isSkinnedMesh===!0,hasPositionAttribute:q.attributes.position!==void 0,morphTargets:q.morphAttributes.position!==void 0,morphNormals:q.morphAttributes.normal!==void 0,morphColors:q.morphAttributes.color!==void 0,morphTargetsCount:ke,morphTextureStride:Re,numSunLights:R.sun.length,numDirLights:R.directional.length,numPointLights:R.point.length,numSpotLights:R.spot.length,numSpotLightMaps:R.spotLightMap.length,numRectAreaLights:R.rectArea.length,numHemiLights:R.hemi.length,numSunLightShadows:R.sunShadowMap.length,numDirLightShadows:R.directionalShadowMap.length,numPointLightShadows:R.pointShadowMap.length,numSpotLightShadows:R.spotShadowMap.length,numSpotLightShadowsWithMaps:R.numSpotLightShadowsWithMaps,numLightProbes:R.numLightProbes,numLightProbeGrids:W.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:b.dithering,shadowMapEnabled:i.shadowMap.enabled&&L.length>0,shadowMapType:i.shadowMap.type,toneMapping:He,decodeVideoTexture:nt&&b.map.isVideoTexture===!0&&lt.getTransfer(b.map.colorSpace)===yt,decodeVideoTextureEmissive:hn&&b.emissiveMap.isVideoTexture===!0&&lt.getTransfer(b.emissiveMap.colorSpace)===yt,premultipliedAlpha:b.premultipliedAlpha,doubleSided:b.side===Fi,flipSided:b.side===Un,useDepthPacking:b.depthPacking>=0,depthPacking:b.depthPacking||0,index0AttributeName:b.index0AttributeName,extensionClipCullDistance:ce&&b.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ce&&b.extensions.multiDraw===!0||Ie)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:b.customProgramCacheKey()};return Ue.vertexUv1s=l.has(1),Ue.vertexUv2s=l.has(2),Ue.vertexUv3s=l.has(3),l.clear(),Ue}function m(b){let R=[];if(b.shaderID?R.push(b.shaderID):(R.push(b.customVertexShaderID),R.push(b.customFragmentShaderID)),b.defines!==void 0)for(let L in b.defines)R.push(L),R.push(b.defines[L]);return b.isRawShaderMaterial===!1&&(p(R,b),_(R,b),R.push(i.outputColorSpace)),R.push(b.customProgramCacheKey),R.join()}function p(b,R){b.push(R.precision),b.push(R.outputColorSpace),b.push(R.envMapMode),b.push(R.envMapCubeUVHeight),b.push(R.mapUv),b.push(R.alphaMapUv),b.push(R.lightMapUv),b.push(R.aoMapUv),b.push(R.bumpMapUv),b.push(R.normalMapUv),b.push(R.displacementMapUv),b.push(R.emissiveMapUv),b.push(R.metalnessMapUv),b.push(R.roughnessMapUv),b.push(R.anisotropyMapUv),b.push(R.clearcoatMapUv),b.push(R.clearcoatNormalMapUv),b.push(R.clearcoatRoughnessMapUv),b.push(R.iridescenceMapUv),b.push(R.iridescenceThicknessMapUv),b.push(R.sheenColorMapUv),b.push(R.sheenRoughnessMapUv),b.push(R.specularMapUv),b.push(R.specularColorMapUv),b.push(R.specularIntensityMapUv),b.push(R.transmissionMapUv),b.push(R.thicknessMapUv),b.push(R.combine),b.push(R.fogExp2),b.push(R.sizeAttenuation),b.push(R.morphTargetsCount),b.push(R.morphAttributeCount),b.push(R.numSunLights),b.push(R.numDirLights),b.push(R.numPointLights),b.push(R.numSpotLights),b.push(R.numSpotLightMaps),b.push(R.numHemiLights),b.push(R.numRectAreaLights),b.push(R.numSunLightShadows),b.push(R.numDirLightShadows),b.push(R.numPointLightShadows),b.push(R.numSpotLightShadows),b.push(R.numSpotLightShadowsWithMaps),b.push(R.numLightProbes),b.push(R.shadowMapType),b.push(R.toneMapping),b.push(R.numClippingPlanes),b.push(R.numClipIntersection),b.push(R.depthPacking)}function _(b,R){a.disableAll(),R.instancing&&a.enable(0),R.instancingColor&&a.enable(1),R.instancingMorph&&a.enable(2),R.matcap&&a.enable(3),R.envMap&&a.enable(4),R.normalMapObjectSpace&&a.enable(5),R.normalMapTangentSpace&&a.enable(6),R.clearcoat&&a.enable(7),R.iridescence&&a.enable(8),R.alphaTest&&a.enable(9),R.vertexColors&&a.enable(10),R.vertexAlphas&&a.enable(11),R.vertexUv1s&&a.enable(12),R.vertexUv2s&&a.enable(13),R.vertexUv3s&&a.enable(14),R.vertexTangents&&a.enable(15),R.anisotropy&&a.enable(16),R.alphaHash&&a.enable(17),R.batching&&a.enable(18),R.dispersion&&a.enable(19),R.retroreflection&&a.enable(24),R.batchingColor&&a.enable(20),R.gradientMap&&a.enable(21),R.packedNormalMap&&a.enable(22),R.vertexNormals&&a.enable(23),b.push(a.mask),a.disableAll(),R.fog&&a.enable(0),R.useFog&&a.enable(1),R.flatShading&&a.enable(2),R.logarithmicDepthBuffer&&a.enable(3),R.reversedDepthBuffer&&a.enable(4),R.skinning&&a.enable(5),R.morphTargets&&a.enable(6),R.morphNormals&&a.enable(7),R.morphColors&&a.enable(8),R.premultipliedAlpha&&a.enable(9),R.shadowMapEnabled&&a.enable(10),R.doubleSided&&a.enable(11),R.flipSided&&a.enable(12),R.useDepthPacking&&a.enable(13),R.dithering&&a.enable(14),R.transmission&&a.enable(15),R.sheen&&a.enable(16),R.opaque&&a.enable(17),R.pointsUvs&&a.enable(18),R.decodeVideoTexture&&a.enable(19),R.decodeVideoTextureEmissive&&a.enable(20),R.alphaToCoverage&&a.enable(21),R.numLightProbeGrids>0&&a.enable(22),R.hasPositionAttribute&&a.enable(23),b.push(a.mask)}function A(b){let R=f[b.type],L;if(R){let N=Bi[R];L=rr.clone(N.uniforms)}else L=b.uniforms;return L}function M(b,R){let L=h.get(R);return L!==void 0?++L.usedTimes:(L=new Bb(i,R,b,r),c.push(L),h.set(R,L)),L}function T(b){if(--b.usedTimes===0){let R=c.indexOf(b);c[R]=c[c.length-1],c.pop(),h.delete(b.cacheKey),b.destroy()}}function S(b){o.remove(b)}function I(){o.dispose()}return{getParameters:v,getProgramCacheKey:m,getUniforms:A,acquireProgram:M,releaseProgram:T,releaseShaderCache:S,programs:c,dispose:I}}function Gb(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function r(a,o,l){i.get(a)[o]=l}function s(){i=new WeakMap}return{has:e,get:t,remove:n,update:r,dispose:s}}function Wb(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.materialVariant!==e.materialVariant?i.materialVariant-e.materialVariant:i.z!==e.z?i.z-e.z:i.id-e.id}function u1(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function d1(){let i=[],e=0,t=[],n=[],r=[];function s(){e=0,t.length=0,n.length=0,r.length=0}function a(u){let f=0;return u.isInstancedMesh&&(f+=2),u.isSkinnedMesh&&(f+=1),f}function o(u,f,g,v,m,p){let _=i[e];return _===void 0?(_={id:u.id,object:u,geometry:f,material:g,materialVariant:a(u),groupOrder:v,renderOrder:u.renderOrder,z:m,group:p},i[e]=_):(_.id=u.id,_.object=u,_.geometry=f,_.material=g,_.materialVariant=a(u),_.groupOrder=v,_.renderOrder=u.renderOrder,_.z=m,_.group=p),e++,_}function l(u,f,g,v,m,p,_){_.reversedDepth===!0&&(m=-m);let A=o(u,f,g,v,m,p);g.transmission>0?n.push(A):g.transparent===!0?r.push(A):t.push(A)}function c(u,f,g,v,m,p){let _=o(u,f,g,v,m,p);g.transmission>0?n.unshift(_):g.transparent===!0?r.unshift(_):t.unshift(_)}function h(u,f){t.length>1&&t.sort(u||Wb),n.length>1&&n.sort(f||u1),r.length>1&&r.sort(f||u1)}function d(){for(let u=e,f=i.length;u<f;u++){let g=i[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:n,transparent:r,init:s,push:l,unshift:c,finish:d,sort:h}}function qb(){let i=new WeakMap;function e(n,r){let s=i.get(n),a;return s===void 0?(a=new d1,i.set(n,[a])):r>=s.length?(a=new d1,s.push(a)):a=s[r],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function Xb(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new V,color:new tt};break;case"SpotLight":t={position:new V,direction:new V,color:new tt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new V,color:new tt,distance:0,decay:0};break;case"HemisphereLight":t={direction:new V,skyColor:new tt,groundColor:new tt};break;case"RectAreaLight":t={color:new tt,position:new V,halfWidth:new V,halfHeight:new V};break}return i[e.id]=t,t}}}function $b(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}var Yb=0;function Kb(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function Zb(i){let e=new Xb,t=$b(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new V);let r=new V,s=new It,a=new It;function o(c){let h=0,d=0,u=0;for(let U=0;U<9;U++)n.probe[U].set(0,0,0);let f=0,g=0,v=0,m=0,p=0,_=0,A=0,M=0,T=0,S=0,I=0,b=0,R=0,L=0;c.sort(Kb);for(let U=0,W=c.length;U<W;U++){let F=c[U],q=F.color,Z=F.intensity,J=F.distance,re=null;if(F.shadow&&F.shadow.map&&(F.shadow.map.texture.format===Br?re=F.shadow.map.texture:re=F.shadow.map.depthTexture||F.shadow.map.texture),F.isAmbientLight)h+=q.r*Z,d+=q.g*Z,u+=q.b*Z;else if(F.isLightProbe){for(let Q=0;Q<9;Q++)n.probe[Q].addScaledVector(F.sh.coefficients[Q],Z);L++}else if(F.isSunLight){let Q=e.get(F);if(Q.color.copy(F.color).multiplyScalar(F.intensity),F.castShadow){let ne=F.shadow,se=t.get(F);se.shadowIntensity=ne.intensity,se.shadowBias=ne.bias,se.shadowNormalBias=ne.normalBias,se.shadowRadius=ne.radius,se.shadowMapSize.copy(ne.mapSize).multiply(ne.getFrameExtents()),n.sunShadow[g]=se,n.sunShadowMap[g]=re;let ke=ne.getViewportCount();for(let Re=0;Re<ke;Re++)n.sunShadowMatrix[v+Re]=ne.getMatrix(Re),n.sunShadowCascade[v+Re]=ne._cascadeData[Re];v+=ke,g++}n.sun[f]=Q,f++}else if(F.isDirectionalLight){let Q=e.get(F);if(Q.color.copy(F.color).multiplyScalar(F.intensity),F.castShadow){let ne=F.shadow,se=t.get(F);se.shadowIntensity=ne.intensity,se.shadowBias=ne.bias,se.shadowNormalBias=ne.normalBias,se.shadowRadius=ne.radius,se.shadowMapSize=ne.mapSize,n.directionalShadow[m]=se,n.directionalShadowMap[m]=re,n.directionalShadowMatrix[m]=F.shadow.matrix,T++}n.directional[m]=Q,m++}else if(F.isSpotLight){let Q=e.get(F);Q.position.setFromMatrixPosition(F.matrixWorld),Q.color.copy(q).multiplyScalar(Z),Q.distance=J,Q.coneCos=Math.cos(F.angle),Q.penumbraCos=Math.cos(F.angle*(1-F.penumbra)),Q.decay=F.decay,n.spot[_]=Q;let ne=F.shadow;if(F.map&&(n.spotLightMap[b]=F.map,b++,ne.updateMatrices(F),F.castShadow&&R++),n.spotLightMatrix[_]=ne.matrix,F.castShadow){let se=t.get(F);se.shadowIntensity=ne.intensity,se.shadowBias=ne.bias,se.shadowNormalBias=ne.normalBias,se.shadowRadius=ne.radius,se.shadowMapSize=ne.mapSize,n.spotShadow[_]=se,n.spotShadowMap[_]=re,I++}_++}else if(F.isRectAreaLight){let Q=e.get(F);Q.color.copy(q).multiplyScalar(Z),Q.halfWidth.set(F.width*.5,0,0),Q.halfHeight.set(0,F.height*.5,0),n.rectArea[A]=Q,A++}else if(F.isPointLight){let Q=e.get(F);if(Q.color.copy(F.color).multiplyScalar(F.intensity),Q.distance=F.distance,Q.decay=F.decay,F.castShadow){let ne=F.shadow,se=t.get(F);se.shadowIntensity=ne.intensity,se.shadowBias=ne.bias,se.shadowNormalBias=ne.normalBias,se.shadowRadius=ne.radius,se.shadowMapSize=ne.mapSize,se.shadowCameraNear=ne.camera.near,se.shadowCameraFar=ne.camera.far,n.pointShadow[p]=se,n.pointShadowMap[p]=re,n.pointShadowMatrix[p]=F.shadow.matrix,S++}n.point[p]=Q,p++}else if(F.isHemisphereLight){let Q=e.get(F);Q.skyColor.copy(F.color).multiplyScalar(Z),Q.groundColor.copy(F.groundColor).multiplyScalar(Z),n.hemi[M]=Q,M++}}A>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Se.LTC_FLOAT_1,n.rectAreaLTC2=Se.LTC_FLOAT_2):(n.rectAreaLTC1=Se.LTC_HALF_1,n.rectAreaLTC2=Se.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=d,n.ambient[2]=u;let N=n.hash;(N.sunLength!==f||N.directionalLength!==m||N.pointLength!==p||N.spotLength!==_||N.rectAreaLength!==A||N.hemiLength!==M||N.numSunShadows!==g||N.numDirectionalShadows!==T||N.numPointShadows!==S||N.numSpotShadows!==I||N.numSpotMaps!==b||N.numLightProbes!==L)&&(n.sun.length=f,n.directional.length=m,n.spot.length=_,n.rectArea.length=A,n.point.length=p,n.hemi.length=M,n.sunShadow.length=g,n.sunShadowMap.length=g,n.sunShadowMatrix.length=v,n.sunShadowCascade.length=v,n.directionalShadow.length=T,n.directionalShadowMap.length=T,n.directionalShadowMatrix.length=T,n.pointShadow.length=S,n.pointShadowMap.length=S,n.pointShadowMatrix.length=S,n.spotShadow.length=I,n.spotShadowMap.length=I,n.spotLightMatrix.length=I+b-R,n.spotLightMap.length=b,n.numSpotLightShadowsWithMaps=R,n.numLightProbes=L,N.sunLength=f,N.directionalLength=m,N.pointLength=p,N.spotLength=_,N.rectAreaLength=A,N.hemiLength=M,N.numSunShadows=g,N.numDirectionalShadows=T,N.numPointShadows=S,N.numSpotShadows=I,N.numSpotMaps=b,N.numLightProbes=L,n.version=Yb++)}function l(c,h){let d=0,u=0,f=0,g=0,v=0,m=0,p=h.matrixWorldInverse;for(let _=0,A=c.length;_<A;_++){let M=c[_];if(M.isSunLight){let T=n.sun[d];T.direction.setFromMatrixPosition(M.matrixWorld),T.direction.transformDirection(p),d++}else if(M.isDirectionalLight){let T=n.directional[u];T.direction.setFromMatrixPosition(M.matrixWorld),r.setFromMatrixPosition(M.target.matrixWorld),T.direction.sub(r),T.direction.transformDirection(p),u++}else if(M.isSpotLight){let T=n.spot[g];T.position.setFromMatrixPosition(M.matrixWorld),T.position.applyMatrix4(p),T.direction.setFromMatrixPosition(M.matrixWorld),r.setFromMatrixPosition(M.target.matrixWorld),T.direction.sub(r),T.direction.transformDirection(p),g++}else if(M.isRectAreaLight){let T=n.rectArea[v];T.position.setFromMatrixPosition(M.matrixWorld),T.position.applyMatrix4(p),a.identity(),s.copy(M.matrixWorld),s.premultiply(p),a.extractRotation(s),T.halfWidth.set(M.width*.5,0,0),T.halfHeight.set(0,M.height*.5,0),T.halfWidth.applyMatrix4(a),T.halfHeight.applyMatrix4(a),v++}else if(M.isPointLight){let T=n.point[f];T.position.setFromMatrixPosition(M.matrixWorld),T.position.applyMatrix4(p),f++}else if(M.isHemisphereLight){let T=n.hemi[m];T.direction.setFromMatrixPosition(M.matrixWorld),T.direction.transformDirection(p),m++}}}return{setup:o,setupView:l,state:n}}function f1(i){let e=new Zb(i),t=[],n=[],r=[];function s(u){d.camera=u,t.length=0,n.length=0,r.length=0}function a(u){t.push(u)}function o(u){n.push(u)}function l(u){r.push(u)}function c(){e.setup(t)}function h(u){e.setupView(t,u)}let d={lightsArray:t,shadowsArray:n,lightProbeGridArray:r,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:d,setupLights:c,setupLightsView:h,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function Jb(i){let e=new WeakMap;function t(r,s=0){let a=e.get(r),o;return a===void 0?(o=new f1(i),e.set(r,[o])):s>=a.length?(o=new f1(i),a.push(o)):o=a[s],o}function n(){e=new WeakMap}return{get:t,dispose:n}}var jb=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Qb=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,e_=[new V(1,0,0),new V(-1,0,0),new V(0,1,0),new V(0,-1,0),new V(0,0,1),new V(0,0,-1)],t_=[new V(0,-1,0),new V(0,-1,0),new V(0,0,1),new V(0,0,-1),new V(0,-1,0),new V(0,-1,0)],p1=new It,go=new V,sd=new V;function n_(i,e,t){let n=new Oa,r=new Le,s=new Le,a=new qt,o=new oc,l=new lc,c={},h=t.maxTextureSize,d={[Dr]:Un,[Un]:Dr,[Fi]:Fi},u=new Ut({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Le},radius:{value:4}},vertexShader:jb,fragmentShader:Qb}),f=u.clone();f.defines.HORIZONTAL_PASS=1;let g=new _n;g.setAttribute("position",new sn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let v=new kn(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=ja;let p=this.type;this.render=function(S,I,b){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||S.length===0)return;this.type===cm&&(qe("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=ja);let R=i.getRenderTarget(),L=i.getActiveCubeFace(),N=i.getActiveMipmapLevel(),U=i.state;U.setBlending(oi),U.buffers.depth.getReversed()===!0?U.buffers.color.setClear(0,0,0,0):U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);let W=p!==this.type;W&&I.traverse(function(F){F.material&&(Array.isArray(F.material)?F.material.forEach(q=>q.needsUpdate=!0):F.material.needsUpdate=!0)});for(let F=0,q=S.length;F<q;F++){let Z=S[F],J=Z.shadow;if(J===void 0){qe("WebGLShadowMap:",Z,"has no shadow.");continue}if(J.autoUpdate===!1&&J.needsUpdate===!1)continue;r.copy(J.mapSize);let re=J.getFrameExtents();r.multiply(re),s.copy(J.mapSize),(r.x>h||r.y>h)&&(r.x>h&&(s.x=Math.floor(h/re.x),r.x=s.x*re.x,J.mapSize.x=s.x),r.y>h&&(s.y=Math.floor(h/re.y),r.y=s.y*re.y,J.mapSize.y=s.y));let Q=i.state.buffers.depth.getReversed();if(J.camera._reversedDepth=Q,J.map===null||W===!0){if(J.map!==null&&(J.map.depthTexture!==null&&(J.map.depthTexture.dispose(),J.map.depthTexture=null),J.map.dispose()),this.type===Ws){if(Z.isPointLight){qe("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}J.map=new on(r.x,r.y,{format:Br,type:Sn,minFilter:Mn,magFilter:Mn,generateMipmaps:!1}),J.map.texture.name=Z.name+".shadowMap",J.map.depthTexture=new Ir(r.x,r.y,yi),J.map.depthTexture.name=Z.name+".shadowMapDepth",J.map.depthTexture.format=Li,J.map.depthTexture.compareFunction=null,J.map.depthTexture.minFilter=bn,J.map.depthTexture.magFilter=bn}else Z.isPointLight?(J.map=new d0(r.x),J.map.depthTexture=new Ql(r.x,vi)):(J.map=new on(r.x,r.y),J.map.depthTexture=new Ir(r.x,r.y,vi)),J.map.depthTexture.name=Z.name+".shadowMap",J.map.depthTexture.format=Li,this.type===ja?(J.map.depthTexture.compareFunction=Q?l0:o0,J.map.depthTexture.minFilter=Mn,J.map.depthTexture.magFilter=Mn):(J.map.depthTexture.compareFunction=null,J.map.depthTexture.minFilter=bn,J.map.depthTexture.magFilter=bn);J.camera.updateProjectionMatrix()}J.map.isWebGLCubeRenderTarget!==!0&&(J.map.width!==r.x||J.map.height!==r.y)&&J.map.setSize(r.x,r.y);let ne=J.map.isWebGLCubeRenderTarget?6:J.getViewportCount();Z.isPointLight!==!0&&J.updateMatrices(Z,b);for(let se=0;se<ne;se++){let ke=J.getCamera(se);if(Z.isPointLight){let Re=J.camera,mt=J.matrix,st=Z.distance||Re.far;st!==Re.far&&(Re.far=st,Re.updateProjectionMatrix()),go.setFromMatrixPosition(Z.matrixWorld),Re.position.copy(go),sd.copy(Re.position),sd.add(e_[se]),Re.up.copy(t_[se]),Re.lookAt(sd),Re.updateMatrixWorld(),mt.makeTranslation(-go.x,-go.y,-go.z),p1.multiplyMatrices(Re.projectionMatrix,Re.matrixWorldInverse),J._frustum.setFromProjectionMatrix(p1,Re.coordinateSystem,Re.reversedDepth)}if(J.map.isWebGLCubeRenderTarget)i.setRenderTarget(J.map,se),i.clear();else{se===0&&(i.setRenderTarget(J.map),i.clear());let Re=J.getViewport(se);a.set(s.x*Re.x,s.y*Re.y,s.x*Re.z,s.y*Re.w),U.viewport(a)}n=J.getFrustum(se),M(I,b,ke,Z,this.type)}J.isPointLightShadow!==!0&&this.type===Ws&&_(J,b),J.needsUpdate=!1}p=this.type,m.needsUpdate=!1,i.setRenderTarget(R,L,N)};function _(S,I){let b=e.update(v);u.defines.VSM_SAMPLES!==S.blurSamples&&(u.defines.VSM_SAMPLES=S.blurSamples,f.defines.VSM_SAMPLES=S.blurSamples,u.needsUpdate=!0,f.needsUpdate=!0),S.mapPass===null?S.mapPass=new on(r.x,r.y,{format:Br,type:Sn}):(S.mapPass.width!==S.map.width||S.mapPass.height!==S.map.height)&&S.mapPass.setSize(S.map.width,S.map.height),u.uniforms.shadow_pass.value=S.map.depthTexture,u.uniforms.resolution.value.set(S.map.width,S.map.height),u.uniforms.radius.value=S.radius,i.setRenderTarget(S.mapPass),i.clear(),i.renderBufferDirect(I,null,b,u,v,null),f.uniforms.shadow_pass.value=S.mapPass.texture,f.uniforms.resolution.value.set(S.map.width,S.map.height),f.uniforms.radius.value=S.radius,i.setRenderTarget(S.map),i.clear(),i.renderBufferDirect(I,null,b,f,v,null)}function A(S,I,b,R){let L=null,N=b.isPointLight===!0?S.customDistanceMaterial:S.customDepthMaterial;if(N!==void 0)L=N;else if(L=b.isPointLight===!0?l:o,i.localClippingEnabled&&I.clipShadows===!0&&Array.isArray(I.clippingPlanes)&&I.clippingPlanes.length!==0||I.displacementMap&&I.displacementScale!==0||I.alphaMap&&I.alphaTest>0||I.map&&I.alphaTest>0||I.alphaToCoverage===!0){let U=L.uuid,W=I.uuid,F=c[U];F===void 0&&(F={},c[U]=F);let q=F[W];q===void 0&&(q=L.clone(),F[W]=q,I.addEventListener("dispose",T)),L=q}if(L.visible=I.visible,L.wireframe=I.wireframe,R===Ws?L.side=I.shadowSide!==null?I.shadowSide:I.side:L.side=I.shadowSide!==null?I.shadowSide:d[I.side],L.alphaMap=I.alphaMap,L.alphaTest=I.alphaToCoverage===!0?.5:I.alphaTest,L.map=I.map,L.clipShadows=I.clipShadows,L.clippingPlanes=I.clippingPlanes,L.clipIntersection=I.clipIntersection,L.displacementMap=I.displacementMap,L.displacementScale=I.displacementScale,L.displacementBias=I.displacementBias,L.wireframeLinewidth=I.wireframeLinewidth,L.linewidth=I.linewidth,b.isPointLight===!0&&L.isMeshDistanceMaterial===!0){let U=i.properties.get(L);U.light=b}return L}function M(S,I,b,R,L){if(S.visible===!1)return;if(S.layers.test(I.layers)&&(S.isMesh||S.isLine||S.isPoints)&&(S.castShadow||S.receiveShadow&&L===Ws)&&(!S.frustumCulled||S.intersectsFrustum(n))){S.modelViewMatrix.multiplyMatrices(b.matrixWorldInverse,S.matrixWorld);let W=e.update(S),F=S.material;if(Array.isArray(F)){let q=W.groups;for(let Z=0,J=q.length;Z<J;Z++){let re=q[Z],Q=F[re.materialIndex];if(Q&&Q.visible){let ne=A(S,Q,R,L);S.onBeforeShadow(i,S,I,b,W,ne,re),i.renderBufferDirect(b,null,W,ne,S,re),S.onAfterShadow(i,S,I,b,W,ne,re)}}}else if(F.visible){let q=A(S,F,R,L);S.onBeforeShadow(i,S,I,b,W,q,null),i.renderBufferDirect(b,null,W,q,S,null),S.onAfterShadow(i,S,I,b,W,q,null)}}let U=S.children;for(let W=0,F=U.length;W<F;W++)M(U[W],I,b,R,L)}function T(S){S.target.removeEventListener("dispose",T);for(let b in c){let R=c[b],L=S.target.uuid;L in R&&(R[L].dispose(),delete R[L])}}}function i_(i,e){function t(){let G=!1,be=new qt,ae=null,_e=new qt(0,0,0,0);return{setMask:function(Ce){ae!==Ce&&!G&&(i.colorMask(Ce,Ce,Ce,Ce),ae=Ce)},setLocked:function(Ce){G=Ce},setClear:function(Ce,ce,He,Ue,Pt){Pt===!0&&(Ce*=Ue,ce*=Ue,He*=Ue),be.set(Ce,ce,He,Ue),_e.equals(be)===!1&&(i.clearColor(Ce,ce,He,Ue),_e.copy(be))},reset:function(){G=!1,ae=null,_e.set(-1,0,0,0)}}}function n(){let G=!1,be=!1,ae=null,_e=null,Ce=null;return{setReversed:function(ce){if(be!==ce){let He=e.get("EXT_clip_control");ce?He.clipControlEXT(He.LOWER_LEFT_EXT,He.ZERO_TO_ONE_EXT):He.clipControlEXT(He.LOWER_LEFT_EXT,He.NEGATIVE_ONE_TO_ONE_EXT),be=ce;let Ue=Ce;Ce=null,this.setClear(Ue)}},getReversed:function(){return be},setTest:function(ce){ce?le(i.DEPTH_TEST):Ee(i.DEPTH_TEST)},setMask:function(ce){ae!==ce&&!G&&(i.depthMask(ce),ae=ce)},setFunc:function(ce){if(be&&(ce=Wm[ce]),_e!==ce){switch(ce){case zl:i.depthFunc(i.NEVER);break;case Ll:i.depthFunc(i.ALWAYS);break;case Dl:i.depthFunc(i.LESS);break;case Ns:i.depthFunc(i.LEQUAL);break;case Nl:i.depthFunc(i.EQUAL);break;case Fl:i.depthFunc(i.GEQUAL);break;case Ul:i.depthFunc(i.GREATER);break;case Bl:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}_e=ce}},setLocked:function(ce){G=ce},setClear:function(ce){Ce!==ce&&(Ce=ce,be&&(ce=1-ce),i.clearDepth(ce))},reset:function(){G=!1,ae=null,_e=null,Ce=null,be=!1}}}function r(){let G=!1,be=null,ae=null,_e=null,Ce=null,ce=null,He=null,Ue=null,Pt=null;return{setTest:function(_t){G||(_t?le(i.STENCIL_TEST):Ee(i.STENCIL_TEST))},setMask:function(_t){be!==_t&&!G&&(i.stencilMask(_t),be=_t)},setFunc:function(_t,hi,Mi){(ae!==_t||_e!==hi||Ce!==Mi)&&(i.stencilFunc(_t,hi,Mi),ae=_t,_e=hi,Ce=Mi)},setOp:function(_t,hi,Mi){(ce!==_t||He!==hi||Ue!==Mi)&&(i.stencilOp(_t,hi,Mi),ce=_t,He=hi,Ue=Mi)},setLocked:function(_t){G=_t},setClear:function(_t){Pt!==_t&&(i.clearStencil(_t),Pt=_t)},reset:function(){G=!1,be=null,ae=null,_e=null,Ce=null,ce=null,He=null,Ue=null,Pt=null}}}let s=new t,a=new n,o=new r,l=new WeakMap,c=new WeakMap,h={},d={},u={},f=new WeakMap,g=[],v=null,m=!1,p=null,_=null,A=null,M=null,T=null,S=null,I=null,b=new tt(0,0,0),R=0,L=!1,N=null,U=null,W=null,F=null,q=null,Z=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),J=!1,re=0,Q=i.getParameter(i.VERSION);Q.indexOf("WebGL")!==-1?(re=parseFloat(/^WebGL (\d)/.exec(Q)[1]),J=re>=1):Q.indexOf("OpenGL ES")!==-1&&(re=parseFloat(/^OpenGL ES (\d)/.exec(Q)[1]),J=re>=2);let ne=null,se={},ke=i.getParameter(i.SCISSOR_BOX),Re=i.getParameter(i.VIEWPORT),mt=new qt().fromArray(ke),st=new qt().fromArray(Re);function ct(G,be,ae,_e){let Ce=new Uint8Array(4),ce=i.createTexture();i.bindTexture(G,ce),i.texParameteri(G,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(G,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let He=0;He<ae;He++)G===i.TEXTURE_3D||G===i.TEXTURE_2D_ARRAY?i.texImage3D(be,0,i.RGBA,1,1,_e,0,i.RGBA,i.UNSIGNED_BYTE,Ce):i.texImage2D(be+He,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,Ce);return ce}let ee={};ee[i.TEXTURE_2D]=ct(i.TEXTURE_2D,i.TEXTURE_2D,1),ee[i.TEXTURE_CUBE_MAP]=ct(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),ee[i.TEXTURE_2D_ARRAY]=ct(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),ee[i.TEXTURE_3D]=ct(i.TEXTURE_3D,i.TEXTURE_3D,1,1),s.setClear(0,0,0,1),a.setClear(1),o.setClear(0),le(i.DEPTH_TEST),a.setFunc(Ns),at(!1),Rt(Au),le(i.CULL_FACE),ft(oi);function le(G){h[G]!==!0&&(i.enable(G),h[G]=!0)}function Ee(G){h[G]!==!1&&(i.disable(G),h[G]=!1)}function Ke(G,be){return u[G]!==be?(i.bindFramebuffer(G,be),u[G]=be,G===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=be),G===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=be),!0):!1}function Ie(G,be){let ae=g,_e=!1;if(G){ae=f.get(be),ae===void 0&&(ae=[],f.set(be,ae));let Ce=G.textures;if(ae.length!==Ce.length||ae[0]!==i.COLOR_ATTACHMENT0){for(let ce=0,He=Ce.length;ce<He;ce++)ae[ce]=i.COLOR_ATTACHMENT0+ce;ae.length=Ce.length,_e=!0}}else ae[0]!==i.BACK&&(ae[0]=i.BACK,_e=!0);_e&&i.drawBuffers(ae)}function nt(G){return v!==G?(i.useProgram(G),v=G,!0):!1}let Bt={[ns]:i.FUNC_ADD,[um]:i.FUNC_SUBTRACT,[dm]:i.FUNC_REVERSE_SUBTRACT};Bt[fm]=i.MIN,Bt[pm]=i.MAX;let Qe={[mm]:i.ZERO,[gm]:i.ONE,[xm]:i.SRC_COLOR,[Ru]:i.SRC_ALPHA,[Sm]:i.SRC_ALPHA_SATURATE,[_m]:i.DST_COLOR,[ym]:i.DST_ALPHA,[vm]:i.ONE_MINUS_SRC_COLOR,[ku]:i.ONE_MINUS_SRC_ALPHA,[Mm]:i.ONE_MINUS_DST_COLOR,[bm]:i.ONE_MINUS_DST_ALPHA,[wm]:i.CONSTANT_COLOR,[Tm]:i.ONE_MINUS_CONSTANT_COLOR,[Am]:i.CONSTANT_ALPHA,[Em]:i.ONE_MINUS_CONSTANT_ALPHA};function ft(G,be,ae,_e,Ce,ce,He,Ue,Pt,_t){if(G===oi){m===!0&&(Ee(i.BLEND),m=!1);return}if(m===!1&&(le(i.BLEND),m=!0),G!==hm){if(G!==p||_t!==L){if((_!==ns||T!==ns)&&(i.blendEquation(i.FUNC_ADD),_=ns,T=ns),_t)switch(G){case qs:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case nr:i.blendFunc(i.ONE,i.ONE);break;case Eu:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Cu:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Ye("WebGLState: Invalid blending: ",G);break}else switch(G){case qs:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case nr:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case Eu:Ye("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Cu:Ye("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ye("WebGLState: Invalid blending: ",G);break}A=null,M=null,S=null,I=null,b.set(0,0,0),R=0,p=G,L=_t}return}Ce=Ce||be,ce=ce||ae,He=He||_e,(be!==_||Ce!==T)&&(i.blendEquationSeparate(Bt[be],Bt[Ce]),_=be,T=Ce),(ae!==A||_e!==M||ce!==S||He!==I)&&(i.blendFuncSeparate(Qe[ae],Qe[_e],Qe[ce],Qe[He]),A=ae,M=_e,S=ce,I=He),(Ue.equals(b)===!1||Pt!==R)&&(i.blendColor(Ue.r,Ue.g,Ue.b,Pt),b.copy(Ue),R=Pt),p=G,L=!1}function Tt(G,be){G.side===Fi?Ee(i.CULL_FACE):le(i.CULL_FACE);let ae=G.side===Un;be&&(ae=!ae),at(ae),G.blending===qs&&G.transparent===!1?ft(oi):ft(G.blending,G.blendEquation,G.blendSrc,G.blendDst,G.blendEquationAlpha,G.blendSrcAlpha,G.blendDstAlpha,G.blendColor,G.blendAlpha,G.premultipliedAlpha),a.setFunc(G.depthFunc),a.setTest(G.depthTest),a.setMask(G.depthWrite),s.setMask(G.colorWrite);let _e=G.stencilWrite;o.setTest(_e),_e&&(o.setMask(G.stencilWriteMask),o.setFunc(G.stencilFunc,G.stencilRef,G.stencilFuncMask),o.setOp(G.stencilFail,G.stencilZFail,G.stencilZPass)),hn(G.polygonOffset,G.polygonOffsetFactor,G.polygonOffsetUnits),G.alphaToCoverage===!0?le(i.SAMPLE_ALPHA_TO_COVERAGE):Ee(i.SAMPLE_ALPHA_TO_COVERAGE)}function at(G){N!==G&&(G?i.frontFace(i.CW):i.frontFace(i.CCW),N=G)}function Rt(G){G!==om?(le(i.CULL_FACE),G!==U&&(G===Au?i.cullFace(i.BACK):G===lm?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Ee(i.CULL_FACE),U=G}function Jt(G){G!==W&&(J&&i.lineWidth(G),W=G)}function hn(G,be,ae){G?(le(i.POLYGON_OFFSET_FILL),(F!==be||q!==ae)&&(F=be,q=ae,a.getReversed()&&(be=-be),i.polygonOffset(be,ae))):Ee(i.POLYGON_OFFSET_FILL)}function Lt(G){G?le(i.SCISSOR_TEST):Ee(i.SCISSOR_TEST)}function $t(G){G===void 0&&(G=i.TEXTURE0+Z-1),ne!==G&&(i.activeTexture(G),ne=G)}function H(G,be,ae){ae===void 0&&(ne===null?ae=i.TEXTURE0+Z-1:ae=ne);let _e=se[ae];_e===void 0&&(_e={type:void 0,texture:void 0},se[ae]=_e),(_e.type!==G||_e.texture!==be)&&(ne!==ae&&(i.activeTexture(ae),ne=ae),i.bindTexture(G,be||ee[G]),_e.type=G,_e.texture=be)}function un(){let G=se[ne];G!==void 0&&G.type!==void 0&&(i.bindTexture(G.type,null),G.type=void 0,G.texture=void 0)}function xt(){try{i.compressedTexImage2D(...arguments)}catch(G){Ye("WebGLState:",G)}}function P(){try{i.compressedTexImage3D(...arguments)}catch(G){Ye("WebGLState:",G)}}function w(){try{i.texSubImage2D(...arguments)}catch(G){Ye("WebGLState:",G)}}function X(){try{i.texSubImage3D(...arguments)}catch(G){Ye("WebGLState:",G)}}function K(){try{i.compressedTexSubImage2D(...arguments)}catch(G){Ye("WebGLState:",G)}}function te(){try{i.compressedTexSubImage3D(...arguments)}catch(G){Ye("WebGLState:",G)}}function ge(){try{i.texStorage2D(...arguments)}catch(G){Ye("WebGLState:",G)}}function xe(){try{i.texStorage3D(...arguments)}catch(G){Ye("WebGLState:",G)}}function ie(){try{i.texImage2D(...arguments)}catch(G){Ye("WebGLState:",G)}}function oe(){try{i.texImage3D(...arguments)}catch(G){Ye("WebGLState:",G)}}function ve(G){return d[G]!==void 0?d[G]:i.getParameter(G)}function Oe(G,be){d[G]!==be&&(i.pixelStorei(G,be),d[G]=be)}function Me(G){mt.equals(G)===!1&&(i.scissor(G.x,G.y,G.z,G.w),mt.copy(G))}function ye(G){st.equals(G)===!1&&(i.viewport(G.x,G.y,G.z,G.w),st.copy(G))}function Ve(G,be){let ae=c.get(be);ae===void 0&&(ae=new WeakMap,c.set(be,ae));let _e=ae.get(G);_e===void 0&&(_e=i.getUniformBlockIndex(be,G.name),ae.set(G,_e))}function Xe(G,be){let _e=c.get(be).get(G);l.get(be)!==_e&&(i.uniformBlockBinding(be,_e,G.__bindingPointIndex),l.set(be,_e))}function et(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},d={},ne=null,se={},u={},f=new WeakMap,g=[],v=null,m=!1,p=null,_=null,A=null,M=null,T=null,S=null,I=null,b=new tt(0,0,0),R=0,L=!1,N=null,U=null,W=null,F=null,q=null,mt.set(0,0,i.canvas.width,i.canvas.height),st.set(0,0,i.canvas.width,i.canvas.height),s.reset(),a.reset(),o.reset()}return{buffers:{color:s,depth:a,stencil:o},enable:le,disable:Ee,bindFramebuffer:Ke,drawBuffers:Ie,useProgram:nt,setBlending:ft,setMaterial:Tt,setFlipSided:at,setCullFace:Rt,setLineWidth:Jt,setPolygonOffset:hn,setScissorTest:Lt,activeTexture:$t,bindTexture:H,unbindTexture:un,compressedTexImage2D:xt,compressedTexImage3D:P,texImage2D:ie,texImage3D:oe,pixelStorei:Oe,getParameter:ve,updateUBOMapping:Ve,uniformBlockBinding:Xe,texStorage2D:ge,texStorage3D:xe,texSubImage2D:w,texSubImage3D:X,compressedTexSubImage2D:K,compressedTexSubImage3D:te,scissor:Me,viewport:ye,reset:et}}function r_(i,e,t,n,r,s,a){let o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Le,h=new WeakMap,d=new Set,u,f=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function v(P,w){return g?new OffscreenCanvas(P,w):La("canvas")}function m(P,w,X){let K=1,te=xt(P);if((te.width>X||te.height>X)&&(K=X/Math.max(te.width,te.height)),K<1)if(typeof HTMLImageElement<"u"&&P instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&P instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&P instanceof ImageBitmap||typeof VideoFrame<"u"&&P instanceof VideoFrame){let ge=Math.floor(K*te.width),xe=Math.floor(K*te.height);u===void 0&&(u=v(ge,xe));let ie=w?v(ge,xe):u;return ie.width=ge,ie.height=xe,ie.getContext("2d").drawImage(P,0,0,ge,xe),qe("WebGLRenderer: Texture has been resized from ("+te.width+"x"+te.height+") to ("+ge+"x"+xe+")."),ie}else return"data"in P&&qe("WebGLRenderer: Image in DataTexture is too big ("+te.width+"x"+te.height+")."),P;return P}function p(P){return P.generateMipmaps}function _(P){i.generateMipmap(P)}function A(P){return P.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:P.isWebGL3DRenderTarget?i.TEXTURE_3D:P.isWebGLArrayRenderTarget||P.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function M(P,w,X,K,te,ge=!1){if(P!==null){if(i[P]!==void 0)return i[P];qe("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+P+"'")}let xe;K&&(xe=e.get("EXT_texture_norm16"),xe||qe("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let ie=w;if(w===i.RED&&(X===i.FLOAT&&(ie=i.R32F),X===i.HALF_FLOAT&&(ie=i.R16F),X===i.UNSIGNED_BYTE&&(ie=i.R8),X===i.UNSIGNED_SHORT&&xe&&(ie=xe.R16_EXT),X===i.SHORT&&xe&&(ie=xe.R16_SNORM_EXT)),w===i.RED_INTEGER&&(X===i.UNSIGNED_BYTE&&(ie=i.R8UI),X===i.UNSIGNED_SHORT&&(ie=i.R16UI),X===i.UNSIGNED_INT&&(ie=i.R32UI),X===i.BYTE&&(ie=i.R8I),X===i.SHORT&&(ie=i.R16I),X===i.INT&&(ie=i.R32I)),w===i.RG&&(X===i.FLOAT&&(ie=i.RG32F),X===i.HALF_FLOAT&&(ie=i.RG16F),X===i.UNSIGNED_BYTE&&(ie=i.RG8),X===i.UNSIGNED_SHORT&&xe&&(ie=xe.RG16_EXT),X===i.SHORT&&xe&&(ie=xe.RG16_SNORM_EXT)),w===i.RG_INTEGER&&(X===i.UNSIGNED_BYTE&&(ie=i.RG8UI),X===i.UNSIGNED_SHORT&&(ie=i.RG16UI),X===i.UNSIGNED_INT&&(ie=i.RG32UI),X===i.BYTE&&(ie=i.RG8I),X===i.SHORT&&(ie=i.RG16I),X===i.INT&&(ie=i.RG32I)),w===i.RGB_INTEGER&&(X===i.UNSIGNED_BYTE&&(ie=i.RGB8UI),X===i.UNSIGNED_SHORT&&(ie=i.RGB16UI),X===i.UNSIGNED_INT&&(ie=i.RGB32UI),X===i.BYTE&&(ie=i.RGB8I),X===i.SHORT&&(ie=i.RGB16I),X===i.INT&&(ie=i.RGB32I)),w===i.RGBA_INTEGER&&(X===i.UNSIGNED_BYTE&&(ie=i.RGBA8UI),X===i.UNSIGNED_SHORT&&(ie=i.RGBA16UI),X===i.UNSIGNED_INT&&(ie=i.RGBA32UI),X===i.BYTE&&(ie=i.RGBA8I),X===i.SHORT&&(ie=i.RGBA16I),X===i.INT&&(ie=i.RGBA32I)),w===i.RGB&&(X===i.UNSIGNED_SHORT&&xe&&(ie=xe.RGB16_EXT),X===i.SHORT&&xe&&(ie=xe.RGB16_SNORM_EXT),X===i.UNSIGNED_INT_5_9_9_9_REV&&(ie=i.RGB9_E5),X===i.UNSIGNED_INT_10F_11F_11F_REV&&(ie=i.R11F_G11F_B10F)),w===i.RGBA){let oe=ge?Pa:lt.getTransfer(te);X===i.FLOAT&&(ie=i.RGBA32F),X===i.HALF_FLOAT&&(ie=i.RGBA16F),X===i.UNSIGNED_BYTE&&(ie=oe===yt?i.SRGB8_ALPHA8:i.RGBA8),X===i.UNSIGNED_SHORT&&xe&&(ie=xe.RGBA16_EXT),X===i.SHORT&&xe&&(ie=xe.RGBA16_SNORM_EXT),X===i.UNSIGNED_SHORT_4_4_4_4&&(ie=i.RGBA4),X===i.UNSIGNED_SHORT_5_5_5_1&&(ie=i.RGB5_A1)}return(ie===i.R16F||ie===i.R32F||ie===i.RG16F||ie===i.RG32F||ie===i.RGBA16F||ie===i.RGBA32F)&&e.get("EXT_color_buffer_float"),ie}function T(P,w){let X;return P?w===null||w===vi||w===$s?X=i.DEPTH24_STENCIL8:w===yi?X=i.DEPTH32F_STENCIL8:w===Xs&&(X=i.DEPTH24_STENCIL8,qe("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):w===null||w===vi||w===$s?X=i.DEPTH_COMPONENT24:w===yi?X=i.DEPTH_COMPONENT32F:w===Xs&&(X=i.DEPTH_COMPONENT16),X}function S(P,w){return p(P)===!0||P.isFramebufferTexture&&P.minFilter!==bn&&P.minFilter!==Mn?Math.log2(Math.max(w.width,w.height))+1:P.mipmaps!==void 0&&P.mipmaps.length>0?P.mipmaps.length:P.isCompressedTexture&&Array.isArray(P.image)?w.mipmaps.length:1}function I(P){let w=P.target;w.removeEventListener("dispose",I),R(w),w.isVideoTexture&&h.delete(w),w.isHTMLTexture&&d.delete(w)}function b(P){let w=P.target;w.removeEventListener("dispose",b),N(w)}function R(P){let w=n.get(P);if(w.__webglInit===void 0)return;let X=P.source,K=f.get(X);if(K){let te=K[w.__cacheKey];te.usedTimes--,te.usedTimes===0&&L(P),Object.keys(K).length===0&&f.delete(X)}n.remove(P)}function L(P){let w=n.get(P);i.deleteTexture(w.__webglTexture);let X=P.source,K=f.get(X);delete K[w.__cacheKey],a.memory.textures--}function N(P){let w=n.get(P);if(P.depthTexture&&(P.depthTexture.dispose(),n.remove(P.depthTexture)),P.isWebGLCubeRenderTarget)for(let K=0;K<6;K++){if(Array.isArray(w.__webglFramebuffer[K]))for(let te=0;te<w.__webglFramebuffer[K].length;te++)i.deleteFramebuffer(w.__webglFramebuffer[K][te]);else i.deleteFramebuffer(w.__webglFramebuffer[K]);w.__webglDepthbuffer&&i.deleteRenderbuffer(w.__webglDepthbuffer[K])}else{if(Array.isArray(w.__webglFramebuffer))for(let K=0;K<w.__webglFramebuffer.length;K++)i.deleteFramebuffer(w.__webglFramebuffer[K]);else i.deleteFramebuffer(w.__webglFramebuffer);if(w.__webglDepthbuffer&&i.deleteRenderbuffer(w.__webglDepthbuffer),w.__webglMultisampledFramebuffer&&i.deleteFramebuffer(w.__webglMultisampledFramebuffer),w.__webglColorRenderbuffer)for(let K=0;K<w.__webglColorRenderbuffer.length;K++)w.__webglColorRenderbuffer[K]&&i.deleteRenderbuffer(w.__webglColorRenderbuffer[K]);w.__webglDepthRenderbuffer&&i.deleteRenderbuffer(w.__webglDepthRenderbuffer)}let X=P.textures;for(let K=0,te=X.length;K<te;K++){let ge=n.get(X[K]);ge.__webglTexture&&(i.deleteTexture(ge.__webglTexture),a.memory.textures--),n.remove(X[K])}n.remove(P)}let U=0;function W(){U=0}function F(){return U}function q(P){U=P}function Z(){let P=U;return P>=r.maxTextures&&qe("WebGLTextures: Trying to use "+(P+1)+" texture units while this GPU supports only "+r.maxTextures),U+=1,P}function J(P){let w=[];return w.push(P.wrapS),w.push(P.wrapT),w.push(P.wrapR||0),w.push(P.magFilter),w.push(P.minFilter),w.push(P.anisotropy),w.push(P.internalFormat),w.push(P.format),w.push(P.type),w.push(P.generateMipmaps),w.push(P.premultiplyAlpha),w.push(P.flipY),w.push(P.unpackAlignment),w.push(P.colorSpace),w.join()}function re(P,w){let X=n.get(P);if(P.isVideoTexture&&H(P),P.isRenderTargetTexture===!1&&P.isExternalTexture!==!0&&P.version>0&&X.__version!==P.version){let K=P.image;if(K===null)qe("WebGLRenderer: Texture marked for update but no image data found.");else if(K.complete===!1)qe("WebGLRenderer: Texture marked for update but image is incomplete");else{Ee(X,P,w);return}}else P.isExternalTexture&&(X.__webglTexture=P.sourceTexture?P.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,X.__webglTexture,i.TEXTURE0+w)}function Q(P,w){let X=n.get(P);if(P.isRenderTargetTexture===!1&&P.version>0&&X.__version!==P.version){Ee(X,P,w);return}else P.isExternalTexture&&(X.__webglTexture=P.sourceTexture?P.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,X.__webglTexture,i.TEXTURE0+w)}function ne(P,w){let X=n.get(P);if(P.isRenderTargetTexture===!1&&P.version>0&&X.__version!==P.version){Ee(X,P,w);return}t.bindTexture(i.TEXTURE_3D,X.__webglTexture,i.TEXTURE0+w)}function se(P,w){let X=n.get(P);if(P.isCubeDepthTexture!==!0&&P.version>0&&X.__version!==P.version){Ke(X,P,w);return}t.bindTexture(i.TEXTURE_CUBE_MAP,X.__webglTexture,i.TEXTURE0+w)}let ke={[Ol]:i.REPEAT,[zi]:i.CLAMP_TO_EDGE,[Vl]:i.MIRRORED_REPEAT},Re={[bn]:i.NEAREST,[km]:i.NEAREST_MIPMAP_NEAREST,[ao]:i.NEAREST_MIPMAP_LINEAR,[Mn]:i.LINEAR,[wc]:i.LINEAR_MIPMAP_NEAREST,[Fr]:i.LINEAR_MIPMAP_LINEAR},mt={[Lm]:i.NEVER,[Bm]:i.ALWAYS,[Dm]:i.LESS,[o0]:i.LEQUAL,[Nm]:i.EQUAL,[l0]:i.GEQUAL,[Fm]:i.GREATER,[Um]:i.NOTEQUAL};function st(P,w){if(w.type===yi&&e.has("OES_texture_float_linear")===!1&&(w.magFilter===Mn||w.magFilter===wc||w.magFilter===ao||w.magFilter===Fr||w.minFilter===Mn||w.minFilter===wc||w.minFilter===ao||w.minFilter===Fr)&&qe("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(P,i.TEXTURE_WRAP_S,ke[w.wrapS]),i.texParameteri(P,i.TEXTURE_WRAP_T,ke[w.wrapT]),(P===i.TEXTURE_3D||P===i.TEXTURE_2D_ARRAY)&&i.texParameteri(P,i.TEXTURE_WRAP_R,ke[w.wrapR]),i.texParameteri(P,i.TEXTURE_MAG_FILTER,Re[w.magFilter]),i.texParameteri(P,i.TEXTURE_MIN_FILTER,Re[w.minFilter]),w.compareFunction&&(i.texParameteri(P,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(P,i.TEXTURE_COMPARE_FUNC,mt[w.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(w.magFilter===bn||w.minFilter!==ao&&w.minFilter!==Fr||w.type===yi&&e.has("OES_texture_float_linear")===!1)return;if(w.anisotropy>1||n.get(w).__currentAnisotropy){let X=e.get("EXT_texture_filter_anisotropic");i.texParameterf(P,X.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(w.anisotropy,r.getMaxAnisotropy())),n.get(w).__currentAnisotropy=w.anisotropy}}}function ct(P,w){let X=!1;P.__webglInit===void 0&&(P.__webglInit=!0,w.addEventListener("dispose",I));let K=w.source,te=f.get(K);te===void 0&&(te={},f.set(K,te));let ge=J(w);if(ge!==P.__cacheKey){te[ge]===void 0&&(te[ge]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,X=!0),te[ge].usedTimes++;let xe=te[P.__cacheKey];xe!==void 0&&(te[P.__cacheKey].usedTimes--,xe.usedTimes===0&&L(w)),P.__cacheKey=ge,P.__webglTexture=te[ge].texture}return X}function ee(P,w,X){return Math.floor(Math.floor(P/X)/w)}function le(P,w,X,K){let ge=P.updateRanges;if(ge.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,w.width,w.height,X,K,w.data);else{ge.sort((Oe,Me)=>Oe.start-Me.start);let xe=0;for(let Oe=1;Oe<ge.length;Oe++){let Me=ge[xe],ye=ge[Oe],Ve=Me.start+Me.count,Xe=ee(ye.start,w.width,4),et=ee(Me.start,w.width,4);ye.start<=Ve+1&&Xe===et&&ee(ye.start+ye.count-1,w.width,4)===Xe?Me.count=Math.max(Me.count,ye.start+ye.count-Me.start):(++xe,ge[xe]=ye)}ge.length=xe+1;let ie=t.getParameter(i.UNPACK_ROW_LENGTH),oe=t.getParameter(i.UNPACK_SKIP_PIXELS),ve=t.getParameter(i.UNPACK_SKIP_ROWS);t.pixelStorei(i.UNPACK_ROW_LENGTH,w.width);for(let Oe=0,Me=ge.length;Oe<Me;Oe++){let ye=ge[Oe],Ve=Math.floor(ye.start/4),Xe=Math.ceil(ye.count/4),et=Ve%w.width,G=Math.floor(Ve/w.width),be=Xe,ae=1;t.pixelStorei(i.UNPACK_SKIP_PIXELS,et),t.pixelStorei(i.UNPACK_SKIP_ROWS,G),t.texSubImage2D(i.TEXTURE_2D,0,et,G,be,ae,X,K,w.data)}P.clearUpdateRanges(),t.pixelStorei(i.UNPACK_ROW_LENGTH,ie),t.pixelStorei(i.UNPACK_SKIP_PIXELS,oe),t.pixelStorei(i.UNPACK_SKIP_ROWS,ve)}}function Ee(P,w,X){let K=i.TEXTURE_2D;(w.isDataArrayTexture||w.isCompressedArrayTexture)&&(K=i.TEXTURE_2D_ARRAY),w.isData3DTexture&&(K=i.TEXTURE_3D);let te=ct(P,w),ge=w.source;t.bindTexture(K,P.__webglTexture,i.TEXTURE0+X);let xe=n.get(ge);if(ge.version!==xe.__version||te===!0){if(t.activeTexture(i.TEXTURE0+X),(typeof ImageBitmap<"u"&&w.image instanceof ImageBitmap)===!1){let ae=lt.getPrimaries(lt.workingColorSpace),_e=w.colorSpace===ir?null:lt.getPrimaries(w.colorSpace),Ce=w.colorSpace===ir||ae===_e?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,w.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ce)}t.pixelStorei(i.UNPACK_ALIGNMENT,w.unpackAlignment);let oe=m(w.image,!1,r.maxTextureSize);oe=un(w,oe);let ve=s.convert(w.format,w.colorSpace),Oe=s.convert(w.type),Me=M(w.internalFormat,ve,Oe,w.normalized,w.colorSpace,w.isVideoTexture);st(K,w);let ye,Ve=w.mipmaps,Xe=w.isVideoTexture!==!0,et=xe.__version===void 0||te===!0,G=ge.dataReady,be=S(w,oe);if(w.isDepthTexture)Me=T(w.format===Ur,w.type),et&&(Xe?t.texStorage2D(i.TEXTURE_2D,1,Me,oe.width,oe.height):t.texImage2D(i.TEXTURE_2D,0,Me,oe.width,oe.height,0,ve,Oe,null));else if(w.isDataTexture)if(Ve.length>0){Xe&&et&&t.texStorage2D(i.TEXTURE_2D,be,Me,Ve[0].width,Ve[0].height);for(let ae=0,_e=Ve.length;ae<_e;ae++)ye=Ve[ae],Xe?G&&t.texSubImage2D(i.TEXTURE_2D,ae,0,0,ye.width,ye.height,ve,Oe,ye.data):t.texImage2D(i.TEXTURE_2D,ae,Me,ye.width,ye.height,0,ve,Oe,ye.data);w.generateMipmaps=!1}else Xe?(et&&t.texStorage2D(i.TEXTURE_2D,be,Me,oe.width,oe.height),G&&le(w,oe,ve,Oe)):t.texImage2D(i.TEXTURE_2D,0,Me,oe.width,oe.height,0,ve,Oe,oe.data);else if(w.isCompressedTexture)if(w.isCompressedArrayTexture){Xe&&et&&t.texStorage3D(i.TEXTURE_2D_ARRAY,be,Me,Ve[0].width,Ve[0].height,oe.depth);for(let ae=0,_e=Ve.length;ae<_e;ae++)if(ye=Ve[ae],w.format!==li)if(ve!==null)if(Xe){if(G)if(w.layerUpdates.size>0){let Ce=Yu(ye.width,ye.height,w.format,w.type);for(let ce of w.layerUpdates){let He=ye.data.subarray(ce*Ce/ye.data.BYTES_PER_ELEMENT,(ce+1)*Ce/ye.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,ae,0,0,ce,ye.width,ye.height,1,ve,He)}}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,ae,0,0,0,ye.width,ye.height,oe.depth,ve,ye.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,ae,Me,ye.width,ye.height,oe.depth,0,ye.data,0,0);else qe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Xe?G&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,ae,0,0,0,ye.width,ye.height,oe.depth,ve,Oe,ye.data):t.texImage3D(i.TEXTURE_2D_ARRAY,ae,Me,ye.width,ye.height,oe.depth,0,ve,Oe,ye.data);w.layerUpdates.size>0&&w.clearLayerUpdates()}else{Xe&&et&&t.texStorage2D(i.TEXTURE_2D,be,Me,Ve[0].width,Ve[0].height);for(let ae=0,_e=Ve.length;ae<_e;ae++)ye=Ve[ae],w.format!==li?ve!==null?Xe?G&&t.compressedTexSubImage2D(i.TEXTURE_2D,ae,0,0,ye.width,ye.height,ve,ye.data):t.compressedTexImage2D(i.TEXTURE_2D,ae,Me,ye.width,ye.height,0,ye.data):qe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Xe?G&&t.texSubImage2D(i.TEXTURE_2D,ae,0,0,ye.width,ye.height,ve,Oe,ye.data):t.texImage2D(i.TEXTURE_2D,ae,Me,ye.width,ye.height,0,ve,Oe,ye.data)}else if(w.isDataArrayTexture)if(Xe){if(et&&t.texStorage3D(i.TEXTURE_2D_ARRAY,be,Me,oe.width,oe.height,oe.depth),G)if(w.layerUpdates.size>0){let ae=Yu(oe.width,oe.height,w.format,w.type);for(let _e of w.layerUpdates){let Ce=oe.data.subarray(_e*ae/oe.data.BYTES_PER_ELEMENT,(_e+1)*ae/oe.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,_e,oe.width,oe.height,1,ve,Oe,Ce)}w.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,oe.width,oe.height,oe.depth,ve,Oe,oe.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,Me,oe.width,oe.height,oe.depth,0,ve,Oe,oe.data);else if(w.isData3DTexture)Xe?(et&&t.texStorage3D(i.TEXTURE_3D,be,Me,oe.width,oe.height,oe.depth),G&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,oe.width,oe.height,oe.depth,ve,Oe,oe.data)):t.texImage3D(i.TEXTURE_3D,0,Me,oe.width,oe.height,oe.depth,0,ve,Oe,oe.data);else if(w.isFramebufferTexture){if(et)if(Xe)t.texStorage2D(i.TEXTURE_2D,be,Me,oe.width,oe.height);else{let ae=oe.width,_e=oe.height;for(let Ce=0;Ce<be;Ce++)t.texImage2D(i.TEXTURE_2D,Ce,Me,ae,_e,0,ve,Oe,null),ae>>=1,_e>>=1}}else if(w.isHTMLTexture){if("texElementImage2D"in i){let ae=i.canvas;if(ae.hasAttribute("layoutsubtree")||ae.setAttribute("layoutsubtree","true"),oe.parentNode!==ae){ae.appendChild(oe),d.add(w),ae.onpaint=_e=>{let Ce=_e.changedElements;for(let ce of d)Ce.includes(ce.image)&&(ce.needsUpdate=!0)},ae.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,oe);else{let Ce=i.RGBA,ce=i.RGBA,He=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,Ce,ce,He,oe)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Ve.length>0){if(Xe&&et){let ae=xt(Ve[0]);t.texStorage2D(i.TEXTURE_2D,be,Me,ae.width,ae.height)}for(let ae=0,_e=Ve.length;ae<_e;ae++)ye=Ve[ae],Xe?G&&t.texSubImage2D(i.TEXTURE_2D,ae,0,0,ve,Oe,ye):t.texImage2D(i.TEXTURE_2D,ae,Me,ve,Oe,ye);w.generateMipmaps=!1}else if(Xe){if(et){let ae=xt(oe);t.texStorage2D(i.TEXTURE_2D,be,Me,ae.width,ae.height)}G&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,ve,Oe,oe)}else t.texImage2D(i.TEXTURE_2D,0,Me,ve,Oe,oe);p(w)&&_(K),xe.__version=ge.version,w.onUpdate&&w.onUpdate(w)}P.__version=w.version}function Ke(P,w,X){if(w.image.length!==6)return;let K=ct(P,w),te=w.source;t.bindTexture(i.TEXTURE_CUBE_MAP,P.__webglTexture,i.TEXTURE0+X);let ge=n.get(te);if(te.version!==ge.__version||K===!0){t.activeTexture(i.TEXTURE0+X);let xe=lt.getPrimaries(lt.workingColorSpace),ie=w.colorSpace===ir?null:lt.getPrimaries(w.colorSpace),oe=w.colorSpace===ir||xe===ie?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,w.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),t.pixelStorei(i.UNPACK_ALIGNMENT,w.unpackAlignment),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,oe);let ve=w.isCompressedTexture||w.image[0].isCompressedTexture,Oe=w.image[0]&&w.image[0].isDataTexture,Me=[];for(let ce=0;ce<6;ce++)!ve&&!Oe?Me[ce]=m(w.image[ce],!0,r.maxCubemapSize):Me[ce]=Oe?w.image[ce].image:w.image[ce],Me[ce]=un(w,Me[ce]);let ye=Me[0],Ve=s.convert(w.format,w.colorSpace),Xe=s.convert(w.type),et=M(w.internalFormat,Ve,Xe,w.normalized,w.colorSpace),G=w.isVideoTexture!==!0,be=ge.__version===void 0||K===!0,ae=te.dataReady,_e=S(w,ye);st(i.TEXTURE_CUBE_MAP,w);let Ce;if(ve){G&&be&&t.texStorage2D(i.TEXTURE_CUBE_MAP,_e,et,ye.width,ye.height);for(let ce=0;ce<6;ce++){Ce=Me[ce].mipmaps;for(let He=0;He<Ce.length;He++){let Ue=Ce[He];w.format!==li?Ve!==null?G?ae&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,He,0,0,Ue.width,Ue.height,Ve,Ue.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,He,et,Ue.width,Ue.height,0,Ue.data):qe("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):G?ae&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,He,0,0,Ue.width,Ue.height,Ve,Xe,Ue.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,He,et,Ue.width,Ue.height,0,Ve,Xe,Ue.data)}}}else{if(Ce=w.mipmaps,G&&be){Ce.length>0&&_e++;let ce=xt(Me[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,_e,et,ce.width,ce.height)}for(let ce=0;ce<6;ce++)if(Oe){G?ae&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,0,0,Me[ce].width,Me[ce].height,Ve,Xe,Me[ce].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,et,Me[ce].width,Me[ce].height,0,Ve,Xe,Me[ce].data);for(let He=0;He<Ce.length;He++){let Pt=Ce[He].image[ce].image;G?ae&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,He+1,0,0,Pt.width,Pt.height,Ve,Xe,Pt.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,He+1,et,Pt.width,Pt.height,0,Ve,Xe,Pt.data)}}else{G?ae&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,0,0,Ve,Xe,Me[ce]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,et,Ve,Xe,Me[ce]);for(let He=0;He<Ce.length;He++){let Ue=Ce[He];G?ae&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,He+1,0,0,Ve,Xe,Ue.image[ce]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,He+1,et,Ve,Xe,Ue.image[ce])}}}p(w)&&_(i.TEXTURE_CUBE_MAP),ge.__version=te.version,w.onUpdate&&w.onUpdate(w)}P.__version=w.version}function Ie(P,w,X,K,te,ge){let xe=s.convert(X.format,X.colorSpace),ie=s.convert(X.type),oe=M(X.internalFormat,xe,ie,X.normalized,X.colorSpace),ve=n.get(w),Oe=n.get(X);if(Oe.__renderTarget=w,!ve.__hasExternalTextures){let Me=Math.max(1,w.width>>ge),ye=Math.max(1,w.height>>ge);te===i.TEXTURE_3D||te===i.TEXTURE_2D_ARRAY?t.texImage3D(te,ge,oe,Me,ye,w.depth,0,xe,ie,null):t.texImage2D(te,ge,oe,Me,ye,0,xe,ie,null)}t.bindFramebuffer(i.FRAMEBUFFER,P),$t(w)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,K,te,Oe.__webglTexture,0,Lt(w)):(te===i.TEXTURE_2D||te>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&te<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,K,te,Oe.__webglTexture,ge),t.bindFramebuffer(i.FRAMEBUFFER,null)}function nt(P,w,X){if(i.bindRenderbuffer(i.RENDERBUFFER,P),w.depthBuffer){let K=w.depthTexture,te=K&&K.isDepthTexture?K.type:null,ge=T(w.stencilBuffer,te),xe=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;$t(w)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Lt(w),ge,w.width,w.height):X?i.renderbufferStorageMultisample(i.RENDERBUFFER,Lt(w),ge,w.width,w.height):i.renderbufferStorage(i.RENDERBUFFER,ge,w.width,w.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,xe,i.RENDERBUFFER,P)}else{let K=w.textures;for(let te=0;te<K.length;te++){let ge=K[te],xe=s.convert(ge.format,ge.colorSpace),ie=s.convert(ge.type),oe=M(ge.internalFormat,xe,ie,ge.normalized,ge.colorSpace);$t(w)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Lt(w),oe,w.width,w.height):X?i.renderbufferStorageMultisample(i.RENDERBUFFER,Lt(w),oe,w.width,w.height):i.renderbufferStorage(i.RENDERBUFFER,oe,w.width,w.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Bt(P,w,X){let K=w.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,P),!(w.depthTexture&&w.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let te=n.get(w.depthTexture);if(te.__renderTarget=w,(!te.__webglTexture||w.depthTexture.image.width!==w.width||w.depthTexture.image.height!==w.height)&&(w.depthTexture.image.width=w.width,w.depthTexture.image.height=w.height,w.depthTexture.needsUpdate=!0),K){if(te.__webglInit===void 0&&(te.__webglInit=!0,w.depthTexture.addEventListener("dispose",I)),te.__webglTexture===void 0){te.__webglTexture=i.createTexture(),t.bindTexture(i.TEXTURE_CUBE_MAP,te.__webglTexture),st(i.TEXTURE_CUBE_MAP,w.depthTexture);let ve=s.convert(w.depthTexture.format),Oe=s.convert(w.depthTexture.type),Me;w.depthTexture.format===Li?Me=i.DEPTH_COMPONENT24:w.depthTexture.format===Ur&&(Me=i.DEPTH24_STENCIL8);for(let ye=0;ye<6;ye++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ye,0,Me,w.width,w.height,0,ve,Oe,null)}}else re(w.depthTexture,0);let ge=te.__webglTexture,xe=Lt(w),ie=K?i.TEXTURE_CUBE_MAP_POSITIVE_X+X:i.TEXTURE_2D,oe=w.depthTexture.format===Ur?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(w.depthTexture.format===Li)$t(w)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,oe,ie,ge,0,xe):i.framebufferTexture2D(i.FRAMEBUFFER,oe,ie,ge,0);else if(w.depthTexture.format===Ur)$t(w)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,oe,ie,ge,0,xe):i.framebufferTexture2D(i.FRAMEBUFFER,oe,ie,ge,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Qe(P){let w=n.get(P),X=P.isWebGLCubeRenderTarget===!0;if(w.__boundDepthTexture!==P.depthTexture){let K=P.depthTexture;if(w.__depthDisposeCallback&&w.__depthDisposeCallback(),K){let te=()=>{delete w.__boundDepthTexture,delete w.__depthDisposeCallback,K.removeEventListener("dispose",te)};K.addEventListener("dispose",te),w.__depthDisposeCallback=te}w.__boundDepthTexture=K}if(P.depthTexture&&!w.__autoAllocateDepthBuffer)if(X)for(let K=0;K<6;K++)Bt(w.__webglFramebuffer[K],P,K);else{let K=P.texture.mipmaps;K&&K.length>0?Bt(w.__webglFramebuffer[0],P,0):Bt(w.__webglFramebuffer,P,0)}else if(X){w.__webglDepthbuffer=[];for(let K=0;K<6;K++)if(t.bindFramebuffer(i.FRAMEBUFFER,w.__webglFramebuffer[K]),w.__webglDepthbuffer[K]===void 0)w.__webglDepthbuffer[K]=i.createRenderbuffer(),nt(w.__webglDepthbuffer[K],P,!1);else{let te=P.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ge=w.__webglDepthbuffer[K];i.bindRenderbuffer(i.RENDERBUFFER,ge),i.framebufferRenderbuffer(i.FRAMEBUFFER,te,i.RENDERBUFFER,ge)}}else{let K=P.texture.mipmaps;if(K&&K.length>0?t.bindFramebuffer(i.FRAMEBUFFER,w.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,w.__webglFramebuffer),w.__webglDepthbuffer===void 0)w.__webglDepthbuffer=i.createRenderbuffer(),nt(w.__webglDepthbuffer,P,!1);else{let te=P.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ge=w.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,ge),i.framebufferRenderbuffer(i.FRAMEBUFFER,te,i.RENDERBUFFER,ge)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function ft(P,w,X){let K=n.get(P);w!==void 0&&Ie(K.__webglFramebuffer,P,P.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),X!==void 0&&Qe(P)}function Tt(P){let w=P.texture,X=n.get(P),K=n.get(w);P.addEventListener("dispose",b);let te=P.textures,ge=P.isWebGLCubeRenderTarget===!0,xe=te.length>1;if(xe||(K.__webglTexture===void 0&&(K.__webglTexture=i.createTexture()),K.__version=w.version,a.memory.textures++),ge){X.__webglFramebuffer=[];for(let ie=0;ie<6;ie++)if(w.mipmaps&&w.mipmaps.length>0){X.__webglFramebuffer[ie]=[];for(let oe=0;oe<w.mipmaps.length;oe++)X.__webglFramebuffer[ie][oe]=i.createFramebuffer()}else X.__webglFramebuffer[ie]=i.createFramebuffer()}else{if(w.mipmaps&&w.mipmaps.length>0){X.__webglFramebuffer=[];for(let ie=0;ie<w.mipmaps.length;ie++)X.__webglFramebuffer[ie]=i.createFramebuffer()}else X.__webglFramebuffer=i.createFramebuffer();if(xe)for(let ie=0,oe=te.length;ie<oe;ie++){let ve=n.get(te[ie]);ve.__webglTexture===void 0&&(ve.__webglTexture=i.createTexture(),a.memory.textures++)}if(P.samples>0&&$t(P)===!1){X.__webglMultisampledFramebuffer=i.createFramebuffer(),X.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,X.__webglMultisampledFramebuffer);for(let ie=0;ie<te.length;ie++){let oe=te[ie];X.__webglColorRenderbuffer[ie]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,X.__webglColorRenderbuffer[ie]);let ve=s.convert(oe.format,oe.colorSpace),Oe=s.convert(oe.type),Me=M(oe.internalFormat,ve,Oe,oe.normalized,oe.colorSpace,P.isXRRenderTarget===!0),ye=Lt(P);i.renderbufferStorageMultisample(i.RENDERBUFFER,ye,Me,P.width,P.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ie,i.RENDERBUFFER,X.__webglColorRenderbuffer[ie])}i.bindRenderbuffer(i.RENDERBUFFER,null),P.depthBuffer&&(X.__webglDepthRenderbuffer=i.createRenderbuffer(),nt(X.__webglDepthRenderbuffer,P,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(ge){t.bindTexture(i.TEXTURE_CUBE_MAP,K.__webglTexture),st(i.TEXTURE_CUBE_MAP,w);for(let ie=0;ie<6;ie++)if(w.mipmaps&&w.mipmaps.length>0)for(let oe=0;oe<w.mipmaps.length;oe++)Ie(X.__webglFramebuffer[ie][oe],P,w,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,oe);else Ie(X.__webglFramebuffer[ie],P,w,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,0);p(w)&&_(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(xe){for(let ie=0,oe=te.length;ie<oe;ie++){let ve=te[ie],Oe=n.get(ve),Me=i.TEXTURE_2D;(P.isWebGL3DRenderTarget||P.isWebGLArrayRenderTarget)&&(Me=P.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(Me,Oe.__webglTexture),st(Me,ve),Ie(X.__webglFramebuffer,P,ve,i.COLOR_ATTACHMENT0+ie,Me,0),p(ve)&&_(Me)}t.unbindTexture()}else{let ie=i.TEXTURE_2D;if((P.isWebGL3DRenderTarget||P.isWebGLArrayRenderTarget)&&(ie=P.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(ie,K.__webglTexture),st(ie,w),w.mipmaps&&w.mipmaps.length>0)for(let oe=0;oe<w.mipmaps.length;oe++)Ie(X.__webglFramebuffer[oe],P,w,i.COLOR_ATTACHMENT0,ie,oe);else Ie(X.__webglFramebuffer,P,w,i.COLOR_ATTACHMENT0,ie,0);p(w)&&_(ie),t.unbindTexture()}P.depthBuffer&&Qe(P)}function at(P){let w=P.textures;for(let X=0,K=w.length;X<K;X++){let te=w[X];if(p(te)){let ge=A(P),xe=n.get(te).__webglTexture;t.bindTexture(ge,xe),_(ge),t.unbindTexture()}}}let Rt=[],Jt=[];function hn(P){if(P.samples>0){if($t(P)===!1){let w=P.textures,X=P.width,K=P.height,te=i.COLOR_BUFFER_BIT,ge=P.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,xe=n.get(P),ie=w.length>1;if(ie)for(let ve=0;ve<w.length;ve++)t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ve,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ve,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,xe.__webglMultisampledFramebuffer);let oe=P.texture.mipmaps;oe&&oe.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,xe.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,xe.__webglFramebuffer);for(let ve=0;ve<w.length;ve++){if(P.resolveDepthBuffer&&(P.depthBuffer&&(te|=i.DEPTH_BUFFER_BIT),P.stencilBuffer&&P.resolveStencilBuffer&&(te|=i.STENCIL_BUFFER_BIT)),ie){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,xe.__webglColorRenderbuffer[ve]);let Oe=n.get(w[ve]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Oe,0)}i.blitFramebuffer(0,0,X,K,0,0,X,K,te,i.NEAREST),l===!0&&(Rt.length=0,Jt.length=0,Rt.push(i.COLOR_ATTACHMENT0+ve),P.depthBuffer&&P.storeMultisampledDepthBuffer===!1&&(Rt.push(ge),Jt.push(ge),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,Jt)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,Rt))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),ie)for(let ve=0;ve<w.length;ve++){t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ve,i.RENDERBUFFER,xe.__webglColorRenderbuffer[ve]);let Oe=n.get(w[ve]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ve,i.TEXTURE_2D,Oe,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,xe.__webglMultisampledFramebuffer)}else if(P.depthBuffer&&P.storeMultisampledDepthBuffer===!1&&l){let w=P.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[w])}}}function Lt(P){return Math.min(r.maxSamples,P.samples)}function $t(P){let w=n.get(P);return P.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&w.__useRenderToTexture!==!1}function H(P){let w=a.render.frame;h.get(P)!==w&&(h.set(P,w),P.update())}function un(P,w){let X=P.colorSpace,K=P.format,te=P.type;return P.isCompressedTexture===!0||P.isVideoTexture===!0||X!==Ia&&X!==ir&&(lt.getTransfer(X)===yt?(K!==li||te!==ei)&&qe("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ye("WebGLTextures: Unsupported texture color space:",X)),w}function xt(P){return typeof HTMLImageElement<"u"&&P instanceof HTMLImageElement?(c.width=P.naturalWidth||P.width,c.height=P.naturalHeight||P.height):typeof VideoFrame<"u"&&P instanceof VideoFrame?(c.width=P.displayWidth,c.height=P.displayHeight):(c.width=P.width,c.height=P.height),c}this.allocateTextureUnit=Z,this.resetTextureUnits=W,this.getTextureUnits=F,this.setTextureUnits=q,this.setTexture2D=re,this.setTexture2DArray=Q,this.setTexture3D=ne,this.setTextureCube=se,this.rebindTextures=ft,this.setupRenderTarget=Tt,this.updateRenderTargetMipmap=at,this.updateMultisampleRenderTarget=hn,this.setupDepthRenderbuffer=Qe,this.setupFrameBufferTexture=Ie,this.useMultisampledRTT=$t,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function s_(i,e){function t(n,r=ir){let s,a=lt.getTransfer(r);if(n===ei)return i.UNSIGNED_BYTE;if(n===Ac)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Ec)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Du)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Nu)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===zu)return i.BYTE;if(n===Lu)return i.SHORT;if(n===Xs)return i.UNSIGNED_SHORT;if(n===Tc)return i.INT;if(n===vi)return i.UNSIGNED_INT;if(n===yi)return i.FLOAT;if(n===Sn)return i.HALF_FLOAT;if(n===Fu)return i.ALPHA;if(n===Uu)return i.RGB;if(n===li)return i.RGBA;if(n===Li)return i.DEPTH_COMPONENT;if(n===Ur)return i.DEPTH_STENCIL;if(n===Bu)return i.RED;if(n===Cc)return i.RED_INTEGER;if(n===Br)return i.RG;if(n===Rc)return i.RG_INTEGER;if(n===kc)return i.RGBA_INTEGER;if(n===oo||n===lo||n===co||n===ho)if(a===yt)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(n===oo)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===lo)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===co)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===ho)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(n===oo)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===lo)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===co)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===ho)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Ic||n===Pc||n===zc||n===Lc)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(n===Ic)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Pc)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===zc)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Lc)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Dc||n===Nc||n===Fc||n===Uc||n===Bc||n===uo||n===Oc)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(n===Dc||n===Nc)return a===yt?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(n===Fc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(n===Uc)return s.COMPRESSED_R11_EAC;if(n===Bc)return s.COMPRESSED_SIGNED_R11_EAC;if(n===uo)return s.COMPRESSED_RG11_EAC;if(n===Oc)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Vc||n===Hc||n===Gc||n===Wc||n===qc||n===Xc||n===$c||n===Yc||n===Kc||n===Zc||n===Jc||n===jc||n===Qc||n===e0)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(n===Vc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Hc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Gc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Wc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===qc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Xc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===$c)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Yc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Kc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Zc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Jc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===jc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Qc)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===e0)return a===yt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===t0||n===n0||n===i0)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(n===t0)return a===yt?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===n0)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===i0)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===r0||n===s0||n===fo||n===a0)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(n===r0)return s.COMPRESSED_RED_RGTC1_EXT;if(n===s0)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===fo)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===a0)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===$s?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}var a_=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,o_=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,fd=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Wa(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Ut({vertexShader:a_,fragmentShader:o_,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new kn(new $a(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},pd=class extends Di{constructor(e,t){super();let n=this,r=null,s=1,a=null,o="local-floor",l=1,c=null,h=null,d=null,u=null,f=null,g=null,v=typeof XRWebGLBinding<"u",m=new fd,p={},_=t.getContextAttributes(),A=null,M=null,T=[],S=[],I=new Le,b=null,R=null,L=new Rn;L.viewport=new qt;let N=new Rn;N.viewport=new qt;let U=[L,N],W=new bc,F=null,q=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(ee){let le=T[ee];return le===void 0&&(le=new Bs,T[ee]=le),le.getTargetRaySpace()},this.getControllerGrip=function(ee){let le=T[ee];return le===void 0&&(le=new Bs,T[ee]=le),le.getGripSpace()},this.getHand=function(ee){let le=T[ee];return le===void 0&&(le=new Bs,T[ee]=le),le.getHandSpace()};function Z(ee){let le=S.indexOf(ee.inputSource);if(le===-1)return;let Ee=T[le];Ee!==void 0&&(Ee.update(ee.inputSource,ee.frame,c||a),Ee.dispatchEvent({type:ee.type,data:ee.inputSource}))}function J(){r.removeEventListener("select",Z),r.removeEventListener("selectstart",Z),r.removeEventListener("selectend",Z),r.removeEventListener("squeeze",Z),r.removeEventListener("squeezestart",Z),r.removeEventListener("squeezeend",Z),r.removeEventListener("end",J),r.removeEventListener("inputsourceschange",re);for(let ee=0;ee<T.length;ee++){let le=S[ee];le!==null&&(S[ee]=null,T[ee].disconnect(le))}F=null,q=null,m.reset();for(let ee in p)delete p[ee];if(e.setRenderTarget(A),f=null,u=null,d=null,r=null,M=null,ct.stop(),n.isPresenting=!1,e.setPixelRatio(b),e.setSize(I.width,I.height,!1),R!==null){let ee=R.camera;ee.fov=R.fov,ee.zoom=R.zoom,ee.updateProjectionMatrix(),R=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(ee){s=ee,n.isPresenting===!0&&qe("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(ee){o=ee,n.isPresenting===!0&&qe("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(ee){c=ee},this.getBaseLayer=function(){return u!==null?u:f},this.getBinding=function(){return d===null&&v&&(d=new XRWebGLBinding(r,t)),d},this.getFrame=function(){return g},this.getSession=function(){return r},this.setSession=async function(ee){if(r=ee,r!==null){if(A=e.getRenderTarget(),r.addEventListener("select",Z),r.addEventListener("selectstart",Z),r.addEventListener("selectend",Z),r.addEventListener("squeeze",Z),r.addEventListener("squeezestart",Z),r.addEventListener("squeezeend",Z),r.addEventListener("end",J),r.addEventListener("inputsourceschange",re),_.xrCompatible!==!0&&await t.makeXRCompatible(),b=e.getPixelRatio(),e.getSize(I),v&&"createProjectionLayer"in XRWebGLBinding.prototype){let Ee=null,Ke=null,Ie=null;_.depth&&(Ie=_.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,Ee=_.stencil?Ur:Li,Ke=_.stencil?$s:vi);let nt={colorFormat:t.RGBA8,depthFormat:Ie,scaleFactor:s};d=this.getBinding(),u=d.createProjectionLayer(nt),r.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),M=new on(u.textureWidth,u.textureHeight,{format:li,type:ei,depthTexture:new Ir(u.textureWidth,u.textureHeight,Ke,void 0,void 0,void 0,void 0,void 0,void 0,Ee),stencilBuffer:_.stencil,colorSpace:e.outputColorSpace,samples:_.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}else{let Ee={antialias:_.antialias,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:s};f=new XRWebGLLayer(r,t,Ee),r.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),M=new on(f.framebufferWidth,f.framebufferHeight,{format:li,type:ei,colorSpace:e.outputColorSpace,stencilBuffer:_.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}M.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await r.requestReferenceSpace(o),ct.setContext(r),ct.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function re(ee){for(let le=0;le<ee.removed.length;le++){let Ee=ee.removed[le],Ke=S.indexOf(Ee);Ke>=0&&(S[Ke]=null,T[Ke].disconnect(Ee))}for(let le=0;le<ee.added.length;le++){let Ee=ee.added[le],Ke=S.indexOf(Ee);if(Ke===-1){for(let nt=0;nt<T.length;nt++)if(nt>=S.length){S.push(Ee),Ke=nt;break}else if(S[nt]===null){S[nt]=Ee,Ke=nt;break}if(Ke===-1)break}let Ie=T[Ke];Ie&&Ie.connect(Ee)}}let Q=new V,ne=new V;function se(ee,le,Ee){Q.setFromMatrixPosition(le.matrixWorld),ne.setFromMatrixPosition(Ee.matrixWorld);let Ke=Q.distanceTo(ne),Ie=le.projectionMatrix.elements,nt=Ee.projectionMatrix.elements,Bt=Ie[14]/(Ie[10]-1),Qe=Ie[14]/(Ie[10]+1),ft=(Ie[9]+1)/Ie[5],Tt=(Ie[9]-1)/Ie[5],at=(Ie[8]-1)/Ie[0],Rt=(nt[8]+1)/nt[0],Jt=Bt*at,hn=Bt*Rt,Lt=Ke/(-at+Rt),$t=Lt*-at;if(le.matrixWorld.decompose(ee.position,ee.quaternion,ee.scale),ee.translateX($t),ee.translateZ(Lt),ee.matrixWorld.compose(ee.position,ee.quaternion,ee.scale),ee.matrixWorldInverse.copy(ee.matrixWorld).invert(),Ie[10]===-1)ee.projectionMatrix.copy(le.projectionMatrix),ee.projectionMatrixInverse.copy(le.projectionMatrixInverse);else{let H=Bt+Lt,un=Qe+Lt,xt=Jt-$t,P=hn+(Ke-$t),w=ft*Qe/un*H,X=Tt*Qe/un*H;ee.projectionMatrix.makePerspective(xt,P,w,X,H,un),ee.projectionMatrixInverse.copy(ee.projectionMatrix).invert()}}function ke(ee,le){le===null?ee.matrixWorld.copy(ee.matrix):ee.matrixWorld.multiplyMatrices(le.matrixWorld,ee.matrix),ee.matrixWorldInverse.copy(ee.matrixWorld).invert()}this.updateCamera=function(ee){if(r===null)return;let le=ee.near,Ee=ee.far;m.texture!==null&&(m.depthNear>0&&(le=m.depthNear),m.depthFar>0&&(Ee=m.depthFar)),W.near=N.near=L.near=le,W.far=N.far=L.far=Ee,(F!==W.near||q!==W.far)&&(r.updateRenderState({depthNear:W.near,depthFar:W.far}),F=W.near,q=W.far),W.layers.mask=ee.layers.mask|6,L.layers.mask=W.layers.mask&-5,N.layers.mask=W.layers.mask&-3;let Ke=ee.parent,Ie=W.cameras;ke(W,Ke);for(let nt=0;nt<Ie.length;nt++)ke(Ie[nt],Ke);Ie.length===2?se(W,L,N):W.projectionMatrix.copy(L.projectionMatrix),R===null&&ee.isPerspectiveCamera&&(R={camera:ee,fov:ee.fov,zoom:ee.zoom}),Re(ee,W,Ke)};function Re(ee,le,Ee){Ee===null?ee.matrix.copy(le.matrixWorld):(ee.matrix.copy(Ee.matrixWorld),ee.matrix.invert(),ee.matrix.multiply(le.matrixWorld)),ee.matrix.decompose(ee.position,ee.quaternion,ee.scale),ee.updateMatrixWorld(!0),ee.projectionMatrix.copy(le.projectionMatrix),ee.projectionMatrixInverse.copy(le.projectionMatrixInverse),ee.isPerspectiveCamera&&(ee.fov=Gl*2*Math.atan(1/ee.projectionMatrix.elements[5]),ee.zoom=1)}this.getCamera=function(){return W},this.getFoveation=function(){if(!(u===null&&f===null))return l},this.setFoveation=function(ee){l=ee,u!==null&&(u.fixedFoveation=ee),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=ee)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(W)},this.getCameraTexture=function(ee){return p[ee]};let mt=null;function st(ee,le){if(h=le.getViewerPose(c||a),g=le,h!==null){let Ee=h.views;f!==null&&(e.setRenderTargetFramebuffer(M,f.framebuffer),e.setRenderTarget(M));let Ke=!1;Ee.length!==W.cameras.length&&(W.cameras.length=0,Ke=!0);for(let Qe=0;Qe<Ee.length;Qe++){let ft=Ee[Qe],Tt=null;if(f!==null)Tt=f.getViewport(ft);else{let Rt=d.getViewSubImage(u,ft);Tt=Rt.viewport,Qe===0&&(e.setRenderTargetTextures(M,Rt.colorTexture,Rt.depthStencilTexture),e.setRenderTarget(M))}let at=U[Qe];at===void 0&&(at=new Rn,at.layers.enable(Qe),at.viewport=new qt,U[Qe]=at),at.matrix.fromArray(ft.transform.matrix),at.matrix.decompose(at.position,at.quaternion,at.scale),at.projectionMatrix.fromArray(ft.projectionMatrix),at.projectionMatrixInverse.copy(at.projectionMatrix).invert(),at.viewport.set(Tt.x,Tt.y,Tt.width,Tt.height),Qe===0&&(W.matrix.copy(at.matrix),W.matrix.decompose(W.position,W.quaternion,W.scale)),Ke===!0&&W.cameras.push(at)}let Ie=r.enabledFeatures;if(Ie&&Ie.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&v){d=n.getBinding();let Qe=d.getDepthInformation(Ee[0]);Qe&&Qe.isValid&&Qe.texture&&m.init(Qe,r.renderState)}if(Ie&&Ie.includes("camera-access")&&v){e.state.unbindTexture(),d=n.getBinding();for(let Qe=0;Qe<Ee.length;Qe++){let ft=Ee[Qe].camera;if(ft){let Tt=p[ft];Tt||(Tt=new Wa,p[ft]=Tt);let at=d.getCameraImage(ft);Tt.sourceTexture=at}}}}for(let Ee=0;Ee<T.length;Ee++){let Ke=S[Ee],Ie=T[Ee];Ke!==null&&Ie!==void 0&&Ie.update(Ke,le,c||a)}mt&&mt(ee,le),le.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:le}),g=null}let ct=new m1;ct.setAnimationLoop(st),this.setAnimationLoop=function(ee){mt=ee},this.dispose=function(){}}},l_=new It,_1=new je;_1.set(-1,0,0,0,1,0,0,0,1);function c_(i,e){function t(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,qu(i)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function r(m,p,_,A,M){p.isNodeMaterial?p.uniformsNeedUpdate=!1:p.isMeshBasicMaterial?s(m,p):p.isMeshLambertMaterial?(s(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(s(m,p),d(m,p)):p.isMeshPhongMaterial?(s(m,p),h(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(s(m,p),u(m,p),p.isMeshPhysicalMaterial&&f(m,p,M)):p.isMeshMatcapMaterial?(s(m,p),g(m,p)):p.isMeshDepthMaterial?s(m,p):p.isMeshDistanceMaterial?(s(m,p),v(m,p)):p.isMeshNormalMaterial?s(m,p):p.isLineBasicMaterial?(a(m,p),p.isLineDashedMaterial&&o(m,p)):p.isPointsMaterial?l(m,p,_,A):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function s(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,t(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===Un&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,t(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===Un&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,t(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,t(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);let _=e.get(p),A=_.envMap,M=_.envMapRotation;A&&(m.envMap.value=A,m.envMapRotation.value.setFromMatrix4(l_.makeRotationFromEuler(M)).transpose(),A.isCubeTexture&&A.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(_1),m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,m.aoMapTransform))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform))}function o(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,_,A){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*_,m.scale.value=A*.5,p.map&&(m.map.value=p.map,t(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function h(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function d(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function u(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,_){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Un&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.retroreflectivity>0&&(m.retroreflectivity.value=p.retroreflectivity),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=_.texture,m.transmissionSamplerSize.value.set(_.width,_.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function v(m,p){let _=e.get(p).light;m.referencePosition.value.setFromMatrixPosition(_.matrixWorld),m.nearDistance.value=_.shadow.camera.near,m.farDistance.value=_.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:r}}function h_(i,e,t,n){let r={},s={},a=[],o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(M,T){let S=T.program;n.uniformBlockBinding(M,S)}function c(M,T){let S=r[M.id];S===void 0&&(m(M),S=h(M),r[M.id]=S,M.addEventListener("dispose",_));let I=T.program;n.updateUBOMapping(M,I);let b=e.render.frame;s[M.id]!==b&&(u(M),s[M.id]=b)}function h(M){let T=d();M.__bindingPointIndex=T;let S=i.createBuffer(),I=M.__size,b=M.usage;return i.bindBuffer(i.UNIFORM_BUFFER,S),i.bufferData(i.UNIFORM_BUFFER,I,b),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,T,S),S}function d(){for(let M=0;M<o;M++)if(a.indexOf(M)===-1)return a.push(M),M;return Ye("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(M){let T=r[M.id],S=M.uniforms,I=M.__cache;i.bindBuffer(i.UNIFORM_BUFFER,T);for(let b=0,R=S.length;b<R;b++){let L=S[b];if(Array.isArray(L))for(let N=0,U=L.length;N<U;N++)f(L[N],b,N,I);else f(L,b,0,I)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(M,T,S,I){if(v(M,T,S,I)===!0){let b=M.__offset,R=M.value;if(Array.isArray(R)){let L=0;for(let N=0;N<R.length;N++){let U=R[N],W=p(U);g(U,M.__data,L),typeof U!="number"&&typeof U!="boolean"&&!U.isMatrix3&&!ArrayBuffer.isView(U)&&(L+=W.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(R,M.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,b,M.__data)}}function g(M,T,S){typeof M=="number"||typeof M=="boolean"?T[0]=M:M.isMatrix3?(T[0]=M.elements[0],T[1]=M.elements[1],T[2]=M.elements[2],T[3]=0,T[4]=M.elements[3],T[5]=M.elements[4],T[6]=M.elements[5],T[7]=0,T[8]=M.elements[6],T[9]=M.elements[7],T[10]=M.elements[8],T[11]=0):ArrayBuffer.isView(M)?T.set(new M.constructor(M.buffer,M.byteOffset,T.length)):M.toArray(T,S)}function v(M,T,S,I){let b=M.value,R=T+"_"+S;if(I[R]===void 0)return typeof b=="number"||typeof b=="boolean"?I[R]=b:ArrayBuffer.isView(b)?I[R]=b.slice():I[R]=b.clone(),!0;{let L=I[R];if(typeof b=="number"||typeof b=="boolean"){if(L!==b)return I[R]=b,!0}else{if(ArrayBuffer.isView(b))return!0;if(L.equals(b)===!1)return L.copy(b),!0}}return!1}function m(M){let T=M.uniforms,S=0,I=16;for(let R=0,L=T.length;R<L;R++){let N=Array.isArray(T[R])?T[R]:[T[R]];for(let U=0,W=N.length;U<W;U++){let F=N[U],q=Array.isArray(F.value)?F.value:[F.value];for(let Z=0,J=q.length;Z<J;Z++){let re=q[Z],Q=p(re),ne=S%I,se=ne%Q.boundary,ke=ne+se;S+=se,ke!==0&&I-ke<Q.storage&&(S+=I-ke),F.__data=new Float32Array(Q.storage/Float32Array.BYTES_PER_ELEMENT),F.__offset=S,S+=Q.storage}}}let b=S%I;return b>0&&(S+=I-b),M.__size=S,M.__cache={},this}function p(M){let T={boundary:0,storage:0};return typeof M=="number"||typeof M=="boolean"?(T.boundary=4,T.storage=4):M.isVector2?(T.boundary=8,T.storage=8):M.isVector3||M.isColor?(T.boundary=16,T.storage=12):M.isVector4?(T.boundary=16,T.storage=16):M.isMatrix3?(T.boundary=48,T.storage=48):M.isMatrix4?(T.boundary=64,T.storage=64):M.isTexture?qe("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(M)?(T.boundary=16,T.storage=M.byteLength):qe("WebGLRenderer: Unsupported uniform value type.",M),T}function _(M){let T=M.target;T.removeEventListener("dispose",_);let S=a.indexOf(T.__bindingPointIndex);a.splice(S,1),i.deleteBuffer(r[T.id]),delete r[T.id],delete s[T.id]}function A(){for(let M in r)i.deleteBuffer(r[M]);a=[],r={},s={}}return{bind:l,update:c,dispose:A}}var u_=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Ui=null;function d_(){return Ui===null&&(Ui=new $l(u_,16,16,Br,Sn),Ui.name="DFG_LUT",Ui.minFilter=Mn,Ui.magFilter=Mn,Ui.wrapS=zi,Ui.wrapT=zi,Ui.generateMipmaps=!1,Ui.needsUpdate=!0),Ui}var f0=class{constructor(e={}){let{canvas:t=Vm(),context:n=null,depth:r=!0,stencil:s=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:u=!1,outputBufferType:f=ei}=e;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=a;let v=f,m=new Set([kc,Rc,Cc]),p=new Set([ei,vi,Xs,$s,Ac,Ec]),_=new Uint32Array(4),A=new Int32Array(4),M=new V,T=null,S=null,I=[],b=[],R=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=xi,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let L=this,N=!1,U=null,W=null,F=null,q=null;this._outputColorSpace=jn;let Z=0,J=0,re=null,Q=-1,ne=null,se=new qt,ke=new qt,Re=null,mt=new tt(0),st=0,ct=t.width,ee=t.height,le=1,Ee=null,Ke=null,Ie=new qt(0,0,ct,ee),nt=new qt(0,0,ct,ee),Bt=!1,Qe=new Oa,ft=!1,Tt=!1,at=new It,Rt=new V,Jt=new qt,hn={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Lt=!1;function $t(){return re===null?le:1}let H=n;function un(C,B){return t.getContext(C,B)}let xt,P,w,X,K,te,ge,xe,ie,oe,ve,Oe,Me,ye,Ve,Xe,et,G,be,ae,_e,Ce,ce;try{let C={alpha:!0,depth:r,stencil:s,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"186"}`),t.addEventListener("webglcontextlost",Pt,!1),t.addEventListener("webglcontextrestored",_t,!1),t.addEventListener("webglcontextcreationerror",hi,!1),H===null){let B="webgl2";if(H=un(B,C),H===null)throw un(B)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}He()}catch(C){throw t.removeEventListener("webglcontextlost",Pt,!1),t.removeEventListener("webglcontextrestored",_t,!1),t.removeEventListener("webglcontextcreationerror",hi,!1),Ye("WebGLRenderer: "+C.message),C}function He(){xt=new y4(H),xt.init(),_e=new s_(H,xt),P=new c4(H,xt,e,_e),w=new i_(H,xt),P.reversedDepthBuffer&&u&&w.buffers.depth.setReversed(!0),W=H.createFramebuffer(),F=H.createFramebuffer(),q=H.createFramebuffer(),X=new M4(H),K=new Gb,te=new r_(H,xt,w,K,P,_e,X),ge=new v4(L),xe=new w2(H),Ce=new o4(H,xe),ie=new b4(H,xe,X,Ce),oe=new w4(H,ie,xe,Ce,X),G=new S4(H,P,te),Ve=new h4(K),ve=new Hb(L,ge,xt,P,Ce,Ve),Oe=new c_(L,K),Me=new qb,ye=new Jb(xt),et=new a4(L,ge,w,oe,g,l),Xe=new n_(L,oe,P),ce=new h_(H,X,P,w),be=new l4(H,xt,X),ae=new _4(H,xt,X),X.programs=ve.programs,L.capabilities=P,L.extensions=xt,L.properties=K,L.renderLists=Me,L.shadowMap=Xe,L.state=w,L.info=X}v!==ei&&(R=new A4(v,t.width,t.height,o,r,s));let Ue=new pd(L,H);this.xr=Ue,this.getContext=function(){return H},this.getContextAttributes=function(){return H.getContextAttributes()},this.forceContextLoss=function(){let C=xt.get("WEBGL_lose_context");C&&C.loseContext()},this.forceContextRestore=function(){let C=xt.get("WEBGL_lose_context");C&&C.restoreContext()},this.getPixelRatio=function(){return le},this.setPixelRatio=function(C){C!==void 0&&(le=C,this.setSize(ct,ee,!1))},this.getSize=function(C){return C.set(ct,ee)},this.setSize=function(C,B,j=!0){if(Ue.isPresenting){qe("WebGLRenderer: Can't change size while VR device is presenting.");return}ct=C,ee=B,t.width=Math.floor(C*le),t.height=Math.floor(B*le),j===!0&&(t.style.width=C+"px",t.style.height=B+"px"),R!==null&&R.setSize(t.width,t.height),this.setViewport(0,0,C,B)},this.getDrawingBufferSize=function(C){return C.set(ct*le,ee*le).floor()},this.setDrawingBufferSize=function(C,B,j){ct=C,ee=B,le=j,t.width=Math.floor(C*j),t.height=Math.floor(B*j),this.setViewport(0,0,C,B)},this.setEffects=function(C){if(v===ei){Ye("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(C){for(let B=0;B<C.length;B++)if(C[B].isOutputPass===!0){qe("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}R.setEffects(C||[])},this.getCurrentViewport=function(C){return C.copy(se)},this.getViewport=function(C){return C.copy(Ie)},this.setViewport=function(C,B,j,$){C.isVector4?Ie.set(C.x,C.y,C.z,C.w):Ie.set(C,B,j,$),w.viewport(se.copy(Ie).multiplyScalar(le).round())},this.getScissor=function(C){return C.copy(nt)},this.setScissor=function(C,B,j,$){C.isVector4?nt.set(C.x,C.y,C.z,C.w):nt.set(C,B,j,$),w.scissor(ke.copy(nt).multiplyScalar(le).round())},this.getScissorTest=function(){return Bt},this.setScissorTest=function(C){w.setScissorTest(Bt=C)},this.setOpaqueSort=function(C){Ee=C},this.setTransparentSort=function(C){Ke=C},this.getClearColor=function(C){return C.copy(et.getClearColor())},this.setClearColor=function(){et.setClearColor(...arguments)},this.getClearAlpha=function(){return et.getClearAlpha()},this.setClearAlpha=function(){et.setClearAlpha(...arguments)},this.clear=function(C=!0,B=!0,j=!0){let $=0;if(C){let Y=!1;if(re!==null){let Te=re.texture.format;Y=m.has(Te)}if(Y){let Te=re.texture.type,De=p.has(Te),we=et.getClearColor(),Ne=et.getClearAlpha(),Be=we.r,it=we.g,ht=we.b;De?(_[0]=Be,_[1]=it,_[2]=ht,_[3]=Ne,H.clearBufferuiv(H.COLOR,0,_)):(A[0]=Be,A[1]=it,A[2]=ht,A[3]=Ne,H.clearBufferiv(H.COLOR,0,A))}else $|=H.COLOR_BUFFER_BIT}B&&($|=H.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),j&&($|=H.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),$!==0&&H.clear($)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(C){C.setRenderer(this),U=C},this.dispose=function(){t.removeEventListener("webglcontextlost",Pt,!1),t.removeEventListener("webglcontextrestored",_t,!1),t.removeEventListener("webglcontextcreationerror",hi,!1),et.dispose(),Me.dispose(),ye.dispose(),K.dispose(),ge.dispose(),oe.dispose(),Ce.dispose(),ce.dispose(),ve.dispose(),Ue.dispose(),Ue.removeEventListener("sessionstart",Bd),Ue.removeEventListener("sessionend",Od),qr.stop()};function Pt(C){C.preventDefault(),Gu("WebGLRenderer: Context Lost."),N=!0}function _t(){Gu("WebGLRenderer: Context Restored."),N=!1;let C=X.autoReset,B=Xe.enabled,j=Xe.autoUpdate,$=Xe.needsUpdate,Y=Xe.type;He(),X.autoReset=C,Xe.enabled=B,Xe.autoUpdate=j,Xe.needsUpdate=$,Xe.type=Y}function hi(C){Ye("WebGLRenderer: A WebGL context could not be created. Reason: ",C.statusMessage)}function Mi(C){let B=C.target;B.removeEventListener("dispose",Mi),mg(B)}function mg(C){gg(C),K.remove(C)}function gg(C){let B=K.get(C).programs;B!==void 0&&(B.forEach(function(j){ve.releaseProgram(j)}),C.isShaderMaterial&&ve.releaseShaderCache(C))}this.renderBufferDirect=function(C,B,j,$,Y,Te){B===null&&(B=hn);let De=Y.isMesh&&Y.matrixWorld.determinantAffine()<0,we=yg(C,B,j,$,Y);w.setMaterial($,De);let Ne=j.index,Be=1;if($.wireframe===!0){if(Ne=ie.getWireframeAttribute(j),Ne===void 0)return;Be=2}let it=j.drawRange,ht=j.attributes.position,Fe=it.start*Be,Mt=(it.start+it.count)*Be;Te!==null&&(Fe=Math.max(Fe,Te.start*Be),Mt=Math.min(Mt,(Te.start+Te.count)*Be)),Ne!==null?(Fe=Math.max(Fe,0),Mt=Math.min(Mt,Ne.count)):ht!=null&&(Fe=Math.max(Fe,0),Mt=Math.min(Mt,ht.count));let en=Mt-Fe;if(en<0||en===1/0)return;Ce.setup(Y,$,we,j,Ne);let Dt,kt=be;if(Ne!==null&&(Dt=xe.get(Ne),kt=ae,kt.setIndex(Dt)),Y.isMesh)$.wireframe===!0?(w.setLineWidth($.wireframeLinewidth*$t()),kt.setMode(H.LINES)):kt.setMode(H.TRIANGLES);else if(Y.isLine){let wn=$.linewidth;wn===void 0&&(wn=1),w.setLineWidth(wn*$t()),Y.isLineSegments?kt.setMode(H.LINES):Y.isLineLoop?kt.setMode(H.LINE_LOOP):kt.setMode(H.LINE_STRIP)}else Y.isPoints?kt.setMode(H.POINTS):Y.isSprite&&kt.setMode(H.TRIANGLES);if(Y.isBatchedMesh)if(xt.get("WEBGL_multi_draw"))kt.renderMultiDraw(Y._multiDrawStarts,Y._multiDrawCounts,Y._multiDrawCount);else{let wn=Y._multiDrawStarts,ze=Y._multiDrawCounts,Pn=Y._multiDrawCount,gt=Ne?xe.get(Ne).bytesPerElement:1,ni=K.get($).currentProgram.getUniforms();for(let Si=0;Si<Pn;Si++)ni.setValue(H,"_gl_DrawID",Si),kt.render(wn[Si]/gt,ze[Si])}else if(Y.isInstancedMesh)kt.renderInstances(Fe,en,Y.count);else if(j.isInstancedBufferGeometry){let wn=j._maxInstanceCount!==void 0?j._maxInstanceCount:1/0,ze=Math.min(j.instanceCount,wn);kt.renderInstances(Fe,en,ze)}else kt.render(Fe,en)};function Ud(C,B,j,$){U!==null&&C.isNodeMaterial&&U.setObject($,C),ft===!0&&Ve.setState(C,j,!1),C.transparent===!0&&C.side===Fi&&C.forceSinglePass===!1?(C.side=Un,C.needsUpdate=!0,Io(C,B,$),C.side=Dr,C.needsUpdate=!0,Io(C,B,$),C.side=Fi):Io(C,B,$)}this.compile=function(C,B,j=null){j===null&&(j=C),U!==null&&U.renderStart(C,B,j),S=ye.get(j),S.init(B),b.push(S),j.traverseVisible(function(Y){Y.isLight&&Y.layers.test(B.layers)&&(S.pushLight(Y),Y.castShadow&&S.pushShadow(Y))}),C!==j&&C.traverseVisible(function(Y){Y.isLight&&Y.layers.test(B.layers)&&(S.pushLight(Y),Y.castShadow&&S.pushShadow(Y))}),S.setupLights(),U!==null&&U.updateLights(S.state.lightsArray),Tt=this.localClippingEnabled,ft=Ve.init(this.clippingPlanes,Tt),ft===!0&&Ve.setGlobalState(this.clippingPlanes,B),U!==null&&Xe.render(S.state.shadowsArray,j,B);let $=new Set;return C.traverse(function(Y){if(!(Y.isMesh||Y.isPoints||Y.isLine||Y.isSprite))return;let Te=Y.material;if(Te)if(Array.isArray(Te))for(let De=0;De<Te.length;De++){let we=Te[De];Ud(we,j,B,Y),$.add(we)}else Ud(Te,j,B,Y),$.add(Te)}),S=b.pop(),U!==null&&U.renderEnd(),$},this.compileAsync=function(C,B,j=null){let $=this.compile(C,B,j);return new Promise(Y=>{function Te(){if($.forEach(function(De){let Ne=K.get(De).currentProgram;(Ne===void 0||Ne.isReady())&&$.delete(De)}),$.size===0){Y(C);return}setTimeout(Te,10)}xt.get("KHR_parallel_shader_compile")!==null?Te():setTimeout(Te,10)})};let q0=null;function xg(C){q0&&q0(C)}function Bd(){qr.stop()}function Od(){qr.start()}let qr=new m1;qr.setAnimationLoop(xg),typeof self<"u"&&qr.setContext(self),this.setAnimationLoop=function(C){q0=C,Ue.setAnimationLoop(C),C===null?qr.stop():qr.start()},Ue.addEventListener("sessionstart",Bd),Ue.addEventListener("sessionend",Od),this.render=function(C,B){if(B!==void 0&&B.isCamera!==!0){Ye("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;U!==null&&U.renderStart(C,B);let j=Ue.enabled===!0&&Ue.isPresenting===!0,$=R!==null&&(re===null||j)&&R.begin(L,re);if(C.matrixWorldAutoUpdate===!0&&C.updateMatrixWorld(),B.parent===null&&B.matrixWorldAutoUpdate===!0&&B.updateMatrixWorld(),Ue.enabled===!0&&Ue.isPresenting===!0&&(R===null||R.isCompositing()===!1)&&(Ue.cameraAutoUpdate===!0&&Ue.updateCamera(B),B=Ue.getCamera()),C.isScene===!0&&C.onBeforeRender(L,C,B,re),S=ye.get(C,b.length),S.init(B),S.state.textureUnits=te.getTextureUnits(),b.push(S),at.multiplyMatrices(B.projectionMatrix,B.matrixWorldInverse),Qe.setFromProjectionMatrix(at,gi,B.reversedDepth),Tt=this.localClippingEnabled,ft=Ve.init(this.clippingPlanes,Tt),T=Me.get(C,I.length),T.init(),I.push(T),Ue.enabled===!0&&Ue.isPresenting===!0){let De=L.xr.getDepthSensingMesh();De!==null&&X0(De,B,-1/0,L.sortObjects)}X0(C,B,0,L.sortObjects),T.finish(),U!==null&&U.updateLights(S.state.lightsArray),L.sortObjects===!0&&T.sort(Ee,Ke),Lt=Ue.enabled===!1||Ue.isPresenting===!1||Ue.hasDepthSensing()===!1,Lt&&et.addToRenderList(T,C),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),ft===!0&&Ve.beginShadows();let Y=S.state.shadowsArray;if(Xe.render(Y,C,B),ft===!0&&Ve.endShadows(),($&&R.hasRenderPass())===!1){let De=T.opaque,we=T.transmissive;if(S.setupLights(),B.isArrayCamera){let Ne=B.cameras;if(we.length>0)for(let Be=0,it=Ne.length;Be<it;Be++){let ht=Ne[Be];Hd(De,we,C,ht)}Lt&&et.render(C);for(let Be=0,it=Ne.length;Be<it;Be++){let ht=Ne[Be];Vd(T,C,ht,ht.viewport)}}else we.length>0&&Hd(De,we,C,B),Lt&&et.render(C),Vd(T,C,B)}re!==null&&J===0&&(te.updateMultisampleRenderTarget(re),te.updateRenderTargetMipmap(re)),$&&R.end(L),C.isScene===!0&&C.onAfterRender(L,C,B),Ce.resetDefaultState(),Q=-1,ne=null,b.pop(),b.length>0?(S=b[b.length-1],te.setTextureUnits(S.state.textureUnits),ft===!0&&Ve.setGlobalState(L.clippingPlanes,S.state.camera)):S=null,I.pop(),I.length>0?T=I[I.length-1]:T=null,U!==null&&U.renderEnd()};function X0(C,B,j,$){if(C.visible===!1)return;if(C.layers.test(B.layers)){if(C.isGroup)j=C.renderOrder;else if(C.isLOD)C.autoUpdate===!0&&C.update(B);else if(C.isLightProbeGrid)S.pushLightProbeGrid(C);else if(C.isLight)S.pushLight(C),C.castShadow&&S.pushShadow(C);else if(C.isSprite){if(!C.frustumCulled||C.intersectsFrustum(Qe)){$&&Jt.setFromMatrixPosition(C.matrixWorld).applyMatrix4(at);let De=oe.update(C),we=C.material;we.visible&&T.push(C,De,we,j,Jt.z,null,B)}}else if((C.isMesh||C.isLine||C.isPoints)&&(!C.frustumCulled||C.intersectsFrustum(Qe))){let De=oe.update(C),we=C.material;if($&&(C.boundingSphere!==void 0?(C.boundingSphere===null&&C.computeBoundingSphere(),Jt.copy(C.boundingSphere.center)):(De.boundingSphere===null&&De.computeBoundingSphere(),Jt.copy(De.boundingSphere.center)),Jt.applyMatrix4(C.matrixWorld).applyMatrix4(at)),Array.isArray(we)){let Ne=De.groups;for(let Be=0,it=Ne.length;Be<it;Be++){let ht=Ne[Be],Fe=we[ht.materialIndex];Fe&&Fe.visible&&T.push(C,De,Fe,j,Jt.z,ht,B)}}else we.visible&&T.push(C,De,we,j,Jt.z,null,B)}}let Te=C.children;for(let De=0,we=Te.length;De<we;De++)X0(Te[De],B,j,$)}function Vd(C,B,j,$){let{opaque:Y,transmissive:Te,transparent:De}=C;S.setupLightsView(j),ft===!0&&Ve.setGlobalState(L.clippingPlanes,j),$&&w.viewport(se.copy($)),Y.length>0&&ko(Y,B,j),Te.length>0&&ko(Te,B,j),De.length>0&&ko(De,B,j),w.buffers.depth.setTest(!0),w.buffers.depth.setMask(!0),w.buffers.color.setMask(!0),w.setPolygonOffset(!1)}function Hd(C,B,j,$){if((j.isScene===!0?j.overrideMaterial:null)!==null)return;if(S.state.transmissionRenderTarget[$.id]===void 0){let Fe=xt.has("EXT_color_buffer_half_float")||xt.has("EXT_color_buffer_float");S.state.transmissionRenderTarget[$.id]=new on(1,1,{generateMipmaps:!0,type:Fe?Sn:ei,minFilter:Fr,samples:Math.max(4,P.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:lt.workingColorSpace})}let Te=S.state.transmissionRenderTarget[$.id],De=$.viewport||se;Te.setSize(De.z*L.transmissionResolutionScale,De.w*L.transmissionResolutionScale);let we=L.getRenderTarget(),Ne=L.getActiveCubeFace(),Be=L.getActiveMipmapLevel();L.setRenderTarget(Te),L.getClearColor(mt),st=L.getClearAlpha(),st<1&&L.setClearColor(16777215,.5),L.clear(),Lt&&et.render(j);let it=L.toneMapping;L.toneMapping=xi;let ht=$.viewport;if($.viewport!==void 0&&($.viewport=void 0),S.setupLightsView($),ft===!0&&Ve.setGlobalState(L.clippingPlanes,$),ko(C,j,$),te.updateMultisampleRenderTarget(Te),te.updateRenderTargetMipmap(Te),xt.has("WEBGL_multisampled_render_to_texture")===!1){let Fe=!1;for(let Mt=0,en=B.length;Mt<en;Mt++){let Dt=B[Mt],{object:kt,geometry:wn,material:ze,group:Pn}=Dt;if(ze.side===Fi&&kt.layers.test($.layers)){let gt=ze.side;ze.side=Un,ze.needsUpdate=!0,Gd(kt,j,$,wn,ze,Pn),ze.side=gt,ze.needsUpdate=!0,Fe=!0}}Fe===!0&&(te.updateMultisampleRenderTarget(Te),te.updateRenderTargetMipmap(Te))}L.setRenderTarget(we,Ne,Be),L.setClearColor(mt,st),ht!==void 0&&($.viewport=ht),L.toneMapping=it}function ko(C,B,j){let $=B.isScene===!0?B.overrideMaterial:null;for(let Y=0,Te=C.length;Y<Te;Y++){let De=C[Y],{object:we,geometry:Ne,group:Be}=De,it=De.material;it.allowOverride===!0&&$!==null&&(it=$),we.layers.test(j.layers)&&Gd(we,B,j,Ne,it,Be)}}function Gd(C,B,j,$,Y,Te){U!==null&&Y.isNodeMaterial&&U.setObject(C,Y),C.onBeforeRender(L,B,j,$,Y,Te),C.modelViewMatrix.multiplyMatrices(j.matrixWorldInverse,C.matrixWorld),C.normalMatrix.getNormalMatrix(C.modelViewMatrix),Y.onBeforeRender(L,B,j,$,C,Te),Y.transparent===!0&&Y.side===Fi&&Y.forceSinglePass===!1?(Y.side=Un,Y.needsUpdate=!0,L.renderBufferDirect(j,B,$,Y,C,Te),Y.side=Dr,Y.needsUpdate=!0,L.renderBufferDirect(j,B,$,Y,C,Te),Y.side=Fi):L.renderBufferDirect(j,B,$,Y,C,Te),C.onAfterRender(L,B,j,$,Y,Te)}function Io(C,B,j){B.isScene!==!0&&(B=hn);let $=K.get(C),Y=S.state.lights,Te=S.state.shadowsArray,De=Y.state.version,we=ve.getParameters(C,Y.state,Te,B,j,S.state.lightProbeGridArray),Ne=ve.getProgramCacheKey(we),Be=$.programs;$.environment=C.isMeshStandardMaterial||C.isMeshLambertMaterial||C.isMeshPhongMaterial?B.environment:null,$.fog=B.fog;let it=C.isMeshStandardMaterial||C.isMeshLambertMaterial&&!C.envMap||C.isMeshPhongMaterial&&!C.envMap;$.envMap=ge.get(C.envMap||$.environment,it),$.envMapRotation=$.environment!==null&&C.envMap===null?B.environmentRotation:C.envMapRotation,Be===void 0&&(C.addEventListener("dispose",Mi),Be=new Map,$.programs=Be);let ht=Be.get(Ne);if(ht!==void 0){if($.currentProgram===ht&&$.lightsStateVersion===De)return qd(C,we),ht}else we.uniforms=ve.getUniforms(C),U!==null&&C.isNodeMaterial&&U.build(C,j,we),C.onBeforeCompile(we,L),ht=ve.acquireProgram(we,Ne),Be.set(Ne,ht),$.uniforms=we.uniforms;let Fe=$.uniforms;return(!C.isShaderMaterial&&!C.isRawShaderMaterial||C.clipping===!0)&&(Fe.clippingPlanes=Ve.uniform),qd(C,we),$.needsLights=_g(C),$.lightsStateVersion=De,$.needsLights&&(Fe.ambientLightColor.value=Y.state.ambient,Fe.lightProbe.value=Y.state.probe,Fe.sunLights.value=Y.state.sun,Fe.sunLightShadows.value=Y.state.sunShadow,Fe.directionalLights.value=Y.state.directional,Fe.directionalLightShadows.value=Y.state.directionalShadow,Fe.spotLights.value=Y.state.spot,Fe.spotLightShadows.value=Y.state.spotShadow,Fe.rectAreaLights.value=Y.state.rectArea,Fe.ltc_1.value=Y.state.rectAreaLTC1,Fe.ltc_2.value=Y.state.rectAreaLTC2,Fe.pointLights.value=Y.state.point,Fe.pointLightShadows.value=Y.state.pointShadow,Fe.hemisphereLights.value=Y.state.hemi,Fe.sunShadowMatrix.value=Y.state.sunShadowMatrix,Fe.sunShadowCascade.value=Y.state.sunShadowCascade,Fe.directionalShadowMatrix.value=Y.state.directionalShadowMatrix,Fe.spotLightMatrix.value=Y.state.spotLightMatrix,Fe.spotLightMap.value=Y.state.spotLightMap,Fe.pointShadowMatrix.value=Y.state.pointShadowMatrix),$.lightProbeGrid=S.state.lightProbeGridArray.length>0,$.currentProgram=ht,$.uniformsList=null,ht}function Wd(C){if(C.uniformsList===null){let B=C.currentProgram.getUniforms();C.uniformsList=Zs.seqWithValue(B.seq,C.uniforms)}return C.uniformsList}function qd(C,B){let j=K.get(C);j.outputColorSpace=B.outputColorSpace,j.batching=B.batching,j.batchingColor=B.batchingColor,j.instancing=B.instancing,j.instancingColor=B.instancingColor,j.instancingMorph=B.instancingMorph,j.skinning=B.skinning,j.morphTargets=B.morphTargets,j.morphNormals=B.morphNormals,j.morphColors=B.morphColors,j.morphTargetsCount=B.morphTargetsCount,j.numClippingPlanes=B.numClippingPlanes,j.numIntersection=B.numClipIntersection,j.vertexAlphas=B.vertexAlphas,j.vertexTangents=B.vertexTangents,j.toneMapping=B.toneMapping}function vg(C,B){if(C.length===0)return null;if(C.length===1)return C[0].texture!==null?C[0]:null;M.setFromMatrixPosition(B.matrixWorld);for(let j=0,$=C.length;j<$;j++){let Y=C[j];if(Y.texture!==null&&Y.boundingBox.containsPoint(M))return Y}return null}function yg(C,B,j,$,Y){B.isScene!==!0&&(B=hn),te.resetTextureUnits();let Te=B.fog,De=$.isMeshStandardMaterial||$.isMeshLambertMaterial||$.isMeshPhongMaterial?B.environment:null,we=re===null?L.outputColorSpace:re.isXRRenderTarget===!0?re.texture.colorSpace:lt.workingColorSpace,Ne=$.isMeshStandardMaterial||$.isMeshLambertMaterial&&!$.envMap||$.isMeshPhongMaterial&&!$.envMap,Be=ge.get($.envMap||De,Ne),it=$.vertexColors===!0&&!!j.attributes.color&&j.attributes.color.itemSize===4,ht=!!j.attributes.tangent&&(!!$.normalMap||$.anisotropy>0),Fe=!!j.morphAttributes.position,Mt=!!j.morphAttributes.normal,en=!!j.morphAttributes.color,Dt=xi;$.toneMapped&&(re===null||re.isXRRenderTarget===!0)&&(Dt=L.toneMapping);let kt=j.morphAttributes.position||j.morphAttributes.normal||j.morphAttributes.color,wn=kt!==void 0?kt.length:0,ze=K.get($),Pn=S.state.lights;if(ft===!0&&(Tt===!0||C!==ne)){let zt=C===ne&&$.id===Q;Ve.setState($,C,zt)}let gt=!1;$.version===ze.__version?(ze.needsLights&&ze.lightsStateVersion!==Pn.state.version||ze.outputColorSpace!==we||Y.isBatchedMesh&&ze.batching===!1||!Y.isBatchedMesh&&ze.batching===!0||Y.isBatchedMesh&&ze.batchingColor===!0&&Y._colorsTexture===null||Y.isBatchedMesh&&ze.batchingColor===!1&&Y._colorsTexture!==null||Y.isInstancedMesh&&ze.instancing===!1||!Y.isInstancedMesh&&ze.instancing===!0||Y.isSkinnedMesh&&ze.skinning===!1||!Y.isSkinnedMesh&&ze.skinning===!0||Y.isInstancedMesh&&ze.instancingColor===!0&&Y.instanceColor===null||Y.isInstancedMesh&&ze.instancingColor===!1&&Y.instanceColor!==null||Y.isInstancedMesh&&ze.instancingMorph===!0&&Y.morphTexture===null||Y.isInstancedMesh&&ze.instancingMorph===!1&&Y.morphTexture!==null||ze.envMap!==Be||$.fog===!0&&ze.fog!==Te||ze.numClippingPlanes!==void 0&&(ze.numClippingPlanes!==Ve.numPlanes||ze.numIntersection!==Ve.numIntersection)||ze.vertexAlphas!==it||ze.vertexTangents!==ht||ze.morphTargets!==Fe||ze.morphNormals!==Mt||ze.morphColors!==en||ze.toneMapping!==Dt||ze.morphTargetsCount!==wn||!!ze.lightProbeGrid!=S.state.lightProbeGridArray.length>0)&&(gt=!0):(gt=!0,ze.__version=$.version);let ni=ze.currentProgram;gt===!0&&(ni=Io($,B,Y),U&&$.isNodeMaterial&&U.onUpdateProgram($,ni,ze));let Si=!1,hr=!1,ds=!1,At=ni.getUniforms(),jt=ze.uniforms;if(w.useProgram(ni.program)&&(Si=!0,hr=!0,ds=!0),$.id!==Q&&(Q=$.id,hr=!0),ze.needsLights){let zt=vg(S.state.lightProbeGridArray,Y);ze.lightProbeGrid!==zt&&(ze.lightProbeGrid=zt,hr=!0)}if(Si||ne!==C){w.buffers.depth.getReversed()&&C.reversedDepth!==!0&&(C._reversedDepth=!0,C.updateProjectionMatrix()),At.setValue(H,"projectionMatrix",C.projectionMatrix),At.setValue(H,"viewMatrix",C.matrixWorldInverse);let dr=At.map.cameraPosition;dr!==void 0&&dr.setValue(H,Rt.setFromMatrixPosition(C.matrixWorld)),P.logarithmicDepthBuffer&&At.setValue(H,"logDepthBufFC",2/(Math.log(C.far+1)/Math.LN2)),($.isMeshPhongMaterial||$.isMeshToonMaterial||$.isMeshLambertMaterial||$.isMeshBasicMaterial||$.isMeshStandardMaterial||$.isShaderMaterial)&&At.setValue(H,"isOrthographic",C.isOrthographicCamera===!0),ne!==C&&(ne=C,hr=!0,ds=!0)}if(ze.needsLights&&(Pn.state.sunShadowMap.length>0&&At.setValue(H,"sunShadowMap",Pn.state.sunShadowMap,te),Pn.state.directionalShadowMap.length>0&&At.setValue(H,"directionalShadowMap",Pn.state.directionalShadowMap,te),Pn.state.spotShadowMap.length>0&&At.setValue(H,"spotShadowMap",Pn.state.spotShadowMap,te),Pn.state.pointShadowMap.length>0&&At.setValue(H,"pointShadowMap",Pn.state.pointShadowMap,te)),Y.isSkinnedMesh){At.setOptional(H,Y,"bindMatrix"),At.setOptional(H,Y,"bindMatrixInverse");let zt=Y.skeleton;zt&&(zt.boneTexture===null&&zt.computeBoneTexture(),At.setValue(H,"boneTexture",zt.boneTexture,te))}Y.isBatchedMesh&&(At.setOptional(H,Y,"batchingTexture"),At.setValue(H,"batchingTexture",Y._matricesTexture,te),At.setOptional(H,Y,"batchingIdTexture"),At.setValue(H,"batchingIdTexture",Y._indirectTexture,te),At.setOptional(H,Y,"batchingColorTexture"),Y._colorsTexture!==null&&At.setValue(H,"batchingColorTexture",Y._colorsTexture,te));let ur=j.morphAttributes;if((ur.position!==void 0||ur.normal!==void 0||ur.color!==void 0)&&G.update(Y,j,ni),(hr||ze.receiveShadow!==Y.receiveShadow)&&(ze.receiveShadow=Y.receiveShadow,At.setValue(H,"receiveShadow",Y.receiveShadow)),($.isMeshStandardMaterial||$.isMeshLambertMaterial||$.isMeshPhongMaterial)&&$.envMap===null&&B.environment!==null&&(jt.envMapIntensity.value=B.environmentIntensity),jt.dfgLUT!==void 0&&(jt.dfgLUT.value=d_()),hr){if(At.setValue(H,"toneMappingExposure",L.toneMappingExposure),ze.needsLights&&bg(jt,ds),Te&&$.fog===!0&&Oe.refreshFogUniforms(jt,Te),Oe.refreshMaterialUniforms(jt,$,le,ee,S.state.transmissionRenderTarget[C.id]),ze.needsLights&&ze.lightProbeGrid){let zt=ze.lightProbeGrid;jt.probesSH.value=zt.texture,jt.probesMin.value.copy(zt.boundingBox.min),jt.probesMax.value.copy(zt.boundingBox.max),jt.probesResolution.value.copy(zt.resolution)}Zs.upload(H,Wd(ze),jt,te)}if($.isShaderMaterial&&$.uniformsNeedUpdate===!0&&(Zs.upload(H,Wd(ze),jt,te),$.uniformsNeedUpdate=!1),$.isSpriteMaterial&&At.setValue(H,"center",Y.center),At.setValue(H,"modelViewMatrix",Y.modelViewMatrix),At.setValue(H,"normalMatrix",Y.normalMatrix),At.setValue(H,"modelMatrix",Y.matrixWorld),$.uniformsGroups!==void 0){let zt=$.uniformsGroups;for(let dr=0,fs=zt.length;dr<fs;dr++){let $d=zt[dr];ce.update($d,ni),ce.bind($d,ni)}}return ni}function bg(C,B){C.ambientLightColor.needsUpdate=B,C.lightProbe.needsUpdate=B,C.sunLights.needsUpdate=B,C.sunLightShadows.needsUpdate=B,C.directionalLights.needsUpdate=B,C.directionalLightShadows.needsUpdate=B,C.pointLights.needsUpdate=B,C.pointLightShadows.needsUpdate=B,C.spotLights.needsUpdate=B,C.spotLightShadows.needsUpdate=B,C.rectAreaLights.needsUpdate=B,C.hemisphereLights.needsUpdate=B}function _g(C){return C.isMeshLambertMaterial||C.isMeshToonMaterial||C.isMeshPhongMaterial||C.isMeshStandardMaterial||C.isShadowMaterial||C.isShaderMaterial&&C.lights===!0}this.getActiveCubeFace=function(){return Z},this.getActiveMipmapLevel=function(){return J},this.getRenderTarget=function(){return re},this.setRenderTargetTextures=function(C,B,j){let $=K.get(C);$.__autoAllocateDepthBuffer=C.resolveDepthBuffer===!1,$.__autoAllocateDepthBuffer===!1&&($.__useRenderToTexture=!1),K.get(C.texture).__webglTexture=B,K.get(C.depthTexture).__webglTexture=$.__autoAllocateDepthBuffer?void 0:j,$.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(C,B){let j=K.get(C);j.__webglFramebuffer=B,j.__useDefaultFramebuffer=B===void 0},this.setRenderTarget=function(C,B=0,j=0){re=C,Z=B,J=j;let $=null,Y=!1,Te=!1;if(C){let we=K.get(C);if(we.__useDefaultFramebuffer!==void 0){w.bindFramebuffer(H.FRAMEBUFFER,we.__webglFramebuffer),se.copy(C.viewport),ke.copy(C.scissor),Re=C.scissorTest,w.viewport(se),w.scissor(ke),w.setScissorTest(Re),Q=-1;return}else if(we.__webglFramebuffer===void 0)te.setupRenderTarget(C);else if(we.__hasExternalTextures)te.rebindTextures(C,K.get(C.texture).__webglTexture,K.get(C.depthTexture).__webglTexture);else if(C.depthBuffer){let it=C.depthTexture;if(we.__boundDepthTexture!==it){if(it!==null&&K.has(it)&&(C.width!==it.image.width||C.height!==it.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");te.setupDepthRenderbuffer(C)}}let Ne=C.texture;(Ne.isData3DTexture||Ne.isDataArrayTexture||Ne.isCompressedArrayTexture)&&(Te=!0);let Be=K.get(C).__webglFramebuffer;C.isWebGLCubeRenderTarget?(Array.isArray(Be[B])?$=Be[B][j]:$=Be[B],Y=!0):C.samples>0&&te.useMultisampledRTT(C)===!1?$=K.get(C).__webglMultisampledFramebuffer:Array.isArray(Be)?$=Be[j]:$=Be,se.copy(C.viewport),ke.copy(C.scissor),Re=C.scissorTest}else se.copy(Ie).multiplyScalar(le).floor(),ke.copy(nt).multiplyScalar(le).floor(),Re=Bt;if(j!==0&&($=W),w.bindFramebuffer(H.FRAMEBUFFER,$)&&w.drawBuffers(C,$),w.viewport(se),w.scissor(ke),w.setScissorTest(Re),Y){let we=K.get(C.texture);H.framebufferTexture2D(H.FRAMEBUFFER,H.COLOR_ATTACHMENT0,H.TEXTURE_CUBE_MAP_POSITIVE_X+B,we.__webglTexture,j)}else if(Te){let we=B;for(let Ne=0;Ne<C.textures.length;Ne++){let Be=K.get(C.textures[Ne]);H.framebufferTextureLayer(H.FRAMEBUFFER,H.COLOR_ATTACHMENT0+Ne,Be.__webglTexture,j,we)}}else if(C!==null&&j!==0){let we=K.get(C.texture);H.framebufferTexture2D(H.FRAMEBUFFER,H.COLOR_ATTACHMENT0,H.TEXTURE_2D,we.__webglTexture,j)}Q=-1};function Xd(C){let B=K.get(C);return(B.__readFormat!==C.format||B.__readType!==C.type)&&(B.__readFormat=C.format,B.__readType=C.type,B.__formatReadable=P.textureFormatReadable(C.format),B.__typeReadable=P.textureTypeReadable(C.type)),B}this.readRenderTargetPixels=function(C,B,j,$,Y,Te,De,we=0){if(!(C&&C.isWebGLRenderTarget)){Ye("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Ne=K.get(C).__webglFramebuffer;if(C.isWebGLCubeRenderTarget&&De!==void 0&&(Ne=Ne[De]),Ne){w.bindFramebuffer(H.FRAMEBUFFER,Ne);try{let Be=C.textures[we],it=Be.format,ht=Be.type;C.textures.length>1&&H.readBuffer(H.COLOR_ATTACHMENT0+we);let Fe=Xd(Be);if(Fe.__formatReadable===!1){Ye("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Fe.__typeReadable===!1){Ye("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}B>=0&&B<=C.width-$&&j>=0&&j<=C.height-Y&&H.readPixels(B,j,$,Y,_e.convert(it),_e.convert(ht),Te)}finally{let Be=re!==null?K.get(re).__webglFramebuffer:null;w.bindFramebuffer(H.FRAMEBUFFER,Be)}}},this.readRenderTargetPixelsAsync=async function(C,B,j,$,Y,Te,De,we=0){if(!(C&&C.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Ne=K.get(C).__webglFramebuffer;if(C.isWebGLCubeRenderTarget&&De!==void 0&&(Ne=Ne[De]),Ne)if(B>=0&&B<=C.width-$&&j>=0&&j<=C.height-Y){w.bindFramebuffer(H.FRAMEBUFFER,Ne);let Be=C.textures[we],it=Be.format,ht=Be.type;C.textures.length>1&&H.readBuffer(H.COLOR_ATTACHMENT0+we);let Fe=Xd(Be);if(Fe.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Fe.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Mt=H.createBuffer();H.bindBuffer(H.PIXEL_PACK_BUFFER,Mt),H.bufferData(H.PIXEL_PACK_BUFFER,Te.byteLength,H.STREAM_READ),H.readPixels(B,j,$,Y,_e.convert(it),_e.convert(ht),0),H.bindBuffer(H.PIXEL_PACK_BUFFER,null);let en=re!==null?K.get(re).__webglFramebuffer:null;w.bindFramebuffer(H.FRAMEBUFFER,en);let Dt=H.fenceSync(H.SYNC_GPU_COMMANDS_COMPLETE,0);return H.flush(),await Gm(H,Dt,4),H.bindBuffer(H.PIXEL_PACK_BUFFER,Mt),H.getBufferSubData(H.PIXEL_PACK_BUFFER,0,Te),H.bindBuffer(H.PIXEL_PACK_BUFFER,null),H.deleteBuffer(Mt),H.deleteSync(Dt),Te}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(C,B=null,j=0){let $=Math.pow(2,-j),Y=Math.floor(C.image.width*$),Te=Math.floor(C.image.height*$),De=B!==null?B.x:0,we=B!==null?B.y:0;te.setTexture2D(C,0),H.copyTexSubImage2D(H.TEXTURE_2D,j,0,0,De,we,Y,Te),w.unbindTexture()},this.copyTextureToTexture=function(C,B,j=null,$=null,Y=0,Te=0){let De,we,Ne,Be,it,ht,Fe,Mt,en,Dt=C.isCompressedTexture?C.mipmaps[Te]:C.image;if(j!==null)De=j.max.x-j.min.x,we=j.max.y-j.min.y,Ne=j.isBox3?j.max.z-j.min.z:1,Be=j.min.x,it=j.min.y,ht=j.isBox3?j.min.z:0;else{let jt=Math.pow(2,-Y);De=Math.floor(Dt.width*jt),we=Math.floor(Dt.height*jt),C.isDataArrayTexture?Ne=Dt.depth:C.isData3DTexture?Ne=Math.floor(Dt.depth*jt):Ne=1,Be=0,it=0,ht=0}$!==null?(Fe=$.x,Mt=$.y,en=$.z):(Fe=0,Mt=0,en=0);let kt=_e.convert(B.format),wn=_e.convert(B.type),ze;B.isData3DTexture?(te.setTexture3D(B,0),ze=H.TEXTURE_3D):B.isDataArrayTexture||B.isCompressedArrayTexture?(te.setTexture2DArray(B,0),ze=H.TEXTURE_2D_ARRAY):(te.setTexture2D(B,0),ze=H.TEXTURE_2D),w.activeTexture(H.TEXTURE0),w.pixelStorei(H.UNPACK_FLIP_Y_WEBGL,B.flipY),w.pixelStorei(H.UNPACK_PREMULTIPLY_ALPHA_WEBGL,B.premultiplyAlpha),w.pixelStorei(H.UNPACK_ALIGNMENT,B.unpackAlignment);let Pn=w.getParameter(H.UNPACK_ROW_LENGTH),gt=w.getParameter(H.UNPACK_IMAGE_HEIGHT),ni=w.getParameter(H.UNPACK_SKIP_PIXELS),Si=w.getParameter(H.UNPACK_SKIP_ROWS),hr=w.getParameter(H.UNPACK_SKIP_IMAGES);w.pixelStorei(H.UNPACK_ROW_LENGTH,Dt.width),w.pixelStorei(H.UNPACK_IMAGE_HEIGHT,Dt.height),w.pixelStorei(H.UNPACK_SKIP_PIXELS,Be),w.pixelStorei(H.UNPACK_SKIP_ROWS,it),w.pixelStorei(H.UNPACK_SKIP_IMAGES,ht);let ds=C.isDataArrayTexture||C.isData3DTexture,At=B.isDataArrayTexture||B.isData3DTexture;if(C.isDepthTexture){let jt=K.get(C),ur=K.get(B),zt=K.get(jt.__renderTarget),dr=K.get(ur.__renderTarget);w.bindFramebuffer(H.READ_FRAMEBUFFER,zt.__webglFramebuffer),w.bindFramebuffer(H.DRAW_FRAMEBUFFER,dr.__webglFramebuffer);for(let fs=0;fs<Ne;fs++)ds&&(H.framebufferTextureLayer(H.READ_FRAMEBUFFER,H.COLOR_ATTACHMENT0,K.get(C).__webglTexture,Y,ht+fs),H.framebufferTextureLayer(H.DRAW_FRAMEBUFFER,H.COLOR_ATTACHMENT0,K.get(B).__webglTexture,Te,en+fs)),H.blitFramebuffer(Be,it,De,we,Fe,Mt,De,we,H.DEPTH_BUFFER_BIT,H.NEAREST);w.bindFramebuffer(H.READ_FRAMEBUFFER,null),w.bindFramebuffer(H.DRAW_FRAMEBUFFER,null)}else if(Y!==0||C.isRenderTargetTexture||K.has(C)){let jt=K.get(C),ur=K.get(B);w.bindFramebuffer(H.READ_FRAMEBUFFER,F),w.bindFramebuffer(H.DRAW_FRAMEBUFFER,q);for(let zt=0;zt<Ne;zt++)ds?H.framebufferTextureLayer(H.READ_FRAMEBUFFER,H.COLOR_ATTACHMENT0,jt.__webglTexture,Y,ht+zt):H.framebufferTexture2D(H.READ_FRAMEBUFFER,H.COLOR_ATTACHMENT0,H.TEXTURE_2D,jt.__webglTexture,Y),At?H.framebufferTextureLayer(H.DRAW_FRAMEBUFFER,H.COLOR_ATTACHMENT0,ur.__webglTexture,Te,en+zt):H.framebufferTexture2D(H.DRAW_FRAMEBUFFER,H.COLOR_ATTACHMENT0,H.TEXTURE_2D,ur.__webglTexture,Te),Y!==0?H.blitFramebuffer(Be,it,De,we,Fe,Mt,De,we,H.COLOR_BUFFER_BIT,H.NEAREST):At?H.copyTexSubImage3D(ze,Te,Fe,Mt,en+zt,Be,it,De,we):H.copyTexSubImage2D(ze,Te,Fe,Mt,Be,it,De,we);w.bindFramebuffer(H.READ_FRAMEBUFFER,null),w.bindFramebuffer(H.DRAW_FRAMEBUFFER,null)}else At?C.isDataTexture||C.isData3DTexture?H.texSubImage3D(ze,Te,Fe,Mt,en,De,we,Ne,kt,wn,Dt.data):B.isCompressedArrayTexture?H.compressedTexSubImage3D(ze,Te,Fe,Mt,en,De,we,Ne,kt,Dt.data):H.texSubImage3D(ze,Te,Fe,Mt,en,De,we,Ne,kt,wn,Dt):C.isDataTexture?H.texSubImage2D(H.TEXTURE_2D,Te,Fe,Mt,De,we,kt,wn,Dt.data):C.isCompressedTexture?H.compressedTexSubImage2D(H.TEXTURE_2D,Te,Fe,Mt,Dt.width,Dt.height,kt,Dt.data):H.texSubImage2D(H.TEXTURE_2D,Te,Fe,Mt,De,we,kt,wn,Dt);w.pixelStorei(H.UNPACK_ROW_LENGTH,Pn),w.pixelStorei(H.UNPACK_IMAGE_HEIGHT,gt),w.pixelStorei(H.UNPACK_SKIP_PIXELS,ni),w.pixelStorei(H.UNPACK_SKIP_ROWS,Si),w.pixelStorei(H.UNPACK_SKIP_IMAGES,hr),Te===0&&B.generateMipmaps&&H.generateMipmap(ze),w.unbindTexture()},this.initRenderTarget=function(C){K.get(C).__webglFramebuffer===void 0&&te.setupRenderTarget(C)},this.initTexture=function(C){C.isCubeTexture?te.setTextureCube(C,0):C.isData3DTexture?te.setTexture3D(C,0):C.isDataArrayTexture||C.isCompressedArrayTexture?te.setTexture2DArray(C,0):te.setTexture2D(C,0),w.unbindTexture()},this.resetState=function(){Z=0,J=0,re=null,w.reset(),Ce.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return gi}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=lt._getDrawingBufferColorSpace(e),t.unpackColorSpace=lt._getUnpackColorSpace()}};var js={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};var ti=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},p_=new ts(-1,1,1,-1,0,1),md=class extends _n{constructor(){super(),this.setAttribute("position",new an([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new an([0,2,0,0,2,0],2))}},m_=new md,Or=class{constructor(e){this._mesh=new kn(m_,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,p_)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}};var Qs=class extends ti{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof Ut?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=rr.clone(e.uniforms),this.material=new Ut({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new Or(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var vo=class extends ti{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),s=e.state;s.buffers.color.setMask(!1),s.buffers.depth.setMask(!1),s.buffers.color.setLocked(!0),s.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),s.buffers.stencil.setTest(!0),s.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),s.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),s.buffers.stencil.setClear(o),s.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),s.buffers.color.setLocked(!1),s.buffers.depth.setLocked(!1),s.buffers.color.setMask(!0),s.buffers.depth.setMask(!0),s.buffers.stencil.setLocked(!1),s.buffers.stencil.setFunc(r.EQUAL,1,4294967295),s.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),s.buffers.stencil.setLocked(!0)}},g0=class extends ti{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}};var x0=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new Le);this._width=n.width,this._height=n.height,t=new on(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:Sn}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Qs(js),this.copyPass.material.blending=oi,this.timer=new Ja}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let r=0,s=this.passes.length;r<s;r++){let a=this.passes[r];if(a.enabled!==!1){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(r),a.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),a.needsSwap){if(n){let o=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}vo!==void 0&&(a instanceof vo?n=!0:a instanceof g0&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new Le);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let s=0;s<this.passes.length;s++)this.passes[s].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};var v0=class extends ti{constructor(e,t,n=null,r=null,s=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=r,this.clearAlpha=s,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new tt}render(e,t,n){let r=e.autoClear;e.autoClear=!1;let s,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(s=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(s),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=r}};var M1={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new tt(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};var ea=class i extends ti{constructor(e,t=1,n,r){super(),this.strength=t,this.radius=n,this.threshold=r,this.resolution=e!==void 0?new Le(e.x,e.y):new Le(256,256),this.clearColor=new tt(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let s=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new on(s,a,{type:Sn,depthBuffer:!1}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){let d=new on(s,a,{type:Sn,depthBuffer:!1});d.texture.name="UnrealBloomPass.h"+h,d.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(d);let u=new on(s,a,{type:Sn,depthBuffer:!1});u.texture.name="UnrealBloomPass.v"+h,u.texture.generateMipmaps=!1,this.renderTargetsVertical.push(u),s=Math.round(s/2),a=Math.round(a/2)}let o=M1;this.highPassUniforms=rr.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new Ut({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let l=[6,10,14,18,22];s=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new Le(1/s,1/a),s=Math.round(s/2),a=Math.round(a/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new V(1,1,1),new V(1,1,1),new V(1,1,1),new V(1,1,1),new V(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=rr.clone(js.uniforms),this.blendMaterial=new Ut({uniforms:this.copyUniforms,vertexShader:js.vertexShader,fragmentShader:js.fragmentShader,premultipliedAlpha:!0,blending:nr,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new tt,this._oldClearAlpha=1,this._basic=new es,this._fsQuad=new Or(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let s=0;s<this.nMips;s++)this.renderTargetsHorizontal[s].setSize(n,r),this.renderTargetsVertical[s].setSize(n,r),this.separableBlurMaterials[s].uniforms.invSize.value=new Le(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(e,t,n,r,s){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let a=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),s&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=n.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let o=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this._fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[l].uniforms.direction.value=i.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=i.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this._fsQuad.render(e),o=this.renderTargetsVertical[l];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,s&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(n),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=a}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let a=0;a<e;a++)t.push(.39894*Math.exp(-.5*a*a/(n*n))/n);let r=[],s=[];for(let a=1;a<e;a+=2){let o=t[a],l=a+1<e?t[a+1]:0,c=o+l;r.push((a*o+(a+1)*l)/c),s.push(c)}return new Ut({defines:{KERNEL_PAIRS:r.length},uniforms:{colorTexture:{value:null},invSize:{value:new Le(.5,.5)},direction:{value:new Le(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:r},gaussianWeights:{value:s}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new Ut({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};ea.BlurDirectionX=new Le(1,0);ea.BlurDirectionY=new Le(0,1);var yo={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};var y0=class extends ti{constructor(){super(),this.isOutputPass=!0,this.uniforms=rr.clone(yo.uniforms),this.material=new Gs({name:yo.name,uniforms:this.uniforms,vertexShader:yo.vertexShader,fragmentShader:yo.fragmentShader}),this._fsQuad=new Or(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},lt.getTransfer(this._outputColorSpace)===yt&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Qa?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===eo?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===to?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===is?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===io?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===ro?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===no&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};function gn(i){let e=i>>>0;return function(){e=e+1831565813>>>0;let n=e;return n=Math.imul(n^n>>>15,n|1),n^=n+Math.imul(n^n>>>7,n|61),((n^n>>>14)>>>0)/4294967296}}function wt(i){let e=0;for(;e===0;)e=i();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*i())}var b0=(i,e,t)=>i<e?e:i>t?t:i;var gd=(i,e,t)=>{let n=b0((t-i)/(e-i),0,1);return n*n*(3-2*n)};function bo(i,e,t){i=(i%1+1)%1;let n=a=>(a+i*12)%12,r=e*Math.min(t,1-t),s=a=>t-r*Math.max(-1,Math.min(n(a)-3,Math.min(9-n(a),1)));return[s(0),s(8),s(4)]}function Gn(i,e,t){return[i[0]+(e[0]-i[0])*t,i[1]+(e[1]-i[1])*t,i[2]+(e[2]-i[2])*t]}function g_(){let i=.75;for(let e=0;e<40;e++)i-=(i*i*i+i*i-1)/(3*i*i+2*i);return{a:Math.sqrt(1-i*i),b:i}}var{a:S1,b:_0}=g_();function w1(i,e,t,n,r){let s=i*i+e*e,a=t*t+n*n,o=s>1e-12?Math.cbrt(1/s):1/Math.sqrt(a);a>1e-12&&(o=Math.min(o,1/Math.sqrt(a)));for(let c=0;c<40;c++){let h=o*o*o*s+o*o*a-1,d=3*o*o*s+2*o*a,u=h/d;if(o-=u,Math.abs(u)<1e-12*o)break}let l=Math.pow(o,1.5);return r[0]=l*i,r[1]=l*e,r[2]=o*t,r[3]=o*n,r}function M0(i,e,t,n,r,s,a=0){let o=Math.cos(r/2),l=Math.sin(r/2),c=Math.cos(r/3),h=Math.sin(r/3),d=o*i-l*e,u=l*i+o*e,f=c*t-h*n,g=h*t+c*n,v=Math.max(1-u,.001);return s[a]=f/v*1.25,s[a+1]=g/v*1.25,s[a+2]=d/v*1.25,Math.hypot(s[a],s[a+1],s[a+2])}function T1(i,e,t,n){let r=i*i-e*e,s=2*i*e,a=r*i-s*e,o=r*e+s*i,l=1-a,c=-o,h=Math.hypot(l,c),d=Math.sqrt(Math.max(0,(h+l)/2)),u=Math.sqrt(Math.max(0,(h-l)/2))*(c<0?-1:1);return n?(d-n[0])**2+(u-n[1])**2>(d+n[0])**2+(u+n[1])**2&&(d=-d,u=-u):t<0&&(d=-d,u=-u),[d,u]}var A1=i=>i/(1-i);function xd(i,e,t,n,r,s){let a=A1(i),o=a*Math.cos(e),l=a*Math.sin(e),c=T1(o,l,t,n);return w1(c[0],c[1],o,l,r),M0(r[0],r[1],r[2],r[3],0,s),c}function E1(i,e,{nv:t=200,na:n=400,maxR:r=6.5}={}){let a=t*n*2,o=new Float64Array(a),l=[0,0,0,0],c=[0,0,0],h=[0,0,0],d=[0,0,0],u=.988/t,f=2*Math.PI/n,g=0;for(let M=0;M<2;M++){let T=M?-1:1;for(let S=0;S<t;S++){let I=(S+.5)*u;for(let b=0;b<n;b++){let R=(b+.5)*f,L=xd(I,R,T,null,l,c),N=Math.hypot(c[0],c[1],c[2]),U=0;if(N<r){xd(I+u*.5,R,T,L,l,h),xd(I,R+f*.5,T,L,l,d);let W=h[0]-c[0],F=h[1]-c[1],q=h[2]-c[2],Z=d[0]-c[0],J=d[1]-c[1],re=d[2]-c[2];U=4*Math.hypot(F*re-q*J,q*Z-W*re,W*J-F*Z),Number.isFinite(U)||(U=0),U=Math.min(U,.05)}o[(M*t+S)*n+b]=U,g+=U}}}let v=new Float32Array(i*4),m=g/i,p=0,_=0,A=e()*m;for(let M=0;M<i;M++){for(;_<a-1&&p+o[_]<A;)p+=o[_],_++;A+=m;let T=_>=t*n?1:0,S=_-T*t*n,I=Math.floor(S/n),b=S%n,R=(I+e())*u,L=(b+e())*f,N=A1(R),U=N*Math.cos(L),W=N*Math.sin(L),F=T1(U,W,T?-1:1,null);w1(F[0],F[1],U,W,l),v.set(l,M*4)}return v}function _o(i,e){return e[0]=S1*Math.cos(3*i),e[1]=S1*Math.sin(3*i),e[2]=_0*Math.cos(2*i+Math.PI/3),e[3]=_0*Math.sin(2*i+Math.PI/3),e}function C1(i=720){let e=[],t=[0,0,0,0],n=[0,0,0];for(let r=0;r<i;r++)_o(r/i*2*Math.PI,t),M0(t[0],t[1],t[2],t[3],0,n),e.push([n[0],n[1],n[2]]);return e}var Mo="2026-10-12",R1="https://github.com/xhc144",Vr=[["概率论",237],["常微分方程与动力系统",196],["图论",157],["拓扑",132],["最优化",126],["复变",124],["数理统计",110],["群表示",97],["数值代数",90],["数值分析",79],["实变",75],["微分几何",71],["泛函",59],["抽象代数",58],["偏微分方程",49]],Hr=[["量子力学",194],["量子场论",148],["广义相对论",109],["理论力学",93],["波动与光学",81],["电动力学",80],["基础电磁学",80],["热学与统计物理",69],["基础力学",58]],Oi={mathBooks:Vr.length,mathPages:Vr.reduce((i,[,e])=>i+e,0),physBooks:Hr.length,physPages:Hr.reduce((i,[,e])=>i+e,0)},vd=[{key:"DPO",zh:"直接偏好优化",pages:36,unit:"7",note:"KL 最优策略 → 偏好似然 → 梯度"},{key:"Test-time compute",zh:"最优测试时计算",pages:43,unit:"8",note:"验证器、难度与并行 / 顺序预算"},{key:"DeepSeek-R1",zh:"R1 · Nature 正式论文",pages:18,unit:"7–8",note:"可验证奖励的强化学习"},{key:"CHIVE",zh:"用反事实检验解释",pages:34,unit:"10",note:"解释 → 反事实预测 → 干预证据"},{key:"DGM",zh:"达尔文哥德尔机",pages:128,unit:"11",note:"代码自更新、档案搜索、评估器投机"},{key:"STARS",zh:"循环动力学稳定性",pages:19,unit:"11",note:"稳定性、有效性与局部理论条件"},{key:"AlphaProof",zh:"奥林匹克形式数学推理",pages:39,unit:"11",note:"AND/OR 搜索、形式核验"},{key:"Engram",zh:"条件记忆与稀疏查找",pages:34,unit:"11",note:"容量 / 计算 / 存储分配"},{key:"CaT",zh:"以计算作为教师",pages:31,unit:"8 / 11",note:"伪参考、相关错误与监督闭环"}],k1=["条件文本预测","参数学习与梯度","因果注意力与缓存","评价、数据与算力","后训练与推理预算","工具与信任","机制解释与研究闭环","条件记忆、形式核验与循环状态"],So=[{name:"mit-ocw-notes",title:"MIT OCW 讲义归档与中文重编",status:"live",tag:"数学 · 物理",pushed:"2026-10-12",blurb:"归档 MIT OpenCourseWare 公开讲义，并用中文原生 LaTeX 重编成整册中文讲义，附题面与解答；保留来源、署名与许可（CC BY-NC-SA 4.0）。",stats:[["数学整册",15,"册"],["数学页数",1660,"页"],["物理已验",9,"科"],["物理页数",912,"页"]],url:"https://github.com/xhc144/mit-ocw-notes"},{name:"ai-self-study",title:"现代人工智能研究学习",status:"live",tag:"AI · 论文",pushed:"2026-10-12",blurb:"从语言模型的数学与训练出发读懂近年的基础模型论文：中文教材、9 篇指定版本论文全文译文（机器辅助、非官方）、可复现的 CPU 实验与研究记录。",stats:[["学习单元",11,"个"],["数学附录",3,"个"],["论文译文",9,"篇"],["原创研究说明",3,"份"]],version:"v0.3.1",url:"https://github.com/xhc144/ai-self-study"},{name:"claude-lab",title:"Claude 实验仓库",status:"live",tag:"AI 协作 · 可视化",pushed:"2026-10-12",blurb:"我提出题目、交给 Claude 独立完成的实验：程序化影片《对称的语言》《倒悬之海》，交互式数学可视化软件「数境 MathScape」——以及这个网站本身。",stats:[["抽象代数影片",220,"秒"],["三维短片",71,"秒"],["MathScape 单元测试",50,"个"],["端到端测试",32,"个"]],url:"https://github.com/xhc144/claude-lab"},{name:"repository-index",title:"学习资料与作品导航",status:"live",tag:"导航",pushed:"2026-10-08",blurb:"我全部项目的公开总目录与导航网页：课程与试卷资料、AI 原创与学科资料、书籍、工具与作品四个入口。导航公开，资料本身仍在私有仓库。",stats:[["导航入口",4,"类"]],url:"https://github.com/xhc144/repository-index",site:"https://xhc144.github.io/repository-index/"}],I1=[{title:"数学 LaTeX 讲义生成与审校 Skills",kind:"AI 工具",state:"持续开发",note:"让智能体按规范起草、编译、审校数学讲义的技能包"},{title:"数学竞赛试卷整理",kind:"数学",state:"持续整理",note:"竞赛试题的收集、转写与归档"},{title:"Seifert 曲面与三叶结可视化",kind:"拓扑 · 可视化",state:"持续开发",note:"本站第 3 维展示了为网站重新实现的交互版本",anchor:"#dim3"},{title:"数学参考教材知识体系",kind:"数学",state:"持续建设",note:"为备考与自学搭建的参考教材与知识结构"},{title:"物理学习资料",kind:"物理",state:"持续建设",note:"经典力学、电动力学、量子力学方向的资料",anchor:"#archive"},{title:"AI 研究论文学习",kind:"AI",state:"公开",note:"见公开仓库 ai-self-study",url:"https://github.com/xhc144/ai-self-study"}],yd={"mit-ocw-notes":{"2026-10-08":86,"2026-10-09":1,"2026-10-11":74,"2026-10-12":59},"repository-index":{"2026-10-02":1,"2026-10-03":2,"2026-10-07":11,"2026-10-08":10},"claude-lab":{"2026-10-11":16,"2026-10-12":3},"ai-self-study":{"2026-10-11":1,"2026-10-12":2}};var Xt={white:[1,.95,.88],orange:[1,.38,.12],ember:[.85,.16,.06],cyan:[.3,.86,1],violet:[.55,.42,1],acid:[.8,1,.25],blue:[.2,.42,1]},x_=Math.PI*(3-Math.sqrt(5));function sr(i,e=!1){return{pos:new Float32Array(i*3),col:new Float32Array(i*4),proc:e?new Float32Array(i*4):null}}function bi(i,e,t,n,r,s,a,o=1){i.pos[e*3]=t,i.pos[e*3+1]=n,i.pos[e*3+2]=r,i.col[e*4]=s[0]*o,i.col[e*4+1]=s[1]*o,i.col[e*4+2]=s[2]*o,i.col[e*4+3]=a}function v_(i){let e=sr(i),t=4.4,n=2584,r=gn(144),s=t*Math.sqrt(Math.PI/n);for(let a=0;a<i;a++){let o=a%n,l=t*Math.sqrt((o+.5)/n),c=o*x_,h=l/t,d=s*.11,u=l*Math.cos(c)+wt(r)*d,f=l*Math.sin(c)+wt(r)*d,g=Math.hypot(u,f),v=.24*Math.sin(c*2+g*1.1)*h*h+wt(r)*.02,m=h<.4?Gn(Xt.white,Xt.orange,h/.4):h<.78?Gn(Xt.orange,Xt.violet,(h-.4)/.38):Gn(Xt.violet,Xt.cyan,(h-.78)/.22),p=o===144?2.4:o%144===0?1.5:.85;bi(e,a,u,v,f,m,h*6,p)}return e}function y_(i){let e=sr(i),t=gn(7);for(let n=0;n<i;n++){let r=t();if(r<.035){let s=.07*Math.cbrt(t()),a=t()*Math.PI*2,o=Math.acos(2*t()-1);bi(e,n,s*Math.sin(o)*Math.cos(a),s*Math.cos(o),s*Math.sin(o)*Math.sin(a),Xt.white,0,1)}else if(r<.93){let s=.45+2.9*Math.pow(t(),1.7),a=t()*Math.PI*2,o=(s-.45)/2.9,l=o<.25?Gn(Xt.white,Xt.orange,o/.25):Gn(Xt.orange,Xt.violet,b0((o-.25)/.75,0,1));bi(e,n,s*Math.cos(a),wt(t)*.018*s,s*Math.sin(a),l,s*2,1.25-o*.45)}else{let s=t()<.5?-1:1,a=.15+3.6*Math.pow(t(),2),o=.025+.03*Math.sqrt(a);bi(e,n,wt(t)*o,s*a,wt(t)*o,Xt.cyan,a*3,1.1)}}return e}function b_(i){let e=sr(i),t=gn(11);for(let n=0;n<i;n++){let r=n/i*Math.PI*2,s=2.7*Math.sin(2*r+.3),a=1.6*Math.sin(3*r),o=2.1*Math.sin(5*r+1.1),l=.025+.11*Math.pow(t(),4),c=bo(.53+.5*(.5+.5*Math.sin(r*2)),.9,.62),h=Gn(c,Xt.orange,.5+.5*Math.sin(r*3+1));bi(e,n,s+wt(t)*l,a+wt(t)*l,o+wt(t)*l,h,r*7,.95)}return e}function __(i,e){let t=i*i-e*e-1,n=2*i*e,r=i-2,s=e-1,a=r*r-s*s,o=2*r*s,l=t*a-n*o,c=t*o+n*a,h=i*i-e*e+2,d=2*i*e+2,u=h*h+d*d;return[(l*h+c*d)/u,(c*h-l*d)/u]}function M_(i){let e=sr(i),t=Math.floor(Math.sqrt(i)),n=2.7,r=gn(2);for(let s=0;s<i;s++){let a=s%t+r()*.6,o=Math.floor(s/t)%t+r()*.6,l=-n+2*n*a/t,c=-n+2*n*o/t,[h,d]=__(l,c),u=Math.hypot(h,d)||1e-9,f=b0(.34*Math.log(u),-1.6,1.6),g=Math.atan2(d,h)/(2*Math.PI),v=Math.log2(u),m=v-Math.floor(v),p=bo(g,.92,.42+.22*m);bi(e,s,l*1.12,f,-c*1.12,p,v*2,.9)}return e}function S_(i){let e=sr(i,!0),t=gn(31),n=Math.floor(i*.12),r=E1(i-n,t);e.proc.set(r,0);let s=[0,0,0,0];for(let a=0;a<i;a++){let o,l,c;if(a<i-n){let h=Math.hypot(r[a*4+2],r[a*4+3]);o=gd(.15,_0,h);let d=r[a*4]*.5+.5;l=Gn(Gn([.42,.28,1],[.18,.72,1],d),Xt.white,Math.pow(o,8)*.5),c=.7+.3*o}else _o((a-(i-n))/n*Math.PI*2,s),e.proc.set(s,a*4),o=1,l=Gn(Xt.orange,Xt.white,.25),c=1;e.col[a*4]=l[0]*c,e.col[a*4+1]=l[1]*c,e.col[a*4+2]=l[2]*c,e.col[a*4+3]=o*9}return e}function w_(i,e=2,t=.004){let n=1,r=1,s=1,a=(c,h,d)=>[10*(h-c),c*(28-d)-h,c*h-8/3*d],o=()=>{let c=a(n,r,s),h=a(n+t/2*c[0],r+t/2*c[1],s+t/2*c[2]),d=a(n+t/2*h[0],r+t/2*h[1],s+t/2*h[2]),u=a(n+t*d[0],r+t*d[1],s+t*d[2]);n+=t/6*(c[0]+2*h[0]+2*d[0]+u[0]),r+=t/6*(c[1]+2*h[1]+2*d[1]+u[1]),s+=t/6*(c[2]+2*h[2]+2*d[2]+u[2])};for(let c=0;c<3e3;c++)o();let l=new Float32Array(i*3);for(let c=0;c<i;c++){for(let h=0;h<e;h++)o();l[c*3]=n,l[c*3+1]=r,l[c*3+2]=s}return l}function T_(i){let e=sr(i),t=w_(i),n=gn(3),r=.11;for(let s=0;s<i;s++){let a=t[s*3],o=t[s*3+1],l=t[s*3+2],c=gd(-6,6,a),h=Gn(Xt.cyan,Xt.orange,c);bi(e,s,a*r+wt(n)*.006,(l-25)*r+wt(n)*.006,o*r+wt(n)*.006,h,s/i*260,.9)}return e}function A_(i){let e=sr(i),t=gn(42),n=9,r=[];for(;r.length<n;){let c=t()*Math.PI*2,h=Math.acos(2*t()-1),d=1.7+t()*1.3,u=[d*Math.sin(h)*Math.cos(c),d*Math.cos(h)*.75,d*Math.sin(h)*Math.sin(c)];r.every(f=>Math.hypot(u[0]-f[0],u[1]-f[1],u[2]-f[2])>1.55)&&r.push(u)}let s=r.map(()=>{let c=[wt(t),wt(t),wt(t)],h=Math.hypot(...c);return{dir:c.map(d=>d/h),s:[.42+t()*.3,.16+t()*.1,.1+t()*.06]}}),a=r.map((c,h)=>bo(.5+h/n*.62,.85,.6)),o=[];r.forEach((c,h)=>{let d=r.map((u,f)=>[Math.hypot(c[0]-u[0],c[1]-u[1],c[2]-u[2]),f]).filter(([,u])=>u!==h).sort((u,f)=>u[0]-f[0]);for(let[,u]of d.slice(0,2))o.some(([f,g])=>f===h&&g===u||f===u&&g===h)||o.push([h,u])});let l=Math.floor(i*.16);for(let c=0;c<i;c++)if(c<i-l){let h=c%n,{dir:d,s:u}=s[h],f=wt(t)*u[0],g=wt(t)*u[1],v=wt(t)*u[2],m=Math.abs(d[1])<.9?[0,1,0]:[1,0,0],p=[d[1]*m[2]-d[2]*m[1],d[2]*m[0]-d[0]*m[2],d[0]*m[1]-d[1]*m[0]],_=Math.hypot(...p);p[0]/=_,p[1]/=_,p[2]/=_;let A=[d[1]*p[2]-d[2]*p[1],d[2]*p[0]-d[0]*p[2],d[0]*p[1]-d[1]*p[0]],M=r[h],T=M[0]+d[0]*f+p[0]*g+A[0]*v,S=M[1]+d[1]*f+p[1]*g+A[1]*v,I=M[2]+d[2]*f+p[2]*g+A[2]*v,b=Math.hypot(f,g,v);bi(e,c,T,S,I,Gn(a[h],Xt.white,Math.max(0,.5-b)),b*8,1)}else{let[h,d]=o[c%o.length],u=t(),f=r[h],g=r[d],v=.35*Math.sin(Math.PI*u),m=f[0]+(g[0]-f[0])*u,p=f[1]+(g[1]-f[1])*u+v,_=f[2]+(g[2]-f[2])*u;bi(e,c,m+wt(t)*.012,p+wt(t)*.012,_+wt(t)*.012,Gn(a[h],a[d],u),u*12,.7)}return{...e,centers:r,colors:a}}function bd(){let i=[];Vr.forEach(([t,n],r)=>{let s=r/Vr.length*Math.PI*2+.2;i.push({name:t,pages:n,field:"math",x:1.75*Math.cos(s),z:1.75*Math.sin(s)})}),Hr.forEach(([t,n],r)=>{let s=r/Hr.length*Math.PI*2+.55;i.push({name:t,pages:n,field:"physics",x:3.25*Math.cos(s),z:3.25*Math.sin(s)})});let e=-1.7;for(let t of i)t.h=t.pages/62,t.base=e;return i}function E_(i){let e=sr(i),t=gn(2572),n=bd(),r=n.reduce((l,c)=>l+c.pages,0),s=Math.floor(i*.14),a=i-s,o=0;for(let l of n){let c=Math.round(l.pages/r*a),h=l.field==="math"?Xt.orange:Xt.cyan;for(let d=0;d<c&&o<a;d++,o++){let u=t(),f=l.base+u*l.h,g=t()<.7,v=t()*Math.PI*2,m=g?.15:.15*Math.sqrt(t());bi(e,o,l.x+m*Math.cos(v),f,l.z+m*Math.sin(v),Gn(h,Xt.white,u*u*.8),u*10,.85+u*.5)}}for(;o<i;o++){let l=t()<.5,c,h;if(l){let d=[1,1.75,2.5,3.25,4][Math.floor(t()*5)],u=t()*Math.PI*2;c=d*Math.cos(u),h=d*Math.sin(u)}else{let d=Math.floor(t()*24)/24*Math.PI*2,u=.6+t()*3.6;c=u*Math.cos(d),h=u*Math.sin(d)}bi(e,o,c,-1.72,h,Xt.violet,Math.hypot(c,h)*3,.45)}return{...e,cols:n}}var P1=[.36,.6,.8,.98];function C_(i){let e=sr(i,!0),t=gn(3),n=24,r=P1.length*n;for(let s=0;s<i;s++){let a=s%r,o=Math.floor(a/n),l=a%n,c=P1[o],h=l/n*Math.PI*2+o*.37,d=t()*Math.PI*2;e.proc[s*4]=c,e.proc[s*4+1]=h,e.proc[s*4+2]=d,e.proc[s*4+3]=o;let u=bo(l/n,.85,.52+o*.05);e.col[s*4]=u[0],e.col[s*4+1]=u[1],e.col[s*4+2]=u[2],e.col[s*4+3]=d*3}return e}var _d={galaxy:v_,singularity:y_,filament:b_,landscape:M_,fiber:S_,lorenz:T_,latent:A_,archive:E_,hopf:C_};var wo=1.2,Md=5,z1={galaxy:{cam:[-2,2.2,7.4],look:[-2,-.2,0],tilt:.95,rot:.035,spin:0,pulse:.35,pf:1,ps:1.4,size:1.25,gain:1.7},singularity:{cam:[0,1,6.6],look:[0,0,0],tilt:.3,rot:0,spin:1.4,pulse:.6,pf:3,ps:3,size:1,gain:.85},filament:{cam:[0,.2,7.6],look:[0,0,0],tilt:.25,rot:.07,spin:0,pulse:1,pf:1,ps:2.2,size:1,gain:.85},landscape:{cam:[0,4.4,5.6],look:[0,-.5,0],tilt:0,rot:.025,spin:0,pulse:.25,pf:3.1416,ps:1,size:1,gain:1.45},fiber:{cam:[0,0,10.2],look:[0,0,0],tilt:-.35,rot:.06,spin:0,pulse:.5,pf:1,ps:2,size:.95,gain:.62,bloom:.42},lorenz:{cam:[0,.3,6.4],look:[0,.3,0],tilt:.12,rot:.06,spin:0,pulse:1,pf:1,ps:3,size:1,gain:1.1},latent:{cam:[0,.6,7],look:[0,0,0],tilt:.15,rot:.05,spin:0,pulse:.8,pf:1,ps:2.4,size:1.05,gain:.85},archive:{cam:[0,2.4,7.6],look:[0,0,0],tilt:.06,rot:.045,spin:0,pulse:1,pf:1,ps:2.6,size:.95,gain:.8},hopf:{cam:[0,0,8.2],look:[0,0,0],tilt:-1.05,rot:.04,spin:0,pulse:.4,pf:1,ps:1,size:1,gain:.85}},R_=`
uniform float uTime, uMorph, uToProc, uProcKind, uTheta, uSpread, uPages, uSpinTo;
uniform float uSize, uPixelRatio, uFocus, uGain, uPulse, uPulseFreq, uPulseSpeed, uSwirl, uExplode;
uniform float uMouseStr, uAspect;
uniform vec2 uMouse;
uniform mat4 uHopfRot;
attribute vec3 aFrom;
attribute vec3 aTo;
attribute vec4 aColFrom;
attribute vec4 aColTo;
attribute vec4 aRand;
attribute vec4 aProc;
varying vec3 vColor;
varying float vAlpha;

vec2 crot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
vec3 spinY(vec3 p, float spin) {
  if (spin == 0.0) return p;
  float a = spin * uTime / pow(0.35 + length(p.xz), 1.5);
  vec2 q = crot(p.xz, a);
  return vec3(q.x, p.y, q.y);
}
float gPage;
vec3 fiberPos(vec4 X) {
  float page = floor(aRand.w * uPages);
  gPage = page;
  float th = uTheta + 6.2831853 * page / uPages * uSpread;
  vec2 z = crot(X.xy, th * 0.5);
  vec2 w = crot(X.zw, th / 3.0);
  return vec3(w.x, w.y, z.x) / max(1.0 - z.y, 1e-3) * ${1.25.toFixed(4)};
}
vec3 hopfPos(vec4 P) {
  float t = P.z + uTime * 0.16;
  float ce = cos(P.x), se = sin(P.x);
  vec4 X = uHopfRot * vec4(ce * cos(P.y + t), ce * sin(P.y + t), se * cos(t), se * sin(t));
  return X.xyz / max(1.0 - X.w, 0.02) * ${wo.toFixed(4)};
}

void main() {
  vec3 target = spinY(aTo, uSpinTo);
  float far = 0.0;
  if (uToProc > 0.5) {
    target = uProcKind < 1.5 ? fiberPos(aProc) : hopfPos(aProc);
    far = length(target);
  }
  float m = clamp((uMorph - aRand.x * 0.35) / 0.65, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  vec3 p = mix(aFrom, target, m);
  float sw = sin(3.14159265 * m) * uSwirl;
  vec3 q = p * 0.7 + aRand.yzw * 12.0;
  p += sw * (0.4 + aRand.y) * vec3(sin(q.y + uTime * 0.9), sin(q.z + uTime * 0.8), sin(q.x + uTime * 0.7));
  p += 0.01 * vec3(sin(uTime * 0.9 + aRand.y * 40.0), sin(uTime * 0.7 + aRand.z * 40.0), sin(uTime * 0.8 + aRand.w * 40.0));
  p *= 1.0 + uExplode * (0.6 + 5.0 * aRand.x * aRand.x);

  vec4 col = mix(aColFrom, aColTo, m);
  float pulse = pow(0.5 + 0.5 * sin(col.a * uPulseFreq - uTime * uPulseSpeed), 14.0);
  vColor = pow(max(col.rgb, 0.0), vec3(GAMMA)) * (1.0 + uPulse * pulse * 2.4);
  if (uToProc > 0.5 && uProcKind < 1.5) {
    vec3 tint = 0.62 + 0.38 * cos(6.2831853 * (gPage / uPages + vec3(0.0, 0.33, 0.67)));
    vColor *= mix(vec3(1.0), tint * 1.25, uSpread * m);
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 dd = (clip.xy / clip.w - uMouse) * vec2(uAspect, 1.0);
  float dist = length(dd);
  mv.xy += (dd / max(dist, 1e-4)) * uMouseStr * smoothstep(0.32, 0.0, dist) * (-mv.z) * 0.08;
  gl_Position = projectionMatrix * mv;
  float sz = uSize * (0.45 + 1.15 * aRand.y * aRand.y);
  gl_PointSize = clamp(sz * uPixelRatio * 7.0 / max(-mv.z, 0.1), 0.0, 48.0);
  float fade = uToProc > 0.5 ? mix(1.0, smoothstep(9.0, 4.8, far), m) : 1.0;
  vAlpha = uFocus * uGain * fade * (0.42 + 0.58 * aRand.z);
}`,k_=`
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d2 = dot(uv, uv);
  if (d2 > 0.25) discard;
  gl_FragColor = vec4(vColor * exp(-d2 * 16.0) * vAlpha, 1.0);
}`,I_=`
uniform float uTime, uWobble;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vUv = uv;
  vec3 p = position + normal * uWobble * 0.22 * sin(uv.x * 37.7 + uTime * 13.0) + vec3(
    sin(uv.x * 18.85 + uTime * 7.0), cos(uv.x * 25.13 + uTime * 5.0), sin(uv.x * 12.57 - uTime * 6.0)) * uWobble * 0.45;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  vN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`,P_=`
uniform float uTime, uOpacity;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.6);
  float pulse = pow(0.5 + 0.5 * sin(vUv.x * 18.85 - uTime * 2.4), 24.0);
  vec3 col = mix(vec3(1.0, 0.42, 0.14), vec3(1.0, 0.94, 0.84), 0.25 + 0.75 * fres) * (0.32 + 1.7 * pulse);
  gl_FragColor = vec4(pow(col, vec3(GAMMA)) * uOpacity, 1.0);
}`,z_={uniforms:{tDiffuse:{value:null},uTime:{value:0},uCA:{value:0},uGrain:{value:.028},uVignette:{value:.55}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
uniform sampler2D tDiffuse;
uniform float uTime, uCA, uGrain, uVignette;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);
  vec2 off = c * (0.004 + uCA) * (0.4 + r2 * 3.0);
  vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
  col *= 1.0 - uVignette * smoothstep(0.1, 0.62, r2 * 1.5);
  float n = fract(sin(dot(vUv * vec2(1931.3, 1033.7) + fract(uTime * 7.31) * 97.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`},L_=i=>i<.5?4*i*i*i:1-Math.pow(-2*i+2,3)/2,ln=(i,e,t,n)=>i+(e-i)*(1-Math.exp(-t*n)),Sd=class{constructor(e,{count:t=65536,quality:n="high",pixelRatio:r=1.5}={}){this.canvas=e,this.count=t,this.quality=n,this.renderer=new f0({canvas:e,antialias:!1,alpha:!1,powerPreference:"high-performance"}),this.renderer.setPixelRatio(r),this.renderer.setClearColor(328968,1),this.renderer.toneMapping=is,this.renderer.toneMappingExposure=1.05,this.pixelRatio=r,this.scene=new Fa,this.camera=new Rn(48,1,.05,200),this.camera.position.set(0,2.3,7.6),this.group=new Qi,this.scene.add(this.group),this.look=new V,this.defines={GAMMA:n==="low"?"1.0":"2.2"},this._initPoints(),this._initKnot(),this._initHopfLines(),n!=="low"&&this._initPost(),this.shapeCache=new Map,this.shape=null,this.rig=z1.galaxy,this.morphT=1,this.morphDur=2.2,this.state={focus:1,focusTarget:1,warp:0,mouse:new Le(0,0),mouseTarget:new Le(0,0),mouseOn:0,dragX:0,dragY:0,velX:0,velY:0,rotY:0,tilt:.5,theta:0,thetaAuto:!0,thetaSpeed:.22,spread:0,spreadTarget:0,explode:0,explodeT:-1,wobble:0,knotVis:0,knotWanted:!0,time:0,hopfAngle:0,zoom:0},this.resize()}_initPoints(){let e=this.count,t=new _n,n=gn(2027),r=new Float32Array(e*4);for(let a=0;a<r.length;a++)r[a]=n();this.attr={aFrom:new sn(new Float32Array(e*3),3),aTo:new sn(new Float32Array(e*3),3),aColFrom:new sn(new Float32Array(e*4),4),aColTo:new sn(new Float32Array(e*4),4),aRand:new sn(r,4),aProc:new sn(new Float32Array(e*4),4)};for(let a of["aFrom","aTo","aColFrom","aColTo","aProc"])this.attr[a].setUsage(Vu);t.setAttribute("position",this.attr.aFrom);for(let[a,o]of Object.entries(this.attr))t.setAttribute(a,o);this.uniforms={uTime:{value:0},uMorph:{value:1},uToProc:{value:0},uProcKind:{value:0},uTheta:{value:0},uSpread:{value:0},uPages:{value:Md},uSpinTo:{value:0},uSize:{value:1},uPixelRatio:{value:1},uFocus:{value:1},uGain:{value:1},uPulse:{value:.5},uPulseFreq:{value:1},uPulseSpeed:{value:1},uSwirl:{value:0},uExplode:{value:0},uMouseStr:{value:0},uAspect:{value:1},uMouse:{value:new Le(9,9)},uHopfRot:{value:new It}};let s=new Ut({uniforms:this.uniforms,vertexShader:R_,fragmentShader:k_,defines:this.defines,transparent:!0,depthWrite:!1,depthTest:!1,blending:nr});this.points=new Ha(t,s),this.points.frustumCulled=!1,this.group.add(this.points)}_initKnot(){let e=C1(900).map(s=>new V(s[0],s[1],s[2])),t=new Hs(e,!0,"centripetal"),n=new Ya(t,900,.028,10,!0);this.knotUniforms={uTime:{value:0},uOpacity:{value:0},uWobble:{value:0}};let r=new Ut({uniforms:this.knotUniforms,vertexShader:I_,fragmentShader:P_,defines:this.defines,transparent:!0,depthWrite:!1,blending:nr});this.knot=new kn(n,r),this.knot.visible=!1,this.group.add(this.knot)}_initHopfLines(){let e=[.36,.6,.8,.98],t=24,n=160,r=e.length*t*n*2,s=new Float32Array(r*3),a=0;e.forEach((c,h)=>{for(let d=0;d<t;d++){let u=d/t*Math.PI*2+h*.37;for(let f=0;f<n;f++)for(let g of[f,f+1])s[a++]=c,s[a++]=u,s[a++]=g/n*Math.PI*2}});let o=new _n;o.setAttribute("position",new sn(s,3)),this.hopfLineUniforms={uTime:this.uniforms.uTime,uHopfRot:this.uniforms.uHopfRot,uOpacity:{value:0}};let l=new Ut({uniforms:this.hopfLineUniforms,defines:this.defines,vertexShader:`uniform float uTime; uniform mat4 uHopfRot; varying vec3 vC; varying float vF;
        void main(){
          float eta = position.x, alpha = position.y, t = position.z;
          float ce = cos(eta), se = sin(eta);
          vec4 X = uHopfRot * vec4(ce * cos(alpha + t), ce * sin(alpha + t), se * cos(t), se * sin(t));
          vec3 p = X.xyz / max(1.0 - X.w, 0.02) * ${wo.toFixed(4)};
          vF = smoothstep(9.0, 4.0, length(p));
          vC = 0.55 + 0.45 * cos(6.2831853 * (alpha / 6.2831853 + vec3(0.0, 0.33, 0.67)));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,fragmentShader:`uniform float uOpacity; varying vec3 vC; varying float vF;
        void main(){ gl_FragColor = vec4(pow(vC, vec3(GAMMA)) * 0.36 * uOpacity * vF, 1.0); }`,transparent:!0,depthWrite:!1,depthTest:!1,blending:nr});this.hopfLines=new Va(o,l),this.hopfLines.frustumCulled=!1,this.hopfLines.visible=!1,this.group.add(this.hopfLines)}_initPost(){let e=new x0(this.renderer);e.addPass(new v0(this.scene,this.camera)),this.bloom=new ea(new Le(256,256),.7,.42,.16),e.addPass(this.bloom),e.addPass(new y0),this.film=new Qs(z_),e.addPass(this.film),this.composer=e}resize(){let e=this.canvas.clientWidth||window.innerWidth,t=this.canvas.clientHeight||window.innerHeight;this.renderer.setSize(e,t,!1),this.camera.aspect=e/t,this.camera.fov=e/t<.8?62:48,this.camera.updateProjectionMatrix(),this.uniforms.uAspect.value=e/t,this.uniforms.uPixelRatio.value=this.pixelRatio*Math.min(1.25,Math.max(.7,t/900)),this.composer&&(this.composer.setPixelRatio(this.pixelRatio),this.composer.setSize(e,t),this.bloom.resolution.set(e/2,t/2)),this.width=e,this.height=t}getShape(e){return this.shapeCache.has(e)||this.shapeCache.set(e,_d[e](this.count)),this.shapeCache.get(e)}warm(e){let t=[...e],n=()=>{let r=t.shift();r&&(this.getShape(r),(window.requestIdleCallback||(s=>setTimeout(s,60)))(n))};n()}hopfMatrix(e,t=new It){let n=Math.cos(e),r=Math.sin(e),s=Math.cos(e*.62),a=Math.sin(e*.62);return t.set(n,0,0,-r,0,s,-a,0,0,a,s,0,r,0,0,n),t}_snapshot(){let e=this.count,t=this.uniforms,n=this.attr.aFrom.array,r=this.attr.aTo.array,s=this.attr.aColFrom.array,a=this.attr.aColTo.array,o=this.attr.aRand.array,l=this.attr.aProc.array,c=t.uMorph.value,h=t.uToProc.value>.5,d=t.uProcKind.value,u=t.uTime.value,f=t.uSpinTo.value,g=t.uHopfRot.value.elements,v=new Float32Array(e*3),m=new Float32Array(e*4),p=t.uTheta.value,_=t.uSpread.value;for(let A=0;A<e;A++){let M=Math.min(1,Math.max(0,(c-o[A*4]*.35)/.65));M=M*M*(3-2*M);let T,S,I;if(h){let U=l[A*4],W=l[A*4+1],F=l[A*4+2],q=l[A*4+3];if(d<1.5){let Z=Math.floor(o[A*4+3]*Md),J=p+2*Math.PI*Z/Md*_,re=Math.cos(J/2),Q=Math.sin(J/2),ne=Math.cos(J/3),se=Math.sin(J/3),ke=re*U-Q*W,Re=Q*U+re*W,mt=ne*F-se*q,st=se*F+ne*q,ct=Math.max(1-Re,.001);T=mt/ct*1.25,S=st/ct*1.25,I=ke/ct*1.25}else{let Z=F+u*.16,J=Math.cos(U),re=Math.sin(U),Q=[J*Math.cos(W+Z),J*Math.sin(W+Z),re*Math.cos(Z),re*Math.sin(Z)],ne=[0,0,0,0];for(let ke=0;ke<4;ke++)ne[ke]=g[ke]*Q[0]+g[4+ke]*Q[1]+g[8+ke]*Q[2]+g[12+ke]*Q[3];let se=Math.max(1-ne[3],.02);T=ne[0]/se*wo,S=ne[1]/se*wo,I=ne[2]/se*wo}}else if(T=r[A*3],S=r[A*3+1],I=r[A*3+2],f){let U=f*u/Math.pow(.35+Math.hypot(T,I),1.5),W=Math.cos(U),F=Math.sin(U),q=W*T-F*I;I=F*T+W*I,T=q}let b=n[A*3]+(T-n[A*3])*M,R=n[A*3+1]+(S-n[A*3+1])*M,L=n[A*3+2]+(I-n[A*3+2])*M,N=Math.hypot(b,R,L);N>10&&(b*=10/N,R*=10/N,L*=10/N),v[A*3]=b,v[A*3+1]=R,v[A*3+2]=L;for(let U=0;U<4;U++)m[A*4+U]=s[A*4+U]+(a[A*4+U]-s[A*4+U])*M}return{pos:v,col:m}}setShape(e,{instant:t=!1}={}){if(e===this.shape||!_d[e])return;let n=this.getShape(e),r=z1[e],s=this.uniforms,a=this.shape===null;if(a||t)this.attr.aFrom.array.set(n.pos),this.attr.aColFrom.array.set(n.col);else{let c=this._snapshot();this.attr.aFrom.array.set(c.pos),this.attr.aColFrom.array.set(c.col)}this.attr.aTo.array.set(n.pos),this.attr.aColTo.array.set(n.col);let o=e==="fiber"?1:e==="hopf"?2:0;o&&this.attr.aProc.array.set(n.proc);for(let c of["aFrom","aTo","aColFrom","aColTo","aProc"])this.attr[c].needsUpdate=!0;s.uToProc.value=o?1:0,s.uProcKind.value=o,s.uSpinTo.value=r.spin,s.uPulseFreq.value=r.pf,s.uPulseSpeed.value=r.ps;let l=this.state;l.rotY+=l.dragX,l.tilt+=l.dragY,l.dragX=0,l.dragY=0,l.velX=0,l.velY=0,this.prevShape=this.shape,this.shape=e,this.rig=r,s.uMorph.value=a||t?1:0,this.morphT=s.uMorph.value,e==="fiber"&&(this.state.theta=0)}settle(){let e=this.rig,t=this.state;this.morphT=1,this.uniforms.uMorph.value=1,t.focus=t.focusTarget,t.tilt=e.tilt,t.spread=t.spreadTarget;let n=this.width/this.height<.8?0:1;this.camera.position.set(e.cam[0]*n,e.cam[1],e.cam[2]),this.look.set(e.look[0]*n,e.look[1],e.look[2]),this.camera.lookAt(this.look),t.knotVis=this.shape==="fiber"&&t.knotWanted?1:0,this.hopfLineUniforms.uOpacity.value=this.shape==="hopf"?t.focus:0,this.bloomBase=e.bloom??.7}setFocus(e){this.state.focusTarget=e}setWarp(e){this.state.warp=e}setMouse(e,t,n=!0){this.state.mouseTarget.set(e,t),this.state.mouseOn=n?1:0}drag(e,t){this.state.velX=e*.006,this.state.velY=t*.004,this.state.dragX+=e*.006,this.state.dragY+=t*.004}resetView(){this.state.dragX=0,this.state.dragY=0,this.state.velX=0,this.state.velY=0}explode(){this.state.explodeT=0}wobbleKnot(){this.state.wobble=1}setTheta(e){this.state.theta=e,this.state.thetaAuto=!1}setThetaAuto(e){this.state.thetaAuto=e}setOpenBook(e){this.state.spreadTarget=e?1:0}setKnot(e){this.state.knotWanted=e}setZoom(e){this.state.zoom=e}toScreen(e,t,n,r={x:0,y:0,depth:0}){let s=this._v||(this._v=new V);return s.set(e,t,n).applyMatrix4(this.group.matrixWorld).project(this.camera),s.z>1?null:(r.x=(s.x*.5+.5)*this.width,r.y=(-s.y*.5+.5)*this.height,r.depth=s.z,r)}frame(e,t){let n=this.state,r=this.uniforms,s=this.rig;if(n.time=t,r.uTime.value=t,this.morphT<1?(this.morphT=Math.min(1,this.morphT+e/this.morphDur),r.uMorph.value=L_(this.morphT),r.uSwirl.value=.55):r.uSwirl.value=0,n.focus=ln(n.focus,n.focusTarget,3,e),r.uFocus.value=n.focus,r.uPulse.value=s.pulse,r.uSize.value=ln(r.uSize.value,s.size,2,e),r.uGain.value=ln(r.uGain.value,s.gain,2,e),n.thetaAuto&&(n.theta+=e*n.thetaSpeed),r.uTheta.value=n.theta,n.spread=ln(n.spread,n.spreadTarget,2.2,e),r.uSpread.value=n.spread,n.hopfAngle=.42*Math.sin(t*.11),this.hopfMatrix(n.hopfAngle,r.uHopfRot.value),n.explodeT>=0){n.explodeT+=e;let v=n.explodeT;r.uExplode.value=v<.5?Math.sin(v/.5*Math.PI/2)*1:Math.max(0,1-(v-.5)/2.2)**2,v>2.8&&(n.explodeT=-1,r.uExplode.value=0)}n.mouse.x=ln(n.mouse.x,n.mouseTarget.x,8,e),n.mouse.y=ln(n.mouse.y,n.mouseTarget.y,8,e),r.uMouse.value.copy(n.mouse),r.uMouseStr.value=ln(r.uMouseStr.value,n.mouseOn?1:0,4,e);let a=this.shape==="fiber"&&n.knotWanted?Math.min(1,r.uMorph.value*1.2):0;n.knotVis=ln(n.knotVis,a,3,e),this.knot.visible=n.knotVis>.01,this.knotUniforms.uOpacity.value=n.knotVis*n.focus,this.knotUniforms.uTime.value=t,n.wobble=ln(n.wobble,0,1.4,e),this.knotUniforms.uWobble.value=n.wobble;let o=this.shape==="hopf"?r.uMorph.value:0,l=this.hopfLineUniforms.uOpacity;l.value=ln(l.value,o*n.focus,2.5,e),this.hopfLines.visible=l.value>.01,(Math.abs(n.velX)>1e-5||Math.abs(n.velY)>1e-5)&&(n.velX*=Math.exp(-e*3),n.velY*=Math.exp(-e*3),n.dragX+=n.velX*e*4,n.dragY+=n.velY*e*4),n.rotY+=e*s.rot*(this.reduced?.25:1),n.tilt=ln(n.tilt,s.tilt,1.5,e),this.group.rotation.y=n.rotY+n.dragX,this.group.rotation.x=Math.max(-1.4,Math.min(1.4,n.tilt+n.dragY));let c=this.camera,h=1.4,d=1-n.zoom*.25,u=this.width/this.height<.8?0:1;c.position.x=ln(c.position.x,s.cam[0]*d*u+n.mouse.x*.35,h,e),c.position.y=ln(c.position.y,s.cam[1]*d+n.mouse.y*.25,h,e),c.position.z=ln(c.position.z,s.cam[2]*d,h,e),this.look.x=ln(this.look.x,s.look[0]*u,h,e),this.look.y=ln(this.look.y,s.look[1],h,e),this.look.z=ln(this.look.z,s.look[2],h,e),c.lookAt(this.look);let g=(this.width/this.height<.8?62:48)+n.warp*14;Math.abs(c.fov-g)>.01&&(c.fov=ln(c.fov,g,6,e),c.updateProjectionMatrix()),this.composer?(this.film.uniforms.uTime.value=t,this.film.uniforms.uCA.value=ln(this.film.uniforms.uCA.value,n.warp*.03,6,e),this.bloomBase=ln(this.bloomBase??.7,s.bloom??.7,2,e),this.bloom.strength=this.bloomBase+n.warp*.6,this.composer.render(e)):this.renderer.render(this.scene,this.camera)}dispose(){this.renderer.dispose()}};function L1(i,e){try{return new Sd(i,e)}catch(t){return console.warn("[universe] WebGL unavailable, falling back to CSS backdrop:",t),null}}var Zt={x:innerWidth/2,y:innerHeight/2,nx:0,ny:0,inside:!1,lastMove:performance.now()};function D1(){let i=matchMedia("(pointer: fine)").matches,e=document.getElementById("cursor"),t=e.querySelector(".c-label"),n=e.querySelector(".c-ring"),r=e.querySelector(".c-dot"),s=Zt.x,a=Zt.y;if(addEventListener("pointermove",l=>{Zt.x=l.clientX,Zt.y=l.clientY,Zt.nx=l.clientX/innerWidth*2-1,Zt.ny=-(l.clientY/innerHeight*2-1),Zt.inside=!0,Zt.lastMove=performance.now()},{passive:!0}),document.addEventListener("pointerleave",()=>{Zt.inside=!1}),!i||Yt.reducedMotion)return;document.body.classList.add("has-cursor"),addEventListener("pointerdown",()=>e.classList.add("is-down")),addEventListener("pointerup",()=>e.classList.remove("is-down"));let o="a, button, input, [data-cursor], .knot-drag, .instrument canvas, .star, .hs";document.addEventListener("pointerover",l=>{let c=l.target.closest(o);e.classList.toggle("is-hover",!!c);let h="";c&&(h=c.dataset.cursor||(c.matches(".knot-drag")?"DRAG · 旋转":c.matches("canvas")?c.closest("[data-cursor-label]")?.dataset.cursorLabel||"INTERACT":c.matches("a")&&c.target==="_blank"?"OPEN ↗":"")),t.textContent=h}),vn(({dt:l})=>{let c=1-Math.exp(-l*22);s+=(Zt.x-s)*c,a+=(Zt.y-a)*c,r.style.transform=`translate(${Zt.x}px, ${Zt.y}px)`,n.style.transform=`translate(${s}px, ${a}px)`,t.style.transform=`translate(${s}px, ${a}px)`})}var D_=()=>document.getElementById("toasts");function os(i,e,{duration:t=5200}={}){let n=document.createElement("div");n.className="toast",n.innerHTML=`<span class="t-k">${i}</span><div class="t-b">${e}</div>`,D_().appendChild(n);let r=()=>{n.classList.add("out"),setTimeout(()=>n.remove(),500)};return setTimeout(r,t),n.addEventListener("click",r),n}var Gr=[{id:"terminal",name:"隐藏终端",hint:"键盘上的 / 键"},{id:"f144",name:"144 的秘密",hint:"首页 144 旁边的注记，或者在页面上键入 144"},{id:"konami",name:"最大的散在单群",hint:"↑ ↑ ↓ ↓ ← → ← → B A"},{id:"untie",name:"解不开的结",hint:"在第 3 维试着把三叶结解开"},{id:"bang",name:"大爆炸",hint:"点一下第 0 维中央的奇点"},{id:"warp",name:"超光速",hint:"非常非常快地滚动页面"},{id:"idle",name:"待机画面",hint:"什么都不做，静置 45 秒"},{id:"epsilon",name:"最短的数学笑话",hint:"页脚某个角落里有一个 ε"},{id:"euler",name:"最美的等式",hint:"在页面上键入 euler"},{id:"rec",name:"导演剪辑版",hint:"连续点击左下角的 REC 指示灯 5 次"},{id:"console",name:"给读源码的人",hint:"开发者工具的控制台里有一行留言"},{id:"monodromy",name:"单值化",hint:"在第 3 维把 θ 滑到尽头（12π）"}],ar=new Set(ps.get("eggs",[]));function N1(){return ar.size}function F1(i){return ar.has(i)}function U1(){let i=document.getElementById("egg-count");i&&(i.textContent=String(ar.size).padStart(2,"0"));for(let e of document.querySelectorAll(".egg-total"))e.textContent=Gr.length}function N_(){let i=document.getElementById("eggs-list");i&&(i.innerHTML=Gr.map(e=>ar.has(e.id)?`<li class="found"><div><b>${e.name}</b><em>已发现 · ${e.hint}</em></div></li>`:`<li><div><b>？？？</b><em>线索：${e.hint}</em></div></li>`).join(""))}function Qt(i,{message:e}={}){let t=Gr.find(r=>r.id===i);if(!t)return!1;let n=!ar.has(i);if(n){ar.add(i),ps.set("eggs",[...ar]),U1();let r=document.getElementById("egg-btn");r&&(r.classList.remove("bump"),r.offsetWidth,r.classList.add("bump")),Nt.success(),os(`HIDDEN SIGNAL ${String(ar.size).padStart(2,"0")}/${Gr.length} · ${t.name}`,e||"你发现了一个彩蛋。"),ar.size===Gr.length&&setTimeout(()=>os("ALL SIGNALS FOUND","全部 12 个彩蛋都被你找到了。你一定是那种会把定理的证明读到最后一行的人。",{duration:9e3}),1200)}else e&&os(t.name,e);return St.emit("egg",{id:i,fresh:n}),n}function B1(){U1();let i=document.getElementById("eggs-panel"),e=()=>{N_(),i.classList.add("open"),i.setAttribute("aria-hidden","false")},t=()=>{i.classList.remove("open"),i.setAttribute("aria-hidden","true")};document.getElementById("egg-btn").addEventListener("click",e),i.querySelector(".eggs-close").addEventListener("click",t),i.addEventListener("click",n=>{n.target===i&&t()}),St.on("escape",t)}var F_="∂∑∫∇πλΩΦψ∞≅⊗∮ℝℂℤ01#%&<>/=+",w0=new WeakMap;function To(i,e=i.dataset.text||i.textContent,{duration:t=1100,glyphs:n=F_,delay:r=0}={}){i.dataset.text=e;let s={};w0.set(i,s);let a=[...e],o=performance.now()+r,l=a.map((c,h)=>h/a.length*t*.55+Math.random()*t*.45);return new Promise(c=>{let h=d=>{if(w0.get(i)!==s)return c();let u=d-o,f="",g=!0;for(let v=0;v<a.length;v++)a[v]===" "||u>=l[v]?f+=a[v]:(g=!1,f+=u<0?" ":n[Math.random()*n.length|0]);i.textContent=f,g?(i.textContent=e,c()):requestAnimationFrame(h)};requestAnimationFrame(h)})}var O1=new Intl.NumberFormat("en-US");function V1(i,e,{duration:t=1600,decimals:n=0,suffix:r=""}={}){let s=performance.now(),a={};w0.set(i,a);let o=l=>{if(w0.get(i)!==a)return;let c=Math.min(1,(l-s)/t),h=1-Math.pow(1-c,4),d=e*h;c<.85&&n===0&&e>9&&(d+=(Math.random()-.5)*Math.max(1,e*.04)*(1-c)),i.textContent=(n?Math.max(0,d).toFixed(n):O1.format(Math.max(0,Math.round(d))))+r,c<1?requestAnimationFrame(o):i.textContent=(n?e.toFixed(n):O1.format(e))+r};requestAnimationFrame(o)}var T0=i=>new Promise(e=>setTimeout(e,i));function H1(i,e){let t=2166136261,n=[];for(let r=0;r<42;r++)t^=e.charCodeAt(r%e.length)+r,t=Math.imul(t,16777619)>>>0,n.push(`<i style="width:${1+t%3}px;opacity:${.35+(t>>3)%7/10}"></i>`);i.innerHTML=n.join("")}function G1({particles:i=0}={}){let e=v=>document.getElementById(v),t=e("timecode"),n=e("zcoord"),r=e("alt"),s=e("fps"),a=e("pcount"),o=document.querySelector(".hud-chapter-dim"),l=document.querySelector(".hud-chapter-name"),c=[...document.querySelectorAll(".ladder a")];a.textContent=i.toLocaleString("en-US");let h=-1;vn(()=>{let v=Vi.time,m=Math.floor(v%1*24),p=Math.floor(v);if(Vi.frame%2===0){t.textContent=`${String(Math.floor(p/3600)).padStart(2,"0")}:${String(Math.floor(p/60)%60).padStart(2,"0")}:${String(p%60).padStart(2,"0")}:${String(m).padStart(2,"0")}`;let _=Zt.nx*2*innerWidth/innerHeight,A=Zt.ny*2;n.textContent=`${_.toFixed(3)} ${A<0?"−":"+"} ${Math.abs(A).toFixed(3)}i`,r.textContent=(Xn.total*100).toFixed(1).padStart(4,"0")}p!==h&&(h=p,s.textContent=Vi.fps)}),St.on("chapter",({el:v})=>{if(v){To(o,v.dataset.dim,{duration:600}),To(l,v.dataset.name,{duration:700,glyphs:"零一二三四五六七八九十维点线面体"});for(let m of c)m.classList.toggle("is-active",m.dataset.nav===v.id)}});for(let v of document.querySelectorAll("[data-nav]"))v.addEventListener("click",m=>{m.preventDefault(),Nt.click(),la(v.dataset.nav)});let d=e("sound-btn"),u=async v=>{v?v=await Nt.enable():Nt.disable(),d.setAttribute("aria-pressed",v?"true":"false"),d.querySelector(".lbl").textContent=v?"SOUND ON":"SOUND OFF"};d.addEventListener("click",()=>u(!Nt.on)),St.on("sound",u);let f=[];return e("rec").addEventListener("click",()=>{let v=performance.now();f=f.filter(m=>v-m<2500),f.push(v),f.length>=5&&(f=[],Qt("rec",{message:"导演剪辑版：直接跳到片尾字幕。"}),document.body.classList.remove("director"),document.body.offsetWidth,document.body.classList.add("director"),la("credits"))}),{setSound:u}}var or=i=>String(i).replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),W1={hero:"hero",origin:"hero",0:"dim0",1:"dim1",2:"dim2",3:"dim3",4:"dim4","3+1":"dim4",n:"dimn",sigma:"archive",Σ:"archive",archive:"archive",inf:"diminf","∞":"diminf",infinity:"diminf"},q1={"mission.txt":`目标：2027 年清华大学求真书院数学领军计划。
状态：备考中。
策略：数学分析 + 高等代数打底，群表示论 / 拓扑 / 概率论拓展，竞赛训练不断线。`,"interests.txt":`数学：数学分析 · 高等代数 · 群表示论 · 拓扑 · 概率论 · 数学竞赛
物理：经典力学 · 电动力学 · 量子力学
AI / CS：AI 编程 · 智能体 · 数学可视化 · 自动化工具`,"readme.md":`这个网站从 0 维走到 ∞ 维：
  0 奇点 → 1 轨迹 → 2 复平面 → 3 纽结 → 3+1 时空 → n 隐空间 → Σ 档案 → ∞ 无穷维
所有画面都在浏览器里实时计算。输入 cd 3 直接跳到三叶结。`};function U_(i){let e=0n,t=1n;for(let n=0;n<i;n++)[e,t]=[t,e+t];return e}function B_(i){let e=[],t=BigInt(i);for(let n=2n;n*n<=t;n+=n===2n?1n:2n){for(;t%n===0n;)e.push(n),t/=n;if(n>1000000n)break}return t>1n&&e.push(t),e}function wd(){return[[2,46],[3,20],[5,9],[7,6],[11,2],[13,3],[17,1],[19,1],[23,1],[29,1],[31,1],[41,1],[47,1],[59,1],[71,1]].reduce((e,[t,n])=>e*BigInt(t)**BigInt(n),1n)}function X1(){let i=document.getElementById("terminal"),e=document.getElementById("term-out"),t=document.getElementById("term-in"),n=[],r=0,s=!1,a=(d,u="")=>{let f=document.createElement("div");u&&(f.className=u),f.innerHTML=d,e.appendChild(f),e.scrollTop=e.scrollHeight},o=()=>{i.classList.add("open"),i.setAttribute("aria-hidden","false"),s||(s=!0,a('<span class="acc">XHC144 OBSERVATORY OS</span> · 输入 <span class="ok">help</span> 查看命令，<span class="ok">Tab</span> 补全，<span class="ok">Esc</span> 关闭。')),setTimeout(()=>t.focus(),50),Qt("terminal",{message:"这里有一个能用的终端。试试 <b>help</b>、<b>whoami</b>、<b>cd 3</b>、<b>fib 144</b>。"})},l=()=>{i.classList.remove("open"),i.setAttribute("aria-hidden","true"),t.blur()};St.on("terminal",o),St.on("escape",l),document.getElementById("term-btn").addEventListener("click",o);for(let d of document.querySelectorAll("[data-open-terminal]"))d.addEventListener("click",o);i.querySelector(".term-close").addEventListener("click",l),i.addEventListener("click",d=>{d.target===i&&l()});let c={help:()=>['<span class="acc">可用命令</span>',"  whoami            关于我","  ls                列出维度与文件","  cd &lt;维度&gt;         跳转：0 1 2 3 3+1 n Σ ∞（或 hero / archive）","  cat &lt;文件&gt;        mission.txt · interests.txt · readme.md","  projects          公开仓库","  open github       打开 GitHub 主页","  fib &lt;n&gt;           斐波那契数 F(n)（任意精度）","  factor &lt;n&gt;        质因数分解","  euler · monster   两个等式 / 一个数","  sound on|off      声音开关","  eggs              彩蛋进度","  date · clear · exit"].join(`
`),whoami:()=>`xhc144 — 高二学生。
主线：数学（数学分析 · 高等代数 · 群表示论 · 拓扑 · 概率论 · 竞赛）
交叉：物理（经典力学 → 电动力学 → 量子力学）· 人工智能 · 计算机科学
目标：2027 清华大学求真书院数学领军计划（备考中）
工具：AI 编程 · 智能体 · 数学可视化 · 自动化工具`,ls:()=>`dim0/  dim1/  dim2/  dim3/  dim4/  dimn/  archive/  diminf/
mission.txt  interests.txt  readme.md`,cd:d=>{let u=W1[(d||"").trim()]||W1[(d||"").trim().toLowerCase()];return u?(setTimeout(()=>{l(),la(u)},250),`<span class="ok">→ 正在跃迁到 ${or(d)} …</span>`):`<span class="err">cd: 没有这个维度：${or(d||"")}</span>（可用：0 1 2 3 3+1 n Σ ∞）`},cat:d=>q1[(d||"").trim()]?or(q1[d.trim()]):`<span class="err">cat: ${or(d||"")}: 没有那个文件</span>`,projects:()=>So.map(d=>`<span class="acc">${d.name}</span>  ${or(d.title)}
  ${d.url}`).join(`
`)+`

mit-ocw-notes：数学 ${Oi.mathBooks} 册 ${Oi.mathPages} 页 · 物理 ${Oi.physBooks} 科 ${Oi.physPages} 页（快照 ${Mo}）`,open:d=>{let u=(d||"github").trim(),f=So.find(v=>v.name===u),g=f?f.url:u==="github"?R1:null;return g?(window.open(g,"_blank","noopener"),`<span class="ok">已在新标签页打开 ${g}</span>`):`<span class="err">open: 不认识 ${or(u)}</span>`},fib:d=>{let u=Number.parseInt(d,10);if(!Number.isFinite(u)||u<0||u>5e3)return'<span class="err">用法：fib n（0 ≤ n ≤ 5000）</span>';let f=U_(u),g="";return u===12&&(g=`
<span class="ok">F(12) = 144 = 12² —— 斐波那契数列里除 0、1 之外唯一的完全平方数（Cohn, 1964）。</span>`,Qt("f144",{message:Fn("144 = F_{12} = 12^2")+"：斐波那契数列中除 0 和 1 之外唯一的完全平方数（J. H. E. Cohn, 1964）。"})),`F(${u}) = ${f}${g}`},factor:d=>{if(!/^\d{1,30}$/.test((d||"").trim()))return'<span class="err">用法：factor n（n 为正整数）</span>';let u=BigInt(d.trim());if(u<2n)return`${u}`;let f=B_(u);return`${u} = ${f.join(" × ")}${f.length===1?'  <span class="ok">（质数）</span>':""}`},euler:()=>(St.emit("fx-euler"),Fn("e^{i\\pi}+1=0")+`
五个最重要的常数，一个等式。`),monster:()=>(St.emit("fx-monster"),`|𝕄| = ${wd()}
≈ 8.08 × 10⁵³ —— 魔群：最大的散在单群。`),sound:d=>d==="on"?(St.emit("sound",!0),'<span class="ok">声音：开</span>'):d==="off"?(St.emit("sound",!1),"声音：关"):`声音当前${Nt.on?"开":"关"}。用法：sound on | sound off`,eggs:()=>`已发现 ${N1()} / ${Gr.length}
`+Gr.map((d,u)=>`${String(u+1).padStart(2,"0")}  ${F1(d.id)?'<span class="ok">✓ '+d.name+"</span>":"· ？？？  线索："+d.hint}`).join(`
`),date:()=>{let d=new Date,u=Date.UTC(2026,11,31,16,0,0),f=Math.max(0,Math.ceil((u-d.getTime())/864e5));return`${d.toLocaleString("zh-CN",{hour12:!1})}
距离 2027 年还有 ${f} 天。`},clear:()=>(e.innerHTML="",null),exit:()=>(l(),null),sudo:()=>'<span class="err">权限不足：在数学里，root 权限只能靠证明获得。</span>',rm:()=>'<span class="err">拒绝执行：公理不可删除。</span>',echo:d=>or(d||""),hello:()=>"你好！欢迎来到 0 → ∞。",qiuzhen:()=>(Qt("console",{message:"求真。继续前进。"}),"求真 · 继续前进"),neofetch:()=>`<span class="acc">        ∞        </span>  xhc144@observatory
<span class="acc">     0 → ∞      </span>  OS: Observatory OS 2026.10
<span class="acc">   ℝ³ × t × n   </span>  Shell: xsh 1.0
                   Kernel: Mathematics
                   Uptime: 高二
                   Target: 2027 求真书院`},h=d=>{let u=d.trim();if(!u)return;a(or(u),"cmd"),n.push(u),r=n.length;let[f,...g]=u.split(/\s+/),v=c[f.toLowerCase()];if(Nt.tick(),!v){a(`<span class="err">${or(f)}: 未知命令</span>。输入 help 查看可用命令。`);return}let m=v(g.join(" "));m&&a(m)};return t.addEventListener("keydown",d=>{if(d.stopPropagation(),d.key==="Enter")h(t.value),t.value="";else if(d.key==="Escape")l();else if(d.key==="ArrowUp")r>0&&(r--,t.value=n[r]),d.preventDefault();else if(d.key==="ArrowDown")r<n.length-1?(r++,t.value=n[r]):(r=n.length,t.value=""),d.preventDefault();else if(d.key==="Tab"){d.preventDefault();let u=Object.keys(c).filter(f=>f.startsWith(t.value));u.length===1?t.value=u[0]+" ":u.length>1&&a(u.join("  "))}else Nt.tick()}),{open:o,close:l}}var Ct=class{constructor(e,t={}){this.host=e,this.opts=t,this.type=e.dataset.instrument,this.canvas=e.querySelector("canvas"),this.controlsEl=e.querySelector(".ins-controls"),this.large=!!t.large,this.w=0,this.h=0,this.dpr=1,this._readouts=new Map,this.time=0}get2d(){return this.ctx=this.canvas.getContext("2d"),this.ctx}resize(){let e=this.canvas.getBoundingClientRect(),t=Math.min(2,window.devicePixelRatio||1),n=Math.max(1,Math.round(e.width)),r=Math.max(1,Math.round(e.height));return n===this.w&&r===this.h&&t===this.dpr?!1:(this.w=n,this.h=r,this.dpr=t,this.canvas.width=Math.round(n*t),this.canvas.height=Math.round(r*t),this.ctx&&this.ctx.setTransform(t,0,0,t,0,0),this.onResize?.(),!0)}readout(e,t){let n=this._readouts.get(e);n||(n=[...this.host.querySelectorAll(`[data-readout="${e}"]`)],this.large||n.push(...document.querySelectorAll(`[data-readout-for="${this.type}"][data-readout="${e}"]`)),this._readouts.set(e,n));for(let r of n)r.textContent!==t&&(r.textContent=t)}controls(e){if(this.controlsEl){this.controlsEl.innerHTML="";for(let t of e)if(t.type==="chips"){let n=document.createElement("div");n.className="chips";let r=t.items.map(s=>{let a=document.createElement("button");return a.className="chip mono"+(s.value===t.value?" is-on":""),a.textContent=s.label,a.addEventListener("click",()=>{for(let o of r)o.classList.toggle("is-on",o===a);t.onChange(s.value)}),n.appendChild(a),a});this.controlsEl.appendChild(n)}else if(t.type==="button"){let n=document.createElement("button");n.className="chip mono",n.textContent=t.label,n.addEventListener("click",()=>t.onClick(n)),this.controlsEl.appendChild(n)}else if(t.type==="range"){let n=document.createElement("label");n.className="range mono",n.innerHTML=`<span>${t.label}</span><input type="range" min="${t.min}" max="${t.max}" step="${t.step}" value="${t.value}" aria-label="${t.label}"><b></b>`;let r=n.querySelector("input"),s=n.querySelector("b"),a=t.format||(o=>o);s.textContent=a(t.value),r.addEventListener("input",()=>{let o=Number(r.value);s.textContent=a(o),t.onInput(o)}),this.controlsEl.appendChild(n)}}}pointer({down:e,move:t,up:n,hover:r,leave:s}={}){let a=this.canvas,o=!1,l=h=>{let d=a.getBoundingClientRect();return[h.clientX-d.left,h.clientY-d.top]};a.addEventListener("pointerdown",h=>{let[d,u]=l(h);e&&e(d,u,h)!==!1&&(o=!0,a.setPointerCapture(h.pointerId))}),a.addEventListener("pointermove",h=>{let[d,u]=l(h);o&&t?t(d,u,h):r&&r(d,u,h)});let c=h=>{o&&(o=!1,n?.(...l(h),h))};a.addEventListener("pointerup",c),a.addEventListener("pointercancel",c),a.addEventListener("pointerleave",()=>s?.())}frame(){}destroy(){this.destroyed=!0}},Ge=Math.PI*2,de={ink:"#ece8e1",ink2:"rgba(236,232,225,0.62)",ink3:"rgba(236,232,225,0.32)",line:"rgba(236,232,225,0.12)",signal:"#ff5b1f",ion:"#4fe3ff",violet:"#9b7bff",acid:"#d4ff3a",bg:"#07070b"},dt='"JetBrains Mono", ui-monospace, monospace';var Td=new Set(["sin","cos","tan","exp","log","sqrt","sinh","cosh","tanh","conj","abs","re","im","arg"]);function O_(i){let e=i.replace(/[×·∙]/g,"*").replace(/÷/g,"/").replace(/[−–]/g,"-").replace(/π/g,"pi").replace(/\*\*/g,"^").replace(/\s+/g,""),t=[],n=0;for(;n<e.length;){let r=e[n],s=/^(\d+\.?\d*|\.\d+)/.exec(e.slice(n));if(s){t.push({k:"num",v:Number(s[1]),at:n}),n+=s[1].length;continue}let a=/^[a-zA-Z]+/.exec(e.slice(n));if(a){let o=a[0].toLowerCase(),l=[];for(;o.length;){let c=[...Td,"pi"].sort((h,d)=>d.length-h.length).find(h=>o.startsWith(h));c?(l.push(c),o=o.slice(c.length)):(l.push(o[0]),o=o.slice(1))}for(let c of l){if(!Td.has(c)&&!["z","i","t","e","pi"].includes(c))throw new Error(`不认识的符号 “${c}”`);t.push({k:Td.has(c)?"fn":"id",v:c,at:n})}n+=a[0].length;continue}if("+-*/^(),".includes(r)){t.push({k:r,at:n}),n++;continue}throw new Error(`第 ${n+1} 个字符 “${r}” 无法识别`)}return t}function V_(i){let e=O_(i);if(!e.length)throw new Error("请输入一个函数");let t=0,n=()=>e[t],r=u=>{let f=e[t];if(!f||f.k!==u)throw new Error(`缺少 “${u}”`);return t++,f},s=u=>u&&(u.k==="num"||u.k==="id"||u.k==="fn"||u.k==="(");function a(){let u=o();for(;n()&&(n().k==="+"||n().k==="-");)u={t:"bin",op:e[t++].k,a:u,b:o()};return u}function o(){let u=l();for(;;){let f=n();if(f&&(f.k==="*"||f.k==="/"))t++,u={t:"bin",op:f.k,a:u,b:l()};else if(s(f))u={t:"bin",op:"*",a:u,b:c()};else return u}}function l(){let u=n();return u&&u.k==="-"?(t++,{t:"neg",a:l()}):u&&u.k==="+"?(t++,l()):c()}function c(){let u=h();return n()&&n().k==="^"?(t++,{t:"bin",op:"^",a:u,b:l()}):u}function h(){let u=e[t++];if(!u)throw new Error("表达式不完整");if(u.k==="num")return{t:"num",v:u.v};if(u.k==="id")return{t:u.v};if(u.k==="fn"){r("(");let f=a();return r(")"),{t:"fn",name:u.v,a:f}}if(u.k==="("){let f=a();return r(")"),f}throw new Error(`第 ${u.at+1} 个字符处语法错误`)}let d=a();if(t<e.length)throw new Error(`第 ${e[t].at+1} 个字符处多余的 “${e[t].k==="num"?e[t].v:e[t].v||e[t].k}”`);return d}var Ad=i=>i.t==="t"||i.a&&Ad(i.a)||i.b&&Ad(i.b),Ed=i=>i.t==="num"&&Number.isInteger(i.v)&&i.v<=24,H_=i=>i.t==="neg"&&Ed(i.a),G_=i=>Number.isInteger(i)?i.toFixed(1):String(i);function Ao(i){switch(i.t){case"num":return`vec2(${G_(i.v)}, 0.0)`;case"i":return"vec2(0.0, 1.0)";case"z":return"z";case"t":return"uT";case"pi":return"vec2(3.14159265, 0.0)";case"e":return"vec2(2.71828183, 0.0)";case"neg":return`(-${Ao(i.a)})`;case"fn":return`c${i.name}(${Ao(i.a)})`;case"bin":{let e=Ao(i.a),t=Ao(i.b);return i.op==="+"?`(${e} + ${t})`:i.op==="-"?`(${e} - ${t})`:i.op==="*"?`cmul(${e}, ${t})`:i.op==="/"?`cdiv(${e}, ${t})`:Ed(i.b)?`cpowi(${e}, ${i.b.v})`:H_(i.b)?`cdiv(vec2(1.0, 0.0), cpowi(${e}, ${i.b.a.v}))`:`cpow(${e}, ${t})`}}throw new Error("bad node")}var Wn={mul:(i,e)=>[i[0]*e[0]-i[1]*e[1],i[0]*e[1]+i[1]*e[0]],div:(i,e)=>{let t=e[0]*e[0]+e[1]*e[1];return[(i[0]*e[0]+i[1]*e[1])/t,(i[1]*e[0]-i[0]*e[1])/t]},exp:i=>[Math.exp(i[0])*Math.cos(i[1]),Math.exp(i[0])*Math.sin(i[1])],log:i=>[Math.log(Math.hypot(i[0],i[1])),Math.atan2(i[1],i[0])]};Wn.pow=(i,e)=>i[0]===0&&i[1]===0?[0,0]:Wn.exp(Wn.mul(e,Wn.log(i)));Wn.powi=(i,e)=>{let t=[1,0];for(let n=0;n<e;n++)t=Wn.mul(t,i);return t};var ls={sin:i=>[Math.sin(i[0])*Math.cosh(i[1]),Math.cos(i[0])*Math.sinh(i[1])],cos:i=>[Math.cos(i[0])*Math.cosh(i[1]),-Math.sin(i[0])*Math.sinh(i[1])],sinh:i=>[Math.sinh(i[0])*Math.cos(i[1]),Math.cosh(i[0])*Math.sin(i[1])],cosh:i=>[Math.cosh(i[0])*Math.cos(i[1]),Math.sinh(i[0])*Math.sin(i[1])],exp:Wn.exp,log:Wn.log,sqrt:i=>{let e=Math.hypot(i[0],i[1]);return[Math.sqrt((e+i[0])/2),(i[1]<0?-1:1)*Math.sqrt(Math.max(0,(e-i[0])/2))]},conj:i=>[i[0],-i[1]],abs:i=>[Math.hypot(i[0],i[1]),0],re:i=>[i[0],0],im:i=>[i[1],0],arg:i=>[Math.atan2(i[1],i[0]),0]};ls.tan=i=>Wn.div(ls.sin(i),ls.cos(i));ls.tanh=i=>Wn.div(ls.sinh(i),ls.cosh(i));function Eo(i){switch(i.t){case"num":return()=>[i.v,0];case"i":return()=>[0,1];case"z":return e=>e;case"t":return(e,t)=>t;case"pi":return()=>[Math.PI,0];case"e":return()=>[Math.E,0];case"neg":{let e=Eo(i.a);return(t,n)=>{let r=e(t,n);return[-r[0],-r[1]]}}case"fn":{let e=Eo(i.a),t=ls[i.name];return(n,r)=>t(e(n,r))}case"bin":{let e=Eo(i.a),t=Eo(i.b);return i.op==="+"?(n,r)=>{let s=e(n,r),a=t(n,r);return[s[0]+a[0],s[1]+a[1]]}:i.op==="-"?(n,r)=>{let s=e(n,r),a=t(n,r);return[s[0]-a[0],s[1]-a[1]]}:i.op==="*"?(n,r)=>Wn.mul(e(n,r),t(n,r)):i.op==="/"?(n,r)=>Wn.div(e(n,r),t(n,r)):Ed(i.b)?(n,r)=>Wn.powi(e(n,r),i.b.v):(n,r)=>Wn.pow(e(n,r),t(n,r))}}throw new Error("bad node")}var W_=`
precision highp float;
uniform vec2 uRes, uCenter, uT;
uniform float uScale, uS;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdiv(vec2 a, vec2 b) { float d = dot(b, b); return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / d; }
vec2 cexp(vec2 a) { return exp(a.x) * vec2(cos(a.y), sin(a.y)); }
vec2 clog(vec2 a) { return vec2(log(length(a)), atan(a.y, a.x)); }
vec2 cpow(vec2 a, vec2 b) { if (dot(a, a) == 0.0) return vec2(0.0); return cexp(cmul(b, clog(a))); }
vec2 cpowi(vec2 a, int n) { vec2 r = vec2(1.0, 0.0); for (int k = 0; k < 24; k++) { if (k >= n) break; r = cmul(r, a); } return r; }
float sh(float x) { return 0.5 * (exp(x) - exp(-x)); }
float ch(float x) { return 0.5 * (exp(x) + exp(-x)); }
vec2 csin(vec2 a) { return vec2(sin(a.x) * ch(a.y), cos(a.x) * sh(a.y)); }
vec2 ccos(vec2 a) { return vec2(cos(a.x) * ch(a.y), -sin(a.x) * sh(a.y)); }
vec2 csinh(vec2 a) { return vec2(sh(a.x) * cos(a.y), ch(a.x) * sin(a.y)); }
vec2 ccosh(vec2 a) { return vec2(ch(a.x) * cos(a.y), sh(a.x) * sin(a.y)); }
vec2 ctan(vec2 a) { return cdiv(csin(a), ccos(a)); }
vec2 ctanh(vec2 a) { return cdiv(csinh(a), ccosh(a)); }
vec2 cexp_(vec2 a) { return cexp(a); }
vec2 csqrt(vec2 a) { float r = length(a); return vec2(sqrt(max(0.0, 0.5 * (r + a.x))), (a.y < 0.0 ? -1.0 : 1.0) * sqrt(max(0.0, 0.5 * (r - a.x)))); }
vec2 cconj(vec2 a) { return vec2(a.x, -a.y); }
vec2 cabs(vec2 a) { return vec2(length(a), 0.0); }
vec2 cre(vec2 a) { return vec2(a.x, 0.0); }
vec2 cim(vec2 a) { return vec2(a.y, 0.0); }
vec2 carg(vec2 a) { return vec2(atan(a.y, a.x), 0.0); }
vec3 pal(float h) { return 0.5 + 0.5 * cos(6.2831853 * (h + vec3(0.0, 0.333, 0.667))); }
`;function q_(i){return`${W_}
vec2 F(vec2 z) { return ${i}; }
void main() {
  vec2 z = uCenter + (gl_FragCoord.xy - 0.5 * uRes) * uScale;
  vec2 w = mix(z, F(z), uS);
  float r = length(w);
  float h = atan(w.y, w.x) / 6.2831853;
  float lr = log2(max(r, 1e-30));
  float m = fract(lr);
  float ph = fract(h * 12.0);
  float shade = (0.6 + 0.4 * m) * (0.84 + 0.16 * ph);
  vec3 col = pal(h) * shade;
  col = mix(col, vec3(1.0), smoothstep(7.0, 22.0, lr));
  col = mix(col, vec3(0.0), smoothstep(-7.0, -22.0, lr));
  float ax = min(abs(z.x), abs(z.y)) / uScale;
  col = mix(col, vec3(1.0), 0.28 * (1.0 - smoothstep(0.0, 1.4, ax)));
  if (!(r < 1e38)) col = vec3(1.0);
  if (r != r) col = vec3(0.22);
  gl_FragColor = vec4(col, 1.0);
}`}var X_="attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }",$1=[["有理函数","(z^2-1)*(z-2-i)^2/(z^2+2+2i)"],["恒等 z","z"],["单位根","z^5-1"],["本性奇点","exp(1/z)"],["sin z","sin(z)"],["Blaschke 积","(z-0.5-0.3i)/(1-(0.5-0.3i)z)*(z+0.6)/(1+0.6z)"],["旋转的根","z^3-t"],["对数割线","log(z)"],["tan z","tan(z)"]],A0=class extends Ct{init(){this.host.dataset.cursorLabel="DRAG · 平移";let e=this.canvas.getContext("webgl",{antialias:!1,preserveDrawingBuffer:!1});if(!e)throw new Error("WebGL unavailable");this.gl=e;let t=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),this.center=[0,0],this.halfH=3.2,this.s=1,this.sTarget=1,this.input=this.host.querySelector(".fx-input input"),this.err=this.host.querySelector(".fx-err"),this.setExpr(this.input?this.input.value:$1[0][1]);let n=this.host.querySelector("[data-presets]");if(n){n.innerHTML="";let s=$1.map(([o,l],c)=>{let h=document.createElement("button");return h.className="chip mono"+(c===0?" is-on":""),h.textContent=o,h.addEventListener("click",()=>{for(let d of s)d.classList.toggle("is-on",d===h);this.input.value=l,this.setExpr(l,!0)}),n.appendChild(h),h}),a=o=>{this.halfH=Math.min(60,Math.max(.05,this.halfH*o)),this.dirty=!0};for(let[o,l]of[["＋",()=>a(.7)],["－",()=>a(1/.7)],["复位",()=>{this.center=[0,0],this.halfH=3.2,this.dirty=!0}]]){let c=document.createElement("button");c.className="chip mono",c.textContent=o,c.addEventListener("click",l),n.appendChild(c)}}if(this.input){let s=0;this.input.addEventListener("input",()=>{clearTimeout(s),s=setTimeout(()=>this.setExpr(this.input.value,!0),260)}),this.input.addEventListener("keydown",a=>a.stopPropagation())}let r=null;this.pointer({down:(s,a)=>{r=[s,a]},move:(s,a)=>{let o=this.scale();this.center[0]-=(s-r[0])*o,this.center[1]+=(a-r[1])*o,r=[s,a],this.dirty=!0,this.hover(s,a)},hover:(s,a)=>this.hover(s,a)}),this.canvas.addEventListener("wheel",s=>{if(!s.ctrlKey&&!this.large)return;s.preventDefault();let a=this.canvas.getBoundingClientRect(),o=this.scale(),l=this.center[0]+(s.clientX-a.left-this.w/2)*o,c=this.center[1]-(s.clientY-a.top-this.h/2)*o,h=Math.exp(s.deltaY*.0015);this.halfH=Math.min(60,Math.max(.05,this.halfH*h));let d=this.scale();this.center=[l-(s.clientX-a.left-this.w/2)*d,c+(s.clientY-a.top-this.h/2)*d],this.dirty=!0},{passive:!1})}scale(){return this.halfH*2/Math.max(1,this.h)}setExpr(e,t=!1){let n;try{n=V_(e);let r=this.compile(q_(Ao(n)));this.prog&&this.gl.deleteProgram(this.prog),this.prog=r,this.fn=Eo(n),this.animated=Ad(n),this.err&&(this.err.textContent=""),this.input?.parentElement.classList.remove("bad"),t&&(this.s=0,this.sTarget=1),this.dirty=!0}catch(r){this.err&&(this.err.textContent=r.message),this.input?.parentElement.classList.add("bad")}}compile(e){let t=this.gl,n=(s,a)=>{let o=t.createShader(s);if(t.shaderSource(o,a),t.compileShader(o),!t.getShaderParameter(o,t.COMPILE_STATUS))throw new Error("着色器编译失败："+(t.getShaderInfoLog(o)||"").split(`
`)[0]);return o},r=t.createProgram();if(t.attachShader(r,n(t.VERTEX_SHADER,X_)),t.attachShader(r,n(t.FRAGMENT_SHADER,e)),t.bindAttribLocation(r,0,"p"),t.linkProgram(r),!t.getProgramParameter(r,t.LINK_STATUS))throw new Error("着色器链接失败");r.u={};for(let s of["uRes","uCenter","uT","uScale","uS"])r.u[s]=t.getUniformLocation(r,s);return r}hover(e,t){if(!this.fn)return;let n=this.scale(),r=[this.center[0]+(e-this.w/2)*n,this.center[1]-(t-this.h/2)*n],s=[Math.cos(this.time*.5),Math.sin(this.time*.5)],a=this.fn(r,s),o=c=>`${c[0].toFixed(3)} ${c[1]<0?"−":"+"} ${Math.abs(c[1]).toFixed(3)}i`;this.readout("z",o(r)),this.readout("fz",Number.isFinite(a[0])&&Number.isFinite(a[1])?o(a):"∞");let l=Math.hypot(a[0],a[1]);this.readout("mod",Number.isFinite(l)?l>1e5?l.toExponential(2):l.toFixed(4):"∞"),this.readout("arg",`${(Math.atan2(a[1],a[0])*180/Math.PI).toFixed(1)}°`)}onResize(){this.dirty=!0}frame(e){if(this.s<this.sTarget&&(this.s=Math.min(1,this.s+e/1.3),this.dirty=!0),!this.dirty&&!this.animated)return;this.dirty=!1;let t=this.gl,n=this.prog;if(!n)return;t.viewport(0,0,this.canvas.width,this.canvas.height),t.useProgram(n),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),t.uniform2f(n.u.uRes,this.canvas.width,this.canvas.height),t.uniform2f(n.u.uCenter,this.center[0],this.center[1]),t.uniform2f(n.u.uT,Math.cos(this.time*.5),Math.sin(this.time*.5)),t.uniform1f(n.u.uScale,this.scale()/this.dpr);let r=this.s<1?1-Math.pow(1-this.s,3):1;t.uniform1f(n.u.uS,r),t.drawArrays(t.TRIANGLES,0,3)}destroy(){super.destroy(),this.gl?.getExtension("WEBGL_lose_context")?.loseContext()}};var _i=1024;function Y1(i){let e=i.map((s,a)=>[s,i[(a+1)%i.length]]),t=e.map(([s,a])=>Math.hypot(a[0]-s[0],a[1]-s[1])),n=t.reduce((s,a)=>s+a,0),r=[];for(let s=0;s<_i;s++){let a=s/_i*n,o=0;for(;a>t[o];)a-=t[o],o++;let[l,c]=e[o],h=a/t[o];r.push([l[0]+(c[0]-l[0])*h,l[1]+(c[1]-l[1])*h])}return r}var $_={trefoil:()=>Array.from({length:_i},(i,e)=>{let t=e/_i*Ge;return[Math.sin(t)+2*Math.sin(2*t),-(Math.cos(t)-2*Math.cos(2*t))]}),square:()=>Y1([[-1,-1],[1,-1],[1,1],[-1,1]]),star:()=>Y1(Array.from({length:7},(i,e)=>{let t=e*3/7*Ge-Math.PI/2;return[Math.cos(t),Math.sin(t)]}))};function Y_(i){let e=[];for(let t=-_i/2;t<_i/2;t++){let n=0,r=0;for(let s=0;s<_i;s++){let a=-Ge*t*s/_i,o=Math.cos(a),l=Math.sin(a);n+=i[s][0]*o-i[s][1]*l,r+=i[s][0]*l+i[s][1]*o}e.push({n:t,re:n/_i,im:r/_i,amp:Math.hypot(n,r)/_i})}return e}var E0=class extends Ct{init(){this.get2d(),this.N=24,this.cache={},this.setShape("trefoil"),this.controls([{type:"chips",value:"trefoil",items:[{label:"三叶结投影",value:"trefoil"},{label:"正方形",value:"square"},{label:"七角星",value:"star"}],onChange:e=>this.setShape(e)},{type:"range",label:"N",min:1,max:160,step:1,value:this.N,onInput:e=>{this.N=e,this.build()}}])}setShape(e){if(this.shapeName=e,!this.cache[e]){let t=$_[e](),n=Y_(t),r=n.find(a=>a.n===0),s=n.filter(a=>a.n!==0).sort((a,o)=>o.amp-a.amp);this.cache[e]={pts:t,c0:r,rest:s,energy:s.reduce((a,o)=>a+o.amp*o.amp,0)}}this.data=this.cache[e],this.trail=[],this.build()}build(){let{rest:e,energy:t}=this.data,n=e.slice(0,this.N),r=n.reduce((s,a)=>s+a.amp*a.amp,0);this.err=Math.sqrt(Math.max(0,t-r)),this.terms=n.filter(s=>s.amp>1e-9).length,this.approx=Array.from({length:400},(s,a)=>this.eval(a/400*Ge,n))}eval(e,t){let n=this.data.c0.re,r=this.data.c0.im;for(let s of t){let a=s.n*e;n+=s.re*Math.cos(a)-s.im*Math.sin(a),r+=s.re*Math.sin(a)+s.im*Math.cos(a)}return[n,r]}frame(e,t){let n=this.ctx,r=this.w,s=this.h;n.clearRect(0,0,r,s);let{pts:a}=this.data,o=0;for(let p of a)o=Math.max(o,Math.abs(p[0]),Math.abs(p[1]));let l=Math.min(r,s)*.38/o,c=r/2,h=s/2+6,d=p=>[c+p[0]*l,h+p[1]*l];n.strokeStyle=de.line,n.lineWidth=1,n.beginPath(),a.forEach((p,_)=>{let[A,M]=d(p);_?n.lineTo(A,M):n.moveTo(A,M)}),n.closePath(),n.stroke(),n.strokeStyle="rgba(255,91,31,0.55)",n.lineWidth=1.4,n.beginPath(),this.approx.forEach((p,_)=>{let[A,M]=d(p);_?n.lineTo(A,M):n.moveTo(A,M)}),n.closePath(),n.stroke();let u=t*Ge/9,f=this.data.c0.re,g=this.data.c0.im,v=this.data.rest.slice(0,this.N);n.lineWidth=1;for(let p=0;p<v.length;p++){let _=v[p],[A,M]=d([f,g]),T=_.amp*l;T>.6&&(n.strokeStyle=`rgba(79,227,255,${.08+.3*Math.exp(-p/8)})`,n.beginPath(),n.arc(A,M,T,0,Ge),n.stroke());let S=_.n*u;f+=_.re*Math.cos(S)-_.im*Math.sin(S),g+=_.re*Math.sin(S)+_.im*Math.cos(S);let[I,b]=d([f,g]);n.strokeStyle=`rgba(236,232,225,${.25+.5*Math.exp(-p/6)})`,n.beginPath(),n.moveTo(A,M),n.lineTo(I,b),n.stroke()}let m=d([f,g]);this.trail.push(m),this.trail.length>160&&this.trail.shift();for(let p=1;p<this.trail.length;p++)n.strokeStyle=`rgba(255,190,150,${p/this.trail.length})`,n.lineWidth=2,n.beginPath(),n.moveTo(...this.trail[p-1]),n.lineTo(...this.trail[p]),n.stroke();n.fillStyle="#fff",n.beginPath(),n.arc(m[0],m[1],3,0,Ge),n.fill(),n.font=`11px ${dt}`,n.fillStyle=de.ink2,n.fillText(`非零项 ${this.terms}   L² 误差 ${this.err<1e-6?"0（精确）":this.err.toFixed(4)}`,12,20)}};var Co=[{m:[2,1,1,2],note:"对称矩阵：两个正交的特征方向，λ = 3, 1"},{m:[0,1,1,1],note:"斐波那契矩阵：λ = φ 与 −1/φ，Aⁿ 的元素是斐波那契数"},{m:[1,1,0,1],note:"剪切：λ = 1 是二重根，却只有一个特征方向"},{m:[.5,-.866,.866,.5],note:"旋转 60°：特征值是复数，没有实特征向量"}];function K_([i,e,t,n]){let r=i+n,s=i*n-e*t,a=r*r/4-s;if(a<-1e-9)return{tr:r,det:s,complex:[r/2,Math.sqrt(-a)]};let o=Math.sqrt(Math.max(0,a)),l=d=>{let u=Math.abs(e)>1e-9?[e,d-i]:Math.abs(t)>1e-9?[d-n,t]:null;if(!u)return null;let f=Math.hypot(...u);return[u[0]/f,u[1]/f]},h=(o<1e-9?[r/2]:[r/2+o,r/2-o]).map(d=>({l:d,v:l(d)}));return Math.abs(e)<1e-9&&Math.abs(t)<1e-9?{tr:r,det:s,vs:[{l:i,v:[1,0]},{l:n,v:[0,1]}]}:{tr:r,det:s,vs:h.filter(d=>d.v)}}var C0=class extends Ct{init(){this.get2d(),this.preset=0,this.phase=0,this.auto=!0,this.A=Co[0].m.slice(),this.M=[1,0,0,1],this.controls([{type:"button",label:"下一个矩阵",onClick:()=>{this.auto=!0,this.preset=(this.preset+1)%Co.length,this.phase=0}},{type:"button",label:"恢复自动",onClick:()=>{this.auto=!0,this.phase=0}}]);let e=null;this.pointer({down:(t,n)=>{let[r,s]=this.toScreen(this.M[0],this.M[2]),[a,o]=this.toScreen(this.M[1],this.M[3]);if(Math.hypot(t-r,n-s)<18)e="i";else if(Math.hypot(t-a,n-o)<18)e="j";else return!1;return this.auto=!1,!0},move:(t,n)=>{let[r,s]=this.fromScreen(t,n),a=o=>Math.round(o*4)/4;e==="i"?(this.M[0]=a(r),this.M[2]=a(s)):(this.M[1]=a(r),this.M[3]=a(s)),this.A=this.M.slice()},up:()=>{e=null}})}get unit(){return Math.min(this.w,this.h)/8.2}toScreen(e,t){return[this.w/2+e*this.unit,this.h/2-t*this.unit]}fromScreen(e,t){return[(e-this.w/2)/this.unit,-(t-this.h/2)/this.unit]}frame(e){if(this.auto){this.phase+=e;let d=Co[this.preset].m,u=this.phase<.6?0:this.phase<2.4?(this.phase-.6)/1.8:this.phase<6?1:this.phase<7.2?1-(this.phase-6)/1.2:0,f=u*u*(3-2*u);this.M=[1+(d[0]-1)*f,d[1]*f,d[2]*f,1+(d[3]-1)*f],this.A=d,this.phase>7.6&&(this.phase=0,this.preset=(this.preset+1)%Co.length)}let t=this.ctx,n=this.w,r=this.h,s=this.M;t.clearRect(0,0,n,r);let a=(d,u)=>this.toScreen(s[0]*d+s[1]*u,s[2]*d+s[3]*u);t.strokeStyle="rgba(236,232,225,0.06)",t.lineWidth=1;for(let d=-8;d<=8;d++){let[u,f]=this.toScreen(d,-8),[g,v]=this.toScreen(d,8);t.beginPath(),t.moveTo(u,f),t.lineTo(g,v),t.stroke();let[m,p]=this.toScreen(-8,d),[_,A]=this.toScreen(8,d);t.beginPath(),t.moveTo(m,p),t.lineTo(_,A),t.stroke()}for(let d=-8;d<=8;d++){t.strokeStyle=d===0?"rgba(236,232,225,0.55)":"rgba(155,123,255,0.28)";let[u,f]=a(d,-8),[g,v]=a(d,8);t.beginPath(),t.moveTo(u,f),t.lineTo(g,v),t.stroke(),[u,f]=a(-8,d),[g,v]=a(8,d),t.beginPath(),t.moveTo(u,f),t.lineTo(g,v),t.stroke()}let o=s[0]*s[3]-s[1]*s[2];t.fillStyle=o>=0?"rgba(255,91,31,0.16)":"rgba(79,227,255,0.16)",t.beginPath(),t.moveTo(...a(0,0)),t.lineTo(...a(1,0)),t.lineTo(...a(1,1)),t.lineTo(...a(0,1)),t.closePath(),t.fill(),t.strokeStyle="rgba(212,255,58,0.6)",t.setLineDash([3,4]),t.beginPath();for(let d=0;d<=96;d++){let u=d/96*Ge,[f,g]=a(Math.cos(u),Math.sin(u));d?t.lineTo(f,g):t.moveTo(f,g)}t.stroke(),t.setLineDash([]);let l=K_(s);if(t.font=`11px ${dt}`,l.vs)for(let{l:d,v:u}of l.vs){let[f,g]=this.toScreen(-u[0]*9,-u[1]*9),[v,m]=this.toScreen(u[0]*9,u[1]*9);t.strokeStyle="rgba(212,255,58,0.5)",t.setLineDash([6,6]),t.beginPath(),t.moveTo(f,g),t.lineTo(v,m),t.stroke(),t.setLineDash([]);let[p,_]=this.toScreen(u[0]*2.6,u[1]*2.6);t.fillStyle=de.acid,t.fillText(`λ=${d.toFixed(2)}`,p+6,_-6)}let c=(d,u,f,g)=>{let[v,m]=this.toScreen(0,0),[p,_]=this.toScreen(d,u);t.strokeStyle=f,t.fillStyle=f,t.lineWidth=2.5,t.beginPath(),t.moveTo(v,m),t.lineTo(p,_),t.stroke();let A=Math.atan2(_-m,p-v);t.beginPath(),t.moveTo(p,_),t.lineTo(p-10*Math.cos(A-.4),_-10*Math.sin(A-.4)),t.lineTo(p-10*Math.cos(A+.4),_-10*Math.sin(A+.4)),t.fill(),t.beginPath(),t.arc(p,_,7,0,Ge),t.lineWidth=1,t.stroke(),t.fillText(g,p+10,_+14),t.lineWidth=1};c(s[0],s[2],de.signal,"Aî"),c(s[1],s[3],de.ion,"Aĵ"),t.fillStyle=de.ink,t.font=`12px ${dt}`;let h=d=>(d>=0?" ":"")+d.toFixed(2);t.fillText(`A = [${h(s[0])} ${h(s[1])} ]`,12,20),t.fillText(`    [${h(s[2])} ${h(s[3])} ]`,12,36),t.fillStyle=de.ink2,t.fillText(`det A = ${o.toFixed(3)}   tr A = ${(s[0]+s[3]).toFixed(2)}`,12,56),l.complex&&t.fillText(`λ = ${l.complex[0].toFixed(2)} ± ${l.complex[1].toFixed(2)}i`,12,72),this.auto?(t.fillStyle=de.ink3,t.fillText(Co[this.preset].note,12,r-14)):(t.fillStyle=de.ink3,t.fillText("手动模式：拖动 Aî / Aĵ 的端点",12,r-14))}};var Wr=Math.sqrt(3)/2,Ro=[{name:"e",cyc:"(1)(2)(3)",kind:"rot",a:0,cls:0,mat:[1,0,0,1]},{name:"r",cyc:"(1 2 3)",kind:"rot",a:Ge/3,cls:2,mat:[-.5,-Wr,Wr,-.5]},{name:"r²",cyc:"(1 3 2)",kind:"rot",a:2*Ge/3,cls:2,mat:[-.5,Wr,-Wr,-.5]},{name:"s₁",cyc:"(2 3)",kind:"ref",a:Math.PI/2,cls:1,mat:[-1,0,0,1]},{name:"s₂",cyc:"(1 3)",kind:"ref",a:Math.PI/2+Ge/3,cls:1,mat:[.5,Wr,Wr,-.5]},{name:"s₃",cyc:"(1 2)",kind:"ref",a:Math.PI/2+2*Ge/3,cls:1,mat:[.5,-Wr,-Wr,-.5]}],Cd={head:["","e","(12)","(123)"],rows:[["χ_triv",1,1,1],["χ_sign",1,-1,1],["χ_std",2,0,-1]],size:["|C|",1,3,2]},Z_=[de.signal,de.ion,de.acid],J_=(i,[e,t])=>[i[0]*e+i[1]*t,i[2]*e+i[3]*t],R0=class extends Ct{init(){this.get2d(),this.base=[0,1,2].map(e=>[Math.cos(Math.PI/2+e*Ge/3),Math.sin(Math.PI/2+e*Ge/3)]),this.labels=[0,1,2],this.current=Ro[0],this.anim=null,this.auto=!0,this.timer=0,this.seq=0,this.controls([{type:"button",label:"旋转 r",onClick:()=>{this.auto=!1,this.play(Ro[1])}},{type:"button",label:"翻转 s₁",onClick:()=>{this.auto=!1,this.play(Ro[3])}},{type:"button",label:"自动",onClick:()=>{this.auto=!0}}])}play(e){this.anim||(this.anim={g:e,t:0})}finish(e){let t=[0,0,0];for(let n=0;n<3;n++){let r=J_(e.mat,this.base[n]),s=this.base.findIndex(a=>Math.hypot(a[0]-r[0],a[1]-r[1])<1e-6);t[s]=this.labels[n]}this.labels=t,this.current=e}frame(e){this.anim?(this.anim.t+=e/1.1,this.anim.t>=1&&(this.finish(this.anim.g),this.anim=null)):this.auto&&(this.timer+=e,this.timer>1.4&&(this.timer=0,this.seq=(this.seq+1)%Ro.length,this.play(Ro[[1,3,2,4,1,5][this.seq]])));let t=this.ctx,n=this.w,r=this.h;t.clearRect(0,0,n,r);let s=n>r*1.05,a=Math.min(s?n*.22:n*.3,r*.3),o=s?n*.28:n/2,l=s?r*.52:r*.34,c=b=>b,h=this.anim?.g;if(h){let b=this.anim.t<.5?2*this.anim.t**2:1-(-2*this.anim.t+2)**2/2;if(h.kind==="rot"){let R=h.a*b,L=Math.cos(R),N=Math.sin(R);c=([U,W])=>[L*U-N*W,N*U+L*W]}else{let R=[Math.cos(h.a),Math.sin(h.a)],L=Math.cos(Math.PI*b);c=([N,U])=>{let W=N*R[0]+U*R[1],F=N-W*R[0],q=U-W*R[1];return[W*R[0]+L*F,W*R[1]+L*q]}}}let d=b=>{let R=c(b);return[o+R[0]*a,l-R[1]*a]};t.strokeStyle=de.line,t.setLineDash([3,5]);for(let b=0;b<3;b++){let R=Math.PI/2+b*Ge/3;t.beginPath(),t.moveTo(o-Math.cos(R)*a*1.35,l+Math.sin(R)*a*1.35),t.lineTo(o+Math.cos(R)*a*1.35,l-Math.sin(R)*a*1.35),t.stroke()}t.setLineDash([]),h&&h.kind==="ref"&&(t.strokeStyle=de.signal,t.beginPath(),t.moveTo(o-Math.cos(h.a)*a*1.4,l+Math.sin(h.a)*a*1.4),t.lineTo(o+Math.cos(h.a)*a*1.4,l-Math.sin(h.a)*a*1.4),t.stroke());let u=this.base.map(d);t.fillStyle="rgba(155,123,255,0.16)",t.strokeStyle=de.ink,t.lineWidth=1.6,t.beginPath(),u.forEach((b,R)=>R?t.lineTo(...b):t.moveTo(...b)),t.closePath(),t.fill(),t.stroke(),t.lineWidth=1,t.font=`bold 13px ${dt}`,t.textAlign="center",t.textBaseline="middle",u.forEach((b,R)=>{let L=this.labels[R];t.fillStyle=Z_[L],t.beginPath(),t.arc(b[0],b[1],11,0,Ge),t.fill(),t.fillStyle="#000",t.fillText(String(L+1),b[0],b[1]+.5)}),t.textAlign="left",t.textBaseline="alphabetic";let f=this.current;t.font=`12px ${dt}`,t.fillStyle=de.ink,t.fillText(`g = ${h?h.name+"  "+h.cyc:f.name+"  "+f.cyc}`,12,20);let g=(h||f).mat,v=b=>(b>=0?" ":"")+b.toFixed(2);t.fillStyle=de.ink2,t.fillText(`ρ(g) = [${v(g[0])} ${v(g[1])}]`,12,38),t.fillText(`       [${v(g[2])} ${v(g[3])}]   tr = ${(g[0]+g[3]).toFixed(0)}`,12,54);let m=(h||f).cls,p=s?n*.55:14,_=s?r*.3:r*.68,A=56,M=s?Math.min(52,(n-p-A-10)/3):(n-28-A)/3,T=20,S=b=>b===0?p:p+A+M*(b-1);t.fillStyle="rgba(255,91,31,0.16)",t.fillRect(S(m+1)-6,_-15,M,T*5+6),t.font=`11px ${dt}`,[Cd.head,...Cd.rows,Cd.size].forEach((b,R)=>b.forEach((L,N)=>{t.fillStyle=R===0||N===0?de.ink3:R===3&&N===m+1?de.signal:de.ink,t.fillText(String(L).replace("-","−"),S(N),_+T*R)})),t.fillStyle=de.ink3,t.fillText("6 = 1² + 1² + 2²",p,_+T*5+8)}};var Rd=96,kd=8,j_=1,k0=.42,I0=class extends Ct{init(){this.get2d(),this.twist=1,this.twistTarget=1,this.u=0,this.loops=0,this.controls([{type:"chips",value:1,items:[{label:"Möbius 带",value:1},{label:"圆柱面",value:0}],onChange:e=>{this.twistTarget=e,this.loops=0,this.u=0}}])}point(e,t,n){let r=n*e/2,s=j_+t*Math.cos(r);return[s*Math.cos(e),s*Math.sin(e),t*Math.sin(r)]}normal(e,t){let r=this.point(e,0,t),s=this.point(e+1e-4,0,t),a=this.point(e,1e-4,t),o=[s[0]-r[0],s[1]-r[1],s[2]-r[2]],l=[a[0]-r[0],a[1]-r[1],a[2]-r[2]],c=[o[1]*l[2]-o[2]*l[1],o[2]*l[0]-o[0]*l[2],o[0]*l[1]-o[1]*l[0]],h=Math.hypot(...c);return[c[0]/h,c[1]/h,c[2]/h]}frame(e,t){this.twist+=(this.twistTarget-this.twist)*Math.min(1,e*2.5);let n=this.twist,r=this.u;this.u=(this.u+e*.55)%(Ge*2),this.u<r&&(this.loops=0);let s=this.ctx,a=this.w,o=this.h;s.clearRect(0,0,a,o);let l=t*.25,c=.95,h=Math.cos(l),d=Math.sin(l),u=Math.cos(c),f=Math.sin(c),g=Math.min(a,o)*.3,v=([R,L,N])=>{let U=h*R-d*L,W=d*R+h*L,F=u*W-f*N,q=f*W+u*N,Z=3.6/(3.6-F*.6);return[a/2+U*g*Z,o*.52-q*g*Z,F]},m=R=>{let L=h*R[0]-d*R[1],N=d*R[0]+h*R[1];return u*N-f*R[2]},p=[];for(let R=0;R<Rd;R++){let L=R/Rd*Ge,N=(R+1)/Rd*Ge;for(let U=0;U<kd;U++){let W=-k0+2*k0*U/kd,F=-k0+2*k0*(U+1)/kd,q=[this.point(L,W,n),this.point(N,W,n),this.point(N,F,n),this.point(L,F,n)].map(v),Z=(q[0][2]+q[1][2]+q[2][2]+q[3][2])/4,J=this.normal((L+N)/2,n);p.push({P:q,depth:Z,facing:m(J),i:R})}}p.sort((R,L)=>R.depth-L.depth);for(let R of p){let L=R.facing<0;s.fillStyle=L?"rgba(255,91,31,0.55)":"rgba(79,227,255,0.45)",s.strokeStyle="rgba(5,5,8,0.55)",s.beginPath(),R.P.forEach((N,U)=>U?s.lineTo(N[0],N[1]):s.moveTo(N[0],N[1])),s.closePath(),s.fill(),s.stroke()}let _=this.u,A=this.point(_,0,n),M=this.normal(_,n),T=v(A),S=v([A[0]+M[0]*.55,A[1]+M[1]*.55,A[2]+M[2]*.55]);s.strokeStyle="#fff",s.fillStyle="#fff",s.lineWidth=2.5,s.beginPath(),s.moveTo(T[0],T[1]),s.lineTo(S[0],S[1]),s.stroke(),s.beginPath(),s.arc(S[0],S[1],4,0,Ge),s.fill(),s.beginPath(),s.arc(T[0],T[1],3,0,Ge),s.fill(),s.lineWidth=1;let I=this.normal(0,n),b=_/Ge;if(s.font=`11px ${dt}`,s.fillStyle=de.ink2,s.fillText(`沿中线走了 ${b.toFixed(2)} 圈`,12,20),Math.abs(b-1)<.08||Math.abs(b-2)<.08){let R=M[0]*I[0]+M[1]*I[1]+M[2]*I[2]>0;s.fillStyle=R?de.acid:de.signal,s.fillText(R?"法向量回到原样":"法向量反过来了！",12,38)}s.fillStyle=de.ink3,s.fillText(n>.5?"一个面 · 不可定向 · χ = 0":"两个面 · 可定向 · χ = 0",12,o-14)}};var xn=12,P0=class extends Ct{init(){this.get2d(),this.rate=14,this.reset(),this.controls([{type:"range",label:"速率",min:2,max:60,step:1,value:this.rate,onInput:e=>{this.rate=e}},{type:"button",label:"清空",onClick:()=>this.reset()}])}reset(){this.balls=[],this.bins=new Array(xn+1).fill(0),this.total=0,this.acc=0,this.sum=0,this.sum2=0}frame(e){let t=this.ctx,n=this.w,r=this.h;t.clearRect(0,0,n,r);let s=26,a=r*.5/xn,o=Math.min(n/(xn+3),a*1.25),l=n/2,c=s+a*(xn+.6),h=r-18;for(this.acc+=e*this.rate;this.acc>1&&this.balls.length<400;)this.acc-=1,this.balls.push({row:0,k:0,t:0,dir:Math.random()<.5?0:1,speed:3.2+Math.random()*.8});t.fillStyle=de.ink3;for(let p=0;p<xn;p++)for(let _=0;_<=p;_++)t.beginPath(),t.arc(l+(_-p/2)*o,s+(p+.5)*a,1.8,0,Ge),t.fill();let d=Math.max(8,...this.bins),u=o*.86;for(let p=0;p<=xn;p++){let _=l+(p-xn/2)*o,A=this.bins[p]/d*(h-c);t.fillStyle="rgba(255,91,31,0.7)",t.fillRect(_-u/2,h-A,u,A)}if(this.total>0){let p=(_,A)=>{let M=1;for(let T=1;T<=A;T++)M=M*(_-T+1)/T;return M};t.strokeStyle=de.acid,t.lineWidth=1.5,t.beginPath();for(let _=0;_<=200;_++){let A=_/200*xn,M=Math.exp(-((A-xn/2)**2)/(2*(xn/4)))/Math.sqrt(Ge*(xn/4)),T=h-M*this.total/d*(h-c),S=l+(A-xn/2)*o;_?t.lineTo(S,T):t.moveTo(S,T)}t.stroke(),t.fillStyle=de.ion;for(let _=0;_<=xn;_++){let A=p(xn,_)/4096*this.total,M=h-A/d*(h-c);t.fillRect(l+(_-xn/2)*o-u/2,M-1,u,2)}t.lineWidth=1}t.fillStyle="#fff";let f=[];for(let p of this.balls){for(p.t+=e*p.speed;p.t>=1&&p.row<xn;)p.t-=1,p.k+=p.dir,p.row++,p.dir=Math.random()<.5?0:1;if(p.row>=xn){this.bins[p.k]++,this.total++,this.sum+=p.k,this.sum2+=p.k*p.k;continue}let _=l+(p.k-p.row/2)*o,A=l+(p.k+p.dir-(p.row+1)/2)*o,M=_+(A-_)*p.t,T=s+(p.row+.5)*a+a*p.t-Math.sin(Math.PI*p.t)*a*.45;t.beginPath(),t.arc(M,T-5,2.6,0,Ge),t.fill(),f.push(p)}this.balls=f;let g=this.total,v=g?this.sum/g:0,m=g?this.sum2/g-v*v:0;t.font=`11px ${dt}`,t.fillStyle=de.ink2,t.fillText(`N = ${g}   均值 ${v.toFixed(2)} (理论 ${xn/2})   方差 ${m.toFixed(2)} (理论 ${xn/4})`,12,16)}};var z0=class extends Ct{init(){this.get2d(),this.p=2,this.reveal=0,this.hoverCell=null,this.build(),this.controls([{type:"chips",value:2,items:[2,3,5,7].map(e=>({label:`p = ${e}`,value:e})),onChange:e=>{this.p=e,this.build()}}]),this.pointer({hover:(e,t)=>{this.hoverCell=this.cellAt(e,t)},leave:()=>{this.hoverCell=null}})}build(){let e=this.p,t=1;for(;t*e<=130;)t*=e;this.N=t,this.rows=[];let n=[1];for(let r=0;r<this.N;r++){this.rows.push(n);let s=[1];for(let a=1;a<n.length;a++)s.push((n[a-1]+n[a])%e);s.push(1),n=s}this.reveal=0}geom(){let e=this.N,t=this.w,n=this.h;return{cell:Math.min((t-16)/e,(n-40)/(e*.866)),x0:t/2,y0:30}}cellAt(e,t){let{cell:n,x0:r,y0:s}=this.geom(),a=Math.floor((t-s)/(n*.866));if(a<0||a>=this.N)return null;let o=Math.round((e-r)/n+a/2);return o<0||o>a?null:[a,o]}frame(e){this.reveal=Math.min(this.N,this.reveal+e*this.N*.45);let t=this.ctx,n=this.w,r=this.h,s=this.p;t.clearRect(0,0,n,r);let{cell:a,x0:o,y0:l}=this.geom(),c=Math.floor(this.reveal),h=["","#ff5b1f","#4fe3ff","#9b7bff","#d4ff3a","#ffb38f","#b9f5ff"];for(let d=0;d<c;d++){let u=this.rows[d],f=l+d*a*.866;for(let g=0;g<=d;g++){let v=u[g];v&&(t.fillStyle=h[v]||de.ink,t.fillRect(o+(g-d/2)*a-a/2,f,Math.max(1,a*.92),Math.max(1,a*.8)))}}if(t.font=`11px ${dt}`,t.fillStyle=de.ink2,t.fillText(`前 ${this.N} 行 · 着色 = C(n,k) mod ${s}，黑色 = 被 ${s} 整除`,12,16),this.hoverCell){let[d,u]=this.hoverCell,f=_=>{let A=[];do A.push(_%s),_=Math.floor(_/s);while(_);return A},g=f(d),v=f(u),m=g.length,p=_=>_.concat(new Array(m-_.length).fill(0)).reverse().join("");t.fillStyle=de.ink,t.fillText(`C(${d}, ${u}) ≡ ${this.rows[d][u]} (mod ${s})   n = ${p(g)}₍${s}₎  k = ${p(v)}₍${s}₎`,12,r-12),t.strokeStyle="#fff",t.strokeRect(o+(u-d/2)*a-a/2-1,l+d*a*.866-1,a+2,a*.8+2)}}};var ta=9.81;function L0(i,e,t){let n=i[e],r=i[e+1],s=i[e+2],a=i[e+3],o=r-n,l=Math.cos(o),c=Math.sin(o),h=2-l*l;t[0]=s,t[1]=a,t[2]=(s*s*c*l+ta*Math.sin(r)*l+a*a*c-2*ta*Math.sin(n))/h,t[3]=(-a*a*c*l+2*(ta*Math.sin(n)*l-s*s*c-ta*Math.sin(r)))/h}var K1=(i,e,t,n)=>t*t+.5*n*n+t*n*Math.cos(i-e)-2*ta*Math.cos(i)-ta*Math.cos(e),D0=class extends Ct{init(){this.get2d(),this.n=200,this.delta=1e-4,this.reset(),this.controls([{type:"chips",value:200,items:[{label:"50 个",value:50},{label:"200 个",value:200},{label:"600 个",value:600}],onChange:e=>{this.n=e,this.reset()}},{type:"chips",value:1e-4,items:[{label:"δ = 10⁻⁴",value:1e-4},{label:"δ = 10⁻⁷",value:1e-7}],onChange:e=>{this.delta=e,this.reset()}},{type:"button",label:"重新释放",onClick:()=>this.reset()}])}reset(){let e=this.n;this.s=new Float64Array(e*4),this.e0=new Float64Array(e);for(let t=0;t<e;t++){let n=2.2+t*this.delta,r=2.2+t*this.delta;this.s.set([n,r,0,0],t*4),this.e0[t]=K1(n,r,0,0)}this.t=0,this.k=[new Float64Array(4),new Float64Array(4),new Float64Array(4),new Float64Array(4)],this.tmp=new Float64Array(4),this.clear=!0,this.readout("n",String(e))}step(e){let t=this.s,[n,r,s,a]=this.k,o=this.tmp;for(let l=0;l<this.n;l++){let c=l*4;L0(t,c,n);for(let h=0;h<4;h++)o[h]=t[c+h]+e/2*n[h];L0(o,0,r);for(let h=0;h<4;h++)o[h]=t[c+h]+e/2*r[h];L0(o,0,s);for(let h=0;h<4;h++)o[h]=t[c+h]+e*s[h];L0(o,0,a);for(let h=0;h<4;h++)t[c+h]+=e/6*(n[h]+2*r[h]+2*s[h]+a[h])}this.t+=e}frame(e){let n=Math.min(e,.03333333333333333)/6;for(let v=0;v<6;v++)this.step(n);let r=this.ctx,s=this.w,a=this.h;this.clear&&(r.clearRect(0,0,s,a),this.clear=!1),r.globalCompositeOperation="destination-out",r.fillStyle="rgba(0,0,0,0.16)",r.fillRect(0,0,s,a),r.globalCompositeOperation="lighter";let o=Math.min(s,a)*.22,l=s/2,c=a*.44,h=this.s,d=this.n,u=Math.min(.5,30/d+.05),f=0,g=0;for(let v=0;v<d;v++){let m=h[v*4],p=h[v*4+1],_=l+o*Math.sin(m),A=c+o*Math.cos(m),M=_+o*Math.sin(p),T=A+o*Math.cos(p),S=18+v/d*200;r.strokeStyle=`hsla(${S}, 95%, 60%, ${u})`,r.lineWidth=1.4,r.beginPath(),r.moveTo(l,c),r.lineTo(_,A),r.lineTo(M,T),r.stroke();let I=Math.abs(Math.atan2(Math.sin(p-h[1]),Math.cos(p-h[1])));I>f&&(f=I);let b=Math.abs(K1(m,p,h[v*4+2],h[v*4+3])-this.e0[v])/Math.abs(this.e0[v]||1);b>g&&(g=b)}r.globalCompositeOperation="source-over",r.fillStyle="#fff",r.beginPath(),r.arc(l,c,3,0,Ge),r.fill(),r.clearRect(8,6,230,18),r.font=`11px ${dt}`,r.fillStyle=de.ink2,r.fillText(`t = ${this.t.toFixed(2)} s   N = ${d}   δ = ${this.delta.toExponential(0)} rad`,12,19),Math.floor(this.t*10)!==this._lastR&&(this._lastR=Math.floor(this.t*10),this.readout("t",`${this.t.toFixed(1)} s`),this.readout("spread",`${(f*180/Math.PI).toFixed(1)}°`),this.readout("energy",g.toExponential(1))),this.t>40&&this.reset()}};var N0=class extends Ct{init(){this.get2d(),this.mode="static",this.charges=[{x:-.32,y:0,q:1},{x:.32,y:0,q:-1}],this.particles=[],this.dirty=!0,this.controls([{type:"chips",value:"static",items:[{label:"静电场",value:"static"},{label:"偶极辐射",value:"dipole"}],onChange:t=>{this.mode=t,this.dirty=!0}},{type:"button",label:"＋ 正电荷",onClick:()=>this.add(1)},{type:"button",label:"－ 负电荷",onClick:()=>this.add(-1)},{type:"button",label:"重置",onClick:()=>{this.charges=[{x:-.32,y:0,q:1},{x:.32,y:0,q:-1}],this.dirty=!0}}]);let e=null;this.pointer({down:(t,n)=>{if(this.mode!=="static")return!1;let[r,s]=this.toWorld(t,n);return e=this.charges.find(a=>Math.hypot(a.x-r,a.y-s)<.07),!!e},move:(t,n)=>{let[r,s]=this.toWorld(t,n);e.x=r,e.y=s,this.dirty=!0},up:()=>{e=null}})}add(e){this.charges.length>=6&&this.charges.shift(),this.charges.push({x:(Math.random()-.5)*.8,y:(Math.random()-.5)*.5,q:e}),this.dirty=!0}get S(){return Math.min(this.w,this.h*1.45)}toWorld(e,t){return[(e-this.w/2)/this.S,(t-this.h/2)/this.S]}toScreen(e,t){return[this.w/2+e*this.S,this.h/2+t*this.S]}E(e,t){let n=0,r=0,s=0;for(let a of this.charges){let o=e-a.x,l=t-a.y,c=o*o+l*l+1e-5,h=Math.sqrt(c);n+=a.q*o/(c*h),r+=a.q*l/(c*h),s+=a.q/h}return[n,r,s]}onResize(){this.dirty=!0}buildStatic(){let t=Math.max(40,Math.round(120*this.h/this.w)),n=new ImageData(120,t);for(let s=0;s<t;s++)for(let a=0;a<120;a++){let[o,l]=this.toWorld((a+.5)/120*this.w,(s+.5)/t*this.h),c=this.E(o,l)[2],h=Math.abs((c*.6%1+1)%1-.5)*2,d=Math.tanh(c*.25),u=(s*120+a)*4,f=14+h*10;n.data[u]=f+Math.max(0,d)*70,n.data[u+1]=f+6,n.data[u+2]=f+Math.max(0,-d)*80+6,n.data[u+3]=255}this.bg=document.createElement("canvas"),this.bg.width=120,this.bg.height=t,this.bg.getContext("2d").putImageData(n,0,0);let r=this.charges.some(s=>s.q>0)?this.charges.filter(s=>s.q>0):this.charges;this.lines=[];for(let s of r)for(let o=0;o<18;o++){let l=o/18*Ge+.1,c=s.x+Math.cos(l)*.012,h=s.y+Math.sin(l)*.012,d=[[c,h]],u=s.q>0?1:-1;for(let f=0;f<900;f++){let[g,v]=this.E(c,h),m=Math.hypot(g,v)||1,p=.004,_=c+u*(g/m)*p*.5,A=h+u*(v/m)*p*.5;if([g,v]=this.E(_,A),m=Math.hypot(g,v)||1,c+=u*(g/m)*p,h+=u*(v/m)*p,d.push([c,h]),Math.abs(c)>1.2||Math.abs(h)>.9||this.charges.some(M=>M.q*s.q<0&&Math.hypot(M.x-c,M.y-h)<.01))break}this.lines.push(d)}this.particles=[]}drawStatic(e){let t=this.ctx;t.imageSmoothingEnabled=!0,t.drawImage(this.bg,0,0,this.w,this.h),t.lineWidth=1;for(let n of this.lines)t.strokeStyle="rgba(236,232,225,0.42)",t.beginPath(),n.forEach(([r,s],a)=>{let[o,l]=this.toScreen(r,s);a?t.lineTo(o,l):t.moveTo(o,l)}),t.stroke();for(;this.particles.length<120&&this.lines.length;){let n=this.lines[Math.random()*this.lines.length|0];this.particles.push({line:n,i:Math.random()*n.length})}t.fillStyle=de.acid;for(let n of this.particles){n.i+=e*110,n.i>=n.line.length-1&&(n.i=0,n.line=this.lines[Math.random()*this.lines.length|0]);let[r,s]=n.line[Math.floor(n.i)],[a,o]=this.toScreen(r,s);t.fillRect(a-1,o-1,2,2)}for(let n of this.charges){let[r,s]=this.toScreen(n.x,n.y);t.fillStyle=n.q>0?de.signal:de.ion,t.beginPath(),t.arc(r,s,11,0,Ge),t.fill(),t.fillStyle="#000",t.font=`bold 14px ${dt}`,t.textAlign="center",t.textBaseline="middle",t.fillText(n.q>0?"+":"−",r,s+.5),t.textAlign="left",t.textBaseline="alphabetic"}t.font=`11px ${dt}`,t.fillStyle=de.ink2,t.fillText("拖动电荷 · 线 = 电场线 · 明暗 = 电势",12,18)}drawDipole(e){let t=this.ctx,n=this.w,r=this.h;t.fillStyle=de.bg,t.fillRect(0,0,n,r);let s=170,a=Math.max(60,Math.round(s*r/n)),l=22/(n/2),c=e*1.6,h=new Float32Array((s+1)*(a+1));for(let p=0;p<=a;p++)for(let _=0;_<=s;_++){let A=(_/s-.5)*n*l,M=(p/a-.5)*r*l,T=Math.hypot(A,M)+1e-6,S=A*A/(T*T);h[p*(s+1)+_]=T<.9?NaN:S*(Math.cos(T-c)/T-Math.sin(T-c))}let d=n/s,u=r/a,f=[-.9,-.6,-.3,-.1,.1,.3,.6,.9];t.lineWidth=1.3;for(let p of f){t.strokeStyle=p>0?"rgba(255,91,31,0.85)":"rgba(79,227,255,0.85)",t.beginPath();for(let _=0;_<a;_++)for(let A=0;A<s;A++){let M=h[_*(s+1)+A],T=h[_*(s+1)+A+1],S=h[(_+1)*(s+1)+A+1],I=h[(_+1)*(s+1)+A];if(!(M===M&&T===T&&S===S&&I===I))continue;let b=(M>p?8:0)|(T>p?4:0)|(S>p?2:0)|(I>p?1:0);if(b===0||b===15)continue;let R=A*d,L=_*u,N=(J,re)=>(p-J)/(re-J),U=[R+N(M,T)*d,L],W=[R+d,L+N(T,S)*u],F=[R+N(I,S)*d,L+u],q=[R,L+N(M,I)*u],Z=(J,re)=>{t.moveTo(J[0],J[1]),t.lineTo(re[0],re[1])};switch(b){case 1:case 14:Z(q,F);break;case 2:case 13:Z(F,W);break;case 3:case 12:Z(q,W);break;case 4:case 11:Z(U,W);break;case 6:case 9:Z(U,F);break;case 7:case 8:Z(q,U);break;case 5:Z(q,U),Z(F,W);break;case 10:Z(U,W),Z(q,F);break}}t.stroke()}let g=n/2,v=r/2,m=Math.cos(c)*10;t.strokeStyle=de.ink3,t.beginPath(),t.moveTo(g,v-14),t.lineTo(g,v+14),t.stroke(),t.fillStyle=m>0?de.signal:de.ion,t.beginPath(),t.arc(g,v-Math.abs(m)-2,4,0,Ge),t.fill(),t.fillStyle=m>0?de.ion:de.signal,t.beginPath(),t.arc(g,v+Math.abs(m)+2,4,0,Ge),t.fill(),t.font=`11px ${dt}`,t.fillStyle=de.ink2,t.fillText("振荡偶极子 · 子午面内的电场线 · 一个格 = 1/k",12,18),t.fillStyle=de.ink3,t.fillText(`λ = 2π/k ≈ ${(Ge/l).toFixed(0)} px`,12,r-12)}frame(e,t){this.mode==="static"?(this.dirty&&(this.dirty=!1,this.buildStatic()),this.drawStatic(e)):this.drawDipole(t)}};function Id(i){let e=Math.log2(i);if(!Number.isInteger(e))throw new Error("FFT size must be a power of two");let t=new Uint32Array(i);for(let s=0;s<i;s++){let a=0;for(let o=0;o<e;o++)a|=(s>>o&1)<<e-1-o;t[s]=a}let n=new Float64Array(i/2),r=new Float64Array(i/2);for(let s=0;s<i/2;s++)n[s]=Math.cos(2*Math.PI*s/i),r[s]=Math.sin(2*Math.PI*s/i);return function(a,o,l=!1,c=0,h=1){for(let u=0;u<i;u++){let f=t[u];if(f>u){let g=c+u*h,v=c+f*h,m=a[g];a[g]=a[v],a[v]=m,m=o[g],o[g]=o[v],o[v]=m}}let d=l?1:-1;for(let u=2;u<=i;u<<=1){let f=u>>1,g=i/u;for(let v=0;v<i;v+=u)for(let m=0,p=0;m<f;m++,p+=g){let _=c+(v+m)*h,A=c+(v+m+f)*h,M=n[p],T=d*r[p],S=a[A]*M-o[A]*T,I=a[A]*T+o[A]*M;a[A]=a[_]-S,o[A]=o[_]-I,a[_]+=S,o[_]+=I}}if(l)for(let u=0;u<i;u++){let f=c+u*h;a[f]/=i,o[f]/=i}}}var cn=1024,cs=240,lr=128,cr=64;function Z1(i,e){let t=Math.atan2(e,i)/Ge;return[.5+.5*Math.cos(Ge*t),.5+.5*Math.cos(Ge*(t+.667)),.5+.5*Math.cos(Ge*(t+.333))]}var F0=class extends Ct{init(){this.get2d(),this.mode="1d",this.V0=1.4,this.k0=1.6,this.fft1=Id(cn),this.fft2=Id(lr),this.reset(),this.controls([{type:"chips",value:"1d",items:[{label:"一维 · 隧穿",value:"1d"},{label:"二维 · 双缝",value:"2d"}],onChange:e=>{this.mode=e,this.reset()}},{type:"range",label:"V₀",min:.4,max:2.6,step:.05,value:this.V0,format:e=>e.toFixed(2),onInput:e=>{this.V0=e,this.mode==="1d"&&this.reset()}},{type:"button",label:"重新发射",onClick:()=>this.reset()}]),this.pointer({down:()=>(this.reset(),!1)})}reset(){this.t=0,this.absL=0,this.absR=0,this.mode==="1d"?this.reset1d():this.reset2d()}reset1d(){let e=cs/cn;this.re=new Float64Array(cn),this.im=new Float64Array(cn),this.V=new Float64Array(cn),this.mask=new Float64Array(cn);let t=70,n=6,r=this.k0;this.bx0=118,this.bx1=120;let s=0;for(let o=0;o<cn;o++){let l=o*e,c=Math.exp(-((l-t)**2)/(4*n*n));this.re[o]=c*Math.cos(r*l),this.im[o]=c*Math.sin(r*l),s+=c*c*e,this.V[o]=l>=this.bx0&&l<this.bx1?this.V0:0;let h=Math.min(l,cs-l);this.mask[o]=h<22?Math.pow(Math.sin(Math.PI/2*(h/22)),.12):1}let a=1/Math.sqrt(s);for(let o=0;o<cn;o++)this.re[o]*=a,this.im[o]*=a;this.kk=new Float64Array(cn);for(let o=0;o<cn;o++){let l=o<cn/2?o:o-cn;this.kk[o]=Ge*l/cs}this.dt=.06,this.prep1d()}prep1d(){let e=this.dt;this.vr=Float64Array.from(this.V,t=>Math.cos(-t*e/2)),this.vi=Float64Array.from(this.V,t=>Math.sin(-t*e/2)),this.kr=Float64Array.from(this.kk,t=>Math.cos(-t*t*e/2)),this.ki=Float64Array.from(this.kk,t=>Math.sin(-t*t*e/2))}step1d(){let e=this.re,t=this.im,n=cn,r=cs/cn;for(let s=0;s<n;s++){let a=e[s],o=t[s];e[s]=a*this.vr[s]-o*this.vi[s],t[s]=a*this.vi[s]+o*this.vr[s]}this.fft1(e,t,!1);for(let s=0;s<n;s++){let a=e[s],o=t[s];e[s]=a*this.kr[s]-o*this.ki[s],t[s]=a*this.ki[s]+o*this.kr[s]}this.fft1(e,t,!0);for(let s=0;s<n;s++){let a=e[s],o=t[s];e[s]=a*this.vr[s]-o*this.vi[s],t[s]=a*this.vi[s]+o*this.vr[s]}for(let s=0;s<n;s++){let a=this.mask[s];if(a<1){let l=(e[s]*e[s]+t[s]*t[s])*r*(1-a*a);s*r<cs/2?this.absL+=l:this.absR+=l,e[s]*=a,t[s]*=a}}this.t+=this.dt}draw1d(){let e=this.ctx,t=this.w,n=this.h,r=cs/cn;e.fillStyle=de.bg,e.fillRect(0,0,t,n);let s=n*.78,a=n*2.6,o=m=>m/cs*t,l=this.V0/(this.k0*this.k0/2)*n*.22;e.fillStyle="rgba(255,91,31,0.22)",e.strokeStyle=de.signal,e.fillRect(o(this.bx0),s-l,o(this.bx1)-o(this.bx0),l),e.strokeRect(o(this.bx0),s-l,o(this.bx1)-o(this.bx0),l);let c=n*.22;e.strokeStyle=de.ink3,e.setLineDash([4,5]),e.beginPath(),e.moveTo(0,s-c),e.lineTo(t,s-c),e.stroke(),e.setLineDash([]),e.font=`10px ${dt}`,e.fillStyle=de.ink3,e.fillText("⟨E⟩ = k₀²/2",8,s-c-5),e.fillStyle=de.signal,e.fillText(`V₀ = ${this.V0.toFixed(2)}`,o(this.bx1)+6,s-l+10);let h=Math.max(1,Math.floor(cn/t));for(let m=0;m<cn;m+=h){let p=this.re[m]**2+this.im[m]**2,[_,A,M]=Z1(this.re[m],this.im[m]);e.fillStyle=`rgb(${_*255|0},${A*255|0},${M*255|0})`;let T=o(m*r),S=p*a;e.fillRect(T,s-S,Math.max(1,t/cn*h+.5),S)}e.strokeStyle="rgba(236,232,225,0.55)",e.beginPath();for(let m=0;m<cn;m+=h){let p=o(m*r),_=s-this.re[m]*Math.sqrt(a)*3.2;m?e.lineTo(p,_):e.moveTo(p,_)}e.stroke(),e.strokeStyle=de.line,e.beginPath(),e.moveTo(0,s),e.lineTo(t,s),e.stroke();let d=0,u=0,f=(this.bx0+this.bx1)/2;for(let m=0;m<cn;m++){let p=(this.re[m]**2+this.im[m]**2)*r;m*r<f?d+=p:u+=p}let g=u+this.absR,v=d+this.absL;e.fillStyle=de.ink2,e.font=`11px ${dt}`,e.fillText(`t = ${this.t.toFixed(1)}   k₀ = ${this.k0}   点击画面重新发射`,12,18),this.t>.5&&(this.readout("T",`${(g*100).toFixed(1)}%`),this.readout("R",`${(v*100).toFixed(1)}%`),this.readout("norm",(g+v).toFixed(4))),this.t>110&&this.reset()}reset2d(){let e=lr,t=cr/e;this.re=new Float64Array(e*e),this.im=new Float64Array(e*e),this.V=new Float64Array(e*e),this.mask=new Float64Array(e*e);let n=14,r=cr/2,s=3.2,a=2.4;this.wall=26,this.wallW=1.2,this.slitHalf=1.1,this.sep=7;let o=0;for(let h=0;h<e;h++)for(let d=0;d<e;d++){let u=d*t,f=h*t,g=h*e+d,v=Math.exp(-((u-n)**2+(f-r)**2)/(4*s*s));this.re[g]=v*Math.cos(a*u),this.im[g]=v*Math.sin(a*u),o+=v*v*t*t;let m=u>=this.wall&&u<this.wall+this.wallW,p=Math.abs(Math.abs(f-r)-this.sep/2)<this.slitHalf;this.V[g]=m&&!p?60:0;let _=Math.min(u,cr-u,f,cr-f);this.mask[g]=_<7?Math.pow(Math.sin(Math.PI/2*(_/7)),.2):1}let l=1/Math.sqrt(o);for(let h=0;h<e*e;h++)this.re[h]*=l,this.im[h]*=l;this.dt=.05;let c=new Float64Array(e);for(let h=0;h<e;h++){let d=h<e/2?h:h-e;c[h]=Ge*d/cr}this.vr=Float64Array.from(this.V,h=>Math.cos(-h*this.dt/2)),this.vi=Float64Array.from(this.V,h=>Math.sin(-h*this.dt/2)),this.kr=new Float64Array(e*e),this.ki=new Float64Array(e*e);for(let h=0;h<e;h++)for(let d=0;d<e;d++){let u=(c[d]**2+c[h]**2)/2;this.kr[h*e+d]=Math.cos(-u*this.dt),this.ki[h*e+d]=Math.sin(-u*this.dt)}this.img=new ImageData(e,e),this.off=document.createElement("canvas"),this.off.width=e,this.off.height=e}fft2d(e){let t=lr;for(let n=0;n<t;n++)this.fft2(this.re,this.im,e,n*t,1);for(let n=0;n<t;n++)this.fft2(this.re,this.im,e,n,t)}step2d(){let e=this.re,t=this.im,n=lr*lr,r=(cr/lr)**2,s=()=>{for(let a=0;a<n;a++){let o=e[a],l=t[a];e[a]=o*this.vr[a]-l*this.vi[a],t[a]=o*this.vi[a]+l*this.vr[a]}};s(),this.fft2d(!1);for(let a=0;a<n;a++){let o=e[a],l=t[a];e[a]=o*this.kr[a]-l*this.ki[a],t[a]=o*this.ki[a]+l*this.kr[a]}this.fft2d(!0),s();for(let a=0;a<n;a++){let o=this.mask[a];if(o<1){let l=(e[a]**2+t[a]**2)*r*(1-o*o);a%lr*(cr/lr)>this.wall?this.absR+=l:this.absL+=l,e[a]*=o,t[a]*=o}}this.t+=this.dt}draw2d(){let e=this.ctx,t=this.w,n=this.h,r=lr,s=this.img.data,a=1e-9;for(let h=0;h<r*r;h++)a=Math.max(a,this.re[h]**2+this.im[h]**2);for(let h=0;h<r*r;h++){let d=(this.re[h]**2+this.im[h]**2)/a,u=Math.pow(d,.42),[f,g,v]=Z1(this.re[h],this.im[h]),m=h*4,p=this.V[h]>0;s[m]=p?120:f*u*255,s[m+1]=p?40:g*u*255,s[m+2]=p?20:v*u*255,s[m+3]=255}this.off.getContext("2d").putImageData(this.img,0,0),e.fillStyle=de.bg,e.fillRect(0,0,t,n);let o=Math.min(t,n);e.imageSmoothingEnabled=!0,e.drawImage(this.off,(t-o)/2,(n-o)/2,o,o),e.strokeStyle=de.line,e.strokeRect((t-o)/2+.5,(n-o)/2+.5,o-1,o-1);let l=0,c=(cr/r)**2;for(let h=0;h<r;h++)for(let d=0;d<r;d++)d*(cr/r)>this.wall&&(l+=(this.re[h*r+d]**2+this.im[h*r+d]**2)*c);e.fillStyle=de.ink2,e.font=`11px ${dt}`,e.fillText(`t = ${this.t.toFixed(1)}   128×128 网格 · 双缝间距 7 · 点击重新发射`,12,18),this.t>.5&&(this.readout("T",`${((l+this.absR)*100).toFixed(1)}%`),this.readout("R","—"),this.readout("norm","—")),this.t>34&&this.reset()}frame(){if(this.mode==="1d"){for(let e=0;e<3;e++)this.step1d();this.draw1d()}else{for(let e=0;e<2;e++)this.step2d();this.draw2d()}}};var pt=16;function Q_(i,e){let t=[];for(let r=0;r<2;r++)for(let s=0;s<150;s++){let a,o;if(i==="spiral"){let l=.08+s/150*.92,c=l*2.6*Math.PI+r*Math.PI;a=l*Math.cos(c)*.95+wt(e)*.035,o=l*Math.sin(c)*.95+wt(e)*.035}else if(i==="circle"){let l=r?Math.sqrt(e())*.42:.6+e()*.35,c=e()*Ge;a=l*Math.cos(c),o=l*Math.sin(c)}else if(i==="xor"){a=(e()*.85+.08)*(e()<.5?-1:1),o=(e()*.85+.08)*(e()<.5?-1:1),t.push([a,o,a*o>0?1:0]);continue}else{let l=s/150*Math.PI;a=r?Math.cos(l)*.6-.3:.3-Math.cos(l)*.6,o=r?Math.sin(l)*.6-.15:.15-Math.sin(l)*.6,a+=wt(e)*.06,o+=wt(e)*.06}t.push([a,o,r])}return t}var Pd=class{constructor(e){let t=gn(e),n=(r,s,a)=>Float64Array.from({length:r},()=>wt(t)*Math.sqrt(2/(s+a)));this.p={W1:n(pt*2,2,pt),b1:new Float64Array(pt),W2:n(pt*pt,pt,pt),b2:new Float64Array(pt),W3:n(pt,pt,1),b3:new Float64Array(1)},this.m={},this.v={};for(let r in this.p)this.m[r]=new Float64Array(this.p[r].length),this.v[r]=new Float64Array(this.p[r].length);this.t=0,this.a1=new Float64Array(pt),this.a2=new Float64Array(pt)}forward(e,t,n){let{W1:r,b1:s,W2:a,b2:o,W3:l,b3:c}=this.p,h=n?n.a1:this.a1,d=n?n.a2:this.a2;for(let f=0;f<pt;f++)h[f]=Math.tanh(r[f*2]*e+r[f*2+1]*t+s[f]);for(let f=0;f<pt;f++){let g=o[f];for(let v=0;v<pt;v++)g+=a[f*pt+v]*h[v];d[f]=Math.tanh(g)}let u=c[0];for(let f=0;f<pt;f++)u+=l[f]*d[f];return 1/(1+Math.exp(-u))}step(e,t=.02){let{W2:n,W3:r}=this.p,s={};for(let m in this.p)s[m]=new Float64Array(this.p[m].length);let a=new Float64Array(pt),o=new Float64Array(pt),l=new Float64Array(pt),c=new Float64Array(pt),h=0,d=0,u=e.length;for(let[m,p,_]of e){let A=this.forward(m,p,{a1:a,a2:o});h+=-(_*Math.log(A+1e-12)+(1-_)*Math.log(1-A+1e-12)),(A>.5?1:0)===_&&d++;let M=(A-_)/u;s.b3[0]+=M;for(let T=0;T<pt;T++)s.W3[T]+=M*o[T],l[T]=M*r[T]*(1-o[T]*o[T]);for(let T=0;T<pt;T++){s.b2[T]+=l[T];for(let S=0;S<pt;S++)s.W2[T*pt+S]+=l[T]*a[S]}for(let T=0;T<pt;T++){let S=0;for(let I=0;I<pt;I++)S+=n[I*pt+T]*l[I];c[T]=S*(1-a[T]*a[T])}for(let T=0;T<pt;T++)s.W1[T*2]+=c[T]*m,s.W1[T*2+1]+=c[T]*p,s.b1[T]+=c[T]}this.t++;let f=.9,g=.999,v=1e-8;for(let m in this.p){let p=this.p[m],_=this.m[m],A=this.v[m],M=s[m];for(let T=0;T<p.length;T++){_[T]=f*_[T]+(1-f)*M[T],A[T]=g*A[T]+(1-g)*M[T]*M[T];let S=_[T]/(1-f**this.t),I=A[T]/(1-g**this.t);p[T]-=t*S/(Math.sqrt(I)+v)}}return{loss:h/u,acc:d/u}}},U0=class extends Ct{init(){this.get2d(),this.name="spiral",this.seed=1,this.paused=!1,this.reset(),this.controls([{type:"chips",value:"spiral",items:[{label:"双螺旋",value:"spiral"},{label:"同心圆",value:"circle"},{label:"异或",value:"xor"},{label:"双月",value:"moons"}],onChange:e=>{this.name=e,this.reset()}},{type:"button",label:"重新初始化",onClick:()=>{this.seed++,this.reset()}},{type:"button",label:"暂停 / 继续",onClick:()=>{this.paused=!this.paused}}]),this.probe=null,this.pointer({hover:(e,t)=>{this.probe=this.toData(e,t)},leave:()=>{this.probe=null}})}reset(){this.data=Q_(this.name,gn(7+this.name.length)),this.net=new Pd(this.seed*97+this.name.length),this.hist=[],this.stats={loss:NaN,acc:0},this.frameN=0,this.grid=46,this.heat=new ImageData(this.grid,this.grid),this.off=document.createElement("canvas"),this.off.width=this.off.height=this.grid}layout(){let e=this.w>this.h*1.25,t=e?this.h-24:Math.min(this.w,this.h)-24;return{wide:e,side:t,x0:12,y0:12}}toData(e,t){let{side:n,x0:r,y0:s}=this.layout(),a=(e-r)/n*2-1,o=-((t-s)/n*2-1);return Math.abs(a)<=1&&Math.abs(o)<=1?[a,o]:null}frame(){if(!this.paused&&this.net.t<6e3){for(let l=0;l<8;l++)this.stats=this.net.step(this.data);this.net.t%16===0&&this.hist.push(this.stats.loss)}this.frameN++;let e=this.ctx,t=this.w,n=this.h,{wide:r,side:s,x0:a,y0:o}=this.layout();if(e.clearRect(0,0,t,n),this.frameN%3===1){let l=this.grid,c=this.heat.data;for(let h=0;h<l;h++)for(let d=0;d<l;d++){let u=this.net.forward(d/(l-1)*2-1,-(h/(l-1)*2-1)),f=(h*l+d)*4,g=Math.abs(u-.5)*2;c[f]=20+(u>.5?235*g:59*g),c[f+1]=20+(u>.5?71*g:207*g),c[f+2]=26+(u>.5?11*g:229*g),c[f+3]=255}this.off.getContext("2d").putImageData(this.heat,0,0)}e.globalAlpha=.55,e.imageSmoothingEnabled=!0,e.drawImage(this.off,a,o,s,s),e.globalAlpha=1,e.strokeStyle=de.line,e.strokeRect(a+.5,o+.5,s,s);for(let[l,c,h]of this.data){let d=a+(l+1)/2*s,u=o+(1-c)/2*s;e.fillStyle=h?de.signal:de.ion,e.beginPath(),e.arc(d,u,2.6,0,Ge),e.fill(),e.strokeStyle="rgba(0,0,0,0.6)",e.stroke()}if(r){let l=a+s+26,c=t-l-16,h=this.probe||[Math.cos(this.time*.6)*.6,Math.sin(this.time*.6)*.6],d=new Float64Array(pt),u=new Float64Array(pt),f=this.net.forward(h[0],h[1],{a1:d,a2:u}),g=a+(h[0]+1)/2*s,v=o+(1-h[1])/2*s;e.strokeStyle="#fff",e.beginPath(),e.arc(g,v,6,0,Ge),e.stroke();let m=[2,pt,pt,1].map((S,I)=>Array.from({length:S},(b,R)=>[l+I/3*c,o+20+(R+.5)/S*(s-40)])),p=[[h[0],h[1]],d,u,[f*2-1]],{W1:_,W2:A,W3:M}=this.net.p,T=[(S,I)=>_[S*2+I],(S,I)=>A[S*pt+I],(S,I)=>M[I]];for(let S=0;S<3;S++)for(let I=0;I<m[S+1].length;I++)for(let b=0;b<m[S].length;b++){let R=T[S](I,b);e.strokeStyle=R>0?`rgba(255,91,31,${Math.min(.7,Math.abs(R)*.35)})`:`rgba(79,227,255,${Math.min(.7,Math.abs(R)*.35)})`,e.beginPath(),e.moveTo(...m[S][b]),e.lineTo(...m[S+1][I]),e.stroke()}m.forEach((S,I)=>S.forEach(([b,R],L)=>{let N=p[I][L];e.fillStyle=N>0?`rgba(255,91,31,${.25+.75*Math.min(1,Math.abs(N))})`:`rgba(79,227,255,${.25+.75*Math.min(1,Math.abs(N))})`,e.beginPath(),e.arc(b,R,I===0||I===3?6:4.2,0,Ge),e.fill()})),e.font=`10px ${dt}`,e.fillStyle=de.ink3,["x, y","tanh ×16","tanh ×16","σ"].forEach((S,I)=>e.fillText(S,m[I][0][0]-14,o+10)),e.fillText(`p(橙) = ${f.toFixed(3)}`,l,o+s-4)}if(this.hist.length>1){let l=r?a+s+26:a,c=r?t-l-16:s,h=n-18,d=0,u=Math.max(...this.hist),f=Math.min(...this.hist);e.strokeStyle=de.acid,e.beginPath(),this.hist.forEach((g,v)=>{let m=l+v/(this.hist.length-1)*c,p=h-26*((g-f)/(u-f||1))-d;v?e.lineTo(m,p):e.moveTo(m,p)}),e.stroke()}this.frameN%6===0&&(this.readout("step",String(this.net.t)),this.readout("loss",Number.isFinite(this.stats.loss)?this.stats.loss.toFixed(4):"—"),this.readout("acc",`${(this.stats.acc*100).toFixed(1)}%`)),r||(e.font=`11px ${dt}`,e.fillStyle=de.ink2,e.fillText(`step ${this.net.t} · loss ${Number.isFinite(this.stats.loss)?this.stats.loss.toFixed(3):"—"} · acc ${(this.stats.acc*100).toFixed(0)}%`,a+6,o+16))}};var na=[..."把好奇心编译成可运行的数学"],hs=8,B0=class extends Ct{init(){this.get2d(),this.tau=1;let e=gn(2027),t=()=>na.map(()=>Float64Array.from({length:hs},()=>wt(e)));this.Q=t(),this.K=t(),this.V=t(),this.compute(),this.row=0,this.phase=0,this.hover=null,this.controls([{type:"range",label:"温度 τ",min:.2,max:3,step:.05,value:1,format:n=>n.toFixed(2),onInput:n=>{this.tau=n,this.compute()}}]),this.pointer({hover:(n,r)=>{this.hover=this.cellAt(n,r)},leave:()=>{this.hover=null}})}compute(){let e=na.length;this.S=[],this.A=[],this.O=[];for(let t=0;t<e;t++){let n=[],r=[],s=-1/0;for(let l=0;l<e;l++){let c=0;for(let h=0;h<hs;h++)c+=this.Q[t][h]*this.K[l][h];n.push(l<=t?c/Math.sqrt(hs):-1/0),l<=t&&(s=Math.max(s,n[l]/this.tau))}let a=0;for(let l=0;l<e;l++){let c=l<=t?Math.exp(n[l]/this.tau-s):0;r.push(c),a+=c}for(let l=0;l<e;l++)r[l]/=a;let o=new Float64Array(hs);for(let l=0;l<=t;l++)for(let c=0;c<hs;c++)o[c]+=r[l]*this.V[l][c];this.S.push(n),this.A.push(r),this.O.push(o)}}geom(){let e=na.length,t=this.w,n=this.h,r=Math.min(n*.58/e,t*.55/e);return{n:e,cell:r,mx:34,my:n*.36,tokY:n*.22}}cellAt(e,t){let{n,cell:r,mx:s,my:a}=this.geom(),o=Math.floor((t-a)/r),l=Math.floor((e-s)/r);return o>=0&&o<n&&l>=0&&l<n?[o,l]:null}frame(e){this.phase+=e,this.phase>1.5&&(this.phase=0,this.row=(this.row+1)%na.length);let t=this.ctx,n=this.w,r=this.h;t.clearRect(0,0,n,r);let{n:s,cell:a,mx:o,my:l,tokY:c}=this.geom(),h=this.hover?this.hover[0]:this.row,d=(n-40)/s,u=m=>20+(m+.5)*d;t.font=`15px ${dt}`,t.textAlign="center";for(let m=0;m<=h;m++){let p=this.A[h][m];if(p<.01)continue;t.strokeStyle=`rgba(255,91,31,${Math.min(1,.15+p*1.4)})`,t.lineWidth=.5+p*9;let _=u(h),A=u(m);t.beginPath(),t.moveTo(_,c-12),t.quadraticCurveTo((_+A)/2,c-18-Math.abs(_-A)*.35,A,c-12),t.stroke()}t.lineWidth=1,na.forEach((m,p)=>{t.fillStyle=p===h?de.signal:p<h?de.ink:de.ink3,t.fillText(m,u(p),c+6)}),t.textAlign="left";for(let m=0;m<s;m++)for(let p=0;p<s;p++){let _=o+p*a,A=l+m*a;if(p>m){t.fillStyle="rgba(236,232,225,0.035)",t.fillRect(_+1,A+1,a-2,a-2);continue}if(!(m<h||m===h&&p<=Math.floor(this.phase/.9*(m+1)))&&!this.hover){t.strokeStyle=de.line,t.strokeRect(_+1.5,A+1.5,a-3,a-3);continue}let T=this.A[m][p];t.fillStyle=`rgba(255,91,31,${.08+.92*Math.pow(T,.7)})`,t.fillRect(_+1,A+1,a-2,a-2)}t.strokeStyle=de.ink2,t.strokeRect(o,l+h*a,(h+1)*a,a),t.font=`10px ${dt}`,t.fillStyle=de.ink3,t.fillText("A = softmax(QKᵀ/√d + M)",o,l-8),t.fillText("−∞",o+(s-2)*a,l+a*1.6);let f=o+s*a+24,g=n-f-16;if(g>60){t.fillStyle=de.ink3,t.fillText(`o_${h+1} = Σ A·V`,f,l-8);let m=this.O[h],p=s*a/hs;for(let _=0;_<hs;_++){let A=Math.max(-2,Math.min(2,m[_]));t.fillStyle=A>0?de.signal:de.ion;let M=f+g/2;t.fillRect(A>0?M:M+A/2*(g/2),l+_*p+3,Math.abs(A/2)*(g/2),p-6)}t.strokeStyle=de.line,t.beginPath(),t.moveTo(f+g/2,l),t.lineTo(f+g/2,l+s*a),t.stroke()}t.font=`11px ${dt}`,t.fillStyle=de.ink2;let v=this.hover;v&&v[1]<=v[0]?t.fillText(`S[${v[0]+1},${v[1]+1}] = ${this.S[v[0]][v[1]].toFixed(3)}   A = ${this.A[v[0]][v[1]].toFixed(3)}`,12,r-12):t.fillText(`查询 “${na[h]}” 只能看见自己和前面的词 · τ = ${this.tau.toFixed(2)} · 随机向量演示`,12,r-12)}};var J1=[{id:"spec",label:"需求",sub:"SPEC",x:.08,y:.3},{id:"plan",label:"规划大纲",sub:"PLAN",x:.26,y:.3},{id:"draft",label:"起草 LaTeX",sub:"DRAFT",x:.44,y:.3},{id:"compile",label:"编译",sub:"XELATEX",x:.62,y:.3},{id:"review",label:"审校",sub:"REVIEW",x:.8,y:.3},{id:"ship",label:"交付 PDF",sub:"DELIVER",x:.93,y:.62},{id:"revise",label:"修订",sub:"REVISE",x:.62,y:.62}],e5={spec:"[spec]    明确主题、读者与讲义规范",plan:"[plan]    拆分章节，理清定义与定理的依赖",draft:"[draft]   生成 LaTeX 草稿与习题",compile:"[compile] xelatex 编译通过",pass:"[review]  ✓ 定义、推导、记号与排版一致",fail:"[review]  ✗ 发现问题，退回修订",revise:"[revise]  按审校意见逐条修改",ship:"[deliver] 输出 PDF 与源码"},O0=class extends Ct{init(){this.get2d(),this.doc=1,this.iter=0,this.lines=[],this.path=["spec","plan"],this.at="spec",this.to="plan",this.t=0,this.log("spec")}log(e){this.lines.push(`${e5[e]}${e==="fail"||e==="pass"?`（第 ${this.iter} 轮）`:""}`),this.lines.length>6&&this.lines.shift()}next(e){switch(e){case"spec":return"plan";case"plan":return"draft";case"draft":return"compile";case"compile":return"review";case"review":{this.iter++;let t=Math.random()<.3+.25*this.iter;return this.log(t?"pass":"fail"),t?"ship":"revise"}case"revise":return"compile";case"ship":return this.doc++,this.iter=0,"spec"}return"spec"}frame(e,t){this.t+=e*1.1,this.t>=1&&(this.t=0,this.at=this.to,this.at!=="review"&&this.log(this.at),this.to=this.next(this.at));let n=this.ctx,r=this.w,s=this.h;n.clearRect(0,0,r,s);let a=p=>{let _=J1.find(A=>A.id===p);return[_.x*r,_.y*s]},o=[["spec","plan"],["plan","draft"],["draft","compile"],["compile","review"],["review","ship"],["review","revise"],["revise","compile"],["ship","spec"]];for(let[p,_]of o){let[A,M]=a(p),[T,S]=a(_),I=p===this.at&&_===this.to;n.strokeStyle=I?de.signal:de.line,n.lineWidth=I?1.6:1,n.setLineDash(_==="revise"||p==="revise"?[4,4]:p==="ship"?[2,6]:[]),n.beginPath(),p==="ship"?(n.moveTo(A,M),n.quadraticCurveTo(r*.5,s*.98,T,S)):(n.moveTo(A,M),n.lineTo(T,S)),n.stroke()}n.setLineDash([]),n.lineWidth=1;let[l,c]=a(this.at),[h,d]=a(this.to),u=this.t*this.t*(3-2*this.t),f=l+(h-l)*u,g=c+(d-c)*u;if(this.at==="ship"){let p=u;f=(1-p)**2*l+2*(1-p)*p*r*.5+p*p*h,g=(1-p)**2*c+2*(1-p)*p*s*.98+p*p*d}let v=n.createRadialGradient(f,g,0,f,g,14);v.addColorStop(0,"rgba(255,255,255,0.95)"),v.addColorStop(.3,"rgba(255,91,31,0.8)"),v.addColorStop(1,"rgba(255,91,31,0)"),n.fillStyle=v,n.beginPath(),n.arc(f,g,14,0,Ge),n.fill();for(let p of J1){let[_,A]=[p.x*r,p.y*s],M=p.id===this.at,T=Math.min(124,r*.16),S=50;n.fillStyle=M?"rgba(255,91,31,0.18)":"rgba(9,9,15,0.92)",n.strokeStyle=M?de.signal:de.ink3,n.beginPath(),n.rect(_-T/2,A-S/2,T,S),n.fill(),n.stroke(),n.textAlign="center",n.font=`9.5px ${dt}`,n.fillStyle=M?de.signal:de.ink3,n.fillText(p.sub,_,A-7),n.font=`13px ${dt}`,n.fillStyle=de.ink,n.fillText(p.label,_,A+13),n.textAlign="left",M&&(n.fillStyle=de.acid,n.beginPath(),n.arc(_+T/2-6,A-S/2+6,2.5+Math.sin(t*8),0,Ge),n.fill())}n.font=`11.5px ${dt}`;let m=s*.8;this.lines.forEach((p,_)=>{n.fillStyle=_===this.lines.length-1?de.ink:de.ink3,n.fillText(p,14,m+_*17-(this.lines.length-1)*17+34)}),n.fillStyle=de.ink3,n.font=`10px ${dt}`,n.fillText(`SCHEMATIC · 示意动画 · 讲义 #${this.doc} · 审校第 ${this.iter} 轮`,14,18)}};var t5={domain:A0,fourier:E0,linear:C0,rep:R0,topo:I0,galton:P0,pascal:z0,pendulum:D0,field:N0,quantum:F0,mlp:U0,attention:B0,agent:O0},V0=new Set,H0=null,G0=null;function zd(i,e={}){let t=t5[i.dataset.instrument];if(!t)return null;let n;try{n=new t(i,e),n.visible=!!e.alwaysOn,n.init?.(),n.resize()}catch(s){return console.error(`[instrument:${i.dataset.instrument}]`,s),null}V0.add(n),i.__inst=n,e.alwaysOn||H0.observe(i),G0.observe(n.canvas);let r=n.destroy.bind(n);return n.destroy=()=>{r(),V0.delete(n),H0.unobserve(i),G0.unobserve(n.canvas)},n}function j1(i=document){H0=H0||new IntersectionObserver(e=>{for(let t of e)t.target.__inst&&(t.target.__inst.visible=t.isIntersecting)},{rootMargin:"120px"}),G0=G0||new ResizeObserver(e=>{for(let t of e){let n=t.target.closest("[data-instrument]")?.__inst;n&&(n._dirty=!0)}});for(let e of i.querySelectorAll("[data-instrument]"))e.closest("#lab")||zd(e);vn(({dt:e})=>{for(let t of V0)if(t.visible){t._dirty&&(t._dirty=!1,t.resize()),t.time+=e;try{t.frame(e,t.time)}catch(n){console.error(`[instrument:${t.type}]`,n),V0.delete(t)}}})}function Q1(){let i=document.getElementById("lab"),e=i.querySelector(".lab-body"),t=i.querySelector(".lab-name"),n=null,r=()=>{i.classList.remove("open"),i.setAttribute("aria-hidden","true"),n&&(n.destroy(),n=null),setTimeout(()=>{n||(e.innerHTML="")},400)},s=a=>{let o=a.dataset.instrument;e.innerHTML="";let l=document.createElement("div");l.className="instrument",l.dataset.instrument=o,l.innerHTML='<canvas></canvas><div class="ins-controls"></div>';let c=document.createElement("div");c.className="lab-text";let h=a.querySelector(".card-body");c.innerHTML=`<p class="kicker mono">${a.querySelector(".card-head span").textContent}</p>`;for(let d of h.children)d.classList.contains("ins-controls")||c.appendChild(d.cloneNode(!0));e.append(l,c),t.textContent=`LAB · ${a.querySelector("h4").textContent}`,i.classList.add("open"),i.setAttribute("aria-hidden","false"),_a(c),requestAnimationFrame(()=>{n=zd(l,{large:!0,alwaysOn:!0})})};for(let a of document.querySelectorAll("[data-expand]"))a.addEventListener("click",()=>s(a.closest("[data-instrument]")));i.querySelector(".lab-close").addEventListener("click",r),i.addEventListener("click",a=>{a.target===i&&r()}),St.on("escape",r)}var Ld={visible:!1},n5=Math.PI*(3-Math.sqrt(5));function i5(i){let n=4.4*Math.sqrt((i+.5)/2584),r=i*n5,s=n/4.4;return[n*Math.cos(r),.24*Math.sin(r*2+n*1.1)*s*s,n*Math.sin(r)]}var r5=i=>{let e=_o(i.state.theta/6+.6,[0,0,0,0]),t=[0,0,0];return M0(e[0],e[1],e[2],e[3],0,t),t},s5=i=>{let e=i.state.theta/2,t=Math.max(1-Math.sin(e),.05);return[0,0,Math.max(-6,Math.min(6,Math.cos(e)/t*1.25))]},a5=i=>{let e=i.state.time*.16+1.2,t=.8,n=[Math.cos(t)*Math.cos(e),Math.cos(t)*Math.sin(e),Math.sin(t)*Math.cos(e),Math.sin(t)*Math.sin(e)],r=i.uniforms.uHopfRot.value.elements,s=[0,1,2,3].map(o=>r[o]*n[0]+r[4+o]*n[1]+r[8+o]*n[2]+r[12+o]*n[3]),a=Math.max(1-s[3],.05);return[s[0]/a*1.2,s[1]/a*1.2,s[2]/a*1.2]};function o5(i){let e=bd(),t=n=>{let r=e.find(s=>s.name===n);return{p:[r.x,r.base+r.h+.25,r.z],k:`${r.field==="math"?"MATH":"PHYSICS"} · ${r.pages} PAGES`,t:`${r.name}：${r.pages} 页中文重编讲义（mit-ocw-notes，已交付）。`}};return{galaxy:[{p:i5(144),k:"SEED #144",t:"第 144 颗种子。144 = F₁₂ 是斐波那契数，所以 144、288、432…号种子几乎落在同一条射线上。"}],singularity:[{p:[0,0,0],k:"DIM 0 · SINGULARITY",t:"没有长度、面积和体积的一个点。点一下它。",click:()=>document.querySelector(".singularity-hit")?.click()}],landscape:[{p:[2.24,-1.5,-1.12],k:"ZERO · ORDER 2",t:"z = 2 + i 是二阶零点：绕它一圈，颜色转两圈。"},{p:[.7208,1.5,1.7403],k:"POLE · ORDER 1",t:"z² = −2 − 2i 的根是一阶极点：|f| → ∞，颜色反向转一圈。"},{p:[-1.12,-1.5,0],k:"ZERO · ORDER 1",t:"z = −1：一阶零点。高度是 log|f|，零点处向下无限深。"}],fiber:[{p:r5,k:"KNOT 3₁",t:"三叶结：(2, 3) 环面纽结。随着 θ 增加，结上的点沿结滑动——纽结本身是一条轨道。"},{p:s5,k:"F_θ · SEIFERT SURFACE",t:"亏格 1 的可定向曲面，边界恰好是三叶结。每一页都穿过对称轴两次。"}],lorenz:[{p:[.933,.22,.933],k:"C⁺ · FIXED POINT",t:"轨道围绕两个不稳定不动点 (±6√2, ±6√2, 27) 打转。σ = 10，ρ = 28，β = 8/3。"},{p:[-.933,.22,-.933],k:"LORENZ 1963",t:"最大李雅普诺夫指数约 0.906：初值误差每个时间单位约放大 2.5 倍。"}],latent:[{p:()=>i.getShape("latent").centers[0],k:"CLUSTER · ILLUSTRATIVE",t:"隐空间示意：相近的概念聚成簇，簇之间以关系相连。这里的点是生成的示意数据，不来自真实模型。"}],archive:[t("概率论"),t("常微分方程与动力系统"),t("量子力学"),t("量子场论")],hopf:[{p:a5,k:"S¹ → S³ → S²",t:"每个圆是球面上一点的原像；同一纬度的圆铺成一个环面，任意两个圆恰好链接一次。"}]}}function eg(i){if(!i)return;let e=document.getElementById("hotspots"),t=o5(i),n=null,r=[],s={x:0,y:0,depth:0},a=o=>{e.innerHTML="",r=(t[o]||[]).map(l=>{let c=document.createElement("div");return c.className="hs",c.innerHTML=`<span class="hs-dot"></span><div class="hs-card"><span class="hs-k">${l.k}</span>${l.t}</div>`,c.style.opacity="0",c.addEventListener("click",()=>{c.classList.toggle("open"),l.click?.()}),e.appendChild(c),{def:l,el:c}})};vn(()=>{i.shape!==n&&(n=i.shape,a(n));let o=Ld.visible&&i.morphT>=1&&i.state.focus>.7;for(let l of r){let c=typeof l.def.p=="function"?l.def.p(i):l.def.p,h=o?i.toScreen(c[0],c[1],c[2],s):null,d=h&&h.x>30&&h.x<innerWidth-30&&h.y>70&&h.y<innerHeight-60;l.el.style.opacity=d?"1":"0",l.el.style.pointerEvents=d?"auto":"none",h&&(l.el.style.transform=`translate(${h.x.toFixed(1)}px, ${h.y.toFixed(1)}px)`,l.el.classList.toggle("flip",h.x>innerWidth-320))}})}function tg({isBusy:i}){let e=document.getElementById("screensaver"),t=e.querySelector("canvas"),n=t.getContext("2d"),r=performance.now(),s=!1,a=0,o=.1,l=0,c=0,h=0,d=()=>{r=performance.now(),s&&g()};for(let v of["pointermove","pointerdown","keydown","wheel","scroll","touchstart"])addEventListener(v,d,{passive:!0});let u=()=>{let v=t.width,m=t.height,p=Math.min(v,m)/62;n.globalCompositeOperation="source-over",n.fillStyle="rgba(0,0,0,0.012)",n.fillRect(0,0,v,m),n.globalCompositeOperation="lighter",n.lineWidth=1.2*devicePixelRatio;for(let _=0;_<18;_++){let M=o+.04*(l-o),T=l+.004*(o*(28-c)-l),S=c+.004*(o*l-8/3*c);n.strokeStyle=`hsla(${(h+=.08)%360}, 90%, 60%, 0.5)`,n.beginPath(),n.moveTo(v/2+o*p,m*.9-c*p),n.lineTo(v/2+M*p,m*.9-S*p),n.stroke(),o=M,l=T,c=S}a=requestAnimationFrame(u)},f=()=>{s=!0,t.width=innerWidth*devicePixelRatio,t.height=innerHeight*devicePixelRatio,n.fillStyle="#000",n.fillRect(0,0,t.width,t.height),e.classList.add("on"),Qt("idle",{message:"系统待机。混沌仍在演化——这是洛伦茨吸引子，动一下鼠标就能回来。"}),a=requestAnimationFrame(u)},g=()=>{s=!1,e.classList.remove("on"),cancelAnimationFrame(a)};setInterval(()=>{!s&&!i()&&!document.hidden&&performance.now()-r>45e3&&performance.now()-Zt.lastMove>45e3&&f()},1e3)}var l5=[["DIM 0","e^{i\\pi}+1=0"],["DIM 1","\\gamma:[0,1]\\to M"],["DIM 2","\\oint_{\\partial D}\\frac{f'(z)}{f(z)}\\,dz=2\\pi i\\,(Z-P)"],["DIM 3","\\Delta_{3_1}(t)=t^2-t+1"],["DIM 3+1","\\nabla\\times\\mathbf B=\\mu_0\\mathbf J+\\mu_0\\varepsilon_0\\,\\partial_t\\mathbf E"],["DIM 3+1","i\\hbar\\,\\partial_t\\psi=\\hat H\\psi"],["DIM n","\\mathrm{softmax}\\!\\left(QK^{\\mathsf T}/\\sqrt d\\right)V"],["Σ","F_{12}=144=12^2"],["DIM ∞","S^1\\hookrightarrow S^3\\to S^2"],["ALGEBRA","|G|=\\textstyle\\sum_\\rho(\\dim\\rho)^2"],["TOPOLOGY","\\chi=V-E+F"],["PROBABILITY","\\mathbb P(|\\bar X_n-\\mu|>\\varepsilon)\\to0"]];function ng(){let i=document.querySelector(".marquee-track"),e=l5.map(([t,n])=>`<span><em>${t}</em>${Fn(n)}</span>`).join("");i.innerHTML=e+e,document.querySelector(".ht-note").addEventListener("click",()=>{Qt("f144",{message:`${Fn("144 = F_{12} = 12^2")}：斐波那契数列中除 0 和 1 之外唯一的完全平方数（J. H. E. Cohn, 1964）。背景向日葵里，144 的倍数号种子几乎排成一条射线。`}),St.emit("fx-144")})}function ig(){document.querySelectorAll(".hero-title [data-scramble]").forEach((e,t)=>To(e,e.textContent,{duration:1300,delay:150+t*220}));for(let e of document.querySelectorAll("#hero .reveal"))e.classList.add("in")}function rg(i){for(let a of document.querySelectorAll("[data-barcode]"))H1(a,a.dataset.barcode);let e=new Date;for(let a of document.querySelectorAll("[data-today]"))a.textContent=e.toISOString().slice(0,10);let t=[...document.querySelectorAll("[data-orbit] span")],n=document.querySelector(".orbit-wrap"),r=0;vn(({dt:a})=>{let o=n.getBoundingClientRect();if(o.bottom<0||o.top>innerHeight)return;r+=a*.12;let l=Math.min(460,o.width*.42),c=.22;t.forEach((h,d)=>{let u=r+d/t.length*Math.PI*2,f=Math.sin(u)*l,g=Math.cos(u),v=-g*l*c,m=.62+.38*(g+1)/2;h.style.transform=`translate(-50%, -50%) translate(${f.toFixed(1)}px, ${v.toFixed(1)}px) scale(${m.toFixed(3)})`,h.style.opacity=(.18+.82*((g+1)/2)**1.5).toFixed(3),h.style.zIndex=String(Math.round((g+1)*50))})}),document.querySelector(".singularity-hit").addEventListener("click",()=>{i&&i.explode(),Nt.impact(),Qt("bang",{message:"大爆炸：一个点里装着整个宇宙。粒子会在几秒后回到奇点。"})})}var Dd=3200,Nd=560;function c5(i){let e=`M ${i[0][0]} ${i[0][1]}`;for(let t=0;t<i.length-1;t++){let n=i[Math.max(0,t-1)],r=i[t],s=i[t+1],a=i[Math.min(i.length-1,t+2)],o=[r[0]+(s[0]-n[0])/6,r[1]+(s[1]-n[1])/6],l=[s[0]-(a[0]-r[0])/6,s[1]-(a[1]-r[1])/6];e+=` C ${o[0].toFixed(1)} ${o[1].toFixed(1)}, ${l[0].toFixed(1)} ${l[1].toFixed(1)}, ${s[0].toFixed(1)} ${s[1].toFixed(1)}`}return e}function sg(){let i=document.getElementById("track"),e=i.querySelector(".track-rail"),t=i.querySelector(".track-path"),n=i.querySelector(".track-ghost"),r=[...i.querySelectorAll(".station")],s=document.getElementById("track-t"),a=u=>Nd*(.5+.26*Math.sin(u*Math.PI*5.2+.4)),o=[[0,a(0)]];r.forEach(u=>{let f=Number(u.dataset.at),g=f*Dd,v=a(f);o.push([g,v]),u.style.left=`${f*100}%`,u.style.top=`${v/Nd*100}%`,u.classList.add(v<Nd*.5?"below":"above")});for(let u=1;u<=24;u++){let f=u/24;r.some(g=>Math.abs(Number(g.dataset.at)-f)<.03)||o.push([f*Dd,a(f)])}o.sort((u,f)=>u[0]-f[0]),o.push([Dd,a(1)]);let l=c5(o);t.setAttribute("d",l),n.setAttribute("d",l);let c=t.getTotalLength();t.style.strokeDasharray=`${c}`;let h=0,d=u=>{h=u;let f=.03+u*.94,g=e.offsetWidth;e.style.transform=`translateX(${(innerWidth*.5-f*g).toFixed(1)}px)`,t.style.strokeDashoffset=`${c*(1-f)}`,s.textContent=f.toFixed(3);for(let v of r)v.classList.toggle("is-lit",Number(v.dataset.at)<=f+.01)};oa(i,d,"pin"),addEventListener("resize",()=>d(h))}var h5="http://www.w3.org/2000/svg",ia=Math.PI*2,W0=i=>[Math.sin(i)+2*Math.sin(2*i),-(Math.cos(i)-2*Math.cos(2*i))];function ci(i,e={},t){let n=document.createElementNS(h5,i);for(let[r,s]of Object.entries(e))n.setAttribute(r,s);return t&&t.appendChild(n),n}function u5(i=900){let e=Array.from({length:i},(n,r)=>W0(r/i*ia)),t=[];for(let n=0;n<i;n++){let r=e[n],s=e[(n+1)%i];for(let a=n+2;a<i;a++){if(n===0&&a===i-1)continue;let o=e[a],l=e[(a+1)%i],c=(s[0]-r[0])*(l[1]-o[1])-(s[1]-r[1])*(l[0]-o[0]);if(Math.abs(c)<1e-12)continue;let h=((o[0]-r[0])*(l[1]-o[1])-(o[1]-r[1])*(l[0]-o[0]))/c,d=((o[0]-r[0])*(s[1]-r[1])-(o[1]-r[1])*(s[0]-r[0]))/c;h>=0&&h<1&&d>=0&&d<1&&t.push({ta:(n+h)/i*ia,tb:(a+d)/i*ia,p:[r[0]+h*(s[0]-r[0]),r[1]+h*(s[1]-r[1])]})}}return t}function d5(i){let t=([f,g])=>[f*34,g*34],n=u5(),s=n.flatMap((f,g)=>[{t:f.ta,k:g},{t:f.tb,k:g}]).sort((f,g)=>f.t-g.t).filter((f,g)=>g%2===1).map(f=>f.t),a=.16,o=f=>s.some(g=>Math.min(Math.abs(f-g),ia-Math.abs(f-g))<a),l="",c=!1,h=720;for(let f=0;f<=h;f++){let g=f/h*ia;if(o(g)){c=!1;continue}let[v,m]=t(W0(g));l+=`${c?"L":"M"}${v.toFixed(2)} ${m.toFixed(2)} `,c=!0}let d={};d.knot=ci("g",{class:"sv-knot"},i),ci("path",{d:l,fill:"none",stroke:"#ece8e1","stroke-width":3.2,"stroke-linecap":"round"},d.knot),d.arrows=ci("g",{class:"sv-arrows"},i);for(let f=0;f<6;f++){let g=f/6*ia+.5;if(o(g))continue;let[v,m]=t(W0(g)),[p,_]=t(W0(g+.01)),A=Math.atan2(_-m,p-v)*180/Math.PI;ci("path",{d:"M -7 -6 L 7 0 L -7 6 Z",fill:"#ff5b1f",transform:`translate(${v} ${m}) rotate(${A})`},d.arrows)}let u=Math.hypot(...t(n[0].p));d.circles=ci("g",{class:"sv-circles"},i),ci("circle",{r:u*.55,fill:"none",stroke:"#4fe3ff","stroke-width":2.4},d.circles),ci("circle",{r:u*1.75,fill:"none",stroke:"#9b7bff","stroke-width":2.4},d.circles);for(let f of n){let[g,v]=t(f.p),m=Math.atan2(v,g),p=u*1.15;ci("path",{d:"M -6 -6 L 6 6 M 6 -6 L -6 6",stroke:"#ff5b1f","stroke-width":2,transform:`translate(${(p*Math.cos(m)).toFixed(2)} ${(p*Math.sin(m)).toFixed(2)})`},d.circles)}d.surface=ci("g",{class:"sv-surface"},i),ci("circle",{r:u*1.75,fill:"rgba(155,123,255,0.22)",stroke:"#9b7bff","stroke-width":2},d.surface),ci("circle",{r:u*.55,fill:"rgba(79,227,255,0.28)",stroke:"#4fe3ff","stroke-width":2},d.surface);for(let f of n){let g=Math.atan2(...[...t(f.p)].reverse()),v=u*.55,m=u*1.75,p=.2,_=(A,M)=>`${(A*Math.cos(g+M)).toFixed(2)} ${(A*Math.sin(g+M)).toFixed(2)}`;ci("path",{d:`M ${_(v,-p*1.6)} L ${_(m,p*.55)} L ${_(m,-p*.55)} L ${_(v,p*1.6)} Z`,fill:"rgba(255,91,31,0.35)",stroke:"#ff5b1f","stroke-width":1.6},d.surface)}return d}var ag=["① 纽结图：3 个交叉，沿曲线走，上、下交替出现。","② 给纽结定一个方向，沿箭头行走。","③ 在每个交叉处顺着方向“光滑化”，得到 2 个嵌套的 Seifert 圆。",null];function og(i){let e=document.getElementById("knot-stage"),t=[...e.querySelectorAll(".kstep")],n=e.querySelector("[data-knot-step-label]"),r=e.querySelector(".knot-progress > i"),s=e.querySelector(".seifert-svg"),a=e.querySelector(".seifert-cap"),o=e.querySelector('[data-readout-knot="algo"]'),l=e.querySelector('[data-readout-knot="theta"]'),c=e.querySelector('[data-knot="theta"]'),h=S=>e.querySelector(`[data-knot="${S}"]`),d=d5(s);ag[3]=`④ 每个圆张一张圆盘，每个交叉接一条半扭的带子。${Fn("\\chi=2-3=-1,\\ g=\\tfrac{1-\\chi}{2}=1")}`;let u=-1,f=S=>{u=S,d.knot.style.opacity=S<=1?1:.15,d.arrows.style.opacity=S===1||S===2?1:0,d.circles.style.opacity=S===2?1:0,d.surface.style.opacity=S===3?1:0,a.innerHTML=ag[S],o.textContent=`${S+1}/4`};for(let S of Object.values(d))S.style.transition="opacity 0.8s ease";f(0);let g=0,v=-1,m=S=>{S!==v&&(v=S,t.forEach((I,b)=>I.classList.toggle("is-on",b===S)),n.textContent=String(S+1).padStart(2,"0"),i&&(i.setOpenBook(S===2),i.setZoom(S===1?.45:S===3?.2:0),i.state.thetaSpeed=S===2?.35:.22,h("book").classList.toggle("is-on",S===2),Nt.blip()))};oa(e,S=>{r.style.setProperty("--p",S.toFixed(3)),m(Math.min(3,Math.floor(S*4)))},"pin"),h("auto").addEventListener("click",()=>{let S=!h("auto").classList.contains("is-on");h("auto").classList.toggle("is-on",S),i?.setThetaAuto(S)}),h("book").addEventListener("click",()=>{let S=!h("book").classList.contains("is-on");h("book").classList.toggle("is-on",S),i?.setOpenBook(S)}),h("tube").addEventListener("click",()=>{let S=!h("tube").classList.contains("is-on");h("tube").classList.toggle("is-on",S),i?.setKnot(S)}),h("reset").addEventListener("click",()=>i?.resetView());let p=0;h("untie").addEventListener("click",()=>{i?.wobbleKnot(),Nt.whoosh(!1),p++,p===1?os("ATTEMPT 1","纽结抖了抖，又回到原样。再试一次？"):p===2?os("ATTEMPT 2","还是不行。也许问题不在力气。"):Qt("untie",{message:`无论怎样连续变形都解不开：${Fn("\\Delta_{3_1}(t)=t^2-t+1\\neq 1")}，而平凡结的 Alexander 多项式是 1。`})}),c.addEventListener("input",()=>{let S=Number(c.value);i?.setTheta(S),h("auto").classList.remove("is-on"),S>=Number(c.max)-.02&&Qt("monodromy",{message:`θ 走过了 ${Fn("12\\pi")}：三叶结纤维化的单值化是 6 阶的——每一页都转了 6 圈，每个点都回到了原处。`})});let _=e.querySelector("[data-drag]"),A=null;_.addEventListener("pointerdown",S=>{A=[S.clientX,S.clientY],_.setPointerCapture(S.pointerId)}),_.addEventListener("pointermove",S=>{!A||!i||(i.drag(S.clientX-A[0],S.clientY-A[1]),A=[S.clientX,S.clientY])});let M=()=>{A=null};_.addEventListener("pointerup",M),_.addEventListener("pointercancel",M),vn(({dt:S})=>{let I=e.getBoundingClientRect();if(!(I.bottom<0||I.top>innerHeight)){if(i){let b=i.state.theta;l.textContent=((b%(12*Math.PI)+12*Math.PI)%(12*Math.PI)).toFixed(2),i.state.thetaAuto&&(c.value=String((b%(12*Math.PI)+12*Math.PI)%(12*Math.PI)))}g+=S,g>3.6&&(g=0,f((u+1)%4))}});let T=e.querySelector(".side-note");i&&T&&(T.innerHTML=T.innerHTML.replace("约 5.8 万",`约 ${(Math.round(i.count*.88/1e3)/10).toFixed(1)} 万`))}function lg(){let i=document.getElementById("constellation"),e=gn(9),t=vd.map((r,s)=>{let a=s/vd.length*Math.PI*2+.3,o=.28+e()*.12;return{...r,x:50+Math.cos(a)*o*100*.95,y:50+Math.sin(a)*o*100*.78}}),n=[];for(let r=0;r<t.length;r++){let s=(r+1)%t.length,a=(r+3)%t.length;n.push([t[r],t[s]]),r%2===0&&n.push([t[r],t[a]])}i.innerHTML=`<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${n.map(([r,s])=>`<line x1="${r.x}" y1="${r.y}" x2="${s.x}" y2="${s.y}" vector-effect="non-scaling-stroke"/>`).join("")}</svg>`+t.map((r,s)=>{let a=8+Math.sqrt(r.pages)*2.2;return`<div class="star" style="left:${r.x}%;top:${r.y}%;--tw:${s*.37%3}s"><i style="width:${a}px;height:${a}px"></i><b>${r.key}</b><span>${r.zh} · ${r.pages} 页</span><div class="star-tip">教材第 ${r.unit} 单元 · ${r.note}</div></div>`}).join(""),document.getElementById("route").innerHTML=k1.map(r=>`<li>${r}</li>`).join("")}var us=i=>String(i).replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]);function f5(i,e){return`<article class="repo panel reveal" style="--i:${e}" data-repo="${i.name}">
    <div class="repo-top">
      <p class="repo-name"><a href="${i.url}" target="_blank" rel="noopener">github.com/xhc144/${i.name} ↗</a><span class="tag tag-ok">PUBLIC</span></p>
      <h4 class="repo-title">${us(i.title)}</h4>
      <p class="repo-blurb">${us(i.blurb)}</p>
    </div>
    <div class="repo-stats">${i.stats.map(([t,n,r])=>`<div><b><span data-count="${n}">0</span><small>${r}</small></b><span>${t}</span></div>`).join("")}</div>
    <div class="repo-foot mono"><span>${us(i.tag)}${i.version?" · "+i.version:""}</span><span data-pushed>最近推送 ${i.pushed}</span>${i.site?`<a href="${i.site}" target="_blank" rel="noopener">导航网页 ↗</a>`:""}</div>
  </article>`}function p5(){let i=Math.max(...Vr.map(t=>t[1]),...Hr.map(t=>t[1])),e=(t,n,r)=>`<div><h5>${t}</h5>${n.map(([s,a],o)=>`<div class="bar ${r}" style="--w:${(a/i).toFixed(3)};--i:${o}"><span>${s}</span><i></i><b>${a}</b></div>`).join("")}</div>`;return e(`数学 · ${Oi.mathBooks} 册 · ${Oi.mathPages} 页`,Vr,"")+e(`物理 · ${Oi.physBooks} 科 · ${Oi.physPages} 页`,Hr,"phys")}function m5(){let i=Object.keys(yd),e=new Date("2026-10-01T00:00:00Z"),t=12,n={"mit-ocw-notes":"#ff5b1f","repository-index":"#9b7bff","claude-lab":"#4fe3ff","ai-self-study":"#d4ff3a"},r=960,s=260,a=40,o=40,l=16,c=Array.from({length:t},(g,v)=>{let m=new Date(e.getTime()+v*864e5).toISOString().slice(0,10);return i.map(p=>yd[p][m]||0)}),h=Math.max(...c.map(g=>g.reduce((v,m)=>v+m,0))),d=(r-a-10)/t,u="";c.forEach((g,v)=>{let m=s-o;g.forEach((_,A)=>{if(!_)return;let M=_/h*(s-o-l);m-=M,u+=`<rect x="${(a+v*d+4).toFixed(1)}" y="${m.toFixed(1)}" width="${(d-8).toFixed(1)}" height="${M.toFixed(1)}" fill="${n[i[A]]}" opacity="0.85"><title>${i[A]}：${_} 次提交</title></rect>`});let p=g.reduce((_,A)=>_+A,0);p&&(u+=`<text x="${(a+v*d+d/2).toFixed(1)}" y="${(m-6).toFixed(1)}" text-anchor="middle">${p}</text>`),u+=`<text x="${(a+v*d+d/2).toFixed(1)}" y="${s-o+18}" text-anchor="middle">10-${String(v+1).padStart(2,"0")}</text>`});let f=i.map((g,v)=>`<g transform="translate(${a+v*190},${s-6})"><rect width="10" height="10" y="-9" fill="${n[g]}"/><text x="16">${g}</text></g>`).join("");return`<svg viewBox="0 0 ${r} ${s+14}" role="img" aria-label="公开仓库每日提交数"><line x1="${a}" x2="${r-10}" y1="${s-o}" y2="${s-o}" stroke="rgba(236,232,225,0.2)"/>${u}${f}</svg>`}async function g5(){let i=document.getElementById("sync-dot"),e=document.getElementById("sync-text"),t=document.getElementById("sync-meta"),n=new AbortController,r=setTimeout(()=>n.abort(),6e3);try{let s=await fetch("https://api.github.com/users/xhc144/repos?per_page=100&sort=pushed",{signal:n.signal,headers:{Accept:"application/vnd.github+json"}});if(clearTimeout(r),!s.ok)throw new Error(`HTTP ${s.status}`);let a=await s.json();i.className="sync-dot live",e.textContent=`LIVE · 已与 GitHub 同步：${a.length} 个公开仓库`,t.textContent=`最近推送 ${a[0]?.pushed_at?.slice(0,10)??"—"}`;for(let o of a){let l=document.querySelector(`[data-repo="${o.name}"] [data-pushed]`);l&&o.pushed_at&&(l.textContent=`最近推送 ${o.pushed_at.slice(0,10)} · LIVE`)}}catch{clearTimeout(r),i.className="sync-dot snap",e.textContent=`SNAPSHOT · 无法连接 GitHub API，显示 ${Mo} 的快照`,t.textContent=""}}function cg(){document.getElementById("repo-grid").innerHTML=So.map(f5).join(""),document.getElementById("ocw-bars").innerHTML=p5(),document.getElementById("own-grid").innerHTML=I1.map((n,r)=>`<article class="own reveal" style="--i:${r}">
      <p class="own-k"><span>${us(n.kind)}</span><span class="tag ${n.state==="公开"?"tag-ok":"tag-live"}">${us(n.state)}</span></p>
      <h4>${us(n.title)}</h4><p>${us(n.note)}</p>
      ${n.url?`<a class="own-link" href="${n.url}" target="_blank" rel="noopener">查看仓库 ↗</a>`:n.anchor?`<a class="own-link" href="${n.anchor}" data-nav="${n.anchor.slice(1)}">在本站查看 →</a>`:""}
    </article>`).join(""),document.getElementById("spectrum").innerHTML=m5();for(let n of document.querySelectorAll("[data-snapshot]"))n.textContent=Mo;let i=new IntersectionObserver(n=>{for(let r of n)r.isIntersecting&&(i.unobserve(r.target),V1(r.target,Number(r.target.dataset.count),{duration:1800}))},{threshold:.6});for(let n of document.querySelectorAll("[data-count]"))i.observe(n);let e=!1,t=new IntersectionObserver(n=>{n.some(r=>r.isIntersecting)&&!e&&(e=!0,g5(),t.disconnect())},{rootMargin:"400px"});t.observe(document.getElementById("archive"))}function hg(){let i=Date.UTC(2026,11,31,16,0,0),e={};for(let n of document.querySelectorAll("[data-cd]"))e[n.dataset.cd]=n;let t=-1;vn(()=>{let n=Math.max(0,i-Date.now()),r=Math.floor(n/1e3);r!==t&&(t=r,e.d.textContent=String(Math.floor(r/86400)).padStart(3,"0"),e.h.textContent=String(Math.floor(r/3600)%24).padStart(2,"0"),e.m.textContent=String(Math.floor(r/60)%60).padStart(2,"0"),e.s.textContent=String(r%60).padStart(2,"0"))})}var ug=(i,e)=>(i+" ").padEnd(e,".");function dg(i,{onEnter:e}){let t=document.getElementById("boot"),n=t.querySelector(".boot-log"),r=t.querySelector(".boot-pct"),s=t.querySelector(".boot-bar"),a=[],o=u=>{a.push(u),n.innerHTML=a.slice(-11).join(`
`)},l=0,c=u=>{l=u,r.textContent=String(Math.round(u)).padStart(3,"0"),s.style.setProperty("--bp",(u/100).toFixed(3))},h=[["mount /mathematics",null],["mount /physics",null],["mount /artificial-intelligence",null],["sample 2584 seeds @ 137.508°",()=>i?.getShape("galaxy")],["collapse to a point (dim 0)",()=>i?.getShape("singularity")],["solve z² + w³ = e^{iθ} on S³",()=>i?.getShape("fiber")],["integrate lorenz σ=10 ρ=28 β=8/3",()=>i?.getShape("lorenz")],["phase portrait of f(z), 2-D",()=>i?.getShape("landscape")],["lift S² → S³ (hopf)",()=>i?.getShape("hopf")],["compile shaders (GLSL)",()=>i?.frame(.016,0)]],d=Yt.params.has("skip");return new Promise(u=>{let f=!1,g=async m=>{f||(f=!0,m&&await Nt.enable(),e?.(m&&Nt.on),Nt.impact(),Nt.whoosh(!0),t.classList.add("leaving"),document.body.classList.remove("is-booting"),setTimeout(()=>{t.remove()},1e3),u())};if(d){for(let[,m]of h)m?.();g(!1);return}t.querySelector('[data-enter="sound"]').addEventListener("click",()=>g(!0)),t.querySelector('[data-enter="silent"]').addEventListener("click",()=>g(!1));let v=m=>{t.classList.contains("ready")&&(m.key==="Enter"&&(m.preventDefault(),g(!0)),m.key==="Escape"&&(m.preventDefault(),g(!1)),f&&removeEventListener("keydown",v))};addEventListener("keydown",v),(async()=>{let m=Yt.reducedMotion;o('<span class="ok">XHC144 OBSERVATORY OS</span>  ·  '+new Date().toISOString().slice(0,10)+"  ·  quality="+Yt.quality+"  ·  particles="+Yt.particles.toLocaleString("en-US"));for(let p=0;p<h.length;p++){let[_,A]=h[p];await T0(m?0:90);let M=performance.now(),T=!0;try{A?.()}catch(R){T=!1,console.warn(R)}let S=performance.now()-M;o(`&gt; ${ug(_,38)} ${T?'<span class="ok">ok</span>':'<span class="warn">skip</span>'}  ${S.toFixed(1).padStart(6)} ms`);let I=(p+1)/h.length*100,b=l;for(let R=1;R<=6;R++)c(b+(I-b)*R/6),Nt.tick(),await T0(m?0:16)}o("&gt; "+ug("target 2027 · 求真书院",38)+' <span class="warn">locked</span>'),c(100),await T0(m?0:250),t.classList.add("ready"),t.querySelector('[data-enter="sound"]').focus({preventScroll:!0})})()})}var pg=(i,e,t)=>i<e?e:i>t?t:i,fg=(i,e,t)=>{let n=pg((t-i)/(e-i),0,1);return n*n*(3-2*n)};function Fd(i,e,t=""){let n=document.getElementById("fx-layer"),r=document.createElement("div");r.className="fx-big "+t,r.innerHTML=`${i}${e?`<p>${e}</p>`:""}`,n.appendChild(r),setTimeout(()=>r.remove(),4300)}function x5(){let i=new IntersectionObserver(e=>{for(let t of e)t.isIntersecting&&(t.target.classList.add("in"),i.unobserve(t.target))},{threshold:.12,rootMargin:"0px 0px -6% 0px"});for(let e of document.querySelectorAll(".reveal"))e.closest("#hero")||i.observe(e);for(let e of document.querySelectorAll(".ins-grid, .basis, .repo-grid, .own-grid"))[...e.children].forEach((t,n)=>t.style.setProperty("--i",n));return i}function v5(){let i=[],e=["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];addEventListener("keydown",t=>{if(t.key==="Escape"){St.emit("escape");return}let n=t.target;if(n&&(n.tagName==="INPUT"||n.tagName==="TEXTAREA"||n.isContentEditable)||document.body.classList.contains("is-booting"))return;if(t.key==="/"||t.key==="`"){t.preventDefault(),St.emit("terminal");return}i.push(t.key.toLowerCase()),i=i.slice(-12);let r=i.join("");e.every((s,a)=>i[i.length-e.length+a]===s)?(i=[],St.emit("fx-monster"),Qt("konami",{message:"↑↑↓↓←→←→BA：魔群 𝕄 的阶，最大的散在单群。"})):r.endsWith("144")?(i=[],St.emit("fx-144"),Qt("f144",{message:`${Fn("144 = F_{12} = 12^2")}：斐波那契数列中除 0 和 1 之外唯一的完全平方数（J. H. E. Cohn, 1964）。`})):r.endsWith("euler")&&(i=[],St.emit("fx-euler"),Qt("euler",{message:`${Fn("e^{i\\pi}+1=0")}：0、1、e、i、π 同时出现在一个等式里。`}))})}function y5(){let i=["%c","   ██╗  ██╗██╗  ██╗ ██████╗ ██╗██╗  ██╗██╗  ██╗","   ╚██╗██╔╝██║  ██║██╔════╝███║██║  ██║██║  ██║","    ╚███╔╝ ███████║██║     ╚██║███████║███████║","    ██╔██╗ ██╔══██║██║      ██║╚════██║╚════██║","   ██╔╝ ██╗██║  ██║╚██████╗ ██║     ██║     ██║","   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝     ╚═╝   0 → ∞"].join(`
`);console.log(i,"color:#ff5b1f;font-family:monospace"),console.log("%c你好，读源码的人。所有画面都在你的浏览器里实时计算。在这里输入 qiuzhen() 解锁一个彩蛋。","color:#4fe3ff"),window.qiuzhen=()=>(Qt("console",{message:"你在控制台里找到了这条留言。求真，继续前进。"}),"求真 · 继续前进")}async function b5(){let i=document.getElementById("universe"),e=L1(i,{count:Yt.particles,quality:Yt.quality,pixelRatio:Yt.pixelRatio});e?Yt.reducedMotion&&(e.reduced=!0,e.morphDur=1.2):document.body.classList.add("no-webgl"),window.__universe=e,_a(),D1(),B1(),G1({particles:e?e.count:0}),X1(),Q1(),eg(e),ng(),rg(e),sg(),og(e),lg(),cg(),hg(),_a(),j1(),v5(),y5(),tg({isBusy:()=>document.body.classList.contains("is-booting")||!!document.querySelector("#terminal.open, #lab.open, #eggs-panel.open")});let t=[...document.querySelectorAll("[data-chapter]")],n=document.getElementById("sweep");St.on("chapter",({el:l,prev:c})=>{l&&(document.body.className=document.body.className.replace(/\bchapter-\S+/g,"").trim()+` chapter-${l.id}`,e&&l.dataset.shape&&e.setShape(l.dataset.shape),Nt.chord(t.indexOf(l)),c&&(Nt.whoosh(t.indexOf(l)>t.indexOf(c)),n.classList.remove("go"),n.offsetWidth,n.classList.add("go")))});let r=[...[...document.querySelectorAll(".opener, .knot-stage, #hero")].map(l=>({el:l,focus:1,op:!0})),...[...document.querySelectorAll(".track")].map(l=>({el:l,focus:.55,op:!1})),...[...document.querySelectorAll(".chapter-body")].map(l=>({el:l,focus:.24,op:!1})),{el:document.getElementById("credits"),focus:.7,op:!1}],s=[...document.querySelectorAll(".opener")],a=document.getElementById("letterbox"),o=0;vn(({dt:l,time:c})=>{let h=innerHeight/2,d=null;for(let v of r){let m=v.el.getBoundingClientRect();if(m.top<=h&&m.bottom>h){d=v;break}}let u=d?d.focus:.4;document.body.classList.toggle("op-active",!!d&&d.op),Ld.visible=!!d&&d.op;let f=0;for(let v of s){let m=Number(v.style.getPropertyValue("--p")||0);f=Math.max(f,fg(.36,.48,m)*(1-fg(.86,.98,m)))}a.style.setProperty("--lb",f.toFixed(3));let g=pg((Xn.speed-2600)/7e3,0,1);Xn.speed>9e3&&(o+=l,o>.35&&(o=-99,Qt("warp",{message:"超光速！视场被拉伸，色散加剧。（v > c 只在滚动条里成立。）"}))),e&&(e.setFocus(u),e.setWarp(g),e.setMouse(Zt.nx,Zt.ny,Zt.inside&&!Yt.coarse),e.frame(l,c))}),St.on("fx-euler",()=>Fd(Fn("e^{i\\pi}+1=0",!0),"EULER · 1748")),St.on("fx-144",()=>Fd(Fn("144=F_{12}=12^2",!0),"THE ONLY NONTRIVIAL SQUARE FIBONACCI NUMBER · COHN 1964")),St.on("fx-monster",()=>Fd(`<div class="fx-monster">|𝕄| = ${wd()}</div>`,"MONSTER GROUP · THE LARGEST SPORADIC SIMPLE GROUP")),x5(),nf(),tf(),e&&(e.setShape("galaxy",{instant:!0}),addEventListener("resize",()=>e.resize())),await dg(e,{onEnter:l=>{St.emit("sound",l),ig()}}),e&&e.warm(["latent","archive","filament"])}b5();})();
/*! For license information please see app.js.LEGAL.txt */
