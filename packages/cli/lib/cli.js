#!/usr/bin/env node

'use strict'

const cli = require('./commander')
// Q: can we ask the playbook builder for the config schema?
const configSchema = require('@antora/playbook-builder/lib/config/schema')
const ospath = require('path')
const solitaryConvict = require('@antora/playbook-builder/lib/solitary-convict')

const VERSION = require('../package.json').version

async function run () {
  const result = cli.parse(process.argv, { defaultCommand: 'generate' })
  /* istanbul ignore else */
  if (cli._promise) await cli._promise
  return result
}

function requireSiteGenerator (name, playbookDir) {
  try {
    // QUESTION should we remove the leading ./ ? (makes it a broader search)
    const searchPath = '.' + ospath.sep + ospath.relative('.', ospath.join(playbookDir, 'node_modules'))
    name = require.resolve(name, { paths: [searchPath] })
  } catch (e) {}
  return require(name)
}

cli
  .name('antora')
  .version(VERSION, '-v, --version')
  .description('A modular, multi-repository documentation site generator for AsciiDoc.')
  .usage('[options] [[command] [args]]')
  .option('--stacktrace', 'Print the stacktrace to the console if the application fails.')

cli
  .command('generate <playbook>')
  .description('Generate a documentation site specified in <playbook>.')
  .optionsFromConvict(solitaryConvict(configSchema), { exclude: 'playbook' })
  .action(async (playbookFile, command) => {
    let generateSite
    try {
      // TODO honor --generator option (or auto-detect)
      generateSite = requireSiteGenerator('@antora/site-generator-default', ospath.resolve(playbookFile, '..'))
    } catch (e) {
      console.error('error: No site generator found. Try installing @antora/site-generator-default.')
      process.exit(1)
    }
    const args = cli.rawArgs.slice(cli.rawArgs.indexOf(command.name()) + 1)
    args.splice(args.indexOf(playbookFile), 0, '--playbook')
    // TODO support passing a preloaded convict config as third option; gets new args and env
    cli._promise = generateSite(args, process.env).catch((err) => {
      console.error(cli.stacktrace ? err.stack : 'error: ' + err.message)
      process.exit(1)
    })
  })
  .options.sort((a, b) => a.long.localeCompare(b.long))

cli.command('help [command]', { noHelp: true }).action((name, command) => {
  if (name) {
    const helpCommand = cli.commands.find((candidate) => candidate.name() === name)
    if (helpCommand) {
      helpCommand.help()
    } else {
      console.error(
        `'${name}' is not a valid command in ${cli.name()}. See '${cli.name()} --help' for a list of commands.`
      )
      process.exit(1)
    }
  } else {
    cli.help()
  }
})

cli.command('version', { noHelp: true }).action(() => cli.emit('option:version'))

cli.on('--help', () => {
  console.log(
    `\nRun '${cli.name()} <command> --help' to see options and examples for a command (e.g., ${cli.name()} generate --help).`
  )
})

module.exports = run
