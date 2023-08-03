import { Tracer } from 'zipkin'
import { RedisDefaultModules } from 'redis'
import { RedisModules, RedisFunctions, RedisScripts, RedisClientOptions, RedisClientType as _RedisClientType, RedisClusterOptions, RedisClusterType as _RedisClusterType } from '@redis/client';

export default function <M extends RedisModules, F extends RedisFunctions, S extends RedisScripts>({ tracer, remoteServiceName, serviceName, listArgs }: {
    tracer: Tracer;
    remoteServiceName?: string;
    serviceName?: string;
    listArgs?: Boolean;
}): (options?: RedisClientOptions<M, F, S>) => _RedisClientType<RedisDefaultModules & M, F, S>;
