987557d feat: migration verifikasi history + history_groups seed 2 baris
 app/Models/HistoryGroup.php                        | 18 ++++++++
 app/Models/TnProcessHistory.php                    |  9 ++++
 ...01_add_verification_to_tn_process_histories.php | 48 ++++++++++++++++++++++
 tests/Feature/HistoryVerificationSchemaTest.php    | 26 ++++++++++++
 4 files changed, 101 insertions(+)
diff --git a/app/Models/HistoryGroup.php b/app/Models/HistoryGroup.php
new file mode 100644
index 0000000..b8e0ef7
--- /dev/null
+++ b/app/Models/HistoryGroup.php
@@ -0,0 +1,18 @@
+<?php
+
+namespace App\Models;
+
+use Illuminate\Database\Eloquent\Factories\HasFactory;
+use Illuminate\Database\Eloquent\Model;
+
+class HistoryGroup extends Model
+{
+    use HasFactory;
+
+    protected $guarded = [];
+
+    public function histories()
+    {
+        return $this->hasMany(TnProcessHistory::class, 'group_id');
+    }
+}
diff --git a/app/Models/TnProcessHistory.php b/app/Models/TnProcessHistory.php
index d6ff955..fd40757 100644
--- a/app/Models/TnProcessHistory.php
+++ b/app/Models/TnProcessHistory.php
@@ -8,17 +8,26 @@
 class TnProcessHistory extends Model
 {
     use HasFactory;
 
     protected $guarded = [];
 
     protected $casts = [
         'start_time' => 'datetime',
         'end_time' => 'datetime',
         'log_data' => 'array',
+        'verification_status' => 'string',
+        'min_f0_achieved' => 'decimal:2',
+        'target_f0' => 'decimal:2',
+        'verified_at' => 'datetime',
     ];
 
+    public function group()
+    {
+        return $this->belongsTo(HistoryGroup::class, 'group_id');
+    }
+
     public function controller()
     {
         return $this->belongsTo(TnController::class, 'tn_controller_id');
     }
 }
diff --git a/database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php b/database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php
new file mode 100644
index 0000000..8b5c586
--- /dev/null
+++ b/database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php
@@ -0,0 +1,48 @@
+<?php
+
+use Illuminate\Database\Migrations\Migration;
+use Illuminate\Database\Schema\Blueprint;
+use Illuminate\Support\Facades\DB;
+use Illuminate\Support\Facades\Schema;
+
+return new class extends Migration
+{
+    public function up(): void
+    {
+        Schema::create('history_groups', function (Blueprint $table) {
+            $table->id();
+            $table->string('name', 50);
+            $table->string('color', 7)->default('#2563eb');
+            $table->timestamps();
+        });
+
+        DB::table('history_groups')->insert([
+            ['name' => 'Group 1', 'color' => '#2563eb', 'created_at' => now(), 'updated_at' => now()],
+            ['name' => 'Group 2', 'color' => '#059669', 'created_at' => now(), 'updated_at' => now()],
+        ]);
+
+        Schema::table('tn_process_histories', function (Blueprint $table) {
+            $table->string('verification_status', 12)->default('unverified');
+            $table->string('product', 100)->nullable();
+            $table->string('batch_code', 50)->nullable()->unique();
+            $table->string('scheduled_process', 100)->nullable();
+            $table->decimal('min_f0_achieved', 8, 2)->nullable();
+            $table->decimal('target_f0', 8, 2)->nullable();
+            $table->string('process_deviation', 10)->nullable();
+            $table->string('sterility_criterion', 10)->nullable();
+            $table->string('thermal_record', 10)->nullable();
+            $table->string('verified_by', 100)->nullable();
+            $table->timestamp('verified_at')->nullable();
+            $table->foreignId('group_id')->nullable()->constrained('history_groups')->nullOnDelete();
+        });
+    }
+
+    public function down(): void
+    {
+        Schema::table('tn_process_histories', function (Blueprint $table) {
+            $table->dropForeign(['group_id']);
+            $table->dropColumn(['verification_status', 'product', 'batch_code', 'scheduled_process', 'min_f0_achieved', 'target_f0', 'process_deviation', 'sterility_criterion', 'thermal_record', 'verified_by', 'verified_at', 'group_id']);
+        });
+        Schema::dropIfExists('history_groups');
+    }
+};
diff --git a/tests/Feature/HistoryVerificationSchemaTest.php b/tests/Feature/HistoryVerificationSchemaTest.php
new file mode 100644
index 0000000..276fff3
--- /dev/null
+++ b/tests/Feature/HistoryVerificationSchemaTest.php
@@ -0,0 +1,26 @@
+<?php
+
+namespace Tests\Feature;
+
+use App\Models\HistoryGroup;
+use Illuminate\Foundation\Testing\RefreshDatabase;
+use Illuminate\Support\Facades\Schema;
+use Tests\TestCase;
+
+class HistoryVerificationSchemaTest extends TestCase
+{
+    use RefreshDatabase;
+
+    public function test_verification_columns_exist(): void
+    {
+        foreach (['verification_status', 'product', 'batch_code', 'scheduled_process', 'min_f0_achieved', 'target_f0', 'process_deviation', 'sterility_criterion', 'thermal_record', 'verified_by', 'verified_at', 'group_id'] as $col) {
+            $this->assertTrue(Schema::hasColumn('tn_process_histories', $col), "missing column {$col}");
+        }
+    }
+
+    public function test_two_groups_seeded(): void
+    {
+        $this->assertSame(2, HistoryGroup::count());
+        $this->assertSame(['Group 1', 'Group 2'], HistoryGroup::orderBy('id')->pluck('name')->all());
+    }
+}
