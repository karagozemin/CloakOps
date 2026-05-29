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

export function HeroBackground() {
  return (
    <>
      <SectionBackground opacity={0.65}>
        <LightRays
          raysColor="#E8B923"
          raysOrigin="top-center"
          lightSpread={0.85}
          fadeDistance={1.3}
          saturation={0.35}
          followMouse={false}
          rayLength={1.4}
        />
      </SectionBackground>
      <SectionBackground className="-z-[9]" opacity={0.55}>
        <DotGrid
          dotSize={2}
          gap={32}
          baseColor="#222831"
          activeColor="#E8B923"
          proximity={120}
          speedTrigger={120}
        />
      </SectionBackground>
    </>
  );
}

export function PrivacyBackground() {
  return (
    <SectionBackground opacity={0.35}>
      <Particles
        particleCount={60}
        particleSpread={12}
        speed={0.06}
        particleColors={["#E8B923", "#5A616B", "#5B9BD5"]}
        moveParticlesOnHover={false}
        alphaParticles
        particleBaseSize={80}
        sizeRandomness={0.8}
        disableRotation
      />
    </SectionBackground>
  );
}

export function SolutionBackground() {
  return (
    <SectionBackground opacity={0.4}>
      <Aurora
        colorStops={["#070809", "#E8B923", "#5B9BD5"]}
        amplitude={0.55}
        blend={0.45}
        speed={0.35}
      />
    </SectionBackground>
  );
}

export function TrackBackground() {
  return (
    <SectionBackground opacity={0.5}>
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
    <SectionBackground className="fixed inset-0 -z-10" opacity={0.3}>
      <DotGrid
        dotSize={2}
        gap={36}
        baseColor="#222831"
        activeColor="#E8B923"
        proximity={100}
        speedTrigger={140}
      />
    </SectionBackground>
  );
}
