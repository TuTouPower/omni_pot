/// <reference types="electron-vite/node" />

declare module '*.css' {
    const content: string
    export default content
}
