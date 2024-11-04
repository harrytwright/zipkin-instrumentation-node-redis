const { Tracer, ExplicitContext, BatchRecorder } = require('zipkin')

const xpt = (expect, toNot = false) => (value, target) => {
  return (toNot ? expect(value).not.toEqual : expect(value).toEqual)(target)
}

function expectCorrectSpanData (expect) {
  return ({ span, command, multi, args, parentId, toNot = false }) => {
    // Check the end-points
    expect(span.localEndpoint.serviceName).toEqual('unknown')
    expect(span.remoteEndpoint.serviceName).toEqual('redis')

    // For the express one the command will not be correct as we use multiple commands
    command && expect(span.name).toEqual(command)

    // Check that commands share a common parent
    parentId && xpt(expect, toNot)(span.parentId, parentId)

    // For certain tests docker on docker will be used where the host is not an ipv4
    if (require('net').isIPv4(process.env.REDIS_HOST || '127.0.0.1')) expect(span.remoteEndpoint.ipv4).toEqual(process.env.REDIS_HOST || '127.0.0.1')

    // If multi is passed check the commands
    if (multi && Array.isArray(multi)) {
      expect(span.tags.commands).toEqual(JSON.stringify(multi))
    }

    // If args are to be checked
    if (args && Array.isArray(args)) {
      expect(span.tags.args).toEqual(JSON.stringify(args))
    }
  }
}

function createTracer (logSpan, ctxImpl = new ExplicitContext()) {
  const recorder = new BatchRecorder({ logger: { logSpan } })
  const tracer = new Tracer({ ctxImpl, recorder })
  tracer.setId(tracer.createRootId())

  return tracer
}

module.exports = {
  createTracer,
  expectCorrectSpanData
}
