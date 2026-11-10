/// <reference types="vite/client" />

// 以 ?raw 方式内联游戏数据 JSON，避免 tsc 为巨型字面量推导类型
declare module '*.json?raw' {
  const content: string;
  export default content;
}
