// Browser demonstration metadata; layout weights are illustrative, not publication counts.
export const SNAPSHOT_DATE = '2026-10-13';
export const GITHUB = 'https://github.com/xhc144/claude-lab';
export const OCW_MATH = [['概率论', 100], ['常微分方程与动力系统', 150], ['复映射', 200], ['纽结', 120]];
export const OCW_PHYSICS = [['量子力学', 160], ['量子场论', 80], ['双摆', 130]];
export const OCW_TOTALS = { mathBooks: 4, mathPages: 570, physBooks: 3, physPages: 370 };
export const PAPERS = [
 {key:'COMPLEX',zh:'复映射',pages:4,unit:'2',note:'相位、模长与映射'},
 {key:'KNOT',zh:'纽结',pages:3,unit:'3',note:'三叶结与曲面'},
 {key:'DYNAMICS',zh:'动力系统',pages:5,unit:'4',note:'双摆与轨迹'},
 {key:'AI',zh:'计算模型',pages:6,unit:'n',note:'神经网络与注意力'},
];
export const AI_ROUTE = ['选择仪器', '改变参数', '观察结果', '比较公式'];
export const PUBLIC_REPOS = [{
 name:'claude-lab',title:'Claude 实验仓库',tag:'数学 · 游戏 · 影片',pushed:SNAPSHOT_DATE,
 blurb:'本仓库的交互数学、文明沙盒、体素冒险与程序化影片。',
 stats:[['静态交互项目',4,'个'],['程序化影片',2,'部']],url:GITHUB,site:'../'
}];
export const OWN_PROJECTS = [
 {title:'复映射',kind:'数学',state:'公开',note:'观察函数模长与相位',anchor:'#dim2'},
 {title:'三叶结与曲面',kind:'几何',state:'公开',note:'拖动视角与截面',anchor:'#dim3'},
 {title:'神经网络与注意力',kind:'计算',state:'公开',note:'观察训练与权重',anchor:'#dimn'},
];
export const ACTIVITY = {'周期 A':{'2026-10-01':2,'2026-10-03':4,'2026-10-05':2,'2026-10-07':4},'周期 B':{'2026-10-02':3,'2026-10-04':1,'2026-10-06':3,'2026-10-08':1}};
