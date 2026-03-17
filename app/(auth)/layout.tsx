import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-cream px-6 py-8 md:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between py-4">
        <Link
          href="/"
          className="font-display text-3xl leading-none tracking-[-0.5px] text-dark"
        >
          Supp<span className="text-sage">Go</span>
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-mid transition-colors duration-200 hover:text-dark"
        >
          Back to site
        </Link>
      </div>
      {children}
    </div>
  );
}
