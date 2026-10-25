<?php

namespace Tests\Feature;

use App\Models\HistoryGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HistoryVerificationSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_verification_columns_exist(): void
    {
        foreach (['verification_status', 'product', 'batch_code', 'scheduled_process', 'min_f0_achieved', 'target_f0', 'process_deviation', 'sterility_criterion', 'thermal_record', 'verified_by', 'verified_at', 'group_id'] as $col) {
            $this->assertTrue(Schema::hasColumn('tn_process_histories', $col), "missing column {$col}");
        }
    }

    public function test_history_groups_table_exists(): void
    {
        $this->assertTrue(Schema::hasTable('history_groups'));
        $this->assertTrue(Schema::hasColumns('history_groups', ['id', 'name', 'color']));
    }
}
