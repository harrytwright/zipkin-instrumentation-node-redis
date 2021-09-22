const { Tracer, ExplicitContext, BatchRecorder } = require('zipkin');

const xpt = (expect, toNot = false) => (value, target) => {
  return (toNot ? expect(value).to.not : expect(value).to).be.equal(target)
}

function expectCorrectSpanData (expect) {
  return ({ span, command, multi, args, parentId, toNot = false }) => {
    // Check the end-points
    expect(span.localEndpoint.serviceName).to.equal('unknown');
    expect(span.remoteEndpoint.serviceName).to.equal('redis');

    // For the express one the command will not be correct as we use multiple commands
    command && expect(span.name).to.equal(command);

    // Check that commands share a common parent
    parentId && xpt(expect, toNot)(span.parentId, parentId)

    // For certain tests docker on docker will be used where the host is not an ipv4
    if (require('net').isIPv4(process.env.REDIS_HOST || '127.0.0.1')) expect(span.remoteEndpoint.ipv4).to.equal(process.env.REDIS_HOST || '127.0.0.1');

    // If multi is passed check the commands
    if (multi && Array.isArray(multi)) {
      expect(span.tags.commands).to.be.eq(JSON.stringify(multi))
    }

    // If args are to be checked
    if (args && Array.isArray(args)) {
      expect(span.tags.args).to.be.eq(JSON.stringify(args))
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
