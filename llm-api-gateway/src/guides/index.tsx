import type { GuideTopic } from "./types";
import { StartGuide } from "./StartGuide";
import { ApiTermsGuide } from "./ApiTermsGuide";
import { CacheGuide } from "./CacheGuide";
import { PricingGuide } from "./PricingGuide";
import { ChannelsGuide } from "./ChannelsGuide";
import { ModelsGuide } from "./ModelsGuide";
import { ClientGuide } from "./ClientGuide";

export type { GuideConfig } from "./types";

export const guideTopics: GuideTopic[] = [
  {id:"start",category:"开始使用",title:"第一次使用",summary:"四步完成配置",render:props=><StartGuide {...props}/>},
  {id:"api-terms",category:"常见术语",title:"API、地址和密钥",summary:"理解最基本的几个词",render:props=><ApiTermsGuide {...props}/>},
  {id:"cache",category:"常见术语",title:"缓存与缓存命中",summary:"为什么缓存输入更便宜",render:()=> <CacheGuide/>},
  {id:"pricing",category:"价格费用",title:"Token 与费用计算",summary:"输入、缓存、输出和其他费用",render:()=> <PricingGuide/>},
  {id:"channels",category:"配置说明",title:"渠道模板与优先级",summary:"模板、必填项和故障切换",render:()=> <ChannelsGuide/>},
  {id:"models",category:"配置说明",title:"模型映射",summary:"统一名称与上游模型",render:()=> <ModelsGuide/>},
  {id:"client",category:"配置说明",title:"连接 AI 客户端",summary:"Base URL、密钥和模型怎么填",render:props=><ClientGuide {...props}/>},
];
