import Link from "next/link";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import { BUYER_QUICK_ACCESS } from "@/components/home-preview/preview-mega-menu";
import PreviewMegaMenuIcon from "@/components/home-preview/PreviewMegaMenuIcon";

export default function BuyerQuickAccessSection() {
  return (
    <PreviewSection variant="default" className="!py-10 md:!py-12 border-b border-[#f3f4f6]">
      <PreviewReveal>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 m-0 p-0 list-none w-full min-w-0">
          {BUYER_QUICK_ACCESS.map((item) => (
            <li key={item.label} className="min-w-0">
              <Link
                href={item.href}
                className="hp-card flex flex-col items-center justify-center gap-2 min-h-[5.5rem] p-4 rounded-xl border border-[#e5e7eb] bg-white text-center hover:bg-[#fafafa] transition-colors min-w-0"
              >
                <PreviewMegaMenuIcon name={item.icon} />
                <span className="text-sm font-medium text-[#374151]">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PreviewReveal>
    </PreviewSection>
  );
}
