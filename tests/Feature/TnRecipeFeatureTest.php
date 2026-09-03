<?php

namespace Tests\Feature;

use App\Models\TnRecipeTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TnRecipeFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_recipe_with_full_tn_config_and_step_controls(): void
    {
        $user = User::factory()->create();

        $payload = [
            'recipe_code' => 'STERIL-121C',
            'name' => 'Retort Sterilization 121C',
            'product_name' => 'Canned Tuna 150g',
            'product_category' => 'Fish',
            'package_type' => 'Pouch',
            'package_size' => '150g',
            'description' => 'Sterilization profile at 121C for 15 mins',
            'revision' => 1,
            'version' => '1.0',
            'status' => 'Active',
            'time_unit' => 'MM.SS',
            'start_condition' => 'SSV',
            'pattern_end_state' => 'STOP',
            'pattern_number' => 0,
            'repetitions' => 0,
            'pid_group' => 0,
            'wait_width' => 2,
            'wait_time' => 0,
            'process_parameters' => ['type' => 'retort'],
            'tn_config' => [
                'IN' => ['IN-T' => 'KCaH', 'UNIT' => '℃', 'IN-b' => 0],
                'CNTL' => ['O-FT' => 'HEAT', 'C-MD' => 'PID', 'oUt1' => 'SSR'],
                'PIdC' => ['H-P' => 10.0, 'H-I' => 240, 'H-d' => 49],
                'ALM' => ['AL1' => ['AL.Md' => 'PV-H', 'AL.H' => 130]],
            ],
            'steps' => [
                [
                    'step_name' => 'Venting',
                    'target_sv' => 100,
                    'duration' => 300,
                    'end_action' => 'CONT',
                    'event_link' => null,
                    'pid_group' => null,
                ],
                [
                    'step_name' => 'Sterilisasi Hold',
                    'target_sv' => 121,
                    'duration' => 900,
                    'end_action' => 'HOLD',
                    'event_link' => 1,
                    'pid_group' => 0,
                ],
                [
                    'step_name' => 'Cooling',
                    'target_sv' => 40,
                    'duration' => 600,
                    'end_action' => 'STOP',
                    'event_link' => null,
                    'pid_group' => null,
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('tn.recipes.store'), $payload);

        $response->assertRedirect(route('tn.recipes.index'));

        $this->assertDatabaseHas('tn_recipe_templates', [
            'recipe_code' => 'STERIL-121C',
            'name' => 'Retort Sterilization 121C',
            'step_count' => 3,
        ]);

        $template = TnRecipeTemplate::where('recipe_code', 'STERIL-121C')->first();
        $this->assertNotNull($template);
        $this->assertIsArray($template->tn_config);
        $this->assertEquals('KCaH', $template->tn_config['IN']['IN-T']);

        $steps = $template->steps;
        $this->assertCount(3, $steps);
        $this->assertEquals('HOLD', $steps[1]->end_action);
        $this->assertEquals(1, $steps[1]->event_link);
        $this->assertEquals(121, $steps[1]->target_sv);
    }

    public function test_can_save_recipe_to_database_only_without_syncing(): void
    {
        $user = User::factory()->create();

        $payload = [
            'recipe_code' => 'DB-ONLY-01',
            'name' => 'Database Only Recipe',
            'product_name' => 'Test Product',
            'revision' => 1,
            'version' => '1.0',
            'status' => 'Draft',
            'time_unit' => 'MM.SS',
            'start_condition' => 'SSV',
            'pattern_end_state' => 'STOP',
            'pattern_number' => 0,
            'repetitions' => 0,
            'pid_group' => 0,
            'wait_width' => 2,
            'wait_time' => 0,
            'process_parameters' => ['type' => 'retort'],
            'sync_to_tn' => false,
            'steps' => [
                [
                    'step_number' => 1,
                    'step_name' => 'Step 1',
                    'target_sv' => 100,
                    'duration' => 60,
                    'end_action' => 'STOP',
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('tn.recipes.store'), $payload);
        $response->assertRedirect(route('tn.recipes.index'));
        $response->assertSessionHas('success', 'Pattern berhasil disimpan ke database saja.');

        $this->assertDatabaseHas('tn_recipe_templates', [
            'recipe_code' => 'DB-ONLY-01',
        ]);
    }

    public function test_can_apply_recipe_directly_to_tn_via_apply_endpoint(): void
    {
        $user = User::factory()->create();

        \App\Models\TnController::create([
            'name' => 'Autonics TNL',
            'slave_id' => 1,
            'model_type' => 'TNL',
            'control_model' => 'program',
            'is_online' => true,
        ]);

        $recipe = TnRecipeTemplate::create([
            'recipe_code' => 'APPLY-TN-01',
            'name' => 'Apply Direct Pattern',
            'product_name' => 'Product 1',
            'revision' => 1,
            'version' => '1.0',
            'status' => 'Draft',
            'time_unit' => 'MM.SS',
            'start_condition' => 'SSV',
            'pattern_end_state' => 'STOP',
            'pattern_number' => 0,
            'repetitions' => 0,
            'pid_group' => 0,
            'wait_width' => 2,
            'wait_time' => 0,
            'step_count' => 1,
            'process_parameters' => ['type' => 'retort'],
            'created_by' => $user->id,
        ]);
        $recipe->steps()->create([
            'step_number' => 1,
            'step_name' => 'Sterilizing',
            'target_sv' => 121,
            'duration' => 900,
            'end_action' => 'HOLD',
        ]);

        $response = $this->actingAs($user)->post(route('tn.recipes.apply', $recipe->id));
        $response->assertRedirect();
        $response->assertSessionHas('success');
    }
}
