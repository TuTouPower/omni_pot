/**
 * 服务实例配置访问工具
 */

import type { ServiceConfig } from './types/service'
import type { ServiceInstancesMap } from './types/config'

/**
 * 从服务实例映射中获取指定实例的配置
 * @param service_instances - 服务实例映射
 * @param instance_key - 实例 key
 * @returns 服务配置，若不存在返回空对象
 */
export function get_service_config(
    service_instances: ServiceInstancesMap,
    instance_key: string
): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}
