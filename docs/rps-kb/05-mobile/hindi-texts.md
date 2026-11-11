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

4. ← Back  
   **← वापस**

5. Back to {where}  
   **{where} पर वापस**

6. Back to my queue  
   **मेरी लिस्ट पर वापस**

7. Done ✓  
   **हो गया ✓**

8. Cancel  
   **कैंसल**  
   ❓ कैंसल or रहने दें / रद्द करें

9. Retry  
   **फिर कोशिश करें**

10. Couldn't do that  
   **यह नहीं हो पाया**

11. Something went wrong  
   **कुछ गड़बड़ हुई**

12. You're offline — changes will sync when you reconnect  
   **इंटरनेट नहीं है — जुड़ने पर अपडेट होगा**

13. Cannot reach server  
   **सर्वर नहीं मिल रहा**

14. Request failed  
   **काम नहीं हुआ**

15. Login failed  
   **लॉगिन नहीं हुआ**

## Login and enrollment scan

16. AMBIKA · RIDDHI  
   **AMBIKA · RIDDHI**

17. RPS Worker  
   **RPS Worker**  
   ❓ app name kept in English

18. Scan the enrollment QR from your admin, or type the code, then enter your PIN to set up this phone.  
   **एडमिन से मिला QR स्कैन करें या कोड लिखें, फिर अपना PIN डालकर यह फ़ोन चालू करें।**

19. Set up this phone →  
   **यह फ़ोन चालू करें →**

20. One-time setup. You'll stay signed in on this phone.  
   **बस एक बार करना है। इस फ़ोन में आप लॉगिन रहेंगे।**

21. Scan enrollment code  
   **QR कोड स्कैन करें**

22. Scan a different code  
   **दूसरा कोड स्कैन करें**

23. Enrollment code  
   **कोड**

24. or type the code  
   **या कोड लिखें**

25. 4-digit PIN  
   **4 अंकों का PIN**

26. Wrong code or PIN  
   **कोड या PIN गलत है**

27. To scan your enrollment code.  
   **आपका कोड स्कैन करने के लिए।**

28. Not an enrollment code — ask your admin for the QR  
   **यह सही कोड नहीं है — एडमिन से QR माँगें**

29. Enrollment code scanned  
   **कोड स्कैन हो गया**

30. Cancel enrollment scan  
   **स्कैन कैंसल करें**

31. ← Cancel  
   **← कैंसल**

32. Point at the enrollment QR on the admin screen  
   **एडमिन की स्क्रीन पर दिख रहे QR पर कैमरा रखें**

## Home — queue and batch cards

33. My queue  
   **मेरी लिस्ट**

34. {station} queue  
   **{station} लिस्ट**

35. Sign out  
   **लॉग आउट**  
   ❓ लॉग आउट or साइन आउट / बाहर निकलें

36. Couldn't load your queue. Check connection and retry.  
   **लिस्ट नहीं खुली। इंटरनेट देखें और फिर कोशिश करें।**

37. All clear  
   **सब हो गया**  
   ❓ check this wording

38. Nothing waiting at your station.  
   **आपके पास अभी कोई काम नहीं है।**

39. Rework {code}, {model}  
   **रीवर्क {code}, {model}**

40. Rework defect photo  
   **रीवर्क की खराबी की फ़ोटो**

41. Batch {code}, {car}  
   **बैच {code}, {car}**

42. mats  
   **मैट**

43. your share  
   **आपका हिस्सा**

44. stitched  
   **सिल गए**

45. packed  
   **पैक हुए**

46. ⏳ {who} is cutting  
   **⏳ {who} काट रहे हैं**

47. 📌 Assigned to you  
   **📌 आपको दिया गया**

48. 📌 Assigned to you (with {workers})  
   **📌 आपको दिया गया ({workers} के साथ)**

49. You're in  
   **आप जुड़े हैं**

50. Cutter  
   **कटर**

51. Stitcher  
   **सिलाई**  
   ❓ सिलाई or स्टिचर

52. Packer  
   **पैकर**

53. Cutting  
   **कटिंग**

54. Stitching  
   **सिलाई**

55. Packing  
   **पैकिंग**

56. Completed  
   **पूरा**

57. S  
   **S**  
   ❓ sizes stay S / M / L

58. M  
   **M**

59. L  
   **L**

## Home — My work card

60. My work  
   **मेरा काम**

61. today  
   **आज**

62. this week  
   **इस हफ़्ते**

63. pieces cut  
   **पीस काटे**  
   ❓ पीस or मैट

64. mats stitched  
   **मैट सिले**

65. mats packed  
   **मैट पैक किए**

66. 3 came back for rework this week  
   **इस हफ़्ते 3 रीवर्क के लिए वापस आए**

67. 3 waiting for you  
   **3 आपके पास बाकी हैं**

68. 3 sent to rework this week  
   **इस हफ़्ते 3 रीवर्क में भेजे**

## Batch screen (incl. cutter)

69. Batch not found  
   **बैच नहीं मिला**

70. This batch might have been completed, cancelled, or is no longer assigned to your station.  
   **यह बैच पूरा हो गया होगा, कैंसल हुआ होगा, या अब आपके पास नहीं है।**

71. Back to queue  
   **लिस्ट पर वापस**

72. Short count  
   **गिनती कम है**

73. This batch needs 12 more cut but you're reporting 10. The admin will decide what happens with the remaining 2.  
   **इस बैच में 12 और काटने हैं, पर आप 10 बता रहे हैं। बाकी 2 का क्या होगा, यह एडमिन तय करेगा।**

74. Complete  
   **पूरा करें**

75. {code} sent to admin for stitching assignment.  
   **{code} सिलाई बाँटने के लिए एडमिन के पास गया।**  
   ❓ check this wording

76. {code} sent to the next station.  
   **{code} अगले स्टेशन पर गया।**

77. Start cutting  
   **कटिंग शुरू करें**

78. Report cut  
   **कटिंग की गिनती भेजें**  
   ❓ check this wording

79. Join batch  
   **बैच में जुड़ें**

80. Open scanner  
   **स्कैनर खोलें**

81. mats to cut  
   **मैट काटने हैं**

82. your share  
   **आपका हिस्सा**

83. mats stitched  
   **मैट सिल गए**

84. mats packed  
   **मैट पैक हुए**

85. Assigned workers  
   **इनको दिया गया**

86. Active workers  
   **अभी काम कर रहे हैं**

87. Notes  
   **नोट**

88. Pieces completed  
   **कितने पीस हुए**  
   ❓ पीस or मैट

89. Decrease quantity  
   **गिनती घटाएँ**

90. Increase quantity  
   **गिनती बढ़ाएँ**

91. Quantity completed  
   **कितने पूरे हुए**

92. 12 remaining of 40  
   **40 में से 12 बाकी**

93. ⏳ {who} is cutting this batch  
   **⏳ {who} यह बैच काट रहे हैं**

94. Give back this batch  
   **यह बैच वापस करें**

95. Give back this batch?  
   **यह बैच वापस करें?**

96. It goes back to the cutting queue so any cutter can start it. Nothing is reported as cut.  
   **यह कटिंग की लिस्ट में वापस जाएगा, ताकि कोई भी कटर इसे शुरू कर सके। कुछ भी कटा हुआ नहीं गिना जाएगा।**

97. Give back  
   **वापस करें**

98. Keep it  
   **रखें**

99. {code} is back in the cutting queue.  
   **{code} कटिंग की लिस्ट में वापस गया।**

## Scanner (stitcher / packer) and packer inspect sheet

100. Waiting for rework  
   **रीवर्क में है**

101. Written off — keep it aside  
   **यह मैट रद्द है — अलग रखें**  
   ❓ written off = रद्द

102. Spare stock — keep it aside  
   **स्पेयर माल — अलग रखें**  
   ❓ spare stock = स्पेयर माल

103. Wrong batch — this mat is from {code}  
   **गलत बैच — यह मैट {code} का है**

104. Sent to rework  
   **रीवर्क में भेजा गया**

105. Already packed  
   **पहले ही पैक हो चुका**

106. This batch is not in packing  
   **यह बैच पैकिंग में नहीं है**

107. Join this batch first  
   **पहले इस बैच में जुड़ें**

108. Couldn't check this mat — try again  
   **मैट चेक नहीं हो पाया — फिर कोशिश करें**

109. Checking…  
   **चेक हो रहा है…**

110. Already scanned  
   **पहले ही स्कैन हो चुका**

111. Your share is complete  
   **आपका हिस्सा पूरा हुआ**

112. Your share is complete ✓  
   **आपका हिस्सा पूरा हुआ ✓**

113. 5 / 20 mats — leave the rest for your co-workers  
   **5 / 20 मैट — बाकी साथियों के लिए छोड़ दें**

114. Scan failed — try again  
   **स्कैन नहीं हुआ — फिर कोशिश करें**

115. Offline — reconnect to scan  
   **इंटरनेट नहीं है — जुड़ने पर स्कैन करें**

116. Not an RPS unit label  
   **यह RPS का लेबल नहीं है**

117. Scanned {code}  
   **{code} स्कैन हुआ**

118. Error: {msg}  
   **गलती: {msg}**

119. Stitching complete  
   **सिलाई पूरी हुई**

120. {code} complete  
   **{code} पूरा हुआ**

121. All 3 mats stitched — batch sent to packing.  
   **सभी 3 मैट सिल गए — बैच पैकिंग में गया।**

122. All 3 mats packed and sent to the stockyard.  
   **सभी 3 मैट पैक होकर गोदाम में गए।**  
   ❓ stockyard = गोदाम

123. Allow camera  
   **कैमरा चालू करें**

124. Camera needed  
   **कैमरा चाहिए**

125. RPS uses the camera to scan unit QR labels.  
   **RPS मैट के QR लेबल स्कैन करने के लिए कैमरा चलाता है।**

126. Back to queue  
   **लिस्ट पर वापस**

127. 🔦 Torch on  
   **🔦 जलाएँ**  
   ❓ short on purpose — the scanner top bar is narrow

128. 🔦 Torch off  
   **🔦 बंद करें**

129. Turn torch on  
   **टॉर्च जलाएँ**

130. Turn torch off  
   **टॉर्च बंद करें**

131. Camera didn't start — tap to retry  
   **कैमरा नहीं चला — फिर से चलाने के लिए दबाएँ**

132. 5/20 yours · 18/40 batch  
   **5/20 आपके · 18/40 बैच**

133. 18 / 40 stitched  
   **18 / 40 सिल गए**

134. 18 / 40 packed  
   **18 / 40 पैक हुए**

135. Point at a unit QR label  
   **मैट के QR लेबल पर कैमरा रखें**

136. Pack mat  
   **मैट पैक करें**

137. Needs rework  
   **रीवर्क चाहिए**

138. Cancel inspect  
   **जाँच कैंसल करें**

139. Inspect Mat  
   **मैट जाँचें**

140. ✓ Pack  
   **✓ पैक करें**

141. ✗ Needs rework  
   **✗ रीवर्क चाहिए**

142. Cancel  
   **कैंसल**

## Rework — send (packer), detail and fix (stitcher)

143. Rework  
   **रीवर्क**

144. Rework item not found  
   **रीवर्क नहीं मिला**

145. This item may have already been fixed or reassigned.  
   **यह शायद ठीक हो चुका है या किसी और को दे दिया गया है।**

146. View full photo  
   **पूरी फ़ोटो देखें**

147. Defect photo  
   **खराबी की फ़ोटो**

148. Note  
   **नोट**

149. Close photo preview  
   **फ़ोटो बंद करें**

150. Full-screen rework photo  
   **रीवर्क की पूरी फ़ोटो**

151. Send to rework  
   **रीवर्क में भेजें**

152. Photos (1–3)  
   **फ़ोटो (1–3)**

153. RPS uses the camera to capture rework defect photos.  
   **RPS रीवर्क की खराबी की फ़ोटो लेने के लिए कैमरा चलाता है।**

154. ‹ Back  
   **‹ वापस**

155. Reasons  
   **खराबी**

156. Optional note for stitcher...  
   **सिलाई वाले के लिए नोट (ज़रूरी नहीं)...**  
   ❓ stitcher (person) = सिलाई वाला

157. Take photo  
   **फ़ोटो लें**

158. Remove photo  
   **फ़ोटो हटाएँ**

159. Capture photo  
   **फ़ोटो खींचें**

160. Take a photo  
   **एक फ़ोटो लें**

161. Next →  
   **आगे →**

162. Choose what's wrong  
   **खराबी चुनें**

163. 3 / 3 photos  
   **3 / 3 फ़ोटो**

164. Remove photo 3  
   **फ़ोटो 3 हटाएँ**

165. 1/2  
   **1/2**

166. 2/2  
   **2/2**

167. Note (optional)  
   **नोट (ज़रूरी नहीं)**

168. Tap to edit photos  
   **फ़ोटो बदलने के लिए दबाएँ**

169. This mat is already in rework  
   **यह मैट पहले से रीवर्क में है**

170. Join this batch before sending to rework  
   **रीवर्क में भेजने से पहले इस बैच में जुड़ें**

171. Cannot reach server — check connection  
   **सर्वर नहीं मिल रहा — इंटरनेट देखें**

172. Failed to send rework — try again  
   **रीवर्क नहीं भेजा गया — फिर कोशिश करें**

173. 🔧 Rework  
   **🔧 रीवर्क**

174. 2nd time  
   **दूसरी बार**

175. 3rd time  
   **तीसरी बार**

176. Round 4  
   **4वीं बार**

177. Sent back by {name} · {time}  
   **{name} ने वापस भेजा · {time}**

178. 📷 Scan to mark fixed  
   **📷 ठीक होने पर स्कैन करें**  
   ❓ check this wording

179. Fixed ✓ — back to packing  
   **ठीक हो गया ✓ — पैकिंग में वापस**

180. Mat returned to packing queue.  
   **मैट पैकिंग की लिस्ट में वापस गया।**

181. Back to my queue  
   **मेरी लिस्ट पर वापस**

182. Point camera at the mat's QR label  
   **मैट के QR लेबल पर कैमरा रखें**

183. Fixed {code}  
   **{code} ठीक हुआ**

184. Back to detail  
   **रीवर्क पर वापस**

185. Target Mat  
   **यही मैट स्कैन करें**  
   ❓ check this wording

186. Wrong mat — this is {code}  
   **गलत मैट — यह {code} है**

187. Waiting for owner's decision  
   **मालिक के फ़ैसले का इंतज़ार है**  
   ❓ owner = मालिक (or सेठ)

188. This mat is assigned to another stitcher  
   **यह मैट दूसरे सिलाई वाले को दिया गया है**  
   ❓ stitcher (person) = सिलाई वाला

189. Stitching fault  
   **सिलाई में खराबी**

190. Stain / dirt  
   **दाग / गंदगी**

191. Cutting fault  
   **कटिंग में खराबी**

192. Material defect  
   **माल में खराबी**  
   ❓ material = माल

193. Other  
   **कुछ और**

## Error messages (from server error codes)

194. Cannot reach server — check connection  
   **सर्वर नहीं मिल रहा — इंटरनेट देखें**

195. This phone is signed out — sign in again or ask your admin  
   **यह फ़ोन लॉग आउट हो गया है — फिर से लॉगिन करें या एडमिन से पूछें**

196. This is not yours to do — ask your admin  
   **यह काम आपका नहीं है — एडमिन से पूछें**

197. That didn't go through — try again  
   **यह नहीं हुआ — फिर कोशिश करें**

198. Something went wrong — try again  
   **कुछ गड़बड़ हुई — फिर कोशिश करें**

199. Batch not found  
   **बैच नहीं मिला**

200. Not an RPS unit label  
   **यह RPS का लेबल नहीं है**

201. This batch is not at your station right now  
   **यह बैच अभी आपके पास नहीं है**

202. This batch has already been started  
   **यह बैच पहले ही शुरू हो चुका है**

203. Start or join this batch first  
   **पहले यह बैच शुरू करें या इसमें जुड़ें**

204. This batch is assigned to other workers  
   **यह बैच दूसरों को दिया गया है**

205. Your share is complete  
   **आपका हिस्सा पूरा हुआ**

206. Waiting for rework  
   **रीवर्क में है**

207. This mat is already in rework  
   **यह मैट पहले से रीवर्क में है**

208. Waiting for owner's decision  
   **मालिक के फ़ैसले का इंतज़ार है**  
   ❓ owner = मालिक (or सेठ)

209. This mat is assigned to another stitcher  
   **यह मैट दूसरे सिलाई वाले को दिया गया है**

210. This rework is already closed  
   **यह रीवर्क बंद हो चुका है**

211. Written off — keep it aside  
   **यह मैट रद्द है — अलग रखें**  
   ❓ same as scanner

212. Spare stock — keep it aside  
   **स्पेयर माल — अलग रखें**  
   ❓ same as scanner

213. Nobody is cutting this batch right now  
   **इस बैच को अभी कोई नहीं काट रहा**
