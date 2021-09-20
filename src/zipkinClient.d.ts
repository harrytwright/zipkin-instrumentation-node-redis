import { Tracer } from 'zipkin'
import RedisClient, { RedisClientOptions, RedisClientType } from 'redis/dist/lib/client'
import { RedisModules } from "redis/dist/lib/commands";
import { RedisLuaScripts } from "redis/dist/lib/lua-script";

declare function _exports({ tracer, remoteServiceName, serviceName, listArgs }: {
    tracer: Tracer;
    remoteServiceName?: string;
    serviceName?: string;
    listArgs?: Boolean;
}): createClient;

export type createClient = <M extends RedisModules, S extends RedisLuaScripts>(options?: RedisClientOptions<M, S>) => RedisClientType<M, S>;

export default _exports;
// <M extends RedisModules, S extends RedisLuaScripts>(options?: RedisClientOptions<M, S>): RedisClientType<M, S>
