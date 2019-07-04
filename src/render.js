const riot = require('@frontless/riot')
const {SheetsRegistry} = require('jss')
const xss = require("xss")
const mutex = require('./mutex')
const {JSDOM} = require('jsdom')
/** 
 * Render a riot tag.
 * This method resolves all `fetch()` operations including components children
 * @return {Promise<{output: String, state: Object, layout: string}>}
 * */
module.exports = async function renderAsync(tagName, component, props, SHARED_ATTRS) {
    
  const {document, Node} = (new JSDOM('<!doctype html><html><head>' +
  '</head><body></body></html>').window);
  mutex.lock({document, Node})

  const cleanup = (R) => {
    document.__GLOBAL = {}
    document.__GLOBAL_SHARED_STATE = {}
    mutex.release()

    if (R) {
      let {CSS_BY_NAME} = R.__.cssManager
      CSS_BY_NAME.clear()
    }

  }
  
  try {

    document.__GLOBAL = {}
    const root = document.createElement(tagName)
    const Riot = riot.di({document, Node})
    const element = Riot.component(component)(root, props)
    mutex.release()
    const prop = Riot.__.globals.DOM_COMPONENT_INSTANCE_PROPERTY
    const stylesheet = new SheetsRegistry()

    let state = {}
    let shared = {}
    const getShared = (inst) => {
      return SHARED_ATTRS.concat(inst.shared || [])
    }

    if (element) {
      element.req = props.req;
      element.res = props.res;

      if (element.beforeRequest)
        element.beforeRequest(props);

      if (element.fetch)
        await element.fetch(props);

      if (element.afterRequest)
        element.afterRequest(props);

      if (element.onServer) // deprecated!
        element.onServer(props.req, props.res, props.next);

      state[element.id || component.name] = element.state
      shared[element.id || component.name] = getShared(element).map(
        (name) => ({name, data: element [name]})
      )
      
      if (element.stylesheet) {
        stylesheet.add(element.stylesheet)
      }
    }

    const elements = element.$$('*')
    const rendered = []

    for (let i in elements) {
      const el = elements [i]
      let instance = el [prop]

      if (instance) {
        instance.req = props.req;
        instance.res = props.res;
        
        if (instance.beforeRequest)
          instance.beforeRequest(props);

        if (instance.fetch)
          await instance.fetch(props);

        if (instance.afterRequest)
          instance.afterRequest(props);
        
        if (instance.onServer) // deprecated!
          instance.onServer(props.req, props.res, props.next);

        state[instance.id || instance.name] = instance.state
        shared[instance.id || instance.name] = getShared(instance).map(
          (name) => ({name, data: instance [name]})
        )

        if (instance.onRendered) {
          rendered.push({instance, props,})
        }
        if (instance.stylesheet) {
          stylesheet.add(instance.stylesheet)
        }
      }
    }

    rendered.map(e => {
      e.instance.onRendered(e.props)
    })

    if (element.onRendered) {
      element.onRendered(props)
    }

    element.$$('input,textarea,select,option').map((el) => {
      const value = el.type !== 'password' ? el.value : ''
      el.setAttribute('value', value || '')
    })
    
    const head = document.head.innerHTML
    const output = element.root.outerHTML
    
    const {layout = 'base'} = typeof component.exports === 'function' ? component.exports() : (component.exports || {})
    state = xss(JSON.stringify(state))
    shared = xss(JSON.stringify(shared))
    const g = xss(JSON.stringify(document.__GLOBAL_SHARED_STATE || {}))
    const style = stylesheet.toString()

    element.unmount()
    cleanup(Riot)

    return Promise.resolve({
      output, 
      state, 
      shared, 
      layout, 
      head, 
      stylesheet: style, 
      Global: g, 
      page: element 
    })
  }
  catch(e) {
    cleanup()
    return Promise.reject(e)
  }

}