### Task 1: Migration verifikasi + group + model

**Files:**
- Create: `database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php`
- Create: `app/Models/HistoryGroup.php`
- Modify: `app/Models/TnProcessHistory.php`
- Test: `tests/Feature/HistoryVerificationSchemaTest.php`

**Interfaces:**
- Consumes: tabel `tn_process_histories` existing (kolom `end_time` nullable, `log_data` nullable).
- Produces: kolom verifikasi + relasi `TnProcessHistory::group()` dan `HistoryGroup::histories()` untuk Task 3, 6, 7.

- [ ] **Step 1: Write the failing test**

```php
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=HistoryVerificationSchemaTest`
Expected: FAIL (class HistoryGroup not found / columns missing)

- [ ] **Step 3: Write migration**

```php
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
```

- [ ] **Step 4: Write model + casts**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HistoryGroup extends Model
{
    use HasFactory;

    protected $guarded = [];

    public function histories()
    {
        return $this->hasMany(TnProcessHistory::class, 'group_id');
    }
}
```

Di `TnProcessHistory.php`, tambah ke `$casts`:

```php
'verification_status' => 'string',
'min_f0_achieved' => 'decimal:2',
'target_f0' => 'decimal:2',
'verified_at' => 'datetime',
```

dan relasi:

```php
public function group()
{
    return $this->belongsTo(HistoryGroup::class, 'group_id');
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=HistoryVerificationSchemaTest`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add database/migrations/2026_09_26_000001_add_verification_to_tn_process_histories.php app/Models/HistoryGroup.php app/Models/TnProcessHistory.php tests/Feature/HistoryVerificationSchemaTest.php
git commit -m "feat: migration verifikasi history + history_groups seed 2 baris"
```

---


