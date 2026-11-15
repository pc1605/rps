import {
  type ApiErrorCode,
  PHASE_LABEL,
  type Phase,
  type ReworkReason,
  SIZE_LABEL,
  type SizeClass,
  STATION_LABEL,
  type Station,
} from "@rps/shared";

export type Language = "en" | "hi";

/**
 * Error codes a worker phone call can get back (checked against the /worker/* handlers), plus
 * "network_error" which lib/api-client.ts sets when the server can't be reached.
 * "bad_request" and "forbidden" come from the backend's httpx helpers; they are not in ApiErrorCode.
 */
export type PhoneErrorCode =
  | Extract<
      ApiErrorCode,
      | "not_found"
      | "unit_not_found"
      | "wrong_phase"
      | "already_started"
      | "not_started"
      | "not_assigned"
      | "quota_reached"
      | "in_rework"
      | "already_in_rework"
      | "rework_pending_decision"
      | "not_your_rework"
      | "rework_not_open"
      | "written_off"
      | "spare"
      | "no_claim"
      | "unauthorized"
      | "internal"
    >
  | "bad_request"
  | "forbidden"
  | "network_error";

/**
 * English texts — the source table. Hindi lives in strings.hi.ts and must have exactly these keys
 * (the `Strings` type below makes the type check fail otherwise). Read texts with useStrings()
 * in components and getStrings() outside React (lib/language.ts).
 */
export const en = {
  common: {
    language: "Language",
    queue: "Queue",
    back: "Back",
    backTo: (where: string) => `Back to ${where}`,
    backToMyQueue: "Back to my queue",
    done: "Done ✓",
    cancel: "Cancel",
    retry: "Retry",
    couldntDoThat: "Couldn't do that",
    somethingWrong: "Something went wrong",
    offline: "You're offline — changes will sync when you reconnect",
    cannotReachServer: "Cannot reach server",
    requestFailed: "Request failed",
    loginFailed: "Login failed",
  },
  // Shared enum labels. English reuses @rps/shared; other languages translate them here on the phone.
  station: STATION_LABEL as Record<Station, string>,
  phase: PHASE_LABEL as Record<Phase, string>,
  size: SIZE_LABEL as Record<SizeClass, string>,
  // Server error codes → phone text (lib/errors.ts). An unknown code falls back to the server message.
  errors: {
    network_error: "Cannot reach server — check connection",
    unauthorized: "This phone is signed out — sign in again or ask your admin",
    forbidden: "This is not yours to do — ask your admin",
    bad_request: "That didn't go through — try again",
    internal: "Something went wrong — try again",
    not_found: "Batch not found",
    unit_not_found: "Not an RPS unit label",
    wrong_phase: "This batch is not at your station right now",
    already_started: "This batch has already been started",
    not_started: "Start or join this batch first",
    not_assigned: "This batch is assigned to other workers",
    quota_reached: "Your share is complete",
    in_rework: "Waiting for rework",
    already_in_rework: "This mat is already in rework",
    rework_pending_decision: "Waiting for owner's decision",
    not_your_rework: "This mat is assigned to another stitcher",
    rework_not_open: "This rework is already closed",
    written_off: "Written off — keep it aside",
    spare: "Spare stock — keep it aside",
    no_claim: "Nobody is cutting this batch right now",
  } satisfies Record<PhoneErrorCode, string>,
  batch: {
    notFoundTitle: "Batch not found",
    notFoundBody:
      "This batch might have been completed, cancelled, or is no longer assigned to your station.",
    backToQueue: "Back to queue",
    shortCountTitle: "Short count",
    shortCountBody: (remaining: number, qty: number) =>
      `This batch needs ${remaining} more cut but you're reporting ${qty}. The admin will decide what happens with the remaining ${remaining - qty}.`,
    complete: "Complete",
    sentForAssignment: (code: string) => `${code} sent to admin for stitching assignment.`,
    sentToNext: (code: string) => `${code} sent to the next station.`,
    startCutting: "Start cutting",
    reportCut: "Report cut",
    joinBatch: "Join batch",
    openScanner: "Open scanner",
    matsToCut: "mats to cut",
    yourShare: "your share",
    matsStitched: "mats stitched",
    matsPacked: "mats packed",
    assignedWorkers: "Assigned workers",
    activeWorkers: "Active workers",
    notes: "Notes",
    piecesCompleted: "Pieces completed",
    decreaseQty: "Decrease quantity",
    increaseQty: "Increase quantity",
    quantityCompleted: "Quantity completed",
    remainingOf: (remaining: number, total: number) => `${remaining} remaining of ${total}`,
    cuttingNow: (who?: string) => `⏳ ${who ?? "Another cutter"} is cutting this batch`,
  },
  login: {
    eyebrow: "AMBIKA · RIDDHI",
    title: "RPS Worker",
    subtitle:
      "Scan the enrollment QR from your admin, or type the code, then enter your PIN to set up this phone.",
    submit: "Set up this phone →",
    footnote: "One-time setup. You'll stay signed in on this phone.",
    scanCode: "Scan enrollment code",
    scanDifferent: "Scan a different code",
    codeLabel: "Enrollment code",
    codePlaceholder: "or type the code",
    pinLabel: "4-digit PIN",
    wrongCodeOrPin: "Wrong code or PIN",
  },
  enroll: {
    cameraWhy: "To scan your enrollment code.",
    notEnrollCode: "Not an enrollment code — ask your admin for the QR",
    scannedA11y: "Enrollment code scanned",
    cancelA11y: "Cancel enrollment scan",
    cancel: "Cancel",
    hint: "Point at the enrollment QR on the admin screen",
  },
  home: {
    myQueue: "My queue",
    stationQueue: (station: string) => `${station} queue`,
    signOut: "Sign out",
    loadFailed: "Couldn't load your queue. Check connection and retry.",
    allClear: "All clear",
    nothingWaiting: "Nothing waiting at your station.",
    reworkA11y: (code: string, model: string) => `Rework ${code}, ${model}`,
    reworkPhotoA11y: "Rework defect photo",
    batchA11y: (code: string, car: string) => `Batch ${code}, ${car}`,
    mats: "mats",
    yourShare: "your share",
    stitched: "stitched",
    packed: "packed",
    inRework: (n: number) => `${n} in rework`,
    leftToPack: (n: number) => `${n} left to pack`,
    waitingRework: "Waiting for rework",
    cutting: (who?: string) => `⏳ ${who ?? "Another cutter"} is cutting`,
    assignedToYou: "📌 Assigned to you",
    assignedToYouWith: (workers: string) => `📌 Assigned to you (with ${workers})`,
    youreIn: "You're in",
  },
  inspect: {
    title: "Inspect Mat",
    pack: "✓ Pack",
    needsRework: "✗ Needs rework",
    cancel: "Cancel",
  },
  scanner: {
    inRework: "Waiting for rework",
    writtenOff: "Written off — keep it aside",
    spare: "Spare stock — keep it aside",
    wrongBatch: (code: string) => `Wrong batch — this mat is from ${code}`,
    sentToRework: "Sent to rework",
    alreadyPacked: "Already packed",
    wrongPhase: "This batch is not in packing",
    notStarted: "Join this batch first",
    peekFailed: "Couldn't check this mat — try again",
    checking: "Checking…",
    alreadyScanned: "Already scanned",
    shareComplete: "Your share is complete",
    shareCompleteTitle: "Your share is complete ✓",
    shareCompleteSub: (mine: number, target: number) =>
      `${mine} / ${target} mats — leave the rest for your co-workers`,
    scanFailed: "Scan failed — try again",
    offline: "Offline — reconnect to scan",
    notRpsLabel: "Not an RPS unit label",
    scannedA11y: (code: string) => `Scanned ${code}`,
    errorA11y: (msg: string) => `Error: ${msg}`,
    stitchingComplete: "Stitching complete",
    batchComplete: (code: string) => `${code} complete`,
    allStitched: (n: number) => `All ${n} mats stitched — batch sent to packing.`,
    allPacked: (n: number) => `All ${n} mats packed and sent to the stockyard.`,
    allowCamera: "Allow camera",
    cameraNeeded: "Camera needed",
    cameraWhy: "RPS uses the camera to scan unit QR labels.",
    backToQueueA11y: "Back to queue",
    torchOn: "🔦 Torch on",
    torchOff: "🔦 Torch off",
    torchOnA11y: "Turn torch on",
    torchOffA11y: "Turn torch off",
    cameraFailed: "Camera didn't start — tap to retry",
    progressMine: (mine: number, target: number, done: number, total: number) =>
      `${mine}/${target} yours · ${done}/${total} batch`,
    progressStitched: (done: number, total: number) => `${done} / ${total} stitched`,
    progressPacked: (done: number, total: number) => `${done} / ${total} packed`,
    pointAtLabel: "Point at a unit QR label",
    packA11y: "Pack mat",
    needsReworkA11y: "Needs rework",
    cancelInspectA11y: "Cancel inspect",
  },
  myWork: {
    title: "My work",
    today: "today",
    thisWeek: "this week",
    unit: { cutter: "pieces cut", stitcher: "mats stitched", packer: "mats packed" } as Record<
      string,
      string
    >,
    reworkReturned: (n: number) => `${n} came back for rework this week`,
    reworkOpen: (n: number) => `${n} waiting for you`,
    flagged: (n: number) => `${n} sent to rework this week`,
    seeMonth: "see month",
  },
  // Work history (app/history.tsx): the worker's own count per day of a month. Counts only — never ₹ (D40).
  history: {
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    // Sunday first, like Date.getDay().
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    previousMonth: "Previous month",
    nextMonth: "Next month",
    daysWorked: (n: number) => (n === 1 ? "1 day worked" : `${n} days worked`),
    empty: "No work recorded this month",
    loadFailed: "Couldn't load your work. Check connection and retry.",
  },
  cutting: {
    release: "Give back this batch",
    releaseTitle: "Give back this batch?",
    releaseBody: "It goes back to the cutting queue so any cutter can start it. Nothing is reported as cut.",
    releaseConfirm: "Give back",
    keep: "Keep it",
    released: (code: string) => `${code} is back in the cutting queue.`,
  },
  rework: {
    title: "Rework",
    notFoundTitle: "Rework item not found",
    notFoundBody: "This item may have already been fixed or reassigned.",
    viewPhotoA11y: "View full photo",
    defectPhotoA11y: "Defect photo",
    noteTitle: "Note",
    closePhotoA11y: "Close photo preview",
    fullPhotoA11y: "Full-screen rework photo",
    sendToRework: "Send to rework",
    photosTitle: "Photos (1–3)",
    cameraWhy: "RPS uses the camera to capture rework defect photos.",
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
    fixedA11y: (code: string) => `Fixed ${code}`,
    backToDetailA11y: "Back to detail",
    targetMat: "Target Mat",
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

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => unknown
    ? (...args: A) => string
    : T extends readonly unknown[]
      ? { readonly [K in keyof T]: Widen<T[K]> } // a list keeps its length (12 months, 7 weekdays)
      : { -readonly [K in keyof T]: Widen<T[K]> };

/** Shape every language table must have: the English keys, with the same function arguments. */
export type Strings = Widen<typeof en>;
