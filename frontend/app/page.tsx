import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { HowItWorksSectionDevs } from "@/components/sections/HowItWorksSectionDevs";
import { HowItWorksSectionUsers } from "@/components/sections/HowItWorksSectionUsers";
import { HowToUseSection } from "@/components/sections/HowToUseSection";
import BenefitsSection from "@/components/sections/BenefitsSection";

export default function Home() {
  return (
    <main className="bg-background text-foreground min-h-screen transition-colors duration-300">
      <Navbar />
      <HeroSection />
      <BenefitsSection />
      <HowItWorksSectionDevs />
      <HowItWorksSectionUsers />
      <FeaturesSection />
      <HowToUseSection />

      <footer className="text-muted-foreground glass border-t border-white/10 py-12 text-center">
        <p>
          &copy; {new Date().getFullYear()} Pilikino. All rights
          reserved.
        </p>
      </footer>
    </main>
  );
}
