import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { PracticeModeBanner, PracticeModeToggle } from "@/components/PracticeModeControls";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "簡易レジ",
  description: "スマホで注文を入力し、金額を計算する簡易レジアプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-100 font-sans text-zinc-900">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 print:hidden">
          <Link href="/" className="text-base font-bold">
            簡易レジ
          </Link>
          <nav className="flex items-center gap-4 overflow-x-auto whitespace-nowrap text-sm font-medium text-zinc-600">
            <Link href="/">テーブル一覧</Link>
            <Link href="/report">売上</Link>
            <Link href="/menu">メニュー管理</Link>
            <Link href="/toppings">トッピング管理</Link>
            <PracticeModeToggle />
          </nav>
        </header>
        <PracticeModeBanner />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
