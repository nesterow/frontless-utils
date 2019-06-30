const EventEmitter = require('events');

let locked = false;
const ee = new EventEmitter();
ee.setMaxListeners(0);

module.exports = {

    lock: ({document, Node}) =>
      new Promise(resolve => {

        if (!locked) {
          locked = true;
          global.document = document;
          global.Node = Node;
          return resolve();
        }
        
        const tryAcquire = () => {
          if (locked) {
            global.document = null;
            global.Node = null;
            ee.removeListener(key, tryAcquire);
            return resolve();
          }
        };
        
        ee.on('release', tryAcquire);
      }),

    release: () => {
      locked = false;
      setImmediate(() => ee.emit('release'));
    },

  };