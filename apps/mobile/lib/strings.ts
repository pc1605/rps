import type { ReworkReason } from "@rps/shared";

export const strings = {
  inspect: {
    title: "Inspect Mat",
    pack: "✓ Pack",
    needsRework: "✗ Needs rework",
    cancel: "Cancel",
  },
  scanner: {
    inRework: "Waiting for rework",
    writtenOff: "Written off — keep it aside",
    sentToRework: "Sent to rework",
    alreadyPacked: "Already packed",
    wrongPhase: "This batch is not in packing",
    notStarted: "Join this batch first",
    peekFailed: "Couldn't check this mat — try again",
    checking: "Checking…",
  },
  rework: {
    sendToRework: "Send to rework",
    photosTitle: "Photos (1–3)",
    reasonsTitle: "Reasons",
    notePlaceholder: "Optional note for stitcher...",
    takePhoto: "Take photo",
    removePhoto: "Remove photo",
    shutterA11y: "Capture photo",
    takeAPhoto: "Take a photo",
    next: "Next →",
    chooseWhatsWrong: "Choose what's wrong",
    photosCount: (n: number) => `${n} / 3 photos`,
    removePhotoN: (n: number) => `Remove photo ${n}`,
    stepOneOfTwo: "1/2",
    stepTwoOfTwo: "2/2",
    noteLabel: "Note (optional)",
    tapToEditPhotos: "Tap to edit photos",
    alreadyInRework: "This mat is already in rework",
    notStarted: "Join this batch before sending to rework",
    networkError: "Cannot reach server — check connection",
    genericError: "Failed to send rework — try again",
    homeSectionTitle: "🔧 Rework",
    roundBadge: (round: number) => {
      if (round === 2) return "2nd time";
      if (round === 3) return "3rd time";
      return `Round ${round}`;
    },
    sentBackBy: (name: string, time: string) => `Sent back by ${name} · ${time}`,
    scanToFix: "📷 Scan to mark fixed",
    fixedTitle: "Fixed ✓ — back to packing",
    fixedDesc: "Mat returned to packing queue.",
    backToQueue: "Back to my queue",
    pointAtQr: "Point camera at the mat's QR label",
    wrongMat: (code: string) => `Wrong mat — this is ${code}`,
    pendingDecision: "Waiting for owner's decision",
    notYourRework: "This mat is assigned to another stitcher",
    reasons: {
      stitching_fault: { emoji: "🧵", label: "Stitching fault" },
      stain: { emoji: "💧", label: "Stain / dirt" },
      cutting_fault: { emoji: "✂️", label: "Cutting fault" },
      material_defect: { emoji: "🧻", label: "Material defect" },
      other: { emoji: "❓", label: "Other" },
    } as Record<ReworkReason, { emoji: string; label: string }>,
  },
} as const;
