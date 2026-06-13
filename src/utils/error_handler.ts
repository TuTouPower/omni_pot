/**
 * 统一的错误处理工具
 */

import { create_logger } from './logger'

const loggers = new Map<string, ReturnType<typeof create_logger>>()

function get_logger(scope: string): ReturnType<typeof create_logger> {
    let logger = loggers.get(scope)
    if (!logger) {
        logger = create_logger(scope)
        loggers.set(scope, logger)
    }
    return logger
}

/**
 * 记录错误日志
 * @param scope - 作用域（模块名）
 * @param action - 操作描述
 * @param err - 错误对象
 */
export function log_error(scope: string, action: string, err: unknown): void {
    const logger = get_logger(scope)
    logger.error('%s failed: %s', action, err instanceof Error ? err.message : String(err))
}
