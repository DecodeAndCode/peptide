import { Button } from "@/components/ui/Button";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#technology", label: "Technology" },
  { href: "#plans", label: "Plans" },
];

export function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-sage/15 bg-[rgba(247,244,239,0.92)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-marketing items-center justify-between px-6 py-4 md:px-12 md:py-5">
        <a
          href="#top"
          className="font-display text-2xl leading-none tracking-[-0.5px] text-dark"
        >
          Supp<span className="text-sage">Go</span>
        </a>

        <div className="flex items-center gap-4 md:gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hidden text-sm font-normal tracking-[0.3px] text-mid transition-colors duration-200 hover:text-dark md:inline"
            >
              {link.label}
            </a>
          ))}

          <a
            href="/login"
            className="hidden text-sm font-medium tracking-[0.3px] text-mid transition-colors duration-200 hover:text-dark md:inline"
          >
            Sign in
          </a>
          <Button href="/signup" className="px-6 py-2.5">
            Start free trial
          </Button>
        </div>
      </div>
    </nav>
  );
}
