<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DesktopLoginTest extends TestCase
{
    /**
     * Test bahwa root URL mengarahkan pengunjung tanpa sesi langsung ke /login
     */
    public function test_guest_is_redirected_to_login(): void
    {
        $response = $this->get('/');

        $response->assertRedirect(route('login'));
    }

    /**
     * Test bahwa user default (admin@scada.local) dapat login dan masuk ke dashboard
     */
    public function test_default_admin_can_login_and_enter_dashboard(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@scada.local'],
            [
                'name' => 'Admin Operator',
                'password' => Hash::make('password123'),
            ]
        );

        $response = $this->post('/login', [
            'email' => 'admin@scada.local',
            'password' => 'password123',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));

        // Test bahwa dashboard dapat diakses dengan sukses (HTTP 200)
        $dashboardResponse = $this->get('/dashboard');
        $dashboardResponse->assertStatus(200);
    }

    /**
     * Test bahwa user alternatif (admin@admin.com) juga dapat login dan masuk dashboard
     */
    public function test_super_admin_can_login_and_enter_dashboard(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@admin.com'],
            [
                'name' => 'Super Administrator',
                'password' => Hash::make('password'),
            ]
        );

        $response = $this->post('/login', [
            'email' => 'admin@admin.com',
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));

        $dashboardResponse = $this->get('/dashboard');
        $dashboardResponse->assertStatus(200);
    }

    /**
     * Test bahwa user yang baru dibuat melalui proses inisialisasi tersimpan dan bisa langsung login
     */
    public function test_user_created_via_setup_can_login_immediately(): void
    {
        $email = 'supervisor@indahmesin.com';
        $password = 'rahasia123';

        $setupResponse = $this->post(route('installer.process-setup'), [
            'admin_name' => 'Supervisor Pabrik',
            'admin_email' => $email,
            'admin_password' => $password,
            'admin_password_confirmation' => $password,
        ]);

        $setupResponse->assertRedirect(route('installer.license'));

        // Pastikan user tersimpan di database
        $this->assertDatabaseHas('users', [
            'email' => $email,
            'name' => 'Supervisor Pabrik',
        ]);

        // Login menggunakan akun yang baru saja dibuat
        $loginResponse = $this->post('/login', [
            'email' => $email,
            'password' => $password,
        ]);

        $this->assertAuthenticated();
        $loginResponse->assertRedirect(route('dashboard', absolute: false));

        $dashboardResponse = $this->get('/dashboard');
        $dashboardResponse->assertStatus(200);
    }
}
