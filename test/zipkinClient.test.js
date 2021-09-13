const chai = require('chai')
const sinon = require('sinon');
const { Tracer, ExplicitContext, BatchRecorder } = require('zipkin');

const zipkinClient = require('../src/zipkinClient');

const expect = chai.expect

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
}

function redis (tracer) {
  return zipkinClient({ tracer })
}

function expectCorrectSpanData(span, command, multi) {
  expect(span.name).to.equal(command);
  expect(span.localEndpoint.serviceName).to.equal('unknown');
  expect(span.remoteEndpoint.serviceName).to.equal('redis');
  expect(span.remoteEndpoint.ipv4).to.equal(redisOptions.host);

  if (!!multi && Array.isArray(multi)) {
    expect(span.tags.commands).to.be.eq(JSON.stringify(multi))
  }
}

function createTracer (logSpan) {
  const ctxImpl = new ExplicitContext();
  const recorder = new BatchRecorder({ logger: { logSpan } });
  const tracer = new Tracer({ctxImpl, recorder});
  tracer.setId(tracer.createRootId());

  return tracer
}

describe('redis', function () {
  let client;

  afterEach(() => {
    if (!!client) client.unref()
  })

  it('should add zipkin annotations', function (done) {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)

    client = redis(tracer).createClient(redisOptions)
    client.on('connect', () => {
      client.set('test:redis:add.zipkin', 'Hello World', (err, result) => {
        if (err) return expect.fail(err.message)

        expect(result).to.be.equal('OK')

        const spans = logSpan.args.map(arg => arg[0]);
        expect(spans).to.have.length(1)
        spans.forEach((span) => expectCorrectSpanData(span, 'set'))

        done()
      })
    })
  });

  it('should handle redis errors', function (done) {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)

    client = redis(tracer).createClient(redisOptions)
    client.on('connect', () => {
      client.expire('test:redis:error.zipkin', 'NaN', (err, result) => {
        expect(err).to.not.be.undefined

        const spans = logSpan.args.map(arg => arg[0]);
        expect(spans).to.have.length(1)
        spans.forEach((span) => expectCorrectSpanData(span, 'expire'))

        done()
      })
    })
  });

  it('should handle custom commands', function (done) {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)
    const rds = redis(tracer)

    ;['json.get', 'json.set'].forEach(function (aCmd) {
      rds.addCommand(aCmd)
    })

    client = rds.createClient(redisOptions)
    client.on('connect', () => {
      client.json_set('test:redis:json.zipkin', '.', JSON.stringify({ hello: 'world' }), (err, result) => {
        if (err) return expect.fail(err.message)

        expect(result).to.be.equal('OK')

        const spans = logSpan.args.map(arg => arg[0]);
        expect(spans).to.have.length(1)
        spans.forEach((span) => expectCorrectSpanData(span, 'json.set'))

        done()
      })
    })
  });

  it('should handle multi', function (done) {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)

    client = redis(tracer).createClient(redisOptions)
    client.on('connect', () => {
      const multi = client.multi()
      multi.set('test:redis:multi.zipkin', 'Hello World')
      multi.expire('test:redis:multi.zipkin', (60 * 60 * 24 * 7))
      multi.ttl('test:redis:multi.zipkin')

      multi.exec((err, results) => {
        if (err) return expect.fail(err.message)

        expect(results).to.be.length(3)

        const spans = logSpan.args.map(arg => arg[0]);
        expect(spans).to.have.length(1)
        spans.forEach((span) => expectCorrectSpanData(span, 'multi', ['set', 'expire', 'ttl']))

        done()
      })
    })
  });
});
