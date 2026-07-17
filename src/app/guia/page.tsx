import type { Metadata } from "next";
import { OnboardingGuide } from "./OnboardingGuide";

export const metadata: Metadata = {
  title: "Guía de alta — Emmalva",
};

export const dynamic = "force-static";

export default function GuiaPage() {
  return <OnboardingGuide />;
}
