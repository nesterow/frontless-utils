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

const babel = require('src/babel')
const render = require('src/render')
const Frontless = require('src/middleware')

const isBrowser = typeof window !== 'undefined'
const {serializeForm} = require('./browser')

module.exports = {
  babel,
  render,
  Frontless,
  isBrowser,
  isServer: !isBrowser,
  serializeForm
}