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

    public function test_two_groups_seeded(): void
    {
        $this->assertSame(2, HistoryGroup::count());
        $this->assertSame(['Group 1', 'Group 2'], HistoryGroup::orderBy('id')->pluck('name')->all());
    }
}
