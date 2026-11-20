import React from 'react';
import '../src/styles.css';

export const metadata = {
  title: 'Aquavelle · Rainwater harvesting for water all year',
  description:
    'Plan rain tanks and shared rain tank sites in Bangladesh, keep a backup water source, and check water before drinking. For households, schools, NGOs and local government.',
  other: { 'page-type': 'software', 'site-kind': 'software' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-type="software">
      <body>{children}</body>
    </html>
  );
}
