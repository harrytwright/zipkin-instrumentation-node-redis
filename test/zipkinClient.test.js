const chai = require('chai')
const sinon = require('sinon');

const zipkinClient = require('../src/zipkinClient');

const { createTracer, expectCorrectSpanData } = require('./utils/tracer')

const expect = chai.expect

const socketOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
}

function redis (tracer, options) {
  return zipkinClient({ tracer, ...options })
}

describe('redis', function () {
  describe('client', function () {

    let client;

    afterEach(async () => {
      if (!!client) {
        await client.flushDb()
        await client.quit()
      }
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
      spans.forEach((span) => expectCorrectSpanData(expect)({ span, command: 'set' }))
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

      spans.forEach((span) => expectCorrectSpanData(expect)({
        args: ['test:redis:client:add.args', 'Hello World'],
        command: 'set',
        span
      }))
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

        spans.forEach((span) => expectCorrectSpanData(expect)({
          command: 'json.invalid_command',
          span
        }))
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

      spans.forEach((span) => expectCorrectSpanData(expect)({
        multi: ['set', 'expire', 'ttl'],
        command: 'multi',
        span
      }))
    });

  });

  describe('gh0005', function () {
    let client;

    afterEach(async () => {
      if (!!client) {
        await client.flushDb()
        await client.quit()
      }
    })

    it('should handle ping', async () => {
      const logSpan = sinon.spy();

      const tracer = createTracer(logSpan)

      client = redis(tracer, { listArgs: true })({ socket: socketOptions })
      await client.connect()

      const result = await client.ping()

      expect(result).to.be.equal('PONG')

      const spans = logSpan.args.map(arg => arg[0]);
      expect(spans).to.have.length(1)
      spans.forEach((span) => expectCorrectSpanData(expect)({ span, command: 'ping' }))
    });

    it('should not throw on hset', async () => {
      const logSpan = sinon.spy();

      const tracer = createTracer(logSpan)

      client = redis(tracer)({ socket: socketOptions })
      await client.connect()

      const result = await client.hSet('test:redis:client:hset:add.zipkin', 'Hello World', 1)

      expect(result).to.be.equal(1)

      const spans = logSpan.args.map(arg => arg[0]);
      expect(spans).to.have.length(1)
      spans.forEach((span) => expectCorrectSpanData(expect)({ span, command: 'hset' }))
    });
  });
});

