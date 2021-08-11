module.exports.register = (pipeline) => {
  pipeline.on('playbookBuilt', function ({ playbook }) {
    playbook = JSON.parse(JSON.stringify(playbook))
    playbook.content.sources = playbook.content.sources.filter((source) => !source.url.startsWith('git@'))
    this.updateVars({ playbook })
  })
}
