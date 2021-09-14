const chai = require('chai')
const sinon = require('sinon');
const { Tracer, ExplicitContext, BatchRecorder } = require('zipkin');

const zipkinClient = require('../src/zipkinClient');

const expect = chai.expect

const socketOptions = {
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

  // For certain tests docker on docker will be used where the host is not an ipv4
  if (require('net').isIPv4(socketOptions.host)) expect(span.remoteEndpoint.ipv4).to.equal(socketOptions.host);

  if (!!multi && Array.isArray(multi)) {
    expect(span.tags.commands).to.be.eq(JSON.stringify(multi))
  }
}

function createTracer (logSpan) {
  const ctxImpl = new ExplicitContext();
  const recorder = new BatchRecorder({ logger: { logSpan } });
  const tracer = new Tracer({ ctxImpl, recorder });
  tracer.setId(tracer.createRootId());

  return tracer
}

describe('redis', function () {
  let client;

  afterEach(async () => {
    if (!!client) await client.quit()
  })

  it('should add zipkin annotations', async function () {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)

    client = redis(tracer)({ socket: socketOptions })
    await client.connect()

    const result = await client.set('test:redis:add.zipkin', 'Hello World')

    expect(result).to.be.equal('OK')

    const spans = logSpan.args.map(arg => arg[0]);
    expect(spans).to.have.length(1)
    spans.forEach((span) => expectCorrectSpanData(span, 'set'))
  });

  // This is annoying since i'm not sure how to trigger an error that also gets me a response
  xit('should handle redis errors', async function () {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)

    client = redis(tracer)({ socket: socketOptions })
    await client.connect()

    try {
      const result = await client.get('test:redis:error.zipkin')
      expect.fail(`${result} should never be called`)
    } catch (err) {
      console.log(err)
      expect(err).to.not.be.undefined

      const spans = logSpan.args.map(arg => arg[0]);
      expect(spans).to.have.length(1)
      spans.forEach((span) => expectCorrectSpanData(span, 'get'))
    }
  });

  it('should handle custom commands', async function () {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)

    client = redis(tracer)({ socket: socketOptions })
    await client.connect()

    const result = await client.sendCommand(['JSON.SET', 'test:redis:json.zipkin', '.', JSON.stringify({ hello: 'world' })])

    expect(result).to.be.equal('OK')

    const spans = logSpan.args.map(arg => arg[0]);
    expect(spans).to.have.length(1)
    spans.forEach((span) => expectCorrectSpanData(span, 'json.set'))
  });

  it('should handle multi', async function () {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)

    client = redis(tracer)({ socket: socketOptions })
    await client.connect()

    const multi = client.multi()
    multi.set('test:redis:multi.zipkin', 'Hello World')
    multi.expire('test:redis:multi.zipkin', (60 * 60 * 24 * 7))
    multi.ttl('test:redis:multi.zipkin')

    const results = await multi.exec()

    expect(results).to.be.length(3)

    const spans = logSpan.args.map(arg => arg[0]);
    expect(spans).to.have.length(1)
    spans.forEach((span) => expectCorrectSpanData(span, 'multi', ['set', 'expire', 'ttl']))
  });
});
