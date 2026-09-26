<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('history_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50);
            $table->string('color', 7)->default('#2563eb');
            $table->timestamps();
        });

        DB::table('history_groups')->insert([
            ['name' => 'Group 1', 'color' => '#2563eb', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Group 2', 'color' => '#059669', 'created_at' => now(), 'updated_at' => now()],
        ]);

        Schema::table('tn_process_histories', function (Blueprint $table) {
            $table->string('verification_status', 12)->default('unverified');
            $table->string('product', 100)->nullable();
            $table->string('batch_code', 50)->nullable()->unique();
            $table->string('scheduled_process', 100)->nullable();
            $table->decimal('min_f0_achieved', 8, 2)->nullable();
            $table->decimal('target_f0', 8, 2)->nullable();
            $table->string('process_deviation', 10)->nullable();
            $table->string('sterility_criterion', 10)->nullable();
            $table->string('thermal_record', 10)->nullable();
            $table->string('verified_by', 100)->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('group_id')->nullable()->constrained('history_groups')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tn_process_histories', function (Blueprint $table) {
            $table->dropForeign(['group_id']);
            $table->dropColumn(['verification_status', 'product', 'batch_code', 'scheduled_process', 'min_f0_achieved', 'target_f0', 'process_deviation', 'sterility_criterion', 'thermal_record', 'verified_by', 'verified_at', 'group_id']);
        });
        Schema::dropIfExists('history_groups');
    }
};
