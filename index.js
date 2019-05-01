const riot = require('riot')

if (typeof window === void 0) {
  (function(moduleWrapCopy) {
    riot.wrap = function(script) {
      script = "console.log('debug');" + script
      return moduleWrapCopy(script);
    };
  }(riot.wrap))
}

/** Simple hydrate method */
module.exports.hydrate = function hydrate(el, component, props) {
  const clone = el.cloneNode(false)
  el.parentNode.replaceChild(clone, el)
  return riot.component(component)(clone, props)
}


module.exports.isTagRegistered = function isTagRegistered(name) {
  return riot.__.globals.COMPONENTS_IMPLEMENTATION_MAP.has(name);
}

/** Render a riot tag */
module.exports.renderAsync = async function renderAsync(tagName, component, props) {
  
  const {JSDOM} = require('jsdom')
  
  if (global.document === void 0) {
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
  // cleanup()
  const {layout = 'base'} = component.exports || {}
  state = JSON.stringify(state)
  return Promise.resolve({output, state, layout})
}

let TAG_COUNT = {}
module.exports.enumerateTags = function setTagId (tag) {
  if (tag.id === void 0) {
    TAG_COUNT [tag.name] = (TAG_COUNT [tag.name] || 0) + 1
    tag.id = tag.name + TAG_COUNT [tag.name]
  }
}


