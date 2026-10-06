<?php
namespace App\Http\Controllers;
use App\Models\TnRecipeTemplate;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class TnRecipeController extends Controller {
    public function index() { return Inertia::render('Recipe/Index', ['recipes'=>TnRecipeTemplate::with(['steps','creator:id,name','approver:id,name'])->latest()->get(), 'controllers'=>\App\Models\TnController::all()]); }
    public function create() { return Inertia::render('Recipe/Form', ['users'=>User::orderBy('name')->get(['id','name']), 'controllers'=>\App\Models\TnController::all()]); }
    public function store(Request $request) {
        $data=$this->validateRecipe($request);
        $userId = $request->user()?->id ?? \App\Models\User::first()?->id ?? 1;
        $recipe = DB::transaction(function() use($data,$request,$userId){
            $recipe=TnRecipeTemplate::create($this->template($data)+['created_by'=>$userId]);
            $recipe->steps()->createMany($this->steps($data['steps']));
            return $recipe;
        });

        $syncMsg = '';
        if ($request->boolean('sync_to_tn')) {
            $tnId = $request->input('tn_controller_id') ?? $request->input('tn_id');
            $writeRes = $this->writeRecipeToDevice($recipe, $tnId);
            if ($writeRes['success']) {
                $syncMsg = ' dan berhasil ditulis langsung ke TN Controller (' . $writeRes['controller'] . ')';
            } else {
                $syncMsg = ' (Peringatan: Gagal menulis ke TN Controller: ' . ($writeRes['error'] ?? 'Offline') . ')';
            }
        } else {
            $syncMsg = ' ke database saja';
        }

        return redirect()->route('tn.recipes.index')->with('success', 'Pattern berhasil disimpan' . $syncMsg . '.');
    }

    public function edit(TnRecipeTemplate $recipe) { return Inertia::render('Recipe/Form',['recipe'=>$recipe->load('steps'),'users'=>User::orderBy('name')->get(['id','name']), 'controllers'=>\App\Models\TnController::all()]); }

    public function update(Request $request,TnRecipeTemplate $recipe) {
        $data=$this->validateRecipe($request,$recipe);
        DB::transaction(function() use($data,$recipe){
            $recipe->update($this->template($data));
            $recipe->steps()->delete();
            $recipe->steps()->createMany($this->steps($data['steps']));
        });

        $syncMsg = '';
        if ($request->boolean('sync_to_tn')) {
            $tnId = $request->input('tn_controller_id') ?? $request->input('tn_id');
            $writeRes = $this->writeRecipeToDevice($recipe, $tnId);
            if ($writeRes['success']) {
                $syncMsg = ' dan berhasil ditulis langsung ke TN Controller (' . $writeRes['controller'] . ')';
            } else {
                $syncMsg = ' (Peringatan: Gagal menulis ke TN Controller: ' . ($writeRes['error'] ?? 'Offline') . ')';
            }
        } else {
            $syncMsg = ' ke database saja';
        }

        return redirect()->route('tn.recipes.index')->with('success', 'Pattern berhasil diperbarui' . $syncMsg . '.');
    }

    public function duplicate(Request $request,TnRecipeTemplate $recipe) {
        $userId = $request->user()?->id ?? \App\Models\User::first()?->id ?? 1;
        $copy=DB::transaction(function() use($request,$recipe,$userId){$recipe->load('steps');$copy=$recipe->replicate(['recipe_code','status','approved_by','archived_at']);$copy->recipe_code=$this->copyCode($recipe->recipe_code);$copy->name=$recipe->name.' (Copy)';$copy->revision=1;$copy->version='1.0';$copy->status='Draft';$copy->created_by=$userId;$copy->save();foreach($recipe->steps as $step)$copy->steps()->create($step->only(['step_number','step_name','target_sv','target_pressure','duration','end_action','event_link','pid_group','steam_enable','cooling_enable','drain_enable','alarm_enable','settings']));return $copy;});
        return redirect()->route('tn.recipes.edit',$copy)->with('success','Recipe duplicated as draft.');
    }
    public function archive(TnRecipeTemplate $recipe) { $recipe->update(['status'=>'Archived','archived_at'=>now()]);return back()->with('success','Recipe archived.'); }
    public function destroy(TnRecipeTemplate $recipe) { $recipe->delete();return redirect()->route('tn.recipes.index'); }
    
    public function apply(Request $request, TnRecipeTemplate $recipe, $tnId = null)
    {
        $writeRes = $this->writeRecipeToDevice($recipe, $tnId);
        if (!$writeRes['success']) {
            if ($request->wantsJson()) {
                return response()->json(['success' => false, 'error' => $writeRes['error']], 500);
            }
            return back()->with('error', 'Gagal menulis pattern ke TN Controller: ' . $writeRes['error']);
        }

        $pNum = (int)($recipe->pattern_number ?? 0);
        $msg = "Pattern '{$recipe->name}' (PTN.{$pNum}) berhasil diterapkan dan ditulis langsung ke memori Controller TN ({$writeRes['controller']}).";
        
        if ($request->wantsJson()) {
            return response()->json(['success' => true, 'message' => $msg]);
        }
        return back()->with('success', $msg);
    }

    protected function writeRecipeToDevice(TnRecipeTemplate $recipe, $tnId = null): array
    {
        $tn = null;
        if ($tnId) {
            $tn = \App\Models\TnController::find($tnId);
        }
        if (!$tn) {
            $tn = \App\Models\TnController::where('is_online', true)->first() ?? \App\Models\TnController::first();
        }

        if (!$tn) {
            return ['success' => false, 'error' => 'Tidak ada TN Controller yang terdaftar.'];
        }

        $recipe->load('steps');
        $pNum = (int)($recipe->pattern_number ?? 0);
        $machineCode = $tn->machine?->machine_code ?? 'RT-001';

        // Prepare steps array for ESP32 and Modbus registers
        $stepsPayload = [];
        foreach ($recipe->steps as $idx => $step) {
            if ($idx >= 20) break;
            $sv = (float)($step->target_sv ?? 0);
            if ($sv > 300) {
                $sv = $sv / 10.0;
            }

            $stepsPayload[] = [
                'step_number' => (int)($step->step_number ?? $idx),
                'step_name' => $step->step_name ?: ("Step " . ($idx + 1)),
                'target_sv' => $sv,
                'duration' => (int)($step->duration ?? 0),
                'end_action' => $step->end_action ?? 'CONT',
            ];
        }

        $patternData = [
            'machine_code' => $machineCode,
            'pattern_number' => $pNum,
            'time_unit' => $recipe->time_unit ?? 'MM.SS',
            'pattern_end_state' => $recipe->pattern_end_state ?? 'STOP',
            'steps' => $stepsPayload,
        ];

        // Store in cache so UI and ESP monitor immediately see it
        \Illuminate\Support\Facades\Cache::put("esp_pattern_{$machineCode}", $patternData, now()->addDays(30));

        // 1. Direct Modbus RTU write to Controller TN via TnModbusService
        $modbusSuccess = false;
        $modbusError = null;
        try {
            $modbus = app(\App\Services\TnModbusService::class);
            $pSelectRes = $modbus->writeSingleRegister($tn, 204, $pNum);
            if ($pSelectRes['success'] ?? false) {
                $endStates = ['STOP' => 0, 'HOLD' => 1, 'NEXT' => 2, 'PRE' => 3];
                $endStateVal = $endStates[$recipe->pattern_end_state] ?? 0;
                $stepCount = count($recipe->steps);
                $configValues = [
                    $recipe->time_unit === 'HH.MM' ? 1 : 0,
                    $recipe->start_condition === 'SPV' ? 1 : 0,
                    (int)($recipe->wait_width ?? 20),
                    (int)($recipe->wait_time ?? 0),
                    $pNum,
                    (int)($recipe->repetitions ?? 0),
                    $endStateVal,
                    (int)($recipe->pid_group ?? 0),
                    $stepCount,
                ];
                $modbus->writeMultipleRegisters($tn, 200, $configValues);

                $stepRegisters = array_fill(0, 40, 0);
                foreach ($recipe->steps as $idx => $step) {
                    if ($idx >= 20) break;
                    $sv = (float)($step->target_sv ?? 0);
                    if ($sv > 300) {
                        $sv = $sv / 10.0;
                    }
                    $svVal = (int)round($sv * 10);
                    $stepRegisters[$idx * 2] = $svVal;
                    $stepRegisters[($idx * 2) + 1] = (int)($step->duration ?? 0);
                }
                $writeStepsRes = $modbus->writeMultipleRegisters($tn, 209, $stepRegisters);
                if ($writeStepsRes['success'] ?? true) {
                    $modbusSuccess = true;
                }
            } else {
                $modbusError = $pSelectRes['error'] ?? 'Gagal memilih pattern pada controller';
            }
        } catch (\Throwable $e) {
            $modbusError = $e->getMessage();
            \Illuminate\Support\Facades\Log::warning("Direct Modbus write failed for {$machineCode}: " . $e->getMessage());
        }

        if ($modbusSuccess) {
            return [
                'success' => true,
                'controller' => $tn->name,
                'message' => "Pattern '{$recipe->name}' (PTN.{$pNum}) berhasil ditulis langsung ke controller {$tn->name} via Modbus RTU.",
            ];
        }

        // 2. Secondary fallback: Dispatch via MQTT to ESP32
        $mqttPublished = false;
        try {
            $device = \App\Models\Device::where('machine_code', $machineCode)->first() ?? (object)['machine_code' => $machineCode];
            $mqttService = app(\App\Services\MqttService::class);
            $mqttPublished = $mqttService->publishPattern($device, $patternData);
        } catch (\Throwable $e) {
            // MQTT service not available or not running
        }

        if ($mqttPublished) {
            return [
                'success' => true,
                'controller' => $tn->name,
                'message' => "Pattern berhasil dikirim ke ESP32 ({$machineCode}) untuk ditulis ke Controller TN.",
            ];
        }

        return [
            'success' => false,
            'error' => $modbusError ?: 'Gagal menulis pattern ke TN Controller (periksa koneksi RS-485 Modbus).',
        ];
    }

    public function scanFromDevice(Request $request, $tnId)
    {
        $tn = \App\Models\TnController::findOrFail($tnId);
        $modbus = app(\App\Services\TnModbusService::class);
        
        // Read pattern config (400201-400209) -> offset 200-208
        $configResult = $modbus->readHoldingRegisters($tn, 200, 9);
        if (!$configResult['success']) {
            return response()->json(['error' => 'Failed to read config: ' . $configResult['error']], 500);
        }

        // Read pattern steps (400210-400249) -> offset 209-248 (40 registers)
        $stepsResult = $modbus->readHoldingRegisters($tn, 209, 40);
        if (!$stepsResult['success']) {
            return response()->json(['error' => 'Failed to read steps: ' . $stepsResult['error']], 500);
        }

        $configData = $configResult['data'];
        $stepsData = $stepsResult['data'];

        $pattern = [
            'time_unit' => $configData[0] == 0 ? 'MM.SS' : 'HH.MM',
            'start_condition' => $configData[1] == 0 ? 'SSV' : 'SPV',
            'wait_width' => $configData[2] ?? 0,
            'wait_time' => $configData[3] ?? 0,
            'pattern_number' => $configData[4] ?? 0,
            'repetitions' => $configData[5] ?? 0,
            'pattern_end_state' => ['STOP', 'HOLD', 'NEXT', 'PRE'][$configData[6] ?? 0] ?? 'STOP',
            'pid_group' => $configData[7] ?? 0,
            'step_count' => $configData[8] ?? 0,
            'steps' => []
        ];

        for ($i = 0; $i < 20; $i++) {
            $pattern['steps'][] = [
                'target_sv' => $stepsData[$i * 2] ?? 0,
                'duration' => $stepsData[($i * 2) + 1] ?? 0,
                'step_name' => 'Step ' . ($i + 1),
            ];
        }

        return response()->json($pattern);
    }

    public function scanAllPatterns(Request $request)
    {
        $targetTnId = $request->input('tn_id');
        $tn = null;
        if ($targetTnId) {
            $tn = \App\Models\TnController::find($targetTnId);
        }
        if (!$tn) {
            $tn = \App\Models\TnController::where('is_online', true)->first() 
                ?? \App\Models\TnController::first();
        }

        if (!$tn) {
            $msg = 'Tidak ada controller TN yang terdaftar.';
            return $request->wantsJson() 
                ? response()->json(['error' => $msg], 404)
                : back()->with('error', $msg);
        }

        $modbus = app(\App\Services\TnModbusService::class);

        // 1. Check RUN/STOP state and ensure STOP mode so pattern registers are writable
        $wasRunning = false;
        $runResult = $modbus->readHoldingRegisters($tn, 0, 1);
        if ($runResult['success'] && isset($runResult['data'][0]) && $runResult['data'][0] === 0) { // 0 = RUN, 1 = STOP
            $wasRunning = true;
            $stopRes = $modbus->writeSingleCoil($tn, 0, true);
            if (!($stopRes['success'] ?? false)) {
                $modbus->writeSingleRegister($tn, 0, 1);
            }
            usleep(150000); // 150ms settle
        }

        // 2. Read Current Pattern Number
        $patternResult = $modbus->readHoldingRegisters($tn, 204, 1);
        $originalPatternNum = ($patternResult['success'] && isset($patternResult['data'][0])) 
            ? $patternResult['data'][0] 
            : 0;

        $userId = $request->user()?->id ?? \App\Models\User::first()?->id ?? 1;
        $scannedCount = 0;
        $identicalCount = 0;
        $newCount = 0;
        $updatedCount = 0;
        
        // 3. Loop 0 to 9
        for ($p = 0; $p < 10; $p++) {
            // Write pattern number
            $writeResult = $modbus->writeSingleRegister($tn, 204, $p);
            if (!$writeResult['success']) continue;
            
            // Read config
            $configResult = $modbus->readHoldingRegisters($tn, 200, 9);
            if (!$configResult['success']) continue;
            
            // Read steps
            $stepsResult = $modbus->readHoldingRegisters($tn, 209, 40);
            if (!$stepsResult['success']) continue;
            
            $configData = $configResult['data'];
            $stepsData = $stepsResult['data'];
            
            $stepCount = (int)($configData[8] ?? 0);
            
            // Also check if any step has duration > 0 in case stepCount register is 0 but steps exist
            if ($stepCount === 0) {
                for ($checkIdx = 0; $checkIdx < 20; $checkIdx++) {
                    if (($stepsData[($checkIdx * 2) + 1] ?? 0) > 0) {
                        $stepCount = max($stepCount, $checkIdx + 1);
                    }
                }
            }
            
            // Only save/compare if there are actual steps
            if ($stepCount > 0) {
                $recipeCode = 'P' . $p . '-TN' . $tn->id;
                $existing = TnRecipeTemplate::with('steps')
                    ->where(function($q) use ($recipeCode, $p, $tn) {
                        $q->where('recipe_code', $recipeCode)
                          ->orWhere(function($q2) use ($p, $tn) {
                              $q2->where('pattern_number', $p)
                                 ->where('process_parameters->scanned_from', $tn->id);
                          });
                    })->first();

                $scannedTimeUnit = ($configData[0] ?? 0) == 0 ? 'MM.SS' : 'HH.MM';
                $scannedStartCond = ($configData[1] ?? 0) == 0 ? 'SSV' : 'SPV';
                $scannedWaitWidth = (int)($configData[2] ?? 0);
                $scannedWaitTime = (int)($configData[3] ?? 0);
                $scannedRepetitions = (int)($configData[5] ?? 0);
                $scannedEndState = ['STOP', 'HOLD', 'NEXT', 'PRE'][$configData[6] ?? 0] ?? 'STOP';
                $scannedPidGroup = (int)($configData[7] ?? 0);

                $isIdentical = false;
                if ($existing) {
                    $configMatches = (
                        $existing->time_unit === $scannedTimeUnit &&
                        $existing->start_condition === $scannedStartCond &&
                        (int)$existing->wait_width === $scannedWaitWidth &&
                        (int)$existing->wait_time === $scannedWaitTime &&
                        (int)$existing->repetitions === $scannedRepetitions &&
                        $existing->pattern_end_state === $scannedEndState &&
                        (int)$existing->pid_group === $scannedPidGroup &&
                        (int)($existing->step_count ?? $existing->steps->count()) === (int)$stepCount &&
                        $existing->steps->count() === $stepCount
                    );

                    if ($configMatches) {
                        $stepsMatch = true;
                        $sortedSteps = $existing->steps->sortBy('step_number')->values();
                        for ($i = 0; $i < $stepCount; $i++) {
                            $curStep = $sortedSteps[$i] ?? null;
                            if (!$curStep) {
                                $stepsMatch = false;
                                break;
                            }
                            $scannedSv = (int)($stepsData[$i * 2] ?? 0);
                            $scannedDur = (int)($stepsData[($i * 2) + 1] ?? 0);

                            if ((int)$curStep->target_sv !== $scannedSv || (int)$curStep->duration !== $scannedDur) {
                                $stepsMatch = false;
                                break;
                            }
                        }
                        $isIdentical = $stepsMatch;
                    }
                }

                if ($isIdentical) {
                    $identicalCount++;
                } else {
                    if ($existing) {
                        $updatedCount++;
                    } else {
                        $newCount++;
                    }

                    DB::transaction(function() use ($p, $configData, $stepsData, $stepCount, $tn, $userId, $recipeCode, $scannedTimeUnit, $scannedStartCond, $scannedWaitWidth, $scannedWaitTime, $scannedRepetitions, $scannedEndState, $scannedPidGroup) {
                        $template = TnRecipeTemplate::updateOrCreate(
                            ['recipe_code' => $recipeCode],
                            [
                                'name' => 'Pattern ' . $p . ($tn->name && strtolower(trim($tn->name)) !== 'asa' ? ' (' . $tn->name . ')' : ''),
                                'status' => 'Draft',
                                'version' => '1.0',
                                'revision' => 1,
                                'created_by' => $userId,
                                'time_unit' => $scannedTimeUnit,
                                'start_condition' => $scannedStartCond,
                                'wait_width' => $scannedWaitWidth,
                                'wait_time' => $scannedWaitTime,
                                'pattern_number' => $p,
                                'repetitions' => $scannedRepetitions,
                                'pattern_end_state' => $scannedEndState,
                                'pid_group' => $scannedPidGroup,
                                'step_count' => $stepCount,
                                'process_parameters' => ['scanned_from' => $tn->id]
                            ]
                        );
                        
                        $template->steps()->delete();
                        for ($i = 0; $i < $stepCount; $i++) {
                            $template->steps()->create([
                                'step_number' => $i + 1,
                                'step_name' => 'Step ' . ($i + 1),
                                'target_sv' => $stepsData[$i * 2] ?? 0,
                                'duration' => $stepsData[($i * 2) + 1] ?? 0,
                            ]);
                        }
                    });
                }
                $scannedCount++;
            }
        }

        // 4. Restore original pattern number and RUN state if it was running
        $modbus->writeSingleRegister($tn, 204, $originalPatternNum);
        if ($wasRunning) {
            $modbus->writeSingleCoil($tn, 0, false);
        }

        $allIdentical = ($scannedCount > 0 && $identicalCount === $scannedCount);

        $scanResult = [
            'all_identical' => $allIdentical,
            'total_count' => $scannedCount,
            'identical_count' => $identicalCount,
            'new_count' => $newCount,
            'updated_count' => $updatedCount,
            'controller_name' => $tn->name,
        ];

        if ($allIdentical) {
            $msg = "Semua pattern sudah berhasil di load.";
        } else {
            $parts = [];
            if ($newCount > 0) $parts[] = "{$newCount} baru ditambahkan";
            if ($updatedCount > 0) $parts[] = "{$updatedCount} diperbarui";
            if ($identicalCount > 0) $parts[] = "{$identicalCount} identik";
            $msg = "Berhasil memindai {$scannedCount} pattern dari Controller {$tn->name} (" . implode(', ', $parts) . ").";
        }

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'all_identical' => $allIdentical,
                'message' => $msg,
                'count' => $scannedCount,
                'scan_result' => $scanResult,
            ]);
        }

        return redirect()->route('tn.recipes.index')->with([
            'success' => $msg,
            'all_identical' => $allIdentical,
            'scan_result' => $scanResult,
        ]);
    }

    private function validateRecipe(Request $r,?TnRecipeTemplate $recipe=null):array{return $r->validate([
        'recipe_code'=>['required','string','max:80',Rule::unique('tn_recipe_templates')->ignore($recipe)],'name'=>['required','string','max:255'],'product_name'=>['required','string','max:255'],'product_category'=>['nullable','string','max:100'],'package_type'=>['nullable','string','max:100'],'package_size'=>['nullable','string','max:100'],'description'=>['nullable','string'],'revision'=>['required','integer','min:1'],'version'=>['required','string','max:30'],'status'=>['required',Rule::in(['Draft','Active','Inactive','Archived'])],'approved_by'=>['nullable','exists:users,id'],'process_parameters'=>['required','array'],'tn_config'=>['nullable','array'],'time_unit'=>['required',Rule::in(['MM.SS','HH.MM'])],'start_condition'=>['required',Rule::in(['SSV','SPV'])],'pattern_end_state'=>['required',Rule::in(['STOP','HOLD','NEXT','PRE'])],'pattern_number'=>['required','integer','min:0','max:9'],'repetitions'=>['required','integer','min:0'],'pid_group'=>['required','integer','min:0','max:7'],'wait_width'=>['required','integer','min:0'],'wait_time'=>['required','integer','min:0'],'steps'=>['required','array','min:1','max:50'],'steps.*.step_name'=>['required','string','max:100'],'steps.*.target_sv'=>['required','integer','min:-1999','max:9999'],'steps.*.duration'=>['required','integer','min:0','max:9999'],'steps.*.end_action'=>['nullable',Rule::in(['CONT','HOLD','STOP'])],'steps.*.event_link'=>['nullable','integer','min:0','max:9'],'steps.*.pid_group'=>['nullable','integer','min:0','max:7'],'steps.*.target_pressure'=>['nullable','numeric','min:0','max:99'],'steps.*.steam_enable'=>['boolean'],'steps.*.cooling_enable'=>['boolean'],'steps.*.drain_enable'=>['boolean'],'steps.*.alarm_enable'=>['boolean']]);}
    private function template(array $d):array{return collect($d)->only(['recipe_code','name','product_name','product_category','package_type','package_size','description','revision','version','status','approved_by','process_parameters','tn_config','time_unit','start_condition','pattern_end_state','pattern_number','repetitions','pid_group','wait_width','wait_time'])->all()+['step_count'=>count($d['steps'])];}
    private function steps(array $steps):array{return array_map(fn($s,$i)=>['step_number'=>$i+1]+$s,$steps,array_keys($steps));}
    private function copyCode(string $code):string{$base=$code.'-COPY';$candidate=$base;$i=1;while(TnRecipeTemplate::where('recipe_code',$candidate)->exists())$candidate=$base.'-'.$i++;return $candidate;}
}
