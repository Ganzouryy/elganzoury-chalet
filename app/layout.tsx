import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'شاليه الجنزوري — الساحل الشمالي',
  description: 'شاليه فاخر بإطلالة بحرية مباشرة في الساحل الشمالي',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}