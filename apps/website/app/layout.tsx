import './globals.css';

export const metadata = {
  title: 'Dev Atlas - Knowledge Graph for Developers',
  description: 'Transform the way you organize and navigate development knowledge with interactive knowledge graphs.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
