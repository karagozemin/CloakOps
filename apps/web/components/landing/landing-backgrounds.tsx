"use client";

import dynamic from "next/dynamic";
import { SectionBackground } from "@/components/backgrounds/section-background";

const LightRays = dynamic(() => import("@/components/backgrounds/LightRays"), {
  ssr: false,
});
const DotGrid = dynamic(() => import("@/components/backgrounds/DotGrid"), {
  ssr: false,
});

export const dotGridProps = {
  dotSize: 2,
  gap: 32,
  baseColor: "#353D48",
  activeColor: "#E8B923",
  proximity: 130,
  speedTrigger: 100,
};

/** Full-viewport dot grid — shared by landing + app pages */
export function DotGridBackground({ opacity = 0.48 }: { opacity?: number }) {
  return (
    <SectionBackground variant="viewport" opacity={opacity}>
      <DotGrid {...dotGridProps} />
    </SectionBackground>
  );
}

/** Landing: one continuous grid for the whole page */
export function LandingPageBackground() {
  return <DotGridBackground opacity={0.48} />;
}

/** Hero spotlight — sits on top of the page-wide grid */
export function HeroBackground() {
  return (
    <SectionBackground opacity={0.55}>
      <LightRays
        raysColor="#E8B923"
        raysOrigin="top-center"
        lightSpread={0.85}
        fadeDistance={1.2}
        saturation={0.45}
        followMouse={false}
        rayLength={1.4}
      />
    </SectionBackground>
  );
}

export function AppPageBackground() {
  return <DotGridBackground opacity={0.48} />;
}
