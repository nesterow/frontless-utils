const riot = require('riot')
const xss = require('xss')
const {assign, debounce} = require('lodash')
const hydrate = require('@riotjs/hydrate')
const EventBus = require('eventbusjs')
const Turbolinks = require('turbolinks')
Turbolinks.start()

function SSMV(component) {

    component.onServerState = function (response) {
      this.state = assign(this.state, response.target.result.data)
      this.update()
    }.bind(component)
  
    const onMounted = component.onMounted || function () {}.bind(component)
    const eventName = (component.id || component.name) + ':update'
  
    component.onMounted = function (props, state) {
      EventBus.removeEventListener(eventName, component.onServerState.bind(this), component)
      EventBus.addEventListener(eventName, component.onServerState.bind(this), component)
      if (component.onRendered) {
        setTimeout(component.onRendered.bind(component))
      }
      return onMounted.bind(this)(props, state)
    }.bind(component);
}

riot.install(SSMV)

module.exports = function ({ components, before, after }) {

    before(components);

    const initialize = () => {
 
  
        components.forEach((tag) => {
          
          const component = tag.module.default
          
          if (component.exports) {
      
            let initilaExports = typeof component.exports === 'function' ? component.exports() : component.exports;
            
            component.exports = () => {
              const STATE = JSON.parse(
                xss.filterXSS(document.getElementById('state').innerText)
              )
            
              const ATTRS = JSON.parse(
                xss.filterXSS(document.getElementById('attributes').innerText)
              )
              initilaExports.state = STATE [initilaExports.id || component.name] || initilaExports.state;
              const attributes = ATTRS [initilaExports.id || component.name]
              if (attributes) attributes.map((attr) => {
                initilaExports[attr.name] = attr.data
              })
              return initilaExports
            }
          }
          try { 
            riot.register(component.name, component)
          } catch(e) {}
        })
      
        const root = document.querySelector('section[is]')
        if (root) {
          document.body.classList.add('disabled')
          const ComponentImplementation = components.find((tag) => tag.module.default.name === root.getAttribute('is') )
          const component = ComponentImplementation.module.default;
          
          if (typeof component.exports === 'function')
            component.exports = component.exports();
          
          const hydrated = component.exports.onHydrated || function() {};
          component.exports.onHydrated = function() {
            hydrated.apply(this, arguments)
            after()
          }.bind(component.exports)
          
          hydrate(component)(root)
          after()
          setTimeout(() => document.body.classList.remove('disabled'))
        }
      
      }
      window.initialize = initialize;
      document.addEventListener('turbolinks:load', () => {
        const fromCache = !!document.body.getAttribute('from-cache')
        if (!fromCache) {
          initialize();
        }
      });
      
      document.addEventListener('hmr:updated', () => setTimeout(() => location.reload(), 1800))

}