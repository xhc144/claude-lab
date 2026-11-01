import type { ReactNode } from "react";

export type GuideConfig = { url: string; key: string; model: string };
export type GuidePageProps = { config: GuideConfig };
export type GuideTopic = {
  id: string;
  category: string;
  title: string;
  summary: string;
  render: (props: GuidePageProps) => ReactNode;
};
