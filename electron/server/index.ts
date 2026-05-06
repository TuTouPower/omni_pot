import http from 'http'
import { getConfig, getAllConfig } from '../config/store'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'

const TRANSLATE_OPTS = {
    label: WindowLabel.TRANSLATE,
    width: 350,
    height: 420
}

let server: http.Server | null = null

export function startServer(mgr: WindowManager): void {
    if (server) return

    const port = getConfig('server_port') as number

    server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
            res.writeHead(204)
            res.end()
            return
        }

        const url = new URL(req.url ?? '/', `http://localhost:${port}`)

        if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/translate')) {
            handleTranslate(mgr, req, res)
            return
        }

        if (req.method === 'POST' && url.pathname === '/recognize') {
            res.writeHead(200)
            res.end(JSON.stringify({ success: true, message: 'recognize stub' }))
            return
        }

        if (req.method === 'GET' && url.pathname === '/config') {
            res.writeHead(200)
            res.end(JSON.stringify(getAllConfig()))
            return
        }

        if (req.method === 'GET' && url.pathname === '/history') {
            res.writeHead(200)
            res.end(JSON.stringify({ success: true, message: 'history stub', data: [] }))
            return
        }

        res.writeHead(404)
        res.end(JSON.stringify({ success: false, error: 'not found' }))
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
            server = null
        }
    })

    server.listen(port, '127.0.0.1')
}

export function stopServer(): void {
    if (server) {
        server.close()
        server = null
    }
}

function handleTranslate(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8').trim()
        if (!text) {
            res.writeHead(400)
            res.end(JSON.stringify({ success: false, error: 'empty body' }))
            return
        }

        const win = mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
        win.webContents.send('translate:from-api', text)

        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
    })
}
