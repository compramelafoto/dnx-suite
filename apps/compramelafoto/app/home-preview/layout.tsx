import "@/styles/home-preview.css";
import PreviewHeader from "@/components/home-preview/PreviewHeader";
import { PreviewSearchProvider } from "@/components/home-preview/PreviewSearchContext";

export default function HomePreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <PreviewSearchProvider>
      <PreviewHeader />
      {children}
    </PreviewSearchProvider>
  );
}
