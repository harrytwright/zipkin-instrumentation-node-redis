import { Tracer } from 'zipkin'
import RedisClient, { RedisClientOptions } from 'redis/dist/lib/client'

declare function _exports({ tracer, remoteServiceName, serviceName }: {
    tracer: Tracer;
    remoteServiceName?: string;
    serviceName?: string;
}): createClient;

export type createClient = (options?: RedisClientOptions) => RedisClient;

export default _exports;
