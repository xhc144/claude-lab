import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { guideTopics, type GuideConfig } from "./guides";

type Page = "首页" | "渠道管理" | "模型管理" | "密钥管理" | "调用记录" | "费用分析" | "客户端配置" | "使用说明" | "设置";
type Status = { running: boolean; host: string; port: number; baseUrl: string; modelCount: number; todayRequests: number; todayTokens: number; latestError?: string };
type Channel = { id: string; name: string; provider: string; baseUrl: string; models: string; modelMapping: string; priority: number; weight: number; enabled: boolean; timeoutSeconds: number; maxRetries: number; status: string; hasApiKey: boolean };
type Model = { id: string; unifiedName: string; channelId: string; upstreamModel: string; fallbackChannelId?: string; channelIds: string[]; contextLength: number; cachedInputPrice?: number; inputPrice: number; outputPrice: number; currency: string; priceSource: string; priceUpdatedAt?: string; enabled: boolean };
type ClientKey = { id: string; name: string; keyPrefix: string; keyValue?: string; enabled: boolean; createdAt: string };
type Settings = { listenHost: string; port: number; autoStartGateway: boolean; minimizeToTray: boolean; startOnBoot: boolean; theme: string; logLevel: string };
type PriceItem = { provider:string; model:string; cachedInputPrice?:number; inputPrice:number; outputPrice:number; cacheWritePrice?:number; cacheStoragePrice?:number; extraCharges:string; currency:string; contextLength:number; sourceUrl:string; updatedAt:string };
type PriceSyncResult = { items:PriceItem[]; updatedModels:number; failedSources:string[]; syncedAt:string };
type AutoMappingResult = { created:number; reprioritized:number; alreadyExisting:number };
type CostBucket = { label:string; requests:number; inputTokens:number; cachedInputTokens:number; outputTokens:number; cost:number };
type CostAnalytics = { todayCost:number; monthCost:number; totalCost:number; totalRequests:number; currency:string; seconds:CostBucket[]; minutes:CostBucket[]; hours:CostBucket[]; days:CostBucket[]; models:CostBucket[] };
type ChannelPreset = { label:string; provider:string; baseUrl:string; models:string };
const pages: Page[] = ["首页", "渠道管理", "模型管理", "密钥管理", "调用记录", "费用分析", "客户端配置", "使用说明", "设置"];
const channelPresets: ChannelPreset[] = [
  {label:"DeepSeek 官方",provider:"DeepSeek",baseUrl:"https://api.deepseek.com",models:"deepseek-v4-flash, deepseek-v4-pro"},
  {label:"Kimi 中国版",provider:"Kimi / Moonshot",baseUrl:"https://api.moonshot.cn",models:"kimi-k3, kimi-k2.7-code, kimi-k2.7-code-highspeed, kimi-k2.6"},
  {label:"Kimi 国际版",provider:"Kimi / Moonshot",baseUrl:"https://api.moonshot.ai",models:"kimi-k3, kimi-k2.7-code, kimi-k2.7-code-highspeed, kimi-k2.6"},
  {label:"OpenAI 官方",provider:"OpenAI",baseUrl:"https://api.openai.com/v1",models:""},
  {label:"通义千问兼容接口",provider:"通义千问",baseUrl:"https://dashscope.aliyuncs.com/compatible-mode/v1",models:""},
  {label:"智谱 GLM 兼容接口",provider:"智谱 GLM",baseUrl:"https://open.bigmodel.cn/api/paas/v4",models:""},
  {label:"NewAPI / One-API 中转站",provider:"NewAPI / One-API",baseUrl:"",models:""},
];
const blankChannel = (): Channel => ({ id: "", name: "", provider: "OpenAI Compatible", baseUrl: "", models: "", modelMapping: "", priority: 100, weight: 1, enabled: true, timeoutSeconds: 60, maxRetries: 1, status: "未测试", hasApiKey: false });
const blankModel = (): Model => ({ id: "", unifiedName: "", channelId: "", upstreamModel: "", fallbackChannelId: undefined, channelIds: [], contextLength: 128000, cachedInputPrice:undefined, inputPrice: 0, outputPrice: 0, currency:"USD", priceSource:"手动", priceUpdatedAt:undefined, enabled: true });

export default function App() {
  const [page, setPage] = useState<Page>("首页"); const [status, setStatus] = useState<Status>(); const [channels, setChannels] = useState<Channel[]>([]); const [models, setModels] = useState<Model[]>([]); const [keys, setKeys] = useState<ClientKey[]>([]); const [logs, setLogs] = useState<any[]>([]); const [settings, setSettings] = useState<Settings>(); const [prices, setPrices] = useState<PriceItem[]>([]); const [analytics, setAnalytics] = useState<CostAnalytics>(); const [notice, setNotice] = useState("");
  const [channelForm, setChannelForm] = useState<Channel | null>(null); const [channelSecret, setChannelSecret] = useState(""); const [autoCreateMappings,setAutoCreateMappings]=useState(true); const [modelForm, setModelForm] = useState<Model | null>(null); const [keyName, setKeyName] = useState(""); const [createdKey, setCreatedKey] = useState("");
  const refresh = async () => { try { const [s, c, m, k, l, st, p, a] = await Promise.all([invoke<Status>("get_gateway_status"), invoke<Channel[]>("list_channels"), invoke<Model[]>("list_model_mappings"), invoke<ClientKey[]>("list_client_keys"), invoke<any[]>("list_call_logs"), invoke<Settings>("get_settings"), invoke<PriceItem[]>("list_price_catalog"), invoke<CostAnalytics>("get_cost_analytics")]); setStatus(s); setChannels(c); setModels(m); setKeys(k); setLogs(l); setSettings(st); setPrices(p); setAnalytics(a); } catch (e) { setNotice(String(e)); } };
  useEffect(() => { refresh(); const id = window.setInterval(refresh, 3000); return () => clearInterval(id); }, []);
  const copy = (value: string) => navigator.clipboard.writeText(value).then(() => setNotice("已复制到剪贴板"));
  const run = async (command: string) => { try { await invoke(command); await refresh(); setNotice("操作完成"); } catch (e) { setNotice(String(e)); } };
  const applyChannelPreset = (preset: ChannelPreset) => {
    setChannelForm({...blankChannel(), name:preset.label, provider:preset.provider, baseUrl:preset.baseUrl, models:preset.models});
    setChannelSecret("");
    setAutoCreateMappings(true);
    setNotice(`已自动填写“${preset.label}”的渠道名称、服务商、Base URL 和常用模型；请补充标有“必填”的 API Key。`);
  };
  const saveChannelForm = async () => {
    if (!channelForm) return;
    if (!channelForm.name.trim()) return setNotice("请填写必填项：渠道名称");
    if (!channelForm.provider.trim()) return setNotice("请填写必填项：服务商类型");
    if (!channelForm.baseUrl.trim()) return setNotice("请填写必填项：上游 Base URL");
    try {
      const url = new URL(channelForm.baseUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return setNotice("上游 Base URL 格式不正确，应以 http:// 或 https:// 开头");
    }
    if (!channelForm.hasApiKey && !channelSecret.trim()) return setNotice("请填写必填项：API Key");
    try {
      const mapped=await invoke<AutoMappingResult>("save_channel", { channel: channelForm, apiKey: channelSecret || null, autoCreateMappings });
      setChannelForm(null);
      await refresh();
      setNotice(`渠道已保存；自动新建 ${mapped.created} 个同名映射，调整 ${mapped.reprioritized} 个首选渠道`);
    } catch(e) {
      setNotice(String(e));
    }
  };
  const syncChannelPrice = async (channelId:string) => { const result=await invoke<PriceSyncResult>("sync_channel_pricing",{channelId}); await refresh(); setNotice(`已读取 ${result.items.length} 个模型价格，并更新 ${result.updatedModels} 个模型映射`); return result; };
  const syncAllPrices = async () => { let ok=0,failed=0,modelsUpdated=0; for(const channel of channels){try{const r=await invoke<PriceSyncResult>("sync_channel_pricing",{channelId:channel.id});ok++;modelsUpdated+=r.updatedModels}catch{failed++}} await refresh(); setNotice(`价格同步完成：${ok} 个渠道成功，${failed} 个渠道不支持，更新 ${modelsUpdated} 个模型映射`); };
  const effectiveChannelIds = (model:Model) => {
    if (model.channelIds?.length) return [...new Set(model.channelIds)].filter(id=>channels.some(c=>c.id===id));
    const automatic = channels
      .filter(c=>c.id!==model.channelId && c.id!==model.fallbackChannelId && c.models.split(",").some(name=>name.trim().toLowerCase()===model.upstreamModel.toLowerCase()))
      .sort((a,b)=>a.priority-b.priority)
      .map(c=>c.id);
    return [...new Set([model.channelId, model.fallbackChannelId, ...automatic].filter(Boolean) as string[])];
  };
  const openModelForm = (model:Model) => {
    const channelIds=effectiveChannelIds(model);
    setModelForm({...model,channelIds,channelId:channelIds[0]||"",fallbackChannelId:channelIds[1]});
  };
  const config = useMemo(() => { const key = createdKey || keys[0]?.keyPrefix || "在密钥管理中创建"; const url = status?.baseUrl || "http://127.0.0.1:8787/v1"; const model = models[0]?.unifiedName || "你的统一模型名"; return { key, url, model }; }, [status, keys, models, createdKey]);
  return <div className="app"><aside><div className="brand"><b>LM</b><span>大模型统一 API 网关<small>本地桌面版</small></span></div><nav>{pages.map(p => <button key={p} className={page === p ? "active" : ""} onClick={() => setPage(p)}>{p}</button>)}</nav><div className="side-status"><i className={status?.running ? "on" : "off"}/>{status?.running ? "网关运行中" : "网关未运行"}</div></aside><main><header><div><h1>{page}</h1><p>{status?.baseUrl || "正在读取本地服务配置"}</p></div><button className="icon" title="刷新" onClick={refresh}>↻</button></header>{notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}
    {page === "首页" && <Home status={status} copy={copy} run={run}/>}
    {page === "渠道管理" && <section>
      <div className="toolbar"><p>选择模板会自动填写渠道名称、服务商、Base URL 和常用模型；你只需补充带“* 必填”的信息。</p><div><select className="preset-select" defaultValue="" onChange={e=>{const preset=channelPresets[+e.target.value];if(preset)applyChannelPreset(preset);e.target.value=""}}><option value="" disabled>选择常用渠道并自动填写</option>{channelPresets.map((p,i)=><option value={i} key={p.label}>{p.label}</option>)}</select><button onClick={() => { setChannelForm(blankChannel()); setChannelSecret(""); setAutoCreateMappings(true); }}>自定义渠道</button></div></div>
      <div className="priority-note"><b>优先级：</b>默认渠道先尝试；失败后，支持同一上游模型的其他渠道按数字从小到大依次尝试。数字越小，备用顺序越靠前。</div>
      <Table headers={["渠道", "服务商", "地址", "模型", "优先级", "状态", "操作"]}>{channels.map(c => <tr key={c.id}><td>{c.name}<small>{c.enabled ? "已启用" : "已禁用"}</small></td><td>{c.provider}</td><td className="mono">{c.baseUrl}</td><td>{c.models || "-"}</td><td>{c.priority}</td><td><span className={c.status === "正常" ? "tag success" : "tag"}>{c.status}</span></td><td><button className="link" onClick={() => { setChannelForm(c); setChannelSecret(""); setAutoCreateMappings(true); }}>编辑</button><button className="link" onClick={async () => { try { const r = await invoke<string>("test_channel", { id: c.id }); setNotice(`连接测试：${r}`); refresh(); } catch(e) { setNotice(String(e)); }}}>测试</button><button className="link" onClick={()=>syncChannelPrice(c.id).catch(e=>setNotice(String(e)))}>查价格</button><button className="link" onClick={async()=>{try{const r=await invoke<AutoMappingResult>("auto_create_model_mappings",{channelId:c.id});await refresh();setNotice(`映射完成：新建 ${r.created} 个，调整首选渠道 ${r.reprioritized} 个，已有 ${r.alreadyExisting} 个`)}catch(e){setNotice(String(e))}}}>自动加映射</button><button className="link danger" onClick={() => { if(confirm(`删除渠道“${c.name}”？`)) invoke("delete_channel", {id:c.id}).then(refresh); }}>删除</button></td></tr>)}</Table>
      {channelForm && <Modal title={channelForm.id ? "编辑渠道" : "添加渠道"} close={() => setChannelForm(null)}>
        {!channelForm.id && <div className="preset-inside"><label><b>渠道模板</b><span>选择后自动填写下面的信息</span></label><select defaultValue="" onChange={e=>{const preset=channelPresets[+e.target.value];if(preset)applyChannelPreset(preset)}}><option value="" disabled>请选择 DeepSeek、Kimi 或其他渠道</option>{channelPresets.map((p,i)=><option value={i} key={p.label}>{p.label}</option>)}</select></div>}
        <div className="required-legend"><b>* 必填</b><span>模板已经能填写的内容会自动带入；API Key 必须由你自己提供。</span></div>
        <FormGrid><Input required label="渠道名称" value={channelForm.name} set={v => setChannelForm({...channelForm,name:v})} hint="用于在本应用中识别这个渠道"/><Select required label="服务商类型" value={channelForm.provider} set={v => setChannelForm({...channelForm,provider:v})} options={["OpenAI Compatible","NewAPI / One-API","OpenAI","DeepSeek","Kimi / Moonshot","通义千问","智谱 GLM"]}/><Input required label="供应商 Base URL" value={channelForm.baseUrl} set={v => setChannelForm({...channelForm,baseUrl:v})} placeholder="https://api.example.com/v1" hint={channelForm.provider==="NewAPI / One-API" ? "中转站地址各不相同，需要填写你自己的站点地址" : "模板会自动填写，通常不需要修改"}/><Input required={!channelForm.hasApiKey} label="API Key" value={channelSecret} set={setChannelSecret} type="password" placeholder={channelForm.hasApiKey ? "已保存，留空则不修改" : "粘贴服务商或中转站提供的 API Key"} hint={channelForm.hasApiKey ? "已经保存；留空会保留原密钥" : "模板无法替你获取密钥，必须自行申请并填写"}/><Input label="支持模型（选填）" value={channelForm.models} set={v => setChannelForm({...channelForm,models:v})} placeholder="模型之间用英文逗号分隔" hint="每个名称会自动建立“xhc-模型名 → 供应商实际模型名”映射"/><Input label="优先级（已有默认值）" value={String(channelForm.priority)} set={v => setChannelForm({...channelForm,priority:+v||0})} type="number" hint="数字越小，作为备用渠道时越早尝试"/><Input label="超时秒数（已有默认值）" value={String(channelForm.timeoutSeconds)} set={v => setChannelForm({...channelForm,timeoutSeconds:+v||60})} type="number"/><Check label="启用渠道" checked={channelForm.enabled} set={v => setChannelForm({...channelForm,enabled:v})}/><Check label="保存后自动创建模型映射" checked={autoCreateMappings} set={setAutoCreateMappings}/></FormGrid><p className="form-help">例如支持模型填写 <code>kimi-k3</code>，保存后会自动创建 <code>xhc-kimi-k3 → kimi-k3</code>。统一名称给你的客户端使用；右侧是真正发给供应商的模型名。</p><footer><button className="secondary" onClick={() => setChannelForm(null)}>取消</button><button onClick={saveChannelForm}>保存渠道</button></footer>
      </Modal>}
    </section>}
    {page === "模型管理" && <section>
      <div className="toolbar"><p><b>按模型选择渠道：</b>每个模型都可以独立勾选任意数量的渠道并调整调用顺序。第 1 个先调用，失败后按 2、3、4…依次切换。</p><button onClick={() => {const first=channels.find(c=>c.enabled)?.id||channels[0]?.id||"";setModelForm({...blankModel(),channelId:first,channelIds:first?[first]:[]})}}>手动添加模型映射</button></div>
      <div className="priority-note"><b>模型渠道顺序：</b>这里的顺序只对当前模型生效，不再受“渠道管理”中的全局优先级限制。没有勾选的渠道不会用于该模型。</div>
      <Table headers={["统一名称", "供应商实际模型", "模型渠道顺序（故障切换）", "缓存命中", "普通输入", "输出", "价格来源", "状态", "操作"]}>{models.map(m => {const ordered=effectiveChannelIds(m).map(id=>channels.find(c=>c.id===id)).filter(Boolean) as Channel[];return <tr key={m.id}><td className="mono">{m.unifiedName}</td><td>{m.upstreamModel}</td><td className="model-route-cell">{ordered.length?ordered.map((c,i)=><span key={c.id} className={i===0?"route-chip primary":"route-chip"}><b>{i+1}</b>{c.name}{!c.enabled&&<em>已禁用</em>}</span>):<span className="muted">未选择渠道</span>}</td><td>{m.cachedInputPrice==null?"—":`$${m.cachedInputPrice.toFixed(4)}`}</td><td>${m.inputPrice.toFixed(4)}</td><td>${m.outputPrice.toFixed(4)}</td><td><small>{m.priceSource || "手动"}{m.priceUpdatedAt&&<><br/>{m.priceUpdatedAt}</>}</small></td><td><span className={m.enabled ? "tag success" : "tag"}>{m.enabled ? "已启用" : "已禁用"}</span></td><td><button className="link" onClick={()=>openModelForm(m)}>编辑渠道</button><button className="link danger" onClick={()=>confirm(`删除模型映射“${m.unifiedName}”？`) && invoke("delete_model_mapping",{id:m.id}).then(refresh)}>删除</button></td></tr>})}</Table>
      {modelForm && <Modal title={modelForm.id ? "编辑模型与渠道" : "添加模型与渠道"} close={()=>setModelForm(null)}>
        <FormGrid><Input label="统一模型名称" value={modelForm.unifiedName} set={v=>setModelForm({...modelForm,unifiedName:v})} placeholder="自动加上 xhc- 前缀" hint="这是客户端填写的名称；保存时会自动补上 xhc-"/><Input label="供应商实际模型名称" value={modelForm.upstreamModel} set={v=>setModelForm({...modelForm,upstreamModel:v})} placeholder="例如 gpt-5.6"/><Input label="上下文长度" value={String(modelForm.contextLength)} set={v=>setModelForm({...modelForm,contextLength:+v||0})} type="number"/><Check label="启用模型" checked={modelForm.enabled} set={v=>setModelForm({...modelForm,enabled:v})}/></FormGrid>
        <ChannelOrderEditor channels={channels} value={modelForm.channelIds||[]} set={channelIds=>setModelForm({...modelForm,channelIds,channelId:channelIds[0]||"",fallbackChannelId:channelIds[1]})}/>
        <FormGrid><Input label="缓存命中输入价（选填）" value={modelForm.cachedInputPrice==null?"":String(modelForm.cachedInputPrice)} set={v=>setModelForm({...modelForm,cachedInputPrice:v===""?undefined:+v,priceSource:"手动",priceUpdatedAt:undefined})} type="number" hint="供应商没有缓存优惠时留空"/><Input label="普通输入价（缓存未命中）" value={String(modelForm.inputPrice)} set={v=>setModelForm({...modelForm,inputPrice:+v||0,priceSource:"手动",priceUpdatedAt:undefined})} type="number"/><Input label="输出价（USD/百万 Token）" value={String(modelForm.outputPrice)} set={v=>setModelForm({...modelForm,outputPrice:+v||0,priceSource:"手动",priceUpdatedAt:undefined})} type="number"/></FormGrid>
        <p className="form-help">可选择 1～多个渠道。列表中的第 1 个是首选，后面全部是备用；上移、下移即可为这个模型单独调整故障切换顺序。</p>
        <div className="price-actions"><button className="secondary" disabled={!modelForm.channelIds?.length} onClick={async()=>{try{const first=modelForm.channelIds[0];const r=await syncChannelPrice(first);const price=r.items.find(p=>p.model.toLowerCase()===modelForm.upstreamModel.toLowerCase());if(price){setModelForm({...modelForm,channelId:first,cachedInputPrice:price.cachedInputPrice,inputPrice:price.inputPrice,outputPrice:price.outputPrice,currency:price.currency,priceSource:price.sourceUrl,priceUpdatedAt:price.updatedAt});setNotice(`已套用 ${price.model} 的渠道价格`)}else{setNotice("已读取首个渠道价格，但没有找到同名模型")}}catch(e){setNotice(String(e))}}}>从第 1 个渠道查询并套用价格</button><span>{modelForm.priceSource==="手动"?"保存时若价格为 0，会自动匹配内置官方参考价":`来源：${modelForm.priceSource}`}</span></div>
        <footer><button className="secondary" onClick={()=>setModelForm(null)}>取消</button><button onClick={async()=>{if(!modelForm.channelIds?.length)return setNotice("请至少为这个模型选择一个渠道");try{await invoke("save_model_mapping",{model:modelForm});setModelForm(null);await refresh();setNotice("模型渠道顺序已保存")}catch(e){setNotice(String(e))}}}>保存模型渠道</button></footer>
      </Modal>}
    </section>}
    {page === "密钥管理" && <section><div className="toolbar"><p>客户端只获得此处生成的网关密钥，无法读取上游 API Key。</p><div><input value={keyName} onChange={e=>setKeyName(e.target.value)} placeholder="客户端名称，例如 Trae"/><button onClick={async()=>{if(!keyName.trim())return setNotice("请填写客户端名称");const k=await invoke<ClientKey>("create_client_key",{name:keyName});setCreatedKey(k.keyValue||"");setKeyName("");refresh();}}>生成密钥</button></div></div>{createdKey && <div className="key-reveal"><b>请立即复制，新密钥仅显示一次：</b><code>{createdKey}</code><button onClick={()=>copy(createdKey)}>复制</button><button className="secondary" onClick={()=>setCreatedKey("")}>关闭</button></div>}<Table headers={["名称", "密钥前缀", "状态", "创建时间", "操作"]}>{keys.map(k=><tr key={k.id}><td>{k.name}</td><td className="mono">{k.keyPrefix}...</td><td><span className="tag success">已启用</span></td><td>{k.createdAt}</td><td><button className="link danger" onClick={()=>confirm(`删除密钥“${k.name}”？`) && invoke("delete_client_key",{id:k.id}).then(refresh)}>删除</button></td></tr>)}</Table></section>}
    {page === "调用记录" && <section><div className="toolbar"><p>仅记录路由与用量元数据，不保存提示词、代码正文或模型回复。</p><button className="secondary" onClick={refresh}>刷新</button></div><Table headers={["时间", "客户端", "统一模型", "实际上游", "输入/缓存/输出", "估算费用", "耗时", "路由", "状态", "错误"]}>{logs.map(l=><tr key={l.id}><td>{l.createdAt}</td><td>{l.clientKeyPrefix}</td><td>{l.requestedModel}</td><td>{l.upstreamModel}</td><td>{l.status.includes("用量未知")?"未获取":<>{l.inputTokens.toLocaleString()} / {Number(l.cachedInputTokens||0).toLocaleString()} / {l.outputTokens.toLocaleString()}</>}</td><td>{l.status.includes("用量未知")?"—":`$${Number(l.estimatedCost||0).toFixed(6)}`}</td><td>{l.latencyMs} ms</td><td>{l.failover?"已切换":"首选"}</td><td><span className={l.status === "成功" ? "tag success" : "tag"}>{l.status}</span></td><td>{l.errorMessage || "-"}</td></tr>)}</Table></section>}
    {page === "费用分析" && <CostView analytics={analytics} prices={prices} channels={channels} models={models} syncAll={syncAllPrices}/>}
    {page === "客户端配置" && <Config config={config} copy={copy}/>}
    {page === "使用说明" && <Guide config={config}/>}
    {page === "设置" && settings && <section className="settings"><FormGrid><Input label="监听地址" value={settings.listenHost} set={v=>setSettings({...settings,listenHost:v})}/><Input label="服务端口" value={String(settings.port)} type="number" set={v=>setSettings({...settings,port:+v||8787})}/><Select label="界面主题" value={settings.theme} set={v=>setSettings({...settings,theme:v})} options={["system|跟随系统","light|浅色","dark|深色"]}/><Select label="日志级别" value={settings.logLevel} set={v=>setSettings({...settings,logLevel:v})} options={["info|信息","warn|警告","error|错误"]}/><Check label="启动软件时自动启动网关" checked={settings.autoStartGateway} set={v=>setSettings({...settings,autoStartGateway:v})}/><Check label="关闭窗口时最小化到托盘" checked={settings.minimizeToTray} set={v=>setSettings({...settings,minimizeToTray:v})}/><Check label="开机自动启动" checked={settings.startOnBoot} set={v=>setSettings({...settings,startOnBoot:v})}/></FormGrid><footer><button onClick={async()=>{await invoke("save_settings",{settings});setNotice("设置已保存。监听地址或端口变更后请重启网关。");}}>保存设置</button><button className="secondary" onClick={()=>run("restart_gateway")}>重启网关</button></footer><p className="muted">数据位置：`%APPDATA%\LocalModelGateway\gateway.db`。备份时请先停止网关后复制该文件；上游密钥由 Windows 凭据管理器单独保护。</p></section>}
  </main></div>;
}
function Home({status,copy,run}:{status?:Status;copy:(s:string)=>void;run:(s:string)=>void}){return <section><div className="hero"><div><span className={status?.running?"dot on":"dot off"}/><h2>{status?.running?"本地 API 网关正在运行":"本地 API 网关已停止"}</h2><p>仅监听本机地址，客户端通过统一接口使用已配置的模型。</p></div><div className="actions">{status?.running?<button className="danger-btn" onClick={()=>run("stop_gateway")}>停止服务</button>:<button onClick={()=>run("start_gateway")}>启动服务</button>}<button className="secondary" onClick={()=>run("restart_gateway")}>重启服务</button></div></div><div className="stats"><Card name="统一 Base URL" value={status?.baseUrl||"-"} action="复制" onClick={()=>status&&copy(status.baseUrl)}/><Card name="当前可用模型" value={String(status?.modelCount||0)}/><Card name="今日调用次数" value={String(status?.todayRequests||0)}/><Card name="今日 Token" value={(status?.todayTokens||0).toLocaleString()}/></div><div className="panel"><h3>最近错误</h3><p className={status?.latestError?"error":"muted"}>{status?.latestError||"暂无错误记录"}</p><div className="endpoint"><span>监听地址</span><code>{status?.host}:{status?.port}</code><span>OpenAI 兼容接口</span><code>GET /v1/models · POST /v1/chat/completions</code></div></div></section>}
function Card({name,value,action,onClick}:{name:string;value:string;action?:string;onClick?:()=>void}){return <div className="card"><span>{name}</span><strong className={name.includes("URL")?"mono url":""}>{value}</strong>{action&&<button className="link" onClick={onClick}>{action}</button>}</div>}
type LineSeries = {label:string;color:string;value:(row:CostBucket)=>number};
function UsageLineChart({title,data,series,formatValue}:{title:string;data:CostBucket[];series:LineSeries[];formatValue:(v:number)=>string}){
  if(!data.length)return <div className="panel chart-panel"><h3>{title}</h3><p className="empty-state">还没有调用数据。完成一次非流式 API 调用后，这里会自动出现折线图。</p></div>;
  const width=760,height=250,left=58,right=20,top=22,bottom=42,plotW=width-left-right,plotH=height-top-bottom;
  const max=Math.max(1,...data.flatMap(row=>series.map(s=>s.value(row))));
  const x=(i:number)=>data.length===1?left+plotW/2:left+i*plotW/(data.length-1);
  const y=(v:number)=>top+plotH-(v/max)*plotH;
  const labelStep=Math.max(1,Math.ceil(data.length/6));
  return <div className="panel chart-panel"><div className="chart-heading"><h3>{title}</h3><div className="line-legend">{series.map(s=><span key={s.label}><i style={{background:s.color}}/>{s.label}</span>)}</div></div><svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
    {[0,.25,.5,.75,1].map(r=><g key={r}><line x1={left} x2={width-right} y1={top+plotH*r} y2={top+plotH*r} className="chart-grid"/><text x={left-8} y={top+plotH*r+4} textAnchor="end">{formatValue(max*(1-r))}</text></g>)}
    {data.map((row,i)=>(i%labelStep===0||i===data.length-1)&&<text key={row.label} x={x(i)} y={height-14} textAnchor="middle">{row.label.slice(5)}</text>)}
    {series.map(s=><g key={s.label}><path d={data.map((row,i)=>`${i?"L":"M"} ${x(i)} ${y(s.value(row))}`).join(" ")} fill="none" stroke={s.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>{data.map((row,i)=><circle key={row.label} cx={x(i)} cy={y(s.value(row))} r="4" fill={s.color}><title>{row.label} · {s.label}：{formatValue(s.value(row))}</title></circle>)}</g>)}
  </svg></div>
}
const priceKey=(price:PriceItem)=>`${price.provider}\u0000${price.model}`;
const money=(price:PriceItem,value?:number)=>value==null?"—":`${price.currency==="CNY"?"¥":"$"}${value.toFixed(6)}`;
function PriceTable({items,hidden,showHidden,toggleHidden,empty}:{items:PriceItem[];hidden:Set<string>;showHidden:boolean;toggleHidden:(key:string)=>void;empty:string}){
  const visible=items.filter(item=>showHidden||!hidden.has(priceKey(item)));
  if(!visible.length)return <div className="empty price-empty">{empty}</div>;
  return <Table headers={["渠道 / 分组","模型","缓存命中输入","普通输入","输出","缓存写入","其他收费","操作"]}>{visible.map(p=>{
    const key=priceKey(p);const isHidden=hidden.has(key);
    return <tr key={key} className={isHidden?"price-hidden":""}><td>{p.provider}<small>{p.updatedAt}</small></td><td className="mono">{p.model}</td><td>{money(p,p.cachedInputPrice)}</td><td>{money(p,p.inputPrice)}</td><td>{money(p,p.outputPrice)}</td><td>{money(p,p.cacheWritePrice)}</td><td className="price-notes">{p.extraCharges||"无单列项目"}<small className="source-cell">{p.sourceUrl}</small></td><td><button className="link" onClick={()=>toggleHidden(key)}>{isHidden?"恢复":"隐藏"}</button></td></tr>
  })}</Table>;
}
type CostPanel = "tokens" | "cost" | "models" | "prices" | "formula";
type CostGranularity = "seconds" | "minutes" | "hours" | "days";
const granularityOptions:{key:CostGranularity;label:string;hint:string}[]=[
  {key:"seconds",label:"每秒",hint:"最近 120 个有调用的秒"},
  {key:"minutes",label:"每分钟",hint:"最近 120 个有调用的分钟"},
  {key:"hours",label:"每小时",hint:"最近 72 个有调用的小时"},
  {key:"days",label:"每天",hint:"最近 30 个有调用的日期"},
];
function CostView({analytics,prices,channels,models,syncAll}:{analytics?:CostAnalytics;prices:PriceItem[];channels:Channel[];models:Model[];syncAll:()=>Promise<void>}){
  const [panel,setPanel]=useState<CostPanel>("tokens");
  const [granularity,setGranularity]=useState<CostGranularity>("minutes");
  const [priceSearch,setPriceSearch]=useState("");
  const [showHidden,setShowHidden]=useState(false);
  const [hidden,setHidden]=useState<Set<string>>(()=>{try{return new Set(JSON.parse(localStorage.getItem("gateway-hidden-prices-v1")||"[]"))}catch{return new Set()}});
  const toggleHidden=(key:string)=>setHidden(previous=>{const next=new Set(previous);next.has(key)?next.delete(key):next.add(key);localStorage.setItem("gateway-hidden-prices-v1",JSON.stringify([...next]));return next});
  const filtered=prices.filter(p=>`${p.provider} ${p.model} ${p.sourceUrl}`.toLowerCase().includes(priceSearch.trim().toLowerCase()));
  const joined=filtered.filter(price=>channels.some(channel=>{
    let sameSource=price.provider.toLowerCase()===channel.name.toLowerCase()||price.provider.toLowerCase().startsWith(`${channel.name.toLowerCase()} ·`);
    try{sameSource=sameSource||new URL(price.sourceUrl).hostname===new URL(channel.baseUrl).hostname}catch{}
    if(!sameSource)return false;
    const added=new Set(channel.models.split(",").map(item=>item.trim().toLowerCase()).filter(Boolean));
    models.filter(model=>model.channelIds?.includes(channel.id)||model.channelId===channel.id).forEach(model=>added.add(model.upstreamModel.trim().toLowerCase()));
    return added.has(price.model.toLowerCase());
  }));
  const trendData=analytics?.[granularity]||[];
  const selectedGranularity=granularityOptions.find(item=>item.key===granularity)!;
  const panels:{key:CostPanel;label:string}[]=[{key:"tokens",label:"Token 趋势"},{key:"cost",label:"费用趋势"},{key:"models",label:"模型汇总"},{key:"prices",label:"价格目录"},{key:"formula",label:"计费说明"}];
  return <section className="cost-view">
    <div className="toolbar"><div><h2>费用估算与价格目录</h2><p>根据渠道公开价格和 API 返回的实际 Token 计算；下方功能按按钮选择打开，不再全部堆在同一页面。</p></div><button disabled={!channels.length} onClick={()=>syncAll()}>同步全部渠道价格</button></div>
    <div className="stats cost-stats"><Card name="今日估算" value={`$${(analytics?.todayCost||0).toFixed(6)}`}/><Card name="本月估算" value={`$${(analytics?.monthCost||0).toFixed(6)}`}/><Card name="累计估算" value={`$${(analytics?.totalCost||0).toFixed(6)}`}/><Card name="已计费调用" value={String(analytics?.totalRequests||0)}/></div>
    <div className="cost-panel-tabs" role="tablist">{panels.map(item=><button key={item.key} className={panel===item.key?"active":"secondary"} onClick={()=>setPanel(item.key)}>{item.label}</button>)}</div>
    {(panel==="tokens"||panel==="cost")&&<>
      <div className="cost-granularity"><div><b>统计粒度</b><span>{selectedGranularity.hint}</span></div><div>{granularityOptions.map(item=><button key={item.key} className={granularity===item.key?"active":"secondary"} onClick={()=>setGranularity(item.key)}>{item.label}</button>)}</div></div>
      {panel==="tokens"&&<UsageLineChart title={`Token 使用量（${selectedGranularity.label}）`} data={trendData} series={[{label:"总输入 Token",color:"#208a7b",value:d=>d.inputTokens},{label:"其中缓存命中",color:"#d69a35",value:d=>d.cachedInputTokens||0},{label:"输出 Token",color:"#526fb4",value:d=>d.outputTokens}]} formatValue={v=>Math.round(v).toLocaleString()}/>}
      {panel==="cost"&&<UsageLineChart title={`预估费用（${selectedGranularity.label}）`} data={trendData} series={[{label:"预估费用",color:"#c94f4f",value:d=>d.cost}]} formatValue={v=>`$${v<0.01?v.toFixed(6):v.toFixed(3)}`}/>}
    </>}
    {panel==="models"&&<div className="panel"><h3>按模型汇总</h3><Table headers={["模型","调用次数","输入 Token","缓存命中","输出 Token","估算费用"]}>{(analytics?.models||[]).map(m=><tr key={m.label}><td className="mono">{m.label}</td><td>{m.requests}</td><td>{m.inputTokens.toLocaleString()}</td><td>{(m.cachedInputTokens||0).toLocaleString()}</td><td>{m.outputTokens.toLocaleString()}</td><td>${m.cost.toFixed(6)}</td></tr>)}</Table></div>}
    {panel==="prices"&&<div className="panel price-catalog">
      <div className="price-catalog-head"><div><h3>价格目录</h3><p>按渠道中填写的“支持模型”区分已加入内容；同一模型在不同分组价格不同，会分别保留。</p></div><div className="price-tools"><input aria-label="搜索价格" value={priceSearch} onChange={e=>setPriceSearch(e.target.value)} placeholder="搜索渠道或模型"/><label><input type="checkbox" checked={showHidden} onChange={e=>setShowHidden(e.target.checked)}/> 显示已隐藏（{hidden.size}）</label></div></div>
      <section className="price-section"><h3>我加入的 <span>{joined.filter(item=>showHidden||!hidden.has(priceKey(item))).length}</span></h3><p>这里只显示“渠道管理”中已经填写或通过模型映射加入的模型。</p><PriceTable items={joined} hidden={hidden} showHidden={showHidden} toggleHidden={toggleHidden} empty={priceSearch?"没有匹配的已加入模型":"还没有找到已加入模型的价格，请先同步渠道价格或检查渠道里的支持模型。"}/></section>
      <details className="price-section all-prices"><summary>全部价格 <span>{filtered.filter(item=>showHidden||!hidden.has(priceKey(item))).length}</span></summary><p>需要时再点开完整目录；暂时不想看的项目可以逐条隐藏。</p><PriceTable items={filtered} hidden={hidden} showHidden={showHidden} toggleHidden={toggleHidden} empty="没有匹配的价格。"/></details>
    </div>}
    {panel==="formula"&&<div className="cost-formula"><b>含缓存的计算公式</b><code>费用 = 未命中输入 Token × 普通输入价 + 命中缓存 Token × 缓存命中价 + 输出 Token × 输出价（最后统一除以 1,000,000）</code><p>网关会读取常见的 <code>prompt_cache_hit_tokens</code> 或 <code>cached_tokens</code> 字段。缓存写入、缓存存储和工具调用只有供应商明确收费且 API 返回可识别用量时才应计入；目前会先完整展示，不会凭空估算。</p></div>}
  </section>;
}
function Config({config,copy}:{config:{url:string;key:string;model:string};copy:(s:string)=>void}){const snippets=[ ["Trae / Chatbox / Cherry Studio",`Base URL: ${config.url}\nAPI Key: ${config.key}\nModel: ${config.model}`], ["Python OpenAI SDK",`from openai import OpenAI\nclient = OpenAI(base_url="${config.url}", api_key="${config.key}")\nresponse = client.chat.completions.create(model="${config.model}", messages=[{"role":"user","content":"你好"}])`], ["curl",`curl ${config.url}/chat/completions -H "Authorization: Bearer ${config.key}" -H "Content-Type: application/json" -d "{\\"model\\":\\"${config.model}\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"你好\\"}]}"`], ["Claude Code / VS Code AI 插件",`使用 OpenAI Compatible 提供商\nBase URL: ${config.url}\nAPI Key: ${config.key}\nModel: ${config.model}`] ];return <section className="configs"><p>所有 OpenAI-compatible 客户端均填写完整的 Base URL（已含 `/v1`），不要再重复添加 `/v1`。</p>{snippets.map(([title,code])=><div className="panel" key={title}><h3>{title}</h3><pre>{code}</pre><button onClick={()=>copy(code)}>复制配置</button></div>)}</section>}
function Guide({config}:{config:GuideConfig}){
  const [topicId,setTopicId]=useState("start");
  const topic=guideTopics.find(item=>item.id===topicId)||guideTopics[0];
  const categories=[...new Set(guideTopics.map(item=>item.category))];
  return <section className="help-center">
    <aside className="help-nav"><div><b>使用说明</b><span>点击主题查看短篇说明</span></div>{categories.map(category=><section key={category}><h3>{category}</h3>{guideTopics.filter(item=>item.category===category).map(item=><button key={item.id} className={item.id===topic.id?"active":""} onClick={()=>setTopicId(item.id)}><b>{item.title}</b><small>{item.summary}</small></button>)}</section>)}</aside>
    <main className="help-content"><div className="help-breadcrumb">使用说明 <span>›</span> {topic.category} <span>›</span> {topic.title}</div>{topic.render({config})}<footer className="help-next">{guideTopics.map((item,index)=>item.id===topic.id&&guideTopics[index+1]?<button key={item.id} onClick={()=>setTopicId(guideTopics[index+1].id)}>下一篇：{guideTopics[index+1].title} →</button>:null)}</footer></main>
  </section>;
}
export function LegacyGuide({config}:{config:{url:string;key:string;model:string}}){return <section className="guide">
  <div className="guide-intro">
    <div><span className="guide-kicker">本地桌面版 · 快速上手</span><h2>把多个大模型服务统一成一个接口</h2><p>先配置上游渠道和模型映射，再为每个客户端生成独立的网关密钥。以后更换上游服务时，通常不需要逐个修改客户端。</p></div>
    <div className="guide-endpoint"><span>当前统一 Base URL</span><code>{config.url}</code><small>仅监听 127.0.0.1 时，只有本机可以访问。</small></div>
  </div>

  <div className="guide-section beginner">
    <h2>先用一句话理解 API</h2>
    <p className="lead">API 就像餐厅的点餐窗口：客户端把问题交给窗口，窗口把问题送到 AI 服务，再把答案原路带回来。你不需要了解它内部怎样工作，只需要填对“地址、钥匙和模型名称”。</p>
    <div className="term-grid">
      <article><b>Base URL</b><h3>服务地址</h3><p>相当于餐厅地址。客户端统一填写本机网关地址 <code>{config.url}</code>；渠道中则填写 DeepSeek、Kimi 或中转站给你的地址。</p></article>
      <article><b>API Key</b><h3>访问钥匙</h3><p>证明你有权使用服务。上游 Key 放在“渠道管理”，客户端使用“密钥管理”生成的网关 Key；两者不要混用。</p></article>
      <article><b>Model</b><h3>要使用的模型</h3><p>相当于点哪道菜。供应商的真实模型可能叫 <code>deepseek-v4-flash</code>，客户端使用统一名称 <code>xhc-deepseek-v4-flash</code>。</p></article>
      <article><b>Token</b><h3>计费文字单位</h3><p>AI 会把文字拆成许多小片段计数。多数服务按输入 Token 和输出 Token 分别收费，本应用根据返回的实际数量估算费用。</p></article>
    </div>
  </div>

  <div className="guide-section">
    <h2>一次提问是怎样走完的</h2>
    <div className="flow-diagram" aria-label="客户端请求流程图">
      <div className="flow-node"><b>① 客户端</b><span>Trae / Chatbox / 脚本</span></div><i>→</i>
      <div className="flow-node highlight"><b>② 本地网关</b><span>验证密钥、查模型映射</span></div><i>→</i>
      <div className="flow-node"><b>③ 首选渠道</b><span>DeepSeek / Kimi / 中转站</span></div><i>→</i>
      <div className="flow-node"><b>④ AI 模型</b><span>生成回答并返回 Token</span></div>
    </div>
    <div className="flow-return">回答沿原路返回客户端；如果首选渠道失败，网关会按照优先级尝试其他支持同一模型的渠道。</div>
  </div>

  <div className="guide-steps">
    <article><b>1</b><div><h3>添加渠道</h3><p>从 DeepSeek、Kimi 或 NewAPI 模板开始，填写自己申请的上游 API Key。保存后先点“测试”，再点“查价格”。</p></div></article>
    <article><b>2</b><div><h3>映射模型</h3><p>选择首选渠道，填写上游真实模型名，再起一个客户端使用的统一名称。可以直接套用渠道查询到的价格。</p></div></article>
    <article><b>3</b><div><h3>生成网关密钥</h3><p>在“密钥管理”中为 Trae、Chatbox、脚本等客户端分别生成密钥。新密钥只完整显示一次，请立即保存。</p></div></article>
    <article><b>4</b><div><h3>连接客户端</h3><p>选择 OpenAI Compatible，填写下方三项。Base URL 已含 <code>/v1</code>，不要重复添加。</p></div></article>
  </div>

  <div className="guide-grid">
    <div className="guide-card">
      <h3>客户端统一填写</h3>
      <dl><dt>提供商</dt><dd>OpenAI Compatible</dd><dt>Base URL</dt><dd><code>{config.url}</code></dd><dt>API Key</dt><dd>在“密钥管理”中生成</dd><dt>Model</dt><dd><code>{config.model}</code></dd></dl>
    </div>
    <div className="guide-card">
      <h3>支持的接口</h3>
      <pre>GET  /v1/models{"\n"}POST /v1/chat/completions</pre>
      <p>请求必须携带网关密钥。未提供密钥时返回 <code>401 Unauthorized</code> 是正常的安全保护。</p>
    </div>
  </div>

  <div className="guide-section">
    <h2>页面功能</h2>
    <div className="feature-list">
      <article><h3>首页</h3><p>查看服务状态、统一地址、可用模型、今日调用量、Token 和最近错误。</p></article>
      <article><h3>渠道管理</h3><p>维护上游地址、上游 API Key、支持模型、优先级、超时和启用状态。</p></article>
      <article><h3>模型管理</h3><p>把供应商实际模型映射为带 <code>xhc-</code> 前缀的统一名称，并设置首选和备用渠道。</p></article>
      <article><h3>密钥管理</h3><p>为不同客户端生成独立密钥，客户端无法读取上游 API Key。</p></article>
      <article><h3>调用记录</h3><p>查看路由、Token、耗时、状态和错误，不保存提示词、代码正文或模型回复。</p></article>
      <article><h3>费用分析</h3><p>从渠道价格接口同步单价，按实际 Token 估算费用，并按日期和模型生成图表。</p></article>
      <article><h3>客户端配置</h3><p>提供 Trae、Chatbox、Cherry Studio、Python、curl 和 VS Code 插件的配置示例。</p></article>
    </div>
  </div>

  <div className="guide-section">
    <h2>价格是怎样自动算出来的</h2>
    <div className="flow-diagram pricing-flow" aria-label="价格计算流程图">
      <div className="flow-node"><b>① 查询渠道</b><span>/api/pricing</span></div><i>→</i>
      <div className="flow-node"><b>② 解析倍率</b><span>model_ratio × completion_ratio</span></div><i>→</i>
      <div className="flow-node highlight"><b>③ 得到单价</b><span>USD / 百万 Token</span></div><i>→</i>
      <div className="flow-node"><b>④ 乘以用量</b><span>输入与输出分别计算</span></div><i>→</i>
      <div className="flow-node"><b>⑤ 生成图表</b><span>按日期、模型汇总</span></div>
    </div>
    <p className="flow-return">若渠道没有 <code>/api/pricing</code>，应用会再尝试 NewAPI 的 <code>/api/ratio_config</code>。同步失败时不会编造价格，你可以在模型管理中手动填写。</p>
  </div>

  <div className="guide-section">
    <h2>常见问题</h2>
    <details><summary>优先级到底是什么？</summary><p>每个模型都有一个“首选渠道”，它总是先尝试。首选渠道连接失败、超时或返回错误后，网关会寻找其他声明支持同一个供应商实际模型的启用渠道，并按照优先级数字从小到大尝试。例如优先级 10 会排在 50 前面。它不是模型质量分数，数字大并不代表更好。</p></details>
    <details><summary>“供应商实际模型”是什么？为什么还要备用？</summary><p>它是 DeepSeek、Kimi 或中转站要求的真实模型 ID，过去常叫“上游模型”。统一名称是你在客户端填写的名字，例如 <code>xhc-kimi-k3</code>；网关会把它翻译成供应商认识的 <code>kimi-k3</code>。如果首选渠道失败，网关会继续尝试表格中列出的备用渠道；显示“无备用”时，需要再添加一条支持同名实际模型的渠道。</p></details>
    <details><summary>估算费用和实际账单为什么可能不同？</summary><p>中转站可能还有用户分组倍率、缓存折扣、按次收费、活动优惠、税费或隐藏的计费规则。流式接口目前也不一定返回完整 Token。因此“费用分析”用于观察趋势和做预算，最终付款金额仍以渠道账单为准。</p></details>
    <details><summary>客户端连接失败</summary><p>确认左下角显示“网关运行中”；Base URL 为 <code>{config.url}</code>；没有重复添加 <code>/v1</code>；API Key 使用的是网关密钥；模型名与“模型管理”中的统一名称完全一致。</p></details>
    <details><summary>返回 401</summary><p>通常表示没有提供网关密钥，或者密钥无效、已停用。请到“密钥管理”检查或重新生成。</p></details>
    <details><summary>没有可用模型</summary><p>依次检查渠道是否启用、上游地址与密钥是否正确、模型映射是否启用，以及默认渠道是否可用。</p></details>
    <details><summary>关闭窗口后仍在运行</summary><p>启用“关闭窗口时最小化到托盘”后，关闭主窗口只会隐藏程序。需要完全退出时，请从系统托盘菜单退出，或先在首页停止服务。</p></details>
  </div>

  <div className="guide-safety">
    <h3>数据与安全</h3>
    <p>上游 API Key 只保存在 Windows 凭据管理器中，不写入数据库或调用日志。数据库位于 <code>%APPDATA%\LocalModelGateway\gateway.db</code>；备份前请先停止网关。只复制数据库不会迁移 Windows 凭据管理器中的上游密钥。</p>
  </div>
</section>}
function ChannelOrderEditor({channels,value,set}:{channels:Channel[];value:string[];set:(ids:string[])=>void}){
  const selected=[...new Set(value)].filter(id=>channels.some(c=>c.id===id));
  const selectedSet=new Set(selected);
  const rows=[...selected.map(id=>channels.find(c=>c.id===id)!).filter(Boolean),...channels.filter(c=>!selectedSet.has(c.id))];
  const toggle=(id:string,checked:boolean)=>set(checked?[...selected,id]:selected.filter(item=>item!==id));
  const move=(index:number,delta:number)=>{const target=index+delta;if(target<0||target>=selected.length)return;const next=[...selected];[next[index],next[target]]=[next[target],next[index]];set(next)};
  return <section className="channel-order-editor"><div className="channel-order-head"><div><b>此模型使用的渠道与顺序</b><p>勾选需要使用的来源；第 1 个为首选，其余按顺序故障切换。</p></div><span>已选择 {selected.length} 个</span></div>
    <div className="channel-order-list">{rows.map(channel=>{const index=selected.indexOf(channel.id);const chosen=index>=0;return <div key={channel.id} className={chosen?"channel-order-row chosen":"channel-order-row"}><label><input type="checkbox" checked={chosen} onChange={e=>toggle(channel.id,e.target.checked)}/><b>{chosen?index+1:"—"}</b><span>{channel.name}<small>{channel.provider} · {channel.enabled?"已启用":"已禁用"}</small></span></label><div>{chosen&&<><button type="button" className="secondary order-btn" disabled={index===0} onClick={()=>move(index,-1)}>↑ 上移</button><button type="button" className="secondary order-btn" disabled={index===selected.length-1} onClick={()=>move(index,1)}>↓ 下移</button></>}</div></div>})}</div>
  </section>;
}
function Table({headers,children}:{headers:string[];children:any}){return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
function Modal({title,children,close}:{title:string;children:any;close:()=>void}){return <div className="modal-back"><div className="modal"><header><h2>{title}</h2><button className="icon" onClick={close}>×</button></header>{children}</div></div>}
function FormGrid({children}:{children:any}){return <div className="form-grid">{children}</div>}
function Input({label,value,set,type="text",placeholder,required=false,hint}:{label:string;value:string;set:(s:string)=>void;type?:string;placeholder?:string;required?:boolean;hint?:string}){return <label><span>{label}{required&&<b className="required-mark"> * 必填</b>}</span><input required={required} aria-required={required} type={type} value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}/>{hint&&<small className="field-hint">{hint}</small>}</label>}
function Select({label,value,set,options,required=false}:{label:string;value:string;set:(s:string)=>void;options:string[];required?:boolean}){return <label><span>{label}{required&&<b className="required-mark"> * 必填</b>}</span><select required={required} aria-required={required} value={value} onChange={e=>set(e.target.value.split("|")[0])}>{options.map(o=>{const [v,n]=o.split("|");return <option value={v} key={o}>{n||v}</option>})}</select></label>}
function Check({label,checked,set}:{label:string;checked:boolean;set:(s:boolean)=>void}){return <label className="check"><input type="checkbox" checked={checked} onChange={e=>set(e.target.checked)}/>{label}</label>}
