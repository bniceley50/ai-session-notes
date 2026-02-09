export default function SessionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <div className="h-full p-4 lg:p-6">
        {children}
      </div>
    </div>
  );
}
