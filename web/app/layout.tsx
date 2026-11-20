import React from 'react';
import '../src/styles.css';

export const metadata = {
  title: 'Aquavelle · Find water and plan for dry months',
  description:
    'Search past water-source records in Bangladesh, learn what to check before using a source, and estimate how much rainwater you can store.',
  other: { 'page-type': 'software', 'site-kind': 'software' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-type="software">
      <body>{children}</body>
    </html>
  );
}
