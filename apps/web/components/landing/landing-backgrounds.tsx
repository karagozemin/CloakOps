"use client";

import dynamic from "next/dynamic";
import { SectionBackground } from "@/components/backgrounds/section-background";

const LightRays = dynamic(() => import("@/components/backgrounds/LightRays"), {
  ssr: false,
});
const DotGrid = dynamic(() => import("@/components/backgrounds/DotGrid"), {
  ssr: false,
});
const Particles = dynamic(() => import("@/components/backgrounds/Particles"), {
  ssr: false,
});
const Aurora = dynamic(() => import("@/components/backgrounds/Aurora"), {
  ssr: false,
});
const Beams = dynamic(() => import("@/components/backgrounds/Beams"), {
  ssr: false,
});

const dotGridProps = {
  dotSize: 2,
  gap: 32,
  baseColor: "#353D48",
  activeColor: "#E8B923",
  proximity: 130,
  speedTrigger: 100,
};

export function HeroBackground() {
  return (
    <>
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
      <SectionBackground className="-z-[9]" opacity={0.5}>
        <DotGrid {...dotGridProps} />
      </SectionBackground>
    </>
  );
}

export function PrivacyBackground() {
  return (
    <SectionBackground fullBleed opacity={0.4}>
      <Particles
        particleCount={65}
        particleSpread={12}
        speed={0.06}
        particleColors={["#E8B923", "#6B7280", "#5B9BD5"]}
        moveParticlesOnHover={false}
        alphaParticles
        particleBaseSize={85}
        sizeRandomness={0.8}
        disableRotation
      />
    </SectionBackground>
  );
}

export function SolutionBackground() {
  return (
    <SectionBackground fullBleed opacity={0.45}>
      <Aurora
        colorStops={["#0b0d10", "#E8B923", "#5B9BD5"]}
        amplitude={0.6}
        blend={0.48}
        speed={0.35}
      />
    </SectionBackground>
  );
}

export function TrackBackground() {
  return (
    <SectionBackground fullBleed opacity={0.55}>
      <Beams
        beamWidth={2}
        beamHeight={18}
        beamNumber={10}
        lightColor="#E8B923"
        speed={1.5}
        noiseIntensity={1.2}
        scale={0.18}
        rotation={12}
      />
    </SectionBackground>
  );
}

export function AppPageBackground() {
  return (
    <SectionBackground variant="viewport" opacity={0.48}>
      <DotGrid {...dotGridProps} />
    </SectionBackground>
  );
}
