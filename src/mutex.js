const EventEmitter = require('events');

const ee = new EventEmitter();
ee.setMaxListeners(0);

module.exports = {
    locked: false,
    lock: ({document, Node}) =>
      new Promise(resolve => {

        if (!this.locked) {
          this.locked = true;
          global.document = document;
          global.Node = Node;
          return resolve();
        }
        
        const tryAcquire = () => {
          if (!this.locked) {
            global.document = document;
            global.Node = Node;
            this.locked = true;
            ee.removeListener('release', tryAcquire);
            return resolve();
          }
        };
        
        ee.on('release', tryAcquire);
      }),

    release: () => {
      this.locked = false;
      setImmediate(() => ee.emit('release'));
      return global.document
    },

  };