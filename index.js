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

module.exports.isServer = (typeof window === 'undefined')

/**
* Serialize a form to object
* @param {HTMLFormElement} element - a <form> element
* @return {object}
*/
module.exports.serializeForm = (element) => {
 let result = {};
 new FormData(element).forEach((value, key) => {
   result[key] = value;
 });
 return result;
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
    const elements = element.$$('*')

    let state = {}
    let shared = {}
    if (element) {

      if (element.fetch)
        await element.fetch(props);

      state[element.id || component.name] = element.state
      shared[element.id || component.name] = sharedAttributes.map((name) => ({name, data: element [name]}))
    }

    for (let i in elements) {
      const el = elements [i]
      let instance = el [prop]
      if (instance) {
        if (instance.fetch)
          await instance.fetch(props);
        state[instance.id || instance.name] = instance.state
        shared[instance.id || instance.name] = sharedAttributes.map((name) => ({name, data: instance [name]}))
      }
    }
    element.update()
    const output = element.root.outerHTML
    
    element.unmount()
    // cleanup()
    const {layout = 'base'} = component.exports || {}
    state = JSON.stringify(state)
    shared = JSON.stringify(shared)
    return Promise.resolve({output, state, shared, layout})
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

module.exports.parseArgs = (args) => {
  if (!args) {
    return
  }
  return args.split(';').map((e) => e.trim())
}

module.exports.FrontlessMiddleware = (dirname, sharedAttributes = []) => async (req, res, next) => {
  
  const ejs = require('ejs')
  const {renderAsync, resolvePath, parseArgs} = module.exports;

  req._res = res;
  if (req.headers.accept &&
      req.headers.accept.includes('/json')) {
    return next();
  }

  try {
    req.params.args = parseArgs(req.params.args)
    const path = resolvePath(dirname, req.params [0])
    const component = require((path || dirname + '/pages/errors/404.riot')).default
    const {output, state, shared, layout} = await renderAsync('section', component, { req, }, sharedAttributes)
    
    ejs.renderFile(dirname + `/pages/layout/${layout}.ejs`, {req, output, state, shared}, null, function(err, data) {
      if (err) {
        return res.status(500).end(err)
      }
      res.status(path ? 200 : 404).end(data)
    })
  } catch(e) {

    const error = require(dirname + ('/pages/errors/400.riot')).default
    console.log(e)
    const {output, state, layout, shared} = await renderAsync('section', error, { req, stack: (e.stack || e.message) }, sharedAttributes);
    ejs.renderFile(dirname + `/pages/layout/${layout}.ejs`, {req, output, state, shared}, null, function(err, data) {
      if (err) {
        return res.status(500).end(err)
      }
      res.status(400).end(data)
    })
  }
}
