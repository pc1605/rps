# Hindi texts on the worker phone — for the owner's review (H1, Nov 2026)

Every text of the phone app, grouped by screen: the English line first, the Hindi under it in bold. Generated from `apps/mobile/lib/strings.ts`
(English) and `apps/mobile/lib/strings.hi.ts` (Hindi) — change a wording in `strings.hi.ts` and update the line here.

- **❓** under a line = the agent is not sure of it; the note says what to decide.
- `{code}`, `{name}`, `{who}` … stand for a batch / unit code or a name put in by the app. Numbers in the examples
  (12, 10, 40 …) are samples. Codes, names, digits and the emoji / icons are the same in both languages.
- A few lines are only read aloud by the screen reader (TalkBack), never shown (e.g. "Decrease quantity").
- Not translated on purpose: batch and unit codes, car brand / model, product line and worker names, digits, "RPS",
  "AMBIKA · RIDDHI", sizes S / M / L, and the language names "English" / "हिन्दी" on the picker.
- Still English in Hindi mode: a server error with a code the phone doesn't know (none known today), notes typed by
  the admin, and the Android permission pop-up for the camera (system text).

## Every screen (common)

1. Language  
   **भाषा**

2. Queue  
   **लिस्ट**  
   ❓ queue = लिस्ट (not लाइन, which also means product line)

3. Back  
   **वापस**

4. Back to {where}  
   **{where} पर वापस**

5. Back to my queue  
   **मेरी लिस्ट पर वापस**

6. Done ✓  
   **हो गया ✓**

7. Cancel  
   **कैंसल**  
   ❓ कैंसल or रहने दें / रद्द करें

8. Retry  
   **फिर कोशिश करें**

9. Couldn't do that  
   **यह नहीं हो पाया**

10. Something went wrong  
   **कुछ गड़बड़ हुई**

11. You're offline — changes will sync when you reconnect  
   **इंटरनेट नहीं है — जुड़ने पर अपडेट होगा**

12. Cannot reach server  
   **सर्वर नहीं मिल रहा**

13. Request failed  
   **काम नहीं हुआ**

14. Login failed  
   **लॉगिन नहीं हुआ**

## Login and enrollment scan

15. AMBIKA · RIDDHI  
   **AMBIKA · RIDDHI**

16. RPS Worker  
   **RPS Worker**  
   ❓ app name kept in English

17. Your admin sets up this phone. Scan the code on the admin's screen, then enter your PIN.  
   **यह फ़ोन एडमिन चालू करेंगे। एडमिन की स्क्रीन का कोड स्कैन करें, फिर अपना PIN डालें।**

18. Set up this phone →  
   **यह फ़ोन चालू करें →**

19. One-time setup. You'll stay signed in on this phone.  
   **बस एक बार करना है। इस फ़ोन में आप लॉगिन रहेंगे।**

20. Scan enrollment code  
   **QR कोड स्कैन करें**

21. Scan a different code  
   **दूसरा कोड स्कैन करें**

22. Code — the admin types it  
   **कोड — एडमिन डालेंगे**  
   (label of the hand-typed code field; the digits show as dots)

23. Enter code by hand  
   **कोड हाथ से डालें**  
   (link under the scan button, for when the camera does not work)

24. 4-digit PIN  
   **4 अंकों का PIN**

25. Wrong code or PIN  
   **कोड या PIN गलत है**

26. To scan your enrollment code.  
   **आपका कोड स्कैन करने के लिए।**

27. Not an enrollment code — ask your admin for the QR  
   **यह सही कोड नहीं है — एडमिन से QR माँगें**

28. Enrollment code scanned  
   **कोड स्कैन हो गया**

29. Cancel enrollment scan  
   **स्कैन कैंसल करें**

30. Cancel  
   **कैंसल**

31. Point at the enrollment QR on the admin screen  
   **एडमिन की स्क्रीन पर दिख रहे QR पर कैमरा रखें**

## Home — queue and batch cards

32. My queue  
   **मेरी लिस्ट**

33. {station} queue  
   **{station} लिस्ट**

34. Sign out  
   **लॉग आउट**  
   ❓ लॉग आउट or साइन आउट / बाहर निकलें

35. Couldn't load your queue. Check connection and retry.  
   **लिस्ट नहीं खुली। इंटरनेट देखें और फिर कोशिश करें।**

36. All clear  
   **सब हो गया**  
   ❓ check this wording

37. Nothing waiting at your station.  
   **आपके पास अभी कोई काम नहीं है।**

38. Rework {code}, {model}  
   **रीवर्क {code}, {model}**

39. Rework defect photo  
   **रीवर्क की खराबी की फ़ोटो**

40. Batch {code}, {car}  
   **बैच {code}, {car}**

41. mats  
   **मैट**

42. your share  
   **आपका हिस्सा**

43. stitched  
   **सिल गए**

44. packed  
   **पैक हुए**

45. ⏳ {who} is cutting  
   **⏳ {who} काट रहे हैं**

46. 📌 Assigned to you  
   **📌 आपको दिया गया**

47. 📌 Assigned to you (with {workers})  
   **📌 आपको दिया गया ({workers} के साथ)**

48. You're in  
   **आप जुड़े हैं**

49. Cutter  
   **कटर**

50. Stitcher  
   **सिलाई**  
   ❓ सिलाई or स्टिचर

51. Packer  
   **पैकर**

52. Cutting  
   **कटिंग**

53. Stitching  
   **सिलाई**

54. Packing  
   **पैकिंग**

55. Completed  
   **पूरा**

56. S  
   **S**  
   ❓ sizes stay S / M / L

57. M  
   **M**

58. L  
   **L**

## Home — My work card

59. My work  
   **मेरा काम**

60. today  
   **आज**

61. this week  
   **इस हफ़्ते**

62. pieces cut  
   **पीस काटे**  
   ❓ पीस or मैट

63. mats stitched  
   **मैट सिले**

64. mats packed  
   **मैट पैक किए**

65. 3 came back for rework this week  
   **इस हफ़्ते 3 रीवर्क के लिए वापस आए**

66. 3 waiting for you  
   **3 आपके पास बाकी हैं**

67. 3 sent to rework this week  
   **इस हफ़्ते 3 रीवर्क में भेजे**

## Batch screen (incl. cutter)

68. Batch not found  
   **बैच नहीं मिला**

69. This batch might have been completed, cancelled, or is no longer assigned to your station.  
   **यह बैच पूरा हो गया होगा, कैंसल हुआ होगा, या अब आपके पास नहीं है।**

70. Back to queue  
   **लिस्ट पर वापस**

71. Short count  
   **गिनती कम है**

72. This batch needs 12 more cut but you're reporting 10. The admin will decide what happens with the remaining 2.  
   **इस बैच में 12 और काटने हैं, पर आप 10 बता रहे हैं। बाकी 2 का क्या होगा, यह एडमिन तय करेगा।**

73. Complete  
   **पूरा करें**

74. {code} sent to admin for stitching assignment.  
   **{code} सिलाई बाँटने के लिए एडमिन के पास गया।**  
   ❓ check this wording

75. {code} sent to the next station.  
   **{code} अगले स्टेशन पर गया।**

76. Start cutting  
   **कटिंग शुरू करें**

77. Report cut  
   **कटिंग की गिनती भेजें**  
   ❓ check this wording

78. Join batch  
   **बैच में जुड़ें**

79. Open scanner  
   **स्कैनर खोलें**

80. mats to cut  
   **मैट काटने हैं**

81. your share  
   **आपका हिस्सा**

82. mats stitched  
   **मैट सिल गए**

83. mats packed  
   **मैट पैक हुए**

84. Assigned workers  
   **इनको दिया गया**

85. Active workers  
   **अभी काम कर रहे हैं**

86. Notes  
   **नोट**

87. Pieces completed  
   **कितने पीस हुए**  
   ❓ पीस or मैट

88. Decrease quantity  
   **गिनती घटाएँ**

89. Increase quantity  
   **गिनती बढ़ाएँ**

90. Quantity completed  
   **कितने पूरे हुए**

91. 12 remaining of 40  
   **40 में से 12 बाकी**

92. ⏳ {who} is cutting this batch  
   **⏳ {who} यह बैच काट रहे हैं**

93. Give back this batch  
   **यह बैच वापस करें**

94. It goes back to the admin, who gives it to a cutter again. Nothing is reported as cut.  
   **यह एडमिन के पास वापस जाएगा, वे इसे फिर किसी कटर को देंगे। कुछ भी कटा हुआ नहीं गिना जाएगा।**  
   (give-back screen, under the title)

95. Give back  
   **वापस करें**  
   (give-back screen, footer button)

96. Why are you giving it back?  
   **आप इसे वापस क्यों कर रहे हैं?**  
   (give-back screen title, D48 — the admin sees the reason)

97. 🛠️ Machine problem  
   **🛠️ मशीन में खराबी**

98. 🧻 Material problem  
   **🧻 माल में दिक्कत**

99. ⏳ Too much work  
   **⏳ काम ज़्यादा है**

100. 🌙 Shift over  
   **🌙 शिफ्ट ख़त्म**

101. ❓ Other  
   **❓ कुछ और**

102. Choose a reason  
   **कारण चुनें**  
   (footer button until a reason is picked)

103. Note (optional)  
   **नोट (ज़रूरी नहीं)**

104. Note — write what happened  
   **नोट — लिखें क्या हुआ**  
   (when Other is picked: the note is needed)

105. What happened?  
   **क्या हुआ?**  
   (empty note box)

106. {code} is back with the admin.  
   **{code} एडमिन के पास वापस गया।**

## Scanner (stitcher / packer) and packer inspect sheet

107. Waiting for rework  
   **रीवर्क में है**

108. Written off — keep it aside  
   **यह मैट रद्द है — अलग रखें**  
   ❓ written off = रद्द

109. Spare stock — keep it aside  
   **स्पेयर माल — अलग रखें**  
   ❓ spare stock = स्पेयर माल

110. Wrong batch — this mat is from {code}  
   **गलत बैच — यह मैट {code} का है**

111. Sent to rework  
   **रीवर्क में भेजा गया**

112. Already packed  
   **पहले ही पैक हो चुका**

113. This batch is not in packing  
   **यह बैच पैकिंग में नहीं है**

114. Join this batch first  
   **पहले इस बैच में जुड़ें**

115. Couldn't check this mat — try again  
   **मैट चेक नहीं हो पाया — फिर कोशिश करें**

116. Checking…  
   **चेक हो रहा है…**

117. Already scanned  
   **पहले ही स्कैन हो चुका**

118. Your share is complete  
   **आपका हिस्सा पूरा हुआ**

119. Your share is complete ✓  
   **आपका हिस्सा पूरा हुआ ✓**

120. 5 / 20 mats — leave the rest for your co-workers  
   **5 / 20 मैट — बाकी साथियों के लिए छोड़ दें**

121. Scan failed — try again  
   **स्कैन नहीं हुआ — फिर कोशिश करें**

122. Offline — reconnect to scan  
   **इंटरनेट नहीं है — जुड़ने पर स्कैन करें**

123. Not an RPS unit label  
   **यह RPS का लेबल नहीं है**

124. Scanned {code}  
   **{code} स्कैन हुआ**

125. Error: {msg}  
   **गलती: {msg}**

126. Stitching complete  
   **सिलाई पूरी हुई**

127. {code} complete  
   **{code} पूरा हुआ**

128. All 3 mats stitched — batch sent to packing.  
   **सभी 3 मैट सिल गए — बैच पैकिंग में गया।**

129. All 3 mats packed and sent to the stockyard.  
   **सभी 3 मैट पैक होकर गोदाम में गए।**  
   ❓ stockyard = गोदाम

130. Allow camera  
   **कैमरा चालू करें**

131. Camera needed  
   **कैमरा चाहिए**

132. RPS uses the camera to scan unit QR labels.  
   **RPS मैट के QR लेबल स्कैन करने के लिए कैमरा चलाता है।**

133. Back to queue  
   **लिस्ट पर वापस**

134. 🔦 Torch on  
   **🔦 जलाएँ**  
   ❓ short on purpose — the scanner top bar is narrow

135. 🔦 Torch off  
   **🔦 बंद करें**

136. Turn torch on  
   **टॉर्च जलाएँ**

137. Turn torch off  
   **टॉर्च बंद करें**

138. Camera didn't start — tap to retry  
   **कैमरा नहीं चला — फिर से चलाने के लिए दबाएँ**

139. 5/20 yours · 18/40 batch  
   **5/20 आपके · 18/40 बैच**

140. 18 / 40 stitched  
   **18 / 40 सिल गए**

141. 18 / 40 packed  
   **18 / 40 पैक हुए**

142. Point at a unit QR label  
   **मैट के QR लेबल पर कैमरा रखें**

143. Pack mat  
   **मैट पैक करें**

144. Needs rework  
   **रीवर्क चाहिए**

145. Cancel inspect  
   **जाँच कैंसल करें**

146. Inspect Mat  
   **मैट जाँचें**

147. ✓ Pack  
   **✓ पैक करें**

148. ✗ Needs rework  
   **✗ रीवर्क चाहिए**

149. Cancel  
   **कैंसल**

## Rework — send (packer), detail and fix (stitcher)

150. Rework  
   **रीवर्क**

151. Rework item not found  
   **रीवर्क नहीं मिला**

152. This item may have already been fixed or reassigned.  
   **यह शायद ठीक हो चुका है या किसी और को दे दिया गया है।**

153. View full photo  
   **पूरी फ़ोटो देखें**

154. Defect photo  
   **खराबी की फ़ोटो**

155. Note  
   **नोट**

156. Close photo preview  
   **फ़ोटो बंद करें**

157. Full-screen rework photo  
   **रीवर्क की पूरी फ़ोटो**

158. Send to rework  
   **रीवर्क में भेजें**

159. Photos (1–3)  
   **फ़ोटो (1–3)**

160. RPS uses the camera to capture rework defect photos.  
   **RPS रीवर्क की खराबी की फ़ोटो लेने के लिए कैमरा चलाता है।**

161. Reasons  
   **खराबी**

162. Optional note for stitcher...  
   **सिलाई वाले के लिए नोट (ज़रूरी नहीं)...**  
   ❓ stitcher (person) = सिलाई वाला

163. Take photo  
   **फ़ोटो लें**

164. Remove photo  
   **फ़ोटो हटाएँ**

165. Capture photo  
   **फ़ोटो खींचें**

166. Take a photo  
   **एक फ़ोटो लें**

167. Next →  
   **आगे →**

168. Choose what's wrong  
   **खराबी चुनें**

169. 3 / 3 photos  
   **3 / 3 फ़ोटो**

170. Remove photo 3  
   **फ़ोटो 3 हटाएँ**

171. 1/2  
   **1/2**

172. 2/2  
   **2/2**

173. Note (optional)  
   **नोट (ज़रूरी नहीं)**

174. Tap to edit photos  
   **फ़ोटो बदलने के लिए दबाएँ**

175. This mat is already in rework  
   **यह मैट पहले से रीवर्क में है**

176. Join this batch before sending to rework  
   **रीवर्क में भेजने से पहले इस बैच में जुड़ें**

177. Cannot reach server — check connection  
   **सर्वर नहीं मिल रहा — इंटरनेट देखें**

178. Failed to send rework — try again  
   **रीवर्क नहीं भेजा गया — फिर कोशिश करें**

179. 🔧 Rework  
   **🔧 रीवर्क**

180. 2nd time  
   **दूसरी बार**

181. 3rd time  
   **तीसरी बार**

182. Round 4  
   **4वीं बार**

183. Sent back by {name} · {time}  
   **{name} ने वापस भेजा · {time}**

184. 📷 Scan to mark fixed  
   **📷 ठीक होने पर स्कैन करें**  
   ❓ check this wording

185. Fixed ✓ — back to packing  
   **ठीक हो गया ✓ — पैकिंग में वापस**

186. Mat returned to packing queue.  
   **मैट पैकिंग की लिस्ट में वापस गया।**

187. Back to my queue  
   **मेरी लिस्ट पर वापस**

188. Point camera at the mat's QR label  
   **मैट के QR लेबल पर कैमरा रखें**

189. Fixed {code}  
   **{code} ठीक हुआ**

190. Back to detail  
   **रीवर्क पर वापस**

191. Target Mat  
   **यही मैट स्कैन करें**  
   ❓ check this wording

192. Wrong mat — this is {code}  
   **गलत मैट — यह {code} है**

193. Waiting for owner's decision  
   **मालिक के फ़ैसले का इंतज़ार है**  
   ❓ owner = मालिक (or सेठ)

194. This mat is assigned to another stitcher  
   **यह मैट दूसरे सिलाई वाले को दिया गया है**  
   ❓ stitcher (person) = सिलाई वाला

195. Stitching fault  
   **सिलाई में खराबी**

196. Stain / dirt  
   **दाग / गंदगी**

197. Cutting fault  
   **कटिंग में खराबी**

198. Material defect  
   **माल में खराबी**  
   ❓ material = माल

199. Other  
   **कुछ और**

## Error messages (from server error codes)

200. Cannot reach server — check connection  
   **सर्वर नहीं मिल रहा — इंटरनेट देखें**

201. This phone is signed out — sign in again or ask your admin  
   **यह फ़ोन लॉग आउट हो गया है — फिर से लॉगिन करें या एडमिन से पूछें**

202. This is not yours to do — ask your admin  
   **यह काम आपका नहीं है — एडमिन से पूछें**

203. That didn't go through — try again  
   **यह नहीं हुआ — फिर कोशिश करें**

204. Something went wrong — try again  
   **कुछ गड़बड़ हुई — फिर कोशिश करें**

205. Batch not found  
   **बैच नहीं मिला**

206. Not an RPS unit label  
   **यह RPS का लेबल नहीं है**

207. This batch is not at your station right now  
   **यह बैच अभी आपके पास नहीं है**

208. This batch has already been started  
   **यह बैच पहले ही शुरू हो चुका है**

209. Start or join this batch first  
   **पहले यह बैच शुरू करें या इसमें जुड़ें**

210. This batch is assigned to other workers  
   **यह बैच दूसरों को दिया गया है**

211. Your share is complete  
   **आपका हिस्सा पूरा हुआ**

212. Waiting for rework  
   **रीवर्क में है**

213. This mat is already in rework  
   **यह मैट पहले से रीवर्क में है**

214. Waiting for owner's decision  
   **मालिक के फ़ैसले का इंतज़ार है**  
   ❓ owner = मालिक (or सेठ)

215. This mat is assigned to another stitcher  
   **यह मैट दूसरे सिलाई वाले को दिया गया है**

216. This rework is already closed  
   **यह रीवर्क बंद हो चुका है**

217. Written off — keep it aside  
   **यह मैट रद्द है — अलग रखें**  
   ❓ same as scanner

218. Spare stock — keep it aside  
   **स्पेयर माल — अलग रखें**  
   ❓ same as scanner

219. Nobody is cutting this batch right now  
   **इस बैच को अभी कोई नहीं काट रहा**

## My work — month screen (work history, M1)

Opened by tapping the My work card. The title is "My work" (line 59), the unit under the total is lines 62–64, and
today's row is marked with "today" (line 60). A day row reads weekday + date: "Mon 3" / "सोम 3"; the month line reads
"November 2026" / "नवंबर 2026". "Previous month" / "Next month" are only read aloud (the buttons are arrows).

220. see month  
   **महीना देखें**

221. January  
   **जनवरी**

222. February  
   **फ़रवरी**

223. March  
   **मार्च**

224. April  
   **अप्रैल**

225. May  
   **मई**

226. June  
   **जून**

227. July  
   **जुलाई**

228. August  
   **अगस्त**

229. September  
   **सितंबर**

230. October  
   **अक्टूबर**

231. November  
   **नवंबर**

232. December  
   **दिसंबर**

233. Sun  
   **रवि**

234. Mon  
   **सोम**

235. Tue  
   **मंगल**

236. Wed  
   **बुध**

237. Thu  
   **गुरु**

238. Fri  
   **शुक्र**

239. Sat  
   **शनि**

240. Previous month  
   **पिछला महीना**

241. Next month  
   **अगला महीना**

242. 12 days worked  (1 day worked)  
   **12 दिन काम किया**  
   ❓ दिन काम किया, or "12 दिन हाज़िर" — but this is days with work scanned, not attendance

243. No work recorded this month  
   **इस महीने कोई काम दर्ज नहीं है**  
   ❓ दर्ज, or simpler: "इस महीने कोई काम नहीं हुआ"

244. Couldn't load your work. Check connection and retry.  
   **आपका काम नहीं खुला। इंटरनेट देखें और फिर कोशिश करें।**

## Packer queue — mats out for rework

Shown to packers on the queue card and the batch screen when mats of the batch are in rework (lines 237–238 sit on
one line: "1 in rework · 0 left to pack"). Line 239 is the chip on a batch where everything left is in rework.

245. 1 in rework  
   **1 रीवर्क में**

246. 0 left to pack  
   **0 पैक करना बाकी**  
   ❓ पैक करना बाकी, or "पैक होने बाकी"

247. Waiting for rework  
   **रीवर्क का इंतज़ार**

## Login — one-time code, one phone per worker (D44)

248. Code scanned ✓  
   **कोड स्कैन हो गया ✓**  
   (shown instead of the code after scanning)

249. This phone was signed out because you signed in on another phone. Ask your admin to set it up again.  
   **आपने दूसरे फ़ोन में लॉगिन किया, इसलिए यह फ़ोन बंद हो गया। इसे फिर चालू करने के लिए एडमिन से कहें।**  
   ❓ बंद हो गया, or "लॉग आउट हो गया"

250. Too many wrong tries — wait 15 minutes, then try again  
   **बहुत बार गलत कोशिश हुई — 15 मिनट रुकें, फिर कोशिश करें**  
   (login, after 10 wrong codes or PINs from one place — E1)

## Notifications (N1)

251. Work for you  
   **आपका काम**  
   (Android Settings → Notifications: the name of RPS's notification channel)

252. 📌 New batch assigned to you  
   **📌 आपको नया बैच दिया गया**  
   (notification title — written by the server, `internal/push/notifier.go`; under it the batch code and car)

253. 🔧 Rework mat to fix  
   **🔧 ठीक करने के लिए रीवर्क मैट**  
   (notification title — written by the server; under it the mat code and car)

## Camera turned off for RPS (all camera screens)

254. Open settings  
   **सेटिंग खोलें**  
   (replaces "Allow camera" when Android won't ask again; opens RPS's page in Android settings)

255. The camera is off for RPS. Open settings, tap Permissions and turn on Camera.  
   **RPS के लिए कैमरा बंद है। सेटिंग खोलें, Permissions दबाएँ और Camera चालू करें।**  
   ❓ "Permissions" and "Camera" left in English: on these phones Android settings show them in English
