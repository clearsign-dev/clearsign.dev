import type { Metadata } from "next";
import { VoidPage } from "@/components/void/VoidPage";
import { NOT_FOUND } from "@/lib/content";

// Every unmatched URL lands here; the static export writes it to 404.html.

export const metadata: Metadata = {
  title: `${NOT_FOUND.code} — ClearSign`,
  description: NOT_FOUND.body,
};

export default function NotFound() {
  return <VoidPage />;
}
