import jsQR from 'jsqr'

export async function try_qr_decode(base64: string): Promise<string | null> {
    const img = new Image()
    const data = await new Promise<ImageData>((resolve, reject) => {
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) { reject(new Error('canvas')); return }
            ctx.drawImage(img, 0, 0)
            resolve(ctx.getImageData(0, 0, canvas.width, canvas.height))
        }
        img.onerror = () => { reject(new Error('image')); }
        img.src = `data:image/png;base64,${base64}`
    })
    const code = jsQR(data.data, data.width, data.height)
    return code?.data ?? null
}
