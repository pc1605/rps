# Hindi texts on the worker phone — for the owner's review (H1, Nov 2026)

Every text of the phone app, English next to Hindi, grouped by screen. Generated from `apps/mobile/lib/strings.ts`
(English) and `apps/mobile/lib/strings.hi.ts` (Hindi) — change a wording in `strings.hi.ts` and update the row here.

- **?** = a line the agent is not sure of; the note says what to decide. An empty note means "read it and see if a
  worker would say it this way".
- `{code}`, `{name}`, `{who}` … stand for a batch / unit code or a name put in by the app. Numbers in the examples
  (12, 10, 40 …) are samples. Codes, names, digits and the emoji / icons are the same in both languages.
- Lines whose key ends in `A11y` are read aloud by the screen reader (TalkBack), not shown.
- Not translated on purpose: batch and unit codes, car brand / model, product line and worker names, digits, "RPS",
  "AMBIKA · RIDDHI", sizes S / M / L, and the language names "English" / "हिन्दी" on the picker.
- Still English in Hindi mode: a server error with a code the phone doesn't know (none known today), notes typed by
  the admin, and the Android permission pop-up for the camera (system text).

## Every screen (common)

| English | हिन्दी | ? | key |
|---|---|---|---|
| Language | भाषा |  | `common.language` |
| Queue | लिस्ट | ? queue = लिस्ट (not लाइन, which also means product line) | `common.queue` |
| Back | वापस |  | `common.back` |
| ← Back | ← वापस |  | `common.backArrow` |
| Back to {where} | {where} पर वापस |  | `common.backTo` |
| Back to my queue | मेरी लिस्ट पर वापस |  | `common.backToMyQueue` |
| Done ✓ | हो गया ✓ |  | `common.done` |
| Cancel | कैंसल | ? कैंसल or रहने दें / रद्द करें | `common.cancel` |
| Retry | फिर कोशिश करें |  | `common.retry` |
| Couldn't do that | यह नहीं हो पाया |  | `common.couldntDoThat` |
| Something went wrong | कुछ गड़बड़ हुई |  | `common.somethingWrong` |
| You're offline — changes will sync when you reconnect | इंटरनेट नहीं है — जुड़ने पर अपडेट होगा |  | `common.offline` |
| Cannot reach server | सर्वर नहीं मिल रहा |  | `common.cannotReachServer` |
| Request failed | काम नहीं हुआ |  | `common.requestFailed` |
| Login failed | लॉगिन नहीं हुआ |  | `common.loginFailed` |

## Login and enrollment scan

| English | हिन्दी | ? | key |
|---|---|---|---|
| AMBIKA · RIDDHI | AMBIKA · RIDDHI |  | `login.eyebrow` |
| RPS Worker | RPS Worker | ? app name kept in English | `login.title` |
| Scan the enrollment QR from your admin, or type the code, then enter your PIN to set up this phone. | एडमिन से मिला QR स्कैन करें या कोड लिखें, फिर अपना PIN डालकर यह फ़ोन चालू करें। |  | `login.subtitle` |
| Set up this phone → | यह फ़ोन चालू करें → |  | `login.submit` |
| One-time setup. You'll stay signed in on this phone. | बस एक बार करना है। इस फ़ोन में आप लॉगिन रहेंगे। |  | `login.footnote` |
| Scan enrollment code | QR कोड स्कैन करें |  | `login.scanCode` |
| Scan a different code | दूसरा कोड स्कैन करें |  | `login.scanDifferent` |
| Enrollment code | कोड |  | `login.codeLabel` |
| or type the code | या कोड लिखें |  | `login.codePlaceholder` |
| 4-digit PIN | 4 अंकों का PIN |  | `login.pinLabel` |
| Wrong code or PIN | कोड या PIN गलत है |  | `login.wrongCodeOrPin` |
| To scan your enrollment code. | आपका कोड स्कैन करने के लिए। |  | `enroll.cameraWhy` |
| Not an enrollment code — ask your admin for the QR | यह सही कोड नहीं है — एडमिन से QR माँगें |  | `enroll.notEnrollCode` |
| Enrollment code scanned | कोड स्कैन हो गया |  | `enroll.scannedA11y` |
| Cancel enrollment scan | स्कैन कैंसल करें |  | `enroll.cancelA11y` |
| ← Cancel | ← कैंसल |  | `enroll.cancel` |
| Point at the enrollment QR on the admin screen | एडमिन की स्क्रीन पर दिख रहे QR पर कैमरा रखें |  | `enroll.hint` |

## Home — queue and batch cards

| English | हिन्दी | ? | key |
|---|---|---|---|
| My queue | मेरी लिस्ट |  | `home.myQueue` |
| {station} queue | {station} लिस्ट |  | `home.stationQueue` |
| Sign out | लॉग आउट | ? लॉग आउट or साइन आउट / बाहर निकलें | `home.signOut` |
| Couldn't load your queue. Check connection and retry. | लिस्ट नहीं खुली। इंटरनेट देखें और फिर कोशिश करें। |  | `home.loadFailed` |
| All clear | सब हो गया | ? | `home.allClear` |
| Nothing waiting at your station. | आपके पास अभी कोई काम नहीं है। |  | `home.nothingWaiting` |
| Rework {code}, {model} | रीवर्क {code}, {model} |  | `home.reworkA11y` |
| Rework defect photo | रीवर्क की खराबी की फ़ोटो |  | `home.reworkPhotoA11y` |
| Batch {code}, {car} | बैच {code}, {car} |  | `home.batchA11y` |
| mats | मैट |  | `home.mats` |
| your share | आपका हिस्सा |  | `home.yourShare` |
| stitched | सिल गए |  | `home.stitched` |
| packed | पैक हुए |  | `home.packed` |
| ⏳ {who} is cutting | ⏳ {who} काट रहे हैं |  | `home.cutting` |
| 📌 Assigned to you | 📌 आपको दिया गया |  | `home.assignedToYou` |
| 📌 Assigned to you (with {workers}) | 📌 आपको दिया गया ({workers} के साथ) |  | `home.assignedToYouWith` |
| You're in | आप जुड़े हैं |  | `home.youreIn` |
| Cutter | कटर |  | `station.cutter` |
| Stitcher | सिलाई | ? सिलाई or स्टिचर | `station.stitcher` |
| Packer | पैकर |  | `station.packer` |
| Cutting | कटिंग |  | `phase.cutting` |
| Stitching | सिलाई |  | `phase.stitching` |
| Packing | पैकिंग |  | `phase.packing` |
| Completed | पूरा |  | `phase.completed` |
| S | S | ? sizes stay S / M / L | `size.small` |
| M | M |  | `size.medium` |
| L | L |  | `size.large` |

## Home — My work card

| English | हिन्दी | ? | key |
|---|---|---|---|
| My work | मेरा काम |  | `myWork.title` |
| today | आज |  | `myWork.today` |
| this week | इस हफ़्ते |  | `myWork.thisWeek` |
| pieces cut | पीस काटे | ? पीस or मैट | `myWork.unit.cutter` |
| mats stitched | मैट सिले |  | `myWork.unit.stitcher` |
| mats packed | मैट पैक किए |  | `myWork.unit.packer` |
| 3 came back for rework this week | इस हफ़्ते 3 रीवर्क के लिए वापस आए |  | `myWork.reworkReturned` |
| 3 waiting for you | 3 आपके पास बाकी हैं |  | `myWork.reworkOpen` |
| 3 sent to rework this week | इस हफ़्ते 3 रीवर्क में भेजे |  | `myWork.flagged` |

## Batch screen (incl. cutter)

| English | हिन्दी | ? | key |
|---|---|---|---|
| Batch not found | बैच नहीं मिला |  | `batch.notFoundTitle` |
| This batch might have been completed, cancelled, or is no longer assigned to your station. | यह बैच पूरा हो गया होगा, कैंसल हुआ होगा, या अब आपके पास नहीं है। |  | `batch.notFoundBody` |
| Back to queue | लिस्ट पर वापस |  | `batch.backToQueue` |
| Short count | गिनती कम है |  | `batch.shortCountTitle` |
| This batch needs 12 more cut but you're reporting 10. The admin will decide what happens with the remaining 2. | इस बैच में 12 और काटने हैं, पर आप 10 बता रहे हैं। बाकी 2 का क्या होगा, यह एडमिन तय करेगा। |  | `batch.shortCountBody` |
| Complete | पूरा करें |  | `batch.complete` |
| {code} sent to admin for stitching assignment. | {code} सिलाई बाँटने के लिए एडमिन के पास गया। | ? | `batch.sentForAssignment` |
| {code} sent to the next station. | {code} अगले स्टेशन पर गया। |  | `batch.sentToNext` |
| Start cutting | कटिंग शुरू करें |  | `batch.startCutting` |
| Report cut | कटिंग की गिनती भेजें | ? | `batch.reportCut` |
| Join batch | बैच में जुड़ें |  | `batch.joinBatch` |
| Open scanner | स्कैनर खोलें |  | `batch.openScanner` |
| mats to cut | मैट काटने हैं |  | `batch.matsToCut` |
| your share | आपका हिस्सा |  | `batch.yourShare` |
| mats stitched | मैट सिल गए |  | `batch.matsStitched` |
| mats packed | मैट पैक हुए |  | `batch.matsPacked` |
| Assigned workers | इनको दिया गया |  | `batch.assignedWorkers` |
| Active workers | अभी काम कर रहे हैं |  | `batch.activeWorkers` |
| Notes | नोट |  | `batch.notes` |
| Pieces completed | कितने पीस हुए | ? पीस or मैट | `batch.piecesCompleted` |
| Decrease quantity | गिनती घटाएँ |  | `batch.decreaseQty` |
| Increase quantity | गिनती बढ़ाएँ |  | `batch.increaseQty` |
| Quantity completed | कितने पूरे हुए |  | `batch.quantityCompleted` |
| 12 remaining of 40 | 40 में से 12 बाकी |  | `batch.remainingOf` |
| ⏳ {who} is cutting this batch | ⏳ {who} यह बैच काट रहे हैं |  | `batch.cuttingNow` |
| Give back this batch | यह बैच वापस करें |  | `cutting.release` |
| Give back this batch? | यह बैच वापस करें? |  | `cutting.releaseTitle` |
| It goes back to the cutting queue so any cutter can start it. Nothing is reported as cut. | यह कटिंग की लिस्ट में वापस जाएगा, ताकि कोई भी कटर इसे शुरू कर सके। कुछ भी कटा हुआ नहीं गिना जाएगा। |  | `cutting.releaseBody` |
| Give back | वापस करें |  | `cutting.releaseConfirm` |
| Keep it | रखें |  | `cutting.keep` |
| {code} is back in the cutting queue. | {code} कटिंग की लिस्ट में वापस गया। |  | `cutting.released` |

## Scanner (stitcher / packer) and packer inspect sheet

| English | हिन्दी | ? | key |
|---|---|---|---|
| Waiting for rework | रीवर्क में है |  | `scanner.inRework` |
| Written off — keep it aside | यह मैट रद्द है — अलग रखें | ? written off = रद्द | `scanner.writtenOff` |
| Spare stock — keep it aside | स्पेयर माल — अलग रखें | ? spare stock = स्पेयर माल | `scanner.spare` |
| Wrong batch — this mat is from {code} | गलत बैच — यह मैट {code} का है |  | `scanner.wrongBatch` |
| Sent to rework | रीवर्क में भेजा गया |  | `scanner.sentToRework` |
| Already packed | पहले ही पैक हो चुका |  | `scanner.alreadyPacked` |
| This batch is not in packing | यह बैच पैकिंग में नहीं है |  | `scanner.wrongPhase` |
| Join this batch first | पहले इस बैच में जुड़ें |  | `scanner.notStarted` |
| Couldn't check this mat — try again | मैट चेक नहीं हो पाया — फिर कोशिश करें |  | `scanner.peekFailed` |
| Checking… | चेक हो रहा है… |  | `scanner.checking` |
| Already scanned | पहले ही स्कैन हो चुका |  | `scanner.alreadyScanned` |
| Your share is complete | आपका हिस्सा पूरा हुआ |  | `scanner.shareComplete` |
| Your share is complete ✓ | आपका हिस्सा पूरा हुआ ✓ |  | `scanner.shareCompleteTitle` |
| 5 / 20 mats — leave the rest for your co-workers | 5 / 20 मैट — बाकी साथियों के लिए छोड़ दें |  | `scanner.shareCompleteSub` |
| Scan failed — try again | स्कैन नहीं हुआ — फिर कोशिश करें |  | `scanner.scanFailed` |
| Offline — reconnect to scan | इंटरनेट नहीं है — जुड़ने पर स्कैन करें |  | `scanner.offline` |
| Not an RPS unit label | यह RPS का लेबल नहीं है |  | `scanner.notRpsLabel` |
| Scanned {code} | {code} स्कैन हुआ |  | `scanner.scannedA11y` |
| Error: {msg} | गलती: {msg} |  | `scanner.errorA11y` |
| Stitching complete | सिलाई पूरी हुई |  | `scanner.stitchingComplete` |
| {code} complete | {code} पूरा हुआ |  | `scanner.batchComplete` |
| All 3 mats stitched — batch sent to packing. | सभी 3 मैट सिल गए — बैच पैकिंग में गया। |  | `scanner.allStitched` |
| All 3 mats packed and sent to the stockyard. | सभी 3 मैट पैक होकर गोदाम में गए। | ? stockyard = गोदाम | `scanner.allPacked` |
| Allow camera | कैमरा चालू करें |  | `scanner.allowCamera` |
| Camera needed | कैमरा चाहिए |  | `scanner.cameraNeeded` |
| RPS uses the camera to scan unit QR labels. | RPS मैट के QR लेबल स्कैन करने के लिए कैमरा चलाता है। |  | `scanner.cameraWhy` |
| Back to queue | लिस्ट पर वापस |  | `scanner.backToQueueA11y` |
| 🔦 Torch on | 🔦 जलाएँ | ? short on purpose — the scanner top bar is narrow | `scanner.torchOn` |
| 🔦 Torch off | 🔦 बंद करें |  | `scanner.torchOff` |
| Turn torch on | टॉर्च जलाएँ |  | `scanner.torchOnA11y` |
| Turn torch off | टॉर्च बंद करें |  | `scanner.torchOffA11y` |
| Camera didn't start — tap to retry | कैमरा नहीं चला — फिर से चलाने के लिए दबाएँ |  | `scanner.cameraFailed` |
| 5/20 yours · 18/40 batch | 5/20 आपके · 18/40 बैच |  | `scanner.progressMine` |
| 18 / 40 stitched | 18 / 40 सिल गए |  | `scanner.progressStitched` |
| 18 / 40 packed | 18 / 40 पैक हुए |  | `scanner.progressPacked` |
| Point at a unit QR label | मैट के QR लेबल पर कैमरा रखें |  | `scanner.pointAtLabel` |
| Pack mat | मैट पैक करें |  | `scanner.packA11y` |
| Needs rework | रीवर्क चाहिए |  | `scanner.needsReworkA11y` |
| Cancel inspect | जाँच कैंसल करें |  | `scanner.cancelInspectA11y` |
| Inspect Mat | मैट जाँचें |  | `inspect.title` |
| ✓ Pack | ✓ पैक करें |  | `inspect.pack` |
| ✗ Needs rework | ✗ रीवर्क चाहिए |  | `inspect.needsRework` |
| Cancel | कैंसल |  | `inspect.cancel` |

## Rework — send (packer), detail and fix (stitcher)

| English | हिन्दी | ? | key |
|---|---|---|---|
| Rework | रीवर्क |  | `rework.title` |
| Rework item not found | रीवर्क नहीं मिला |  | `rework.notFoundTitle` |
| This item may have already been fixed or reassigned. | यह शायद ठीक हो चुका है या किसी और को दे दिया गया है। |  | `rework.notFoundBody` |
| View full photo | पूरी फ़ोटो देखें |  | `rework.viewPhotoA11y` |
| Defect photo | खराबी की फ़ोटो |  | `rework.defectPhotoA11y` |
| Note | नोट |  | `rework.noteTitle` |
| Close photo preview | फ़ोटो बंद करें |  | `rework.closePhotoA11y` |
| Full-screen rework photo | रीवर्क की पूरी फ़ोटो |  | `rework.fullPhotoA11y` |
| Send to rework | रीवर्क में भेजें |  | `rework.sendToRework` |
| Photos (1–3) | फ़ोटो (1–3) |  | `rework.photosTitle` |
| RPS uses the camera to capture rework defect photos. | RPS रीवर्क की खराबी की फ़ोटो लेने के लिए कैमरा चलाता है। |  | `rework.cameraWhy` |
| ‹ Back | ‹ वापस |  | `rework.back` |
| Reasons | खराबी |  | `rework.reasonsTitle` |
| Optional note for stitcher... | सिलाई वाले के लिए नोट (ज़रूरी नहीं)... | ? stitcher (person) = सिलाई वाला | `rework.notePlaceholder` |
| Take photo | फ़ोटो लें |  | `rework.takePhoto` |
| Remove photo | फ़ोटो हटाएँ |  | `rework.removePhoto` |
| Capture photo | फ़ोटो खींचें |  | `rework.shutterA11y` |
| Take a photo | एक फ़ोटो लें |  | `rework.takeAPhoto` |
| Next → | आगे → |  | `rework.next` |
| Choose what's wrong | खराबी चुनें |  | `rework.chooseWhatsWrong` |
| 3 / 3 photos | 3 / 3 फ़ोटो |  | `rework.photosCount` |
| Remove photo 3 | फ़ोटो 3 हटाएँ |  | `rework.removePhotoN` |
| 1/2 | 1/2 |  | `rework.stepOneOfTwo` |
| 2/2 | 2/2 |  | `rework.stepTwoOfTwo` |
| Note (optional) | नोट (ज़रूरी नहीं) |  | `rework.noteLabel` |
| Tap to edit photos | फ़ोटो बदलने के लिए दबाएँ |  | `rework.tapToEditPhotos` |
| This mat is already in rework | यह मैट पहले से रीवर्क में है |  | `rework.alreadyInRework` |
| Join this batch before sending to rework | रीवर्क में भेजने से पहले इस बैच में जुड़ें |  | `rework.notStarted` |
| Cannot reach server — check connection | सर्वर नहीं मिल रहा — इंटरनेट देखें |  | `rework.networkError` |
| Failed to send rework — try again | रीवर्क नहीं भेजा गया — फिर कोशिश करें |  | `rework.genericError` |
| 🔧 Rework | 🔧 रीवर्क |  | `rework.homeSectionTitle` |
| 2nd time | दूसरी बार |  | `rework.roundBadge` |
| 3rd time | तीसरी बार |  | `rework.roundBadge` |
| Round 4 | 4वीं बार |  | `rework.roundBadge` |
| Sent back by {name} · {time} | {name} ने वापस भेजा · {time} |  | `rework.sentBackBy` |
| 📷 Scan to mark fixed | 📷 ठीक होने पर स्कैन करें | ? | `rework.scanToFix` |
| Fixed ✓ — back to packing | ठीक हो गया ✓ — पैकिंग में वापस |  | `rework.fixedTitle` |
| Mat returned to packing queue. | मैट पैकिंग की लिस्ट में वापस गया। |  | `rework.fixedDesc` |
| Back to my queue | मेरी लिस्ट पर वापस |  | `rework.backToQueue` |
| Point camera at the mat's QR label | मैट के QR लेबल पर कैमरा रखें |  | `rework.pointAtQr` |
| Fixed {code} | {code} ठीक हुआ |  | `rework.fixedA11y` |
| Back to detail | रीवर्क पर वापस |  | `rework.backToDetailA11y` |
| Target Mat | यही मैट स्कैन करें | ? | `rework.targetMat` |
| Wrong mat — this is {code} | गलत मैट — यह {code} है |  | `rework.wrongMat` |
| Waiting for owner's decision | मालिक के फ़ैसले का इंतज़ार है | ? owner = मालिक (or सेठ) | `rework.pendingDecision` |
| This mat is assigned to another stitcher | यह मैट दूसरे सिलाई वाले को दिया गया है | ? stitcher (person) = सिलाई वाला | `rework.notYourRework` |
| Stitching fault | सिलाई में खराबी |  | `rework.reasons.stitching_fault` |
| Stain / dirt | दाग / गंदगी |  | `rework.reasons.stain` |
| Cutting fault | कटिंग में खराबी |  | `rework.reasons.cutting_fault` |
| Material defect | माल में खराबी | ? material = माल | `rework.reasons.material_defect` |
| Other | कुछ और |  | `rework.reasons.other` |

## Error messages (from server error codes)

| English | हिन्दी | ? | key |
|---|---|---|---|
| Cannot reach server — check connection | सर्वर नहीं मिल रहा — इंटरनेट देखें |  | `errors.network_error` |
| This phone is signed out — sign in again or ask your admin | यह फ़ोन लॉग आउट हो गया है — फिर से लॉगिन करें या एडमिन से पूछें |  | `errors.unauthorized` |
| This is not yours to do — ask your admin | यह काम आपका नहीं है — एडमिन से पूछें |  | `errors.forbidden` |
| That didn't go through — try again | यह नहीं हुआ — फिर कोशिश करें |  | `errors.bad_request` |
| Something went wrong — try again | कुछ गड़बड़ हुई — फिर कोशिश करें |  | `errors.internal` |
| Batch not found | बैच नहीं मिला |  | `errors.not_found` |
| Not an RPS unit label | यह RPS का लेबल नहीं है |  | `errors.unit_not_found` |
| This batch is not at your station right now | यह बैच अभी आपके पास नहीं है |  | `errors.wrong_phase` |
| This batch has already been started | यह बैच पहले ही शुरू हो चुका है |  | `errors.already_started` |
| Start or join this batch first | पहले यह बैच शुरू करें या इसमें जुड़ें |  | `errors.not_started` |
| This batch is assigned to other workers | यह बैच दूसरों को दिया गया है |  | `errors.not_assigned` |
| Your share is complete | आपका हिस्सा पूरा हुआ |  | `errors.quota_reached` |
| Waiting for rework | रीवर्क में है |  | `errors.in_rework` |
| This mat is already in rework | यह मैट पहले से रीवर्क में है |  | `errors.already_in_rework` |
| Waiting for owner's decision | मालिक के फ़ैसले का इंतज़ार है | ? owner = मालिक (or सेठ) | `errors.rework_pending_decision` |
| This mat is assigned to another stitcher | यह मैट दूसरे सिलाई वाले को दिया गया है |  | `errors.not_your_rework` |
| This rework is already closed | यह रीवर्क बंद हो चुका है |  | `errors.rework_not_open` |
| Written off — keep it aside | यह मैट रद्द है — अलग रखें | ? same as scanner | `errors.written_off` |
| Spare stock — keep it aside | स्पेयर माल — अलग रखें | ? same as scanner | `errors.spare` |
| Nobody is cutting this batch right now | इस बैच को अभी कोई नहीं काट रहा |  | `errors.no_claim` |
