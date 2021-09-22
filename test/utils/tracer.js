const { Tracer, ExplicitContext, BatchRecorder } = require('zipkin');

function expectCorrectSpanData (expect) {
  return function ({ span, command, multi, parentId }) {
    expect(span.localEndpoint.serviceName).to.equal('unknown');
    expect(span.remoteEndpoint.serviceName).to.equal('redis');

    // For the express one the command will not be correct as we use multiple commands
    command && expect(span.name).to.equal(command);

    // Check that commands share a common parent
    parentId && expect(span.parentId).to.equal(parentId)

    // For certain tests docker on docker will be used where the host is not an ipv4
    if (require('net').isIPv4(process.env.REDIS_HOST || '127.0.0.1')) expect(span.remoteEndpoint.ipv4).to.equal(process.env.REDIS_HOST || '127.0.0.1');

    if (!!multi && Array.isArray(multi)) {
      expect(span.tags.commands).to.be.eq(JSON.stringify(multi))
    }
  }
}

function createTracer (logSpan, ctxImpl = new ExplicitContext()) {
  const recorder = new BatchRecorder({ logger: { logSpan } });
  const tracer = new Tracer({ctxImpl, recorder});
  tracer.setId(tracer.createRootId());

  return tracer
}

module.exports = {
  createTracer,
  expectCorrectSpanData
}
