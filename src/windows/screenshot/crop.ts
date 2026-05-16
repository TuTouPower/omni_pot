export interface Rect {
    x: number
    y: number
    width: number
    height: number
}

export interface Size {
    width: number
    height: number
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

export function map_cover_rect_to_image_rect(css_rect: Rect, container: Size, image: Size): Rect {
    const scale = Math.max(container.width / image.width, container.height / image.height)
    const rendered_width = image.width * scale
    const rendered_height = image.height * scale
    const offset_x = (container.width - rendered_width) / 2
    const offset_y = (container.height - rendered_height) / 2

    const x = clamp((css_rect.x - offset_x) / scale, 0, image.width)
    const y = clamp((css_rect.y - offset_y) / scale, 0, image.height)
    const right = clamp((css_rect.x + css_rect.width - offset_x) / scale, 0, image.width)
    const bottom = clamp((css_rect.y + css_rect.height - offset_y) / scale, 0, image.height)

    return {
        x: Math.floor(x),
        y: Math.floor(y),
        width: Math.max(1, Math.ceil(right) - Math.floor(x)),
        height: Math.max(1, Math.ceil(bottom) - Math.floor(y)),
    }
}
