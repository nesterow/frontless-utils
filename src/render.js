const riot = require('riot')
const {SheetsRegistry} = require('jss')
const xss = require("xss")
const {CSS_BY_NAME} = riot.__.cssManager;
const mutex = require('./mutex')
const {JSDOM} = require('jsdom')
/** 
 * Render a riot tag.
 * This method resolves all `fetch()` operations including components children
 * @return {Promise<{output: String, state: Object, layout: string}>}
 * */
module.exports = async function renderAsync(tagName, component, props, sharedAttributes) {
  const cleanup = () => {
    document.__GLOBAL = {}
    document.__GLOBAL_SHARED_STATE = {}
    CSS_BY_NAME.clear()
    mutex.release()
  }
  const {document,Node} = new JSDOM().window
  await mutex.lock({document, Node})
  try {
    document.__GLOBAL = {}
    const root = document.createElement(tagName)
    const element = riot.component(component)(root, props)
    if (element.startSSR) {
      element.startSSR(props)
    }
    const prop = riot.__.globals.DOM_COMPONENT_INSTANCE_PROPERTY
    const stylesheet = new SheetsRegistry()

    let state = {}
    let shared = {}
    const getShared = (inst) => sharedAttributes.concat(inst.shared || [])

    if (element) {
      element.req = props.req;
      element.res = props.res;
      if (element.fetch)
        await element.fetch(props);
      if (element.onServer)
        element.onServer(props.req, props.res, props.next);

      state[element.id || component.name] = element.state
      shared[element.id || component.name] = getShared(element).map((name) => ({name, data: element [name]}))
      
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
        if (instance.fetch)
          await instance.fetch(props);
        
        if (instance.onServer)
          instance.onServer(props.req, props.res, props.next);

        state[instance.id || instance.name] = instance.state
        shared[instance.id || instance.name] = getShared(instance).map((name) => ({name, data: instance [name]}))
        instance.update({})
        
        if (instance.onRendered) {
          rendered.push({instance, props,})
        }
        if (instance.stylesheet) {
          stylesheet.add(instance.stylesheet)
        }
      }
    }

    element.update({})

    if (element.onRendered) {
      element.onRendered(props)
    }

    rendered.map(e => {
      e.instance.onRendered(e.props)
    })

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
    if (element.endSSR) {
      element.endSSR(props)
    }
    element.unmount()
    cleanup()
    return Promise.resolve({output, state, shared, layout, head, stylesheet: style, Global: g, page: element })
  }
  catch(e) {
    mutex.release()
    return Promise.reject(e)
  }
}