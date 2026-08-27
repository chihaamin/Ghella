import type { Lang } from "./dict"

/**
 * Copy for the individual calendar tasks. Kept apart from `dict` because these
 * strings are authored per-task by agronomy, not per-screen by design.
 */
const en = {
  sType: "SOIL",
  wType: "WATER",
  tType: "TREATMENT",
  rType: "ROUTINE",

  prepT: "Spread 16 t manure + base NPK 45-60-60 — North",
  prepC: "$310 · AgriSupply: in stock",
  prepW: "Plow in at 25 cm — base fertility for the 110-day cycle. Dry window today; rain Thursday.",
  prepRain: "Rain tonight 18 mm — plowing moved to Friday (wet soil compacts)",

  flushT: "Flush & pressure-test drip lines",
  flushC: "4 lines · ~45 min",
  flushW: "Before planting Sep 9. Season need: 3,360 m³ — your well covers it with margin.",

  bedsT: "Form beds 80 cm apart + lay mulch film",
  bedsC: "$45 film",
  bedsW: "26,400 Rio Grande seedlings reserved — nursery delivers Sep 9.",

  irrT: "Irrigate North — Rio Grande",
  irrC: "25 mm ≈ 4 h drip · 20 m³",
  irrW: "Flowering stage + no rain for 6 days. Computed from ETo 5.1 mm × sandy loam.",
  irrCancel: "Rain tonight 18 mm — cancelled · 20 m³ saved",

  trT: "Preventive copper spray — North",
  trC: "80 g in 30 L · knapsack",
  trW: "Why now: 3 humid days at 18–22°C ahead — blight risk spikes. Window: within 48 h.",

  cu1: "Curative: copper oxychloride — spray 1 of 3",
  cu1C: "120 g in 40 L · your 0.8 ha",
  cu1W: "From your early-blight diagnosis. Best window Sat morning (Thu wind, Fri rain).",
  cuMoved: "SAT · GO",

  roT: "Scout melon — underside of leaves",
  roW: "Aphid colonies start on the River block edge rows this week of the cycle.",
  ro2T: "Side-dress nitrogen — Onion Hill",
  ro2W: "Bulbing begins — split dose 40 kg/ha urea, then irrigate lightly.",

  // Month-view day detail lines
  transplantT: "Transplant 26,400 seedlings at 40 cm — in the evening",
  waterInT: "Water-in 10 mm the same evening",
  dripEstT: "Drip 8 mm — establishment (auto-adjusts to rain)",
  scoutT: "Scout at dawn: cutworm check, replace failed plants",
}

export type TaskDict = typeof en

const fr: Partial<TaskDict> = {
  sType: "SOL",
  wType: "EAU",
  tType: "TRAITEMENT",
  rType: "ROUTINE",
  prepT: "Épandre 16 t fumier + NPK 45-60-60 — Nord",
  prepC: "310 $ · en stock",
  prepW: "Enfouir à 25 cm. Fenêtre sèche aujourd’hui, pluie jeudi.",
  prepRain: "Pluie 18 mm cette nuit — labour reporté à vendredi",
  flushT: "Rincer et tester le goutte-à-goutte",
  flushC: "4 lignes · 45 min",
  flushW: "Avant plantation le 9 sept. Besoin saison : 3 360 m³.",
  bedsT: "Former les planches 80 cm + paillage",
  bedsC: "45 $",
  bedsW: "26 400 plants réservés — livraison le 9 sept.",
  irrT: "Irriguer Nord — Rio Grande",
  irrC: "25 mm ≈ 4 h goutte-à-goutte · 20 m³",
  irrW: "Floraison + 6 jours sans pluie. Calculé: ETo 5,1 mm × limon sableux.",
  irrCancel: "Pluie 18 mm cette nuit — annulée · 20 m³ économisés",
  trT: "Cuivre préventif — Nord",
  trC: "80 g dans 30 L · pulvérisateur",
  trW: "Pourquoi: 3 jours humides 18–22°C — risque mildiou. Fenêtre: sous 48 h.",
  cu1: "Curatif: oxychlorure de cuivre — 1 sur 3",
  cu1C: "120 g dans 40 L · vos 0,8 ha",
  cu1W: "Suite au diagnostic. Fenêtre: samedi matin (vent jeu, pluie ven).",
  cuMoved: "SAM · GO",
  roT: "Surveiller pucerons — melon Rivière",
  roW: "Les colonies démarrent en bordure à ce stade du cycle.",
  ro2T: "Azote fractionné — oignon Colline",
  ro2W: "Début bulbaison — 40 kg/ha urée, puis irrigation légère.",
  transplantT: "Repiquer 26 400 plants à 40 cm — le soir",
  waterInT: "Arrosage de reprise 10 mm le soir même",
  dripEstT: "Goutte-à-goutte 8 mm — reprise",
  scoutT: "Surveiller: noctuelles à l’aube, remplacer les plants morts",
}

const ar: Partial<TaskDict> = {
  sType: "تربة",
  wType: "ري",
  tType: "علاج",
  rType: "روتيني",
  prepT: "انثر 16 طن سماد عضوي + NPK 45-60-60 — الشمالي",
  prepC: "310$ · متوفر",
  prepW: "احرث على عمق 25 سم. اليوم جاف؛ مطر الخميس.",
  prepRain: "أمطار الليلة 18 مم — أُجّل الحرث إلى الجمعة",
  flushT: "اغسل واختبر خطوط التنقيط",
  flushC: "4 خطوط · 45 د",
  flushW: "قبل الزرع في 9 سبتمبر. حاجة الموسم: 3,360 م³.",
  bedsT: "جهّز الأحواض 80 سم + فيلم التغطية",
  bedsC: "45$",
  bedsW: "26,400 شتلة محجوزة — تصل 9 سبتمبر.",
  irrT: "اسقِ الشمالي — ريو غراندي",
  irrC: "25 مم ≈ 4 س تنقيط · 20 م³",
  irrW: "مرحلة الإزهار + 6 أيام بلا مطر. محسوبة من التبخر 5.1 مم × تربة رملية طينية.",
  irrCancel: "أمطار الليلة 18 مم — أُلغيت · وفّرت 20 م³",
  trT: "رشّ نحاسي وقائي — الشمالي",
  trC: "80 غ في 30 ل",
  trW: "لماذا الآن: 3 أيام رطبة 18–22° قادمة — خطر اللفحة يرتفع. المهلة: 48 ساعة.",
  cu1: "علاجي: أوكسي كلوريد النحاس — 1 من 3",
  cu1C: "120 غ في 40 ل · لمساحة 0.8 هك",
  cu1W: "حسب تشخيص اللفحة. أفضل وقت: السبت صباحًا (رياح الخميس، مطر الجمعة).",
  cuMoved: "السبت · انطلق",
  roT: "افحص البطيخ — أسفل الأوراق",
  roW: "مستعمرات المنّ تبدأ على حواف قطعة النهر في هذا الأسبوع.",
  ro2T: "سماد آزوتي — بصل الهضبة",
  ro2W: "بداية التبصيل — 40 كغ/هك يوريا ثم ريّ خفيف.",
  transplantT: "ازرع 26,400 شتلة على 40 سم — مساءً",
  waterInT: "ريّ تثبيت 10 مم في نفس المساء",
  dripEstT: "تنقيط 8 مم — مرحلة التثبيت",
  scoutT: "افحص عند الفجر: الدودة القارضة، واستبدل الشتلات الميتة",
}

const overlays: Record<Lang, Partial<TaskDict>> = { en: {}, fr, ar }

export function taskDefs(lang: Lang): TaskDict {
  return { ...en, ...overlays[lang] }
}
