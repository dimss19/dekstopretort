<?php

namespace App\Providers;

use Native\Desktop\Facades\Window;
use Native\Desktop\Facades\Menu;
use Native\Desktop\Contracts\ProvidesPhpIni;

class NativeAppServiceProvider implements ProvidesPhpIni
{
    /**
     * Executed once the native application has been booted.
     * Use this method to open windows, register global shortcuts, etc.
     */
    public function boot(): void
    {
        Menu::default();

        Window::open()
            ->title('SCADA Retort - PT Indah Mesin')
            ->width(1400)
            ->height(900)
            ->minWidth(1024)
            ->minHeight(768)
            ->rememberState();
    }

    /**
     * Return an array of php.ini directives to be set.
     */
    public function phpIni(): array
    {
        return [
            'memory_limit' => '512M',
            'max_execution_time' => '300',
            'date.timezone' => 'Asia/Jakarta',
            'upload_max_filesize' => '64M',
            'post_max_size' => '64M',
        ];
    }
}
