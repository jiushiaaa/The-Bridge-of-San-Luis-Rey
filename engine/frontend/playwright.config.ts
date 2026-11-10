import { defineConfig } from '@playwright/test';

// 横屏桌面浏览器；使用系统 Chrome（playwright 浏览器在本机网络下无法下载）
export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
  },
});
