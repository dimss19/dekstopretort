<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class LicenseService
{
    protected string $licenseServerUrl;
    protected string $licenseFilePath;

    public function __construct()
    {
        $this->licenseServerUrl = config('installer.license_server_url', 'https://license.indahmesin.com/api/v1/license/verify');
        $this->licenseFilePath = storage_path('app/license.json');
    }

    /**
     * Memverifikasi Kode Perusahaan (Company Code / Purchase Code)
     *
     * @param string $companyCode
     * @param string $clientIdentifier
     * @return array
     */
    public function verifyCompanyCode(string $companyCode, string $clientIdentifier = ''): array
    {
        $cleanCode = strtoupper(trim($companyCode));

        if (empty($cleanCode)) {
            return [
                'success' => false,
                'message' => 'Kode Perusahaan / Purchase Code wajib diisi.'
            ];
        }

        // 1. Dukungan Kode Demo / Trial Lokal Siap Pakai
        $demoCodes = [
            'IM-CORP-CV-INDAH-MESIN' => [
                'company_name' => 'CV Indah Mesin',
                'license_type' => 'Lifetime Enterprise',
                'expires_at'   => 'Lifetime',
            ],
            'IM-CORP-77A1-88B2-99C3' => [
                'company_name' => 'CV Indah Mesin',
                'license_type' => 'Lifetime Enterprise',
                'expires_at'   => 'Lifetime',
            ],
            'IM-CORP-44D4-55E5-66F6' => [
                'company_name' => 'CV Indah Mesin',
                'license_type' => 'Professional Edition',
                'expires_at'   => '2027-12-31',
            ],
            'IM-DEMO-LOCAL-2026-TEST' => [
                'company_name' => 'CV Indah Mesin',
                'license_type' => 'Demo / Testing',
                'expires_at'   => '2026-12-31',
            ],
        ];

        if (array_key_exists($cleanCode, $demoCodes)) {
            $demoInfo = $demoCodes[$cleanCode];
            $licenseData = [
                'company_code' => $cleanCode,
                'company_name' => $demoInfo['company_name'],
                'license_type' => $demoInfo['license_type'],
                'expires_at'   => $demoInfo['expires_at'],
                'token'        => md5($cleanCode . '_local_verified'),
                'activated_at' => now()->toIso8601String(),
                'features'     => ['modbus_rtu', 'mqtt_cloud', 'csv_export', 'thermal_chart']
            ];

            $this->saveLicenseFile($licenseData);

            return [
                'success' => true,
                'message' => 'Kode Perusahaan terverifikasi (Lisensi Aktif)!',
                'data'    => $licenseData
            ];
        }

        // 2. Kirim permintaan verifikasi ke Central Licensing API jika online
        try {
            $payload = [
                'company_code'      => $cleanCode,
                'domain'            => request()->getHost(),
                'ip_address'        => request()->ip(),
                'client_identifier' => $clientIdentifier ?: php_uname('n'),
                'installed_at'      => now()->toIso8601String()
            ];

            $response = Http::timeout(6)->post($this->licenseServerUrl, $payload);

            if ($response->successful()) {
                $data = $response->json();

                if (!empty($data['valid']) && $data['valid'] === true) {
                    $licenseData = [
                        'company_code' => $cleanCode,
                        'company_name' => $data['company_name'] ?? 'Indah Mesin Client',
                        'license_type' => $data['license_type'] ?? 'Standard Enterprise',
                        'expires_at'   => $data['expires_at'] ?? 'Lifetime',
                        'token'        => $data['activation_token'] ?? md5($cleanCode . time()),
                        'activated_at' => now()->toIso8601String(),
                        'features'     => $data['features'] ?? []
                    ];

                    $this->saveLicenseFile($licenseData);

                    return [
                        'success' => true,
                        'message' => 'Lisensi Kode Perusahaan valid!',
                        'data'    => $licenseData
                    ];
                }

                return [
                    'success' => false,
                    'message' => $data['message'] ?? 'Kode Perusahaan tidak valid atau telah mencapai batas aktivasi.'
                ];
            }
        } catch (\Exception $e) {
            Log::warning("Gagal menghubungi server lisensi pusat: " . $e->getMessage());
        }

        return [
            'success' => false,
            'message' => 'Kode Perusahaan tidak valid atau server lisensi pusat tidak dapat dihubungi. Silakan gunakan salah satu Kode Demo yang tersedia jika sedang offline.'
        ];
    }

    /**
     * Membaca lisensi yang tersimpan di server lokal
     */
    public function getActiveLicense(): ?array
    {
        if (!File::exists($this->licenseFilePath)) {
            return null;
        }

        try {
            $content = File::get($this->licenseFilePath);
            return json_decode($content, true);
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * Menyimpan data lisensi ke storage/app/license.json
     */
    protected function saveLicenseFile(array $licenseData): void
    {
        $dir = dirname($this->licenseFilePath);
        if (!File::isDirectory($dir)) {
            File::makeDirectory($dir, 0755, true);
        }

        File::put($this->licenseFilePath, json_encode($licenseData, JSON_PRETTY_PRINT));
    }
}
