const {addHook} = require('pirates')
const {transform} = require('@babel/core')
const {compile} = require('@riotjs/compiler')
const path = require('path')
const {
  mkdirSync, 
  readFileSync, 
  writeFileSync, 
  existsSync,
} = require('fs')
const del = require('del')

const PRODUCTION = process.env.NODE_ENV === 'production'
const BUILD = path.join(process.cwd(), '.build')


if (!PRODUCTION && existsSync(BUILD)) {
  del.sync([BUILD])
  mkdirSync(BUILD)
} 

// resolve name for transformed files
const file = (filename) => {
  const relative = filename.replace(process.cwd(), '')
    .replace('.riot', '.riot.js')
    .replace(/\//g, '+')
  return path.join(process.cwd(), '.build', relative)
}

module.exports = (options) => addHook(
  function(source, filename) {
    
    if (PRODUCTION && existsSync(file(filename))) {
      const prebuilt = readFileSync(file(filename), {encoding: 'utf8'})
      return prebuilt
    }

    let code = filename.endsWith('.riot') ? compile(source, { file: filename }).code : source;
    
    const build = transform(code, {
      presets: [
        [
          '@babel/preset-env',
          {
            modules: 'cjs',
            targets: {
              node: process.versions.node
            }
          }
        ]
      ]
    }).code

    writeFileSync(file(filename), build)
    return build

  },
  {
    exts: ['.js', '.riot'],
    ignoreNodeModules: true,
    ...options
  }
)