import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { join } from 'path';

export default defineConfig({
    main: {
        build: {
            rollupOptions: {
                plugins: [
                    {
                        name: 'watch-external',
                        buildStart() {
                            const appRoot = process.env.APP_PATH || join(import.meta.dirname, '..', '..');
                            this.addWatchFile(
                                join(appRoot, 'app', 'Providers', 'NativeAppServiceProvider.php'),
                            );
                        },
                    },
                ],
            },
        },
        plugins: [externalizeDepsPlugin()],
    },
});
