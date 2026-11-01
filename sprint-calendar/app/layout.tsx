import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "冲刺日历 · 薛浩琛学习计划",
  description: "从 2026 年 7 月 25 日到 10 月 17 日的新领军冲刺日历。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
