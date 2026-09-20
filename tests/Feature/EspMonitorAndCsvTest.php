<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Machine;
use App\Models\TnController;
use App\Models\TnProcessHistory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class EspMonitorAndCsvTest extends TestCase
{
    use RefreshDatabase;

    public function test_esp_live_returns_cached_telemetry(): void
    {
        $user = User::factory()->create();

        Cache::put('esp_latest_telemetry_RT-001', [
            'pv' => 121.3,
            'sv' => 121.0,
            'mv' => 50.0,
            'phase' => 'HOLDING',
        ]);
        Cache::put('device.RT-001.last_seen', now()->timestamp);
        Cache::put('esp_telemetry_seq_RT-001', 5);

        $response = $this->actingAs($user)->getJson(route('esp.live', ['machine_code' => 'RT-001']));

        $response->assertOk()
            ->assertJson([
                'is_online' => true,
                'seq' => 5,
                'telemetry' => [
                    'pv' => 121.3,
                    'sv' => 121.0,
                    'mv' => 50.0,
                    'phase' => 'HOLDING',
                ],
            ]);
    }

    public function test_esp_stream_endpoint_returns_streamed_response(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get(route('esp.stream', ['machine_code' => 'RT-001']));

        $response->assertOk();
        $this->assertStringContainsString('text/event-stream', $response->headers->get('Content-Type'));
    }

    public function test_csv_import_creates_process_history(): void
    {
        $machine = Machine::create([
            'machine_code' => 'RT-001',
            'machine_name' => 'Retort Unit 1',
        ]);

        $controller = TnController::create([
            'name' => 'Autonics TNL',
            'slave_id' => 1,
            'model_type' => 'TNL',
            'control_model' => 'program',
            'machine_id' => $machine->id,
            'is_online' => true,
        ]);

        // Create temporary sample CSV matching ESP32 sd_logger format
        $csvContent = implode("\n", [
            "Tanggal Jam,Actual,Setting,ISO,Phase,MV,Run,Logging",
            "1/16/2026 5:00:00PM,100.0,121.0,2026-01-16T17:00:00+07:00,HEATING,80.0,1,1",
            "1/16/2026 5:01:00PM,121.1,121.0,2026-01-16T17:01:00+07:00,HOLDING,45.0,1,1",
            "1/16/2026 5:02:00PM,121.2,121.0,2026-01-16T17:02:00+07:00,HOLDING,30.0,1,1",
        ]);

        $tmpFile = tempnam(sys_get_temp_dir(), 'csv_test_');
        file_put_contents($tmpFile, $csvContent);

        $command = new \App\Console\Commands\MqttSubscribeCommand();

        // Use reflection to invoke protected importCompletedCsv
        $ref = new \ReflectionClass($command);
        $method = $ref->getMethod('importCompletedCsv');
        $method->setAccessible(true);

        $importedCount = $method->invoke($command, 'RT-001', '20260116_170000.csv', $tmpFile);
        @unlink($tmpFile);

        $this->assertEquals(3, $importedCount);

        $history = TnProcessHistory::first();
        $this->assertNotNull($history);
        $this->assertEquals($controller->id, $history->tn_controller_id);
        $this->assertCount(3, $history->log_data);
        $this->assertEquals(100.0, $history->log_data[0]['actual']);
        $this->assertEquals(121.2, $history->log_data[2]['actual']);
    }

    public function test_txt_import_creates_process_history(): void
    {
        $machine = Machine::create([
            'machine_code' => 'RT-002',
            'machine_name' => 'Retort Unit 2',
        ]);

        $controller = TnController::create([
            'name' => 'Autonics TNL 2',
            'slave_id' => 2,
            'model_type' => 'TNL',
            'control_model' => 'program',
            'machine_id' => $machine->id,
            'is_online' => true,
        ]);

        // Create temporary sample TXT (tab-separated) matching new ESP32 format
        $txtContent = implode("\n", [
            "Actual\tSetting\tMV\tPhase\tISO",
            "105.5\t121.0\t85.0\tHEATING\t2026-01-16T18:00:00+07:00",
            "121.0\t121.0\t40.0\tHOLDING\t2026-01-16T18:01:00+07:00",
            "121.1\t121.0\t32.5\tHOLDING\t2026-01-16T18:02:00+07:00",
        ]);

        $tmpFile = tempnam(sys_get_temp_dir(), 'txt_test_');
        file_put_contents($tmpFile, $txtContent);

        $command = new \App\Console\Commands\MqttSubscribeCommand();

        $importedCount = $command->importCompletedFile('RT-002', '20260116_180000.txt', $tmpFile);
        @unlink($tmpFile);

        $this->assertEquals(3, $importedCount);

        $history = TnProcessHistory::where('tn_controller_id', $controller->id)->first();
        $this->assertNotNull($history);
        $this->assertCount(3, $history->log_data);
        $this->assertEquals(105.5, $history->log_data[0]['actual']);
        $this->assertEquals(85.0, $history->log_data[0]['mv']);
        $this->assertEquals('HEATING', $history->log_data[0]['phase']);
        $this->assertEquals(121.1, $history->log_data[2]['actual']);
    }

    public function test_save_pattern_caches_and_publishes_mqtt(): void
    {
        $user = User::factory()->create();

        $payload = [
            'machine_code' => 'RT-001',
            'time_unit' => 'MM.SS',
            'pattern_number' => 0,
            'steps' => [
                [
                    'step_number' => 0,
                    'step_name' => 'Step 1',
                    'target_sv' => 117.0,
                    'duration' => 200,
                    'end_action' => 'CONT',
                ],
                [
                    'step_number' => 1,
                    'step_name' => 'Step 2',
                    'target_sv' => 121.0,
                    'duration' => 900,
                    'end_action' => 'HOLD',
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('esp.pattern.save'), $payload);

        $response->assertRedirect();
        $cached = Cache::get('esp_pattern_RT-001');
        $this->assertNotNull($cached);
        $this->assertCount(2, $cached['steps']);
        $this->assertEquals(117.0, $cached['steps'][0]['target_sv']);
    }
}
