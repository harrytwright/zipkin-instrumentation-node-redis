// A rewrite of https://github.com/openzipkin/zipkin-js/blob/master/packages/zipkin-instrumentation-redis/src/zipkinClient.js
// and mixed w/ node-redis < V4

const commands = require('redis-commands')
const { Annotation, InetAddress, Tracer } = require('zipkin')
const { RedisClient, Multi, addCommand, ...redis } = require('redis')

const unifyOptions = require('redis/lib/createClient')

/* istanbul ignore next */
const noop = () => { }

const restrictedCommands = [
  'ping',
  'flushall',
  'flushdb',
  'select',
  'auth',
  'info',
  'quit',
  'slaveof',
  'config',
  'sentinel',

  // We handle this differently
  'multi'
]

/**
 * @param {Object} data
 * @param {Tracer} data.tracer - The Tracer being used
 * @param {string} [data.remoteServiceName] - The name of the remote redis service
 * @param {string} [data.serviceName] - The local service
 * @param {Boolean} [data.listArgs] - Should we list the args as tags, help w/ debugging logs
 * */
module.exports = ({ tracer, remoteServiceName = 'redis', serviceName = tracer.localEndpoint.serviceName, listArgs = false }) => {
  /**
   * Wrap the callback to call zipkin once finished
   *
   * @see https://github.com/openzipkin/zipkin-js/blob/master/packages/zipkin-instrumentation-redis/src/zipkinClient.js#L20
   *
   * @param {TraceId} id - The child tracer to be used
   * @param {Function} callback - The callback being wrapped
   * */
  function wrapper (id, callback) {
    const originalId = tracer.id
    return (...args) => {
      const error = args[0]
      tracer.letId(id, () => {
        if (error) tracer.recordBinary('error', error.message || /* istanbul ignore next */ String(error))
        tracer.recordAnnotation(new Annotation.ClientRecv())
      })
      // callback runs after the client request, so let's restore the former ID
      tracer.letId(originalId, () => {
        callback.apply(this, args)
      })
    }
  }

  // The Zipkin'd client
  class Redis extends RedisClient {
    // Add the basic annotations needed for the zipkin
    _commonAnnotations (rpc) {
      tracer.recordRpc(rpc)
      tracer.recordAnnotation(new Annotation.ServiceName(serviceName))
      tracer.recordAnnotation(new Annotation.ServerAddr({
        serviceName: remoteServiceName,
        host: new InetAddress(this.connection_options.host),
        port: this.connection_options.port
      }))
      tracer.recordAnnotation(new Annotation.ClientSend())
    }
  }

  /**
   * Replace the original addCommand so we can trace any and all commands
   *
   * @param {string} command - Command to be added
   * */
  function _addCommand (command) {
    // Check if the original clients have the command, if not then we need to add this
    // TODO: Do we need this?? Seems to be pointless with addCommand doing so already
    if (!RedisClient.prototype[command] || !Multi.prototype[command]) addCommand(command)

    // https://github.com/NodeRedis/node-redis/blob/4f85030e42da2eed6a178e54994330af5062761e/lib/commands.js#L11
    const commandName = command.replace(/(?:^([0-9])|[^a-zA-Z0-9_$])/g, '_$1')

    const prevImpl = Redis.prototype[command]
    Redis.prototype[command] = Redis.prototype[command.toUpperCase()] = function (...args) {
      // Add a noop or it seems pointless
      let callback = noop

      // Grab the last argument if it's a function
      if (typeof args[args.length - 1] === 'function') {
        callback = args.pop()
      }

      const id = tracer.createChildId()
      tracer.letId(id, () => {
        this._commonAnnotations(command)
        if (listArgs) tracer.recordBinary('args', JSON.stringify([...args]))
      })

      // Run the previous implementation of the method
      return prevImpl.apply(this, [
        ...args, wrapper(id, callback).bind(this)
      ])
    }

    // https://github.com/NodeRedis/node-redis/blob/4f85030e42da2eed6a178e54994330af5062761e/lib/commands.js#L48
    if (commandName !== command) {
      Redis.prototype[commandName.toUpperCase()] = Redis.prototype[commandName] = Redis.prototype[command]
    }
  }

  // Add the commands here
  commands.list.filter((el) => !restrictedCommands.includes(el)).forEach(_addCommand)

  // Here we work like the old instrumentation but called by exec and not `multi`
  const multiImpl = Multi.prototype.exec_transaction
  Multi.prototype.exec_transaction = function (callback) {
    const id = tracer.createChildId()
    tracer.letId(id, () => {
      this._client._commonAnnotations('multi')
      tracer.recordBinary('commands', JSON.stringify(this.queue._list.map(el => el.command).filter((el) => !!el)))
    })

    return multiImpl.apply(this, [wrapper(id, callback).bind(this)])
  }

  // Return a mock'd like version of redis to be used in it's place
  return {
    ...redis,
    createClient: function () {
      return new Redis(unifyOptions.apply(null, arguments))
    },
    addCommand: _addCommand,
    add_command: _addCommand
  }
}
