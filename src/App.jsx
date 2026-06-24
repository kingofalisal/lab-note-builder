import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_HEADER = "Thank you for getting your lab tests done. Here is my interpretation of your results.";
const DEFAULT_FOOTER = "Other lab abnormalities not mentioned are not of any importance to your health. If you have further questions about your results, please send me a MyHealth message or schedule a video visit so we can discuss in more detail.";

// Per-group: which trigger id is the "header default" (shown without expanding)
const GROUP_DEFAULT_ID = {
  "TSH":            "tsh_normal_not_on_meds",
  "CBC":            "cbc_normal",
  "BMP":            "bmp_normal",
  "LFTs":           "lfts_normal",
  "A1c":            "a1c_normal",
  "Microalbumin":   "microalbumin_normal",
  "Vitamin D":      "vitd_normal",
  "Lipids":         "lipids_normal",
  "Lipoprotein(a)": "lpa_normal",
  "STI":            "sti_negative",
  "HCV":            "hcv_negative",
  "HBV":            "hbv_immune",
  "Vitamin B12":    "b12_normal",
  "PSA":            "psa_normal_screening",
  "Fe/TIBC/Ferr":   "iron_normal",
  "Testosterone":   "testosterone_normal",
  "Uric acid":      "uric_acid_normal",
  "Urinalysis":     "ua_normal",
  "Urine Culture":  "ucx_negative",
};

// Display abbreviations for left column labels
// Full display names for groups whose internal key differs from display preference
const GROUP_DISPLAY = {
  "Fe/TIBC/Ferr": "Iron studies",
};

// Abbreviations used only when column is narrow
const GROUP_ABBREV = {
  "Microalbumin":   "Microalb",
  "Lipoprotein(a)": "Lp(a)",
  "Urine Culture":  "Urine Cx",
  "Testosterone":   "Testost",
  "Urinalysis":     "UA",
  "Vitamin B12":    "Vit B12",
  "Vitamin D":      "Vit D",
  "Fe/TIBC/Ferr":   "Fe/TIBC",
};

const DEFAULT_SNIPPETS = [
  { id:"tsh_low_on_meds", group:"TSH", trigger:"TSH low on meds", synonyms:["thyroid low on medication","TSH too low on thyroid meds","thyroid dose too high"], text:"Your TSH is low, which suggests your thyroid dose is too high. I'll send a prescription to your pharmacy with a lower dose. Please start this as soon as you can. We should repeat a blood test to confirm your thyroid level is back to normal. I've sent the order to your lab. Please mark your calendar to get the test done in {{6–8 weeks|4 weeks|8 weeks|3 months}}.", clinicianActions:["Send lower-dose thyroid Rx to pharmacy","Order TSH recheck in 6–8 weeks"], staffActions:[] },
  { id:"tsh_low_not_on_meds", group:"TSH", trigger:"TSH low (not on meds)", synonyms:["thyroid low not on medication","TSH low no thyroid meds","overactive thyroid"], text:"Your TSH (thyroid) is low, which suggests you may have an overactive thyroid gland. This can sometimes cause symptoms like a fast heartbeat, feeling warm, or unintended weight loss. We should recheck your blood test to confirm this. I've sent the order to your lab. Please mark your calendar to get the test done in {{6–8 weeks|4 weeks|8 weeks|3 months}}.", clinicianActions:["Order TSH recheck in 6–8 weeks"], staffActions:[] },
  { id:"tsh_normal_on_meds", group:"TSH", trigger:"TSH normal on meds", synonyms:["thyroid normal on medication","TSH fine on thyroid meds","thyroid controlled"], text:"Your thyroid level (TSH) looks great. Your medication is working well and keeping your thyroid in the normal range. Keep taking it as prescribed.", clinicianActions:[], staffActions:[] },
  { id:"tsh_normal_not_on_meds", group:"TSH", trigger:"TSH normal (not on meds)", synonyms:["thyroid normal no medication","TSH normal no meds"], text:"Your thyroid level (TSH) is normal.", clinicianActions:[], staffActions:[] },
  { id:"tsh_high_on_meds", group:"TSH", trigger:"TSH high on meds", synonyms:["thyroid high on medication","TSH too high on thyroid meds","thyroid dose too low"], text:"Your TSH is higher than it should be, which suggests you may need a higher dose of your thyroid medication if you've been taking it as prescribed. I'll send a prescription to your pharmacy with a slightly higher dose. Please start this as soon as you can. We should repeat a blood test to confirm your thyroid level is back to normal. I've sent the order to your lab. Please mark your calendar to get the test done in 6–8 weeks.", clinicianActions:["Send higher-dose thyroid Rx to pharmacy","Order TSH recheck in 6–8 weeks"], staffActions:[] },
  { id:"tsh_high_not_on_meds", group:"TSH", trigger:"TSH high (not on meds)", synonyms:["thyroid high no medication","underactive thyroid","hypothyroid not on meds"], text:"Your TSH is high, which indicates your thyroid level is lower than normal. This can sometimes cause symptoms like fatigue, feeling cold, or weight gain. If you are feeling fine, we can just recheck in a year. If you are troubled by any of those symptoms, let me know and we can start a low dose of thyroid medication to see if it helps.", clinicianActions:[], staffActions:[] },
  { id:"cbc_normal", group:"CBC", trigger:"CBC normal", synonyms:["blood count normal","CBC fine","blood counts normal"], text:"Your blood counts (CBC) are normal. This includes red blood cells (anemia), white blood cells (infection), and platelets (blood clotting).", clinicianActions:[], staffActions:[] },
  { id:"mild_anemia", group:"CBC", trigger:"Mild anemia needs labs", synonyms:["anemia needs workup","mild anemia follow up","low blood count needs labs"], text:"Your blood count shows a mild anemia, meaning your red blood cells are slightly lower than normal. I've ordered some additional lab tests to investigate why you have anemia. I'd like you to get these done in the next {{2–3 weeks|1 week|4 weeks|6 weeks}} and schedule a follow-up visit with me (video visit OK) so we can review results and discuss next steps.", clinicianActions:["Order anemia workup labs","Add anemia to problem list"], staffActions:["Schedule follow-up visit with me within 2–3 weeks (video OK). Remind patient to complete labs at least 3 days before appointment."] },
  { id:"bmp_normal", group:"BMP", trigger:"BMP normal", synonyms:["electrolytes normal","kidney function normal","basic metabolic panel normal"], text:"Your electrolytes and kidney function are normal.", clinicianActions:[], staffActions:[] },
  { id:"lfts_normal", group:"LFTs", trigger:"LFTs normal", synonyms:["liver tests normal","liver function normal","liver enzymes normal"], text:"Your liver tests are normal.", clinicianActions:[], staffActions:[] },
  { id:"transaminitis_new", group:"LFTs", trigger:"Transaminitis new", synonyms:["new elevated liver enzymes","liver enzymes high first time","new transaminitis"], text:"Your liver enzymes (ALT, AST) are higher than normal. We need to repeat the test and include some others to look for the cause. Possible causes include alcohol use, herbal medications or supplements, or fat accumulation in the liver. I've ordered repeat blood tests that I'd like you to complete in about {{1 month|2 weeks|6 weeks|2 months}}.", clinicianActions:["Order repeat LFTs + liver workup in ~1 month","Add transaminitis (elevated liver enzymes) to problem list"], staffActions:[] },
  { id:"transaminitis_still", group:"LFTs", trigger:"Transaminitis still", synonyms:["liver enzymes still elevated","ongoing transaminitis","liver enzymes still high"], text:"Your liver enzymes remain mildly elevated as they have been previously. This is due to MASLD (metabolic-associated steatotic liver disease, previously known as fatty liver disease). You can help treat this by avoiding alcohol and herbal supplements, which can further irritate the liver, and by working toward weight loss. We should recheck blood tests every {{6 months|3 months|12 months}} to monitor this condition.", clinicianActions:["Order repeat LFTs in 6 months"], staffActions:[] },
  { id:"a1c_normal", group:"A1c", trigger:"A1c normal (no prior diagnosis of DM or preDM)", synonyms:["A1c normal no diabetes","hemoglobin A1c normal","blood sugar normal"], text:"Your A1c is in the normal range, which means your average blood sugar over the past 3 months has been healthy. Keep up the good work with your diet and lifestyle habits.", clinicianActions:[], staffActions:[] },
  { id:"a1c_normal_prediabetes", group:"A1c", trigger:"A1c normal in prediabetes", synonyms:["A1c back to normal prediabetes resolved","prediabetes resolved","blood sugar normalized"], text:"Your A1c is now in the normal range, which means your prediabetes is well controlled. Continue to avoid excess sweets and simple carbohydrates (bread, rice, pasta, potatoes). We should recheck your A1c in one year.", clinicianActions:[], staffActions:[] },
  { id:"still_prediabetes", group:"A1c", trigger:"Still prediabetes", synonyms:["prediabetes unchanged","A1c still in prediabetes range","borderline diabetes still"], text:"Your A1c remains in the prediabetes range. Continue to limit sweets and simple carbohydrates (bread, rice, pasta, potatoes). Weight loss often helps eliminate prediabetes. We should recheck your A1c in {{1 year|6 months|3 months}}. If you make significant changes and would like to see the effect on your A1c sooner, we can repeat the test as often as every 3 months.", clinicianActions:[], staffActions:[] },
  { id:"new_prediabetes", group:"A1c", trigger:"New prediabetes", synonyms:["new borderline diabetes","A1c in prediabetes range first time","new pre-diabetes"], text:"Your A1c indicates that you have prediabetes (also known as borderline diabetes). With healthy diet, lifestyle changes, and weight loss we can reduce the risk of you developing diabetes in the coming years. Limit sweets and simple carbohydrates (bread, rice, pasta, potatoes). Eat more fruits, vegetables, and whole grains. Weight loss through diet, exercise, and/or medication often helps eliminate prediabetes. We should recheck your A1c in {{1 year|6 months|3 months}}. If you make significant changes and would like to see the effect on your A1c sooner, we can repeat the test as often as every 3 months.", clinicianActions:["Add prediabetes to problem list"], staffActions:[] },
  { id:"diabetes_controlled_6mo", group:"A1c", trigger:"Diabetes controlled – 6 mo recheck", synonyms:["diabetes well controlled 6 months","A1c at goal 6 month recheck","diabetes stable 6 months"], text:"Your A1c (diabetes) shows good blood sugar control over the past 3 months. Continue your current diabetes management including diet, exercise, and medications. We should recheck in 6 months.", clinicianActions:["Order A1c in 6 months"], staffActions:[] },
  { id:"diabetes_controlled_3mo", group:"A1c", trigger:"Diabetes controlled – 3 mo recheck", synonyms:["diabetes well controlled 3 months","A1c at goal 3 month recheck","diabetes stable 3 months"], text:"Your A1c (diabetes) shows good blood sugar control over the past 3 months. Continue your current diabetes management including diet, exercise, and medications. We should recheck in 3 months.", clinicianActions:["Order A1c in 3 months"], staffActions:[] },
  { id:"diabetes_not_controlled", group:"A1c", trigger:"Diabetes not controlled", synonyms:["A1c too high","diabetes out of control","blood sugar not controlled","diabetes poorly controlled"], text:"Your A1c (diabetes) is higher than we would like, which tells us your blood sugar has been running too high over the past 3 months. We need to work together to improve this and lower your risk of diabetes complications. Please schedule a visit with me in the coming weeks so we can review and adjust your treatment plan.", clinicianActions:[], staffActions:["Schedule visit with me in the next few weeks (video or in-office)."] },
  { id:"new_diabetes", group:"A1c", trigger:"New diagnosis of diabetes", synonyms:["new diabetes diagnosis","A1c in diabetes range first time","new type 2 diabetes"], text:"Your A1c result shows that your blood sugar is now in the diabetes range. We can work together to get your blood sugar back to normal and prevent complications through a combination of diet changes, exercise, and medication. Please schedule a visit with me in the coming weeks (video or in-office) so we can talk through this diagnosis and come up with a plan that works for you.", clinicianActions:["Add type 2 diabetes to problem list"], staffActions:["Schedule new diabetes visit with me in the next few weeks (video or in-office)."] },
  { id:"microalbumin_normal", group:"Microalbumin", trigger:"Microalbumin normal", synonyms:["urine protein normal","microalbumin creatinine ratio normal","kidney protein normal"], text:"Your urine test for protein (microalbumin/creatinine ratio) is normal, which tells us your kidneys are not leaking protein.", clinicianActions:[], staffActions:[] },
  { id:"microalbumin_elevated_new", group:"Microalbumin", trigger:"Microalbumin elevated new", synonyms:["new urine protein","microalbumin high first time","new kidney protein leak"], text:"Your urine test (microalbumin/creatinine ratio) shows some protein leaking from your kidneys, which can be an early warning sign that the kidneys are under stress. This can be caused by high blood pressure, diabetes, or other conditions. I've ordered a repeat test to confirm this finding, which I'd like you to complete at your lab in about {{1 month|2 weeks|6 weeks|2 months}}.", clinicianActions:["Order repeat microalbumin/creatinine ratio in 1 month"], staffActions:[] },
  { id:"microalbumin_elevated_still", group:"Microalbumin", trigger:"Microalbumin elevated still", synonyms:["urine protein still elevated","microalbumin still high","ongoing kidney protein leak"], text:"Your urine test (microalbumin/creatinine ratio) continues to show some protein in your urine. We will continue to monitor this closely and focus on controlling blood pressure and blood sugar to protect your kidney health. We will recheck in {{6 months|3 months|12 months}}.", clinicianActions:["Order microalbumin/creatinine ratio in 6 months"], staffActions:[] },
  { id:"vitd_normal", group:"Vitamin D", trigger:"Vitamin D normal", synonyms:["vitamin D level normal","D level fine","vitamin D okay"], text:"Your vitamin D level is in the normal range. Continue your current supplement if you are taking one.", clinicianActions:[], staffActions:[] },
  { id:"vitd_low", group:"Vitamin D", trigger:"Vitamin D low", synonyms:["vitamin D deficient","low vitamin D","D level low"], text:"Your vitamin D level is lower than normal. I recommend starting a vitamin D supplement. You can purchase this over the counter — a dose of 2,000 IU daily is a reasonable starting point for most adults. We will recheck your level in {{3–4 months|2 months|6 months}}.", clinicianActions:["Order vitamin D recheck in 3–4 months"], staffActions:[] },
  { id:"vitd_very_low", group:"Vitamin D", trigger:"Vitamin D very low", synonyms:["severely low vitamin D","vitamin D very deficient","critically low D level"], text:"Your vitamin D level is significantly low and will need a higher dose to correct. I am sending in a prescription for a higher-dose vitamin D supplement. Please take it once weekly for 8 weeks as directed. We should recheck your level in about {{3 months|6 weeks|4 months}} to see if it is improving.", clinicianActions:["Prescribe high-dose vitamin D (e.g. ergocalciferol 50,000 IU weekly x8 weeks)","Order vitamin D recheck in 3–4 months"], staffActions:[] },
  { id:"vitd_on_supplement", group:"Vitamin D", trigger:"Vitamin D on supplement", synonyms:["vitamin D good on supplement","D level okay on supplement","vitamin D maintained"], text:"Your vitamin D level looks good on your current supplement — keep taking it.", clinicianActions:[], staffActions:[] },
  { id:"lipids_normal", group:"Lipids", trigger:"Lipids normal", synonyms:["cholesterol normal","lipid panel normal","cholesterol fine"], text:"Your cholesterol and lipid levels all look healthy. Continue your current diet and lifestyle habits.", clinicianActions:[], staffActions:[] },
  { id:"ldl_at_goal_on_statin", group:"Lipids", trigger:"LDL at goal on statin", synonyms:["LDL controlled on statin","cholesterol at goal on medication","statin working well"], text:"Your LDL cholesterol is at goal on your statin medication — great news! Keep taking your medication as prescribed. We will recheck your lipid panel in {{1 year|6 months|2 years}}.", clinicianActions:["Order lipid panel in 1 year"], staffActions:[] },
  { id:"ldl_elevated_no_meds", group:"Lipids", trigger:"LDL elevated no meds needed", synonyms:["LDL high lifestyle only","cholesterol high no medication yet","high LDL diet and exercise"], text:"Your LDL (bad cholesterol) is higher than recommended. For most people, the best first step is to reduce saturated fat in your diet, increase fiber, and get regular aerobic exercise. Depending on your overall heart risk, medication may also be appropriate. Let's discuss this at your next visit. If you'd like to discuss sooner, please schedule a visit.", clinicianActions:[], staffActions:[] },
  { id:"ldl_high_despite_statin", group:"Lipids", trigger:"LDL too high despite statin", synonyms:["LDL still high on statin","cholesterol not controlled on medication","statin not working"], text:"Your LDL cholesterol is still above our target despite your statin medication. This may mean the dose needs to be adjusted or that we consider adding another medication. I'd like to discuss your options — please schedule a visit or send me a message.", clinicianActions:[], staffActions:["Schedule visit with me within 1–2 months (video OK)."] },
  { id:"ldl_high_needs_statin", group:"Lipids", trigger:"LDL too high – needs statin", synonyms:["LDL high start statin","high cholesterol needs medication","starting statin therapy"], text:"Your LDL (bad cholesterol) is too high, and given your overall cardiovascular risk, I recommend starting a statin medication once daily. I've sent this to your pharmacy. Please take it daily as prescribed. If you'd like to discuss further before starting, please schedule an in-office or video visit in the next 1–2 months. Once you start the medication, let's repeat your lipid panel at least 2 months later to see how it's working.", clinicianActions:["Prescribe statin","Order lipid panel in 2+ months after starting statin"], staffActions:[] },
  { id:"triglycerides_high", group:"Lipids", trigger:"Triglycerides too high", synonyms:["triglycerides elevated","high triglycerides","blood fats too high"], text:"Your triglycerides (blood fats) are higher than normal. This is common with non-fasting blood tests and in that case can be disregarded. If you did this test fasting, you can lower your triglycerides by reducing alcohol intake, cutting back on sugar and refined carbohydrates, and getting regular exercise. Weight loss also helps significantly. We will recheck this at your next lab visit.", clinicianActions:[], staffActions:[] },
  { id:"hdl_too_low", group:"Lipids", trigger:"HDL too low", synonyms:["good cholesterol low","HDL low","low HDL"], text:"Your HDL (good cholesterol) is lower than normal. Higher HDL levels are associated with a lower risk of heart attack. Some ways to raise your HDL include: regular aerobic exercise, replacing trans fats with unsaturated fats, quitting smoking if you smoke, and losing excess weight. We should recheck this in 1 year, or sooner if you make changes and want to see the effect on your HDL.", clinicianActions:[], staffActions:[] },
  { id:"lpa_normal", group:"Lipoprotein(a)", trigger:"Lp(a) normal", synonyms:["lipoprotein a normal","Lp(a) fine","lipoprotein little a normal"], text:"Your lipoprotein(a) is in the normal range, indicating no increased cardiovascular risk from this marker. This test is recommended once for most adults and does not need to be repeated.", clinicianActions:[], staffActions:[] },
  { id:"lpa_elevated", group:"Lipoprotein(a)", trigger:"Lp(a) elevated", synonyms:["lipoprotein a high","Lp(a) elevated","high lipoprotein little a"], text:"Your lipoprotein(a) level is elevated. Lipoprotein(a) is a type of cholesterol particle that is largely determined by genetics and can increase the risk of heart attack and stroke. Unlike LDL cholesterol, it does not respond well to diet or standard medications. While we cannot easily lower your Lp(a) directly, we can make sure all your other cardiovascular risk factors are well controlled. We can discuss this further at your next visit, or sooner if you'd like to schedule a visit.", clinicianActions:[], staffActions:[] },
  { id:"sti_negative", group:"STI", trigger:"STI screen negative", synonyms:["STI negative","sexually transmitted infection screen negative","STD screen negative"], text:"Your STI screening results are all negative. This includes urine tests for chlamydia and gonorrhea and blood tests for syphilis and HIV.", clinicianActions:[], staffActions:[] },
  { id:"hcv_negative", group:"HCV", trigger:"HCV negative", synonyms:["hepatitis C negative","hep C negative","hepatitis C antibody negative"], text:"Your hepatitis C antibody test is negative, meaning no hepatitis C infection has been detected. We test all adults once and more frequently if you are at ongoing risk for the disease.", clinicianActions:[], staffActions:[] },
  { id:"hbv_immune", group:"HBV", trigger:"HBsAg neg and HBV immune", synonyms:["hepatitis B immune","hep B immune","immune to hepatitis B"], text:"Your hepatitis B tests show that you are immune to hepatitis B and do not have an active hepatitis B infection.", clinicianActions:[], staffActions:[] },
  { id:"hbv_not_immune", group:"HBV", trigger:"HBsAg neg but NOT HBV immune", synonyms:["hepatitis B not immune needs vaccine","hep B needs vaccine","not immune to hepatitis B"], text:"Your hepatitis B test shows that you do not have hepatitis B infection but are not immune. We should start your hepatitis B vaccination series to give you lifelong immunity and protection.", clinicianActions:["Order/administer hepatitis B vaccine series"], staffActions:[] },
  { id:"b12_normal", group:"Vitamin B12", trigger:"B12 normal", synonyms:["vitamin B12 normal","B12 fine","cobalamin normal"], text:"Your vitamin B12 level is in the normal range. If you are taking a supplement, continue it. Otherwise, no need to start taking extra B12.", clinicianActions:[], staffActions:[] },
  { id:"b12_borderline", group:"Vitamin B12", trigger:"B12 borderline (200–400)", synonyms:["B12 borderline low","vitamin B12 borderline","B12 low normal"], text:"Your vitamin B12 level is in the borderline range. I'd like you to start taking a vitamin B12 supplement — 1,000 mcg daily by mouth. We can recheck your B12 level next time we do blood tests.", clinicianActions:[], staffActions:[] },
  { id:"b12_low", group:"Vitamin B12", trigger:"B12 low", synonyms:["vitamin B12 deficient","low B12","B12 deficiency"], text:"Your vitamin B12 level is lower than normal. B12 is important for nerve function and red blood cell production. Low levels can sometimes cause fatigue, tingling, or memory issues. I recommend starting a B12 supplement — 1,000 mcg daily by mouth is a good dose for most adults. We will recheck in {{3 months|6 weeks|6 months}}.", clinicianActions:["Order B12 recheck in 3 months"], staffActions:[] },
  { id:"psa_normal_screening", group:"PSA", trigger:"PSA screening – normal", synonyms:["PSA normal","prostate cancer screening normal","PSA fine"], text:"Your PSA test for prostate cancer screening is normal. If you'd like to continue screening, we should repeat the test in 1–4 years depending on your PSA level and risk factors.", clinicianActions:[], staffActions:[] },
  { id:"psa_mildly_elevated", group:"PSA", trigger:"PSA screening – mildly elevated", synonyms:["PSA mildly high","slightly elevated PSA","PSA borderline"], text:"Your PSA test for prostate cancer screening is mildly elevated. This does NOT mean you have prostate cancer, but we do need to recheck your level in about a month to see if it remains high. If it is still elevated, I'll refer you to a urologist to discuss whether you need additional testing.", clinicianActions:["Order PSA recheck in 1 month"], staffActions:[] },
  { id:"psa_quite_elevated", group:"PSA", trigger:"PSA screening – quite elevated", synonyms:["PSA significantly high","PSA very elevated","high PSA needs urology"], text:"Your PSA test for prostate cancer screening is high and requires further evaluation. I am referring you to a urologist to discuss the best next steps. Please expect to hear about your referral within 1 week. Contact our office if you do not.", clinicianActions:["Refer to urology for elevated PSA"], staffActions:["Ensure urology referral is sent and patient is contacted within 1 week."] },
  { id:"psa_normal_prior_ca", group:"PSA", trigger:"PSA normal – prior prostate cancer", synonyms:["PSA undetectable prior prostate cancer","PSA okay history of prostate cancer"], text:"Your PSA level is low or undetectable, which is reassuring and does not show signs of recurrence of your prostate cancer. We should repeat this test in one year.", clinicianActions:[], staffActions:[] },
  { id:"psa_elevated_prior_ca", group:"PSA", trigger:"PSA elevated – prior prostate cancer", synonyms:["PSA rising prior prostate cancer","PSA up history of prostate cancer"], text:"Your PSA level is elevated. I'd like you to schedule a follow-up with your urologist to discuss the best next steps. If you don't have a current urologist, let me know and I can send a referral.", clinicianActions:["Refer to urology for elevated PSA — prior prostate cancer history"], staffActions:["Assist patient with urology referral or contact existing urologist's office."] },
  { id:"iron_normal", group:"Fe/TIBC/Ferr", trigger:"Iron studies normal", synonyms:["iron normal","ferritin normal","iron panel normal"], text:"Your iron tests (iron, total iron binding capacity, and ferritin) are all within the normal range.", clinicianActions:[], staffActions:[] },
  { id:"iron_deficiency_no_anemia_women", group:"Fe/TIBC/Ferr", trigger:"Iron deficiency – no anemia, menstruating women", synonyms:["iron low no anemia women","iron deficiency without anemia female","low iron stores menstruating women"], text:"Your iron tests show low iron levels, but not low enough to cause anemia yet. This is common in women who are still having periods due to regular blood loss. Please start taking an iron tablet (ferrous sulfate 325 mg) three times a week (for example, Monday, Wednesday, Friday) to help build up your iron levels. We should recheck your blood count and iron levels in {{6 months|3 months|12 months}}. I've ordered this test for you. If you are not having periods or if they are very light, please let me know so we can look for other possible causes.", clinicianActions:["Add iron deficiency to problem list","Order CBC and iron studies in 6 months"], staffActions:[] },
  { id:"iron_deficiency_anemia_women", group:"Fe/TIBC/Ferr", trigger:"Iron deficiency anemia – menstruating women", synonyms:["iron deficiency anemia women","anemia from low iron female","iron deficiency anemia menstruating"], text:"Your labs confirm low iron levels that are causing anemia. This is common in women who are still having periods due to regular blood loss. Please start taking an iron tablet (ferrous sulfate 325 mg) three times a week (for example, Monday, Wednesday, Friday) to help boost your iron levels and blood counts. We should recheck in {{6 months|3 months|12 months}}. If you are not having periods or if they are very light, please let me know so we can look for other possible causes.", clinicianActions:["Add iron deficiency anemia to problem list","Order CBC and iron studies in 6 months"], staffActions:[] },
  { id:"iron_deficiency_anemia_men", group:"Fe/TIBC/Ferr", trigger:"Iron deficiency anemia – men", synonyms:["iron deficiency anemia men","anemia from low iron male","iron deficiency anemia male"], text:"Your labs confirm low iron levels that are causing anemia. In men, iron deficiency anemia requires further investigation to look for an underlying cause. I've asked my staff to contact you to schedule a visit with me in the next {{few weeks|1–2 weeks|4–6 weeks}} to discuss further testing and next steps.", clinicianActions:["Add iron deficiency anemia to problem list"], staffActions:["Schedule visit with me within 4 weeks (video or in-office)."] },
  { id:"iron_deficiency_no_anemia_men", group:"Fe/TIBC/Ferr", trigger:"Iron deficiency without anemia – men", synonyms:["iron low no anemia men","iron deficiency without anemia male","low iron stores men"], text:"Your labs confirm low iron levels, but not low enough to cause anemia yet. In men, low iron levels require further investigation to look for an underlying cause. I've asked my staff to contact you to schedule a visit with me in the next few weeks to discuss next steps.", clinicianActions:["Add iron deficiency to problem list"], staffActions:["Schedule visit with me within 4 weeks (video or in-office)."] },
  { id:"ferritin_elevated", group:"Fe/TIBC/Ferr", trigger:"Ferritin elevated", synonyms:["high ferritin","ferritin too high","elevated ferritin level"], text:"Your ferritin level is higher than normal. Ferritin is a protein that stores iron, but it is also an inflammatory marker — it can be elevated with infection, inflammation, liver disease, or excess iron. At this level, no treatment is required. We can repeat this test with your next regularly planned blood tests.", clinicianActions:[], staffActions:[] },
  { id:"testosterone_normal", group:"Testosterone", trigger:"Testosterone normal", synonyms:["testosterone level normal","testosterone fine","T level normal"], text:"Your testosterone level is within the normal range.", clinicianActions:[], staffActions:[] },
  { id:"testosterone_low_first", group:"Testosterone", trigger:"Testosterone low (1st time)", synonyms:["testosterone low first time","low T first time","testosterone low initial"], text:"Your testosterone level is lower than normal. Low testosterone can cause fatigue, low sex drive, difficulty concentrating, and mood changes. We need to repeat this test at least once, at least 1 month after the last test. I've sent the order to your preferred lab. Testing before 10 AM gives the most reliable results. If the level is low a second time, we'll discuss treatment options.", clinicianActions:["Order repeat testosterone level (morning). Consider adding FSH, LH if not already done."], staffActions:[] },
  { id:"testosterone_low_confirmed", group:"Testosterone", trigger:"Testosterone low (at least twice)", synonyms:["low testosterone confirmed","testosterone low confirmed twice","low T confirmed"], text:"Your testosterone level has again come back lower than normal. Low testosterone can cause fatigue, low sex drive, difficulty concentrating, and mood changes. I've asked my staff to schedule a visit (video or in-office) in the next several weeks so we can discuss the findings and consider treatment options.", clinicianActions:[], staffActions:["Schedule visit with me within 1–2 months (video or in-office)."] },
  { id:"uric_acid_normal", group:"Uric acid", trigger:"Uric acid normal – not on meds for gout", synonyms:["uric acid normal","gout marker normal","uric acid fine"], text:"Your uric acid level is normal.", clinicianActions:[], staffActions:[] },
  { id:"uric_acid_elevated_no_sx", group:"Uric acid", trigger:"Uric acid elevated – no symptoms", synonyms:["uric acid high no symptoms","elevated uric acid asymptomatic","high uric acid no gout"], text:"Your uric acid level is higher than normal. Elevated uric acid does not always cause symptoms, but over time it can lead to gout (painful joint flares) or kidney stones. Reducing foods high in purines — such as red meat, organ meats, shellfish, and beer in particular — can help lower your level.", clinicianActions:[], staffActions:[] },
  { id:"uric_acid_high_recurrent_gout", group:"Uric acid", trigger:"Uric acid > 6 with recurrent gout – not yet on ppx", synonyms:["uric acid high recurrent gout","gout not on prophylaxis","high uric acid gout not treated"], text:"Your uric acid level is too high and is likely contributing to your recurrent gout attacks. I've asked my staff to schedule a visit (video or in-office) in the next several weeks so we can discuss starting medication to lower your uric acid and reduce your gout attacks.", clinicianActions:[], staffActions:["Schedule visit with me within 1–2 months (video or in-office)."] },
  { id:"uric_acid_high_on_meds", group:"Uric acid", trigger:"Uric acid > 6 despite allopurinol or febuxostat", synonyms:["uric acid high on medication","gout not controlled on allopurinol","uric acid elevated on treatment"], text:"Your uric acid level is not in our target range despite your current medication. We need to adjust your treatment to get it lower. I've asked my staff to schedule a visit (video or in-office) in the next several weeks so we can discuss further.", clinicianActions:[], staffActions:["Schedule visit with me within 1–2 months (video or in-office)."] },
  { id:"ua_normal", group:"Urinalysis", trigger:"Urinalysis normal", synonyms:["urine test normal","urinalysis fine","UA normal"], text:"Your urine test is normal.", clinicianActions:[], staffActions:[] },
  { id:"ua_blood_new", group:"Urinalysis", trigger:"Blood in urine new", synonyms:["new blood in urine","hematuria new","new hematuria"], text:"Your urine test shows blood, which needs further evaluation. Blood in the urine can have many causes, most of which are not serious, but it is important to investigate. I've ordered some repeat lab tests for you to complete prior to a follow-up visit. I've asked my staff to schedule a visit with me in the next few weeks to discuss further.", clinicianActions:["Order repeat UA and additional hematuria workup labs"], staffActions:["Schedule visit with me within 4 weeks (video or in-office). Remind patient to complete labs at least 3 days before appointment."] },
  { id:"ua_protein", group:"Urinalysis", trigger:"Protein in urine", synonyms:["proteinuria","protein in urine","urine protein elevated"], text:"Your urine test shows protein, which can be an early sign of kidney stress. I've ordered some repeat lab tests for you to complete in about 4 weeks. I've asked my staff to schedule a visit with me to review results and discuss further.", clinicianActions:["Order repeat UA and microalbumin/creatinine ratio in ~4 weeks"], staffActions:["Schedule visit with me within 4–6 weeks (video or in-office). Remind patient to complete labs at least 3 days before appointment."] },
  { id:"ucx_negative", group:"Urine Culture", trigger:"Urine culture negative", synonyms:["urine culture negative","no bacteria in urine","urine culture clear"], text:"Your urine culture is negative, meaning no bacteria were found. If you have any ongoing urinary symptoms, please contact my office to schedule a follow-up visit.", clinicianActions:[], staffActions:[] },
  { id:"ucx_positive_correct_abx", group:"Urine Culture", trigger:"Urine culture positive – on correct antibiotic", synonyms:["urine culture positive correct antibiotic","UTI on right antibiotic","urine culture positive treated correctly"], text:"Your urine culture shows an infection that should be well treated by the antibiotic you were given. Your symptoms should improve within the next 2–3 days. If your symptoms are not improving or get worse, please contact my office to schedule a follow-up visit.", clinicianActions:[], staffActions:[] },
  { id:"ucx_positive_new_abx", group:"Urine Culture", trigger:"Urine culture positive – needs new antibiotic", synonyms:["urine culture positive needs different antibiotic","UTI wrong antibiotic","urine culture resistant needs new treatment"], text:"Your urine culture shows an infection. I am sending in an antibiotic that should treat this infection well. Please start taking it as soon as possible and complete the full course as directed. Your symptoms should improve within 2–3 days of starting. If they do not improve or get worse, please contact my office to schedule a follow-up visit.", clinicianActions:["Prescribe targeted antibiotic per culture sensitivities"], staffActions:[] },
];

// ── Storage helpers ───────────────────────────────────────────────────────────
function loadDeletedIds() {
  try { const s=localStorage.getItem("lab_deleted_ids"); return s ? JSON.parse(s) : []; } catch { return []; }
}
function saveDeletedIds(ids) { localStorage.setItem("lab_deleted_ids", JSON.stringify(ids)); }

function loadGroupOrder() {
  try {
    const s = localStorage.getItem("lab_group_order");
    if (!s) return null;
    return JSON.parse(s);
  } catch { return null; }
}
function saveGroupOrder(order) { localStorage.setItem("lab_group_order", JSON.stringify(order)); }

function loadSnippets(deletedIds) {
  try {
    const saved = localStorage.getItem("lab_snippets_v4");
    const deleted = deletedIds || loadDeletedIds();
    if (!saved) return DEFAULT_SNIPPETS.filter(s => !deleted.includes(s.id));
    const parsed = JSON.parse(saved);
    const merged = DEFAULT_SNIPPETS
      .filter(def => !deleted.includes(def.id))
      .map(def => {
        const ov = parsed.find(s => s.id === def.id);
        if (!ov) return def;
        return { ...def, text: ov.text,
          clinicianActions: ov.clinicianActions ?? (ov.actions ?? def.clinicianActions),
          staffActions: ov.staffActions ?? def.staffActions,
          synonyms: ov.synonyms ?? def.synonyms ?? [] };
      });
    const custom = parsed.filter(s => s.custom);
    return [...merged, ...custom];
  } catch { return DEFAULT_SNIPPETS; }
}
function saveSnippets(snippets) { localStorage.setItem("lab_snippets_v4", JSON.stringify(snippets)); }
function loadHeaderFooter() {
  try {
    // One-time migration: clear headerfooter cache on v3 upgrade
    if (!localStorage.getItem("lab_hf_migrated_v3")) {
      localStorage.removeItem("lab_headerfooter");
      localStorage.setItem("lab_hf_migrated_v3", "1");
      return { header: DEFAULT_HEADER, footer: DEFAULT_FOOTER };
    }
    const s = localStorage.getItem("lab_headerfooter");
    if (!s) return { header: DEFAULT_HEADER, footer: DEFAULT_FOOTER };
    return JSON.parse(s);
  } catch { return { header: DEFAULT_HEADER, footer: DEFAULT_FOOTER }; }
}
function saveHeaderFooter(hf) { localStorage.setItem("lab_headerfooter", JSON.stringify(hf)); }

function isCustomized(snippet) {
  if (snippet.custom) return true;
  const def = DEFAULT_SNIPPETS.find(d => d.id === snippet.id);
  if (!def) return false;
  return def.text !== snippet.text ||
    JSON.stringify(def.clinicianActions) !== JSON.stringify(snippet.clinicianActions) ||
    JSON.stringify(def.staffActions) !== JSON.stringify(snippet.staffActions) ||
    JSON.stringify(def.synonyms || []) !== JSON.stringify(snippet.synonyms || []);
}

// ── Staff action deduplication ────────────────────────────────────────────────
function dedupeStaffActions(actions) {
  if (actions.length <= 1) return actions;
  // Extract "schedule visit" type actions and dedupe by timeframe
  const scheduleActions = actions.filter(a => /schedule.*(visit|appt|appointment)/i.test(a));
  const otherActions = actions.filter(a => !/schedule.*(visit|appt|appointment)/i.test(a));

  if (scheduleActions.length <= 1) return actions;

  // Parse timeframe in weeks from action text
  const parseWeeks = (s) => {
    const m = s.match(/(\d+)[\s–-]*(\d+)?\s*weeks?/i);
    if (m) return m[2] ? parseInt(m[2]) : parseInt(m[1]);
    const mo = s.match(/(\d+)[\s–-]*(\d+)?\s*months?/i);
    if (mo) return (mo[2] ? parseInt(mo[2]) : parseInt(mo[1])) * 4;
    return 99;
  };

  // Use the longest timeframe (least urgent wins when overlapping)
  const maxWeeks = Math.max(...scheduleActions.map(parseWeeks));
  const representative = scheduleActions.reduce((best, a) => parseWeeks(a) === maxWeeks ? a : best, scheduleActions[0]);

  // Check if lab reminder is needed in any
  const needsLabReminder = scheduleActions.some(a => /labs?.*(3 days|prior|before)/i.test(a));
  let combined = representative;
  if (needsLabReminder && !/labs?.*(3 days|prior|before)/i.test(combined)) {
    combined = combined.replace(/\.$/, '') + '. Remind patient to complete labs at least 3 days before appointment.';
  }

  return [combined, ...otherActions];
}

// ── Group helpers ─────────────────────────────────────────────────────────────
function getGroupsOrdered(snippets, groupOrder) {
  const groups = {};
  snippets.forEach(s => {
    const g = s.group || "Other";
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  });
  const allGroupNames = Object.keys(groups);
  let sorted;
  if (groupOrder && groupOrder.length > 0) {
    // Use saved order, append any new groups alphabetically, Other always last
    const ordered = groupOrder.filter(g => allGroupNames.includes(g));
    const newGroups = allGroupNames.filter(g => !ordered.includes(g) && g !== "Other").sort();
    sorted = [...ordered, ...newGroups];
    if (groups["Other"]) sorted.push("Other");
  } else {
    sorted = allGroupNames.filter(g => g !== "Other").sort();
    if (groups["Other"]) sorted.push("Other");
  }
  return sorted.filter(g => groups[g]).map(g => ({ name: g, snippets: groups[g] }));
}

// ── Conflict detection ────────────────────────────────────────────────────────
function getConflicts(triggeredIds, snippets) {
  const conflicts = new Set();
  const groupCounts = {};
  triggeredIds.forEach(id => {
    const s = snippets.find(sn => sn.id === id);
    if (!s || s.isWildcard) return;
    const g = s.group || "Other";
    if (!groupCounts[g]) groupCounts[g] = [];
    groupCounts[g].push(id);
  });
  Object.values(groupCounts).forEach(ids => { if (ids.length > 1) ids.forEach(id => conflicts.add(id)); });
  return conflicts;
}

// ── Tour steps ────────────────────────────────────────────────────────────────
// addSnippetId: snippet to add to note when entering this step
// removeSnippetId: snippet added at this step (to remove when going back)
const TOUR_STEPS = [
  { ref:"tourBtn",       inHeader:true,  title:"Welcome to Lab Results Note Builder",
    body:"Assemble your lab results note by dictating trigger phrases or clicking the buttons. This quick tour shows you how everything works.",
    requireCompose:false },
  { ref:"micBtn",        inHeader:false, title:"Add with voice",
    body:'Click the microphone button and speak phrases like "TSH normal" or "CBC normal". The app listens continuously — just keep speaking. Click stop when done.',
    requireCompose:true, addSnippetId:"tsh_normal_not_on_meds" },
  { ref:"leftCol",       inHeader:false, title:"Add by clicking",
    body:"Click any lab name to instantly add its normal result to your note. You'll see a checkmark confirmation when it's added.",
    requireCompose:true, addSnippetId:"bmp_normal", tooltipRight:true },
  { ref:"cbcSection",    inHeader:false, title:"Expand for abnormals",
    body:"Click the ▼ arrow to expand a lab and see abnormal options. Here we've added 'Mild anemia needs labs.'",
    requireCompose:true, addSnippetId:"mild_anemia", expandGroup:"CBC" },
  { ref:"wildcardRef",   inHeader:false, title:"Wildcard option",
    body:"The wildcard option is a placeholder for free text comments. You can add your comments in the Patient note preview here or after pasting into your EMR.",
    requireCompose:true, expandGroup:"Microalbumin" },
  { ref:"dragHandle",    inHeader:false, title:"Reorder labs",
    body:"Grip the ⋮⋮ handle on the left of any lab row to rearrange the column. Your preferred order is saved automatically.",
    requireCompose:true, showHandleArrow:true, tooltipRight:true },
  { ref:"clinicianTodo", inHeader:false, title:"Clinician to do",
    body:"When your comments include prescriptions, new diagnoses, or follow-up lab orders, they queue up here as reminders so you don't miss them.",
    requireCompose:true },
  { ref:"staffTodo",     inHeader:false, title:"Staff to do",
    body:"When your comments include actions for your staff like scheduling a follow-up visit, those queue up here so you can copy and paste that into a note to your staff.",
    requireCompose:true },
  { ref:"notePreview",   inHeader:false, title:"Edit your note",
    body:<>Each bullet in the note preview is editable — click into any bullet to adjust the wording. Hover over a bullet and click the <span style={{color:"#dc2626",fontWeight:700}}>×</span> button to delete it.</>,
    requireCompose:true },
  { ref:"copyBtn",       inHeader:false, title:"Copy to your EMR",
    body:"When your note looks right, click Copy note and paste it directly into your patient message in your EMR.",
    requireCompose:true },
  { ref:"manageBtn",     inHeader:true,  title:"Manage snippets",
    body:"Click Manage Snippets to edit any response, add your own labs and triggers, delete defaults you don't need, or import/export your customizations.",
    requireCompose:false },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function App() {
  const [deletedIds, setDeletedIds] = useState(loadDeletedIds);
  const [snippets, setSnippets] = useState(() => loadSnippets(loadDeletedIds()));
  const [hf, setHf] = useState(loadHeaderFooter);
  const [groupOrder, setGroupOrder] = useState(() => loadGroupOrder());
  const [activeTab, setActiveTab] = useState("compose");
  const [triggered, setTriggered] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const micTimeoutRef = useRef(null);
  const [matchStatus, setMatchStatus] = useState(null);
  const [copied, setCopied] = useState(false);
  const [staffCopied, setStaffCopied] = useState(false);
  const [noteEdits, setNoteEdits] = useState({});
  const [picklistSelections, setPicklistSelections] = useState({}); // key: `${lineIdx}-${tokenIdx}` → selected value
  const [openPicklist, setOpenPicklist] = useState(null); // key of currently open picklist dropdown

  // Parse snippet text into segments: plain strings and picklist tokens
  // Token syntax: {{default|option2|option3}}
  const parseTokens = (text) => {
    const parts = [];
    const re = /\{\{([^}]+)\}\}/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ type:"text", value: text.slice(last, m.index) });
      const rawOpts = m[1].split("|");
      const defaultValue = rawOpts[0];
      // Sort options by duration for display, keeping default value independent
      const sorted = [...rawOpts].sort((a, b) => parseDuration(a) - parseDuration(b));
      parts.push({ type:"picklist", options: sorted, defaultValue });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ type:"text", value: text.slice(last) });
    return parts;
  };

  // Parse a duration string to a comparable number of days
  const parseDuration = (s) => {
    const n = (str, unit) => { const m = str.match(/(\d+)(?:[\s–-]+(\d+))?\s*/ + unit); if (!m) return null; return m[2] ? (parseInt(m[1])+parseInt(m[2]))/2 : parseInt(m[1]); };
    const days = n(s, "days?"); if (days !== null) return days;
    const weeks = n(s, "weeks?"); if (weeks !== null) return weeks * 7;
    const months = n(s, "months?"); if (months !== null) return months * 30;
    const years = n(s, "years?"); if (years !== null) return years * 365;
    return 0;
  };

  // Resolve a line's text with picklist selections applied (for copy)
  const resolveText = (text, lineIdx) => {
    let tokenIdx = 0;
    return text.replace(/\{\{([^}]+)\}\}/g, (_, inner) => {
      const opts = inner.split("|");
      const key = `${lineIdx}-${tokenIdx++}`;
      return picklistSelections[key] ?? opts[0];
    });
  };
  const [recentlyAdded, setRecentlyAdded] = useState(null); // id of recently clicked trigger for checkmark flash
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourRenderTick, setTourRenderTick] = useState(0); // increments after expansion to force re-render
  const [tourTriggered, setTourTriggered] = useState([]); // snippets added during tour
  const [tourExpandedGroup, setTourExpandedGroup] = useState(null);
  const [showTourPrompt, setShowTourPrompt] = useState(() => {
    try { return !localStorage.getItem("lab_tour_prompted"); } catch { return false; }
  });
  const tourRefs = useRef({}); // keyed by noteLines index
  const [showNewNoteWarning, setShowNewNoteWarning] = useState(false);
  const [skipNewNoteWarning, setSkipNewNoteWarning] = useState(() => {
    try { return localStorage.getItem("lab_skip_new_note_warning") === "true"; } catch { return false; }
  });
  const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);
  const [checkedActions, setCheckedActions] = useState({});
  const [leftExpanded, setLeftExpanded] = useState({});
  const [manageOpen, setManageOpen] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editActions, setEditActions] = useState("");
  const [editStaffActions, setEditStaffActions] = useState("");
  const [editSynonyms, setEditSynonyms] = useState("");
  const [editHf, setEditHf] = useState(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newTrigger, setNewTrigger] = useState({ trigger:"", text:"", actions:"", staffActions:"", group:"", newGroup:"", useNew:false });
  const [showExport, setShowExport] = useState(false);
  const [exportEmail, setExportEmail] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importDrag, setImportDrag] = useState(false);
  const [leftColWidth, setLeftColWidth] = useState(999);
  const leftColDivRef = useRef(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);
  const [draggingGroup, setDraggingGroup] = useState(null);
  const [stats, setStats] = useState({ visitors: "…", notes: "…" });
  const [showPhiWarning, setShowPhiWarning] = useState(() => {
    try { return !localStorage.getItem("lab_phi_acknowledged"); } catch { return true; }
  });
  const [phiChecked, setPhiChecked] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const devMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("devmode") === "true";
  const recognitionRef = useRef(null);
  const matchTimerRef = useRef(null);
  const continuousRef = useRef(false);

  const groups = getGroupsOrdered(snippets, groupOrder);

  // Close open picklist when clicking outside
  useEffect(() => {
    if (!openPicklist) return;
    const handler = () => setOpenPicklist(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openPicklist]);
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jotfor.ms/s/umd/latest/for-form-embed-handler.js";
    script.async = true;
    script.onload = () => {
      if (window.jotformEmbedHandler) {
        window.jotformEmbedHandler("iframe[id='JotFormIFrame-261735977946073']", "https://form.jotform.com/");
      }
    };
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch {} };
  }, []);

  // Track left column width for adaptive abbreviations
  useEffect(() => {
    const el = leftColDivRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setLeftColWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab]);

  const useAbbrev = leftColWidth < 150;

  // Force overlay re-render after expansion DOM settles (steps 4 & 5)
  useEffect(() => {
    if (!tourActive) return;
    const step = TOUR_STEPS[tourStep];
    if (step?.expandGroup) {
      // Double rAF ensures DOM has painted before we re-read getBoundingClientRect
      let raf1 = requestAnimationFrame(() => {
        let raf2 = requestAnimationFrame(() => {
          setTourRenderTick(n => n + 1);
        });
        return () => cancelAnimationFrame(raf2);
      });
      return () => cancelAnimationFrame(raf1);
    }
  }, [tourStep, tourActive]);

  useEffect(() => {
    fetch("/api/stats?action=visit")
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const allClinicianActions = [];
  const rawStaffActions = [];
  triggered.forEach(id => {
    const s = snippets.find(sn => sn.id === id);
    if (s) {
      (s.clinicianActions || s.actions || []).forEach(a => { if (!allClinicianActions.includes(a)) allClinicianActions.push(a); });
      (s.staffActions || []).forEach(a => { if (!rawStaffActions.includes(a)) rawStaffActions.push(a); });
    }
  });
  const allStaffActions = dedupeStaffActions(rawStaffActions);

  // ── Note lines ────────────────────────────────────────────────────────────
  const noteLines = (() => {
    const byGroup = {};
    triggered.forEach(id => {
      const s = snippets.find(sn => sn.id === id);
      if (!s) return;
      const g = s.group || "Other";
      if (!byGroup[g]) byGroup[g] = { normal:[], wildcards:[] };
      if (s.isWildcard) byGroup[g].wildcards.push(s);
      else byGroup[g].normal.push(s);
    });
    const lines = [];
    const seenGroups = [];
    triggered.forEach(id => {
      const s = snippets.find(sn => sn.id === id);
      if (!s) return;
      const g = s.group || "Other";
      if (!seenGroups.includes(g)) seenGroups.push(g);
    });
    seenGroups.forEach(g => {
      const entry = byGroup[g];
      if (!entry) return;
      entry.normal.forEach(s => lines.push({ id: s.id, text: s.text }));
      entry.wildcards.forEach(s => lines.push({ id: s.id, text: s.text }));
    });
    return lines;
  })();

  const fullNote = noteLines.length > 0
    ? `${hf.header}\n\n${noteLines.map((l, i) => {
        const base = noteEdits[i] !== undefined ? noteEdits[i] : l.text;
        return `• ${resolveText(base, i)}`;
      }).join("\n")}\n\n${hf.footer}`
    : "";

  // ── Speech ────────────────────────────────────────────────────────────────
  const doClassify = useCallback(async (text) => {
    setMatchStatus({ text: `Heard: "${text}" — matching…`, type:"classifying" });
    try {
      // Build trigger list including synonyms
      const triggerList = snippets.map(s => {
        const syns = (s.synonyms || []).join(" | ");
        return syns ? `${s.trigger} (also: ${syns})` : s.trigger;
      }).join("\n");
      const res = await fetch("/api/classify", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ transcript: text, triggers: triggerList }) });
      const data = await res.json();
      if (data.match && data.match !== "none") {
        // Match against trigger name only (strip the synonym part)
        const matched = snippets.find(s => data.match.toLowerCase().startsWith(s.trigger.toLowerCase()));
        if (matched) {
          setTriggered(prev => [...prev, matched.id]);
          setMatchStatus({ text: `Matched: ${matched.trigger}`, type:"matched" });
          if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
          matchTimerRef.current = setTimeout(() => { if (continuousRef.current) setMatchStatus(null); }, 1000);
          return;
        }
      }
      setMatchStatus({ text: `No match for "${text}"`, type:"nomatch" });
    } catch { setMatchStatus({ text:"Classification error — check connection", type:"error" }); }
  }, [snippets]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMatchStatus({ text:"Speech recognition requires Chrome or Edge", type:"error" }); return; }
    continuousRef.current = true;
    const recognition = new SR();
    recognition.lang = "en-US"; recognition.continuous = false; recognition.interimResults = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      await doClassify(text);
      if (continuousRef.current) { try { recognition.start(); } catch {} }
    };
    recognition.onerror = (e) => {
      if (e.error === "no-speech" && continuousRef.current) { try { recognition.start(); } catch {} return; }
      if (e.error === "not-allowed") { setMatchStatus({ text:"Microphone access denied — check browser permissions", type:"error" }); setIsListening(false); continuousRef.current = false; }
    };
    recognition.onend = () => { if (!continuousRef.current) setIsListening(false); };
    recognition.start();
    // Auto-stop after 5 minutes to avoid wasting API tokens
    if (micTimeoutRef.current) clearTimeout(micTimeoutRef.current);
    micTimeoutRef.current = setTimeout(() => {
      continuousRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      setMatchStatus({ text:"Microphone auto-stopped after 5 minutes", type:"nomatch" });
      setTimeout(() => setMatchStatus(null), 3000);
    }, 5 * 60 * 1000);
  }, [doClassify]);

  const stopListening = useCallback(() => {
    continuousRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setMatchStatus(null);
    if (micTimeoutRef.current) { clearTimeout(micTimeoutRef.current); micTimeoutRef.current = null; }
  }, []);

  // ── Trigger actions ───────────────────────────────────────────────────────
  const addTrigger = (id) => {
    setTriggered(prev => [...prev, id]);
    setRecentlyAdded(id);
    setTimeout(() => setRecentlyAdded(null), 900);
  };

  const startTour = () => {
    setActiveTab("compose");
    setTourStep(0);
    setTourTriggered([]);
    setTourExpandedGroup(null);
    setTourActive(true);
    try { localStorage.setItem("lab_tour_prompted","1"); } catch {}
    setShowTourPrompt(false);
  };
  const dismissTourPrompt = () => {
    setShowTourPrompt(false);
    try { localStorage.setItem("lab_tour_prompted","1"); } catch {}
  };

  const applyTourStep = (stepIdx, direction) => {
    const step = TOUR_STEPS[stepIdx];
    if (step.requireCompose) setActiveTab("compose");

    if (direction === "forward" && step.addSnippetId) {
      const snippetToAdd = snippets.find(s => s.id === step.addSnippetId);
      if (snippetToAdd && !tourTriggered.includes(step.addSnippetId)) {
        setTriggered(prev => [...prev, step.addSnippetId]);
        setTourTriggered(prev => [...prev, step.addSnippetId]);
      }
    }
    if (direction === "backward") {
      // remove snippet that was added at the step we're leaving
      const leavingStep = TOUR_STEPS[stepIdx + 1];
      if (leavingStep?.addSnippetId) {
        setTriggered(prev => {
          const idx = [...prev].lastIndexOf(leavingStep.addSnippetId);
          if (idx === -1) return prev;
          const next = [...prev];
          next.splice(idx, 1);
          return next;
        });
        setTourTriggered(prev => prev.filter(id => id !== leavingStep.addSnippetId));
      }
    }
    if (step.expandGroup) {
      setLeftExpanded(p => ({ ...p, [step.expandGroup]: true }));
      setTourExpandedGroup(step.expandGroup);
    }
  };

  const tourNext = () => {
    if (tourStep >= TOUR_STEPS.length - 1) {
      setTourActive(false);
      // Clear tour-added snippets
      setTriggered(prev => prev.filter(id => !tourTriggered.includes(id)));
      setTourTriggered([]);
      setTourExpandedGroup(null);
      return;
    }
    const next = tourStep + 1;
    applyTourStep(next, "forward");
    setTourStep(next);
  };

  const tourPrev = () => {
    if (tourStep <= 0) return;
    const prev = tourStep - 1;
    applyTourStep(prev, "backward");
    setTourStep(prev);
  };

  const tourSkip = () => {
    setTourActive(false);
    setTriggered(prev => prev.filter(id => !tourTriggered.includes(id)));
    setTourTriggered([]);
    setTourExpandedGroup(null);
  };

  const addWildcard = (group) => {
    const wcId = `wc_${group}_${Date.now()}`;
    const wc = { id: wcId, group, trigger:`${group} wildcard`, text:`${group}: ***`, clinicianActions:[], staffActions:[], isWildcard:true, ephemeral:true };
    setSnippets(prev => [...prev, wc]);
    setTriggered(prev => [...prev, wcId]);
  };

  const removeTriggered = (idx) => setTriggered(prev => prev.filter((_, i) => i !== idx));

  const doNewNote = () => { setTriggered([]); setCheckedActions({}); setMatchStatus(null); setCopied(false); setStaffCopied(false); setNoteEdits({}); setPicklistSelections({}); setOpenPicklist(null); };
  const handleNewNote = () => {
    if (triggered.length === 0) { doNewNote(); return; }
    if (skipNewNoteWarning) { doNewNote(); return; }
    setDontShowAgainChecked(false); setShowNewNoteWarning(true);
  };
  const confirmNewNote = () => {
    if (dontShowAgainChecked) { setSkipNewNoteWarning(true); try { localStorage.setItem("lab_skip_new_note_warning","true"); } catch {} }
    setShowNewNoteWarning(false); doNewNote();
  };

  const copyNote = () => {
    if (isListening) stopListening();
    navigator.clipboard.writeText(fullNote).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // increment notes counter
      fetch("/api/stats?action=note").then(r=>r.json()).then(d=>setStats(d)).catch(()=>{});
    });
  };

  // ── Snippet editing ───────────────────────────────────────────────────────
  const startEdit = (s) => { setEditingId(s.id); setEditText(s.text); setEditActions((s.clinicianActions||s.actions||[]).join("\n")); setEditStaffActions((s.staffActions||[]).join("\n")); setEditSynonyms((s.synonyms||[]).join("\n")); };
  const saveEdit = () => {
    const updated = snippets.map(s => s.id === editingId
      ? { ...s, text: editText, clinicianActions: editActions.split("\n").map(a=>a.trim()).filter(Boolean), staffActions: editStaffActions.split("\n").map(a=>a.trim()).filter(Boolean), synonyms: editSynonyms.split("\n").map(a=>a.trim()).filter(Boolean) }
      : s);
    setSnippets(updated); saveSnippets(updated); setEditingId(null);
  };
  const resetToDefault = (id) => {
    const def = DEFAULT_SNIPPETS.find(s => s.id === id);
    if (!def) return;
    const updated = snippets.map(s => s.id === id ? { ...s, text: def.text, clinicianActions: def.clinicianActions, staffActions: def.staffActions, synonyms: def.synonyms || [] } : s);
    setSnippets(updated); saveSnippets(updated);
    if (editingId === id) { setEditText(def.text); setEditActions(def.clinicianActions.join("\n")); setEditStaffActions(def.staffActions.join("\n")); setEditSynonyms((def.synonyms||[]).join("\n")); }
  };
  const deleteSnippet = (id) => {
    const isDefault = DEFAULT_SNIPPETS.some(s => s.id === id);
    if (isDefault) {
      const newDeleted = [...deletedIds, id];
      setDeletedIds(newDeleted); saveDeletedIds(newDeleted);
    }
    const updated = snippets.filter(s => s.id !== id);
    setSnippets(updated); saveSnippets(updated);
  };
  const restoreDeleted = () => {
    setDeletedIds([]); saveDeletedIds([]);
    setSnippets(loadSnippets([]));
  };

  // ── Header/footer ─────────────────────────────────────────────────────────
  const saveHf = () => { saveHeaderFooter(editHf); setHf(editHf); setEditHf(null); };

  // ── Custom trigger ────────────────────────────────────────────────────────
  const saveCustom = () => {
    if (!newTrigger.trigger.trim() || !newTrigger.text.trim()) return;
    const group = newTrigger.useNew && newTrigger.newGroup.trim() ? newTrigger.newGroup.trim() : (newTrigger.group || "Other");
    const id = `custom_${Date.now()}`;
    const s = { id, group, trigger: newTrigger.trigger.trim(), text: newTrigger.text.trim(),
      clinicianActions: newTrigger.actions.split("\n").map(a=>a.trim()).filter(Boolean),
      staffActions: newTrigger.staffActions.split("\n").map(a=>a.trim()).filter(Boolean),
      synonyms: (newTrigger.synonyms||"").split("\n").map(a=>a.trim()).filter(Boolean),
      custom:true };
    const updated = [...snippets, s];
    setSnippets(updated); saveSnippets(updated);
    setNewTrigger({ trigger:"", text:"", actions:"", staffActions:"", synonyms:"", group:"", newGroup:"", useNew:false });
    setShowAddCustom(false);
  };

  // ── Export / Import ───────────────────────────────────────────────────────
  const exportData = () => {
    const custom = snippets.filter(s => isCustomized(s));
    return JSON.stringify({ snippets: custom, headerFooter: hf, deletedIds, groupOrder: groupOrder || [] }, null, 2);
  };
  const handleDownload = () => {
    const blob = new Blob([exportData()], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="lab-note-customizations.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const handleEmailExport = () => {
    window.location.href = `mailto:${exportEmail}?subject=${encodeURIComponent("Lab Note Builder – My Customizations")}&body=${encodeURIComponent("My Lab Note Builder customizations are attached.")}`;
  };
  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.snippets) {
          const updated = [...snippets];
          data.snippets.forEach(imp => {
            const idx = updated.findIndex(s => s.id === imp.id);
            if (idx >= 0) updated[idx] = { ...updated[idx], ...imp };
            else updated.push(imp);
          });
          setSnippets(updated); saveSnippets(updated);
        }
        if (data.headerFooter) { const newHf = { ...hf, ...data.headerFooter }; setHf(newHf); saveHeaderFooter(newHf); }
        if (data.deletedIds) { setDeletedIds(data.deletedIds); saveDeletedIds(data.deletedIds); }
        if (data.groupOrder) { setGroupOrder(data.groupOrder); saveGroupOrder(data.groupOrder); }
        setShowImport(false); alert("Import successful!");
      } catch { alert("Could not read file — make sure it is a valid export file."); }
    };
    reader.readAsText(file);
  };

  // ── Drag and drop group reorder ───────────────────────────────────────────
  const handleDragStart = (e, groupName) => {
    setDraggingGroup(groupName);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, groupName) => {
    e.preventDefault();
    if (groupName !== draggingGroup) setDragOverGroup(groupName);
  };
  const handleDrop = (e, targetGroup) => {
    e.preventDefault();
    if (!draggingGroup || draggingGroup === targetGroup) { setDraggingGroup(null); setDragOverGroup(null); return; }
    const currentOrder = groups.map(g => g.name);
    const fromIdx = currentOrder.indexOf(draggingGroup);
    const toIdx = currentOrder.indexOf(targetGroup);
    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggingGroup);
    setGroupOrder(newOrder); saveGroupOrder(newOrder);
    setDraggingGroup(null); setDragOverGroup(null);
  };

  // ── Manage accordion ──────────────────────────────────────────────────────
  const toggleManage = (g) => setManageOpen(p => ({ ...p, [g]: !p[g] }));
  const existingGroups = [...new Set(snippets.map(s => s.group || "Other").filter(g => g !== "Other"))].sort();
  const conflicts = getConflicts(triggered, snippets);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#eff6ff", fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth:1280, margin:"0 auto", minHeight:"100vh", background:"white", boxShadow:"0 0 40px rgba(30,64,175,0.08)" }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1e40af 0%,#2563eb 100%)", padding:"0 1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", height:64, boxShadow:"0 2px 8px rgba(30,64,175,0.3)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <svg width="32" height="32" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" rx="57" fill="white" opacity="0.15"/>
            <path d="M100,76 L100,144 Q100,157 90,173 L64,211 Q61,217 70,217 L186,217 Q195,217 192,211 L166,173 Q156,157 156,144 L156,76" fill="none" stroke="white" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round"/>
            <line x1="86" y1="76" x2="170" y2="76" stroke="white" strokeWidth="9" strokeLinecap="round"/>
            <path d="M104,180 Q94,165 90,173 L64,211 L192,211 L166,173 Q162,165 152,180 Z" fill="#60a5fa" opacity="0.75"/>
            <line x1="104" y1="180" x2="152" y2="180" stroke="#93c5fd" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="90" cy="198" r="8" fill="#bfdbfe" opacity="0.85"/>
            <circle cx="128" cy="193" r="6" fill="#bfdbfe" opacity="0.85"/>
            <circle cx="162" cy="200" r="5" fill="#bfdbfe" opacity="0.85"/>
            <circle cx="114" cy="160" r="8" fill="none" stroke="#93c5fd" strokeWidth="4"/>
            <circle cx="138" cy="142" r="7" fill="none" stroke="#93c5fd" strokeWidth="3.5"/>
            <circle cx="120" cy="122" r="5" fill="none" stroke="#93c5fd" strokeWidth="3"/>
            <circle cx="140" cy="106" r="4" fill="none" stroke="#93c5fd" strokeWidth="2.5"/>
          </svg>
          <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
            <span style={{ color:"white", fontWeight:700, fontSize:16, letterSpacing:"-0.01em", lineHeight:1.2 }}>Lab Results Note Builder</span>
            <span style={{ color:"rgba(255,255,255,0.55)", fontSize:11, fontStyle:"italic", lineHeight:1.2 }}>Speedy lab results messages in your own words</span>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button ref={el => tourRefs.current.tourBtn = el} onClick={handleNewNote} style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.15)", color:"white", border:"1px solid rgba(255,255,255,0.3)", borderRadius:7, padding:"5px 14px", cursor:"pointer", fontSize:13, fontWeight:500 }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.25)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.15)"}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            New note
          </button>
          <div ref={el => tourRefs.current.manageBtn = el} style={{ display:"flex", background:"rgba(255,255,255,0.15)", borderRadius:30, padding:3, gap:2 }}>
            {[["compose","Compose Note"],["manage","Manage Snippets"]].map(([key,label]) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{ background: activeTab===key ? "white" : "transparent", color: activeTab===key ? "#1e40af" : "rgba(255,255,255,0.85)", border:"none", borderRadius:26, padding:"5px 16px", cursor:"pointer", fontSize:13, fontWeight: activeTab===key ? 600 : 400, transition:"all 0.2s", boxShadow: activeTab===key ? "0 1px 4px rgba(0,0,0,0.15)" : "none" }}>{label}</button>
            ))}
          </div>
          {/* Tour lightbulb button */}
          <button ref={el => tourRefs.current.tourBtn = el} onClick={startTour} title="Take a tour" style={{ width:34, height:34, borderRadius:"50%", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.25)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"white", transition:"background 0.15s", flexShrink:0 }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.25)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.12)"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 6l-1 2H9l-1-2c-1.5-1.5-3-3.5-3-6a7 7 0 0 1 7-7z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* COMPOSE TAB */}
      {activeTab==="compose" && (
        <div style={{ maxWidth:1300, margin:"0 auto", padding:"1.25rem 1rem", display:"grid", gridTemplateColumns:"18% 1fr 26%", gap:"1rem" }}>

          {/* LEFT COLUMN */}
          <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }} ref={el => { tourRefs.current.leftCol = el; leftColDivRef.current = el; }}>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,0.08)", overflow:"visible" }}>
              <div style={{ background:"#eff6ff", padding:"8px 12px", borderBottom:"1px solid #dbeafe", borderRadius:"12px 12px 0 0" }}>
                <div style={{ fontSize:10, fontWeight:500, color:"#1e40af", textTransform:"uppercase", letterSpacing:"0.07em" }}>Add by clicking</div>
                <div style={{ fontSize:10, color:"#93c5fd", marginTop:2 }}>Click name to add normal · ▼ for others</div>
              </div>
              {groups.map(({ name, snippets:gSnippets }, groupIdx) => {
                const defaultId = GROUP_DEFAULT_ID[name];
                const defaultSnippet = gSnippets.find(s => s.id === defaultId) || gSnippets[0];
                const otherSnippets = gSnippets.filter(s => s.id !== defaultSnippet?.id && !s.ephemeral);
                const expanded = leftExpanded[name];
                const isDragOver = dragOverGroup === name;
                const isDragging = draggingGroup === name;
                const justAdded = recentlyAdded === defaultSnippet?.id;
                return (
                  <div key={name}
                    ref={el => {
                      if (name === "CBC") tourRefs.current.cbcSection = el;
                      if (name === "Fe/TIBC/Ferr") tourRefs.current.dragHandle = el;
                    }}
                    draggable
                    onDragStart={e => handleDragStart(e, name)}
                    onDragOver={e => handleDragOver(e, name)}
                    onDragLeave={() => setDragOverGroup(null)}
                    onDrop={e => handleDrop(e, name)}
                    style={{ borderBottom:"1px solid #f1f5f9", opacity: isDragging ? 0.5 : 1, background: isDragOver ? "#eff6ff" : "white", transition:"background 0.15s" }}>
                    <div className="lab-row" style={{ display:"flex", alignItems:"center", position:"relative" }}>
                      {/* Tooltip on outer row so it aligns consistently with/without expand arrow */}
                      {defaultSnippet && <div className="snippet-tooltip">{defaultSnippet.text}</div>}
                      {/* Six-dot grip handle */}
                      <div style={{ padding:"0 7px 0 9px", cursor:"grab", flexShrink:0, display:"flex", alignItems:"center" }} title="Drag to reorder" aria-hidden="true">
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="2.5" cy="2.5" r="1.5" fill="#c4c1b9"/>
                          <circle cx="7.5" cy="2.5" r="1.5" fill="#c4c1b9"/>
                          <circle cx="2.5" cy="7" r="1.5" fill="#c4c1b9"/>
                          <circle cx="7.5" cy="7" r="1.5" fill="#c4c1b9"/>
                          <circle cx="2.5" cy="11.5" r="1.5" fill="#c4c1b9"/>
                          <circle cx="7.5" cy="11.5" r="1.5" fill="#c4c1b9"/>
                        </svg>
                      </div>
                      {/* Header = default trigger clickable */}
                      <div className="trigger-row" style={{ flex:1, position:"relative" }}>
                        <button onClick={() => defaultSnippet && addTrigger(defaultSnippet.id)}
                          style={{ width:"100%", textAlign:"left", padding:"8px 4px 8px 0", background:"none", border:"none", cursor:"pointer", fontSize:12, fontWeight:600, color: justAdded ? "#16a34a" : "#1e3a8a", display:"flex", alignItems:"center", gap:5, transition:"color 0.2s", whiteSpace:"nowrap", overflow:"hidden", minWidth:0 }}
                          onMouseEnter={e=>{ if(!justAdded) e.currentTarget.style.color="#2563eb"; }} onMouseLeave={e=>{ if(!justAdded) e.currentTarget.style.color="#1e3a8a"; }}>
                          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>
                          {(() => {
                            const label = useAbbrev ? (GROUP_ABBREV[name] || GROUP_DISPLAY[name] || name) : (GROUP_DISPLAY[name] || name);
                            return justAdded
                              ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>{label}</>
                              : <>+ {label}</>;
                          })()}
                          </span>
                        </button>
                      </div>
                      {/* Expand arrow */}
                      {otherSnippets.length > 0 && (
                        <button onClick={() => setLeftExpanded(p=>({...p,[name]:!p[name]}))}
                          ref={name === "CBC" ? el => tourRefs.current.expandArrow = el : null}
                          style={{ padding:"8px 10px", background:"none", border:"none", cursor:"pointer", color:"#93c5fd", fontSize:10, transform: expanded?"rotate(180deg)":"rotate(0)", transition:"0.2s", flexShrink:0 }}>▼</button>
                      )}
                    </div>
                    {expanded && (
                      <div style={{ background:"#f8fafc", borderTop:"1px solid #f1f5f9" }}>
                        {otherSnippets.map(s => {
                          const justAddedOther = recentlyAdded === s.id;
                          return (
                            <div key={s.id} className="trigger-row" style={{ position:"relative" }}>
                              <button onClick={() => addTrigger(s.id)}
                                style={{ width:"100%", textAlign:"left", padding:"6px 12px 6px 26px", background:"none", border:"none", cursor:"pointer", fontSize:11, color: justAddedOther ? "#16a34a" : "#374151", borderBottom:"1px solid #f1f5f9", transition:"background 0.15s, color 0.2s", display:"flex", alignItems:"center", gap:5 }}
                                onMouseEnter={e=>{ if(!justAddedOther){ e.currentTarget.style.background="#dbeafe"; }}} onMouseLeave={e=>{ if(!justAddedOther){ e.currentTarget.style.background="none"; }}}>
                                {justAddedOther
                                  ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{s.trigger}</>
                                  : <>+ {s.trigger}</>
                                }
                              </button>
                              <div className="snippet-tooltip">{s.text}</div>
                            </div>
                          );
                        })}
                        <button onClick={() => addWildcard(name)}
                          ref={name === "Microalbumin" ? el => tourRefs.current.wildcardRef = el : null}
                          style={{ width:"100%", textAlign:"left", padding:"6px 12px 6px 26px", background:"none", border:"none", cursor:"pointer", fontSize:11, color:"#6366f1", fontStyle:"italic", borderBottom:"1px solid #f1f5f9", transition:"background 0.15s" }}
                          onMouseEnter={e=>e.currentTarget.style.background="#ede9fe"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                          + {name}: ***
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* CENTER COLUMN */}
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            {/* Mic */}
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,0.08)", overflow:"hidden" }}>
              <div style={{ background:"#eff6ff", padding:"8px 12px", borderBottom:"1px solid #dbeafe" }}>
                <div style={{ fontSize:10, fontWeight:500, color:"#1e40af", textTransform:"uppercase", letterSpacing:"0.07em" }}>Add with voice</div>
                <div style={{ fontSize:10, color:"#93c5fd", marginTop:2 }}>Press mic and speak a trigger phrase</div>
              </div>
              <div style={{ padding:"1rem 1.25rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <button ref={el => tourRefs.current.micBtn = el} onClick={isListening ? stopListening : startListening} style={{ width:54, height:54, borderRadius:"50%", border:"none", cursor:"pointer", flexShrink:0, background: isListening ? "#ef4444" : "#2563eb", display:"flex", alignItems:"center", justifyContent:"center", boxShadow: isListening ? "0 0 0 8px rgba(239,68,68,0.15)" : "0 2px 8px rgba(37,99,235,0.3)", transition:"all 0.2s" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {isListening ? <rect x="6" y="6" width="12" height="12" rx="2"/> : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>}
                  </svg>
                </button>
                <div style={{ flex:1 }}>
                  {!matchStatus && !isListening && <div style={{ color:"#9ca3af", fontSize:13 }}>Press mic to start — keep speaking triggers, press stop when done</div>}
                  {isListening && !matchStatus && <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ width:8, height:8, borderRadius:"50%", background:"#ef4444", display:"inline-block", animation:"pulse 1s infinite" }}/><span style={{ color:"#ef4444", fontSize:13, fontWeight:500 }}>Listening…</span></div>}
                  {matchStatus?.type==="classifying" && <div style={{ color:"#6366f1", fontSize:13 }}>{matchStatus.text}</div>}
                  {matchStatus?.type==="matched" && <div style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ color:"#16a34a", fontSize:16 }}>✓</span><span style={{ color:"#16a34a", fontSize:13, fontWeight:500 }}>{matchStatus.text}</span></div>}
                  {matchStatus?.type==="nomatch" && <div style={{ color:"#d97706", fontSize:13 }}>{matchStatus.text}</div>}
                  {matchStatus?.type==="error" && <div style={{ color:"#dc2626", fontSize:13 }}>{matchStatus.text}</div>}
                </div>
              </div>
              </div>
            </div>

            {/* Triggered pills */}
            {triggered.length > 0 && (
              <div style={{ background:"white", borderRadius:12, padding:"1.25rem", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em" }}>Triggered ({triggered.length})</div>
                  <button onClick={doNewNote} style={{ fontSize:11, color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>Clear all</button>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                  {triggered.map((id, idx) => {
                    const s = snippets.find(sn => sn.id === id);
                    if (!s) return null;
                    const conflict = conflicts.has(id);
                    return (
                      <div key={`${id}-${idx}`} style={{ display:"flex", alignItems:"center", gap:5, background: conflict?"#fefce8":"#eff6ff", border:`1px solid ${conflict?"#fde047":"#93c5fd"}`, borderRadius:20, padding:"4px 10px 4px 12px" }}>
                        <span style={{ fontSize:12, color: conflict?"#854d0e":"#1e40af", fontWeight:500 }}>{s.trigger}</span>
                        <button onClick={() => removeTriggered(idx)} style={{ background:"none", border:"none", cursor:"pointer", color: conflict?"#fde047":"#93c5fd", fontSize:15, lineHeight:1, padding:0 }}>×</button>
                      </div>
                    );
                  })}
                </div>
                {conflicts.size > 0 && <div style={{ marginTop:10, fontSize:11, color:"#d97706" }}>⚠ Yellow items are from the same lab group — review for conflicts</div>}
              </div>
            )}

            {/* Note preview */}
            <div ref={el => tourRefs.current.notePreview = el} style={{ background:"white", borderRadius:12, padding:"1.25rem", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:500, color:"#1f2937" }}>Patient note preview</div>
                  <div style={{ fontSize:10, color:"#9ca3af", marginTop:1 }}>Click any bullet to edit</div>
                </div>
                <button ref={el => tourRefs.current.copyBtn = el} onClick={noteLines.length > 0 ? copyNote : undefined} disabled={noteLines.length === 0} style={{
                  display:"flex", alignItems:"center", gap:6,
                  background: copied ? "#16a34a" : noteLines.length === 0 ? "#e5e7eb" : "#2563eb",
                  color: noteLines.length === 0 ? "#9ca3af" : "white",
                  border:"none", borderRadius:7, padding:"6px 14px", cursor: noteLines.length === 0 ? "default" : "pointer",
                  fontSize:12, fontWeight:500, transition:"background 0.2s"
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    {copied ? <polyline points="20 6 9 17 4 12"/> : <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>}
                  </svg>
                  {copied ? "Copied!" : "Copy note"}
                </button>
              </div>
              {noteLines.length === 0
                ? <div style={{ color:"#9ca3af", fontSize:13, fontStyle:"italic", textAlign:"center", padding:"2rem 0", lineHeight:1.6 }}>
                    Your note will appear here as you add triggers.<br/>
                    <span style={{ fontSize:11 }}>Click a lab name in the left column, or press the mic button to speak.</span>
                  </div>
                : <div style={{ fontSize:13, lineHeight:1.75, color:"#1f2937" }}>
                    <div style={{ color:"#374151", marginBottom:"1rem", fontStyle:"italic", borderLeft:"3px solid #bfdbfe", paddingLeft:12, fontSize:12 }}>{hf.header}</div>
                    {noteLines.map((line, i) => {
                      const currentText = noteEdits[i] !== undefined ? noteEdits[i] : line.text;
                      const isEdited = noteEdits[i] !== undefined && noteEdits[i] !== line.text;
                      const segments = parseTokens(currentText);
                      const hasPicklists = !isEdited && segments.some(s => s.type === "picklist");
                      return (
                        <div key={i} className="note-bullet-row" style={{ display:"flex", gap:8, marginBottom:"0.7rem", alignItems:"flex-start", position:"relative" }}>
                          <span style={{ color:"#2563eb", fontWeight:700, flexShrink:0, marginTop:4 }}>•</span>
                          <div style={{ flex:1, position:"relative" }}>
                            {hasPicklists ? (
                              <div style={{ fontSize:13, lineHeight:1.9, color:"#1f2937", padding:"3px 6px" }}>
                                {segments.map((seg, si) => {
                                  if (seg.type === "text") return <span key={si}>{seg.value}</span>;
                                  const tokenIdx = segments.slice(0,si).filter(s=>s.type==="picklist").length;
                                  const key = `${i}-${tokenIdx}`;
                                  const selected = picklistSelections[key] ?? seg.defaultValue;
                                  const isOpen = openPicklist === key;
                                  return (
                                    <span key={si} style={{ position:"relative", display:"inline-block" }}>
                                      <button onClick={(e) => { e.stopPropagation(); setOpenPicklist(isOpen ? null : key); }}
                                        style={{ display:"inline-flex", alignItems:"center", gap:3, background:"#dbeafe", color:"#1e40af", border:"1.5px solid #93c5fd", borderRadius:5, padding:"1px 8px", fontSize:12, fontWeight:600, cursor:"pointer", lineHeight:1.6, verticalAlign:"middle" }}>
                                        {selected}
                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                                      </button>
                                      {isOpen && (
                                        <div style={{ position:"absolute", top:"calc(100% + 2px)", left:0, background:"white", border:"1px solid #93c5fd", borderRadius:7, boxShadow:"0 4px 16px rgba(0,0,0,0.12)", zIndex:60, minWidth:110, overflow:"hidden" }}>
                                          {seg.options.map(opt => (
                                            <button key={opt} onClick={(e) => { e.stopPropagation(); setPicklistSelections(p=>({...p,[key]:opt})); setOpenPicklist(null); }}
                                              style={{ display:"block", width:"100%", textAlign:"left", padding:"6px 12px", background: opt===selected?"#eff6ff":"white", color: opt===selected?"#1e40af":"#1f2937", border:"none", cursor:"pointer", fontSize:12, fontWeight: opt===selected?600:400 }}
                                              onMouseEnter={e=>{ if(opt!==selected) e.currentTarget.style.background="#f0f9ff"; }}
                                              onMouseLeave={e=>{ if(opt!==selected) e.currentTarget.style.background="white"; }}>
                                              {opt}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <textarea
                                value={currentText}
                                onChange={e => setNoteEdits(prev => ({ ...prev, [i]: e.target.value }))}
                                style={{
                                  width:"100%", fontSize:13, lineHeight:1.6, color:"#1f2937",
                                  border: isEdited ? "1px solid #bfdbfe" : "1px solid transparent",
                                  borderRadius:6, padding:"3px 6px", resize:"none", fontFamily:"inherit",
                                  background: isEdited ? "#f0f9ff" : "transparent",
                                  cursor:"text", overflow:"hidden", boxSizing:"border-box", minHeight:24,
                                }}
                                rows={Math.max(1, Math.ceil(currentText.length / 72))}
                                onFocus={e => { e.target.style.border="1px solid #93c5fd"; e.target.style.background="#f0f9ff"; }}
                                onBlur={e => {
                                  e.target.style.border = isEdited ? "1px solid #bfdbfe" : "1px solid transparent";
                                  e.target.style.background = isEdited ? "#f0f9ff" : "transparent";
                                }}
                              />
                            )}
                            {isEdited && (
                              <button onClick={() => setNoteEdits(prev => { const n={...prev}; delete n[i]; return n; })}
                                title="Revert to original"
                                style={{ position:"absolute", top:2, right:2, background:"none", border:"none", cursor:"pointer", color:"#93c5fd", fontSize:13, lineHeight:1, padding:0 }}>↺</button>
                            )}
                          </div>
                          <button
                            className="bullet-delete-btn"
                            title="Remove this result from note"
                            onClick={() => {
                              const triggeredIdx = triggered.lastIndexOf(line.id);
                              if (triggeredIdx !== -1) setTriggered(prev => { const n=[...prev]; n.splice(triggeredIdx,1); return n; });
                              setNoteEdits(prev => { const n={...prev}; delete n[i]; return n; });
                            }}
                            style={{ position:"absolute", top:2, right:-22, width:18, height:18, borderRadius:"50%", background:"#fee2e2", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:0, transition:"opacity 0.15s", flexShrink:0 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      );
                    })}
                    <div style={{ color:"#374151", marginTop:"1rem", fontStyle:"italic", borderLeft:"3px solid #bfdbfe", paddingLeft:12, fontSize:12 }}>{hf.footer}</div>
                    {Object.keys(noteEdits).length > 0 && (
                      <div style={{ marginTop:8, fontSize:11, color:"#6366f1" }}>✎ Note has been manually edited — edits are temporary and will clear with New Note</div>
                    )}
                  </div>
              }
            </div>

            {/* PHI persistent reminder — Option C: subtle caption style */}
            <div style={{ position:"sticky", bottom:8, zIndex:10, textAlign:"center" }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span style={{ fontSize:10, color:"#9ca3af", fontStyle:"italic" }}>No PHI — do not enter patient identifiers</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            {/* Clinician To Do */}
            <div ref={el => tourRefs.current.clinicianTodo = el} style={{ background:"white", borderRadius:12, padding:"1.25rem", boxShadow: allClinicianActions.length > 0 ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 2px #fde68a" : "0 1px 3px rgba(0,0,0,0.08)", transition:"box-shadow 0.3s" }}>
              <div style={{ marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background: allClinicianActions.length > 0 ? "#d97706" : "#d1d5db", display:"inline-block", flexShrink:0, transition:"background 0.3s" }}/>
                  <span style={{ fontSize:12, fontWeight:500, color: allClinicianActions.length > 0 ? "#92400e" : "#9ca3af", transition:"color 0.3s" }}>Clinician to do</span>
                  {allClinicianActions.length > 0 && (
                    <span style={{ marginLeft:"auto", fontSize:10, fontWeight:700, background:"#fef3c7", color:"#92400e", borderRadius:10, padding:"1px 7px", border:"1px solid #fde68a" }}>{allClinicianActions.length}</span>
                  )}
                </div>
                <div style={{ fontSize:11, color:"#9ca3af", paddingLeft:14 }}>Lab orders · Rx · Referrals</div>
              </div>
              {allClinicianActions.length === 0
                ? <div style={{ color:"#d1d5db", fontSize:12, fontStyle:"italic", textAlign:"center", padding:"1rem 0" }}>Clinician tasks appear here when relevant triggers are added</div>
                : <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {allClinicianActions.map((a, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                        <span style={{ color:"#d97706", fontWeight:700, flexShrink:0, marginTop:1, fontSize:14 }}>•</span>
                        <span style={{ fontSize:12, lineHeight:1.5, color:"#1f2937" }}>{a}</span>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Staff To Do */}
            <div ref={el => tourRefs.current.staffTodo = el} style={{ background:"white", borderRadius:12, padding:"1.25rem", boxShadow: allStaffActions.length > 0 ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 2px #bfdbfe" : "0 1px 3px rgba(0,0,0,0.08)", transition:"box-shadow 0.3s" }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background: allStaffActions.length > 0 ? "#2563eb" : "#d1d5db", display:"inline-block", flexShrink:0, transition:"background 0.3s" }}/>
                    <span style={{ fontSize:12, fontWeight:500, color: allStaffActions.length > 0 ? "#1e40af" : "#9ca3af", transition:"color 0.3s" }}>Staff to do</span>
                    {allStaffActions.length > 0 && (
                      <span style={{ marginLeft:4, fontSize:10, fontWeight:700, background:"#dbeafe", color:"#1e40af", borderRadius:10, padding:"1px 7px", border:"1px solid #bfdbfe" }}>{allStaffActions.length}</span>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:"#9ca3af", paddingLeft:14 }}>Scheduling · Patient contact</div>
                </div>
                {allStaffActions.length > 0 && (
                  <button onClick={() => { const text = allStaffActions.map(a=>`• ${a}`).join("\n"); navigator.clipboard.writeText(text).then(()=>{ setStaffCopied(true); setTimeout(()=>setStaffCopied(false),2000); }); }}
                    style={{ display:"flex", alignItems:"center", gap:5, background: staffCopied?"#16a34a":"#eff6ff", color: staffCopied?"white":"#1e40af", border:`1px solid ${staffCopied?"#16a34a":"#bfdbfe"}`, borderRadius:6, padding:"3px 10px", cursor:"pointer", fontSize:11, fontWeight:500, transition:"all 0.2s", flexShrink:0 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      {staffCopied ? <polyline points="20 6 9 17 4 12"/> : <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>}
                    </svg>
                    {staffCopied ? "Copied!" : "Copy"}
                  </button>
                )}
              </div>
              {allStaffActions.length === 0
                ? <div style={{ color:"#d1d5db", fontSize:12, fontStyle:"italic", textAlign:"center", padding:"1rem 0" }}>Staff tasks appear here when relevant triggers are added</div>
                : <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px", border:"1px solid #e5e7eb" }}>
                    {allStaffActions.map((a, i) => (
                      <div key={i} style={{ display:"flex", gap:8, marginBottom: i<allStaffActions.length-1?8:0, alignItems:"flex-start" }}>
                        <span style={{ color:"#2563eb", fontWeight:700, flexShrink:0, marginTop:1 }}>•</span>
                        <span style={{ fontSize:12, lineHeight:1.5, color:"#1f2937" }}>{a}</span>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Stats — quiet strip, developer only */}
            {devMode && (
            <div style={{ borderTop:"0.5px solid #e5e7eb", paddingTop:12 }}>
              <div style={{ display:"flex", justifyContent:"space-around", alignItems:"center" }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:500, color:"#6b7280" }}>{stats.visitors === "…" ? "…" : Number(stats.visitors).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#9ca3af", marginTop:1, textTransform:"uppercase", letterSpacing:"0.05em" }}>Visits</div>
                </div>
                <div style={{ width:1, height:28, background:"#e5e7eb" }}/>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:500, color:"#6b7280" }}>{stats.notes === "…" ? "…" : Number(stats.notes).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#9ca3af", marginTop:1, textTransform:"uppercase", letterSpacing:"0.05em" }}>Notes created</div>
                </div>
              </div>
              <div style={{ fontSize:10, color:"#d1d5db", textAlign:"center", marginTop:6 }}>Lab Results Note Builder · site activity</div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* MANAGE SNIPPETS TAB */}
      {activeTab==="manage" && (
        <div style={{ maxWidth:860, margin:"0 auto", padding:"1.25rem 1rem" }}>
          {/* Header/footer */}
          <div style={{ background:"white", borderRadius:12, padding:"1.25rem", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", marginBottom:"1rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em" }}>Header &amp; Footer</div>
              {!editHf && <button onClick={() => setEditHf({...hf})} style={{ fontSize:12, color:"#2563eb", background:"none", border:"1px solid #bfdbfe", borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>Edit</button>}
            </div>
            {editHf ? (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:4 }}>Header</div>
                <textarea value={editHf.header} onChange={e=>setEditHf(p=>({...p,header:e.target.value}))} style={{ width:"100%", minHeight:60, fontSize:13, border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} />
                <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginTop:10, marginBottom:4 }}>Footer</div>
                <textarea value={editHf.footer} onChange={e=>setEditHf(p=>({...p,footer:e.target.value}))} style={{ width:"100%", minHeight:60, fontSize:13, border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} />
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <button onClick={saveHf} style={{ fontSize:12, background:"#2563eb", color:"white", border:"none", borderRadius:7, padding:"6px 14px", cursor:"pointer" }}>Save</button>
                  <button onClick={() => setEditHf(null)} style={{ fontSize:12, background:"none", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:7, padding:"6px 14px", cursor:"pointer" }}>Cancel</button>
                  <button onClick={() => setEditHf({header:DEFAULT_HEADER,footer:DEFAULT_FOOTER})} style={{ fontSize:12, background:"none", color:"#dc2626", border:"1px solid #fee2e2", borderRadius:7, padding:"6px 14px", cursor:"pointer", marginLeft:"auto" }}>Reset to default</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop:8, fontSize:12, color:"#6b7280", lineHeight:1.5 }}>
                <div><strong>Header:</strong> {hf.header.slice(0,80)}…</div>
                <div style={{ marginTop:4 }}><strong>Footer:</strong> {hf.footer.slice(0,80)}…</div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
            <button onClick={() => setShowAddCustom(true)} style={{ fontSize:12, background:"#2563eb", color:"white", border:"none", borderRadius:7, padding:"7px 14px", cursor:"pointer", fontWeight:500 }}>+ Add custom trigger</button>
            {deletedIds.length > 0 && (
              <button onClick={restoreDeleted} style={{ fontSize:12, background:"white", color:"#16a34a", border:"1px solid #bbf7d0", borderRadius:7, padding:"7px 14px", cursor:"pointer" }}>↩ Restore deleted triggers ({deletedIds.length})</button>
            )}
            <button onClick={() => setShowExport(true)} style={{ fontSize:12, background:"white", color:"#2563eb", border:"1px solid #bfdbfe", borderRadius:7, padding:"7px 14px", cursor:"pointer" }}>Export customizations</button>
            <button onClick={() => setShowImport(true)} style={{ fontSize:12, background:"white", color:"#2563eb", border:"1px solid #bfdbfe", borderRadius:7, padding:"7px 14px", cursor:"pointer" }}>Import customizations</button>
          </div>

          {/* Snippets accordion — alphabetical in manage */}
          {getGroupsOrdered(snippets, null).map(({ name, snippets: gSnippets }) => (
            <div key={name} style={{ background:"white", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,0.08)", marginBottom:"0.75rem", overflow:"hidden" }}>
              <button onClick={() => toggleManage(name)} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 18px", background: manageOpen[name]?"#eff6ff":"white", border:"none", cursor:"pointer", fontSize:14, fontWeight:600, color:"#1e3a8a" }}>
                <span>{name}</span>
                <span style={{ fontSize:11, color:"#93c5fd", transform: manageOpen[name]?"rotate(180deg)":"rotate(0)", transition:"0.2s" }}>▼</span>
              </button>
              {manageOpen[name] && (
                <div style={{ borderTop:"1px solid #dbeafe" }}>
                  {gSnippets.filter(s => !s.ephemeral).map(s => (
                    <div key={s.id} style={{ padding:"12px 18px", borderBottom:"1px solid #f8fafc" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontWeight:600, fontSize:13, color:"#1f2937" }}>{s.trigger}</span>
                          {isCustomized(s) && <span style={{ fontSize:10, background:"#fef3c7", color:"#92400e", borderRadius:10, padding:"2px 7px", fontWeight:500 }}>Customized</span>}
                        </div>
                        {editingId !== s.id && (
                          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                            <button onClick={() => startEdit(s)} style={{ fontSize:11, color:"#2563eb", background:"none", border:"1px solid #bfdbfe", borderRadius:5, padding:"3px 9px", cursor:"pointer" }}>Edit</button>
                            <button onClick={() => deleteSnippet(s.id)} style={{ fontSize:11, color:"#dc2626", background:"none", border:"1px solid #fee2e2", borderRadius:5, padding:"3px 9px", cursor:"pointer" }}>Delete</button>
                            {!s.custom && isCustomized(s) && (
                              <button onClick={() => resetToDefault(s.id)} style={{ fontSize:11, color:"#6b7280", background:"none", border:"1px solid #e5e7eb", borderRadius:5, padding:"3px 9px", cursor:"pointer" }}>Reset</button>
                            )}
                          </div>
                        )}
                      </div>
                      {editingId === s.id ? (
                        <div style={{ marginTop:10 }}>
                          <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:3 }}>Voice synonyms (alternate phrases that trigger this snippet — one per line)</div>
                          <textarea value={editSynonyms} onChange={e=>setEditSynonyms(e.target.value)} placeholder="e.g. thyroid normal no meds&#10;TSH fine" style={{ width:"100%", minHeight:55, fontSize:12, border:"1px solid #d1d5db", borderRadius:7, padding:"8px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} />
                          <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginTop:10, marginBottom:3 }}>Patient-facing text</div>
                          <textarea value={editText} onChange={e=>setEditText(e.target.value)} style={{ width:"100%", minHeight:90, fontSize:12, border:"1px solid #d1d5db", borderRadius:7, padding:"8px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} />
                          <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginTop:10, marginBottom:3 }}>Clinician action items (lab orders, Rx, referrals — one per line)</div>
                          <textarea value={editActions} onChange={e=>setEditActions(e.target.value)} style={{ width:"100%", minHeight:55, fontSize:12, border:"1px solid #d1d5db", borderRadius:7, padding:"8px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} />
                          <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginTop:10, marginBottom:3 }}>Staff action items (scheduling, patient contact — one per line)</div>
                          <textarea value={editStaffActions} onChange={e=>setEditStaffActions(e.target.value)} style={{ width:"100%", minHeight:55, fontSize:12, border:"1px solid #d1d5db", borderRadius:7, padding:"8px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} />
                          <div style={{ display:"flex", gap:7, marginTop:9 }}>
                            <button onClick={saveEdit} style={{ fontSize:12, background:"#2563eb", color:"white", border:"none", borderRadius:6, padding:"6px 13px", cursor:"pointer" }}>Save</button>
                            <button onClick={()=>setEditingId(null)} style={{ fontSize:12, background:"none", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:6, padding:"6px 13px", cursor:"pointer" }}>Cancel</button>
                            {!s.custom && <button onClick={()=>resetToDefault(s.id)} style={{ fontSize:12, background:"none", color:"#dc2626", border:"1px solid #fee2e2", borderRadius:6, padding:"6px 13px", cursor:"pointer", marginLeft:"auto" }}>Reset to default</button>}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize:12, color:"#6b7280", marginTop:5, lineHeight:1.5 }}>{s.text.slice(0,120)}{s.text.length>120?"…":""}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Add custom trigger */}
      {showAddCustom && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"white", borderRadius:14, padding:"1.5rem", width:500, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#1e3a8a", marginBottom:14 }}>Add custom trigger &amp; snippet</div>
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:3 }}>Trigger phrase</div>
            <input value={newTrigger.trigger} onChange={e=>setNewTrigger(p=>({...p,trigger:e.target.value}))} placeholder="e.g. Lipids normal" style={{ width:"100%", fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:3 }}>Voice synonyms (alternate phrases — one per line, optional)</div>
            <textarea value={newTrigger.synonyms||""} onChange={e=>setNewTrigger(p=>({...p,synonyms:e.target.value}))} placeholder="e.g. cholesterol normal&#10;lipid panel fine" style={{ width:"100%", minHeight:50, fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:3 }}>Patient-facing snippet text</div>
            <textarea value={newTrigger.text} onChange={e=>setNewTrigger(p=>({...p,text:e.target.value}))} placeholder="Text that appears in the note…" style={{ width:"100%", minHeight:80, fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:3 }}>Clinician action items (one per line, optional)</div>
            <textarea value={newTrigger.actions} onChange={e=>setNewTrigger(p=>({...p,actions:e.target.value}))} placeholder="Optional clinician actions…" style={{ width:"100%", minHeight:50, fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:3 }}>Staff action items (one per line, optional)</div>
            <textarea value={newTrigger.staffActions} onChange={e=>setNewTrigger(p=>({...p,staffActions:e.target.value}))} placeholder="Optional staff actions…" style={{ width:"100%", minHeight:50, fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:5 }}>Lab group</div>
            <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
              {existingGroups.map(g => (
                <button key={g} onClick={() => setNewTrigger(p=>({...p,group:g,useNew:false}))} style={{ fontSize:12, padding:"4px 10px", borderRadius:15, border:"1px solid", borderColor: newTrigger.group===g&&!newTrigger.useNew?"#2563eb":"#d1d5db", background: newTrigger.group===g&&!newTrigger.useNew?"#eff6ff":"white", color: newTrigger.group===g&&!newTrigger.useNew?"#1e40af":"#374151", cursor:"pointer" }}>{g}</button>
              ))}
              <button onClick={() => setNewTrigger(p=>({...p,group:"Other",useNew:false}))} style={{ fontSize:12, padding:"4px 10px", borderRadius:15, border:"1px solid", borderColor: newTrigger.group==="Other"&&!newTrigger.useNew?"#2563eb":"#d1d5db", background: newTrigger.group==="Other"&&!newTrigger.useNew?"#eff6ff":"white", color: newTrigger.group==="Other"&&!newTrigger.useNew?"#1e40af":"#374151", cursor:"pointer" }}>Other</button>
              <button onClick={() => setNewTrigger(p=>({...p,useNew:true,group:""}))} style={{ fontSize:12, padding:"4px 10px", borderRadius:15, border:"1px solid", borderColor: newTrigger.useNew?"#2563eb":"#d1d5db", background: newTrigger.useNew?"#eff6ff":"white", color: newTrigger.useNew?"#1e40af":"#374151", cursor:"pointer" }}>+ New group</button>
            </div>
            {newTrigger.useNew && <input value={newTrigger.newGroup} onChange={e=>setNewTrigger(p=>({...p,newGroup:e.target.value}))} placeholder="New lab group name" style={{ width:"100%", fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px", boxSizing:"border-box", marginBottom:10 }} />}
            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              <button onClick={saveCustom} disabled={!newTrigger.trigger.trim()||!newTrigger.text.trim()} style={{ fontSize:13, background: (!newTrigger.trigger.trim()||!newTrigger.text.trim())?"#93c5fd":"#2563eb", color:"white", border:"none", borderRadius:7, padding:"7px 16px", cursor:"pointer", fontWeight:500 }}>Add trigger</button>
              <button onClick={() => setShowAddCustom(false)} style={{ fontSize:13, background:"none", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:7, padding:"7px 16px", cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Export */}
      {showExport && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"white", borderRadius:14, padding:"1.5rem", width:420, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#1e3a8a", marginBottom:12 }}>Export customizations</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:16 }}>Exports your customized snippets, header/footer, deleted triggers, and group order.</div>
            <button onClick={handleDownload} style={{ width:"100%", fontSize:13, background:"#2563eb", color:"white", border:"none", borderRadius:8, padding:"9px", cursor:"pointer", fontWeight:500, marginBottom:10 }}>↓ Download file</button>
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:5 }}>Or email to:</div>
            <div style={{ display:"flex", gap:7 }}>
              <input value={exportEmail} onChange={e=>setExportEmail(e.target.value)} placeholder="your@email.com" style={{ flex:1, fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px" }} />
              <button onClick={handleEmailExport} disabled={!exportEmail.trim()} style={{ fontSize:13, background: exportEmail.trim()?"#2563eb":"#93c5fd", color:"white", border:"none", borderRadius:7, padding:"7px 12px", cursor:"pointer" }}>Send</button>
            </div>
            <button onClick={() => setShowExport(false)} style={{ marginTop:14, fontSize:12, background:"none", color:"#6b7280", border:"none", cursor:"pointer" }}>Close</button>
          </div>
        </div>
      )}

      {/* MODAL: Import */}
      {showImport && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"white", borderRadius:14, padding:"1.5rem", width:420, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#1e3a8a", marginBottom:12 }}>Import customizations</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:16 }}>Imported data will overwrite matching local edits. Snippets not in the import file will be kept.</div>
            <div onDragOver={e=>{e.preventDefault();setImportDrag(true);}} onDragLeave={()=>setImportDrag(false)} onDrop={e=>{e.preventDefault();setImportDrag(false);const f=e.dataTransfer.files[0];if(f)handleImportFile(f);}}
              style={{ border:`2px dashed ${importDrag?"#2563eb":"#bfdbfe"}`, background: importDrag?"#eff6ff":"#f8fafc", borderRadius:10, padding:"2rem", textAlign:"center", marginBottom:14, transition:"all 0.2s" }}>
              <div style={{ fontSize:13, color:"#6b7280", marginBottom:10 }}>Drag and drop your export file here</div>
              <label style={{ fontSize:12, background:"#2563eb", color:"white", borderRadius:7, padding:"7px 14px", cursor:"pointer" }}>
                Or select file
                <input type="file" accept=".json" onChange={e=>{if(e.target.files[0])handleImportFile(e.target.files[0]);}} style={{ display:"none" }} />
              </label>
            </div>
            <button onClick={() => setShowImport(false)} style={{ fontSize:12, background:"none", color:"#6b7280", border:"none", cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* MODAL: New note warning */}
      {showNewNoteWarning && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
          <div style={{ background:"white", borderRadius:14, padding:"1.75rem", width:400, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div style={{ fontWeight:700, fontSize:15, color:"#1e3a8a" }}>Start a new note?</div>
            </div>
            <div style={{ fontSize:13, color:"#4b5563", lineHeight:1.6, marginBottom:20 }}>This will clear the current note and all triggered items. Your snippets and settings in Manage Snippets will not be affected.</div>
            <label style={{ display:"flex", alignItems:"center", gap:9, marginBottom:20, cursor:"pointer" }}>
              <input type="checkbox" checked={dontShowAgainChecked} onChange={e=>setDontShowAgainChecked(e.target.checked)} style={{ width:15, height:15, accentColor:"#2563eb", flexShrink:0 }} />
              <span style={{ fontSize:13, color:"#6b7280" }}>Don't show this warning again</span>
            </label>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={confirmNewNote} style={{ fontSize:13, background:"#2563eb", color:"white", border:"none", borderRadius:7, padding:"8px 18px", cursor:"pointer", fontWeight:500 }}>Clear and start new</button>
              <button onClick={() => setShowNewNoteWarning(false)} style={{ fontSize:13, background:"none", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:7, padding:"8px 18px", cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{ borderTop:"0.5px solid #e5e7eb", padding:"10px 1.5rem", display:"flex", justifyContent:"center", alignItems:"center", gap:"2rem", background:"#f8fafc" }}>
        <button onClick={() => setShowAbout(true)} style={{ fontSize:12, color:"#6b7280", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>About</button>
        <span style={{ fontSize:11, color:"#d1d5db" }}>|</span>
        <span style={{ fontSize:11, color:"#9ca3af" }}>Lab Results Note Builder v9</span>
      </div>

      {/* ── MODAL: PHI Warning (first visit) ── */}
      {showPhiWarning && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:350 }}>
          <div style={{ background:"white", borderRadius:16, padding:"2rem", width:440, maxWidth:"92vw", boxShadow:"0 12px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#fef9c3", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#854d0e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:"#1e3a8a" }}>Important Privacy Notice</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>Please read before using this tool</div>
              </div>
            </div>
            <div style={{ fontSize:13, color:"#374151", lineHeight:1.7, marginBottom:20 }}>
              <p style={{ marginBottom:10 }}>This tool is <strong>not HIPAA-compliant</strong> and is not designed to store or process protected health information (PHI).</p>
              <p style={{ marginBottom:10 }}>Do <strong>not</strong> enter any patient identifiers including:</p>
              <ul style={{ paddingLeft:20, marginBottom:10 }}>
                <li>Patient names or initials</li>
                <li>Dates of birth or ages</li>
                <li>Medical record numbers (MRN)</li>
                <li>Dates of service</li>
                <li>Any other identifying information</li>
              </ul>
              <p>This tool generates <strong>template text only</strong>. All patient-specific values should be added after pasting into your EMR.</p>
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, cursor:"pointer" }}>
              <input type="checkbox" checked={phiChecked} onChange={e => setPhiChecked(e.target.checked)} style={{ width:16, height:16, accentColor:"#2563eb", flexShrink:0 }} />
              <span style={{ fontSize:13, color:"#374151" }}>I understand — I will not enter any patient identifiers</span>
            </label>
            <button disabled={!phiChecked} onClick={() => {
              setShowPhiWarning(false);
              try { localStorage.setItem("lab_phi_acknowledged","1"); } catch {}
            }} style={{ width:"100%", background: phiChecked ? "#2563eb" : "#93c5fd", color:"white", border:"none", borderRadius:8, padding:"10px", cursor: phiChecked ? "pointer" : "default", fontSize:13, fontWeight:500 }}>
              Continue to Lab Results Note Builder
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: About ── */}
      {showAbout && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}>
          <div style={{ background:"white", borderRadius:16, padding:"2rem", width:480, maxWidth:"92vw", boxShadow:"0 12px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <svg width="32" height="32" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
                  <rect width="256" height="256" rx="57" fill="#1e40af"/>
                  <path d="M100,76 L100,144 Q100,157 90,173 L64,211 Q61,217 70,217 L186,217 Q195,217 192,211 L166,173 Q156,157 156,144 L156,76" fill="none" stroke="white" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round"/>
                  <line x1="86" y1="76" x2="170" y2="76" stroke="white" strokeWidth="9" strokeLinecap="round"/>
                  <path d="M104,180 Q94,165 90,173 L64,211 L192,211 L166,173 Q162,165 152,180 Z" fill="#60a5fa" opacity="0.75"/>
                  <circle cx="128" cy="193" r="6" fill="#bfdbfe" opacity="0.85"/>
                  <circle cx="114" cy="160" r="8" fill="none" stroke="#93c5fd" strokeWidth="4"/>
                </svg>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"#1e3a8a" }}>Lab Results Note Builder</div>
                  <div style={{ fontSize:12, color:"#6b7280" }}>Version 9</div>
                </div>
              </div>
              <button onClick={() => setShowAbout(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", fontSize:20, lineHeight:1, padding:4 }}>×</button>
            </div>

            <div style={{ fontSize:13, color:"#374151", lineHeight:1.7 }}>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Developer</div>
                <div>Andrew Schechtman, M.D.</div>
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>About</div>
                <div>Lab Results Note Builder helps clinicians quickly compose patient-facing lab result messages using voice or click-based trigger phrases that generate pre-written, customizable snippets.</div>
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Does this tool use AI?</div>
                <div style={{ fontSize:12, color:"#374151", lineHeight:1.6 }}>This tool uses AI only to match spoken phrases to pre-written lab result comments. The text outputs are fixed and consistent — they are not generated by AI.</div>
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Disclaimer</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>This tool is provided as-is, without warranty of any kind. Use at your own risk. The developer makes no representations regarding the accuracy, completeness, or suitability of generated content for any clinical purpose. Users are solely responsible for reviewing and verifying all content before sending to patients. This tool is not a medical device and is not intended to replace clinical judgment.</div>
              </div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Credits</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>Built with <a href="https://claude.ai" target="_blank" rel="noreferrer" style={{ color:"#2563eb" }}>Claude</a> by Anthropic</div>
              </div>
            </div>

            <div style={{ borderTop:"1px solid #f3f4f6", paddingTop:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <a href="https://form.jotform.com/261735977946073" onClick={e => { e.preventDefault(); setShowFeedback(true); }}
                style={{ fontSize:13, color:"#2563eb", textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Report a bug, request a new feature, or contact developer
              </a>
              <button onClick={() => setShowAbout(false)} style={{ fontSize:13, background:"#2563eb", color:"white", border:"none", borderRadius:7, padding:"7px 18px", cursor:"pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Feedback / Contact form ── */}
      {showFeedback && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}>
          <div style={{ background:"white", borderRadius:16, width:"min(660px, 95vw)", display:"flex", flexDirection:"column", boxShadow:"0 12px 40px rgba(0,0,0,0.2)", overflow:"hidden", position:"relative" }}>
            <button onClick={() => setShowFeedback(false)} style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.15)", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", color:"white", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", zIndex:1 }}>×</button>
            <iframe
              id="JotFormIFrame-261735977946073"
              title="Lab Results Note Builder Feedback Form"
              onLoad={() => { if(window.parent) window.parent.scrollTo(0,0); }}
              allowTransparency="true"
              allow="geolocation; microphone; camera; fullscreen; payment"
              src="https://form.jotform.com/261735977946073"
              frameBorder="0"
              style={{ width:"100%", height:"620px", border:"none" }}
              scrolling="yes"
            />
          </div>
        </div>
      )}

      {/* ── TOUR PROMPT (first visit, only after PHI acknowledged) ── */}
      {showTourPrompt && !tourActive && !showPhiWarning && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}>
          <div style={{ background:"white", borderRadius:16, padding:"2rem", width:380, maxWidth:"92vw", boxShadow:"0 12px 40px rgba(0,0,0,0.2)", textAlign:"center" }}>
            <div style={{ width:52, height:52, borderRadius:"50%", background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1rem" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 6l-1 2H9l-1-2c-1.5-1.5-3-3.5-3-6a7 7 0 0 1 7-7z"/>
              </svg>
            </div>
            <div style={{ fontSize:16, fontWeight:600, color:"#1e3a8a", marginBottom:8 }}>Welcome to Lab Results Note Builder</div>
            <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.6, marginBottom:24 }}>Would you like a quick tour showing how to use the app? It takes about 90 seconds.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={startTour} style={{ background:"#2563eb", color:"white", border:"none", borderRadius:8, padding:"9px 22px", cursor:"pointer", fontSize:13, fontWeight:500 }}>Yes, show me around</button>
              <button onClick={dismissTourPrompt} style={{ background:"none", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:8, padding:"9px 18px", cursor:"pointer", fontSize:13 }}>Skip for now</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOUR OVERLAY ── */}
      {tourActive && (() => {
        void tourRenderTick; // consume to trigger re-render after expansion
        const step = TOUR_STEPS[tourStep];
        const targetEl = tourRefs.current[step.ref];
        const rect = targetEl ? targetEl.getBoundingClientRect() : null;
        const pad = step.inHeader ? 6 : 8;

        // For cbcSection: use normal rect (expansion tick will update it)
        // For dragHandle: normal spotlight around the row only
        let hl = null;
        if (rect) {
          hl = { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad*2, height: rect.height + pad*2 };
        }
        const ww = window.innerWidth; const wh = window.innerHeight;

        // Smart tooltip positioning
        const tipW = 300; const tipH = 210;
        let tipLeft, tipTop;

        if (step.tooltipRight && hl) {
          // Place tooltip to the right of the spotlight (step 3 - left column)
          tipLeft = Math.min(hl.left + hl.width + 16, ww - tipW - 8);
          const rawTop = hl.top;
          tipTop = Math.max(8, Math.min(rawTop, wh - tipH - 8));
        } else if (hl) {
          const belowTop = hl.top + hl.height + 12;
          const aboveTop = hl.top - tipH - 12;
          const fitsBelow = belowTop + tipH <= wh - 8;
          const fitsAbove = aboveTop >= 8;
          const rawTop = fitsBelow ? belowTop : (fitsAbove ? aboveTop : belowTop);
          tipTop = Math.max(8, Math.min(rawTop, wh - tipH - 8));
          tipLeft = Math.max(8, Math.min(hl.left, ww - tipW - 8));
        } else {
          tipLeft = ww/2 - tipW/2;
          tipTop = wh/2 - tipH/2;
        }

        const overlayColor = "rgba(0,0,0,0.52)";
        return (
          <>
            {/* Four-rectangle overlay that leaves spotlight bright */}
            {hl ? <>
              <div style={{ position:"fixed", left:0, top:0, width:"100%", height:hl.top, background:overlayColor, zIndex:399, pointerEvents:"none" }}/>
              <div style={{ position:"fixed", left:0, top:hl.top, width:hl.left, height:hl.height, background:overlayColor, zIndex:399, pointerEvents:"none" }}/>
              <div style={{ position:"fixed", left:hl.left+hl.width, top:hl.top, width:`calc(100% - ${hl.left+hl.width}px)`, height:hl.height, background:overlayColor, zIndex:399, pointerEvents:"none" }}/>
              <div style={{ position:"fixed", left:0, top:hl.top+hl.height, width:"100%", height:`calc(100% - ${hl.top+hl.height}px)`, background:overlayColor, zIndex:399, pointerEvents:"none" }}/>
              {/* Spotlight ring */}
              <div style={{ position:"fixed", left:hl.left, top:hl.top, width:hl.width, height:hl.height,
                borderRadius: step.inHeader ? 8 : 10,
                boxShadow: step.inHeader
                  ? "0 0 0 3px rgba(255,255,255,0.9), 0 0 0 5px rgba(255,255,255,0.3)"
                  : "0 0 0 3px #60a5fa, 0 0 0 5px rgba(96,165,250,0.4)",
                zIndex:400, pointerEvents:"none" }}/>
              {/* Handle arrow indicator for reorder step — sits just left of the handle dots */}
              {step.showHandleArrow && rect && (
                <div style={{
                  position:"fixed",
                  left: Math.max(4, rect.left - 72),
                  top: rect.top + rect.height/2 - 11,
                  zIndex:401, pointerEvents:"none",
                  display:"flex", alignItems:"center", gap:4
                }}>
                  <div style={{ background:"#2563eb", color:"white", fontSize:10, fontWeight:700,
                    padding:"4px 8px", borderRadius:4, whiteSpace:"nowrap" }}>grip here →</div>
                </div>
              )}
            </> : (
              <div style={{ position:"fixed", inset:0, background:overlayColor, zIndex:399, pointerEvents:"none" }}/>
            )}

            {/* Tooltip */}
            <div style={{ position:"fixed", left:tipLeft, top:tipTop, width:tipW,
              background:"white", borderRadius:12, padding:"1.25rem",
              boxShadow:"0 8px 32px rgba(0,0,0,0.22)", zIndex:401 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#1e3a8a", marginBottom:6 }}>{step.title}</div>
              <div style={{ fontSize:12, color:"#4b5563", lineHeight:1.6, marginBottom:14 }}>{step.body}</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <button onClick={tourSkip} style={{ fontSize:11, color:"#9ca3af", background:"none", border:"none", cursor:"pointer", padding:0 }}>Skip tour</button>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:11, color:"#9ca3af" }}>{tourStep + 1} / {TOUR_STEPS.length}</span>
                  {tourStep > 0 && (
                    <button onClick={tourPrev} style={{ background:"none", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:7, padding:"6px 12px", cursor:"pointer", fontSize:12 }}>← Back</button>
                  )}
                  <button onClick={tourNext} style={{ background:"#2563eb", color:"white", border:"none", borderRadius:7, padding:"6px 16px", cursor:"pointer", fontSize:12, fontWeight:500 }}>
                    {tourStep === TOUR_STEPS.length - 1 ? "Done" : "Next →"}
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing:border-box; }
        textarea:focus, input:focus { outline:none; border-color:#2563eb !important; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
        .trigger-row { position:relative; }
        .snippet-tooltip { display:none; position:absolute; left:100%; top:0; z-index:50; background:#1e3a8a; color:white; font-size:11px; line-height:1.5; padding:8px 12px; border-radius:8px; width:260px; pointer-events:none; box-shadow:0 4px 16px rgba(0,0,0,0.18); margin-left:8px; }
        .lab-row:hover .snippet-tooltip { display:block; }
        .note-bullet-row:hover .bullet-delete-btn { opacity:1 !important; }
      `}</style>
      </div>
    </div>
  );
}
