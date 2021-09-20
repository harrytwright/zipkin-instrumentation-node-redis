import { Tracer } from 'zipkin'
import { RedisClient, ClientOpts } from 'redis'

declare function _exports({ tracer, remoteServiceName, serviceName, listArgs }: {
	tracer: Tracer;
	remoteServiceName?: string;
	serviceName?: string;
	listArgs?: Boolean;
}): ZipkinClient;

export interface ZipkinClient {
	RedisClient: RedisClient;

	addCommand(command: string): void;
	add_command(command: string): void;

	createClient(unix_socket: String, options?: ClientOpts): RedisClient;
	createClient(redis_url: String, options?: ClientOpts): RedisClient;
	createClient(port: Number, host?: String, options?: ClientOpts): RedisClient;
	createClient(options?: ClientOpts): RedisClient;
}

export default _exports;
