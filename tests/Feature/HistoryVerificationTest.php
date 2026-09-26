<?php

namespace Tests\Feature;

use App\Models\HistoryGroup;
use App\Models\Machine;
use App\Models\TnController;
use App\Models\TnProcessHistory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HistoryVerificationTest extends TestCase
{
    use RefreshDatabase;

    private static int $historySeq = 0;

    private function makeHistory(bool $finished = true): TnProcessHistory
    {
        // ponytail: counter agar machine_code/slave_id unik saat dipanggil 2x dalam satu test.
        self::$historySeq++;
        $machine = Machine::create(['machine_code' => 'RT-9'.self::$historySeq, 'machine_name' => 'Retort '.self::$historySeq]);
        $tn = TnController::create([
            'machine_id' => $machine->id,
            'name' => 'TN-'.self::$historySeq,
            'slave_id' => 100 + self::$historySeq,
            'model_type' => 'TNH',
            'control_model' => 'fixed',
        ]);
        $logs = array_map(
            fn ($i) => ['pv' => 121.1, 'decimal_point' => 0, 'sv' => 121.1, 'heating_mv' => 650, 'created_at' => now()->addSeconds($i)->toIso8601String()],
            range(0, 59)
        );

        return TnProcessHistory::create([
            'tn_controller_id' => $tn->id,
            'start_time' => now()->subHour(),
            'end_time' => $finished ? now() : null,
            'log_data' => $logs,
        ]);
    }

    private function payload(array $over = []): array
    {
        return array_merge([
            'product' => 'Rendang pouch 250 g',
            'batch_code' => '20260926-01',
            'scheduled_process' => '121.1C / 25 min',
            'min_f0_achieved' => 1.0,
            'target_f0' => 0.5,
            'process_deviation' => 'None',
            'sterility_criterion' => 'PASS',
            'thermal_record' => 'VERIFIED',
            'group_id' => HistoryGroup::orderBy('id')->first()->id,
        ], $over);
    }

    public function test_verify_finished_history(): void
    {
        $user = User::factory()->create(['name' => 'Operator 1']);
        $history = $this->makeHistory();

        $res = $this->actingAs($user)->postJson(route('tn.history.verify', $history), $this->payload());

        $res->assertOk()->assertJson(['success' => true, 'system_f0' => 1.0]);
        $this->assertDatabaseHas('tn_process_histories', [
            'id' => $history->id,
            'verification_status' => 'verified',
            'verified_by' => 'Operator 1',
        ]);
    }

    public function test_system_f0_below_target_forces_fail(): void
    {
        $user = User::factory()->create();
        $history = $this->makeHistory();

        $res = $this->actingAs($user)->postJson(route('tn.history.verify', $history), $this->payload([
            'batch_code' => '20260926-02',
            'target_f0' => 99.0,
        ]));

        $res->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('tn_process_histories', ['id' => $history->id, 'sterility_criterion' => 'FAIL']);
    }

    public function test_verify_running_or_twice_returns_422(): void
    {
        $user = User::factory()->create();
        $running = $this->makeHistory(false);

        $this->actingAs($user)->postJson(route('tn.history.verify', $running), $this->payload())
            ->assertStatus(422);

        $done = $this->makeHistory();
        $this->actingAs($user)->postJson(route('tn.history.verify', $done), $this->payload(['batch_code' => 'X-1']));
        $this->actingAs($user)->postJson(route('tn.history.verify', $done), $this->payload(['batch_code' => 'X-2']))
            ->assertStatus(422);
    }

    public function test_rename_group_and_reject_bad_color(): void
    {
        $user = User::factory()->create();
        $group = HistoryGroup::orderBy('id')->first();

        $this->actingAs($user)->putJson(route('tn.history-groups.update', $group), ['name' => 'Rendang', 'color' => '#b45309'])
            ->assertOk();
        $this->assertDatabaseHas('history_groups', ['id' => $group->id, 'name' => 'Rendang']);

        $this->actingAs($user)->putJson(route('tn.history-groups.update', $group), ['name' => 'X', 'color' => 'red'])
            ->assertStatus(422);
    }
}
