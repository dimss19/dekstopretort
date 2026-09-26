1a8426e fix: required pada semua field form verifikasi
diff --git a/resources/js/Components/History/ProcessDetailView.tsx b/resources/js/Components/History/ProcessDetailView.tsx
index fdd9819..ca1f355 100644
--- a/resources/js/Components/History/ProcessDetailView.tsx
+++ b/resources/js/Components/History/ProcessDetailView.tsx
@@ -1109,36 +1109,36 @@ export default function ProcessDetailView({ batch, onBack, groups = [] }: Props)
                         <label className="block text-xs font-bold text-slate-700">
                             Minimum F0
                             <input type="number" required step="0.01" min="0" value={minF0} onChange={(e) => setMinF0(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3" />
                         </label>
                         <label className="block text-xs font-bold text-slate-700">
                             Target F0
                             <input type="number" required step="0.01" min="0" value={targetF0} onChange={(e) => setTargetF0(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3" />
                         </label>
                         <label className="block text-xs font-bold text-slate-700">
                             Process deviation
-                            <select value={deviation} onChange={(e) => setDeviation(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3">
+                            <select required value={deviation} onChange={(e) => setDeviation(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3">
                                 <option value="None">None</option>
                                 <option value="Minor">Minor</option>
                                 <option value="Major">Major</option>
                             </select>
                         </label>
                         <label className="block text-xs font-bold text-slate-700">
                             Sterility criterion
-                            <select value={effectiveCriterion} disabled={liveFail} onChange={(e) => setCriterion(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3 disabled:opacity-60">
+                            <select required value={effectiveCriterion} disabled={liveFail} onChange={(e) => setCriterion(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3 disabled:opacity-60">
                                 <option value="PASS">PASS</option>
                                 <option value="FAIL">FAIL</option>
                             </select>
                         </label>
                         <label className="block text-xs font-bold text-slate-700">
                             Thermal record
-                            <select value={thermal} onChange={(e) => setThermal(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3">
+                            <select required value={thermal} onChange={(e) => setThermal(e.target.value)} className="mt-1 w-full rounded-xl border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3">
                                 <option value="VERIFIED">VERIFIED</option>
                                 <option value="REJECTED">REJECTED</option>
                             </select>
                         </label>
                         {liveFail && (
                             <p className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                                 F0 sistem di bawah Target F0 ΓÇö Sterility criterion terkunci FAIL.
                             </p>
                         )}
                         <div className="sm:col-span-2 flex justify-end">
