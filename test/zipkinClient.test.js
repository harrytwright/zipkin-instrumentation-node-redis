const chai = require('chai')
const sinon = require('sinon');
const { Tracer, ExplicitContext, BatchRecorder } = require('zipkin');

const zipkinClient = require('../src/zipkinClient');

const expect = chai.expect

const socketOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
}

function redis (tracer, options) {
  return zipkinClient({ tracer, ...options })
}

function expectCorrectSpanData(span, command, extras = { }) {
  expect(span.name).to.equal(command);
  expect(span.localEndpoint.serviceName).to.equal('unknown');
  expect(span.remoteEndpoint.serviceName).to.equal('redis');

  // For certain tests docker on docker will be used where the host is not an ipv4
  if (require('net').isIPv4(socketOptions.host)) expect(span.remoteEndpoint.ipv4).to.equal(socketOptions.host);

  if (('multi' in extras) && Array.isArray(extras.multi)) {
    expect(span.tags.commands).to.be.eq(JSON.stringify(extras.multi))
  }

  if ('args' in extras && Array.isArray(extras.args)) {
    expect(span.tags.args).to.be.eq(JSON.stringify(extras.args))
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
  describe('client', function () {

    let client;

    afterEach(async () => {
      if (!!client) await client.quit()
    })

    it('should add zipkin annotations', async function () {
      const logSpan = sinon.spy();

      const tracer = createTracer(logSpan)

      client = redis(tracer)({ socket: socketOptions })
      await client.connect()

      const result = await client.set('test:redis:client:add.zipkin', 'Hello World')

      expect(result).to.be.equal('OK')

      const spans = logSpan.args.map(arg => arg[0]);
      expect(spans).to.have.length(1)
      spans.forEach((span) => expectCorrectSpanData(span, 'set'))
    });

    it('should send args if requested', async function () {
      const logSpan = sinon.spy();

      const tracer = createTracer(logSpan)

      client = redis(tracer, { listArgs: true })({ socket: socketOptions })
      await client.connect()

      const result = await client.set('test:redis:client:add.args', 'Hello World')

      expect(result).to.be.equal('OK')

      const spans = logSpan.args.map(arg => arg[0]);
      expect(spans).to.have.length(1)
      spans.forEach((span) => expectCorrectSpanData(span, 'set', { args: ['test:redis:client:add.args', 'Hello World'] }))
    });

    it('should handle redis errors', async function () {
      const logSpan = sinon.spy();

      const tracer = createTracer(logSpan)

      client = redis(tracer)({ socket: socketOptions })
      await client.connect()

      try {
        const result = await client.sendCommand(['JSON.INVALID_COMMAND', 'test:redis:error.zipkin'])
        expect.fail(`${result} should never be called`)
      } catch (err) {
        expect(err).to.not.be.undefined

        const spans = logSpan.args.map(arg => arg[0]);
        expect(spans).to.have.length(1)
        spans.forEach((span) => expectCorrectSpanData(span, 'json.invalid_command'))
      }
    });
  });

  describe('multi', function () {

    let client;

    afterEach(async () => {
      if (!!client) await client.quit()
    })

    it('should handle multi', async function () {
      const logSpan = sinon.spy();

      const tracer = createTracer(logSpan)

      client = redis(tracer, { listArgs: true })({ socket: socketOptions })
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
});

