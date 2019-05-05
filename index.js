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
module.exports.renderAsync = async function renderAsync(tagName, component, props) {
   
  if (global.document === void 0) {
    const {JSDOM} = require('jsdom')
    const {document,Node} = new JSDOM().window
    global.document = document
    global.Node = Node
  }
  const root = document.createElement(tagName)
  const element = riot.component(component)(root, props)
  const prop = riot.__.globals.DOM_COMPONENT_INSTANCE_PROPERTY
  const elements = element.$$('*')

  let state = {};
  if (element && element.fetch) {
    await element.fetch(props)
    state[element.id || component.name] = element.state
  }

  for (let i in elements) {
    const el = elements [i]
    let instance = el [prop]
    if (instance && instance.fetch) {
      await instance.fetch(props)
      state[instance.id || instance.name] = instance.state
    }
  }
  element.update()
  const output = element.root.outerHTML
  
  element.unmount()
  // cleanup()
  const {layout = 'base'} = component.exports || {}
  state = JSON.stringify(state)
  return Promise.resolve({output, state, layout})
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

module.exports.FrontlessMiddleware = (dirname) => async (req, res, next) => {
  
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
    const {output, state, layout} = await renderAsync('section', component, { req, })
    
    ejs.renderFile(dirname + `/pages/layout/${layout}.ejs`, {req, output, state}, null, function(err, data) {
      if (err) {
        return res.status(500).end(err)
      }
      res.status(path ? 200 : 404).end(data)
    })
  } catch(e) {

    const component = require(dirname + ('/pages/errors/400.riot')).default
    console.log(e)
    const {output, state, layout} = await renderAsync('section', component, { req, stack: (e.stack || e.message) });
    ejs.renderFile(dirname + `/pages/layout/${layout}.ejs`, {req, output, state}, null, function(err, data) {
      if (err) {
        return res.status(500).end(err)
      }
      res.status(400).end(data)
    })
  }
}
