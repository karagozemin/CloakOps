"use client";

import dynamic from "next/dynamic";
import { SectionBackground } from "@/components/backgrounds/section-background";

const Beams = dynamic(() => import("@/components/backgrounds/Beams"), {
  ssr: false,
});
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

const beamsProps = {
  beamWidth: 2.5,
  beamHeight: 20,
  beamNumber: 12,
  lightColor: "#E8B923",
  speed: 1.5,
  noiseIntensity: 1.0,
  scale: 0.18,
  rotation: 12,
};

/** App pages — subtle interactive dot grid */
export function DotGridBackground({ opacity = 0.48 }: { opacity?: number }) {
  return (
    <SectionBackground variant="viewport" opacity={opacity}>
      <DotGrid {...dotGridProps} />
    </SectionBackground>
  );
}

/** Hero spotlight — gold rays from top-center onto the logo */
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

/** Landing — full-viewport Beams */
export function LandingPageBackground() {
  return (
    <SectionBackground variant="viewport" opacity={1}>
      <div className="absolute inset-0 bg-ink-950" aria-hidden />
      <div className="absolute inset-0 size-full opacity-[0.46]">
        <Beams {...beamsProps} />
      </div>
    </SectionBackground>
  );
}

export function AppPageBackground() {
  return <DotGridBackground opacity={0.48} />;
}
