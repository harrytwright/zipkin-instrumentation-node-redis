import createZipkin from '../src/zipkinClient'
import { Tracer, ExplicitContext, ConsoleRecorder } from 'zipkin'

(async () => {
    const tracer = new Tracer({
        ctxImpl: new ExplicitContext(),
        recorder: new ConsoleRecorder(),
        localServiceName: 'ts.types'
    })

    const createClient = createZipkin({
        tracer
    })

    const client = createClient({
        socket: {
            port: parseInt(process.env.REDIS_PORT || '6380'),
            host: process.env.REDIS_HOST
        }
    })

    await client.connect();

    const results = await client.set('key', 'value')
    console.assert(results === 'OK')

    await client.quit()
})()
