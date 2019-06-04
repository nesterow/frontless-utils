/*
███████╗██████╗  ██████╗ ███╗   ██╗████████╗██╗     ███████╗███████╗███████╗
██╔════╝██╔══██╗██╔═══██╗████╗  ██║╚══██╔══╝██║     ██╔════╝██╔════╝██╔════╝
█████╗  ██████╔╝██║   ██║██╔██╗ ██║   ██║   ██║     █████╗  ███████╗███████╗
██╔══╝  ██╔══██╗██║   ██║██║╚██╗██║   ██║   ██║     ██╔══╝  ╚════██║╚════██║
██║     ██║  ██║╚██████╔╝██║ ╚████║   ██║   ███████╗███████╗███████║███████║
╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚══════╝╚══════╝╚══════╝
<<<<<<<<<<<<   FeathersJS - RiotJS - Turbolinks - Express    >>>>>>>>>>>>>>> 
----------------------------------------------------------------------------
@GitHub: https://github.com/nesterow/frontless
@License: MIT
@Author: Anton Nesterov <arch.nesterov@gmail.com>
*/

const riot = require('riot')
const qs = require('querystring')
const {SheetsRegistry} = require('jss')

module.exports.isServer = (typeof window === 'undefined')

/**
* Serialize a form to object
* @param {HTMLFormElement} element - a <form> element
* @return {object}
*/
module.exports.serializeForm = (element, omit = []) => {
 let result = {};
 new FormData(element).forEach((value, key) => {
   if (!omit.includes(key)) {
     result[key] = value;
   }
 });
 return result;
}

const escapeArg = (str = '') => {
  return str
    .replace(/@/gi, '{~1}')
    .replace(/;/gi, '{~2}')
}

const unescapeArg = (str = '') => {
  return str
    .replace(/\{\~1\}/gi, '@')
    .replace(/\{\~2\}/gi, ';')
}

const getURL = (argsuments = [], query = {}, pathname = null) => {
  const args = argsuments.map( e => escapeArg(e)).join(';')
  const path = (pathname || location.pathname).split('@') [0]
  console.log(args)
  return `${path}${args.trim() ? '@' + args : ''}?${qs.stringify(query)}`
}

module.exports.parseArgs = (args) => {
  if (!args) {
    return
  }
  return args.split(';').map((e) => unescapeArg(e.trim()))
}

const pushState = (argsuments = [], query = {}) => {
  if (typeof window !== 'undefined') 
    history.pushState({}, null, getURL(argsuments, query))
}

/** redirect to specific location. */
module.exports.withRouter = (component) => {
  function redirect(path, argsuments = [], query = {}) {
    if (typeof window === 'undefined') {
      const onServer = component.onServer || (() => {});
      component.onServer = (req, res, next) => {
        onServer(req, res, next)
        res.set('Turbolinks-Location', path)
        res.redirect(301, getURL(argsuments, query, path))
      }
    } else if (window.Turbolinks){
      Turbolinks.visit(getURL(argsuments, query, path))
    }
  }
  component.redirect = redirect.bind(component)
  component.pushState = pushState
  
}

/** Simple hydrate method. Not used at the time */
module.exports.hydrate = function hydrate(el, component, props) {
  const clone = el.cloneNode(false)
  el.parentNode.replaceChild(clone, el)
  return riot.component(component)(clone, props)
}


module.exports.isTagRegistered = function isTagRegistered(name) {
  return riot.__.globals.COMPONENTS_IMPLEMENTATION_MAP.has(name);
}

/** 
 * Render a riot tag.
 * This method resolves all `fetch()` operations including components children
 * TODO: A global store, maybe Mobx?
 * @return {Promise<{output: String, state: Object, layout: string}>}
 * */
module.exports.renderAsync = async function renderAsync(tagName, component, props, sharedAttributes) {
  
  if (global.document === void 0) {
    const {JSDOM} = require('jsdom')
    const {document,Node} = new JSDOM().window
    global.document = document
    global.Node = Node
  }
  try {
    const root = document.createElement(tagName)
    const element = riot.component(component)(root, props)
    const prop = riot.__.globals.DOM_COMPONENT_INSTANCE_PROPERTY
    const stylesheet = new SheetsRegistry()

    let state = {}
    let shared = {}
    if (element) {
      element.req = props.req;
      element.res = props.res;
      if (element.fetch)
        await element.fetch(props);

      if (element.onServer)
        element.onServer(props.req, props.res, props.next);

      state[element.id || component.name] = element.state
      shared[element.id || component.name] = sharedAttributes.map((name) => ({name, data: element [name]}))
      
      if (element.stylesheet) {
        stylesheet.add(element.stylesheet)
      }
    }

    const elements = element.$$('*')

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
        shared[instance.id || instance.name] = sharedAttributes.map((name) => ({name, data: instance [name]}))
        instance.update()
        
        if (instance.onRendered) {
          instance.onRendered(props)
        }
        if (instance.stylesheet) {
          stylesheet.add(instance.stylesheet)
        }
      }
    }
    element.update()
    if (element.onRendered) {
      element.onRendered(props)
    }
   
    element.$$('input,textarea,select,option').map((el) => {
      const value = el.type !== 'password' ? el.value : ''
      el.setAttribute('value', value || '')
    })
    
    const head = document.head.innerHTML
    const output = element.root.outerHTML
    
    element.unmount()
    // cleanup()
    const {layout = 'base'} = typeof component.exports === 'function' ? component.exports() : (component.exports || {})
    state = JSON.stringify(state)
    shared = JSON.stringify(shared)
    return Promise.resolve({output, state, shared, layout, head, stylesheet: stylesheet.toString() })
  }
  catch(e) {
    return Promise.reject(e)
  }
}

let TAG_COUNT = {}
/**
 * Naive unique IDs for components.
 * Enumerates component by name
 */
module.exports.enumerateTags = function setTagId (tag) {
  if (tag.id === void 0) {
    TAG_COUNT [tag.name] = (TAG_COUNT [tag.name] || 0) + 1
    tag.id = tag.name + TAG_COUNT [tag.name]
  }
}

/**
 * Take request url and return a file system path of the page
 */
function resolvePath(dirname, path) {
  
  const fs = require('fs')

  const fullPath = (dirname + '/pages/' + path )
    .replace(/\/\//g, '/').replace(/\/$/, '')
  
  try {
    
    try {
      if (fs.statSync(fullPath + '.riot').isFile())
        return fullPath + '.riot';
    }
    catch (e) { }

    if (fs.statSync(fullPath + '/index.riot').isFile())
      return fullPath + '/index.riot';

  } catch (e) {
    return false;
  }

}
module.exports.resolvePath =  resolvePath


const PLUGIN_REGISTRY = [];

module.exports.install = (plugin) => {
  if (PLUGIN_REGISTRY.includes(plugin))
    return console.log(plugin.name, 'already installed');
  PLUGIN_REGISTRY.push(plugin);
}

module.exports.plugin = (pages, tags) => {
  pages.map( tag => {
    tags.push(tag)
  })
}

module.exports.withPlugins = (app, dirname) => {

  app.on('setup', (app) => {
    PLUGIN_REGISTRY.map((plugin)=> {
      if (plugin.setup) {
        console.log('🔌 ', plugin.name + ':', 'initializing middlewares');
        plugin.setup(app, dirname)
      }
    })
  })
  
  app.on('setup:ssr', (app) => {
    PLUGIN_REGISTRY.map((plugin)=> {
      if (plugin.setupSSR) {
        console.log('🔌 ', plugin.name + ':', 'initializing SSR middlewares');
        plugin.setupSSR(app, dirname, module.exports.FrontlessMiddleware)
      }
    })
  })

  app.on('connected', (app, db) => {
    PLUGIN_REGISTRY.map((plugin)=> {
      if (plugin.connected) {
        console.log('🔌 ', plugin.name + ':', 'initializing middlewares after connection');
        plugin.connected(app, db, dirname)
      }
    })
  })
  
}

module.exports.FrontlessMiddleware = (dirname, sharedAttributes = [], pluginOpts = {}) => async (req, res, next) => {
  
  const ejs = require('ejs')
  const {renderAsync, resolvePath, parseArgs} = module.exports;

  req._res = res;
  if (req.headers.accept &&
      req.headers.accept.includes('/json')) {
    return next();
  }

  try {
    req.params.args = parseArgs(req.params.args)
    const path = resolvePath(pluginOpts.__dirname || dirname, req.params [0])
    const component = require((path || dirname + '/pages/errors/404.riot')).default
    const {output, state, shared, layout, head, stylesheet} = await renderAsync('section', component, { req, res, next, }, sharedAttributes)
    
    ejs.renderFile(pluginOpts.layoutPath || (dirname + `/pages/layout/${layout}.ejs`), {req, output, state, shared, head, stylesheet}, null, function(err, data) {
      if (err) {
        return res.status(500).end(err)
      }
      res.status(path ? 200 : 404).end(data)
    })
  } catch(e) {

    const error = require(dirname + ('/pages/errors/400.riot')).default
    console.log(e)
    const {output, state, layout, shared, head, stylesheet} = await renderAsync('section', error, { req, stack: (e.stack || e.message) }, sharedAttributes);
    ejs.renderFile(dirname + `/pages/layout/${layout}.ejs`, {req, output, state, shared, head, stylesheet}, null, function(err, data) {
      if (err) {
        return res.status(500).end(err)
      }
      res.status(400).end(data)
    })
  }
}
